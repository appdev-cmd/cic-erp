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
      employeeId: '',
      profileId: '',
      fullName: '',
      role: '',
      unitId: null,
      telegramVerified: false,
      ok: false,
      errorMessage: error.message,
    };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return {
      employeeId: '',
      profileId: '',
      fullName: '',
      role: '',
      unitId: null,
      telegramVerified: false,
      ok: false,
      errorMessage: 'Không có dữ liệu resolve.',
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
  employeeId: string,
  from: string | null,
  to: string | null,
  limit: number
): Promise<ContractReportRow[]> {
  const { data, error } = await supabaseAdmin.rpc('telegram_bot_contracts_report', {
    p_employee_id: employeeId,
    p_from: from,
    p_to: to,
    p_limit: limit,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as ContractReportRow[];
}

export async function auditLog(
  chatId: string,
  employeeId: string | null,
  action: string,
  meta: Record<string, unknown>
): Promise<void> {
  try {
    await supabaseAdmin.rpc('telegram_bot_audit_log', {
      p_telegram_chat_id: String(chatId),
      p_employee_id: employeeId,
      p_action: action,
      p_meta: meta,
    });
  } catch {
    /* không chặn luồng bot nếu audit lỗi */
  }
}
