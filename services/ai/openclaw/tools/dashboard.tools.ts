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


// ═══════════════════════════════════════════════
// getDashboardKpiTool
// ═══════════════════════════════════════════════

export const getDashboardKpiTool: OpenClawTool = {
  name: 'get_dashboard_kpi',
  description: 'Lấy KPI tổng quan toàn công ty hoặc từng đơn vị: Ký kết, Doanh thu, Dòng tiền, Lợi nhuận QT, Công nợ, HĐ quá hạn, số hợp đồng. Dùng khi user hỏi "tổng quan", "KPI", "tiến độ". Hỗ trợ lọc theo Quý (Q1-Q4) hoặc Tháng (M1-M12).',
  schema: {
    unitId: { type: 'string', description: 'ID đơn vị (để trống = toàn công ty)' },
    year: { type: 'string', description: 'Năm (vd: 2026). Mặc định năm hiện tại.' },
    period: { type: 'string', description: 'Kỳ lọc: Q1, Q2, Q3, Q4 (Quý), hoặc M1-M12 (Tháng). Để trống = cả năm.' },
  },
  execute: async (args, context: UserContext) => {
    const year = args.year ? parseInt(args.year) : new Date().getFullYear();
    const periodFilter = args.period || undefined;

    // Lấy stats chính thống từ ContractService để đồng bộ 100% số liệu và cách tính HĐ quá hạn với Dashboard chính
    const stats = await ContractService.getStatsFallback(args.unitId || 'all', year.toString(), periodFilter);
    const overdueContracts = stats.expiredCount || 0;

    if (args.unitId) {
      // Sử dụng getWithStats để hỗ trợ period filter thay vì getStats (RPC không hỗ trợ period)
      const allUnits = await UnitService.getWithStats(year, periodFilter);
      const u = allUnits.find((unit: any) => unit.id === args.unitId || unit.code === args.unitId);
      if (!u) return { error: `Không tìm thấy đơn vị có mã ${args.unitId}` };

      const signing = u.stats?.totalSigning || 0;
      const revenue = u.stats?.totalRevenue || 0;
      const cash = u.stats?.totalCash || 0;
      const profit = u.stats?.totalProfit || 0;
      const revProfit = u.stats?.totalRevenueProfit || 0;
      const debt = Math.max(0, revenue - cash);

      return {
        nam: year,
        kyLoc: periodFilter || 'Cả năm',
        tenDonVi: u.name,
        maDonVi: u.code,
        kyKet: fmtMoneyWithRaw(signing),
        doanhThu: fmtMoneyWithRaw(revenue),
        dongTien: fmtMoneyWithRaw(cash),
        loiNhuanQT: fmtMoneyWithRaw(profit),
        loiNhuanDT: fmtMoneyWithRaw(revProfit),
        congNo: fmtMoneyWithRaw(debt),
        hdQuaHan: overdueContracts,
        soHopDong: stats.totalContracts || 0,
      };
    }

    // Toàn công ty: lấy tất cả đơn vị + tổng (hỗ trợ period filter)
    const units = await UnitService.getWithStats(year, periodFilter);
    const tongKyKet = stats.totalValue || 0;
    const tongDoanhThu = stats.totalRevenue || 0;
    const tongDongTien = stats.totalCash || 0;
    const tongLoiNhuan = stats.totalProfit || 0;
    const tongLoiNhuanDT = stats.totalRevenueProfit || 0;
    let tongCongNo = 0;
    const tongSoHD = stats.totalContracts || 0;

    const results = units
      .filter(isBusinessUnit)
      .map((u: any) => {
        const signing = u.stats?.totalSigning || 0;
        const revenue = u.stats?.totalRevenue || 0;
        const cash = u.stats?.totalCash || 0;
        const profit = u.stats?.totalProfit || 0;
        const revProfit = u.stats?.totalRevenueProfit || 0;
        const count = u.stats?.contractCount || 0;
        const debt = Math.max(0, revenue - cash);

        tongCongNo += debt;

        return `${u.name} (${u.code || '—'}): Ký kết: ${fmtMoneyWithRaw(signing)}, Doanh thu: ${fmtMoneyWithRaw(revenue)}, Dòng tiền: ${fmtMoneyWithRaw(cash)}, Lợi nhuận QT: ${fmtMoneyWithRaw(profit)}, Lợi nhuận DT: ${fmtMoneyWithRaw(revProfit)}, Công nợ: ${fmtMoneyWithRaw(debt)}, Số HĐ: ${count}`;
      });

    return {
      nam: year,
      kyLoc: periodFilter || 'Cả năm',
      danhSachDonVi: results,
      tongHop: {
        tongKyKet: fmtMoneyWithRaw(tongKyKet),
        tongDoanhThu: fmtMoneyWithRaw(tongDoanhThu),
        tongDongTien: fmtMoneyWithRaw(tongDongTien),
        tongLoiNhuan: fmtMoneyWithRaw(tongLoiNhuan),
        tongLoiNhuanDT: fmtMoneyWithRaw(tongLoiNhuanDT),
        tongCongNo: fmtMoneyWithRaw(tongCongNo),
        tongSoHopDongQuaHan: overdueContracts,
        tongSoHopDong: tongSoHD,
      },
    };
  }
};

