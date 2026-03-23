// Task Management Types — CIC ERP
// All task-related types for the task management module

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export interface TaskStatus {
  id: string;
  space_id?: string;
  name: string;
  color: string;
  sort_order: number;
  is_done: boolean;
  is_default: boolean;
  created_at?: string;
}

export interface Task {
  id: string;

  // Hierarchy
  space_id?: string;
  folder_id?: string;
  list_id?: string;
  parent_id?: string;

  // Core
  title: string;
  description?: string;
  status_id?: string;
  status?: TaskStatus; // Joined
  priority: TaskPriority;
  sort_order: number;
  tags: string[];

  // Roles
  assignees: string[];
  watchers: string[];
  supporters: string[];
  approvers: string[];

  // Time
  start_date?: string;
  due_date?: string;
  time_estimate?: number; // minutes
  time_spent: number;     // minutes
  completed_at?: string;
  completed_by?: string;

  // Source tracking
  source_module?: string;
  source_event?: string;
  source_entity_id?: string;
  auto_generated: boolean;

  // Task Actions (bidirectional)
  action_type?: string;
  action_config?: Record<string, any>;
  action_label?: string;
  completion_trigger?: string;

  // Metadata
  project_id?: string;
  unit_id?: string;
  custom_fields: Record<string, any>;
  is_private: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;

  // Joined relations (optional)
  subtasks?: Task[];
  links?: TaskLink[];
  comments_count?: number;
}

export interface TaskLink {
  id: string;
  task_id: string;
  entity_type: string;
  entity_id: string;
  entity_label?: string;
  link_type: string; // 'related' | 'caused_by' | 'blocks'
  url?: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  parent_comment_id?: string;
  user_id: string;
  content: string;
  comment_type: 'user' | 'system' | 'mention';
  reactions: Record<string, string[]>; // { "👍": ["userId1", "userId2"] }
  attachments: TaskAttachment[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;

  // Joined
  user_name?: string;
  user_avatar?: string;
  replies?: TaskComment[];
}

export interface TaskAttachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface EntityRegistryItem {
  entity_type: string;
  label: string;
  icon?: string;
  color?: string;
  url_pattern?: string;
  is_active: boolean;
  created_at?: string;
}

// Input types for creating/updating
export interface CreateTaskInput {
  title: string;
  description?: string;
  status_id?: string;
  priority?: TaskPriority;
  space_id?: string;
  folder_id?: string;
  list_id?: string;
  parent_id?: string;
  assignees?: string[];
  watchers?: string[];
  supporters?: string[];
  approvers?: string[];
  start_date?: string;
  due_date?: string;
  time_estimate?: number;
  tags?: string[];
  source_module?: string;
  source_event?: string;
  source_entity_id?: string;
  auto_generated?: boolean;
  action_type?: string;
  action_config?: Record<string, any>;
  action_label?: string;
  completion_trigger?: string;
  created_by?: string;
  project_id?: string;
}

export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at'>>;

export interface CreateTaskLinkInput {
  task_id: string;
  entity_type: string;
  entity_id: string;
  entity_label?: string;
  link_type?: string;
  url?: string;
}

export interface CreateCommentInput {
  task_id: string;
  user_id: string;
  content: string;
  parent_comment_id?: string;
  comment_type?: 'user' | 'system' | 'mention';
  attachments?: TaskAttachment[];
}

// Visibility / filtering
export interface TaskFilterOptions {
  status_ids?: string[];
  priorities?: TaskPriority[];
  assignee_ids?: string[];
  source_modules?: string[];
  tags?: string[];
  due_before?: string;
  due_after?: string;
  is_overdue?: boolean;
  search?: string;
}

export interface TaskVisibilityContext {
  userId: string;
  role: string;
  managementRank: number;
  unitId?: string;
  managedUnitIds: string[];
}
