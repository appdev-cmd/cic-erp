// Task Service — CIC ERP
// CRUD + hierarchical visibility + entity link queries

import { dataClient as supabase } from '../lib/dataClient';
import type {
  Task,
  TaskLink,
  TaskStatus,
  CreateTaskInput,
  UpdateTaskInput,
  CreateTaskLinkInput,
  TaskFilterOptions,
  TaskVisibilityContext,
  ApprovalMode,
  ApprovalStep,
} from '../types/taskTypes';
import { DiscussionService } from './discussionService';
import { TelegramNotificationService } from './telegramNotificationService';

const TASK_SELECT = `
  *,
  status:task_statuses(*)
`;

/**
 * Map raw DB row to Task type
 */
function mapTask(row: any): Task {
  return {
    ...row,
    status: row.status || undefined,
    assignees: row.assignees || [],
    watchers: row.watchers || [],
    supporters: row.supporters || [],
    approvers: row.approvers || [],
    tags: row.tags || [],
    custom_fields: row.custom_fields || {},
    auto_generated: row.auto_generated || false,
    is_private: row.is_private || false,
    is_pinned: row.is_pinned || false,
    time_spent: row.time_spent || 0,
    sort_order: row.sort_order || 0,
    approval_status: row.approval_status || undefined,
    approval_parent_id: row.approval_parent_id || undefined,
    approval_mode: row.approval_mode || 'all',
    approval_comment: row.approval_comment || undefined,
  };
}