// ═══════════════════════════════════════════════
// getComparativeReportTool
// ═══════════════════════════════════════════════

export const getComparativeReportTool: OpenClawTool = {
  name: 'get_comparative_report',
  description: 'So sánh số liệu kinh doanh giữa 2 kỳ (VD: năm nay vs năm trước, Q1 vs Q1 năm trước). '
    + 'Trả về bảng so sánh ĐÃ TÍNH SẴN % tăng giảm VÀ biểu đồ JSON sẵn sàng render. '
    + 'BẮT BUỘC DÙNG TOOL NÀY khi user yêu cầu báo cáo phân tích, so sánh kinh doanh.',
  schema: {
    currentYear: { type: 'string', description: 'Năm kỳ hiện tại (VD: 2026)' },
    previousYear: { type: 'string', description: 'Năm kỳ trước (VD: 2026)' },
    currentPeriod: { type: 'string', description: 'Kỳ hiện tại: Q1, Q2, Q3, Q4, M1-M12 (để trống nếu so sánh cả năm)' },
    previousPeriod: { type: 'string', description: 'Kỳ trước: Q1, Q2, Q3, Q4, M1-M12 (để trống nếu so sánh cả năm)' },
  },
  execute: async (args, context: UserContext) => {
    const forcedUnitId = getUnitFilter(args, context);

    const getDates = (yearStr: string, periodStr?: string) => {
      const y = parseInt(yearStr) || new Date().getFullYear();
      let from = `${y}-01-01`;
      let to = `${y}-12-31`;
      if (periodStr) {
        if (periodStr.toUpperCase().startsWith('Q')) {
          const q = parseInt(periodStr.substring(1));
          const sm = (q - 1) * 3 + 1;
          const em = q * 3;
          const lastDay = em === 3 || em === 12 ? 31 : em === 6 || em === 9 ? 30 : 31;
          from = `${y}-${String(sm).padStart(2, '0')}-01`;
          to = `${y}-${String(em).padStart(2, '0')}-${lastDay}`;
        } else if (periodStr.toUpperCase().startsWith('M')) {
          const m = parseInt(periodStr.substring(1));
          const lastDay = new Date(y, m, 0).getDate();
          from = `${y}-${String(m).padStart(2, '0')}-01`;
          to = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
        }
      }
      return { from, to, year: y.toString(), label: periodStr ? `${periodStr}/${y}` : `${y}` };
    };

    const cur = getDates(args.currentYear, args.currentPeriod);
    const prev = getDates(args.previousYear, args.previousPeriod);

    // Gọi song song 2 kỳ
    const [current, previous] = await Promise.all([
      ContractService.getStats({
        dateFrom: cur.from, dateTo: cur.to,
        year: cur.year, status: 'All', unitId: forcedUnitId
      }),
      ContractService.getStats({
        dateFrom: prev.from, dateTo: prev.to,
        year: prev.year, status: 'All', unitId: forcedUnitId
      }),
    ]);

    const curVal = current.totalValue;
    const prevVal = previous.totalValue;
    const curRev = current.totalRevenue;
    const prevRev = previous.totalRevenue;
    const curProfit = current.totalProfit;
    const prevProfit = previous.totalProfit;
    const curCash = current.totalCash;
    const prevCash = previous.totalCash;
    const curCount = current.totalContracts;
    const prevCount = previous.totalContracts;

    // Sinh biểu đồ JSON chuẩn
    const chartJson = JSON.stringify({
      type: 'bar',
      title: `So sánh Kinh doanh ${cur.label} vs ${prev.label}`,
      xAxisKey: 'name',
      data: [
        { name: 'Ký kết', 'ky_truoc': Math.round(prevVal / 1e9 * 100) / 100, 'ky_hien_tai': Math.round(curVal / 1e9 * 100) / 100 },
        { name: 'Doanh thu', 'ky_truoc': Math.round(prevRev / 1e9 * 100) / 100, 'ky_hien_tai': Math.round(curRev / 1e9 * 100) / 100 },
        { name: 'Lợi nhuận', 'ky_truoc': Math.round(prevProfit / 1e9 * 100) / 100, 'ky_hien_tai': Math.round(curProfit / 1e9 * 100) / 100 },
      ],
      lines: [
        { dataKey: 'ky_truoc', color: '#94a3b8', name: `Kỳ trước (${prev.label})` },
        { dataKey: 'ky_hien_tai', color: '#6366f1', name: `Kỳ hiện tại (${cur.label})` },
      ],
      unit: 'tỷ VND',
    });

    // QUAN TRỌNG: Trả về 1 chuỗi markdown duy nhất. LLM chỉ cần paste nguyên khối!
    return `## 📊 Báo cáo So sánh Kinh doanh ${cur.label} vs ${prev.label}

### Bảng Tổng hợp

| Chỉ tiêu | Kỳ trước (${prev.label}) | Kỳ hiện tại (${cur.label}) | Chênh lệch |
|---|---|---|---|
| Số hợp đồng | ${prevCount} | ${curCount} | ${calcChange(curCount, prevCount)} |
| Giá trị ký kết | ${fmtMoney(prevVal)} | ${fmtMoney(curVal)} | ${calcChange(curVal, prevVal)} |
| Doanh thu | ${fmtMoney(prevRev)} | ${fmtMoney(curRev)} | ${calcChange(curRev, prevRev)} |
| Lợi nhuận QT | ${fmtMoney(prevProfit)} | ${fmtMoney(curProfit)} | ${calcChange(curProfit, prevProfit)} |
| Dòng tiền | ${fmtMoney(prevCash)} | ${fmtMoney(curCash)} | ${calcChange(curCash, prevCash)} |

### Biểu đồ So sánh

\`\`\`chart
${chartJson}
\`\`\`

Hãy dùng bảng và biểu đồ trên để phân tích, nhận xét xu hướng tăng giảm, và đề xuất hành động.`;
  }
};

