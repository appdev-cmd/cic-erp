import { dataClient as supabase } from '../lib/dataClient';
import { TaskService } from './taskService';
import type { TaskPriority, CreateTaskInput } from '../types/taskTypes';

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════
export type AssigneeRole = 'creator' | 'unit_leader' | 'specific';

export interface TemplateTaskItem {
  id: string; // temp id for UI
  title: string;
  description: string;
  duration_days: number;
  priority: TaskPriority;
  status_type: 'todo' | 'in_progress' | 'done';
  sort_order: number;
  assignee_id?: string;      // profile_id khi role = 'specific'
  assignee_role?: AssigneeRole; // creator | unit_leader | specific
  depends_on?: string;       // id of the precursor task
  base_date_type?: 'current_date' | 'payment_term'; // Mốc thời gian hoàn thành
  tags?: string[];
}

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  tasks_json: TemplateTaskItem[];
  applicable_entity_types: string[];
  category: string;
  is_active: boolean;
  created_at: string;
  created_by?: string;
}

// ═══════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════
export const TaskTemplateService = {
  async getAll(): Promise<TaskTemplate[]> {
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(normalizeTemplate);
  },

  /**
   * Lọc templates theo entity type (vd: 'contract', 'project', ...)
   * Trả về templates có chứa entityType hoặc không giới hạn entity (rỗng)
   */
  async getByEntityType(entityType: string): Promise<TaskTemplate[]> {
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || [])
      .map(normalizeTemplate)
      .filter(t => {
        // Template áp dụng cho mọi entity hoặc chứa entityType cụ thể
        return !t.applicable_entity_types.length || t.applicable_entity_types.includes(entityType);
      });
  },

  async create(template: Omit<TaskTemplate, 'id' | 'created_at'>): Promise<TaskTemplate> {
    const { data: userData } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('task_templates')
      .insert({
        name: template.name,
        description: template.description,
        tasks_json: template.tasks_json,
        applicable_entity_types: template.applicable_entity_types || [],
        category: template.category || 'general',
        is_active: template.is_active ?? true,
        created_by: template.created_by || userData.user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    return normalizeTemplate(data);
  },

  async update(id: string, template: Partial<Omit<TaskTemplate, 'id' | 'created_at'>>): Promise<TaskTemplate> {
    const { data, error } = await supabase
      .from('task_templates')
      .update({
        ...(template.name !== undefined && { name: template.name }),
        ...(template.description !== undefined && { description: template.description }),
        ...(template.tasks_json !== undefined && { tasks_json: template.tasks_json }),
        ...(template.applicable_entity_types !== undefined && { applicable_entity_types: template.applicable_entity_types }),
        ...(template.category !== undefined && { category: template.category }),
        ...(template.is_active !== undefined && { is_active: template.is_active }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return normalizeTemplate(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Áp dụng template — tạo tasks với đầy đủ thông tin:
   * - assignee theo role (creator/unit_leader/specific)
   * - deadline cascade: task B bắt đầu khi task A hoàn thành
   * - dependencies (task_links type 'blocks')
   */
  async applyTemplate(
    templateId: string,
    sourceModule: string,
    sourceEntityId: string,
    options?: {
      spaceId?: string;
      creatorUserId?: string;   // user đang thao tác → dùng cho role "creator"
      unitId?: string;          // unit liên quan → dùng cho role "unit_leader"
    }
  ): Promise<number> {
    // 1. Get the template
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !data) throw new Error('Không tìm thấy mẫu công việc');

    const tasks: TemplateTaskItem[] = Array.isArray(data.tasks_json) ? data.tasks_json : [];
    if (tasks.length === 0) return 0;

    // Sort by sort_order
    const sortedTasks = [...tasks].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    // 2. Map status_type to actual status_id
    const statuses = await TaskService.getStatuses(options?.spaceId);
    const todoStatus = statuses.find(s => !s.is_done && s.name !== 'Đang thực hiện') || statuses[0];
    const inProgressStatus = statuses.find(s => s.name === 'Đang thực hiện') || todoStatus;
    const doneStatus = statuses.find(s => s.is_done) || todoStatus;

    // 3. Resolve assignees
    const resolvedAssignees = await resolveAssignees(sortedTasks, options);

    // 3.5. Fetch payment_term_days if source is contract
    let contractPaymentTermDays = 0;
    if (sourceModule === 'contract' && sourceEntityId) {
      try {
        const { data: contractData } = await supabase
          .from('contracts')
          .select('payment_term_days')
          .eq('id', sourceEntityId)
          .single();
        if (contractData?.payment_term_days) {
          contractPaymentTermDays = contractData.payment_term_days;
        }
      } catch { /* ignore */ }
    }

    // 4. Calculate cascading deadlines
    // Build dependency map: taskId → dependsOnTaskId
    const baseDate = new Date();
    const taskStartDates: Record<string, Date> = {};
    const taskEndDates: Record<string, Date> = {};

    for (const t of sortedTasks) {
      let startDate: Date;
      if (t.depends_on && taskEndDates[t.depends_on]) {
        // Task bắt đầu khi task phụ thuộc kết thúc
        startDate = new Date(taskEndDates[t.depends_on]);
      } else {
        startDate = new Date(baseDate);
        if (t.base_date_type === 'payment_term') {
          startDate.setDate(startDate.getDate() + contractPaymentTermDays);
        }
      }
      taskStartDates[t.id] = startDate;

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (t.duration_days || 0));
      taskEndDates[t.id] = endDate;
    }

    // 5. Create tasks
    const newTasks = sortedTasks.map(t => {
      let statusId = todoStatus.id;
      if (t.status_type === 'in_progress') statusId = inProgressStatus.id;
      if (t.status_type === 'done') statusId = doneStatus.id;

      return {
        title: t.title,
        description: t.description || '',
        priority: t.priority || 'medium',
        status_id: statusId,
        project_id: sourceModule === 'project' && sourceEntityId ? sourceEntityId : undefined,
        source_module: sourceModule !== 'project' ? sourceModule : undefined,
        source_entity_id: sourceModule !== 'project' && sourceEntityId ? sourceEntityId : undefined,
        space_id: options?.spaceId || undefined,
        auto_generated: true,
        start_date: taskStartDates[t.id]?.toISOString(),
        due_date: taskEndDates[t.id]?.toISOString(),
        assignees: resolvedAssignees[t.id] ? [resolvedAssignees[t.id]] : [],
        tags: t.tags || [],
        custom_fields: { template_task_id: t.id },
      };
    });

    const { data: insertedTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(newTasks)
      .select('id, custom_fields');

    if (insertError) throw insertError;

    // 6. Create dependencies (task_links)
    const linksToCreate: any[] = [];
    sortedTasks.forEach(t => {
      if (t.depends_on) {
        const thisInserted = insertedTasks?.find(it => it.custom_fields?.template_task_id === t.id);
        const precursorInserted = insertedTasks?.find(it => it.custom_fields?.template_task_id === t.depends_on);
        
        if (thisInserted && precursorInserted) {
          linksToCreate.push({
             task_id: precursorInserted.id,
             entity_type: 'task',
             entity_id: thisInserted.id,
             link_type: 'blocks'
          });
        }
      }
    });

    if (linksToCreate.length > 0) {
      const { error: linksError } = await supabase
        .from('task_links')
        .insert(linksToCreate);
      if (linksError) console.warn('Lỗi tạo liên kết task phụ thuộc:', linksError);
    }

    // 7. Send Telegram notifications cho assignees (fire-and-forget, không block return)
    if (insertedTasks && insertedTasks.length > 0) {
      import('./telegramNotificationService').then(({ TelegramNotificationService }) => {
        const creatorId = options?.creatorUserId;
        newTasks.forEach((t, idx) => {
          const insertedId = insertedTasks[idx]?.id;
          const assigneeId = t.assignees?.[0];
          // Chỉ notify nếu có assignee và khác người tạo
          if (insertedId && assigneeId && assigneeId !== creatorId) {
            TelegramNotificationService.notifyTaskChange({
              eventType: 'assigned',
              taskId: insertedId,
              taskTitle: t.title,
              assigneeId,
              changedBy: creatorId,
              dueDate: t.due_date,
            }).catch(err => console.warn('Template task notify error:', err));
          }
        });
      }).catch(() => { /* notification service không bắt buộc */ });
    }

    return newTasks.length;
  }
};

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function normalizeTemplate(t: any): TaskTemplate {
  return {
    ...t,
    tasks_json: Array.isArray(t.tasks_json) ? t.tasks_json : [],
    applicable_entity_types: Array.isArray(t.applicable_entity_types) ? t.applicable_entity_types : [],
    category: t.category || 'general',
    is_active: t.is_active ?? true,
  };
}

/**
 * Resolve assignee IDs dựa trên role trong template
 */
async function resolveAssignees(
  tasks: TemplateTaskItem[],
  options?: { creatorUserId?: string; unitId?: string }
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (const t of tasks) {
    if (!t.assignee_role) continue;

    if (t.assignee_role === 'creator' && options?.creatorUserId) {
      result[t.id] = options.creatorUserId;
    } else if (t.assignee_role === 'unit_leader' && options?.unitId) {
      try {
        const { data: employees } = await supabase
          .from('employees')
          .select('profile_id')
          .eq('unit_id', options.unitId)
          .eq('is_leader', true)
          .limit(1);
        if (employees?.[0]?.profile_id) {
          result[t.id] = employees[0].profile_id;
        }
      } catch { /* ignore */ }
    } else if (t.assignee_role === 'specific' && t.assignee_id) {
      result[t.id] = t.assignee_id;
    }
  }

  return result;
}
