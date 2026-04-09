// ============================================================
// HRM Module — TypeScript Types
// All type definitions for Leave, Recruitment, Requests
// ============================================================

// ── Leave Management ──

export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'maternity' | 'paternity' | 'wedding' | 'bereavement' | 'other';
export type LeaveRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveHalf = 'morning' | 'afternoon';

export interface LeavePolicy {
  id: string;
  leave_type: LeaveType;
  label: string;
  default_days: number;
  requires_approval: boolean;
  requires_document: boolean;
  paid: boolean;
  max_consecutive_days: number | null;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  year: number;
  leave_type: LeaveType;
  total_days: number;
  used_days: number;
  pending_days: number;
  carry_over: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  start_half: LeaveHalf | null;
  end_half: LeaveHalf | null;
  total_days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  approver_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  attachment_url: string | null;
  unit_id: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields (from queries)
  employee_name?: string;
  employee_avatar?: string;
  employee_position?: string;
  approver_name?: string;
  unit_name?: string;
}

export interface CreateLeaveRequestInput {
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  start_half?: LeaveHalf | null;
  end_half?: LeaveHalf | null;
  total_days: number;
  reason?: string;
  attachment_url?: string;
  unit_id?: string;
}

export interface LeaveBalanceSummary {
  leave_type: LeaveType;
  label: string;
  color: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  remaining: number; // total - used - pending
}

// ══════════════════════════════════════════
// HRM - Đề xuất nội bộ (Internal Requests)
// ══════════════════════════════════════════

export type InternalRequestType = 'meeting_room' | 'vehicle' | 'stationery' | 'other';
export type InternalRequestStatus = 'draft' | 'pending_unit' | 'pending_admin' | 'approved' | 'rejected' | 'cancelled';

export interface InternalRequest {
  id: string;
  employee_id: string;
  unit_id: string;
  type: InternalRequestType;
  title: string;
  description?: string;
  details: Record<string, any>; // JSONB
  status: InternalRequestStatus;
  approver_unit_id?: string;
  approver_admin_id?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;

  // Joined fields
  employee_name?: string;
  employee_avatar?: string;
  unit_name?: string;
}

export interface CreateInternalRequestInput {
  employee_id: string;
  unit_id: string;
  type: InternalRequestType;
  title: string;
  description?: string;
  details?: Record<string, any>;
}

// ── Recruitment (Phase 1) ──

export type JobOpeningStatus = 'draft' | 'open' | 'on_hold' | 'closed' | 'filled';
export type JobOpeningPriority = 'urgent' | 'high' | 'normal' | 'low';
export type JobType = 'fulltime' | 'parttime' | 'intern' | 'contract';
export type ExperienceLevel = 'fresher' | 'junior' | 'mid' | 'senior' | 'lead';
export type ApplicationStage = 'applied' | 'screening' | 'interview_1' | 'interview_2' | 'technical_test' | 'offer' | 'hired' | 'rejected' | 'withdrawn';
export type CandidateSource = 'website' | 'referral' | 'linkedin' | 'headhunt' | 'job_board' | 'other';

export interface JobOpening {
  id: string;
  title: string;
  unit_id: string | null;
  department: string | null;
  quantity: number;
  hired_count: number;
  job_type: JobType;
  experience_level: ExperienceLevel;
  salary_range_min: number | null;
  salary_range_max: number | null;
  description: string | null;
  requirements: string | null;
  benefits: string | null;
  status: JobOpeningStatus;
  priority: JobOpeningPriority;
  deadline: string | null;
  requester_id: string | null;
  recruiter_id: string | null;
  interviewer_ids?: string[] | null;
  created_at: string;
  updated_at: string;

  // Joined
  unit_name?: string;
  requester_name?: string;
  recruiter_name?: string;
  application_count?: number;
}

export interface Candidate {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  education: string | null;
  university: string | null;
  specialization: string | null;
  experience_years: number;
  current_company: string | null;
  current_position: string | null;
  expected_salary: number | null;
  resume_url: string | null;
  portfolio_url: string | null;
  source: CandidateSource | null;
  referral_employee_id: string | null;
  notes: string | null;
  tags: string[] | null;
  is_blacklisted: boolean;
  blacklist_reason: string | null;
  created_at: string;
  updated_at: string;
  applications?: any[];
}

export interface CandidateApplication {
  id: string;
  candidate_id: string;
  job_opening_id: string;
  stage: ApplicationStage;
  stage_updated_at: string;
  rating: number | null;
  interviewer_ids: string[] | null;
  interview_date: string | null;
  interview_notes: string | null;
  interview_score: Record<string, any> | null;
  offer_salary: number | null;
  offer_date: string | null;
  offer_deadline: string | null;
  rejection_reason: string | null;
  onboard_date: string | null;
  hired_employee_id: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  candidate?: Candidate;
  job_opening?: JobOpening;
  evaluations?: ApplicationEvaluation[];
}

export interface ApplicationEvaluation {
  id: string;
  application_id: string;
  evaluator_id: string;
  rating: number | null;
  notes: string | null;
  criteria_scores: Record<string, any> | null;
  created_at: string;
  updated_at: string;

  // Joined
  evaluator?: {
    id: string;
    name: string;
    avatar?: string;
    position?: string;
  };
}

// ── Requests (Phase 3 — placeholder types) ──

export type RequestStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'processing' | 'completed';
export type RequestPriority = 'low' | 'normal' | 'high' | 'urgent';