// ═══════════════════════════════════════════════
// getUnitRankingTool
// ═══════════════════════════════════════════════

export const getUnitRankingTool: OpenClawTool = {
  name: 'get_unit_ranking',
  description: 'Xếp hạng các đơn vị (Trung tâm) theo hiệu suất kinh doanh. Dùng khi user hỏi "đơn vị nào tốt nhất", "phòng ban nào doanh thu cao nhất", "so sánh các phòng ban".',
  schema: {
    year: { type: 'string', description: 'Năm (vd: 2026)' },
    sortBy: { type: 'string', enum: ['signing', 'revenue', 'profit'], description: 'Tiêu chí xếp hạng. Mặc định: revenue' },
  },
  execute: async (args, context: UserContext) => {
    const forcedUnitId = getUnitFilter(args, context);
    if (forcedUnitId) {
      throw new Error('Bạn không có quyền xem bảng xếp hạng toàn công ty. Tính năng này chỉ dành cho Ban Lãnh Đạo.');
    }

    const year = parseInt(args.year) || new Date().getFullYear();
    const units = await UnitService.getWithStats(year);
    const sortKey = args.sortBy === 'signing' ? 'totalSigning' : args.sortBy === 'profit' ? 'totalProfit' : 'totalRevenue';


    const sorted = units
      .filter((u: any) => isBusinessUnit(u) && u.stats)
      .sort((a: any, b: any) => (b.stats?.[sortKey] || 0) - (a.stats?.[sortKey] || 0))
      .map((u: any, i: number) => 
        `Hạng ${i + 1}: ${u.name} (${u.code || '—'}) - Ký kết: ${fmtMoney(u.stats?.totalSigning || 0)}, Doanh thu: ${fmtMoney(u.stats?.totalRevenue || 0)}, Lợi nhuận: ${fmtMoney(u.stats?.totalProfit || 0)}, Số HĐ: ${u.stats?.contractCount || 0}`
      );

    return {
      nam: year,
      tieuChiXepHang: sortKey,
      bangXepHang: sorted,
    };
  }
};

