import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type ResolvedContext = {
  employeeId: string;
  profileId: string;
  fullName: string;
  role: string;
  unitId: string | null;
  telegramVerified: boolean;
  ok: boolean;
  errorMessage: string | null;
};

export async function resolveTelegramContext(chatId: string): Promise<ResolvedContext> {
  const { data, error } = await supabaseAdmin.rpc('telegram_bot_resolve_context', {
    p_telegram_chat_id: String(chatId),
  });

  if (error) {
    return {
      employeeId: '', profileId: '', fullName: '', role: '', unitId: null,
      telegramVerified: false, ok: false, errorMessage: error.message,
    };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return {
      employeeId: '', profileId: '', fullName: '', role: '', unitId: null,
      telegramVerified: false, ok: false, errorMessage: 'Không có dữ liệu resolve.',
    };
  }

  return {
    employeeId: String(row.employee_id ?? ''),
    profileId: String(row.profile_id ?? ''),
    fullName: String(row.full_name ?? ''),
    role: String(row.role ?? ''),
    unitId: row.unit_id != null ? String(row.unit_id) : null,
    telegramVerified: Boolean(row.telegram_verified),
    ok: Boolean(row.ok),
    errorMessage: row.error_message != null ? String(row.error_message) : null,
  };
}

export type ContractReportRow = {
  contract_id: string;
  contract_code: string;
  title: string;
  unit_id: string;
  status: string;
  signed_date: string | null;
  value_numeric: number | null;
  customer_id: string | null;
};

export async function fetchContractsReport(
  employeeId: string, from: string | null, to: string | null, limit: number
): Promise<ContractReportRow[]> {
  const { data, error } = await supabaseAdmin.rpc('telegram_bot_contracts_report', {
    p_employee_id: employeeId, p_from: from, p_to: to, p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ContractReportRow[];
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export type DashboardData = {
  total_contracts: number; active_contracts: number;
  total_value: number; total_receivables: number; total_cash_received: number;
  overdue_payments: number; pending_tasks: number; my_tasks: number;
};

export async function fetchDashboard(employeeId: string): Promise<DashboardData> {
  const { data, error } = await supabaseAdmin.rpc('telegram_bot_dashboard', {
    p_employee_id: employeeId,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row as DashboardData;
}

// ─── Thanh toán quá hạn ──────────────────────────────────────────────────────
export type OverduePayment = {
  payment_id: string; contract_code: string; contract_title: string;
  customer_name: string | null; amount: number; due_date: string; days_overdue: number;
};

export async function fetchOverduePayments(employeeId: string): Promise<OverduePayment[]> {
  const { data, error } = await supabaseAdmin.rpc('telegram_bot_overdue_payments', {
    p_employee_id: employeeId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as OverduePayment[];
}

// ─── HĐ sắp hết hạn ─────────────────────────────────────────────────────────
export type ExpiringContract = {
  contract_code: string; title: string; customer_name: string | null;
  end_date: string; days_remaining: number; value: number;
};

export async function fetchExpiringContracts(employeeId: string, days: number = 30): Promise<ExpiringContract[]> {
  const { data, error } = await supabaseAdmin.rpc('telegram_bot_expiring_contracts', {
    p_employee_id: employeeId, p_days: days,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpiringContract[];
}

// ─── Task của tôi ────────────────────────────────────────────────────────────
export type MyTask = {
  task_id: string; title: string; priority: string;
  status_name: string; due_date: string | null; project_name: string | null;
};

export async function fetchMyTasks(employeeId: string): Promise<MyTask[]> {
  const { data, error } = await supabaseAdmin.rpc('telegram_bot_my_tasks', {
    p_employee_id: employeeId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as MyTask[];
}

// ─── Tìm hợp đồng ───────────────────────────────────────────────────────────
export type SearchResult = {
  contract_code: string; title: string; customer_name: string | null;
  status: string; value: number; signed_date: string | null;
};

export async function searchContracts(employeeId: string, keyword: string): Promise<SearchResult[]> {
  const { data, error } = await supabaseAdmin.rpc('telegram_bot_search_contracts', {
    p_employee_id: employeeId, p_keyword: keyword,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as SearchResult[];
}

// ─── Doanh thu theo tháng ────────────────────────────────────────────────────
export type RevenueRow = {
  month_label: string; contract_count: number; total_value: number; total_revenue: number;
};

export async function fetchRevenueByMonth(employeeId: string, year?: number): Promise<RevenueRow[]> {
  const { data, error } = await supabaseAdmin.rpc('telegram_bot_revenue_by_month', {
    p_employee_id: employeeId, p_year: year ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as RevenueRow[];
}

// ─── Audit log ───────────────────────────────────────────────────────────────
export async function auditLog(
  chatId: string, employeeId: string | null, action: string, meta: Record<string, unknown>
): Promise<void> {
  try {
    await supabaseAdmin.rpc('telegram_bot_audit_log', {
      p_telegram_chat_id: String(chatId), p_employee_id: employeeId,
      p_action: action, p_meta: meta,
    });
  } catch { /* không chặn luồng bot */ }
}

// ─── HRM & Nghỉ phép ─────────────────────────────────────────────────────────

export type LeaveBalance = {
  leave_type: string;
  total_days: number;
  used_days: number;
  pending_days: number;
};

export async function fetchLeaveBalance(employeeId: string, year: number): Promise<LeaveBalance[]> {
  const { data, error } = await supabaseAdmin.from('leave_balances')
    .select('leave_type, total_days, used_days, pending_days')
    .eq('employee_id', employeeId)
    .eq('year', year);
  if (error) throw new Error(error.message);
  return data as LeaveBalance[];
}

export type PendingLeave = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  employee_id: string;
  employees: { name: string } | null;
};

export async function fetchPendingLeaves(unitId: string): Promise<PendingLeave[]> {
  const { data, error } = await supabaseAdmin.from('leave_requests')
    .select('id, leave_type, start_date, end_date, total_days, reason, employee_id, employees(name)')
    .eq('unit_id', unitId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
  return data as unknown as PendingLeave[];
}

export async function createLeaveRequest(
  employeeId: string, unitId: string | null, type: string,
  start: string, end: string, days: number, reason: string
): Promise<void> {
  const { error } = await supabaseAdmin.from('leave_requests').insert({
    employee_id: employeeId,
    unit_id: unitId,
    leave_type: type,
    start_date: start,
    end_date: end,
    total_days: days,
    reason: reason,
    status: 'pending'
  });
  if (error) throw new Error(error.message);
}

export async function approveLeaveRequest(requestId: string, approverId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('leave_requests')
    .update({ status: 'approved', approver_id: approverId, approved_at: new Date().toISOString() })
    .ilike('id', `${requestId}%`)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data != null;
}
