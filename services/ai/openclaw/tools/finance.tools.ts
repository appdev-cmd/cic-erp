// @ts-nocheck
import { ContractService } from '../../../contractService';
import { CustomerService } from '../../../customerService';
import { PaymentService } from '../../../paymentService';
import { UnitService } from '../../../unitService';
import { ProductService } from '../../../productService';
import type { OpenClawTool, UserContext } from '../types';
import { dataClient as supabase } from '../../../../lib/dataClient';
import { fmtMoney, fmtMoneyWithRaw, calcChange, canViewAll, isBusinessUnit, getUnitFilter } from './_helpers';
import { EmployeeService } from '../../../employeeService';
import { TaskService } from '../../../taskService';
import { NotificationService } from '../../../notificationService';
import { marketingToolsRegistry } from './marketingTools';
import type { OpenClawTool, UserContext } from '../types';
import { dataClient as supabase } from '../../../../lib/dataClient';
import { fmtMoney, fmtMoneyWithRaw, calcChange, canViewAll, isBusinessUnit, getUnitFilter } from './_helpers';

// ═══════════════════════════════════════════════
// searchPaymentsTool
// ═══════════════════════════════════════════════

export const searchPaymentsTool: OpenClawTool = {
  name: 'search_payments',
  description: 'Tra cứu phiếu thu/chi, hóa đơn VAT. Lọc theo loại chứng từ, đơn vị, năm. Hữu ích khi user hỏi "tiền về", "công nợ", "VAT", "chi phí".',
  schema: {
    search: { type: 'string', description: 'Từ khóa (số HĐ, khách hàng, số chứng từ)' },
    voucherType: { type: 'string', description: 'Loại chứng từ', enum: ['RECEIPT', 'VAT_INVOICE', 'EXPENSE'] },
    year: { type: 'string', description: 'Năm (vd: 2026)' },
  },
  execute: async (args, context: UserContext) => {
    // Phân quyền: unit-scoped thì chỉ xem đơn vị mình
    let unitIds: string[] | 'all' = 'all';
    if (!canViewAll(context) && context.unitId) {
      unitIds = [context.unitId];
    }

    const res = await PaymentService.list({
      page: 1,
      limit: 10,
      search: args.search || undefined,
      voucherType: args.voucherType || undefined,
      unitIds: unitIds,
      year: args.year || undefined,
    });

    return res.data.map(p => ({
      id: p.id,
      soTien: fmtMoney(p.amount || 0),
      loai: p.voucherType,
      trangThai: p.status,
      ngay: p.paymentDate || p.dueDate || '—',
      soChungTu: p.invoiceNumber || p.reference || '—',
      khachHang: (p as any).customerName || '—',
      maHopDong: (p as any).contractCode || '—',
    }));
  }
};

// ═══════════════════════════════════════════════
// getDebtReportTool
// ═══════════════════════════════════════════════

