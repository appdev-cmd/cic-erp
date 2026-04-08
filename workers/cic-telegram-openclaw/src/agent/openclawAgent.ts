/**
 * OpenClaw-style agent: điều phối resolve user → (lệnh cứng | Gemma/Ollama) → tools → Telegram.
 */
import { config } from '../config.js';
import {
  auditLog,
  fetchContractsReport,
  resolveTelegramContext,
  type ResolvedContext,
} from '../supabaseClient.js';
import { contractsToDocxBuffer } from '../export/buildDocx.js';
import { contractsToXlsxBuffer } from '../export/buildXlsx.js';
import { decideTool } from '../llm/ollamaGemma.js';
import { tgSendDocument, tgSendMessage } from '../telegramApi.js';

const HELP_HTML = [
  '<b>Trợ lý CIC ERP</b>',
  '',
  '/help — hướng dẫn',
  '/hopdong — danh sách hợp đồng (mặc định không lọc ngày, tối đa ' + config.reportRowCap + ' dòng)',
  '/hopdong 2026-01-01 2026-03-31',
  '/hopdong_xlsx — xuất Excel',
  '/hopdong_docx — xuất Word',
  '',
  ollamaEnabledText(),
].join('\n');

function ollamaEnabledText(): string {
  return config.ollamaHost
    ? 'Gemma/Ollama: đã bật — có thể hỏi tự nhiên (vd: "cho xem hợp đồng quý 1").'
    : 'Gemma/Ollama: tắt — chỉ lệnh /... (set OLLAMA_HOST + OLLAMA_MODEL để bật).';
}

function parseIsoDate(s: string | undefined): string | null {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

/** /hopdong | /hopdong_xlsx | /hopdong_docx [from] [to] */
function parseHopDongCommand(text: string): {
  from: string | null;
  to: string | null;
  format: 'table' | 'xlsx' | 'docx';
} | null {
  const t = text.trim();
  let format: 'table' | 'xlsx' | 'docx' = 'table';
  let rest: string;
  if (/^\/hopdong_xlsx\b/i.test(t)) {
    format = 'xlsx';
    rest = t.replace(/^\/hopdong_xlsx\s*/i, '');
  } else if (/^\/hopdong_docx\b/i.test(t)) {
    format = 'docx';
    rest = t.replace(/^\/hopdong_docx\s*/i, '');
  } else if (/^\/hopdong\b/i.test(t)) {
    rest = t.replace(/^\/hopdong\s*/i, '');
  } else {
    return null;
  }
  const parts = rest.trim().split(/\s+/).filter(Boolean);
  const from = parseIsoDate(parts[0]) ?? null;
  const to = parseIsoDate(parts[1]) ?? null;
  return { from, to, format };
}

function isHelpCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === '/help' || t === '/start' || t === 'help';
}

async function sendContractsFlow(
  chatId: number,
  ctx: ResolvedContext,
  from: string | null,
  to: string | null,
  format: 'table' | 'xlsx' | 'docx'
): Promise<void> {
  const rows = await fetchContractsReport(ctx.employeeId, from, to, config.reportRowCap);
  await auditLog(String(chatId), ctx.employeeId, 'list_contracts', {
    from,
    to,
    format,
    rowCount: rows.length,
  });

  if (rows.length === 0) {
    await tgSendMessage(chatId, 'Không có hợp đồng trong phạm vi lọc.');
    return;
  }

  if (format === 'xlsx') {
    const buf = contractsToXlsxBuffer(rows);
    await tgSendDocument(
      chatId,
      `hop_dong_${new Date().toISOString().slice(0, 10)}.xlsx`,
      buf,
      `Báo cáo hợp đồng (${rows.length} dòng)`
    );
    return;
  }

  if (format === 'docx') {
    const buf = await contractsToDocxBuffer(
      rows,
      `Báo cáo hợp đồng — ${ctx.fullName}`
    );
    await tgSendDocument(
      chatId,
      `hop_dong_${new Date().toISOString().slice(0, 10)}.docx`,
      buf,
      `Báo cáo (${rows.length} dòng)`
    );
    return;
  }

  const head = rows.slice(0, 30);
  const lines = head.map(
    (r) =>
      `• <b>${escapeHtml(r.contract_code)}</b> ${escapeHtml(r.title.slice(0, 60))} | ${escapeHtml(r.status)} | ${r.signed_date ?? '-'}`
  );
  const more = rows.length > 30 ? `\n… và ${rows.length - 30} dòng khác. Dùng /hopdong_xlsx để tải đủ.` : '';
  await tgSendMessage(
    chatId,
    `<b>${rows.length}</b> hợp đồng:\n` + lines.join('\n') + more
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function openclawHandleMessage(chatId: number, text: string): Promise<void> {
  const ctx = await resolveTelegramContext(String(chatId));
  if (!ctx.ok) {
    await tgSendMessage(chatId, ctx.errorMessage ?? 'Không thể xác thực tài khoản Telegram trên ERP.');
    await auditLog(String(chatId), null, 'resolve_failed', { error: ctx.errorMessage });
    return;
  }

  if (isHelpCommand(text)) {
    await tgSendMessage(chatId, HELP_HTML);
    await auditLog(String(chatId), ctx.employeeId, 'help', {});
    return;
  }

  const hop = parseHopDongCommand(text);
  if (hop) {
    await sendContractsFlow(chatId, ctx, hop.from, hop.to, hop.format);
    return;
  }

  const decision = await decideTool(text, [
    `Người dùng ERP: ${ctx.fullName}`,
    `Vai trò: ${ctx.role}`,
    `Đơn vị: ${ctx.unitId ?? '-'}`,
  ]);

  if (decision?.tool === 'help') {
    await tgSendMessage(chatId, HELP_HTML);
    await auditLog(String(chatId), ctx.employeeId, 'llm_help', {});
    return;
  }

  if (decision?.tool === 'list_contracts') {
    const from = (decision.args.from as string | null) ?? null;
    const to = (decision.args.to as string | null) ?? null;
    await sendContractsFlow(chatId, ctx, from, to, 'table');
    return;
  }

  if (config.ollamaHost) {
    await tgSendMessage(
      chatId,
      'Không hiểu yêu cầu. Gõ /help hoặc thử câu rõ hơn (vd: "danh sách hợp đồng").'
    );
  } else {
    await tgSendMessage(
      chatId,
      'Lệnh không hợp lệ. Gõ /help. (Hoặc cấu hình OLLAMA_HOST để hỏi tự nhiên.)'
    );
  }
}
