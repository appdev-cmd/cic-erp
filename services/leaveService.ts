// ============================================================
// Leave Service — CIC ERP HRM Module
// CRUD + approval workflow for leave requests
// ============================================================

import { dataClient as supabase } from '../lib/dataClient';
import type {
  LeavePolicy,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveType,
  CreateLeaveRequestInput,
  LeaveBalanceSummary,
} from '../types/hrmTypes';

// ── Helpers ──

function mapLeaveRequest(row: any): LeaveRequest {
  return {
    ...row,
    employee_name: row.employees?.name || row.employee_name,
    employee_avatar: row.employees?.avatar || row.employee_avatar,
    employee_position: row.employees?.position || row.employee_position,
    approver_name: row.approver?.name || row.approver_name,
    unit_name: row.units?.name || row.unit_name,
  };
}

/**
 * Calculate work days between two dates (excluding Saturday & Sunday).
 * Supports half-day adjustments.
 */
export function calculateWorkDays(
  startDate: string,
  endDate: string,
  startHalf?: string | null,
  endHalf?: string | null
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  // Half-day adjustments
  if (startHalf && count > 0) count -= 0.5; // start afternoon = -0.5
  if (endHalf && count > 0) count -= 0.5;   // end morning = -0.5

  return Math.max(0, count);
}

// ══════════════════════════════════════════
// Leave Service
// ══════════════════════════════════════════