export const getDebtReportTool: OpenClawTool = {
  name: 'get_debt_report',
  description: 'Tổng hợp công nợ: Khách hàng nào đang nợ, tổng nợ bao nhiêu, khoản nợ lớn nhất. Dùng khi user hỏi "công nợ", "ai đang nợ", "thu hồi nợ".',
  schema: {
    sortBy: { type: 'string', enum: ['amount', 'age'], description: 'Sắp xếp: amount (số tiền nợ lớn nhất), age (nợ lâu nhất)' },
  },
  execute: async (args) => {
    // Lấy tất cả payment pending/chưa thanh toán + join customer qua contract
    const { data: payments } = await supabase
      .from('payments')
      .select('id, amount, paid_amount, due_date, status, contract_id, contracts(title, customer_contract_number, customer_id, customers(name))')
      .in('status', ['Chưa thanh toán', 'Pending', 'Chờ thanh toán', 'Đã xuất HĐ', 'Đã giao KH'])
      .order('due_date');

    if (!payments || payments.length === 0) {
      return { tongCongNo: '0 VND', message: 'Không có khoản công nợ nào.' };
    }

    // Group by customer
    const customerDebt: Record<string, { name: string; total: number; count: number; oldest: string }> = {};
    let totalDebt = 0;

    for (const p of payments) {
      const contract = (p as any).contracts;
      const customer = contract?.customers;
      const custName = customer?.name || 'Không xác định';
      const custId = contract?.customer_id || 'unknown';
      const owing = (p.amount || 0) - (p.paid_amount || 0);
      if (owing <= 0) continue;

      totalDebt += owing;
      if (!customerDebt[custId]) {
        customerDebt[custId] = { name: custName, total: 0, count: 0, oldest: p.due_date || '' };
      }
      customerDebt[custId].total += owing;
      customerDebt[custId].count++;
      if (p.due_date && p.due_date < customerDebt[custId].oldest) {
        customerDebt[custId].oldest = p.due_date;
      }
    }

    const sorted = Object.entries(customerDebt)
      .map(([id, v]) => ({ khachHang: v.name, tongNo: fmtMoney(v.total), soKhoan: v.count, noTuNgay: v.oldest, khachHangId: id }))
      .sort((a, b) => args.sortBy === 'age' ? (a.noTuNgay < b.noTuNgay ? -1 : 1) : 0);

    // Sort by amount desc by default
    if (args.sortBy !== 'age') {
      sorted.sort((a, b) => {
        const aVal = Object.values(customerDebt).find(v => v.name === a.khachHang)?.total || 0;
        const bVal = Object.values(customerDebt).find(v => v.name === b.khachHang)?.total || 0;
        return bVal - aVal;
      });
    }

    return {
      tongCongNo: fmtMoney(totalDebt),
      soKhachHangNo: Object.keys(customerDebt).length,
      chiTiet: sorted.slice(0, 15),
    };
  }
};

// ═══════════════════════════════════════════════
// getCashflowSummaryTool
// ═══════════════════════════════════════════════

export const getCashflowSummaryTool: OpenClawTool = {
  name: 'get_cashflow_summary',
  description: 'Tổng hợp dòng tiền: thu vào vs chi ra theo kỳ (tháng/quý/năm). Dùng khi user hỏi "dòng tiền", "cash flow", "tiền vào tiền ra", "thu chi".',
  schema: {
    year: { type: 'string', description: 'Năm (vd: 2026)' },
    period: { type: 'string', enum: ['monthly', 'quarterly'], description: 'Chu kỳ: monthly hoặc quarterly. Mặc định: quarterly' },
  },
  execute: async (args) => {
    const year = parseInt(args.year) || new Date().getFullYear();
    const dateFrom = `${year}-01-01`;
    const dateTo = `${year}-12-31`;

    const { data: payments } = await supabase
      .from('payments')
      .select('amount, payment_date, voucher_type, status')
      .gte('payment_date', dateFrom)
      .lte('payment_date', dateTo)
      .in('status', ['Tiền về', 'Paid', 'Đã thanh toán', 'Đã xuất HĐ', 'Đã giao KH']);

    if (!payments || payments.length === 0) {
      return { nam: year, message: 'Không có dữ liệu thanh toán.' };
    }

    const isQuarterly = args.period !== 'monthly';
    const periods: Record<string, { thu: number; chi: number }> = {};

    for (const p of payments) {
      if (!p.payment_date) continue;
      const d = new Date(p.payment_date);
      const month = d.getMonth() + 1;
      const key = isQuarterly ? `Q${Math.ceil(month / 3)}` : `T${month}`;
      if (!periods[key]) periods[key] = { thu: 0, chi: 0 };

      if (p.voucher_type === 'RECEIPT' || p.voucher_type === 'VAT_INVOICE') {
        periods[key].thu += (p.amount || 0);
      } else if (p.voucher_type === 'EXPENSE') {
        periods[key].chi += (p.amount || 0);
      }
    }

    const rows = Object.entries(periods).map(([ky, v]) => ({
      ky,
      thuVao: fmtMoney(v.thu),
      chiRa: fmtMoney(v.chi),
      chenh: fmtMoney(v.thu - v.chi),
    }));

    const totalThu = Object.values(periods).reduce((s, v) => s + v.thu, 0);
    const totalChi = Object.values(periods).reduce((s, v) => s + v.chi, 0);

    return {
      nam: year,
      chuKy: isQuarterly ? 'Theo quý' : 'Theo tháng',
      chiTiet: rows,
      tongHop: {
        tongThuVao: fmtMoney(totalThu),
        tongChiRa: fmtMoney(totalChi),
        chenh: fmtMoney(totalThu - totalChi),
      },
    };
  }
};

