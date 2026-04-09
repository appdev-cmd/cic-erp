/**
 * Thực thi tool cho agent ReAct — trả về chuỗi kết quả (JSON/text) cho LLM tổng hợp.
 * Tool xuất file gọi Telegram API trực tiếp, sau đó trả mô tả ngắn.
 */
import { config } from '../config.js';
import type { ResolvedContext } from '../supabaseClient.js';
import {
  fetchContractsReport,
  fetchDashboard,
  fetchExpiringContracts,
  fetchMyTasks,
  fetchOverduePayments,
  fetchRevenueByMonth,
  searchContracts,
} from '../supabaseClient.js';
import { contractsToDocxBuffer, leaveRequestToDocxBuffer } from '../export/buildDocx.js';
import { contractsToXlsxBuffer } from '../export/buildXlsx.js';
import { tgSendDocument } from '../telegramApi.js';
import { executeShell, listFiles, readFile, writeFile, saveReport } from '../tools/shellTool.js';
import { clearHistory } from '../memory/conversationMemory.js';

function fmtMoney(n: number | null): string {
  if (n == null || isNaN(n)) return '0';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + ' tỷ';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + ' triệu';
  return n.toLocaleString('vi-VN');
}

const VALID_AGENT_TOOLS = new Set([
  'dashboard',
  'list_contracts',
  'search_contracts',
  'overdue_payments',
  'expiring_contracts',
  'my_tasks',
  'revenue_report',
  'export_xlsx',
  'export_docx',
  'leave_docx',
  'save_report',
  'run_shell',
  'list_files',
  'read_file',
  'write_file',
  'clear_memory',
  'help',
]);

export function isValidAgentTool(name: string): boolean {
  return VALID_AGENT_TOOLS.has(name);
}