export const LeaveService = {

  // ── Leave Policies ──

  async getPolicies(): Promise<LeavePolicy[]> {
    const { data, error } = await supabase
      .from('leave_policies')
      .select('*')
      .eq('is_active', true)
      .order('label');
    if (error) throw error;
    return (data || []) as LeavePolicy[];
  },

  // ── Leave Balances ──

  async getBalances(employeeId: string, year: number): Promise<LeaveBalance[]> {
    const { data, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('year', year);
    if (error) throw error;
    return (data || []) as LeaveBalance[];
  },

  async getBalanceSummary(employeeId: string, year: number): Promise<LeaveBalanceSummary[]> {
    const [balances, policies] = await Promise.all([
      this.getBalances(employeeId, year),
      this.getPolicies(),
    ]);

    return policies.map(policy => {
      const balance = balances.find(b => b.leave_type === policy.leave_type);
      const total = balance ? balance.total_days + balance.carry_over : policy.default_days;
      const used = balance?.used_days || 0;
      const pending = balance?.pending_days || 0;

      return {
        leave_type: policy.leave_type,
        label: policy.label,
        color: policy.color,
        total_days: total,
        used_days: used,
        pending_days: pending,
        remaining: total - used - pending,
      };
    });
  },

  /**
   * Initialize leave balances for all employees for a given year.
   * Typically called at start of year.
   */
  async initBalancesForYear(year: number): Promise<{ created: number }> {
    const policies = await this.getPolicies();
    const { data: employees } = await supabase
      .from('employees')
      .select('id')
      .eq('status', 'active');

    if (!employees || employees.length === 0) return { created: 0 };

    const records: any[] = [];
    for (const emp of employees) {
      for (const policy of policies) {
        if (policy.default_days > 0) {
          records.push({
            employee_id: emp.id,
            year,
            leave_type: policy.leave_type,
            total_days: policy.default_days,
            used_days: 0,
            pending_days: 0,
            carry_over: 0,
          });
        }
      }
    }

    const { error } = await supabase
      .from('leave_balances')
      .upsert(records, { onConflict: 'employee_id,year,leave_type', ignoreDuplicates: true });

    if (error) throw error;
    return { created: records.length };
  },

  // ── Leave Requests CRUD ──

  async createRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        ...input,
        status: 'draft' as LeaveRequestStatus,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as LeaveRequest;
  },

  async updateRequest(id: string, updates: Partial<CreateLeaveRequestInput>): Promise<LeaveRequest> {
    const { data, error } = await supabase
      .from('leave_requests')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as LeaveRequest;
  },

  async cancelRequest(id: string): Promise<void> {
    // Get request to check current status & restore balance
    const { data: request } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (!request) throw new Error('Request not found');

    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw error;

    // If was pending, restore pending_days in balance
    if (request.status === 'pending') {
      const year = new Date(request.start_date).getFullYear();
      await this._adjustBalance(request.employee_id, year, request.leave_type, {
        pending_delta: -request.total_days,
      });
    }

    // If was approved, restore used_days
    if (request.status === 'approved') {
      const year = new Date(request.start_date).getFullYear();
      await this._adjustBalance(request.employee_id, year, request.leave_type, {
        used_delta: -request.total_days,
      });
    }
  },

  async deleteRequest(id: string): Promise<void> {
    const { error } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ── Submit & Approval Workflow ──

  async submitRequest(id: string): Promise<LeaveRequest> {
    // Get the request
    const { data: request } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (!request) throw new Error('Request not found');
    if (request.status !== 'draft') throw new Error('Only draft requests can be submitted');

    // Check balance
    const year = new Date(request.start_date).getFullYear();
    const balances = await this.getBalanceSummary(request.employee_id, year);
    const balance = balances.find(b => b.leave_type === request.leave_type);

    if (balance && balance.remaining < request.total_days) {
      throw new Error(`Không đủ phép. Còn lại: ${balance.remaining} ngày, yêu cầu: ${request.total_days} ngày`);
    }

    // Update status to pending
    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status: 'pending' })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    // Add pending_days to balance
    await this._adjustBalance(request.employee_id, year, request.leave_type, {
      pending_delta: request.total_days,
    });

    return data as LeaveRequest;
  },

  async approveRequest(id: string, approverId: string): Promise<LeaveRequest> {
    const { data: request } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (!request) throw new Error('Request not found');
    if (request.status !== 'pending') throw new Error('Only pending requests can be approved');

    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved',
        approver_id: approverId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    // Move from pending to used
    const year = new Date(request.start_date).getFullYear();
    await this._adjustBalance(request.employee_id, year, request.leave_type, {
      pending_delta: -request.total_days,
      used_delta: request.total_days,
    });

    return data as LeaveRequest;
  },

  async rejectRequest(id: string, approverId: string, reason: string): Promise<LeaveRequest> {
    const { data: request } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (!request) throw new Error('Request not found');
    if (request.status !== 'pending') throw new Error('Only pending requests can be rejected');

    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        approver_id: approverId,
        approved_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    // Restore pending_days
    const year = new Date(request.start_date).getFullYear();
    await this._adjustBalance(request.employee_id, year, request.leave_type, {
      pending_delta: -request.total_days,
    });

    return data as LeaveRequest;
  },

  // ── Queries ──

  async getRequestsByEmployee(employeeId: string, year?: number): Promise<LeaveRequest[]> {
    let query = supabase
      .from('leave_requests')
      .select('*, employees!leave_requests_employee_id_fkey(name, avatar, position), approver:employees!leave_requests_approver_id_fkey(name)')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    if (year) {
      query = query
        .gte('start_date', `${year}-01-01`)
        .lte('start_date', `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapLeaveRequest);
  },

  async getRequestsByUnit(unitId: string, filters?: {
    year?: number;
    status?: LeaveRequestStatus;
    month?: number;
  }): Promise<LeaveRequest[]> {
    let query = supabase
      .from('leave_requests')
      .select('*, employees!leave_requests_employee_id_fkey(name, avatar, position), approver:employees!leave_requests_approver_id_fkey(name), units!leave_requests_unit_id_fkey(name)')
      .eq('unit_id', unitId)
      .order('created_at', { ascending: false });

    if (filters?.year) {
      query = query
        .gte('start_date', `${filters.year}-01-01`)
        .lte('start_date', `${filters.year}-12-31`);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.month) {
      const monthStr = String(filters.month).padStart(2, '0');
      const year = filters.year || new Date().getFullYear();
      query = query
        .gte('start_date', `${year}-${monthStr}-01`)
        .lte('start_date', `${year}-${monthStr}-31`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapLeaveRequest);
  },

  async getPendingRequests(unitIds?: string[]): Promise<LeaveRequest[]> {
    let query = supabase
      .from('leave_requests')
      .select('*, employees!leave_requests_employee_id_fkey(name, avatar, position), units!leave_requests_unit_id_fkey(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (unitIds && unitIds.length > 0) {
      query = query.in('unit_id', unitIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapLeaveRequest);
  },

  async getAllRequests(filters?: {
    year?: number;
    status?: LeaveRequestStatus;
    unit_id?: string;
    search?: string;
  }): Promise<LeaveRequest[]> {
    let query = supabase
      .from('leave_requests')
      .select('*, employees!leave_requests_employee_id_fkey(name, avatar, position), approver:employees!leave_requests_approver_id_fkey(name), units!leave_requests_unit_id_fkey(name)')
      .order('created_at', { ascending: false });

    if (filters?.year) {
      query = query
        .gte('start_date', `${filters.year}-01-01`)
        .lte('start_date', `${filters.year}-12-31`);
    }
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.unit_id) query = query.eq('unit_id', filters.unit_id);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapLeaveRequest);
  },

  /**
   * Get team calendar data for a month — which employees are on leave.
   */
  async getTeamCalendar(unitId: string | null, year: number, month: number): Promise<LeaveRequest[]> {
    const monthStr = String(month).padStart(2, '0');
    const startOfMonth = `${year}-${monthStr}-01`;
    // Last day of month
    const lastDay = new Date(year, month, 0).getDate();
    const endOfMonth = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    let query = supabase
      .from('leave_requests')
      .select('*, employees!leave_requests_employee_id_fkey(name, avatar, position)')
      .eq('status', 'approved')
      .lte('start_date', endOfMonth)
      .gte('end_date', startOfMonth);

    if (unitId) {
      query = query.eq('unit_id', unitId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapLeaveRequest);
  },

  // ── Internal Helpers ──

  async _adjustBalance(
    employeeId: string,
    year: number,
    leaveType: string,
    deltas: { pending_delta?: number; used_delta?: number }
  ): Promise<void> {
    // Ensure balance record exists
    const { data: existing } = await supabase
      .from('leave_balances')
      .select('id, pending_days, used_days')
      .eq('employee_id', employeeId)
      .eq('year', year)
      .eq('leave_type', leaveType)
      .single();

    if (!existing) {
      // Auto-create balance from policy defaults
      const policies = await this.getPolicies();
      const policy = policies.find(p => p.leave_type === leaveType);
      await supabase.from('leave_balances').insert({
        employee_id: employeeId,
        year,
        leave_type: leaveType,
        total_days: policy?.default_days || 0,
        used_days: Math.max(0, deltas.used_delta || 0),
        pending_days: Math.max(0, deltas.pending_delta || 0),
      });
      return;
    }

    const newPending = Math.max(0, (existing.pending_days || 0) + (deltas.pending_delta || 0));
    const newUsed = Math.max(0, (existing.used_days || 0) + (deltas.used_delta || 0));

    await supabase
      .from('leave_balances')
      .update({ pending_days: newPending, used_days: newUsed })
      .eq('id', existing.id);
  },
};
