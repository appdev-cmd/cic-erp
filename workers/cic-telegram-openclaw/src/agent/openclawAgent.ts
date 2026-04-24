import { config, ollamaEnabled } from '../config.js';
import {
  auditLog, fetchContractsReport, fetchDashboard, fetchOverduePayments,
  fetchExpiringContracts, fetchMyTasks, searchContracts, fetchRevenueByMonth,
  resolveTelegramContext, type ResolvedContext,
  fetchLeaveBalance, fetchPendingLeaves, createLeaveRequest, approveLeaveRequest
} from '../supabaseClient.js';
import { contractsToDocxBuffer, leaveRequestToDocxBuffer, revenueReportToDocxBuffer } from '../export/buildDocx.js';
import { contractsToXlsxBuffer } from '../export/buildXlsx.js';
import { decideTool, getLoadedSkills, reloadSkills } from '../llm/ollamaGemma.js';
import { tgSendChatAction, tgSendDocument, tgSendMessage, tgSendMessagePlain } from '../telegramApi.js';
import { addMessage, getContextSummary, clearHistory } from '../memory/conversationMemory.js';
import { executeShell, listFiles, readFile, writeFile, saveReport } from '../tools/shellTool.js';
import { installSkill, uninstallSkill } from '../skills/skillInstaller.js';
import { formatSkillsList } from '../skills/skillLoader.js';
import { generateNaturalReply } from '../llm/naturalChat.js';
import { runErpReactAgent } from './erpReactAgent.js';

