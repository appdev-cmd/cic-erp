import { config } from '../config.js';
import { ollamaEnabled } from '../config.js';
import {
  auditLog, fetchContractsReport, fetchDashboard, fetchOverduePayments,
  fetchExpiringContracts, fetchMyTasks, searchContracts, fetchRevenueByMonth,
  resolveTelegramContext, type ResolvedContext,
} from '../supabaseClient.js';
import { contractsToDocxBuffer } from '../export/buildDocx.js';
import { contractsToXlsxBuffer } from '../export/buildXlsx.js';
import { decideTool } from '../llm/ollamaGemma.js';
import { tgSendDocument, tgSendMessage } from '../telegramApi.js';

function fmtMoney(n: number | null): string {
  if (n == null || isNaN(n)) return '0';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + ' tỷ';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + ' triệu';
  return n.toLocaleString('vi-VN');
}

const HELP_HTML = [
  '<b>Trợ lý CIC ERP</b>',
  '',
  ollamaEnabled
    ? 'Bạn có thể hỏi bằng ngôn ngữ tự nhiên, ví dụ:'
    : 'Các lệnh hỗ trợ:',
  '',
  '/help — hướng dẫn',
  '/hopdong — danh sách hợp đồng',
  '/hopdong_xlsx — xuất Excel',
  '/hopdong_docx — xuất Word',
  '',
  ...(ollamaEnabled ? [
    '<b>Hỏi tự nhiên:</b>',
    '• "tình hình công ty" → tổng quan dashboard',
    '• "thanh toán quá hạn" → công nợ trễ',
    '• "HĐ sắp hết hạn" → cảnh báo hợp đồng',
    '• "task của tôi" → công việc được giao',
    '• "tìm hợp đồng Viettel" → tìm kiếm',
    '• "doanh thu năm nay" → báo cáo doanh thu',
    '• "xuất excel" → xuất file',
  ] : []),
].join('\n');

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseIsoDate(s: string | undefined): string | null {
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseHopDongCommand(text: string): {
  from: string | null; to: string | null; format: 'table' | 'xlsx' | 'docx';
} | null {
  const t = text.trim();
  let format: 'table' | 'xlsx' | 'docx' = 'table';
  let rest: string;
  if (/^\/hopdong_xlsx\b/i.test(t)) { format = 'xlsx'; rest = t.replace(/^\/hopdong_xlsx\s*/i, ''); }
  else if (/^\/hopdong_docx\b/i.test(t)) { format = 'docx'; rest = t.replace(/^\/hopdong_docx\s*/i, ''); }
  else if (/^\/hopdong\b/i.test(t)) { rest = t.replace(/^\/hopdong\s*/i, ''); }
  else return null;
  const parts = rest.trim().split(/\s+/).filter(Boolean);
  return { from: parseIsoDate(parts[0]), to: parseIsoDate(parts[1]), format };
}

// ─── Tool handlers ───────────────────────────────────────────────────────────

async function handleDashboard(chatId: number, ctx: ResolvedContext): Promise<void> {
  const d = await fetchDashboard(ctx.employeeId);
  const msg = [
    `<b>Tổng quan CIC ERP</b>`,
    `👤 ${esc(ctx.fullName)} (${esc(ctx.role)})`,
    '',
    `📋 Hợp đồng: <b>${d.total_contracts}</b> (đang thực hiện: ${d.active_contracts})`,
    `💰 Tổng giá trị: <b>${fmtMoney(d.total_value)}</b>`,
    `📥 Phải thu: ${fmtMoney(d.total_receivables)}`,
    `✅ Đã thu: ${fmtMoney(d.total_cash_received)}`,
    `⚠️ Thanh toán quá hạn: <b>${d.overdue_payments}</b>`,
    '',
    `📝 Task chung: ${d.pending_tasks} | Task của bạn: <b>${d.my_tasks}</b>`,
  ].join('\n');
  await tgSendMessage(chatId, msg);
  await auditLog(String(chatId), ctx.employeeId, 'dashboard', {});
}

async function handleOverduePayments(chatId: number, ctx: ResolvedContext): Promise<void> {
  const rows = await fetchOverduePayments(ctx.employeeId);
  if (rows.length === 0) {
    await tgSendMessage(chatId, '✅ Không có khoản thanh toán quá hạn.');
    return;
  }
  const lines = rows.slice(0, 15).map(r =>
    `• <b>${esc(r.contract_code)}</b> — ${esc(r.customer_name ?? '?')}\n  ${fmtMoney(r.amount)} | quá hạn <b>${r.days_overdue}</b> ngày (${r.due_date})`
  );
  const more = rows.length > 15 ? `\n… và ${rows.length - 15} khoản nữa.` : '';
  await tgSendMessage(chatId, `<b>⚠️ Thanh toán quá hạn (${rows.length})</b>\n\n` + lines.join('\n\n') + more);
  await auditLog(String(chatId), ctx.employeeId, 'overdue_payments', { count: rows.length });
}

async function handleExpiringContracts(chatId: number, ctx: ResolvedContext, days: number): Promise<void> {
  const rows = await fetchExpiringContracts(ctx.employeeId, days);
  if (rows.length === 0) {
    await tgSendMessage(chatId, `✅ Không có hợp đồng hết hạn trong ${days} ngày tới.`);
    return;
  }
  const lines = rows.slice(0, 15).map(r =>
    `• <b>${esc(r.contract_code)}</b> — ${esc(r.customer_name ?? '?')}\n  Hết hạn: ${r.end_date} (còn <b>${r.days_remaining}</b> ngày) | ${fmtMoney(r.value)}`
  );
  await tgSendMessage(chatId, `<b>📅 HĐ sắp hết hạn (${rows.length})</b>\n\n` + lines.join('\n\n'));
  await auditLog(String(chatId), ctx.employeeId, 'expiring_contracts', { days, count: rows.length });
}

async function handleMyTasks(chatId: number, ctx: ResolvedContext): Promise<void> {
  const rows = await fetchMyTasks(ctx.employeeId);
  if (rows.length === 0) {
    await tgSendMessage(chatId, '✅ Bạn không có task nào đang mở.');
    return;
  }
  const priorityIcon: Record<string, string> = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
  const lines = rows.slice(0, 20).map(r => {
    const icon = priorityIcon[r.priority ?? ''] ?? '⚪';
    const due = r.due_date ? ` | hạn ${r.due_date}` : '';
    const proj = r.project_name ? ` [${esc(r.project_name)}]` : '';
    return `${icon} <b>${esc(r.title)}</b>${proj}${due}\n  Trạng thái: ${esc(r.status_name)}`;
  });
  await tgSendMessage(chatId, `<b>📝 Task của bạn (${rows.length})</b>\n\n` + lines.join('\n\n'));
  await auditLog(String(chatId), ctx.employeeId, 'my_tasks', { count: rows.length });
}

async function handleSearchContracts(chatId: number, ctx: ResolvedContext, keyword: string): Promise<void> {
  if (!keyword || keyword.length < 2) {
    await tgSendMessage(chatId, 'Vui lòng nhập từ khóa dài hơn (ít nhất 2 ký tự).');
    return;
  }
  const rows = await searchContracts(ctx.employeeId, keyword);
  if (rows.length === 0) {
    await tgSendMessage(chatId, `Không tìm thấy hợp đồng nào khớp "<b>${esc(keyword)}</b>".`);
    return;
  }
  const lines = rows.map(r =>
    `• <b>${esc(r.contract_code)}</b> ${esc(r.title.slice(0, 60))}\n  KH: ${esc(r.customer_name ?? '-')} | ${esc(r.status)} | ${fmtMoney(r.value)}`
  );
  await tgSendMessage(chatId, `<b>🔍 Kết quả "${esc(keyword)}" (${rows.length})</b>\n\n` + lines.join('\n\n'));
  await auditLog(String(chatId), ctx.employeeId, 'search_contracts', { keyword, count: rows.length });
}

async function handleRevenueReport(chatId: number, ctx: ResolvedContext, year?: number): Promise<void> {
  const rows = await fetchRevenueByMonth(ctx.employeeId, year);
  const y = year ?? new Date().getFullYear();
  if (rows.length === 0) {
    await tgSendMessage(chatId, `Không có dữ liệu doanh thu năm ${y}.`);
    return;
  }
  let totalVal = 0, totalRev = 0, totalCount = 0;
  const lines = rows.map(r => {
    totalVal += Number(r.total_value); totalRev += Number(r.total_revenue); totalCount += Number(r.contract_count);
    return `📊 <b>${r.month_label}</b>: ${r.contract_count} HĐ | GT: ${fmtMoney(Number(r.total_value))} | DT: ${fmtMoney(Number(r.total_revenue))}`;
  });
  lines.push('', `<b>Tổng ${y}</b>: ${totalCount} HĐ | GT: ${fmtMoney(totalVal)} | DT: ${fmtMoney(totalRev)}`);
  await tgSendMessage(chatId, `<b>📈 Doanh thu ${y}</b>\n\n` + lines.join('\n'));
  await auditLog(String(chatId), ctx.employeeId, 'revenue_report', { year: y });
}

async function sendContractsFlow(
  chatId: number, ctx: ResolvedContext,
  from: string | null, to: string | null, format: 'table' | 'xlsx' | 'docx'
): Promise<void> {
  const rows = await fetchContractsReport(ctx.employeeId, from, to, config.reportRowCap);
  await auditLog(String(chatId), ctx.employeeId, 'list_contracts', { from, to, format, rowCount: rows.length });

  if (rows.length === 0) {
    await tgSendMessage(chatId, 'Không có hợp đồng trong phạm vi lọc.');
    return;
  }

  if (format === 'xlsx') {
    const buf = contractsToXlsxBuffer(rows);
    await tgSendDocument(chatId, `hop_dong_${new Date().toISOString().slice(0, 10)}.xlsx`, buf, `Báo cáo (${rows.length} dòng)`);
    return;
  }
  if (format === 'docx') {
    const buf = await contractsToDocxBuffer(rows, `Báo cáo hợp đồng — ${ctx.fullName}`);
    await tgSendDocument(chatId, `hop_dong_${new Date().toISOString().slice(0, 10)}.docx`, buf, `Báo cáo (${rows.length} dòng)`);
    return;
  }

  const head = rows.slice(0, 30);
  const lines = head.map(r =>
    `• <b>${esc(r.contract_code)}</b> ${esc(r.title.slice(0, 60))} | ${esc(r.status)} | ${r.signed_date ?? '-'}`
  );
  const more = rows.length > 30 ? `\n… và ${rows.length - 30} dòng khác. Dùng /hopdong_xlsx để tải đủ.` : '';
  await tgSendMessage(chatId, `<b>${rows.length}</b> hợp đồng:\n` + lines.join('\n') + more);
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function openclawHandleMessage(chatId: number, text: string): Promise<void> {
  const ctx = await resolveTelegramContext(String(chatId));
  if (!ctx.ok) {
    await tgSendMessage(chatId, ctx.errorMessage ?? 'Không thể xác thực tài khoản Telegram trên ERP.');
    await auditLog(String(chatId), null, 'resolve_failed', { error: ctx.errorMessage });
    return;
  }

  const t = text.trim().toLowerCase();

  if (t === '/help' || t === '/start' || t === 'help') {
    await tgSendMessage(chatId, HELP_HTML);
    await auditLog(String(chatId), ctx.employeeId, 'help', {});
    return;
  }

  const hop = parseHopDongCommand(text);
  if (hop) {
    await sendContractsFlow(chatId, ctx, hop.from, hop.to, hop.format);
    return;
  }

  if (!ollamaEnabled) {
    await tgSendMessage(chatId, 'Lệnh không hợp lệ. Gõ /help. (Cấu hình OLLAMA_HOST để hỏi tự nhiên.)');
    return;
  }

  await tgSendMessage(chatId, '⏳ Đang xử lý...');

  const decision = await decideTool(text, [
    `Người dùng: ${ctx.fullName}`,
    `Vai trò: ${ctx.role}`,
    `Đơn vị: ${ctx.unitId ?? '-'}`,
    `Ngày hiện tại: ${new Date().toISOString().slice(0, 10)}`,
  ]);

  if (!decision) {
    await tgSendMessage(chatId, 'Xin lỗi, tôi chưa hiểu yêu cầu. Gõ /help để xem những gì tôi có thể giúp.');
    return;
  }

  switch (decision.tool) {
    case 'chat':
      await tgSendMessage(chatId, String(decision.args.message ?? 'Xin chào! Gõ /help để xem hướng dẫn.'));
      await auditLog(String(chatId), ctx.employeeId, 'chat', { message: decision.args.message });
      break;
    case 'help':
      await tgSendMessage(chatId, HELP_HTML);
      await auditLog(String(chatId), ctx.employeeId, 'llm_help', {});
      break;
    case 'dashboard':
      await handleDashboard(chatId, ctx);
      break;
    case 'list_contracts':
      await sendContractsFlow(chatId, ctx,
        decision.args.from ? String(decision.args.from) : null,
        decision.args.to ? String(decision.args.to) : null, 'table');
      break;
    case 'search_contracts':
      await handleSearchContracts(chatId, ctx, String(decision.args.keyword ?? ''));
      break;
    case 'overdue_payments':
      await handleOverduePayments(chatId, ctx);
      break;
    case 'expiring_contracts':
      await handleExpiringContracts(chatId, ctx, Number(decision.args.days) || 30);
      break;
    case 'my_tasks':
      await handleMyTasks(chatId, ctx);
      break;
    case 'revenue_report':
      await handleRevenueReport(chatId, ctx, decision.args.year ? Number(decision.args.year) : undefined);
      break;
    case 'export_xlsx':
      await sendContractsFlow(chatId, ctx,
        decision.args.from ? String(decision.args.from) : null,
        decision.args.to ? String(decision.args.to) : null, 'xlsx');
      break;
    case 'export_docx':
      await sendContractsFlow(chatId, ctx,
        decision.args.from ? String(decision.args.from) : null,
        decision.args.to ? String(decision.args.to) : null, 'docx');
      break;
    default:
      await tgSendMessage(chatId, 'Xin lỗi, tôi chưa hỗ trợ yêu cầu này. Gõ /help.');
  }
}
