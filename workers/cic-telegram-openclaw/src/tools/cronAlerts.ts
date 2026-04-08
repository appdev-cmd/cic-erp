/**
 * Cron-style alerts — OpenClaw heartbeat.
 * Chạy định kỳ, gửi cảnh báo Telegram cho user đã verified.
 */
import { supabaseAdmin } from '../supabaseClient.js';
import { tgSendMessage, tgSendDocument } from '../telegramApi.js';
import { generateNaturalReply } from '../llm/naturalChat.js';
import { contractsToXlsxBuffer } from '../export/buildXlsx.js';

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

async function getOverdueData(employeeId: string): Promise<any[]> {
  const { data } = await supabaseAdmin.rpc('telegram_bot_overdue_payments', {
    p_employee_id: employeeId, p_limit: 50,
  });
  return data && data.length > 0 ? data : [];
}

async function checkOverdueForUser(employeeId: string, data: any[]): Promise<string | null> {
  if (data.length === 0) return null;
  const lines = data.slice(0, 5).map((r: Record<string, unknown>) =>
    `• ${r.contract_code} — ${fmtMoney(Number(r.amount))} (quá ${r.days_overdue} ngày)`
  );
  return `⚠️ <b>Cảnh báo thanh toán quá hạn</b>\n\n${lines.join('\n')}\n\nGõ "thanh toán quá hạn" để xem đầy đủ.`;
}

async function getExpiringData(employeeId: string): Promise<any[]> {
  const { data } = await supabaseAdmin.rpc('telegram_bot_expiring_contracts', {
    p_employee_id: employeeId, p_days: 14,
  });
  return data && data.length > 0 ? data : [];
}

async function checkExpiringForUser(employeeId: string, data: any[]): Promise<string | null> {
  if (data.length === 0) return null;
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
      const overdueData = await getOverdueData(user.employee_id);
      const expiringData = await getExpiringData(user.employee_id);
      
      const [overdueTxt, expiringTxt, tasksTxt] = await Promise.all([
        checkOverdueForUser(user.employee_id, overdueData),
        checkExpiringForUser(user.employee_id, expiringData),
        checkTasksDueForUser(user.employee_id),
      ]);

      const alerts = [overdueTxt, expiringTxt, tasksTxt].filter(Boolean) as string[];
      if (alerts.length === 0) continue;

      const rawAlertText = alerts.join('\n\n');
      
      // Khởi chạy Agent thông minh để biến báo cáo khô khan thành cảnh báo cá nhân hoá
      const prompt = `Dưới đây là số liệu cảnh báo tự động ngày hôm nay của nhân sự "${user.name}".\n\n${rawAlertText}\n\nHãy đóng vai trợ lý quản lý công ty CIC, viết một đoạn tin nhắn ngắn gọn (dưới 150 chữ) nhắn thẳng cho họ để tóm tắt rủi ro và đốc thúc xử lý. Giữ giọng văn chuyên nghiệp nhưng khẩn trương.`;
      
      let finalMessage = '';
      const aiReply = await generateNaturalReply(prompt, [`Người nhận: ${user.name}`]);
      
      if (aiReply) {
         finalMessage = `🤖 <b>Báo cáo hằng ngày — ${user.name}</b>\n${'─'.repeat(30)}\n\n${aiReply}`;
      } else {
         finalMessage = `🤖 <b>Báo cáo hằng ngày — ${user.name}</b>\n${'─'.repeat(30)}\n\n${rawAlertText}`;
      }

      await tgSendMessage(chatId, finalMessage);
      
      // Nếu có số liệu quá hạn, xuất luôn file excel cho họ kiểm tra
      if (overdueData.length > 0) {
         try {
           const excelBuf = contractsToXlsxBuffer(overdueData.map(r => ({ ...r, 'Ghi chú': 'Quá hạn thanh toán' })));
           await tgSendDocument(chatId, `no_qua_han_${new Date().toISOString().slice(0, 10)}.xlsx`, excelBuf, `Chi tiết ${overdueData.length} khoản nợ quá hạn đính kèm.`);
         } catch {
           // bỏ qua nếu lỗi tạo file
         }
      }
      
      sent++;
    } catch {
      /* skip user if error */
    }
  }

  return sent;
}