function fmtMoney(n: number | null): string {
  if (n == null || isNaN(n)) return '0';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + ' tỷ';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + ' triệu';
  return n.toLocaleString('vi-VN');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHelpHtml(): string {
  const skills = getLoadedSkills();
  const skillSection = skills.length > 0
    ? [
      '',
      '<b>🧩 OpenClaw Skills đã cài:</b>',
      ...skills.map(s => `• ${s.emoji} <b>${s.name}</b> — ${esc(s.description)}`),
    ].join('\n')
    : '';

  return [
    '<b>🤖 Trợ lý CIC ERP — OpenClaw Agent (ReAct)</b>',
    '<i>Agent nhiều bước: suy luận → gọi tool ERP → trả lời tự nhiên (Ollama)</i>',
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
    '• "xuất excel hợp đồng quý 1" → .xlsx danh sách HĐ',
    '• "lập báo cáo hợp đồng quý 1 docx" → .docx báo cáo HĐ',
    '• "thống kê hợp đồng ra pdf" → .pdf báo cáo HĐ',
    '• "tạo đơn xin nghỉ phép docx" → mẫu đơn nghỉ',
    '• "lưu báo cáo quý 1 ra excel" → ~/cic-reports/',
    '',
    '<b>💬 Hội thoại tự nhiên:</b>',
    '• Hỏi chuyện, "bạn làm được gì" → trả lời như chat (Ollama)',
    '',
    '<b>🖥️ Máy local:</b>',
    '• "chạy lệnh df -h" → terminal',
    '• "xem file ~/projects" → liệt kê thư mục',
    '',
    '<b>🧩 OpenClaw Skills:</b>',
    '/skills — xem skill đã cài',
    '/install &lt;tên&gt; — cài skill từ ClawHub',
    '/uninstall &lt;tên&gt; — gỡ skill',
    '/reload — tải lại skills',
    skillSection,
    '',
    '<b>📋 Lệnh nhanh:</b>',
    '/help /hopdong /hopdong_xlsx /hopdong_docx /hopdong_pdf',
    '',
    '💬 Hoặc hỏi bằng ngôn ngữ tự nhiên!',
  ].join('\n');
}

function parseIsoDate(s: string | undefined): string | null {
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function parseHopDongCommand(text: string): {
  from: string | null; to: string | null; format: 'table' | 'xlsx' | 'docx' | 'pdf';
} | null {
  const t = text.trim();
  let format: 'table' | 'xlsx' | 'docx' | 'pdf' = 'table';
  let rest: string;
  if (/^\/hopdong_xlsx\b/i.test(t)) { format = 'xlsx'; rest = t.replace(/^\/hopdong_xlsx\s*/i, ''); }
  else if (/^\/hopdong_docx\b/i.test(t)) { format = 'docx'; rest = t.replace(/^\/hopdong_docx\s*/i, ''); }
  else if (/^\/hopdong_pdf\b/i.test(t)) { format = 'pdf'; rest = t.replace(/^\/hopdong_pdf\s*/i, ''); }
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

async function handleExportRevenueDocx(chatId: number, ctx: ResolvedContext, year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const rows = await fetchRevenueByMonth(ctx.employeeId, y);
  if (rows.length === 0) {
    const msg = `Không có dữ liệu doanh thu năm ${y}.`;
    await tgSendMessage(chatId, msg);
    return msg;
  }
  const buf = await revenueReportToDocxBuffer(rows, `Báo cáo kết quả kinh doanh năm ${y} — ${ctx.fullName}`);
  await tgSendDocument(chatId, `bao_cao_doanh_thu_${y}.docx`, buf, `Báo cáo Doanh thu năm ${y}`);
  await auditLog(String(chatId), ctx.employeeId, 'export_revenue_docx', { year: y });
  return `Đã gửi báo cáo doanh thu năm ${y} ra file Word`;
}

async function sendContractsFlow(
  chatId: number, ctx: ResolvedContext,
  from: string | null, to: string | null, format: 'table' | 'xlsx' | 'docx' | 'pdf'
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
  if (format === 'pdf') {
    const { contractsToPdfBuffer } = await import('../export/buildPdf.js');
    const buf = await contractsToPdfBuffer(rows, `Báo cáo hợp đồng — ${ctx.fullName}`);
    await tgSendDocument(chatId, `hop_dong_${new Date().toISOString().slice(0, 10)}.pdf`, buf, `Báo cáo (${rows.length} dòng)`);
    return `Đã gửi file PDF (${rows.length} dòng)`;
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

async function handleLeaveDocx(
  chatId: number,
  ctx: ResolvedContext,
  args: Record<string, unknown>
): Promise<string> {
  const buf = await leaveRequestToDocxBuffer({
    fullName: ctx.fullName,
    fromDate: args.from ? String(args.from) : undefined,
    toDate: args.to ? String(args.to) : undefined,
    days: args.days != null ? String(args.days) : undefined,
    reason: args.reason ? String(args.reason) : undefined,
  });
  const fname = `don_xin_nghi_phep_${new Date().toISOString().slice(0, 10)}.docx`;
  await tgSendDocument(
    chatId,
    fname,
    buf,
    'Mẫu đơn xin nghỉ phép — mở Word để điền ngày và lý do cụ thể'
  );
  await auditLog(String(chatId), ctx.employeeId, 'leave_docx', {});
  return 'Đã gửi file đơn xin nghỉ phép (mẫu).';
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

// ─── Native HRM (Leave Management) ───────────────────────────────────────────

async function handleCheckLeaveBalance(chatId: number, ctx: ResolvedContext): Promise<string> {
  const currentYear = new Date().getFullYear();
  const balances = await fetchLeaveBalance(ctx.employeeId, currentYear);
  if (!balances || balances.length === 0) {
    const msg = `✅ Bạn chưa có dữ liệu ngày nghỉ phép năm ${currentYear} trên hệ thống.`;
    await tgSendMessage(chatId, msg);
    return msg;
  }
  const lines = balances.map(b =>
    `• ${b.leave_type}: Tổng ${b.total_days} ngày | Đã dùng: ${b.used_days} | Chờ duyệt: ${b.pending_days} | Còn lại: <b>${b.total_days - b.used_days - b.pending_days}</b> ngày`
  );
  const msg = `<b>🏖️ Quỹ phép năm ${currentYear} của bạn:</b>\n\n` + lines.join('\n');
  await tgSendMessage(chatId, msg);
  await auditLog(String(chatId), ctx.employeeId, 'check_leave_balance', { year: currentYear });
  return msg;
}

async function handleRequestLeave(chatId: number, ctx: ResolvedContext, args: Record<string, unknown>): Promise<string> {
  const type = String(args.type || 'annual');
  const start = String(args.start || new Date().toISOString().slice(0, 10));
  const end = String(args.end || start);
  const days = Number(args.days || 1);
  const reason = String(args.reason || 'Việc cá nhân');

  try {
    await createLeaveRequest(ctx.employeeId, ctx.unitId, type, start, end, days, reason);
    const msg = `✅ <b>Đã gửi đơn xin nghỉ phép lên hệ thống!</b>\n\n• Loại: ${esc(type)}\n• Từ: ${start}\n• Đến: ${end}\n• Số ngày: ${days}\n• Lý do: ${esc(reason)}\n\nĐơn đang ở trạng thái <i>Chờ duyệt</i>.`;
    await tgSendMessage(chatId, msg);
    await auditLog(String(chatId), ctx.employeeId, 'request_leave', { type, start, end, days });
    return msg;
  } catch (err: unknown) {
    const msg = `❌ Lỗi mở đơn: ${err instanceof Error ? err.message : String(err)}`;
    await tgSendMessage(chatId, msg);
    return msg;
  }
}

async function handleListPendingLeaves(chatId: number, ctx: ResolvedContext): Promise<string> {
  if (!ctx.unitId) {
    const msg = `❌ Bạn không thuộc bộ phận cụ thể nào để xem đơn phê duyệt.`;
    await tgSendMessage(chatId, msg);
    return msg;
  }
  const leaves = await fetchPendingLeaves(ctx.unitId);
  if (!leaves || leaves.length === 0) {
    const msg = `✅ Hiện không có đơn xin nghỉ phép nào chờ duyệt trong bộ phận của bạn.`;
    await tgSendMessage(chatId, msg);
    return msg;
  }
  const lines = leaves.map(l =>
    `🆔 <b>${l.id.slice(0, 6)}</b> | ${esc(l.employees?.name || 'Unknown')}\n🏖️ ${l.leave_type}: ${l.start_date} → ${l.end_date} (${l.total_days} ngày)\n📝 ${esc(l.reason)}`
  );
  const msg = `<b>📋 Đơn chờ duyệt bộ phận (${leaves.length}):</b>\n\n` + lines.join('\n\n') + `\n\n<i>Dùng lệnh: "Duyệt đơn mã XXX"</i>`;
  await tgSendMessage(chatId, msg);
  return msg;
}

async function handleApproveLeave(chatId: number, ctx: ResolvedContext, args: Record<string, unknown>): Promise<string> {
  const reqId = String(args.request_id || '');
  if (!reqId) {
    const msg = '❌ Vui lòng cung cấp mã đơn (ID) để duyệt.';
    await tgSendMessage(chatId, msg);
    return msg;
  }
  try {
    const ok = await approveLeaveRequest(reqId, ctx.employeeId);
    if (ok) {
      const msg = `✅ Đã duyệt đơn xin nghỉ thành công! (${esc(reqId)})`;
      await tgSendMessage(chatId, msg);
      await auditLog(String(chatId), ctx.employeeId, 'approve_leave', { request_id: reqId });
      return msg;
    } else {
      const msg = `❌ Không tìm thấy đơn chờ duyệt có mã ${esc(reqId)} hoặc bạn không có quyền.`;
      await tgSendMessage(chatId, msg);
      return msg;
    }
  } catch (err: unknown) {
    const msg = `❌ Lỗi duyệt đơn: ${err instanceof Error ? err.message : String(err)}`;
    await tgSendMessage(chatId, msg);
    return msg;
  }
}

// ─── OpenClaw Skill Executor ─────────────────────────────────────────────────

async function executeSkillInstructions(
  chatId: number,
  ctx: ResolvedContext,
  skill: { name: string; instructions: string; emoji: string },
  args: Record<string, unknown>,
  userText: string,
): Promise<string> {
  if (!ollamaEnabled) {
    const msg = `${skill.emoji} Skill <b>${esc(skill.name)}</b> cần LLM (Ollama) để chạy.`;
    await tgSendMessage(chatId, msg);
    return msg;
  }

  const skillPrompt = `Bạn đang chạy OpenClaw skill "${skill.name}".
${skill.instructions}

Dựa trên instruction trên, hãy trả lời yêu cầu user. Trả lời bằng tiếng Việt, rõ ràng.
Context: user=${ctx.fullName}, role=${ctx.role}
User args: ${JSON.stringify(args)}
User message: ${userText}

Trả lời trực tiếp nội dung (KHÔNG wrap JSON).`;

  try {
    const url = `${config.ollamaHost}/api/chat`;
    const body = {
      model: config.ollamaModel,
      messages: [
        { role: 'system', content: skillPrompt },
        { role: 'user', content: userText.slice(0, 2000) },
      ],
      stream: false,
      options: { temperature: 0.3, num_predict: 1000 },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data = (await res.json()) as { message?: { content?: string } };
    const answer = data.message?.content?.trim() ?? '';

    if (!answer) {
      const msg = `${skill.emoji} Skill <b>${esc(skill.name)}</b> không có kết quả.`;
      await tgSendMessage(chatId, msg);
      return msg;
    }

    const msg = `${skill.emoji} <b>${esc(skill.name)}</b>\n\n${answer.slice(0, 3500)}`;
    await tgSendMessage(chatId, msg);
    return msg;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const msg = `❌ Lỗi chạy skill "${esc(skill.name)}": ${esc(errMsg.slice(0, 200))}`;
    await tgSendMessage(chatId, msg);
    return msg;
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function openclawHandleMessage(chatId: number, text: string): Promise<void> {
  const ctx = await resolveTelegramContext(String(chatId));
  if (!ctx.ok) {
    await tgSendMessage(chatId, ctx.errorMessage ?? 'Không thể xác thực tài khoản Telegram trên ERP.');
    await auditLog(String(chatId), null, 'resolve_failed', { error: ctx.errorMessage });
    return;
  }

  // --- BẢO MẬT & PHÂN QUYỀN ĐÃ ĐƯỢC XỬ LÝ Ở TẦNG DB (telegram_bot_resolve_context) ---
  // Any employee with telegram_verified = true (ctx.ok === true) is allowed to chat.
  // Data access is naturally scoped by ctx.role and ctx.unitId inside the individual tools.

  await addMessage(chatId, 'user', text);
  const t = text.trim().toLowerCase();

  // ── OpenClaw Skill Commands ───────────────────────────────
  if (t === '/help' || t === '/start' || t === 'help') {
    await tgSendMessage(chatId, buildHelpHtml());
    await addMessage(chatId, 'assistant', 'Đã gửi hướng dẫn');
    await auditLog(String(chatId), ctx.employeeId, 'help', {});
    return;
  }

  if (t === '/skills') {
    const skills = getLoadedSkills();
    const msg = `<b>🧩 OpenClaw Skills (${skills.length})</b>\n\n` + formatSkillsList(skills);
    await tgSendMessage(chatId, msg);
    await addMessage(chatId, 'assistant', `Listed ${skills.length} skills`);
    return;
  }

  if (t.startsWith('/install ')) {
    const name = text.trim().slice(9).trim();
    const r = installSkill(name);
    const emoji = r.ok ? '✅' : '❌';
    if (r.ok) reloadSkills();
    await tgSendMessage(chatId, `${emoji} ${esc(r.message)}`);
    await addMessage(chatId, 'assistant', r.message);
    await auditLog(String(chatId), ctx.employeeId, 'install_skill', { name, ok: r.ok });
    return;
  }

  if (t.startsWith('/uninstall ')) {
    const name = text.trim().slice(11).trim();
    const r = uninstallSkill(name);
    const emoji = r.ok ? '✅' : '❌';
    if (r.ok) reloadSkills();
    await tgSendMessage(chatId, `${emoji} ${esc(r.message)}`);
    await addMessage(chatId, 'assistant', r.message);
    await auditLog(String(chatId), ctx.employeeId, 'uninstall_skill', { name, ok: r.ok });
    return;
  }

  if (t === '/reload') {
    const skills = reloadSkills();
    const msg = `🔄 Đã tải lại skills. Hiện có <b>${skills.length}</b> skill.`;
    await tgSendMessage(chatId, msg);
    await addMessage(chatId, 'assistant', msg);
    return;
  }

  const hop = parseHopDongCommand(text);
  if (hop) {
    const reply = await sendContractsFlow(chatId, ctx, hop.from, hop.to, hop.format);
    await addMessage(chatId, 'assistant', reply);
    return;
  }

  if (!ollamaEnabled) {
    await tgSendMessage(chatId, 'Lệnh không hợp lệ. Gõ /help.');
    return;
  }

  void tgSendChatAction(chatId, 'typing');

  const conversationContext = await getContextSummary(chatId);
  const ctxLines = [
    `Người dùng: ${ctx.fullName}`,
    `Vai trò: ${ctx.role}`,
    `Đơn vị: ${ctx.unitId ?? '-'}`,
    `Ngày: ${new Date().toISOString().slice(0, 10)}`,
    ...(conversationContext ? [`Hội thoại gần đây:\n${conversationContext}`] : []),
  ];

  if (config.reactAgentEnabled) {
    try {
      const react = await runErpReactAgent({
        chatId,
        userText: text,
        ctx,
        ctxLines,
      });
      if (react?.reply) {
        await tgSendMessagePlain(chatId, react.reply);
        await addMessage(chatId, 'assistant', react.reply.slice(0, 500));
        await auditLog(String(chatId), ctx.employeeId, 'react_agent', {
          steps: react.steps,
          tools: react.usedTools,
        });
        return;
      }
    } catch (err: unknown) {
      const natural = await generateNaturalReply(
        text,
        ctxLines.concat(`Lỗi agent: ${err instanceof Error ? err.message : String(err)}`)
      );
      if (natural) {
        await tgSendMessagePlain(chatId, natural.slice(0, 4090));
        await addMessage(chatId, 'assistant', natural.slice(0, 500));
        await auditLog(String(chatId), ctx.employeeId, 'react_agent_error', {
          err: String(err instanceof Error ? err.message : err),
        });
        return;
      }
      await tgSendMessage(
        chatId,
        'Đã xảy ra lỗi xử lý. Vui lòng thử lại sau hoặc liên hệ IT. Gõ /help để xem lệnh cố định.'
      );
      await addMessage(chatId, 'assistant', 'lỗi xử lý agent');
      return;
    }
  }

  let decision = await decideTool(text, ctxLines);

  if (
    decision &&
    (decision.tool === 'export_docx' || decision.tool === 'export_xlsx') &&
    /ngh[ỉi]\s*ph[ée]p|xin\s*ngh[ỉi]|đơn\s*xin\s*ngh[ỉi]|gi[ấa]y\s*xin\s*ngh[ỉi]/i.test(text)
  ) {
    decision = { tool: 'leave_docx', args: {} };
  }

  if (!decision) {
    const natural = await generateNaturalReply(text, ctxLines);
    if (natural) {
      await tgSendMessagePlain(chatId, natural.slice(0, 4090));
      await addMessage(chatId, 'assistant', natural.slice(0, 500));
      await auditLog(String(chatId), ctx.employeeId, 'natural_fallback', {});
      return;
    }
    const msg = 'Xin lỗi, tôi chưa hiểu. Gõ /help để xem những gì tôi có thể giúp.';
    await tgSendMessage(chatId, msg);
    await addMessage(chatId, 'assistant', msg);
    return;
  }

  let reply = '';

  switch (decision.tool) {
    case 'natural_chat': {
      const natural = await generateNaturalReply(text, ctxLines);
      if (natural) {
        await tgSendMessagePlain(chatId, natural.slice(0, 4090));
        reply = natural.slice(0, 500);
        await auditLog(String(chatId), ctx.employeeId, 'natural_chat', {});
      } else {
        await tgSendMessage(chatId, buildHelpHtml());
        reply = 'Đã gửi hướng dẫn (LLM không phản hồi).';
        await auditLog(String(chatId), ctx.employeeId, 'natural_chat_fallback_help', {});
      }
      break;
    }
    case 'chat':
      reply = String(decision.args.message ?? 'Xin chào! Gõ /help để xem hướng dẫn.');
      await tgSendMessagePlain(chatId, reply);
      await auditLog(String(chatId), ctx.employeeId, 'chat', {});
      break;
    case 'help':
      await tgSendMessage(chatId, buildHelpHtml());
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
    case 'export_revenue_docx':
      reply = await handleExportRevenueDocx(chatId, ctx, decision.args.year ? Number(decision.args.year) : undefined);
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
    case 'export_pdf':
      reply = await sendContractsFlow(chatId, ctx,
        decision.args.from ? String(decision.args.from) : null,
        decision.args.to ? String(decision.args.to) : null, 'pdf');
      break;
    case 'leave_docx':
      reply = await handleLeaveDocx(chatId, ctx, decision.args);
      break;
    case 'request_leave':
      reply = await handleRequestLeave(chatId, ctx, decision.args);
      break;
    case 'check_leave_balance':
      reply = await handleCheckLeaveBalance(chatId, ctx);
      break;
    case 'list_pending_leaves':
      reply = await handleListPendingLeaves(chatId, ctx);
      break;
    case 'approve_leave':
      reply = await handleApproveLeave(chatId, ctx, decision.args);
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
    case 'run_skill': {
      const skillName = String(decision.args.skill ?? '');
      const skills = getLoadedSkills();
      const skill = skills.find(s => s.name === skillName);
      if (!skill) {
        reply = `❌ Skill "${esc(skillName)}" chưa cài. Dùng /skills để xem hoặc /install ${esc(skillName)}.`;
        await tgSendMessage(chatId, reply);
        break;
      }
      reply = await executeSkillInstructions(chatId, ctx, skill, decision.args, text);
      await auditLog(String(chatId), ctx.employeeId, 'run_skill', { skill: skillName });
      break;
    }
    default:
      reply = 'Xin lỗi, tôi chưa hỗ trợ yêu cầu này. Gõ /help.';
      await tgSendMessage(chatId, reply);
  }

  await addMessage(chatId, 'assistant', reply.replace(/<[^>]+>/g, '').slice(0, 500));
}
