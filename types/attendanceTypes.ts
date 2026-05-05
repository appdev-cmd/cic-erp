// ============================================================
// Attendance & Overtime Module — TypeScript Types
// ============================================================

// ── Attendance Settings ──

export interface AttendanceSettings {
    id: string;
    standard_start_time: string;
    standard_end_time: string;
    break_minutes: number;
    late_threshold_minutes: number;
    early_leave_threshold_minutes: number;
    ot_rate_saturday: number;
    ot_rate_sunday: number;
    ot_rate_holiday: number;
    work_days_per_week: number;
    created_at: string;
    updated_at: string;
}

export interface UpdateAttendanceSettingsInput {
    standard_start_time?: string;
    standard_end_time?: string;
    break_minutes?: number;
    late_threshold_minutes?: number;
    early_leave_threshold_minutes?: number;
    ot_rate_saturday?: number;
    ot_rate_sunday?: number;
    ot_rate_holiday?: number;
    work_days_per_week?: number;
}

// ── Attendance Records ──

export type AttendanceSource = 'fingerprint' | 'face' | 'gps' | 'wifi' | 'manual';
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'holiday' | 'weekend_ot' | 'leave';

export interface AttendanceRecord {
    id: string;
    employee_id: string;
    date: string;
    check_in: string | null;
    check_out: string | null;
    source: AttendanceSource;
    location_lat: number | null;
    location_lng: number | null;
    is_late: boolean;
    is_early_leave: boolean;
    work_hours: number;
    status: AttendanceStatus;
    notes: string | null;
    created_at: string;
    updated_at: string;

    // Joined
    employee_name?: string;
}

export interface CreateAttendanceRecordInput {
    employee_id: string;
    date: string;
    check_in?: string;
    check_out?: string;
    source?: AttendanceSource;
    location_lat?: number;
    location_lng?: number;
    is_late?: boolean;
    is_early_leave?: boolean;
    work_hours?: number;
    status?: AttendanceStatus;
    notes?: string;
}

// ── Overtime Requests ──

export type OvertimeDayType = 'saturday' | 'sunday' | 'holiday';
export type OvertimeStatus = 'pending' | 'approved' | 'rejected';

export interface OvertimeRequest {
    id: string;
    employee_id: string;
    date: string;
    day_type: OvertimeDayType;
    start_time: string;
    end_time: string;
    hours: number;
    reason: string | null;
    project_id: string | null;
    status: OvertimeStatus;
    approved_by: string | null;
    approved_at: string | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;

    // Joined
    employee_name?: string;
    approver_name?: string;
    project_name?: string;
}

export interface CreateOvertimeRequestInput {
    employee_id: string;
    date: string;
    day_type: OvertimeDayType;
    start_time: string;
    end_time: string;
    hours: number;
    reason?: string;
    project_id?: string;
}

// ── Public Holidays ──

export interface PublicHoliday {
    id: string;
    name: string;
    date: string;
    year: number;
    is_recurring: boolean;
    created_at: string;
}

export interface CreatePublicHolidayInput {
    name: string;
    date: string;
    year: number;
    is_recurring?: boolean;
}
