import { dataClient as supabase } from '../lib/dataClient';
import { TaskService } from './taskService';
import type { TaskPriority, CreateTaskInput } from '../types/taskTypes';

export interface TemplateTaskItem {
  id: string; // temp id for UI
  title: string;
  description: string;
  duration_days: number;
  priority: TaskPriority;
  status_type: 'todo' | 'in_progress' | 'done';
  depends_on?: string; // id of the precursor task
}

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  tasks_json: TemplateTaskItem[];
  created_at: string;
  created_by?: string;
}

export const TaskTemplateService = {
  async getAll(): Promise<TaskTemplate[]> {
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    // ensure tasks_json is typed correctly
    return (data || []).map(t => ({
      ...t,
      tasks_json: Array.isArray(t.tasks_json) ? t.tasks_json : []
    })) as TaskTemplate[];
  },

  async create(template: Omit<TaskTemplate, 'id' | 'created_at'>): Promise<TaskTemplate> {
    const { data: userData } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('task_templates')
      .insert({
        ...template,
        created_by: template.created_by || userData.user?.id
      })
      .select()
      .single();

    if (error) throw error;
    return { ...data, tasks_json: Array.isArray(data.tasks_json) ? data.tasks_json : [] };
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async applyTemplate(
    templateId: string,
    sourceModule: string,
    sourceEntityId: string,
    spaceId?: string
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

    // 2. Map status_type to actual status_id
    const statuses = await TaskService.getStatuses(spaceId);
    const todoStatus = statuses.find(s => !s.is_done && s.name !== 'Đang thực hiện') || statuses[0];
    const inProgressStatus = statuses.find(s => s.name === 'Đang thực hiện') || todoStatus;
    const doneStatus = statuses.find(s => s.is_done) || todoStatus;

    // 3. Create tasks
    const today = new Date();
    const newTasks = tasks.map(t => {
      let statusId = todoStatus.id;
      if (t.status_type === 'in_progress') statusId = inProgressStatus.id;
      if (t.status_type === 'done') statusId = doneStatus.id;

      const dueDate = new Date();
      dueDate.setDate(today.getDate() + (t.duration_days || 0));

      return {
        title: t.title,
        description: t.description,
        priority: t.priority || 'medium',
        status_id: statusId,
        source_module: sourceModule,
        source_entity_id: sourceEntityId,
        space_id: spaceId,
        auto_generated: true,
        due_date: dueDate.toISOString(),
        custom_fields: { template_task_id: t.id }, // temp ID for linking dependencies
      };
    });

    // Supabase JS insert accepts array
    const { data: insertedTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(newTasks)
      .select('id, custom_fields');

    if (insertError) throw insertError;

    // 4. Create dependencies (task_links)
    const linksToCreate: any[] = [];
    tasks.forEach(t => {
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

    return newTasks.length;
  }
};
