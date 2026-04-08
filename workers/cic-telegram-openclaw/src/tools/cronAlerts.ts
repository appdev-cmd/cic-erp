/**
 * Cron-style alerts — OpenClaw heartbeat.
 * Chạy định kỳ, gửi cảnh báo Telegram cho user đã verified.
 */
import { supabaseAdmin } from '../supabaseClient.js';
import { tgSendMessage } from '../telegramApi.js';

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + ' tỷ';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + ' triệu';
  return n.toLocaleString('vi-VN');
}

async function getVerifiedUsers(): Promise<Array<{ employee_id: string; telegram: string; name: string }>> {
  const { data } = await supabaseAdmin
    .from('employees')
    .select('id, telegram, name')
    .eq('telegram_verified', true)
    .not('telegram', 'is', null)
    .neq('telegram', '');
  return (data ?? []).map(r => ({ employee_id: r.id, telegram: r.telegram, name: r.name }));
}

async function checkOverdueForUser(employeeId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.rpc('telegram_bot_overdue_payments', {
    p_employee_id: employeeId, p_limit: 5,
  });
  if (!data || data.length === 0) return null;
  const lines = data.slice(0, 5).map((r: Record<string, unknown>) =>
    `• ${r.contract_code} — ${fmtMoney(Number(r.amount))} (quá ${r.days_overdue} ngày)`
  );
  return `⚠️ <b>Cảnh báo thanh toán quá hạn</b>\n\n${lines.join('\n')}\n\nGõ "thanh toán quá hạn" để xem đầy đủ.`;
}

async function checkExpiringForUser(employeeId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.rpc('telegram_bot_expiring_contracts', {
    p_employee_id: employeeId, p_days: 14,
  });
  if (!data || data.length === 0) return null;
  const lines = data.slice(0, 5).map((r: Record<string, unknown>) =>
    `• ${r.contract_code} — hết hạn ${r.end_date} (còn ${r.days_remaining} ngày)`
  );
  return `📅 <b>HĐ sắp hết hạn (14 ngày tới)</b>\n\n${lines.join('\n')}\n\nGõ "HĐ sắp hết hạn" để xem đầy đủ.`;
}

async function checkTasksDueForUser(employeeId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.rpc('telegram_bot_my_tasks', {
    p_employee_id: employeeId, p_limit: 5,
  });
  if (!data || data.length === 0) return null;
  const overdue = (data as Array<Record<string, unknown>>).filter(t => {
    if (!t.due_date) return false;
    return new Date(t.due_date as string) < new Date();
  });
  if (overdue.length === 0) return null;
  const lines = overdue.slice(0, 5).map(t =>
    `• ${(t.title as string).slice(0, 60)} — hạn ${t.due_date}`
  );
  return `🔴 <b>Task quá hạn</b>\n\n${lines.join('\n')}\n\nGõ "task của tôi" để xem đầy đủ.`;
}

export async function runDailyAlerts(): Promise<number> {
  const users = await getVerifiedUsers();
  let sent = 0;

  for (const user of users) {
    const chatId = user.telegram;
    try {
      const [overdue, expiring, tasks] = await Promise.all([
        checkOverdueForUser(user.employee_id),
        checkExpiringForUser(user.employee_id),
        checkTasksDueForUser(user.employee_id),
      ]);

      const alerts = [overdue, expiring, tasks].filter(Boolean) as string[];
      if (alerts.length === 0) continue;

      const header = `🤖 <b>Báo cáo hàng ngày — ${user.name}</b>\n${'─'.repeat(30)}\n`;
      await tgSendMessage(chatId, header + alerts.join('\n\n'));
      sent++;
    } catch {
      /* skip user if error */
    }
  }

  return sent;
}
