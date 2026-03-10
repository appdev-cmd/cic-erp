import { dataClient as supabase } from '../lib/dataClient';
import { Task, TaskComment, TaskAttachment, Checklist, TaskActivity, TaskStatus } from '../types';

// ============================================================================
// TASK SERVICE — CRUD + Queries + Subtask support (multi-level)
// ============================================================================

// Default statuses when no list-level override
const DEFAULT_STATUSES: TaskStatus[] = [
    { id: 'status_pending', name: 'Chờ xử lý', group: 'not_started', color: '#808080', order: 1 },
    { id: 'status_in_progress', name: 'Đang làm', group: 'in_progress', color: '#2196F3', order: 2 },
    { id: 'status_review', name: 'Đang xem xét', group: 'in_progress', color: '#9C27B0', order: 3 },
    { id: 'status_done', name: 'Hoàn thành', group: 'completed', color: '#4CAF50', order: 4 },
    { id: 'status_cancelled', name: 'Hủy bỏ', group: 'completed', color: '#F44336', order: 5 },
];

export { DEFAULT_STATUSES };

export const TaskService = {
    // ===================== CRUD =====================

    async create(task: Partial<Task>): Promise<Task> {
        const { data, error } = await supabase
            .from('tasks')
            .insert({
                list_id: task.list_id,
                parent_id: task.parent_id || null,
                title: task.title,
                description: task.description,
                status_id: task.status_id || 'status_pending',
                priority: task.priority || 'none',
                assignees: task.assignees || [],
                start_date: task.start_date,
                due_date: task.due_date,
                time_estimate: task.time_estimate,
                tags: task.tags || [],
                custom_fields: task.custom_fields || {},
                source_type: task.source_type || 'manual',
                source_id: task.source_id,
                is_private: task.is_private || false,
                sort_order: task.sort_order || 0,
                created_by: task.created_by,
            })
            .select()
            .single();

        if (error) throw error;

        // Log activity
        await this.logActivity(data.id, task.created_by || null, 'created');

        return data;
    },

    async update(id: string, updates: Partial<Task>, userId?: string): Promise<Task> {
        const payload: Record<string, any> = {};
        const fields = [
            'title', 'description', 'status_id', 'priority', 'assignees',
            'start_date', 'due_date', 'time_estimate', 'time_spent',
            'tags', 'custom_fields', 'sort_order', 'is_private',
            'parent_id', 'list_id',
        ];

        for (const f of fields) {
            if ((updates as any)[f] !== undefined) {
                payload[f] = (updates as any)[f];
            }
        }

        // Track completion
        if (updates.status_id) {
            const isCompleted = updates.status_id === 'status_done';
            payload.completed_at = isCompleted ? new Date().toISOString() : null;
            payload.completed_by = isCompleted ? userId || null : null;
        }

        const { data, error } = await supabase
            .from('tasks')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Log relevant activity
        if (updates.status_id) {
            await this.logActivity(id, userId || null, 'status_changed', 'status_id', null, { status_id: updates.status_id });
        } else if (updates.assignees) {
            await this.logActivity(id, userId || null, 'assigned', 'assignees', null, { assignees: updates.assignees });
        } else {
            await this.logActivity(id, userId || null, 'updated');
        }

        return data;
    },

    async delete(id: string, userId?: string): Promise<void> {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) throw error;
        // Log activity after delete (best-effort, don't block on failure)
        try { await this.logActivity(id, userId || null, 'deleted'); } catch { }
    },

    // ===================== QUERIES =====================

    async getById(id: string): Promise<Task | null> {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    },

    async getDetailById(id: string): Promise<Task & {
        subtasks: Task[];
        checklists: Checklist[];
        comments: TaskComment[];
        attachments: TaskAttachment[];
        activities: TaskActivity[];
    } | null> {
        const { data: task, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !task) return null;

        // Parallel fetch related data
        const [subtasksRes, checklistsRes, commentsRes, attachmentsRes, activitiesRes] = await Promise.all([
            supabase.from('tasks').select('*').eq('parent_id', id).order('sort_order'),
            supabase.from('checklists').select('*').eq('task_id', id).order('sort_order'),
            supabase.from('task_comments').select('*').eq('task_id', id).order('created_at', { ascending: true }),
            supabase.from('task_attachments').select('*').eq('task_id', id).order('uploaded_at', { ascending: false }),
            supabase.from('task_activities').select('*').eq('task_id', id).order('created_at', { ascending: false }).limit(50),
        ]);

        return {
            ...task,
            subtasks: subtasksRes.data || [],
            checklists: checklistsRes.data || [],
            comments: commentsRes.data || [],
            attachments: attachmentsRes.data || [],
            activities: activitiesRes.data || [],
        };
    },

    /** List tasks with filters, sort, pagination */
    async list(params: {
        listId?: string;
        spaceId?: string;
        parentId?: string | null; // null = top-level only, undefined = all
        assigneeId?: string;
        status?: string;
        priority?: string;
        search?: string;
        page?: number;
        limit?: number;
        sortBy?: string;
        sortDir?: 'asc' | 'desc';
    }): Promise<{ data: Task[]; count: number }> {
        const { listId, spaceId, parentId, assigneeId, status, priority, search, sortBy = 'created_at', sortDir = 'desc' } = params;
        const page = params.page || 1;
        const limit = params.limit || 50;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('tasks')
            .select('*', { count: 'exact' });

        if (listId) query = query.eq('list_id', listId);
        if (parentId === null) query = query.is('parent_id', null);
        else if (parentId) query = query.eq('parent_id', parentId);
        if (assigneeId) query = query.contains('assignees', [assigneeId]);
        if (status) query = query.eq('status_id', status);
        if (priority) query = query.eq('priority', priority);
        if (search) query = query.ilike('title', `%${search}%`);

        // If filtering by space, need to join via lists
        if (spaceId && !listId) {
            const { data: spaceLists } = await supabase
                .from('lists')
                .select('id')
                .eq('space_id', spaceId);
            const listIds = (spaceLists || []).map((l: any) => l.id);
            if (listIds.length > 0) {
                query = query.in('list_id', listIds);
            } else {
                return { data: [], count: 0 };
            }
        }

        query = query.order(sortBy, { ascending: sortDir === 'asc' }).range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;

        return { data: data || [], count: count || 0 };
    },

    /** Get tasks assigned to a user — "My Tasks" page */
    async getMyTasks(userId: string): Promise<{
        overdue: Task[];
        today: Task[];
        upcoming: Task[];
        noDate: Task[];
    }> {
        const todayStr = new Date().toISOString().slice(0, 10);

        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .contains('assignees', [userId])
            .not('status_id', 'in', '("status_done","status_cancelled")')
            .order('due_date', { ascending: true, nullsFirst: false });

        if (error) throw error;

        const tasks = data || [];
        const overdue: Task[] = [];
        const today: Task[] = [];
        const upcoming: Task[] = [];
        const noDate: Task[] = [];

        for (const t of tasks) {
            if (!t.due_date) { noDate.push(t); continue; }
            if (t.due_date < todayStr) overdue.push(t);
            else if (t.due_date === todayStr) today.push(t);
            else upcoming.push(t);
        }

        return { overdue, today, upcoming, noDate };
    },

    /** Get subtasks of a parent (1 level) */
    async getSubtasks(parentId: string): Promise<Task[]> {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('parent_id', parentId)
            .order('sort_order');

        if (error) throw error;
        return data || [];
    },

    /** Get all descendants recursively (for multi-level subtask tree) */
    async getSubtaskTree(parentId: string): Promise<Task[]> {
        const children = await this.getSubtasks(parentId);
        for (const child of children) {
            child.subtasks = await this.getSubtaskTree(child.id);
        }
        return children;
    },

    /** Stats for a scope (list, space, or global) */
    async getStats(params: { listId?: string; spaceId?: string; assigneeId?: string }): Promise<{
        total: number;
        not_started: number;
        in_progress: number;
        completed: number;
        overdue: number;
    }> {
        let query = supabase.from('tasks').select('status_id, due_date', { count: 'exact' });

        if (params.listId) query = query.eq('list_id', params.listId);
        if (params.assigneeId) query = query.contains('assignees', [params.assigneeId]);

        if (params.spaceId && !params.listId) {
            const { data: spaceLists } = await supabase.from('lists').select('id').eq('space_id', params.spaceId);
            const listIds = (spaceLists || []).map((l: any) => l.id);
            if (listIds.length > 0) query = query.in('list_id', listIds);
            else return { total: 0, not_started: 0, in_progress: 0, completed: 0, overdue: 0 };
        }

        const { data, error } = await query;
        if (error) throw error;

        const todayStr = new Date().toISOString().slice(0, 10);
        const tasks = data || [];
        let not_started = 0, in_progress = 0, completed = 0, overdue = 0;

        for (const t of tasks) {
            const sid = t.status_id || '';
            if (sid === 'status_done' || sid === 'status_cancelled') completed++;
            else if (sid === 'status_pending') not_started++;
            else in_progress++;

            if (t.due_date && t.due_date < todayStr && sid !== 'status_done' && sid !== 'status_cancelled') {
                overdue++;
            }
        }

        return { total: tasks.length, not_started, in_progress, completed, overdue };
    },

    // ===================== COMMENTS =====================

    async addComment(taskId: string, authorId: string, content: string, mentions?: string[]): Promise<TaskComment> {
        const { data, error } = await supabase
            .from('task_comments')
            .insert({
                task_id: taskId,
                author_id: authorId,
                content,
                mentions: mentions || [],
                comment_type: 'comment',
            })
            .select()
            .single();

        if (error) throw error;
        await this.logActivity(taskId, authorId, 'commented');
        return data;
    },

    async getComments(taskId: string): Promise<TaskComment[]> {
        const { data, error } = await supabase
            .from('task_comments')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    // ===================== CHECKLISTS =====================

    async getChecklists(taskId: string): Promise<Checklist[]> {
        const { data, error } = await supabase
            .from('checklists')
            .select('*')
            .eq('task_id', taskId)
            .order('sort_order');

        if (error) throw error;
        return data || [];
    },

    async createChecklist(taskId: string, title: string): Promise<Checklist> {
        const { data, error } = await supabase
            .from('checklists')
            .insert({ task_id: taskId, title, items: [] })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateChecklistItems(checklistId: string, items: any[]): Promise<Checklist> {
        const { data, error } = await supabase
            .from('checklists')
            .update({ items })
            .eq('id', checklistId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteChecklist(id: string): Promise<void> {
        const { error } = await supabase.from('checklists').delete().eq('id', id);
        if (error) throw error;
    },

    // ===================== ATTACHMENTS =====================

    async getAttachments(taskId: string): Promise<TaskAttachment[]> {
        const { data, error } = await supabase
            .from('task_attachments')
            .select('*')
            .eq('task_id', taskId)
            .order('uploaded_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    // ===================== ACTIVITY LOG =====================

    async logActivity(taskId: string, userId: string | null, action: string, field?: string, oldValue?: any, newValue?: any): Promise<void> {
        try {
            await supabase.from('task_activities').insert({
                task_id: taskId,
                user_id: userId,
                action,
                field,
                old_value: oldValue ? JSON.stringify(oldValue) : null,
                new_value: newValue ? JSON.stringify(newValue) : null,
            });
        } catch (e) {
            console.error('Failed to log task activity:', e);
        }
    },

    async getActivities(taskId: string, limit = 50): Promise<TaskActivity[]> {
        const { data, error } = await supabase
            .from('task_activities')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    // ===================== BATCH OPERATIONS =====================

    async batchUpdateStatus(ids: string[], statusId: string, userId?: string): Promise<void> {
        const payload: Record<string, any> = { status_id: statusId };
        if (statusId === 'status_done') {
            payload.completed_at = new Date().toISOString();
            payload.completed_by = userId || null;
        }

        const { error } = await supabase.from('tasks').update(payload).in('id', ids);
        if (error) throw error;

        // Log activities
        for (const id of ids) {
            await this.logActivity(id, userId || null, 'status_changed', 'status_id', null, { status_id: statusId });
        }
    },

    async batchDelete(ids: string[], userId?: string): Promise<void> {
        for (const id of ids) {
            await this.logActivity(id, userId || null, 'deleted');
        }
        const { error } = await supabase.from('tasks').delete().in('id', ids);
        if (error) throw error;
    },

    /** Get tasks by source (e.g., from a contract or CRM deal) */
    async getBySource(sourceType: string, sourceId: string): Promise<Task[]> {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('source_type', sourceType)
            .eq('source_id', sourceId)
            .order('sort_order');

        if (error) throw error;
        return data || [];
    },

    // ===================== DEPENDENCIES =====================

    async getDependencies(taskId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('task_dependencies')
            .select('*')
            .or(`task_id.eq.${taskId},depends_on_id.eq.${taskId}`)
            .order('created_at', { ascending: false });

        if (error) {
            // Table might not exist yet — return empty
            console.warn('task_dependencies table might not exist:', error.message);
            return [];
        }
        return data || [];
    },

    async addDependency(taskId: string, dependsOnTaskId: string, depType: string, userId?: string): Promise<any> {
        const { data, error } = await supabase
            .from('task_dependencies')
            .insert({
                task_id: taskId,
                depends_on_id: dependsOnTaskId,
                type: depType,
                created_by: userId,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async removeDependency(id: string): Promise<void> {
        const { error } = await supabase
            .from('task_dependencies')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // ===================== TIME TRACKING =====================

    async getTimeEntries(taskId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('time_entries')
            .select('*')
            .eq('task_id', taskId)
            .order('created_at', { ascending: false });

        if (error) {
            // Table might not exist yet — return empty
            console.warn('time_entries table might not exist:', error.message);
            return [];
        }
        return data || [];
    },

    async addTimeEntry(taskId: string, userId: string, durationMinutes: number, description?: string): Promise<any> {
        const { data, error } = await supabase
            .from('time_entries')
            .insert({
                task_id: taskId,
                user_id: userId,
                duration_minutes: durationMinutes,
                description: description || null,
                start_time: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ===================== WATCHERS =====================

    async getWatchers(taskId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('task_watchers')
            .select('*')
            .eq('task_id', taskId);

        if (error) {
            console.warn('task_watchers table might not exist:', error.message);
            return [];
        }
        return data || [];
    },

    async addWatcher(taskId: string, userId: string): Promise<any> {
        const { data, error } = await supabase
            .from('task_watchers')
            .insert({ task_id: taskId, user_id: userId })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async removeWatcher(id: string): Promise<void> {
        const { error } = await supabase
            .from('task_watchers')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },
};