// ═══════════════════════════════════════════════
// getRevenueForecastTool
// ═══════════════════════════════════════════════

export const getRevenueForecastTool: OpenClawTool = {
  name: 'get_revenue_forecast',
  description: 'Dự báo doanh thu dựa trên pipeline HĐ đang xử lý. Phân theo xác suất cao/trung bình/thấp + biểu đồ. Dùng khi user hỏi "dự báo", "forecast", "pipeline doanh thu".',
  schema: {
    year: { type: 'string', description: 'Năm (vd: 2026)' },
  },
  execute: async (args) => {
    const year = parseInt(args.year) || new Date().getFullYear();
    const today = new Date().toISOString().split('T')[0];

    const { data: contracts } = await supabase
      .from('contracts')
      .select('id, title, value, actual_revenue, status, end_date, signed_date, unit_id, units(name)')
      .eq('status', 'Processing')
      .order('value', { ascending: false })
      .limit(50);

    if (!contracts || contracts.length === 0) {
      return `Không có HĐ đang xử lý. Dự báo doanh thu = 0.`;
    }

    // Phân loại xác suất dựa trên tiến độ thực hiện
    const tiers = { high: [] as any[], medium: [] as any[], low: [] as any[] };

    for (const c of contracts as any[]) {
      const val = c.value || 0;
      const rev = c.actual_revenue || 0;
      const remaining = Math.max(val - rev, 0);
      const progress = val > 0 ? (rev / val) * 100 : 0;

      const item = {
        title: c.title?.substring(0, 40),
        value: val,
        revenue: rev,
        remaining,
        unit: c.units?.name || '—',
        endDate: c.end_date || '—',
        progress: progress.toFixed(0) + '%',
      };

      // Xếp hạng: đã thực hiện > 50% = cao, 10-50% = TB, < 10% = thấp
      if (progress >= 50) {
        tiers.high.push(item);
      } else if (progress >= 10) {
        tiers.medium.push(item);
      } else {
        tiers.low.push(item);
      }
    }

    const sumRemaining = (arr: any[]) => arr.reduce((s, i) => s + i.remaining, 0);
    const highRev = sumRemaining(tiers.high);
    const medRev = sumRemaining(tiers.medium);
    const lowRev = sumRemaining(tiers.low);
    const totalRemaining = highRev + medRev + lowRev;

    // Weighted forecast: cao 90%, TB 60%, thấp 30%
    const weightedForecast = highRev * 0.9 + medRev * 0.6 + lowRev * 0.3;

    // Biểu đồ
    const chartJson = JSON.stringify({
      type: 'bar',
      title: `Pipeline Dự báo Doanh thu ${year}`,
      xAxisKey: 'name',
      data: [
        { name: 'Cao (≥50%)', 'Doanh thu dự báo': Math.round(highRev / 1e9 * 100) / 100 },
        { name: 'TB (10-50%)', 'Doanh thu dự báo': Math.round(medRev / 1e9 * 100) / 100 },
        { name: 'Thấp (<10%)', 'Doanh thu dự báo': Math.round(lowRev / 1e9 * 100) / 100 },
      ],
      lines: [
        { dataKey: 'Doanh thu dự báo', color: '#6366f1', name: 'Doanh thu còn lại (tỷ)' }
      ],
      unit: 'tỷ VND',
    });

    let md = `## 📈 DỰ BÁO DOANH THU NĂM ${year}\n\n`;
    md += `### Tổng quan Pipeline\n`;
    md += `- **Tổng HĐ đang xử lý:** ${contracts.length} HĐ\n`;
    md += `- **Doanh thu còn lại (chưa ghi nhận):** ${fmtMoney(totalRemaining)}\n`;
    md += `- **Dự báo có trọng số:** ${fmtMoney(Math.round(weightedForecast))}\n\n`;

    md += `### Phân tích theo Xác suất\n`;
    md += `| Mức | Số HĐ | Doanh thu còn lại | Trọng số | Dự báo |\n`;
    md += `|---|---|---|---|---|\n`;
    md += `| 🟢 Cao (≥50% tiến độ) | ${tiers.high.length} | ${fmtMoney(highRev)} | 90% | ${fmtMoney(Math.round(highRev * 0.9))} |\n`;
    md += `| 🟡 TB (10-50%) | ${tiers.medium.length} | ${fmtMoney(medRev)} | 60% | ${fmtMoney(Math.round(medRev * 0.6))} |\n`;
    md += `| 🔴 Thấp (<10%) | ${tiers.low.length} | ${fmtMoney(lowRev)} | 30% | ${fmtMoney(Math.round(lowRev * 0.3))} |\n`;
    md += `| **TỔNG** | **${contracts.length}** | **${fmtMoney(totalRemaining)}** | — | **${fmtMoney(Math.round(weightedForecast))}** |\n\n`;

    md += `\`\`\`chart\n${chartJson}\n\`\`\`\n\n`;

    // Top 5 HĐ lớn nhất
    const top5 = [...contracts as any[]].sort((a: any, b: any) => (b.value || 0) - (a.value || 0)).slice(0, 5);
    md += `### Top 5 HĐ giá trị lớn nhất\n`;
    md += `| Tên HĐ | Giá trị | Đã ghi nhận | Còn lại | Đơn vị |\n`;
    md += `|---|---|---|---|---|\n`;
    top5.forEach((c: any) => {
      const rem = Math.max((c.value || 0) - (c.actual_revenue || 0), 0);
      md += `| ${c.title?.substring(0, 35)} | ${fmtMoney(c.value || 0)} | ${fmtMoney(c.actual_revenue || 0)} | ${fmtMoney(rem)} | ${c.units?.name || '—'} |\n`;
    });

    md += `\n*(AI Instruction: Phân tích mức dự báo có trọng số, nhận xét pipeline có đủ khỏe không, và đề xuất hành động tăng xác suất chốt deal)*`;

    return md;
  }
};

