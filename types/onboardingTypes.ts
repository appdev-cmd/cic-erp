// ============================================================
// Onboarding Types
// Quản lý quy trình hội nhập, check-list công việc cho NV mới
// ============================================================

export type OnboardingAssigneeRole = 'hr' | 'manager' | 'it' | 'buddy' | 'new_hire';
export type OnboardingStatus = 'in_progress' | 'completed' | 'cancelled';
export type OnboardingItemStatus = 'pending' | 'in_progress' | 'completed';

export interface QuizQuestion {
    question: string;
    options: string[];
    answerIndex: number;
}

// ── 1. Templates ──
export interface OnboardingTemplate {
    id: string;
    name: string;
    position: string | null;
    unit_id: string | null;
    description: string | null;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

// ── 2. Tasks ──
export interface OnboardingTask {
    id: string;
    template_id: string;
    title: string;
    description: string | null;
    assignee_role: OnboardingAssigneeRole;
    due_days: number;
    sort_order: number;
    category: string | null;
    created_at: string;
    updated_at: string;
    
    // Document & Quiz Configuration
    document_url?: string | null;
    document_name?: string | null;
    converted_html?: string | null;
    quiz_questions?: QuizQuestion[] | null;
}

// ── 3. Checklists (The active roadmap for User) ──
export interface OnboardingChecklist {
    id: string;
    employee_id: string;
    template_id: string | null;
    application_id: string | null;
    start_date: string;
    status: OnboardingStatus;
    completed_at: string | null;
    created_at: string;
    updated_at: string;

    // Joined
    employee_name?: string;
    employee_code?: string;
    template_name?: string;
    items?: OnboardingChecklistItem[];
    progress?: number; // 0-100 percentage
}

// ── 4. Checklist Items (Individual Tasks in Checklist) ──
export interface OnboardingChecklistItem {
    id: string;
    checklist_id: string;
    task_id: string | null;
    title: string;
    assignee_id: string | null;
    status: OnboardingItemStatus;
    completed_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;

    // Document & Quiz Tracking
    document_url?: string | null;
    document_name?: string | null;
    converted_html?: string | null;
    quiz_questions?: QuizQuestion[] | null;
    quiz_score?: number | null;
    quiz_passed?: boolean | null;

    // Joined
    assignee_name?: string;
    category?: string; // Pulled from Task
    due_days?: number; // Pulled from Task to calculate absolute Due Date based on checklist start_date
}

