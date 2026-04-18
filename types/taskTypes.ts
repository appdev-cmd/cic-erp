// Task Management Types — CIC ERP
// All task-related types for the task management module

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ApprovalMode = 'all' | 'any';

// Multi-level approval step
export interface ApprovalStep {
  level: number;           // 1, 2, 3...
  label: string;           // "Trưởng phòng", "Ban Giám đốc"
  approver_ids: string[];  // employee IDs
  mode: ApprovalMode;      // 'all' = tất cả phải duyệt, 'any' = chỉ cần 1
}

// Bitrix24-style role filter tabs
export type TaskRoleFilter = 'all' | 'ongoing' | 'assisting' | 'set_by_me' | 'following' | 'supervising';

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

// ─── Recurring Tasks (T7.5) ───
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;        // e.g. every 2 weeks
  day_of_week?: number;    // 0=Sun..6=Sat (for weekly)
  day_of_month?: number;   // 1..31 (for monthly)
  end_date?: string;       // stop recurring after this date
  max_occurrences?: number;
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

  // Approval
  approval_status?: ApprovalStatus;
  approval_parent_id?: string;
  approval_mode: ApprovalMode;
  approval_comment?: string;

  // Metadata
  project_id?: string;
  unit_id?: string;
  custom_fields: Record<string, any>;
  is_private: boolean;
  is_pinned: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;

  // Joined relations (optional)
  subtasks?: Task[];
  links?: TaskLink[];
  comments_count?: number;

  // Recurring (T7.5)
  recurrence_rule?: RecurrenceRule | null;
  recurrence_parent_id?: string;
}

export type TaskDependencyType = 'blocks' | 'blocked_by' | 'related' | 'duplicates' | 'is_duplicated_by';

export interface TaskLink {
  id: string;
  task_id: string;
  entity_type: string;
  entity_id: string;
  entity_label?: string;
  link_type: string;
  dependency_type?: TaskDependencyType;
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
  approval_status?: ApprovalStatus;
  approval_parent_id?: string;
  approval_mode?: ApprovalMode;
  approval_comment?: string;
  custom_fields?: Record<string, any>;
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
  source_entity_id?: string;
  tags?: string[];
  due_before?: string;
  due_after?: string;
  is_overdue?: boolean;
  search?: string;
  project_id?: string;
}

export interface TaskVisibilityContext {
  userId: string;
  role: string;
  managementRank: number;
  unitId?: string;
  managedUnitIds: string[];
}

// UI Type for Contract Form Step 4
export type RelativeTaskBaseDate = 'signed_date' | 'handover_date' | 'acceptance_date' | 'invoice_date' | 'current_date' | 'advance_completed' | 'completed_date';

export interface ContractFormTaskItem {
  id?: string;
  title: string;
  description?: string;
  assignees: string[]; // profile_ids
  duration_days: number;
  base_date_type: RelativeTaskBaseDate;
}