// ═══════════════════════════════════════════════
// getExpenseBreakdownTool
// ═══════════════════════════════════════════════

export const getExpenseBreakdownTool: OpenClawTool = {
  name: 'get_expense_breakdown',
  description: 'Trích xuất cấu trúc các khoản chi phí (EXPENSE) theo danh mục. Dùng để xem tiền chi ra cho những mảng nào (lương, quản lý, hoa hồng...).',
  schema: {
    year: { type: 'string', description: 'Năm cần xem chi phí (VD: 2026). Có thể để trống để xem toàn bộ.', required: false }
  },
  execute: async (args, context) => {
    let query = supabase.from('payments').select('amount, expense_category, payment_date').eq('voucher_type', 'EXPENSE').eq('status', 'Completed');
    if (args.year) {
      query = query.gte('payment_date', `${args.year}-01-01`).lte('payment_date', `${args.year}-12-31`);
    }
    const { data: payments } = await query;
    if (!payments || payments.length === 0) return 'Không tìm thấy dữ liệu chi phí (EXPENSE).';

    const categories: Record<string, number> = {};
    let total = 0;
    payments.forEach(p => {
      const cat = p.expense_category || 'Khác';
      categories[cat] = (categories[cat] || 0) + (p.amount || 0);
      total += (p.amount || 0);
    });

    const chartData = Object.keys(categories).map(cat => ({
      name: cat,
      value: Math.round(categories[cat] / 1000000)
    })).sort((a, b) => b.value - a.value);

    const chartJson = JSON.stringify({
      type: 'pie',
      title: `Cơ cấu chi phí ${args.year ? `năm ${args.year}` : 'tổng'}`,
      dataKey: 'value',
      nameKey: 'name',
      data: chartData,
      unit: 'Triệu VNĐ'
    });

    let md = `## 💸 PHÂN TÍCH CƠ CẤU CHI PHÍ\n`;
    md += `**Tổng chi:** ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(total)}\n\n`;
    md += `\`\`\`chart\n${chartJson}\n\`\`\`\n\n`;
    md += `| Danh mục | Số tiền (Triệu VNĐ) | Tỉ trọng |\n|:---|---:|---:|\n`;
    chartData.forEach(d => {
      const percent = ((d.value * 1000000 / total) * 100).toFixed(1);
      md += `| ${d.name} | ${new Intl.NumberFormat('vi-VN').format(d.value)} | ${percent}% |\n`;
    });
    md += `\n*(AI Instruction: Hãy copy nguyên văn biểu đồ và nhận xét danh mục nào chiếm tỉ trọng cao nhất. BẮT BUỘC có cảnh báo 🚨 nếu chi phí nào đó quá lớn theo PROACTIVE ALERTS)*`;
    return md;
  }
};