// ═══════════════════════════════════════════════
// getDailyBriefingTool
// ═══════════════════════════════════════════════

export const getDailyBriefingTool: OpenClawTool = {
  name: 'get_daily_briefing',
  description: 'Tạo bản tin sáng (Daily Briefing) tổng hợp: HĐ quá hạn, công nợ, task trễ, HĐ sắp hết hạn. Dùng khi user hỏi "bản tin sáng", "tóm tắt hôm nay", "tình hình hôm nay", "daily briefing".',
  schema: {},
  execute: async () => {
    try {
      const { generateDailyBriefing } = await import('../../../dailyBriefingService');
      const briefing = await generateDailyBriefing();
      return { briefing: briefing.summary };
    } catch (err: any) {
      return { error: 'Lỗi tạo bản tin: ' + err.message };
    }
  }
};

// ═══════════════════════════════════════════════
// getComprehensiveReportTool
// ═══════════════════════════════════════════════

export const getComprehensiveReportTool: OpenClawTool = {
  name: 'get_comprehensive_report',
  description: 'Dùng BẮT BUỘC khi người dùng yêu cầu "lập báo cáo", "lập báo cáo tổng kết" cho 1 năm. Tool trả về nội dung báo cáo Markdown gồm Bảng phân bổ và Biểu đồ.',
  schema: {
    year: { type: 'string', description: 'Năm cần lập báo cáo (vd: 2025, 2026)' }
  },
  execute: async (args, context: UserContext) => {
    const forcedUnitId = getUnitFilter(args, context);
    const year = args.year ? parseInt(args.year) : new Date().getFullYear();

    // 1. Lấy dữ liệu KPI theo đơn vị
    const allUnitsRaw = await UnitService.getWithStats(year, undefined);
    const units = forcedUnitId ? allUnitsRaw.filter((u: any) => u.id === forcedUnitId) : allUnitsRaw;
    let tongKyKet = 0, tongDoanhThu = 0, tongLoiNhuan = 0, tongSoHD = 0, tongDongTien = 0;


    const unitRows = units
      .filter(isBusinessUnit)
      .map((u: any) => {
        const signing = u.stats?.totalSigning || 0;
        const revenue = u.stats?.totalRevenue || 0;
        const profit = u.stats?.totalProfit || 0;
        const cash = u.stats?.totalCash || 0;
        const count = u.stats?.contractCount || 0;
        tongKyKet += signing;
        tongDoanhThu += revenue;
        tongLoiNhuan += profit;
        tongDongTien += cash;
        tongSoHD += count;
        return { name: u.name, signing, revenue, profit, cash, count };
      });

    // Sort logic
    unitRows.sort((a, b: any) => b.revenue - a.revenue);

    // 2. Lấy dữ liệu biểu đồ các tháng trong năm
    let monthlyData: any[] = [];
    try {
      const chartRes = await ContractService.getChartDataRPC('all', year.toString());
      if (chartRes && chartRes.length > 0) {
        monthlyData = chartRes;
      }
    } catch (e) { }

    // Xây dựng JSON biểu đồ Recharts
    const chartJson = JSON.stringify({
      type: 'bar',
      title: `Biến động doanh thu theo tháng năm ${year}`,
      xAxisKey: 'month',
      data: monthlyData.map((m: any) => ({
        month: `Th.${m.month}`,
        'Ký kết': Math.round(m.signing / 1e9 * 100) / 100,
        'Doanh thu': Math.round(m.revenue / 1e9 * 100) / 100,
        'Lợi nhuận': Math.round(m.profit / 1e9 * 100) / 100,
      })),
      lines: [
        { dataKey: 'Doanh thu', color: '#10b981', name: 'Doanh thu (tỷ)' }
      ],
      unit: 'tỷ VND'
    });

    // 3. Build Markdown
    let md = `## 📊 BÁO CÁO TỔNG KẾT KẾT QUẢ KINH DOANH NĂM ${year}\n\n`;
    md += `### 1. Chỉ số Tổng quan toàn công ty\n`;
    md += `- **Số hợp đồng**: ${tongSoHD} HĐ\n`;
    md += `- **Tổng giá trị ký kết**: ${fmtMoney(tongKyKet)}\n`;
    md += `- **Tổng doanh thu thực hiện**: ${fmtMoney(tongDoanhThu)}\n`;
    md += `- **Dòng tiền thực nhận**: ${fmtMoney(tongDongTien)}\n`;
    md += `- **Lợi nhuận gộp QT**: ${fmtMoney(tongLoiNhuan)}\n\n`;

    md += `### 2. Biểu đồ Phân bổ (Theo tháng)\n`;
    if (monthlyData.length > 0) {
      md += `\`\`\`chart\n${chartJson}\n\`\`\`\n\n`;
    } else {
      md += `*(Chưa có dữ liệu biểu đồ chi tiết theo tháng)*\n\n`;
    }

    md += `### 3. Thành tích đóng góp theo Đơn vị\n`;
    md += `| Xếp hạng | Đơn vị | Ký kết | Doanh thu | Dòng tiền | Lợi nhuận |\n`;
    md += `|:---|:---|:---:|:---:|:---:|:---:|\n`;
    unitRows.forEach((u: any, idx: number) => {
      md += `| ${idx + 1} | ${u.name} | ${fmtMoney(u.signing)} | ${u.revenue > 0 ? `**${fmtMoney(u.revenue)}**` : `0`} | ${fmtMoney(u.cash)} | ${fmtMoney(u.profit)} |\n`;
    });

    md += `\n*(AI Instruction: BẮT BUỘC paste toàn bộ bảng markdown và biểu đồ này ra cho user. Sau đó viết vài dòng thuyết minh dựa vào số liệu để báo cáo thêm chuyên nghiệp)*`;

    return md;
  }
};