export async function executeErpTool(
  chatId: number,
  ctx: ResolvedContext,
  tool: string,
  args: Record<string, unknown>
): Promise<string> {
  if (!isValidAgentTool(tool)) {
    return JSON.stringify({ error: `Tool không hợp lệ: ${tool}`, hint: [...VALID_AGENT_TOOLS].join(', ') });
  }

  const from = args.from != null && String(args.from).trim() ? String(args.from) : null;
  const to = args.to != null && String(args.to).trim() ? String(args.to) : null;
  const cap = config.reportRowCap;

  try {
    switch (tool) {
      case 'dashboard': {
        const d = await fetchDashboard(ctx.employeeId);
        return JSON.stringify({
          ok: true,
          total_contracts: d.total_contracts,
          active_contracts: d.active_contracts,
          total_value_fmt: fmtMoney(d.total_value),
          total_receivables_fmt: fmtMoney(d.total_receivables),
          total_cash_received_fmt: fmtMoney(d.total_cash_received),
          overdue_payments_count: d.overdue_payments,
          pending_tasks: d.pending_tasks,
          my_tasks_count: d.my_tasks,
        });
      }
      case 'list_contracts': {
        const rows = await fetchContractsReport(ctx.employeeId, from, to, Math.min(cap, 80));
        const sample = rows.slice(0, 25).map((r) => ({
          code: r.contract_code,
          title: (r.title ?? '').slice(0, 80),
          status: r.status,
          signed: r.signed_date,
          value_fmt: fmtMoney(r.value_numeric),
        }));
        return JSON.stringify({
          ok: true,
          count: rows.length,
          sample,
          note: rows.length > 25 ? `Chỉ liệt kê 25/${rows.length} dòng trong kết quả tool.` : null,
        });
      }
      case 'search_contracts': {
        const kw = String(args.keyword ?? '').trim();
        if (kw.length < 2) return JSON.stringify({ ok: false, error: 'keyword quá ngắn' });
        const rows = await searchContracts(ctx.employeeId, kw);
        return JSON.stringify({
          ok: true,
          keyword: kw,
          count: rows.length,
          results: rows.slice(0, 20).map((r) => ({
            code: r.contract_code,
            title: (r.title ?? '').slice(0, 100),
            customer: r.customer_name,
            status: r.status,
            value_fmt: fmtMoney(r.value),
          })),
        });
      }
      case 'overdue_payments': {
        const rows = await fetchOverduePayments(ctx.employeeId);
        return JSON.stringify({
          ok: true,
          count: rows.length,
          items: rows.slice(0, 25).map((r) => ({
            contract_code: r.contract_code,
            customer: r.customer_name,
            amount_fmt: fmtMoney(r.amount),
            due_date: r.due_date,
            days_overdue: r.days_overdue,
          })),
        });
      }
      case 'expiring_contracts': {
        const days = Number(args.days) || 30;
        const rows = await fetchExpiringContracts(ctx.employeeId, days);
        return JSON.stringify({
          ok: true,
          within_days: days,
          count: rows.length,
          items: rows.slice(0, 25).map((r) => ({
            code: r.contract_code,
            customer: r.customer_name,
            end_date: r.end_date,
            days_remaining: r.days_remaining,
            value_fmt: fmtMoney(r.value),
          })),
        });
      }
      case 'my_tasks': {
        const rows = await fetchMyTasks(ctx.employeeId);
        return JSON.stringify({
          ok: true,
          count: rows.length,
          tasks: rows.slice(0, 30).map((r) => ({
            title: r.title,
            priority: r.priority,
            status: r.status_name,
            due: r.due_date,
            project: r.project_name,
          })),
        });
      }
      case 'revenue_report': {
        const year = args.year != null ? Number(args.year) : undefined;
        const quarter = args.quarter != null ? Number(args.quarter) : undefined;
        let rows = await fetchRevenueByMonth(ctx.employeeId, year);
        if (quarter && quarter >= 1 && quarter <= 4) {
          rows = rows.filter(r => {
             const mMatch = r.month_label.match(/-(\d+)/);
             if (mMatch) {
                const m = parseInt(mMatch[1], 10);
                return Math.ceil(m / 3) === quarter;
             }
             return true; // fallback
          });
        }
        return JSON.stringify({
          ok: true,
          year: year ?? 'current',
          quarter: quarter ?? 'all',
          months: rows.map((r) => ({
            label: r.month_label,
            contracts: r.contract_count,
            value_fmt: fmtMoney(Number(r.total_value)),
            revenue_fmt: fmtMoney(Number(r.total_revenue)),
          })),
        });
      }
      case 'export_xlsx': {
        const rows = await fetchContractsReport(ctx.employeeId, from, to, cap);
        if (rows.length === 0) return JSON.stringify({ ok: false, error: 'Không có hợp đồng trong phạm vi.' });
        const buf = contractsToXlsxBuffer(rows);
        const fn = `hop_dong_${new Date().toISOString().slice(0, 10)}.xlsx`;
        await tgSendDocument(chatId, fn, buf, `Báo cáo HĐ (${rows.length} dòng)`);
        return JSON.stringify({
          ok: true,
          sent: 'xlsx',
          filename: fn,
          rows: rows.length,
          note: 'File đã gửi trong Telegram.',
        });
      }
      case 'export_docx': {
        const rows = await fetchContractsReport(ctx.employeeId, from, to, cap);
        if (rows.length === 0) return JSON.stringify({ ok: false, error: 'Không có hợp đồng trong phạm vi.' });
        const buf = await contractsToDocxBuffer(rows, `Báo cáo hợp đồng — ${ctx.fullName}`);
        const fn = `hop_dong_${new Date().toISOString().slice(0, 10)}.docx`;
        await tgSendDocument(chatId, fn, buf, `Báo cáo HĐ (${rows.length} dòng)`);
        return JSON.stringify({
          ok: true,
          sent: 'docx',
          filename: fn,
          rows: rows.length,
          note: 'File đã gửi trong Telegram.',
        });
      }
      case 'leave_docx': {
        const buf = await leaveRequestToDocxBuffer({
          fullName: ctx.fullName,
          fromDate: args.from ? String(args.from) : undefined,
          toDate: args.to ? String(args.to) : undefined,
          days: args.days != null ? String(args.days) : undefined,
          reason: args.reason ? String(args.reason) : undefined,
        });
        const fn = `don_xin_nghi_phep_${new Date().toISOString().slice(0, 10)}.docx`;
        await tgSendDocument(
          chatId,
          fn,
          buf,
          'Mẫu đơn xin nghỉ phép — chỉnh sửa trong Word'
        );
        return JSON.stringify({
          ok: true,
          sent: 'leave_docx',
          filename: fn,
          note: 'Đã gửi mẫu đơn xin nghỉ phép (không phải báo cáo hợp đồng).',
        });
      }
      case 'save_report': {
        const rows = await fetchContractsReport(ctx.employeeId, from, to, cap);
        if (rows.length === 0) return JSON.stringify({ ok: false, error: 'Không có dữ liệu.' });
        const fmt = String(args.format ?? 'xlsx').toLowerCase() === 'docx' ? 'docx' : 'xlsx';
        let buf: Buffer;
        let filename: string;
        if (fmt === 'xlsx') {
          buf = contractsToXlsxBuffer(rows);
          filename = `hop_dong_${new Date().toISOString().slice(0, 10)}.xlsx`;
        } else {
          buf = await contractsToDocxBuffer(rows, `Báo cáo — ${ctx.fullName}`);
          filename = `hop_dong_${new Date().toISOString().slice(0, 10)}.docx`;
        }
        const savedPath = saveReport(filename, buf);
        await tgSendDocument(chatId, filename, buf, `${rows.length} dòng`);
        return JSON.stringify({
          ok: true,
          saved_path: savedPath,
          rows: rows.length,
          format: fmt,
          note: 'Đã lưu máy local và gửi kèm Telegram.',
        });
      }
      case 'run_shell': {
        const cmd = String(args.command ?? '');
        const result = executeShell(cmd);
        return JSON.stringify({
          ok: result.ok,
          command: cmd,
          output: result.output.slice(0, 8000),
        });
      }
      case 'list_files': {
        const p = String(args.path ?? '.');
        const result = listFiles(p);
        return JSON.stringify({ ok: result.ok, path: p, output: result.output.slice(0, 6000) });
      }
      case 'read_file': {
        const p = String(args.path ?? '');
        const result = readFile(p);
        return JSON.stringify({
          ok: result.ok,
          path: p,
          output: result.output.slice(0, 8000),
        });
      }
      case 'write_file': {
        const p = String(args.path ?? '');
        const content = String(args.content ?? '');
        const result = writeFile(p, content);
        return JSON.stringify({ ok: result.ok, message: result.output });
      }
      case 'clear_memory': {
        clearHistory(chatId);
        return JSON.stringify({ ok: true, note: 'Đã xóa lịch sử hội thoại trong phiên bot.' });
      }
      case 'help': {
        return JSON.stringify({
          ok: true,
          capabilities: [
            'Tổng quan ERP: dashboard',
            'Hợp đồng: list_contracts, search_contracts, export_xlsx/docx, save_report',
            'Tài chính: overdue_payments, revenue_report',
            'HĐ sắp hết hạn: expiring_contracts',
            'Task: my_tasks',
            'Đơn nghỉ phép Word: leave_docx (không phải báo cáo HĐ)',
            'Máy local: run_shell, list_files, read_file, write_file',
            'Lệnh Telegram: /help, /hopdong, /skills',
          ],
        });
      }
      default:
        return JSON.stringify({ error: 'Tool chưa triển khai' });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return JSON.stringify({ ok: false, error: msg.slice(0, 500) });
  }
}