// ═══════════════════════════════════════════════
// getBudgetVarianceReportTool
// ═══════════════════════════════════════════════

export const getBudgetVarianceReportTool: OpenClawTool = {
  name: 'get_budget_variance_report',
  description: 'So sánh kết quả Kinh doanh Thực tế với Mục tiêu Ngân sách (Budget vs Actual) theo năm.',
  schema: {
    year: { type: 'string', description: 'Năm ngân sách (VD: 2026)', required: true }
  },
  execute: async (args, context) => {
    const year = args.year || new Date().getFullYear().toString();
    const { data: targets } = await supabase.from('unit_targets').select('unit_id, signing_target, revenue_target').eq('year', parseInt(year));
    if (!targets || targets.length === 0) return `Không có dữ liệu Ngân sách / Mục tiêu cho năm ${year}.`;

    const { UnitService } = await import('../../../unitService');
    const allUnits = await UnitService.getAll();
    if (!allUnits || allUnits.length === 0) return 'Không có dữ liệu Đơn vị.';

    let md = `## 🎯 BÁO CÁO NGÂN SÁCH (BUDGET VS ACTUAL) NĂM ${year}\n\n`;
    md += `| Đơn vị | Tiêu chí | Mục tiêu (Budget) | Thực tế (Actual) | Tỉ lệ % | Đánh giá |\n`;
    md += `|:---|:---|---:|---:|---:|:---|\n`;

    let totalRevTarget = 0, totalRevActual = 0;

    for (const unit of allUnits) {
      const uTarget = targets.find((t: any) => t.unit_id === unit.id);
      if (!uTarget) continue;

      let statRevenue = 0, statSigning = 0;
      try {
        const stats = await ContractService.getStatsRPC(unit.id, year.toString());
        statRevenue = stats.totalRevenue || 0;
        statSigning = stats.totalValue || 0;
      } catch (e) { }

      const revTarget = uTarget.revenue_target || 0;
      const signTarget = uTarget.signing_target || 0;

      totalRevTarget += revTarget;
      totalRevActual += statRevenue;

      if (revTarget > 0) {
        const revPct = (statRevenue / revTarget) * 100;
        const icon = revPct >= 100 ? '✅' : (revPct < 30 ? '🚨' : (revPct < 80 ? '⚠️' : '👍'));
        md += `| ${unit.name} | Doanh thu | ${(revTarget / 1e9).toFixed(1)}T | ${(statRevenue / 1e9).toFixed(1)}T | **${revPct.toFixed(1)}%** | ${icon} |\n`;
      }
      if (signTarget > 0) {
        const signPct = (statSigning / signTarget) * 100;
        const icon = signPct >= 100 ? '✅' : (signPct < 30 ? '🚨' : (signPct < 80 ? '⚠️' : '👍'));
        md += `| ${unit.name} | Ký kết | ${(signTarget / 1e9).toFixed(1)}T | ${(statSigning / 1e9).toFixed(1)}T | **${signPct.toFixed(1)}%** | ${icon} |\n`;
      }
    }

    const totalPct = totalRevTarget > 0 ? ((totalRevActual / totalRevTarget) * 100).toFixed(1) : '0';
    md += `\n**TỔNG TIẾN ĐỘ DOANH THU TOÀN CÔNG TY:** Đạt ${totalPct}%\n`;
    md += `\n*(AI Instruction: BẮT BUỘC phân tích các phòng ban có tỉ lệ < 30% kèm icon 🚨 và đề xuất nhắc nhở đốc thúc)*`;

    return md;
  }
};