// ═══════════════════════════════════════════════
// getSmartInsightsTool
// ═══════════════════════════════════════════════

export const getSmartInsightsTool: OpenClawTool = {
  name: 'get_smart_insights',
  description: 'Phân tích đa chiều tự động: so sánh KPI tháng này vs tháng trước, đơn vị tụt mạnh nhất, xu hướng công nợ, top rủi ro. Dùng khi user hỏi "phân tích", "insights", "đánh giá tổng quan", "tư vấn chiến lược".',
  schema: {},
  execute: async (args, context: UserContext) => {
    const forcedUnitId = getUnitFilter(args, context);

    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const today = new Date().toISOString().split('T')[0];

    // Build queries with unit filter
    let qContracts = supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'Processing').lt('end_date', today);
    let qPayments = supabase.from('payments').select('amount, paid_amount, due_date, status, contracts!inner(unit_id)').in('status', ['Chưa thanh toán', 'Pending', 'Đã xuất HĐ', 'Đã giao KH']).limit(500);
    let qTasks = supabase.from('tasks').select('id, due_date', { count: 'exact' }).lt('due_date', today).is('completed_at', null);

    if (forcedUnitId) {
      qContracts = qContracts.eq('unit_id', forcedUnitId);
      qPayments = qPayments.eq('contracts.unit_id', forcedUnitId);
      // tasks filter requires unit mapping, assuming tasks has unit_id or we ignore for simplicity
      // For now, if user is unit-scoped, just let RLS handle tasks if RLS is on tasks.
    }

    // Song song query tất cả dữ liệu cần thiết
    const [
      unitsDataRaw,
      overdueRes,
      debtRes,
      tasksRes,
    ] = await Promise.all([
      UnitService.getWithStats(year),
      qContracts,
      qPayments,
      qTasks,
    ]);

    const unitsData = forcedUnitId ? unitsDataRaw.filter((u: any) => u.id === forcedUnitId) : unitsDataRaw;

    // 1. Phân tích đơn vị
    const businessUnits = unitsData
      .filter(isBusinessUnit)
      .filter((u: any) => u.stats);

    const unitAnalysis = businessUnits.map((u: any) => {
      const rev = u.stats?.totalRevenue || 0;
      const sign = u.stats?.totalSigning || 0;
      const conversionRate = sign > 0 ? ((rev / sign) * 100).toFixed(0) : '0';
      return {
        name: u.name,
        revenue: rev,
        signing: sign,
        conversionRate: conversionRate + '%',
        contractCount: u.stats?.contractCount || 0,
      };
    }).sort((a: any, b: any) => a.revenue - b.revenue);

    // 2. Tổng công nợ
    let totalDebt = 0;
    let overdueDebt = 0;
    (debtRes.data || []).forEach((p: any) => {
      const owing = (p.amount || 0) - (p.paid_amount || 0);
      if (owing > 0) {
        totalDebt += owing;
        if (p.due_date && p.due_date < today) overdueDebt += owing;
      }
    });

    const overdueContracts = overdueRes.count || 0;
    const overdueTasks = tasksRes.count || 0;

    // 3. Build insights
    let md = `## 🧠 PHÂN TÍCH THÔNG MINH — ${new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}\n\n`;

    // KPI tổng quan
    const totalRev = businessUnits.reduce((s: number, u: any) => s + (u.stats?.totalRevenue || 0), 0);
    const totalSign = businessUnits.reduce((s: number, u: any) => s + (u.stats?.totalSigning || 0), 0);
    md += `### 📊 KPI Tổng quan ${year}\n`;
    md += `- **Ký kết:** ${fmtMoney(totalSign)}\n`;
    md += `- **Doanh thu:** ${fmtMoney(totalRev)}\n`;
    md += `- **Tỷ lệ chuyển đổi (DT/KK):** ${totalSign > 0 ? ((totalRev / totalSign) * 100).toFixed(0) : 0}%\n\n`;

    // Cảnh báo
    const alerts: string[] = [];
    if (overdueContracts > 0) alerts.push(`🔴 **${overdueContracts} HĐ quá hạn** hoàn thành — cần đốc thúc ngay`);
    if (overdueDebt > 0) alerts.push(`💰 **Nợ quá hạn:** ${fmtMoney(overdueDebt)} — cần liên hệ thu hồi`);
    if (overdueTasks > 5) alerts.push(`📌 **${overdueTasks} task trễ deadline** — cần rà soát phân công`);

    if (alerts.length > 0) {
      md += `### ⚠️ Cảnh báo Cần xử lý\n`;
      alerts.forEach(a => { md += `- ${a}\n`; });
      md += `\n`;
    }

    // Đơn vị yếu nhất
    if (unitAnalysis.length > 0) {
      md += `### 📉 Đơn vị Cần Chú ý\n`;
      const weakest = unitAnalysis.slice(0, 3);
      md += `| Đơn vị | Doanh thu | Ký kết | Tỷ lệ chuyển đổi |\n`;
      md += `|---|---|---|---|\n`;
      weakest.forEach((u: any) => {
        const icon = u.revenue === 0 ? '🚨' : '⚠️';
        md += `| ${icon} ${u.name} | ${fmtMoney(u.revenue)} | ${fmtMoney(u.signing)} | ${u.conversionRate} |\n`;
      });
      md += `\n`;
    }

    // Đề xuất hành động
    md += `### 💡 Đề xuất Hành động (Top 3)\n`;
    const actions: string[] = [];
    if (overdueContracts > 0) actions.push(`1. **Họp khẩn về ${overdueContracts} HĐ quá hạn** — giao việc cho PM rà soát tiến độ`);
    if (overdueDebt > 0) actions.push(`${actions.length + 1}. **Thu hồi công nợ** ${fmtMoney(overdueDebt)} — ưu tiên khách hàng nợ lớn nhất`);
    if (unitAnalysis.length > 0 && unitAnalysis[0].revenue === 0) {
      actions.push(`${actions.length + 1}. **Đốc thúc ${unitAnalysis[0].name}** — chưa ghi nhận doanh thu`);
    }
    if (actions.length === 0) {
      actions.push(`1. ✅ Chưa phát hiện vấn đề nghiêm trọng — tiếp tục theo dõi KPI hàng tuần`);
    }
    actions.forEach(a => { md += `- ${a}\n`; });

    md += `\n*(AI Instruction: Bổ sung nhận xét chiến lược dựa trên số liệu trên. Phân tích xu hướng và đề xuất quyết định cụ thể cho BGĐ)*`;

    return md;
  }
};

