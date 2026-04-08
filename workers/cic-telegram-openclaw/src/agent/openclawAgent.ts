import { config, ollamaEnabled } from '../config.js';
import {
  auditLog, fetchContractsReport, fetchDashboard, fetchOverduePayments,
  fetchExpiringContracts, fetchMyTasks, searchContracts, fetchRevenueByMonth,
  resolveTelegramContext, type ResolvedContext,
} from '../supabaseClient.js';
import { contractsToDocxBuffer } from '../export/buildDocx.js';
import { contractsToXlsxBuffer } from '../export/buildXlsx.js';
import { decideTool } from '../llm/ollamaGemma.js';
import { tgSendDocument, tgSendMessage } from '../telegramApi.js';
import { addMessage, getContextSummary, clearHistory } from '../memory/conversationMemory.js';
import { executeShell, listFiles, readFile, writeFile, saveReport } from '../tools/shellTool.js';

function fmtMoney(n: number | null): string {
  if (n == null || isNaN(n)) return '0';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + ' tỷ';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + ' triệu';
  return n.toLocaleString('vi-VN');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const HELP_HTML = [
  '<b>🤖 Trợ lý CIC ERP — OpenClaw Edition</b>',
  '<i>AI assistant chạy local trên máy của bạn</i>',
  '',
  '<b>📊 Báo cáo & Dữ liệu:</b>',
  '• "tình hình công ty" → tổng quan dashboard',
  '• "doanh thu năm nay" → báo cáo doanh thu',
  '• "thanh toán quá hạn" → công nợ trễ',
  '• "HĐ sắp hết hạn" → cảnh báo hợp đồng',
  '• "task của tôi" → công việc được giao',
  '• "tìm hợp đồng Viettel" → tìm kiếm',
  '',
  '<b>📄 Xuất file:</b>',
  '• "xuất excel hợp đồng quý 1" → gửi .xlsx',
  '• "lập báo cáo quý 1 file docx" → gửi .docx',
  '• "lưu báo cáo quý 1 ra excel" → lưu vào ~/cic-reports/',
  '',
  '<b>🖥️ Máy local:</b>',
  '• "chạy lệnh df -h" → chạy terminal',
  '• "xem file ~/projects" → liệt kê thư mục',
  '• "đọc file config.json" → đọc nội dung',
  '',
  '<b>📋 Lệnh nhanh:</b>',
  '/help /hopdong /hopdong_xlsx /hopdong_docx',
  '',
  '💬 Hoặc hỏi bằng ngôn ngữ tự nhiên!',
].join('\n');

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

async function handleDashboard(chatId: number, ctx: ResolvedContext): Promise<string> {
  const d = await fetchDashboard(ctx.employeeId);
  const msg = [
    `<b>📊 Tổng quan CIC ERP</b>`,
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
  return msg;
}

async function handleOverduePayments(chatId: number, ctx: ResolvedContext): Promise<string> {
  const rows = await fetchOverduePayments(ctx.employeeId);
  if (rows.length === 0) {
    const msg = '✅ Không có khoản thanh toán quá hạn.';
    await tgSendMessage(chatId, msg);
    return msg;
  }
  const lines = rows.slice(0, 15).map(r =>
    `• <b>${esc(r.contract_code)}</b> — ${esc(r.customer_name ?? '?')}\n  ${fmtMoney(r.amount)} | quá hạn <b>${r.days_overdue}</b> ngày (${r.due_date})`
  );
  const more = rows.length > 15 ? `\n… và ${rows.length - 15} khoản nữa.` : '';
  const msg = `<b>⚠️ Thanh toán quá hạn (${rows.length})</b>\n\n` + lines.join('\n\n') + more;
  await tgSendMessage(chatId, msg);
  await auditLog(String(chatId), ctx.employeeId, 'overdue_payments', { count: rows.length });
  return msg;
}

async function handleExpiringContracts(chatId: number, ctx: ResolvedContext, days: number): Promise<string> {
  const rows = await fetchExpiringContracts(ctx.employeeId, days);
  if (rows.length === 0) {
    const msg = `✅ Không có hợp đồng hết hạn trong ${days} ngày tới.`;
    await tgSendMessage(chatId, msg);
    return msg;
  }
  const lines = rows.slice(0, 15).map(r =>
    `• <b>${esc(r.contract_code)}</b> — ${esc(r.customer_name ?? '?')}\n  Hết hạn: ${r.end_date} (còn <b>${r.days_remaining}</b> ngày) | ${fmtMoney(r.value)}`
  );
  const msg = `<b>📅 HĐ sắp hết hạn (${rows.length})</b>\n\n` + lines.join('\n\n');
  await tgSendMessage(chatId, msg);
  await auditLog(String(chatId), ctx.employeeId, 'expiring_contracts', { days, count: rows.length });
  return msg;
}

async function handleMyTasks(chatId: number, ctx: ResolvedContext): Promise<string> {
  const rows = await fetchMyTasks(ctx.employeeId);
  if (rows.length === 0) {
    const msg = '✅ Bạn không có task nào đang mở.';
    await tgSendMessage(chatId, msg);
    return msg;
  }
  const priorityIcon: Record<string, string> = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
  const lines = rows.slice(0, 20).map(r => {
    const icon = priorityIcon[r.priority ?? ''] ?? '⚪';
    const due = r.due_date ? ` | hạn ${r.due_date}` : '';
    const proj = r.project_name ? ` [${esc(r.project_name)}]` : '';
    return `${icon} <b>${esc(r.title)}</b>${proj}${due}\n  Trạng thái: ${esc(r.status_name)}`;
  });
  const msg = `<b>📝 Task của bạn (${rows.length})</b>\n\n` + lines.join('\n\n');
  await tgSendMessage(chatId, msg);
  await auditLog(String(chatId), ctx.employeeId, 'my_tasks', { count: rows.length });
  return msg;
}

async function handleSearchContracts(chatId: number, ctx: ResolvedContext, keyword: string): Promise<string> {
  if (!keyword || keyword.length < 2) {
    const msg = 'Vui lòng nhập từ khóa dài hơn (ít nhất 2 ký tự).';
    await tgSendMessage(chatId, msg);
    return msg;
  }
  const rows = await searchContracts(ctx.employeeId, keyword);
  if (rows.length === 0) {
    const msg = `Không tìm thấy HĐ nào khớp "<b>${esc(keyword)}</b>".`;
    await tgSendMessage(chatId, msg);
    return msg;
  }
  const lines = rows.map(r =>
    `• <b>${esc(r.contract_code)}</b> ${esc(r.title.slice(0, 60))}\n  KH: ${esc(r.customer_name ?? '-')} | ${esc(r.status)} | ${fmtMoney(r.value)}`
  );
  const msg = `<b>🔍 Kết quả "${esc(keyword)}" (${rows.length})</b>\n\n` + lines.join('\n\n');
  await tgSendMessage(chatId, msg);
  await auditLog(String(chatId), ctx.employeeId, 'search_contracts', { keyword, count: rows.length });
  return msg;
}

async function handleRevenueReport(chatId: number, ctx: ResolvedContext, year?: number): Promise<string> {
  const rows = await fetchRevenueByMonth(ctx.employeeId, year);
  const y = year ?? new Date().getFullYear();
  if (rows.length === 0) {
    const msg = `Không có dữ liệu doanh thu năm ${y}.`;
    await tgSendMessage(chatId, msg);
    return msg;
  }
  let totalVal = 0, totalRev = 0, totalCount = 0;
  const lines = rows.map(r => {
    totalVal += Number(r.total_value); totalRev += Number(r.total_revenue); totalCount += Number(r.contract_count);
    return `📊 <b>${r.month_label}</b>: ${r.contract_count} HĐ | GT: ${fmtMoney(Number(r.total_value))} | DT: ${fmtMoney(Number(r.total_revenue))}`;
  });
  lines.push('', `<b>Tổng ${y}</b>: ${totalCount} HĐ | GT: ${fmtMoney(totalVal)} | DT: ${fmtMoney(totalRev)}`);
  const msg = `<b>📈 Doanh thu ${y}</b>\n\n` + lines.join('\n');
  await tgSendMessage(chatId, msg);
  await auditLog(String(chatId), ctx.employeeId, 'revenue_report', { year: y });
  return msg;
}

async function sendContractsFlow(
  chatId: number, ctx: ResolvedContext,
  from: string | null, to: string | null, format: 'table' | 'xlsx' | 'docx'
): Promise<string> {
  const rows = await fetchContractsReport(ctx.employeeId, from, to, config.reportRowCap);
  await auditLog(String(chatId), ctx.employeeId, 'list_contracts', { from, to, format, rowCount: rows.length });

  if (rows.length === 0) {
    const msg = 'Không có hợp đồng trong phạm vi lọc.';
    await tgSendMessage(chatId, msg);
    return msg;
  }

  if (format === 'xlsx') {
    const buf = contractsToXlsxBuffer(rows);
    await tgSendDocument(chatId, `hop_dong_${new Date().toISOString().slice(0, 10)}.xlsx`, buf, `Báo cáo (${rows.length} dòng)`);
    return `Đã gửi file Excel (${rows.length} dòng)`;
  }
  if (format === 'docx') {
    const buf = await contractsToDocxBuffer(rows, `Báo cáo hợp đồng — ${ctx.fullName}`);
    await tgSendDocument(chatId, `hop_dong_${new Date().toISOString().slice(0, 10)}.docx`, buf, `Báo cáo (${rows.length} dòng)`);
    return `Đã gửi file Word (${rows.length} dòng)`;
  }

  const head = rows.slice(0, 30);
  const lines = head.map(r =>
    `• <b>${esc(r.contract_code)}</b> ${esc(r.title.slice(0, 60))} | ${esc(r.status)} | ${r.signed_date ?? '-'}`
  );
  const more = rows.length > 30 ? `\n… và ${rows.length - 30} dòng khác. Dùng /hopdong_xlsx để tải đủ.` : '';
  const msg = `<b>${rows.length}</b> hợp đồng:\n` + lines.join('\n') + more;
  await tgSendMessage(chatId, msg);
  return msg;
}

async function handleSaveReport(
  chatId: number, ctx: ResolvedContext,
  from: string | null, to: string | null, format: string
): Promise<string> {
  const rows = await fetchContractsReport(ctx.employeeId, from, to, config.reportRowCap);
  if (rows.length === 0) {
    const msg = 'Không có dữ liệu để lưu.';
    await tgSendMessage(chatId, msg);
    return msg;
  }
  const dateSuffix = new Date().toISOString().slice(0, 10);
  let buf: Buffer;
  let filename: string;
  if (format === 'xlsx') {
    buf = contractsToXlsxBuffer(rows);
    filename = `hop_dong_${dateSuffix}.xlsx`;
  } else {
    buf = await contractsToDocxBuffer(rows, `Báo cáo — ${ctx.fullName}`);
    filename = `hop_dong_${dateSuffix}.docx`;
  }
  const savedPath = saveReport(filename, buf);
  const msg = `📁 Đã lưu báo cáo (${rows.length} dòng) tại:\n<code>${esc(savedPath)}</code>`;
  await tgSendMessage(chatId, msg);
  await tgSendDocument(chatId, filename, buf, `${rows.length} dòng`);
  await auditLog(String(chatId), ctx.employeeId, 'save_report', { path: savedPath, rows: rows.length });
  return msg;
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function openclawHandleMessage(chatId: number, text: string): Promise<void> {
  const ctx = await resolveTelegramContext(String(chatId));
  if (!ctx.ok) {
    await tgSendMessage(chatId, ctx.errorMessage ?? 'Không thể xác thực tài khoản Telegram trên ERP.');
    await auditLog(String(chatId), null, 'resolve_failed', { error: ctx.errorMessage });
    return;
  }

  addMessage(chatId, 'user', text);
  const t = text.trim().toLowerCase();

  if (t === '/help' || t === '/start' || t === 'help') {
    await tgSendMessage(chatId, HELP_HTML);
    addMessage(chatId, 'assistant', 'Đã gửi hướng dẫn');
    await auditLog(String(chatId), ctx.employeeId, 'help', {});
    return;
  }

  const hop = parseHopDongCommand(text);
  if (hop) {
    const reply = await sendContractsFlow(chatId, ctx, hop.from, hop.to, hop.format);
    addMessage(chatId, 'assistant', reply);
    return;
  }

  if (!ollamaEnabled) {
    await tgSendMessage(chatId, 'Lệnh không hợp lệ. Gõ /help.');
    return;
  }

  await tgSendMessage(chatId, '⏳ Đang xử lý...');

  const conversationContext = getContextSummary(chatId);
  const decision = await decideTool(text, [
    `Người dùng: ${ctx.fullName}`,
    `Vai trò: ${ctx.role}`,
    `Đơn vị: ${ctx.unitId ?? '-'}`,
    `Ngày: ${new Date().toISOString().slice(0, 10)}`,
    ...(conversationContext ? [`Hội thoại gần đây:\n${conversationContext}`] : []),
  ]);

  if (!decision) {
    const msg = 'Xin lỗi, tôi chưa hiểu. Gõ /help để xem những gì tôi có thể giúp.';
    await tgSendMessage(chatId, msg);
    addMessage(chatId, 'assistant', msg);
    return;
  }

  let reply = '';

  switch (decision.tool) {
    case 'chat':
      reply = String(decision.args.message ?? 'Xin chào! Gõ /help để xem hướng dẫn.');
      await tgSendMessage(chatId, reply);
      await auditLog(String(chatId), ctx.employeeId, 'chat', {});
      break;
    case 'help':
      await tgSendMessage(chatId, HELP_HTML);
      reply = 'Đã gửi hướng dẫn';
      await auditLog(String(chatId), ctx.employeeId, 'llm_help', {});
      break;
    case 'dashboard':
      reply = await handleDashboard(chatId, ctx);
      break;
    case 'list_contracts':
      reply = await sendContractsFlow(chatId, ctx,
        decision.args.from ? String(decision.args.from) : null,
        decision.args.to ? String(decision.args.to) : null, 'table');
      break;
    case 'search_contracts':
      reply = await handleSearchContracts(chatId, ctx, String(decision.args.keyword ?? ''));
      break;
    case 'overdue_payments':
      reply = await handleOverduePayments(chatId, ctx);
      break;
    case 'expiring_contracts':
      reply = await handleExpiringContracts(chatId, ctx, Number(decision.args.days) || 30);
      break;
    case 'my_tasks':
      reply = await handleMyTasks(chatId, ctx);
      break;
    case 'revenue_report':
      reply = await handleRevenueReport(chatId, ctx, decision.args.year ? Number(decision.args.year) : undefined);
      break;
    case 'export_xlsx':
      reply = await sendContractsFlow(chatId, ctx,
        decision.args.from ? String(decision.args.from) : null,
        decision.args.to ? String(decision.args.to) : null, 'xlsx');
      break;
    case 'export_docx':
      reply = await sendContractsFlow(chatId, ctx,
        decision.args.from ? String(decision.args.from) : null,
        decision.args.to ? String(decision.args.to) : null, 'docx');
      break;
    case 'run_shell': {
      const result = executeShell(String(decision.args.command ?? ''));
      reply = `${result.ok ? '✅' : '❌'} <b>Shell</b>\n<code>$ ${esc(String(decision.args.command))}</code>\n\n<pre>${esc(result.output)}</pre>`;
      await tgSendMessage(chatId, reply);
      await auditLog(String(chatId), ctx.employeeId, 'run_shell', { command: decision.args.command, ok: result.ok });
      break;
    }
    case 'list_files': {
      const result = listFiles(String(decision.args.path ?? '.'));
      reply = `${result.ok ? '📁' : '❌'} <b>Files</b> — <code>${esc(String(decision.args.path))}</code>\n\n${esc(result.output)}`;
      await tgSendMessage(chatId, reply);
      break;
    }
    case 'read_file': {
      const result = readFile(String(decision.args.path ?? ''));
      reply = `${result.ok ? '📄' : '❌'} <b>${esc(String(decision.args.path))}</b>\n\n<pre>${esc(result.output)}</pre>`;
      await tgSendMessage(chatId, reply);
      break;
    }
    case 'write_file': {
      const result = writeFile(String(decision.args.path ?? ''), String(decision.args.content ?? ''));
      reply = `${result.ok ? '✅' : '❌'} ${esc(result.output)}`;
      await tgSendMessage(chatId, reply);
      await auditLog(String(chatId), ctx.employeeId, 'write_file', { path: decision.args.path });
      break;
    }
    case 'save_report':
      reply = await handleSaveReport(chatId, ctx,
        decision.args.from ? String(decision.args.from) : null,
        decision.args.to ? String(decision.args.to) : null,
        String(decision.args.format ?? 'xlsx'));
      break;
    case 'clear_memory':
      clearHistory(chatId);
      reply = '🧹 Đã xóa lịch sử hội thoại.';
      await tgSendMessage(chatId, reply);
      break;
    default:
      reply = 'Xin lỗi, tôi chưa hỗ trợ yêu cầu này. Gõ /help.';
      await tgSendMessage(chatId, reply);
  }

  addMessage(chatId, 'assistant', reply.replace(/<[^>]+>/g, '').slice(0, 500));
}
