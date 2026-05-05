// ============================================================
// Attendance & Overtime Service — CIC ERP
// CRUD for Settings, Records, Overtime Requests, Holidays
// ============================================================

import { dataClient as supabase } from '../lib/dataClient';
import type {
    AttendanceSettings,
    UpdateAttendanceSettingsInput,
    AttendanceRecord,
    CreateAttendanceRecordInput,
    OvertimeRequest,
    CreateOvertimeRequestInput,
    PublicHoliday,
    CreatePublicHolidayInput,
} from '../types/attendanceTypes';

export const AttendanceService = {

    // ══════════════════════════════════════════
    // Settings (Cấu hình)
    // ══════════════════════════════════════════

    async getSettings(): Promise<AttendanceSettings> {
        const { data, error } = await supabase
            .from('attendance_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data as AttendanceSettings;
    },

    async updateSettings(updates: UpdateAttendanceSettingsInput): Promise<AttendanceSettings> {
        // There should only be one row. We'll update the first one we find.
        const current = await this.getSettings();
        if (!current) throw new Error('Settings not found');

        const { data, error } = await supabase
            .from('attendance_settings')
            .update(updates)
            .eq('id', current.id)
            .select()
            .single();
        if (error) throw error;
        return data as AttendanceSettings;
    },

    // ══════════════════════════════════════════
    // Attendance Records (Bảng chấm công)
    // ══════════════════════════════════════════

    async getRecordsByEmployeeAndMonth(employeeId: string, year: number, month: number): Promise<AttendanceRecord[]> {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('employee_id', employeeId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error) throw error;
        return (data || []) as AttendanceRecord[];
    },

    async getRecordsByDate(date: string): Promise<AttendanceRecord[]> {
        const { data, error } = await supabase
            .from('attendance_records')
            .select(`
        *,
        employee:employees!employee_id(name)
      `)
            .eq('date', date)
            .order('employee_id', { ascending: true });

        if (error) throw error;
        return (data || []).map((row: any) => ({
            ...row,
            employee_name: row.employee?.name,
        })) as AttendanceRecord[];
    },

    async upsertRecord(input: CreateAttendanceRecordInput): Promise<AttendanceRecord> {
        // Check if record exists for this employee and date
        const { data: existing } = await supabase
            .from('attendance_records')
            .select('id')
            .eq('employee_id', input.employee_id)
            .eq('date', input.date)
            .maybeSingle();

        if (existing) {
            const { data, error } = await supabase
                .from('attendance_records')
                .update(input)
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            return data as AttendanceRecord;
        } else {
            const { data, error } = await supabase
                .from('attendance_records')
                .insert(input)
                .select()
                .single();
            if (error) throw error;
            return data as AttendanceRecord;
        }
    },

    // ══════════════════════════════════════════
    // Overtime Requests (Đăng ký tăng ca)
    // ══════════════════════════════════════════

    async getOvertimeByEmployee(employeeId: string, status?: string): Promise<OvertimeRequest[]> {
        let query = supabase
            .from('overtime_requests')
            .select(`
        *,
        approver:employees!approved_by(name)
        /* TODO: join projects when project structure is clear
           project:projects!project_id(name) */
      `)
            .eq('employee_id', employeeId)
            .order('date', { ascending: false });

        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((row: any) => ({
            ...row,
            approver_name: row.approver?.name,
            // project_name: row.project?.name,
        })) as OvertimeRequest[];
    },

    async getAllOvertimeRequests(filters?: {
        status?: string;
        month?: string; // YYYY-MM
    }): Promise<OvertimeRequest[]> {
        let query = supabase
            .from('overtime_requests')
            .select(`
        *,
        employee:employees!employee_id(name),
        approver:employees!approved_by(name)
      `)
            .order('date', { ascending: false });

        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.month) {
            const gte = `${filters.month}-01`;
            const year = parseInt(filters.month.split('-')[0]);
            const month = parseInt(filters.month.split('-')[1]);
            const lte = new Date(year, month, 0).toISOString().split('T')[0];
            query = query.gte('date', gte).lte('date', lte);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((row: any) => ({
            ...row,
            employee_name: row.employee?.name,
            approver_name: row.approver?.name,
        })) as OvertimeRequest[];
    },

    async createOvertimeRequest(input: CreateOvertimeRequestInput): Promise<OvertimeRequest> {
        const { data, error } = await supabase
            .from('overtime_requests')
            .insert({
                ...input,
                status: 'pending',
            })
            .select()
            .single();
        if (error) throw error;
        return data as OvertimeRequest;
    },

    async reviewOvertimeRequest(id: string, isApproved: boolean, reviewerId: string, rejectionReason?: string): Promise<OvertimeRequest> {
        const { data, error } = await supabase
            .from('overtime_requests')
            .update({
                status: isApproved ? 'approved' : 'rejected',
                approved_by: reviewerId,
                approved_at: new Date().toISOString(),
                rejection_reason: rejectionReason || null,
            })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as OvertimeRequest;
    },

    async deleteOvertimeRequest(id: string): Promise<void> {
        const { error } = await supabase
            .from('overtime_requests')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // ══════════════════════════════════════════
    // Public Holidays (Ngày lễ)
    // ══════════════════════════════════════════

    async getHolidays(year: number): Promise<PublicHoliday[]> {
        const { data, error } = await supabase
            .from('public_holidays')
            .select('*')
            .or(`year.eq.${year},is_recurring.eq.true`)
            .order('date', { ascending: true });
        if (error) throw error;
        return (data || []) as PublicHoliday[];
    },

    async createHoliday(input: CreatePublicHolidayInput): Promise<PublicHoliday> {
        const { data, error } = await supabase
            .from('public_holidays')
            .insert(input)
            .select()
            .single();
        if (error) throw error;
        return data as PublicHoliday;
    },

    async deleteHoliday(id: string): Promise<void> {
        const { error } = await supabase
            .from('public_holidays')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
