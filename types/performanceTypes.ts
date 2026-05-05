// ============================================================
// Performance Management Types
// Quản lý KPI, OKR và Chu kỳ đánh giá hiệu suất
// ============================================================

export type PerformanceCycleType = 'quarterly' | 'semi_annual' | 'annual';
export type PerformanceCycleStatus = 'setup' | 'in_progress' | 'review' | 'completed';
export type KpiStatus = 'on_track' | 'at_risk' | 'behind' | 'achieved';
export type ReviewType = 'self' | 'manager' | 'peer' | '360';
export type ReviewStatus = 'draft' | 'submitted' | 'acknowledged';

// ── 1. Performance Cycles ──
export interface PerformanceCycle {
    id: string;
    name: string;
    year: number;
    type: PerformanceCycleType;
    start_date: string | null;
    end_date: string | null;
    status: PerformanceCycleStatus;
    created_at: string;
    updated_at: string;
}

// ── 2. KPI Goals ──
export interface KpiGoal {
    id: string;
    cycle_id: string;
    employee_id: string;
    title: string;
    description: string | null;
    weight: number;
    target_value: number | null;
    actual_value: number;
    unit: string | null;
    status: KpiStatus;
    self_score: number | null;
    manager_score: number | null;
    final_score: number | null;
    created_at: string;
    updated_at: string;

    // Joined
    employee_name?: string;
    employee_code?: string;
    department_name?: string;
}

// ── 3. Performance Reviews ──
export interface PerformanceReview {
    id: string;
    cycle_id: string;
    employee_id: string;
    reviewer_id: string | null;
    review_type: ReviewType;
    overall_score: number | null;
    strengths: string | null;
    improvements: string | null;
    comments: string | null;
    status: ReviewStatus;
    submitted_at: string | null;
    created_at: string;
    updated_at: string;

    // Joined
    employee_name?: string;
    reviewer_name?: string;
}