export const TaskService = {
  // ═══════════════════════════════════════
  // TASK STATUSES
  // ═══════════════════════════════════════

  async getStatuses(spaceId?: string): Promise<TaskStatus[]> {
    let query = supabase
      .from('task_statuses')
      .select('*')
      .order('sort_order');

    if (spaceId) {
      query = query.or(`space_id.eq.${spaceId},space_id.is.null`);
    } else {
      query = query.is('space_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as TaskStatus[];
  },

  async getDefaultStatusId(): Promise<string | null> {
    const { data, error } = await supabase
      .from('task_statuses')
      .select('id')
      .eq('is_default', true)
      .is('space_id', null)
      .single();

    if (error) return null;
    return data?.id || null;
  },

  // ═══════════════════════════════════════
  // TASK CRUD
  // ═══════════════════════════════════════

  async create(input: CreateTaskInput): Promise<Task> {
    // Auto-set default status if not provided
    if (!input.status_id) {
      input.status_id = (await this.getDefaultStatusId()) || undefined;
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert(input)
      .select(TASK_SELECT)
      .single();

    if (error) throw error;
    const task = mapTask(data);

    // Auto-generate creation system log
    if (task.created_by) {
      try {
        await DiscussionService.add({
          entity_type: 'task',
          entity_id: task.id,
          user_id: task.created_by,
          content: 'Tạo công việc',
          comment_type: 'system',
        });
      } catch (e) {
        console.warn('Failed to insert task creation log', e);
      }
    }

    // --- TELEGRAM NOTIFICATIONS ---
    if (task.assignees && task.assignees.length > 0) {
      try {
        const { data: emps } = await supabase.from('employees').select('id, full_name').in('id', task.assignees);
        const { data: creator } = task.created_by ? await supabase.from('employees').select('full_name').eq('id', task.created_by).single() : { data: null };
        const { data: contract } = task.source_entity_id && task.source_module === 'contracts' 
          ? await supabase.from('contracts').select('title').eq('id', task.source_entity_id).single() : { data: null };

        for (const assigneeId of task.assignees) {
          // Don't notify the person who created the task if they assigned it to themselves
          if (assigneeId === task.created_by && !task.auto_generated) continue;

          const emp = emps?.find((e: any) => e.id === assigneeId);
          TelegramNotificationService.notifyTaskChange({
            eventType: 'assigned',
            taskId: task.id,
            taskTitle: task.title,
            assigneeId: assigneeId,
            assigneeName: emp?.full_name,
            contractTitle: contract?.title,
            priority: task.priority,
            dueDate: task.due_date,
            changedBy: task.auto_generated ? 'Hệ thống (Auto-Task)' : (creator?.full_name || 'Hệ thống')
          });
        }
      } catch (e) {
        console.warn('Failed to send telegram notifications for new task', e);
      }
    }

    return task;
  },

  async getById(id: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? mapTask(data) : null;
  },

  async update(id: string, updates: UpdateTaskInput): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select(TASK_SELECT)
      .single();

    if (error) throw error;
    return mapTask(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async bulkDelete(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', ids);

    if (error) throw error;
  },

  /**
   * Mark task as completed (set status to done + timestamp)
   */
  async complete(id: string, userId: string): Promise<Task> {
    const statuses = await this.getStatuses();
    const doneStatus = statuses.find(s => s.is_done && s.name !== 'Hủy');

    const updated = await this.update(id, {
      status_id: doneStatus?.id,
      completed_at: new Date().toISOString(),
      completed_by: userId,
    });

    // Notify creator if someone else completed it
    if (updated.created_by && updated.created_by !== userId && !updated.auto_generated) {
      try {
        const { data: updater } = await supabase.from('employees').select('full_name').eq('id', userId).single();
        const { data: contract } = updated.source_entity_id && updated.source_module === 'contracts'
          ? await supabase.from('contracts').select('title').eq('id', updated.source_entity_id).single() : { data: null };

        TelegramNotificationService.notifyTaskChange({
          eventType: 'completed',
          taskId: updated.id,
          taskTitle: updated.title,
          assigneeId: updated.created_by, // Send to creator
          contractTitle: contract?.title,
          changedBy: updater?.full_name || 'Hệ thống'
        });
      } catch (e) {
        console.warn('Failed to send telegram notification for completed task', e);
      }
    }

    return updated;
  },

  // ═══════════════════════════════════════
  // TASK QUERIES WITH VISIBILITY
  // ═══════════════════════════════════════

  /**
   * Get tasks visible to the current user based on hierarchical visibility.
   * 
   * Rules:
   * - Admin: see all
   * - Leadership (rank 100): see rank < 100 (NOT same rank peers)
   * - Phó TGĐ (rank 80): see rank < 80, only in managed_unit_ids
   * - UnitLeader (rank 50): see unit employees
   * - NVKD/NVKT (rank 0): only "related to me" tasks
   * - Always: tasks where user is in assignees/watchers/supporters/approvers/created_by
   */
  async getVisibleTasks(
    ctx: TaskVisibilityContext,
    filters?: TaskFilterOptions
  ): Promise<Task[]> {
    // Step 1: Get all tasks user is directly involved in (always visible)
    const myTaskIds = await this._getMyTaskIds(ctx.userId);

    // Step 2: Based on role/rank, determine additional visible tasks
    let additionalTaskIds: string[] = [];

    if (ctx.role === 'Admin') {
      // Admin sees everything — skip filter, query all
      return this._queryTasks(filters, undefined, ctx);
    }

    if (ctx.managementRank >= 100) {
      // CT/TGĐ: see all except same-rank peers' personal tasks
      additionalTaskIds = await this._getTasksBelowRank(100, ctx.userId);
    } else if (ctx.managementRank >= 80) {
      // Phó TGĐ: only managed_unit_ids, rank < 80
      additionalTaskIds = await this._getTasksInUnits(ctx.managedUnitIds, 80);
    } else if (ctx.managementRank >= 50 || ctx.role === 'UnitLeader' || ctx.role === 'AdminUnit') {
      // Trưởng ĐV: unit employees
      if (ctx.unitId) {
        additionalTaskIds = await this._getTasksInUnits([ctx.unitId], 50);
      }
    } else if (ctx.role === 'Accountant' || ctx.role === 'ChiefAccountant') {
      // Kế toán: finance-related tasks
      additionalTaskIds = await this._getTasksBySourceModule(['payment', 'contract']);
    } else if (ctx.role === 'Legal') {
      // Pháp chế: legal-related tasks
      additionalTaskIds = await this._getTasksBySourceModule(['contract']);
    }

    // Merge: my tasks + additional visible tasks
    const allVisibleIds = [...new Set([...myTaskIds, ...additionalTaskIds])];

    if (allVisibleIds.length === 0) return [];

    return this._queryTasks(filters, allVisibleIds, ctx);
  },

  /**
   * Get tasks specifically assigned to / involving the user.
   */
  async getMyTasks(userId: string, filters?: TaskFilterOptions): Promise<Task[]> {
    const ids = await this._getMyTaskIds(userId);
    if (ids.length === 0) return [];
    return this._queryTasks(filters, ids);
  },

  /**
   * Get tasks linked to a specific entity (for EntityTaskList component).
   */
  async getByEntityLink(entityType: string, entityId: string, ctx?: TaskVisibilityContext): Promise<Task[]> {
    const { data: links, error: linkError } = await supabase
      .from('task_links')
      .select('task_id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (linkError) throw linkError;
    if (!links || links.length === 0) return [];

    const taskIds = links.map(l => l.task_id);
    return this._queryTasks(undefined, taskIds, ctx);
  },

  /**
   * Get tasks linked to a specific BIM project (via project_id column).
   */
  async getByProjectId(projectId: string, filters?: TaskFilterOptions, ctx?: TaskVisibilityContext): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('project_id', projectId)
      .is('parent_id', null)
      .order('sort_order')
      .order('created_at', { ascending: false });

    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }

    // Hide test data for non-Admin
    if (ctx && ctx.role !== 'Admin') {
      query = query.not('tags', 'cs', '{"_test_data"}');
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapTask);
  },

  // ═══════════════════════════════════════
  // TASK LINKS
  // ═══════════════════════════════════════

  async getLinks(taskId: string): Promise<TaskLink[]> {
    const { data, error } = await supabase
      .from('task_links')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at');

    if (error) throw error;
    return (data || []) as TaskLink[];
  },

  async addLink(input: CreateTaskLinkInput): Promise<TaskLink> {
    const { data, error } = await supabase
      .from('task_links')
      .insert(input)
      .select()
      .single();

    if (error) throw error;
    return data as TaskLink;
  },

  async removeLink(linkId: string): Promise<void> {
    const { error } = await supabase
      .from('task_links')
      .delete()
      .eq('id', linkId);

    if (error) throw error;
  },

  async updateLink(linkId: string, updates: Partial<CreateTaskLinkInput>): Promise<TaskLink> {
    const { data, error } = await supabase
      .from('task_links')
      .update(updates)
      .eq('id', linkId)
      .select()
      .single();

    if (error) throw error;
    return data as TaskLink;
  },

  // ═══════════════════════════════════════
  // SUBTASKS
  // ═══════════════════════════════════════

  async getSubtasks(parentId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('parent_id', parentId)
      .order('sort_order');

    if (error) throw error;
    return (data || []).map(mapTask);
  },

  // ═══════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════

  /**
   * Get task IDs where user is directly involved.
   */
  async _getMyTaskIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('id')
      .or(`assignees.cs.{${userId}},watchers.cs.{${userId}},supporters.cs.{${userId}},approvers.cs.{${userId}},created_by.eq.${userId}`);

    if (error) throw error;
    return (data || []).map(d => d.id);
  },

  /**
   * Get task IDs created by employees with rank below the given threshold.
   * Excludes tasks of employees at same rank (peer protection).
   */
  async _getTasksBelowRank(rank: number, excludeUserId: string): Promise<string[]> {
    // Get employee IDs with rank < given rank
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id')
      .lt('management_rank', rank);

    if (empError) throw empError;
    if (!employees || employees.length === 0) return [];

    const empIds = employees.map(e => e.id);

    // Optimized filtering via Supabase: created_by IN (...) OR assignees OVERLAPS {...}
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('id')
      .neq('created_by', excludeUserId)
      .or(`created_by.in.(${empIds.join(',')}),assignees.ov.{${empIds.join(',')}}`);

    if (taskError) throw taskError;
    return (tasks || []).map(t => t.id);
  },

  /**
   * Get task IDs for employees in specific units with rank below threshold.
   */
  async _getTasksInUnits(unitIds: string[], belowRank: number): Promise<string[]> {
    if (unitIds.length === 0) return [];

    // Get employees in these units with rank < belowRank
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id')
      .in('unitId', unitIds)
      .lt('management_rank', belowRank);

    if (empError) throw empError;
    if (!employees || employees.length === 0) return [];

    const empIds = employees.map(e => e.id);

    // Optimized filtering via Supabase
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('id')
      .or(`created_by.in.(${empIds.join(',')}),assignees.ov.{${empIds.join(',')}}`);

    if (taskError) throw taskError;
    return (tasks || []).map(t => t.id);
  },

  /**
   * Get task IDs by source module (for role-specific visibility like Accountant).
   */
  async _getTasksBySourceModule(modules: string[]): Promise<string[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('id')
      .in('source_module', modules);

    if (error) throw error;
    return (data || []).map(d => d.id);
  },

  /**
   * Core query builder: fetch tasks with optional ID filter and TaskFilterOptions.
   */
  async _queryTasks(filters?: TaskFilterOptions, ids?: string[], ctx?: TaskVisibilityContext): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select(TASK_SELECT)
      .is('parent_id', null) // Top-level tasks only
      .order('is_pinned', { ascending: false }) // Pinned tasks first
      .order('sort_order')
      .order('created_at', { ascending: false });

    // ID filter (for visibility-scoped queries)
    if (ids) {
      if (ids.length === 0) return [];
      query = query.in('id', ids);
    }

    // Apply filters
    if (filters) {
      if (filters.status_ids && filters.status_ids.length > 0) {
        query = query.in('status_id', filters.status_ids);
      }
      if (filters.priorities && filters.priorities.length > 0) {
        query = query.in('priority', filters.priorities);
      }
      if (filters.assignee_ids && filters.assignee_ids.length > 0) {
        // Tasks where any of the filter assignee IDs are in the assignees array
        const orConditions = filters.assignee_ids.map(id => `assignees.cs.{${id}}`).join(',');
        query = query.or(orConditions);
      }
      if (filters.source_modules && filters.source_modules.length > 0) {
        query = query.in('source_module', filters.source_modules);
      }
      if (filters.source_entity_id) {
        query = query.eq('source_entity_id', filters.source_entity_id);
      }
      if (filters.due_before) {
        query = query.lte('due_date', filters.due_before);
      }
      if (filters.due_after) {
        query = query.gte('due_date', filters.due_after);
      }
      if (filters.is_overdue) {
        query = query.lt('due_date', new Date().toISOString().split('T')[0]);
        // Exclude done tasks
        const statuses = await this.getStatuses();
        const doneIds = statuses.filter(s => s.is_done).map(s => s.id);
        if (doneIds.length > 0) {
          // Use not-in for filtering out done statuses
          for (const doneId of doneIds) {
            query = query.neq('status_id', doneId);
          }
        }
      }
      if (filters.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }
      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }
      if (filters.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
    }

    // Hide test data for non-Admin
    if (ctx && ctx.role !== 'Admin') {
      query = query.not('tags', 'cs', '{"_test_data"}');
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapTask);
  },

  // ═══════════════════════════════════════
  // BITRIX24-STYLE ROLE FILTERING
  // ═══════════════════════════════════════

  /**
   * Get tasks filtered by user role (Bitrix24 top-tabs style).
   * - 'all': all my tasks (assigned/watching/supporting/created)
   * - 'ongoing': tasks in progress where I'm assigned
   * - 'assisting': tasks where I'm a supporter
   * - 'set_by_me': tasks I created/assigned to others
   * - 'following': tasks where I'm a watcher
   * - 'supervising': tasks of subordinates (uses visibility context)
   */
  async getTasksByRole(
    userId: string,
    role: string,
    filters?: TaskFilterOptions,
    visibilityCtx?: TaskVisibilityContext
  ): Promise<Task[]> {
    // ── Supervising: delegate to visibility-based subordinate query ──
    if (role === 'supervising' && visibilityCtx) {
      return this._getSupervisingTasks(visibilityCtx, filters);
    }

    let query = supabase
      .from('tasks')
      .select(TASK_SELECT)
      .is('parent_id', null)
      .order('is_pinned', { ascending: false })
      .order('sort_order')
      .order('created_at', { ascending: false });

    switch (role) {
      case 'ongoing': {
        // Tasks assigned to me that are in progress (not done)
        query = query.contains('assignees', [userId]);
        const statuses = await this.getStatuses();
        const doneIds = statuses.filter(s => s.is_done).map(s => s.id);
        for (const doneId of doneIds) {
          query = query.neq('status_id', doneId);
        }
        break;
      }
      case 'assisting':
        query = query.contains('supporters', [userId]);
        break;
      case 'set_by_me':
        query = query.eq('created_by', userId);
        break;
      case 'following':
        query = query.contains('watchers', [userId]);
        break;
      default: // 'all'
        query = query.or(
          `assignees.cs.{${userId}},watchers.cs.{${userId}},supporters.cs.{${userId}},approvers.cs.{${userId}},created_by.eq.${userId}`
        );
        break;
    }

    // Apply additional filters
    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }
    if (filters?.project_id) {
      query = query.eq('project_id', filters.project_id);
    }
    if (filters?.source_modules && filters.source_modules.length > 0) {
      query = query.in('source_module', filters.source_modules);
    }
    if (filters?.source_entity_id) {
      query = query.eq('source_entity_id', filters.source_entity_id);
    }
    if (filters?.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
    }

    // Hide test data for non-Admin
    if (visibilityCtx?.role !== 'Admin') {
      query = query.not('tags', 'cs', '{"_test_data"}');
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapTask);
  },

  /**
   * Get role-based task counts for badge counters on tabs.
   */
  async getRoleCounts(userId: string, role?: string): Promise<Record<string, number>> {
    const roles = ['all', 'ongoing', 'assisting', 'set_by_me', 'following'];
    const counts: Record<string, number> = {};
    
    // Batch: get all user tasks, then filter in-memory for counts
    let { data, error } = await supabase
      .from('tasks')
      .select('id, assignees, watchers, supporters, approvers, created_by, status_id, tags')
      .is('parent_id', null)
      .or(
        `assignees.cs.{${userId}},watchers.cs.{${userId}},supporters.cs.{${userId}},approvers.cs.{${userId}},created_by.eq.${userId}`
      );

    if (error || !data) return { all: 0, ongoing: 0, assisting: 0, set_by_me: 0, following: 0 };

    // Filter out test data for non-Admin users
    if (role !== 'Admin') {
      data = data.filter((t: any) => !(t.tags || []).includes('_test_data'));
    }

    const statuses = await this.getStatuses();
    const doneIds = new Set(statuses.filter(s => s.is_done).map(s => s.id));

    counts.all = data.length;
    counts.ongoing = data.filter(t => 
      (t.assignees || []).includes(userId) && !doneIds.has(t.status_id)
    ).length;
    counts.assisting = data.filter(t => (t.supporters || []).includes(userId)).length;
    counts.set_by_me = data.filter(t => t.created_by === userId).length;
    counts.following = data.filter(t => (t.watchers || []).includes(userId)).length;

    return counts;
  },

  // ═══════════════════════════════════════
  // SUPERVISING / TEAM MANAGEMENT
  // ═══════════════════════════════════════

  /**
   * Get subordinate employees based on the user's management rank and units.
   * Admin: all | TGĐ (rank 100): rank < 100 | Phó TGĐ (rank 80): managed units rank < 80 | Trưởng ĐV (rank 50): unit members
   */
  async getSubordinateEmployees(ctx: TaskVisibilityContext): Promise<{ id: string; name: string; position?: string; unit_id?: string; avatar?: string }[]> {
    if (ctx.role === 'Admin') {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, position, unit_id, avatar')
        .neq('id', ctx.userId)
        .order('name');
      if (error) throw error;
      return data || [];
    }

    if (ctx.managementRank >= 100) {
      // TGĐ: see all employees with rank < 100
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, position, unit_id, avatar')
        .lt('management_rank', 100)
        .neq('id', ctx.userId)
        .order('name');
      if (error) throw error;
      return data || [];
    }

    if (ctx.managementRank >= 80) {
      // Phó TGĐ: managed units, rank < 80
      if (ctx.managedUnitIds.length === 0) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, position, unit_id, avatar')
        .in('unit_id', ctx.managedUnitIds)
        .lt('management_rank', 80)
        .neq('id', ctx.userId)
        .order('name');
      if (error) throw error;
      return data || [];
    }

    if (ctx.managementRank >= 50 || ctx.role === 'UnitLeader' || ctx.role === 'AdminUnit') {
      // Trưởng ĐV: unit members
      const unitIds = ctx.managedUnitIds.length > 0 ? ctx.managedUnitIds : (ctx.unitId ? [ctx.unitId] : []);
      if (unitIds.length === 0) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, position, unit_id, avatar')
        .in('unit_id', unitIds)
        .lt('management_rank', 50)
        .neq('id', ctx.userId)
        .order('name');
      if (error) throw error;
      return data || [];
    }

    return [];
  },

  /**
   * Get supervising tasks — tasks of subordinates only (excludes user's own tasks).
   * Used by the "Giám sát" tab.
   */
  async _getSupervisingTasks(
    ctx: TaskVisibilityContext,
    filters?: TaskFilterOptions
  ): Promise<Task[]> {
    // Get subordinate employee IDs
    const subordinates = await this.getSubordinateEmployees(ctx);
    if (subordinates.length === 0) return [];
    const subIds = subordinates.map(e => e.id);

    // Build query: tasks where subordinates are involved (assigned/created)
    let query = supabase
      .from('tasks')
      .select(TASK_SELECT)
      .is('parent_id', null)
      .or(`created_by.in.(${subIds.join(',')}),assignees.ov.{${subIds.join(',')}}`)
      .order('is_pinned', { ascending: false })
      .order('sort_order')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`);
    }
    if (filters?.project_id) {
      query = query.eq('project_id', filters.project_id);
    }
    if (filters?.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
    }
    if (filters?.assignee_ids && filters.assignee_ids.length > 0) {
      const orConditions = filters.assignee_ids.map(id => `assignees.cs.{${id}}`).join(',');
      query = query.or(orConditions);
    }

    // Hide test data for non-Admin
    if (ctx.role !== 'Admin') {
      query = query.not('tags', 'cs', '{"_test_data"}');
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapTask);
  },

  /**
   * Get task statistics for subordinates — used by TeamDashboard.
   * Returns per-employee stats: total, overdue, in progress, completed.
   */
  async getSubordinateStats(
    ctx: TaskVisibilityContext
  ): Promise<{
    employees: { id: string; name: string; position?: string; unit_id?: string; avatar?: string;
      total: number; overdue: number; inProgress: number; completed: number }[];
    totals: { total: number; overdue: number; inProgress: number; completed: number };
  }> {
    const subordinates = await this.getSubordinateEmployees(ctx);
    if (subordinates.length === 0) {
      return { employees: [], totals: { total: 0, overdue: 0, inProgress: 0, completed: 0 } };
    }

    const subIds = subordinates.map(e => e.id);
    const statuses = await this.getStatuses();
    const doneIds = new Set(statuses.filter(s => s.is_done).map(s => s.id));
    const today = new Date().toISOString().split('T')[0];

    // Fetch all tasks assigned to subordinates
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, assignees, status_id, due_date, created_by, tags')
      .is('parent_id', null)
      .or(`assignees.ov.{${subIds.join(',')}}`);

    if (error) throw error;
    let allTasks = tasks || [];

    // Hide test data for non-Admin
    if (ctx.role !== 'Admin') {
      allTasks = allTasks.filter((t: any) => !(t.tags || []).includes('_test_data'));
    }

    // Build per-employee stats
    const empStatsMap = new Map<string, { total: number; overdue: number; inProgress: number; completed: number }>();
    subIds.forEach(id => empStatsMap.set(id, { total: 0, overdue: 0, inProgress: 0, completed: 0 }));

    const totals = { total: allTasks.length, overdue: 0, inProgress: 0, completed: 0 };

    allTasks.forEach(t => {
      const isDone = doneIds.has(t.status_id);
      const isOverdue = !isDone && t.due_date && t.due_date < today;

      if (isDone) totals.completed++;
      else if (isOverdue) totals.overdue++;
      else totals.inProgress++;

      // Attribute to each involved subordinate
      (t.assignees || []).forEach((aId: string) => {
        const stats = empStatsMap.get(aId);
        if (stats) {
          stats.total++;
          if (isDone) stats.completed++;
          else if (isOverdue) stats.overdue++;
          else stats.inProgress++;
        }
      });
    });

    const employees = subordinates.map(e => ({
      ...e,
      ...empStatsMap.get(e.id) || { total: 0, overdue: 0, inProgress: 0, completed: 0 },
    }));

    // Sort: most overdue first, then by total desc
    employees.sort((a, b) => b.overdue - a.overdue || b.total - a.total);

    return { employees, totals };
  },

  // ═══════════════════════════════════════
  // BULK OPERATIONS
  // ═══════════════════════════════════════

  /**
   * Bulk update status for multiple tasks.
   */
  async bulkUpdateStatus(taskIds: string[], statusId: string, userId?: string): Promise<void> {
    const status = (await this.getStatuses()).find(s => s.id === statusId);
    const updates: any = { status_id: statusId };
    if (status?.is_done) {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = userId;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .in('id', taskIds);

    if (error) throw error;
  },

  /**
   * Bulk set deadline for multiple tasks.
   */
  async bulkSetDeadline(taskIds: string[], dueDate: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .update({ due_date: dueDate })
      .in('id', taskIds);

    if (error) throw error;
  },

  /**
   * Get all distinct tags used across all tasks (for autocomplete).
   */
  async getAllTags(): Promise<string[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('tags')
      .not('tags', 'eq', '{}');

    if (error) throw error;
    const tagSet = new Set<string>();
    (data || []).forEach((row: any) => {
      if (Array.isArray(row.tags)) {
        row.tags.forEach((t: string) => {
          if (t && t !== '_test_data') tagSet.add(t);
        });
      }
    });
    return [...tagSet].sort();
  },

  /**
   * Toggle pin state for a task.
   */
  async togglePin(taskId: string): Promise<boolean> {
    const task = await this.getById(taskId);
    if (!task) throw new Error('Task not found');
    
    const newPinned = !task.is_pinned;
    await this.update(taskId, { is_pinned: newPinned } as any);
    return newPinned;
  },

  // ═══════════════════════════════════════
  // APPROVAL WORKFLOW (Multi-level)
  // ═══════════════════════════════════════

  /**
   * Submit a task for approval. Changes status to "Chờ phê duyệt"
   * and creates approval subtasks.
   * 
   * Supports two modes:
   * 1) Simple: uses `approvers[]` array — creates subtasks for all at once
   * 2) Multi-level: uses `custom_fields.approval_steps[]` — creates subtasks level by level
   */
  async submitForApproval(taskId: string, userId: string): Promise<void> {
    const task = await this.getById(taskId);
    if (!task) throw new Error('Task not found');

    const approvalSteps: ApprovalStep[] | undefined = task.custom_fields?.approval_steps;
    const hasSteps = approvalSteps && approvalSteps.length > 0;

    // Validate: must have either approvers[] or approval_steps[]
    if (!hasSteps && (!task.approvers || task.approvers.length === 0)) {
      throw new Error('Task không có người phê duyệt');
    }

    // Find "Chờ phê duyệt" status
    const statuses = await this.getStatuses();
    const pendingApprovalStatus = statuses.find(s => s.name === 'Chờ phê duyệt');
    if (!pendingApprovalStatus) {
      throw new Error('Không tìm thấy trạng thái "Chờ phê duyệt"');
    }

    if (hasSteps) {
      // ─── Multi-level approval ───
      const sortedSteps = [...approvalSteps].sort((a, b) => a.level - b.level);
      const firstLevel = sortedSteps[0].level;

      // Update task status + set current level
      await this.update(taskId, {
        status_id: pendingApprovalStatus.id,
        approval_status: 'pending',
        custom_fields: {
          ...task.custom_fields,
          current_approval_level: firstLevel,
        },
      });

      // Create subtasks for first level only
      await this._createSubtasksForLevel(task, sortedSteps[0], userId);

      // System log
      const totalLevels = sortedSteps.length;
      try {
        await DiscussionService.add({
          entity_type: 'task',
          entity_id: taskId,
          user_id: userId,
          content: `Đã gửi yêu cầu phê duyệt (${totalLevels} cấp). Bắt đầu: ${sortedSteps[0].label || `Cấp ${firstLevel}`}`,
          comment_type: 'system',
        });
      } catch { /* fire-and-forget */ }
    } else {
      // ─── Simple approval (flat approvers[]) ───
      const todoStatus = statuses.find(s => s.is_default) || statuses[0];

      await this.update(taskId, {
        status_id: pendingApprovalStatus.id,
        approval_status: 'pending',
      });

      for (const approverId of task.approvers) {
        await supabase.from('tasks').insert({
          title: `🔍 Phê duyệt: ${task.title}`,
          description: `Yêu cầu phê duyệt cho công việc "${task.title}".\n\nVui lòng xem xét và phê duyệt hoặc yêu cầu chỉnh sửa.`,
          parent_id: taskId,
          approval_parent_id: taskId,
          approval_status: 'pending',
          status_id: todoStatus.id,
          priority: task.priority,
          assignees: [approverId],
          created_by: userId,
          source_module: 'approval',
          source_event: 'submit_for_approval',
          source_entity_id: taskId,
          auto_generated: true,
          action_type: 'approve_task',
          action_label: 'Phê duyệt',
          action_config: { parent_task_id: taskId },
          due_date: task.due_date,
        });
      }

      try {
        await DiscussionService.add({
          entity_type: 'task',
          entity_id: taskId,
          user_id: userId,
          content: `Đã gửi yêu cầu phê duyệt cho ${task.approvers.length} người`,
          comment_type: 'system',
        });
      } catch { /* fire-and-forget */ }
    }

    // Telegram notification
    const notifyIds = hasSteps
      ? approvalSteps[0].approver_ids
      : task.approvers;

    try {
      const { data: submitter } = await supabase.from('employees').select('full_name').eq('id', userId).single();
      for (const approverId of notifyIds) {
        TelegramNotificationService.notifyTaskChange({
          eventType: 'assigned',
          taskId: taskId,
          taskTitle: `🔍 Phê duyệt: ${task.title}`,
          assigneeId: approverId,
          priority: task.priority,
          dueDate: task.due_date,
          changedBy: submitter?.full_name || 'Hệ thống',
        });
      }
    } catch { /* fire-and-forget */ }
  },

  /**
   * Approve a task (called from an approval subtask).
   * For multi-level: checks if current level is done, then advances to next level.
   */
  async approveTask(approvalSubtaskId: string, userId: string, comment?: string): Promise<void> {
    const subtask = await this.getById(approvalSubtaskId);
    if (!subtask) throw new Error('Approval subtask not found');
    if (!subtask.approval_parent_id) throw new Error('Đây không phải subtask phê duyệt');

    const parentTask = await this.getById(subtask.approval_parent_id);
    if (!parentTask) throw new Error('Task gốc không tồn tại');

    // Mark the approval subtask as approved + completed
    const statuses = await this.getStatuses();
    const doneStatus = statuses.find(s => s.is_done && s.name !== 'Hủy');

    await this.update(approvalSubtaskId, {
      approval_status: 'approved',
      approval_comment: comment || undefined,
      status_id: doneStatus?.id,
      completed_at: new Date().toISOString(),
      completed_by: userId,
    });

    // System log on subtask
    try {
      await DiscussionService.add({
        entity_type: 'task',
        entity_id: approvalSubtaskId,
        user_id: userId,
        content: `✅ Đã phê duyệt${comment ? `: ${comment}` : ''}`,
        comment_type: 'system',
      });
    } catch { /* ignore */ }

    // Determine current approval level from subtask
    const subtaskLevel: number | undefined = subtask.custom_fields?.approval_level;
    const approvalSteps: ApprovalStep[] | undefined = parentTask.custom_fields?.approval_steps;

    if (approvalSteps && approvalSteps.length > 0 && subtaskLevel !== undefined) {
      // ─── Multi-level mode ───
      await this._advanceApprovalLevel(parentTask, subtaskLevel, userId, comment);
    } else {
      // ─── Simple mode ───
      const approvalMode: ApprovalMode = parentTask.approval_mode || 'all';

      if (approvalMode === 'any') {
        await this._completeParentAfterApproval(parentTask, userId, comment);
      } else {
        const { data: siblings } = await supabase
          .from('tasks')
          .select('id, approval_status')
          .eq('approval_parent_id', parentTask.id);

        const allApproved = siblings?.every(s => s.approval_status === 'approved') ?? false;
        if (allApproved) {
          await this._completeParentAfterApproval(parentTask, userId, comment);
        }
      }
    }
  },

  /**
   * Reject an approval (called from an approval subtask).
   * Returns parent task to "Đang tiến hành" and cancels all pending subtasks.
   */
  async rejectApproval(approvalSubtaskId: string, userId: string, reason: string): Promise<void> {
    if (!reason?.trim()) throw new Error('Vui lòng nhập lý do từ chối');

    const subtask = await this.getById(approvalSubtaskId);
    if (!subtask) throw new Error('Approval subtask not found');
    if (!subtask.approval_parent_id) throw new Error('Đây không phải subtask phê duyệt');

    const parentTask = await this.getById(subtask.approval_parent_id);
    if (!parentTask) throw new Error('Task gốc không tồn tại');

    const statuses = await this.getStatuses();
    const doneStatus = statuses.find(s => s.is_done && s.name !== 'Hủy');
    const inProgressStatus = statuses.find(s => s.name === 'Đang tiến hành');

    // Mark this approval subtask as rejected
    await this.update(approvalSubtaskId, {
      approval_status: 'rejected',
      approval_comment: reason,
      status_id: doneStatus?.id,
      completed_at: new Date().toISOString(),
      completed_by: userId,
    });

    // Cancel ALL other pending approval subtasks (all levels)
    const { data: siblings } = await supabase
      .from('tasks')
      .select('id, approval_status')
      .eq('approval_parent_id', parentTask.id)
      .eq('approval_status', 'pending')
      .neq('id', approvalSubtaskId);

    if (siblings && siblings.length > 0) {
      const cancelStatus = statuses.find(s => s.name === 'Hủy');
      for (const sib of siblings) {
        await this.update(sib.id, {
          approval_status: 'rejected',
          approval_comment: 'Bị hủy do phê duyệt bị từ chối',
          status_id: cancelStatus?.id || doneStatus?.id,
          completed_at: new Date().toISOString(),
          completed_by: userId,
        });
      }
    }

    // Return parent task to "Đang tiến hành" + reset approval level
    const resetCustomFields = { ...parentTask.custom_fields };
    delete resetCustomFields.current_approval_level;

    await this.update(parentTask.id, {
      status_id: inProgressStatus?.id,
      approval_status: 'rejected',
      completed_at: undefined,
      completed_by: undefined,
      custom_fields: resetCustomFields,
    });

    // System logs
    try {
      const subtaskLevel = subtask.custom_fields?.approval_level;
      const levelLabel = subtaskLevel
        ? (parentTask.custom_fields?.approval_steps as ApprovalStep[])?.find(s => s.level === subtaskLevel)?.label || `Cấp ${subtaskLevel}`
        : '';
      await DiscussionService.add({
        entity_type: 'task',
        entity_id: approvalSubtaskId,
        user_id: userId,
        content: `❌ Đã từ chối phê duyệt: ${reason}`,
        comment_type: 'system',
      });
      await DiscussionService.add({
        entity_type: 'task',
        entity_id: parentTask.id,
        user_id: userId,
        content: `❌ Phê duyệt bị từ chối${levelLabel ? ` tại ${levelLabel}` : ''}: ${reason}. Task quay lại "Đang tiến hành"`,
        comment_type: 'system',
      });
    } catch { /* ignore */ }

    // Telegram notification to task assignees
    try {
      const { data: rejecter } = await supabase.from('employees').select('full_name').eq('id', userId).single();
      for (const assigneeId of parentTask.assignees) {
        TelegramNotificationService.notifyTaskChange({
          eventType: 'assigned',
          taskId: parentTask.id,
          taskTitle: parentTask.title,
          assigneeId: assigneeId,
          changedBy: rejecter?.full_name || 'Người phê duyệt',
        });
      }
    } catch { /* fire-and-forget */ }
  },

  /**
   * Get approval subtasks for a parent task.
   */
  async getApprovalSubtasks(parentTaskId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('approval_parent_id', parentTaskId)
      .order('created_at');

    if (error) throw error;
    return (data || []).map(mapTask);
  },

  // ─── Internal Approval Helpers ───

  /**
   * Create approval subtasks for a specific level.
   */
  async _createSubtasksForLevel(parentTask: Task, step: ApprovalStep, submitterId: string): Promise<void> {
    const statuses = await this.getStatuses();
    const todoStatus = statuses.find(s => s.is_default) || statuses[0];

    for (const approverId of step.approver_ids) {
      await supabase.from('tasks').insert({
        title: `🔍 [${step.label || `Cấp ${step.level}`}] Phê duyệt: ${parentTask.title}`,
        description: `Yêu cầu phê duyệt cho công việc "${parentTask.title}".\nCấp phê duyệt: ${step.label || `Cấp ${step.level}`}\nChế độ: ${step.mode === 'all' ? 'Tất cả phải duyệt' : 'Chỉ cần 1 duyệt'}\n\nVui lòng xem xét và phê duyệt hoặc yêu cầu chỉnh sửa.`,
        parent_id: parentTask.id,
        approval_parent_id: parentTask.id,
        approval_status: 'pending',
        status_id: todoStatus.id,
        priority: parentTask.priority,
        assignees: [approverId],
        created_by: submitterId,
        source_module: 'approval',
        source_event: 'submit_for_approval',
        source_entity_id: parentTask.id,
        auto_generated: true,
        action_type: 'approve_task',
        action_label: 'Phê duyệt',
        action_config: { parent_task_id: parentTask.id },
        due_date: parentTask.due_date,
        custom_fields: { approval_level: step.level },
      });
    }
  },

  /**
   * Check if the current approval level is complete, then advance to the next level
   * or complete the parent task if this was the final level.
   */
  async _advanceApprovalLevel(parentTask: Task, completedLevel: number, userId: string, comment?: string): Promise<void> {
    const approvalSteps: ApprovalStep[] = parentTask.custom_fields?.approval_steps || [];
    const currentStep = approvalSteps.find(s => s.level === completedLevel);
    if (!currentStep) return;

    // Check if this level is done (based on its mode)
    const { data: levelSubtasks } = await supabase
      .from('tasks')
      .select('id, approval_status, custom_fields')
      .eq('approval_parent_id', parentTask.id)
      .not('approval_status', 'is', null);

    const thisLevelSubtasks = (levelSubtasks || []).filter(
      (t: any) => t.custom_fields?.approval_level === completedLevel
    );

    const levelMode = currentStep.mode || 'all';
    let levelDone = false;

    if (levelMode === 'any') {
      // ANY: at least one approved
      levelDone = thisLevelSubtasks.some((t: any) => t.approval_status === 'approved');
    } else {
      // ALL: all must be approved
      levelDone = thisLevelSubtasks.length > 0 &&
        thisLevelSubtasks.every((t: any) => t.approval_status === 'approved');
    }

    if (!levelDone) return; // Still waiting for other approvers in this level

    // If ANY mode and level is done, cancel remaining pending subtasks in this level
    if (levelMode === 'any') {
      const statuses = await this.getStatuses();
      const cancelStatus = statuses.find(s => s.name === 'Hủy');
      const doneStatus = statuses.find(s => s.is_done && s.name !== 'Hủy');
      const pendingInLevel = thisLevelSubtasks.filter((t: any) => t.approval_status === 'pending');
      for (const p of pendingInLevel) {
        await this.update(p.id, {
          approval_status: 'approved',
          approval_comment: 'Tự động duyệt — chế độ "Chỉ cần 1 duyệt"',
          status_id: cancelStatus?.id || doneStatus?.id,
          completed_at: new Date().toISOString(),
          completed_by: userId,
        });
      }
    }

    // Find next level
    const sortedSteps = [...approvalSteps].sort((a, b) => a.level - b.level);
    const currentIdx = sortedSteps.findIndex(s => s.level === completedLevel);
    const nextStep = sortedSteps[currentIdx + 1];

    if (nextStep) {
      // Advance to next level
      await this.update(parentTask.id, {
        custom_fields: {
          ...parentTask.custom_fields,
          current_approval_level: nextStep.level,
        },
      });

      // Create subtasks for next level
      await this._createSubtasksForLevel(parentTask, nextStep, parentTask.created_by || userId);

      // System log
      try {
        await DiscussionService.add({
          entity_type: 'task',
          entity_id: parentTask.id,
          user_id: userId,
          content: `✅ ${currentStep.label || `Cấp ${completedLevel}`} đã duyệt. Chuyển sang → ${nextStep.label || `Cấp ${nextStep.level}`}`,
          comment_type: 'system',
        });
      } catch { /* ignore */ }

      // Telegram notification to next level approvers
      try {
        const { data: approver } = await supabase.from('employees').select('full_name').eq('id', userId).single();
        for (const nId of nextStep.approver_ids) {
          TelegramNotificationService.notifyTaskChange({
            eventType: 'assigned',
            taskId: parentTask.id,
            taskTitle: `🔍 [${nextStep.label || `Cấp ${nextStep.level}`}] Phê duyệt: ${parentTask.title}`,
            assigneeId: nId,
            priority: parentTask.priority,
            dueDate: parentTask.due_date,
            changedBy: approver?.full_name || 'Hệ thống',
          });
        }
      } catch { /* fire-and-forget */ }
    } else {
      // This was the final level → complete parent task
      await this._completeParentAfterApproval(parentTask, userId, comment);
    }
  },

  /**
   * Internal: Complete parent task after all approvals are done.
   */
  async _completeParentAfterApproval(parentTask: Task, approverId: string, comment?: string): Promise<void> {
    const statuses = await this.getStatuses();
    const doneStatus = statuses.find(s => s.is_done && s.name !== 'Hủy');

    await this.update(parentTask.id, {
      status_id: doneStatus?.id,
      approval_status: 'approved',
      completed_at: new Date().toISOString(),
      completed_by: approverId,
    });

    // System log on parent
    try {
      await DiscussionService.add({
        entity_type: 'task',
        entity_id: parentTask.id,
        user_id: approverId,
        content: `✅ Đã được phê duyệt và hoàn thành${comment ? `: ${comment}` : ''}`,
        comment_type: 'system',
      });
    } catch { /* ignore */ }

    // Notify task creator & assignees
    try {
      const { data: approver } = await supabase.from('employees').select('full_name').eq('id', approverId).single();
      const notifyIds = new Set([...parentTask.assignees, parentTask.created_by].filter(Boolean) as string[]);
      notifyIds.delete(approverId);
      for (const nId of notifyIds) {
        TelegramNotificationService.notifyTaskChange({
          eventType: 'completed',
          taskId: parentTask.id,
          taskTitle: parentTask.title,
          assigneeId: nId,
          changedBy: approver?.full_name || 'Người phê duyệt',
        });
      }
    } catch { /* fire-and-forget */ }
  },
};
