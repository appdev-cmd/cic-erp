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
    time_spent: row.time_spent || 0,
    sort_order: row.sort_order || 0,
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
      return this._queryTasks(filters);
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

    return this._queryTasks(filters, allVisibleIds);
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
  async getByEntityLink(entityType: string, entityId: string): Promise<Task[]> {
    const { data: links, error: linkError } = await supabase
      .from('task_links')
      .select('task_id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (linkError) throw linkError;
    if (!links || links.length === 0) return [];

    const taskIds = links.map(l => l.task_id);
    return this._queryTasks(undefined, taskIds);
  },

  /**
   * Get tasks linked to a specific BIM project (via project_id column).
   */
  async getByProjectId(projectId: string, filters?: TaskFilterOptions): Promise<Task[]> {
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
  async _queryTasks(filters?: TaskFilterOptions, ids?: string[]): Promise<Task[]> {
    let query = supabase
      .from('tasks')
      .select(TASK_SELECT)
      .is('parent_id', null) // Top-level tasks only
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

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapTask);
  },
};
