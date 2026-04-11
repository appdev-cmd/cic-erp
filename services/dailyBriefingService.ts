/**
 * Daily Briefing Service
 * ─────────────────────
 * Tạo bản tóm tắt hàng ngày cho Ban Giám đốc.
 * Có thể gọi từ:
 * 1. Client-side: import { generateDailyBriefing } từ service này
 * 2. Supabase Edge Function (cron mỗi sáng 7h)
 * 3. Nút "Bản tin sáng" trong AI chat
 */

import { dataClient } from '../lib/dataClient';

export interface DailyBriefingData {
  date: string;
  overdueContracts: number;
  expiringContracts: number;      // Hết hạn trong 7 ngày
  overduePayments: number;
  totalReceivables: number;        // Tổng công nợ phải thu
  newContractsToday: number;
  tasksOverdue: number;
  summary: string;                 // Markdown summary
}

/**
 * Generate daily briefing data by querying ERP database
 */
export async function generateDailyBriefing(): Promise<DailyBriefingData> {
  const today = new Date().toISOString().split('T')[0];
  const weekLater = new Date();
  weekLater.setDate(weekLater.getDate() + 7);
  const weekLaterStr = weekLater.toISOString().split('T')[0];

  // Parallel queries for speed
  const [
    overdueContractsRes,
    expiringContractsRes,
    overduePaymentsRes,
    receivablesRes,
    newContractsRes,
    overdueTasksRes,
  ] = await Promise.all([
    // 1. HĐ quá hạn
    dataClient
      .from('contracts')
      .select('contract_code, title, end_date, customer_id', { count: 'exact' })
      .lt('end_date', today)
      .in('status', ['Đang thực hiện', 'Tạm dừng'])
      .limit(5),

    // 2. HĐ sắp hết hạn (7 ngày)
    dataClient
      .from('contracts')
      .select('contract_code, title, end_date', { count: 'exact' })
      .gte('end_date', today)
      .lte('end_date', weekLaterStr)
      .in('status', ['Đang thực hiện'])
      .limit(5),

    // 3. Phiếu thu quá hạn
    dataClient
      .from('payments')
      .select('id, amount, due_date, contract_id', { count: 'exact' })
      .lt('due_date', today)
      .in('status', ['Đã xuất HĐ', 'Tạm ứng'])
      .limit(5),

    // 4. Tổng công nợ phải thu
    dataClient
      .from('contracts')
      .select('receivables')
      .gt('receivables', 0),

    // 5. HĐ mới hôm nay
    dataClient
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today),

    // 6. Tasks quá hạn
    dataClient
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .lt('due_date', today)
      .not('status_id', 'is', null) // has status
      .neq('status_id', 'done'),
  ]);

  const overdueContracts = overdueContractsRes.count || 0;
  const expiringContracts = expiringContractsRes.count || 0;
  const overduePayments = overduePaymentsRes.count || 0;
  const totalReceivables = (receivablesRes.data || []).reduce((sum: number, c: any) => sum + (c.receivables || 0), 0);
  const newContractsToday = newContractsRes.count || 0;
  const tasksOverdue = overdueTasksRes.count || 0;

  // Build markdown summary
  const fmtMoney = (v: number) => {
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)} tỷ`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(0)} triệu`;
    return v.toLocaleString('vi-VN');
  };

  const lines: string[] = [
    `## 📋 Bản tin sáng — ${new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`,
    '',
  ];

  // Alerts section
  const alerts: string[] = [];
  if (overdueContracts > 0) alerts.push(`🔴 **${overdueContracts}** HĐ quá hạn hoàn thành`);
  if (overduePayments > 0) alerts.push(`💰 **${overduePayments}** phiếu thu/chi quá hạn`);
  if (expiringContracts > 0) alerts.push(`🟡 **${expiringContracts}** HĐ sắp hết hạn (7 ngày)`);
  if (tasksOverdue > 0) alerts.push(`📌 **${tasksOverdue}** công việc trễ deadline`);

  if (alerts.length > 0) {
    lines.push('### ⚠️ Cảnh báo cần xử lý');
    alerts.forEach(a => lines.push(`- ${a}`));
    lines.push('');
  } else {
    lines.push('### ✅ Không có cảnh báo khẩn cấp');
    lines.push('');
  }

  // Overview
  lines.push('### 📊 Tổng quan');
  lines.push(`| Chỉ số | Giá trị |`);
  lines.push(`|--------|---------|`);
  lines.push(`| Công nợ phải thu | **${fmtMoney(totalReceivables)} VND** |`);
  lines.push(`| HĐ mới hôm nay | **${newContractsToday}** |`);
  lines.push(`| HĐ quá hạn | **${overdueContracts}** |`);
  lines.push(`| Phiếu thu quá hạn | **${overduePayments}** |`);
  lines.push(`| Công việc trễ hạn | **${tasksOverdue}** |`);
  lines.push('');

  // Top overdue contracts details
  if (overdueContractsRes.data && overdueContractsRes.data.length > 0) {
    lines.push('### 🔴 Top HĐ quá hạn');
    lines.push('| Mã HĐ | Tên | Hết hạn |');
    lines.push('|--------|-----|---------|');
    overdueContractsRes.data.forEach((c: any) => {
      lines.push(`| ${c.contract_code} | ${c.title?.substring(0, 30)}... | ${c.end_date} |`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('*Bấm vào gợi ý bên dưới để xem chi tiết hoặc giao việc xử lý.*');

  return {
    date: today,
    overdueContracts,
    expiringContracts,
    overduePayments,
    totalReceivables,
    newContractsToday,
    tasksOverdue,
    summary: lines.join('\n'),
  };
}
