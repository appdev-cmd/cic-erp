import { ContractService } from '../../../contractService';
import { CustomerService } from '../../../customerService';
import { PaymentService } from '../../../paymentService';
import { UnitService } from '../../../unitService';
import type { OpenClawTool, UserContext } from '../types';
import { GLOBAL_VIEW_ROLES } from '../../../../lib/permissions';
import { dataClient as supabase } from '../../../../lib/dataClient';

/** Helper: format số thành chuỗi tiền tệ dễ đọc, kèm giá trị thô */
const fmtMoney = (v: number): string => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} tỷ VND`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} triệu VND`;
  return `${v.toLocaleString('vi-VN')} VND`;
};

/** Helper: format tiền + kèm raw để LLM đối chiếu */
const fmtMoneyWithRaw = (v: number): string => {
  return `${fmtMoney(v)} (raw: ${v})`;
};

/** Helper: tính % tăng giảm giữa 2 số */
const calcChange = (cur: number, prev: number): string => {
  if (prev === 0) return cur > 0 ? '+∞' : '0%';
  const change = ((cur - prev) / prev * 100).toFixed(1);
  return Number(change) >= 0 ? `+${change}%` : `${change}%`;
};

/** Helper: Kiểm tra user có quyền xem toàn công ty không */
const canViewAll = (ctx: UserContext): boolean => {
  return GLOBAL_VIEW_ROLES.includes(ctx.role as any);
};

// ═══════════════════════════════════════════════
// Tool 1: Tìm kiếm hợp đồng
// ═══════════════════════════════════════════════

export const searchContractsTool: OpenClawTool = {
  name: 'search_contracts',
  description: 'Tìm kiếm hợp đồng theo từ khóa, thời gian, trạng thái, phòng ban. Trả về danh sách rút gọn.',
  schema: {
    search: { type: 'string', description: 'Từ khóa tìm kiếm (tên, mã hợp đồng, khách hàng)' },
    status: { type: 'string', description: 'Trạng thái (Processing, Completed, Suspended, Cancelled)', enum: ['Processing', 'Completed', 'Suspended', 'Cancelled', 'All'] },
    unitId: { type: 'string', description: 'Mã phòng ban (nếu cần lọc theo phòng cụ thể)' },
    year: { type: 'string', description: 'Năm (vd: 2026, 2025)' },
    dateFrom: { type: 'string', description: 'Từ ngày (YYYY-MM-DD)' },
    dateTo: { type: 'string', description: 'Đến ngày (YYYY-MM-DD)' }
  },
  execute: async (args, context: UserContext) => {
    // Phân quyền: nếu unit-scoped, tự filter theo đơn vị mình
    let unitFilter = args.unitId || undefined;
    if (!canViewAll(context) && context.unitId) {
      unitFilter = context.unitId;
    }
    
    const res = await ContractService.list({
      page: 1, limit: 10,
      search: args.search,
      status: args.status,
      year: args.year,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
      unitId: unitFilter
    });
    return res.data.map(c => ({
      id: c.id,
      code: c.contractCode,
      title: c.title,
      partyA: c.partyA,
      value: fmtMoney(c.value || 0),
      status: c.status,
      signedDate: c.signedDate
    }));
  }
};

// ═══════════════════════════════════════════════
// Tool 2: Chi tiết 1 hợp đồng
// ═══════════════════════════════════════════════

export const getContractDetailTool: OpenClawTool = {
  name: 'get_contract_detail',
  description: 'Lấy thông tin chi tiết của 1 hợp đồng dựa vào contract id hoặc code',
  schema: {
    contractId: { type: 'string', description: 'ID hợp đồng' }
  },
  execute: async (args) => {
    const data = await ContractService.getById(args.contractId);
    if (!data) return "Không tìm thấy hợp đồng.";
    return {
      title: data.title,
      code: data.contractCode,
      value: fmtMoney(data.value || 0),
      revenue: fmtMoney(data.actualRevenue || 0),
      cash: fmtMoney(data.cashReceived || 0),
      status: data.status,
      category: data.category,
      paymentPhases: data.paymentPhases?.map(p => ({
        amount: fmtMoney(p.amount || 0),
        status: p.status,
        date: p.dueDate
      }))
    };
  }
};

// ═══════════════════════════════════════════════
// Tool 3: Thống kê hợp đồng
// ═══════════════════════════════════════════════

export const getContractStatsTool: OpenClawTool = {
  name: 'get_contract_stats',
  description: 'Lấy thống kê tổng quan: Tổng doanh thu, Tổng giá trị ký kết, Dòng tiền, Số lượng hợp đồng. Nếu người dùng hỏi "tổng" hoặc "toàn bộ" thì BẮT BUỘC status="All".',
  schema: {
    status: { type: 'string', description: 'Trạng thái lọc. Dùng "All" nếu muốn xem tất cả.', enum: ['Processing', 'Completed', 'Suspended', 'Cancelled', 'All'] },
    unitId: { type: 'string', description: 'Mã phòng ban (để trống = toàn công ty)' },
    year: { type: 'string', description: 'Năm (vd: 2026)' },
    dateFrom: { type: 'string', description: 'Từ ngày (YYYY-MM-DD)' },
    dateTo: { type: 'string', description: 'Đến ngày (YYYY-MM-DD)' }
  },
  execute: async (args, context: UserContext) => {
    let unitFilter = args.unitId || undefined;
    if (!canViewAll(context) && context.unitId) {
      unitFilter = context.unitId;
    }

    const res = await ContractService.getStats({
      status: args.status,
      year: args.year,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
      unitId: unitFilter
    });
    
    return {
      soLuongHopDong: res.totalContracts,
      tongGiaTriKyKet: fmtMoneyWithRaw(res.totalValue),
      tongDoanhThu: fmtMoneyWithRaw(res.totalRevenue),
      dongTienThucNhan: fmtMoneyWithRaw(res.totalCash),
    };
  }
};

// ═══════════════════════════════════════════════
// Tool 4: Tìm kiếm khách hàng / đối tác
// ═══════════════════════════════════════════════

export const searchCustomersTool: OpenClawTool = {
  name: 'search_customers',
  description: 'Tìm kiếm khách hàng, đối tác, nhà cung cấp theo tên hoặc mã số thuế. Trả về thông tin cơ bản + thống kê hợp đồng.',
  schema: {
    search: { type: 'string', description: 'Từ khóa tìm kiếm (tên KH, tên viết tắt, MST)' },
    type: { type: 'string', description: 'Loại: Customer, Supplier, Both, all', enum: ['Customer', 'Supplier', 'Both', 'all'] },
  },
  execute: async (args) => {
    const res = await CustomerService.getAll({
      page: 1,
      pageSize: 10,
      search: args.search || undefined,
      type: args.type || undefined,
    });
    return res.data.map(c => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName,
      taxCode: c.taxCode || '—',
      type: c.type,
      rating: c.rating,
      industry: Array.isArray(c.industry) ? c.industry.join(', ') : c.industry,
      phone: c.phone || '—',
      email: c.email || '—',
      stats: c.stats ? {
        soHopDong: c.stats.contractCount,
        tongGiaTri: fmtMoney(c.stats.totalValue),
        tongDoanhThu: fmtMoney(c.stats.totalRevenue),
        hdDangThucHien: c.stats.activeContracts,
      } : undefined,
    }));
  }
};

// ═══════════════════════════════════════════════
// Tool 5: KPI Dashboard toàn công ty/đơn vị
// ═══════════════════════════════════════════════

export const getDashboardKpiTool: OpenClawTool = {
  name: 'get_dashboard_kpi',
  description: 'Lấy KPI tổng quan toàn công ty hoặc từng đơn vị: Ký kết, Doanh thu, Lợi nhuận QT, số hợp đồng. Dùng khi user hỏi "tổng quan", "KPI", "tiến độ". Hỗ trợ lọc theo Quý (Q1-Q4) hoặc Tháng (M1-M12).',
  schema: {
    unitId: { type: 'string', description: 'ID đơn vị (để trống = toàn công ty)' },
    year: { type: 'string', description: 'Năm (vd: 2026). Mặc định năm hiện tại.' },
    period: { type: 'string', description: 'Kỳ lọc: Q1, Q2, Q3, Q4 (Quý), hoặc M1-M12 (Tháng). Để trống = cả năm.' },
  },
  execute: async (args, context: UserContext) => {
    const year = args.year ? parseInt(args.year) : new Date().getFullYear();
    const periodFilter = args.period || undefined;

    if (args.unitId) {
      // KPI 1 đơn vị cụ thể (không hỗ trợ period filter ở RPC, dùng fallback)
      const stats = await UnitService.getStats(args.unitId, year);
      return {
        kyKet: fmtMoneyWithRaw(stats.totalSigning || 0),
        doanhThu: fmtMoneyWithRaw(stats.totalRevenue || 0),
        loiNhuanQT: fmtMoneyWithRaw(stats.totalProfit || 0),
        soHopDong: stats.contractCount || 0,
      };
    }

    // Toàn công ty: lấy tất cả đơn vị + tổng (hỗ trợ period filter)
    const units = await UnitService.getWithStats(year, periodFilter);
    let tongKyKet = 0, tongDoanhThu = 0, tongLoiNhuan = 0, tongSoHD = 0;

    const results = units
      .filter((u: any) => u.id !== 'all')
      .map((u: any) => {
        const signing = u.stats?.totalSigning || 0;
        const revenue = u.stats?.totalRevenue || 0;
        const profit = u.stats?.totalProfit || 0;
        const count = u.stats?.contractCount || 0;
        tongKyKet += signing;
        tongDoanhThu += revenue;
        tongLoiNhuan += profit;
        tongSoHD += count;
        return {
          tenDonVi: u.name,
          maDonVi: u.code,
          kyKet: fmtMoneyWithRaw(signing),
          doanhThu: fmtMoneyWithRaw(revenue),
          loiNhuanQT: fmtMoneyWithRaw(profit),
          soHopDong: count,
        };
      });

    return {
      nam: year,
      kyLoc: periodFilter || 'Cả năm',
      danhSachDonVi: results,
      tongHop: {
        tongKyKet: fmtMoneyWithRaw(tongKyKet),
        tongDoanhThu: fmtMoneyWithRaw(tongDoanhThu),
        tongLoiNhuan: fmtMoneyWithRaw(tongLoiNhuan),
        tongSoHopDong: tongSoHD,
      },
    };
  }
};

// ═══════════════════════════════════════════════
// Tool 6: Tra cứu thanh toán / phiếu thu chi
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

/**
 * Danh sách tổng hợp công cụ — registry trung tâm
 */
import { EmployeeService } from '../../../employeeService';
import { TaskService } from '../../../taskService';
import { NotificationService } from '../../../notificationService';

export const searchEmployeesTool: OpenClawTool = {
  name: 'search_employees',
  description: 'Tìm kiếm nhân sự theo tên (ví dụ: @Khang, @Mai) để lấy ID phục vụ việc giao task.',
  schema: {
    searchName: { type: 'string', description: 'Tên nhân sự cần tìm' }
  },
  execute: async (args) => {
    const term = args.searchName.replace('@', '');
    const { data: employees } = await supabase.from('employees').select('id, name, position').ilike('name', `%${term}%`).limit(3);
    if (!employees || employees.length === 0) return { error: `Không tìm thấy ai tên ${term}` };
    return employees;
  }
};

export const createTaskAiTool: OpenClawTool = {
  name: 'create_task_ai',
  description: 'Tạo công việc (Task) lên hệ thống Kanban và giao việc cho nhân sự.',
  schema: {
    title: { type: 'string', description: 'Tiêu đề công việc' },
    description: { type: 'string', description: 'Mô tả chi tiết công việc' },
    assigneeIds: { type: 'array', items: { type: 'string' }, description: 'Danh sách ID nhân viên' },
    priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Độ ưu tiên' },
    dueDate: { type: 'string', description: 'Hạn chót (YYYY-MM-DD)' },
    relatedEntityId: { type: 'string', description: 'ID của đối tượng liên quan (Hợp đồng, Khách hàng, Dự án...) lấy từ Context nếu có.' },
    relatedEntityType: { type: 'string', enum: ['contracts', 'customers', 'projects', 'units'], description: 'Loại của đối tượng liên quan.' }
  },
  execute: async (args, context: UserContext) => {
    try {
      if (!args.assigneeIds || args.assigneeIds.length === 0) return { error: 'Thiếu assigneeIds' };
      const task = await TaskService.create({
        title: args.title,
        description: args.description || '',
        assignees: args.assigneeIds,
        priority: args.priority || 'medium',
        due_date: args.dueDate || undefined,
        created_by: context.userId as any,
        auto_generated: true,
        source_entity_id: args.relatedEntityId,
        source_module: args.relatedEntityType || (args.relatedEntityId ? 'contracts' : undefined)
      });
      const taskLink = `/tasks?taskId=${task.id}`;
      return { 
        success: true, 
        taskId: task.id, 
        message: `Đã tạo task thành công.\n\n👉 [Xem chi tiết công việc: ${args.title}](${taskLink})` 
      };
    } catch (err: any) {
      return { error: err.message };
    }
  }
};

export const exportDocumentTool: OpenClawTool = {
  name: 'export_document',
  description: 'Sinh file tài liệu báo cáo và trả về Link Download.',
  schema: {
    title: { type: 'string', description: 'Tên báo cáo' },
    content: { type: 'string', description: 'Nội dung văn bản Markdown' }
  },
  execute: async (args) => {
    try {
      const fileName = `${args.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.md`;
      const blob = new Blob([args.content], { type: 'text/markdown' });
      
      // Khởi tạo Data URL (vô hiệu hóa lỗi React Router thông qua markdown renderer)
      const dataUrl = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(args.content);
      const downloadLink = `[📥 TẢI XUỐNG BÁO CÁO: ${args.title}](${dataUrl})`;

      // Upload ngầm lên Supabase (không chặn main thread)
      supabase.storage.from('documents').upload(`ai_reports/${fileName}`, blob).catch(console.error);
      
      return `Tạo file thành công! Bắt buộc cung cấp đường link này nguyên văn cho người dùng để họ bấm tải xuống:\n${downloadLink}`;
    } catch(err: any) {
      return `Lỗi tạo file: ${err.message}`;
    }
  }
};

export const sendNotificationEmailTool: OpenClawTool = {
  name: 'send_notification_email',
  description: 'Gửi Thông báo Email rải thư hoặc thông báo giao việc đến hệ thống.',
  schema: {
    targetUserId: { type: 'string', description: 'ID User đích' },
    subject: { type: 'string', description: 'Tiêu đề Email/Thông báo' },
    body: { type: 'string', description: 'Nội dung' }
  },
  execute: async (args, context: UserContext) => {
    try {
      if(!args.targetUserId) return { error: "Thiếu ID người nhận" };
      await NotificationService.createBulk(
        [args.targetUserId],
        'mention' as any,
        args.subject,
        args.body,
        { source: 'ai_agent' }
      );
      return { success: true, message: 'Đã đưa vào hàng đợi gửi tin thành công.' };
    } catch (err: any) {
      return { error: err.message };
    }
  }
};

// ═══════════════════════════════════════════════
// Tool 11: Báo cáo So sánh Đa kỳ (tính sẵn %)
// ═══════════════════════════════════════════════

export const getComparativeReportTool: OpenClawTool = {
  name: 'get_comparative_report',
  description: 'So sánh số liệu kinh doanh giữa 2 kỳ (VD: năm nay vs năm trước, Q1 vs Q1 năm trước). '
    + 'Trả về bảng so sánh ĐÃ TÍNH SẴN % tăng giảm VÀ biểu đồ JSON sẵn sàng render. '
    + 'BẮT BUỘC DÙNG TOOL NÀY khi user yêu cầu báo cáo phân tích, so sánh kinh doanh.',
  schema: {
    currentYear: { type: 'string', description: 'Năm kỳ hiện tại (VD: 2026)' },
    previousYear: { type: 'string', description: 'Năm kỳ trước (VD: 2025)' },
    currentDateFrom: { type: 'string', description: 'Ngày bắt đầu kỳ hiện tại (YYYY-MM-DD). VD Q1: 2026-01-01' },
    currentDateTo: { type: 'string', description: 'Ngày kết thúc kỳ hiện tại (YYYY-MM-DD). VD Q1: 2026-03-31' },
    previousDateFrom: { type: 'string', description: 'Ngày bắt đầu kỳ trước (YYYY-MM-DD). VD Q1 năm trước: 2025-01-01' },
    previousDateTo: { type: 'string', description: 'Ngày kết thúc kỳ trước (YYYY-MM-DD). VD Q1 năm trước: 2025-03-31' },
  },
  execute: async (args, context: UserContext) => {
    // Gọi song song 2 kỳ
    const [current, previous] = await Promise.all([
      ContractService.getStats({
        dateFrom: args.currentDateFrom, dateTo: args.currentDateTo,
        year: args.currentYear, status: 'All'
      }),
      ContractService.getStats({
        dateFrom: args.previousDateFrom, dateTo: args.previousDateTo,
        year: args.previousYear, status: 'All'
      }),
    ]);

    const curVal = current.totalValue;
    const prevVal = previous.totalValue;
    const curRev = current.totalRevenue;
    const prevRev = previous.totalRevenue;
    const curCash = current.totalCash;
    const prevCash = previous.totalCash;
    const curCount = current.totalContracts;
    const prevCount = previous.totalContracts;

    // Sinh biểu đồ JSON chuẩn
    const chartJson = JSON.stringify({
      type: 'bar',
      title: `So sánh Kinh doanh ${args.currentYear} vs ${args.previousYear}`,
      xAxisKey: 'name',
      data: [
        { name: 'Ký kết', [args.previousYear]: Math.round(prevVal / 1e9 * 100) / 100, [args.currentYear]: Math.round(curVal / 1e9 * 100) / 100 },
        { name: 'Doanh thu', [args.previousYear]: Math.round(prevRev / 1e9 * 100) / 100, [args.currentYear]: Math.round(curRev / 1e9 * 100) / 100 },
        { name: 'Dòng tiền', [args.previousYear]: Math.round(prevCash / 1e9 * 100) / 100, [args.currentYear]: Math.round(curCash / 1e9 * 100) / 100 },
      ],
      lines: [
        { dataKey: args.previousYear, color: '#94a3b8', name: `Năm ${args.previousYear}` },
        { dataKey: args.currentYear, color: '#6366f1', name: `Năm ${args.currentYear}` },
      ],
      unit: 'tỷ VND',
    });

    // QUAN TRỌNG: Trả về 1 chuỗi markdown duy nhất. LLM chỉ cần paste nguyên khối!
    return `## 📊 Báo cáo So sánh Kinh doanh ${args.currentYear} vs ${args.previousYear}

### Bảng Tổng hợp

| Chỉ tiêu | Kỳ trước (${args.previousYear}) | Kỳ hiện tại (${args.currentYear}) | Chênh lệch |
|---|---|---|---|
| Số hợp đồng | ${prevCount} | ${curCount} | ${calcChange(curCount, prevCount)} |
| Giá trị ký kết | ${fmtMoney(prevVal)} | ${fmtMoney(curVal)} | ${calcChange(curVal, prevVal)} |
| Doanh thu | ${fmtMoney(prevRev)} | ${fmtMoney(curRev)} | ${calcChange(curRev, prevRev)} |
| Dòng tiền | ${fmtMoney(prevCash)} | ${fmtMoney(curCash)} | ${calcChange(curCash, prevCash)} |

### Biểu đồ So sánh

\`\`\`chart
${chartJson}
\`\`\`

Hãy dùng bảng và biểu đồ trên để phân tích, nhận xét xu hướng tăng giảm, và đề xuất hành động.`;
  }
};

// ═══════════════════════════════════════════════
// Tool 12: Xếp hạng Đơn vị theo Hiệu suất
// ═══════════════════════════════════════════════

export const getUnitRankingTool: OpenClawTool = {
  name: 'get_unit_ranking',
  description: 'Xếp hạng các đơn vị (Trung tâm) theo hiệu suất kinh doanh. Dùng khi user hỏi "đơn vị nào tốt nhất", "phòng ban nào doanh thu cao nhất", "so sánh các phòng ban".',
  schema: {
    year: { type: 'string', description: 'Năm (vd: 2026)' },
    sortBy: { type: 'string', enum: ['signing', 'revenue', 'profit'], description: 'Tiêu chí xếp hạng. Mặc định: revenue' },
  },
  execute: async (args) => {
    const year = parseInt(args.year) || new Date().getFullYear();
    const units = await UnitService.getWithStats(year);
    const sortKey = args.sortBy === 'signing' ? 'totalSigning' : args.sortBy === 'profit' ? 'totalProfit' : 'totalRevenue';

    const sorted = units
      .filter((u: any) => u.id !== 'all' && u.stats)
      .sort((a: any, b: any) => (b.stats?.[sortKey] || 0) - (a.stats?.[sortKey] || 0))
      .map((u: any, i: number) => ({
        hang: i + 1,
        donVi: u.name,
        maDonVi: u.code,
        kyKet: fmtMoney(u.stats?.totalSigning || 0),
        doanhThu: fmtMoney(u.stats?.totalRevenue || 0),
        loiNhuan: fmtMoney(u.stats?.totalProfit || 0),
        soHopDong: u.stats?.contractCount || 0,
      }));

    return {
      nam: year,
      tieuChiXepHang: sortKey,
      bangXepHang: sorted,
    };
  }
};

// ═══════════════════════════════════════════════
// Tool 13: Cảnh báo HĐ quá hạn
// ═══════════════════════════════════════════════

export const getOverdueContractsTool: OpenClawTool = {
  name: 'get_overdue_contracts',
  description: 'Lấy danh sách hợp đồng quá hạn thanh toán hoặc quá hạn hoàn thành. Dùng khi user hỏi "hợp đồng trễ", "quá hạn", "overdue", "cảnh báo".',
  schema: {
    type: { type: 'string', enum: ['payment', 'completion', 'all'], description: 'Loại quá hạn: payment (thanh toán), completion (hoàn thành), all (tất cả). Mặc định: all' },
  },
  execute: async (args, context: UserContext) => {
    const today = new Date().toISOString().split('T')[0];

    // HĐ quá hạn thanh toán: payments chưa thanh toán + quá deadline
    const overduePayments: any[] = [];
    if (args.type !== 'completion') {
      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, due_date, status, contract_id, contracts(title, customer_contract_number)')
        .in('status', ['Chưa thanh toán', 'Pending', 'Chờ thanh toán'])
        .lt('due_date', today)
        .order('due_date')
        .limit(15);
      if (payments) {
        overduePayments.push(...payments.map((p: any) => ({
          loai: '💰 Quá hạn thanh toán',
          hopDong: p.contracts?.title || '—',
          maHD: p.contracts?.customer_contract_number || '—',
          soTien: fmtMoney(p.amount || 0),
          hanChot: p.due_date,
          soNgayTre: Math.ceil((Date.now() - new Date(p.due_date).getTime()) / 86400000),
        })));
      }
    }

    // HĐ quá hạn hoàn thành: end_date < today & status = Processing
    const overdueContracts: any[] = [];
    if (args.type !== 'payment') {
      const { data: contracts } = await supabase
        .from('contracts')
        .select('id, title, customer_contract_number, end_date, value, status')
        .eq('status', 'Processing')
        .lt('end_date', today)
        .order('end_date')
        .limit(15);
      if (contracts) {
        overdueContracts.push(...contracts.map((c: any) => ({
          loai: '📋 Quá hạn hoàn thành',
          hopDong: c.title,
          maHD: c.customer_contract_number || '—',
          giaTriHD: fmtMoney(c.value || 0),
          hanHoanThanh: c.end_date,
          soNgayTre: Math.ceil((Date.now() - new Date(c.end_date).getTime()) / 86400000),
        })));
      }
    }

    const total = overduePayments.length + overdueContracts.length;
    return {
      tongSoQuaHan: total,
      quaHanThanhToan: overduePayments,
      quaHanHoanThanh: overdueContracts,
      ngayKiemTra: today,
    };
  }
};

// ═══════════════════════════════════════════════
// Tool 14: Báo cáo Công nợ
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
      .map(([id, v]) => ({ khachHang: v.name, tongNo: fmtMoney(v.total), soKhoan: v.count, noTuNgay: v.oldest }))
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
// Tool 15: Tổng hợp Dòng tiền
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
// Tool 16: Dự báo Doanh thu
// ═══════════════════════════════════════════════

export const getRevenueForecastTool: OpenClawTool = {
  name: 'get_revenue_forecast',
  description: 'Dự báo doanh thu dựa trên pipeline HĐ đang xử lý. Tính tổng giá trị HĐ chưa nghiệm thu, phân theo xác suất.',
  schema: {
    year: { type: 'string', description: 'Năm (vd: 2026)' },
  },
  execute: async (args) => {
    const year = parseInt(args.year) || new Date().getFullYear();
    
    const { data: contracts } = await supabase
      .from('contracts')
      .select('id, title, value, actual_revenue, status, end_date, unit_id, units(name)')
      .eq('status', 'Processing')
      .gte('signed_date', `${year}-01-01`)
      .order('value', { ascending: false })
      .limit(30);

    if (!contracts || contracts.length === 0) {
      return { message: 'Không có HĐ đang xử lý trong năm ' + year };
    }

    const pipeline = contracts.map((c: any) => {
      const remaining = (c.value || 0) - (c.actual_revenue || 0);
      return {
        hopDong: c.title,
        giaTriHD: fmtMoney(c.value || 0),
        daGhiNhan: fmtMoney(c.actual_revenue || 0),
        conLai: fmtMoney(Math.max(remaining, 0)),
        donVi: c.units?.name || '—',
        hanHoanThanh: c.end_date || '—',
      };
    });

    const totalValue = contracts.reduce((s: number, c: any) => s + (c.value || 0), 0);
    const totalRecognized = contracts.reduce((s: number, c: any) => s + (c.actual_revenue || 0), 0);
    const totalRemaining = totalValue - totalRecognized;

    return {
      nam: year,
      soHDDangXuLy: contracts.length,
      tongGiaTriPipeline: fmtMoney(totalValue),
      daGhiNhanDoanhThu: fmtMoney(totalRecognized),
      duBaoConLai: fmtMoney(Math.max(totalRemaining, 0)),
      chiTiet: pipeline.slice(0, 15),
    };
  }
};

// ═══════════════════════════════════════════════
// Tool 17: Khối lượng công việc nhân viên
// ═══════════════════════════════════════════════

export const getEmployeeWorkloadTool: OpenClawTool = {
  name: 'get_employee_workload',
  description: 'Xem khối lượng công việc (task) của nhân viên: bao nhiêu task đang làm, quá hạn, hoàn thành. Dùng khi user hỏi "ai đang bận", "workload", "khối lượng việc".',
  schema: {
    employeeId: { type: 'string', description: 'ID nhân viên cụ thể (để trống = top 10 bận nhất)' },
  },
  execute: async (args) => {
    // Lấy tất cả task chưa done
    const allStatuses = await TaskService.getStatuses();
    const doneIds = new Set(allStatuses.filter(s => s.is_done).map(s => s.id));
    const today = new Date().toISOString().split('T')[0];

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, assignees, status_id, due_date, completed_at')
      .is('parent_id', null);

    if (!tasks) return { message: 'Không có dữ liệu task.' };

    // Aggregate by assignee
    const workload: Record<string, { total: number; doing: number; overdue: number; done: number }> = {};
    
    for (const t of tasks) {
      const assignees: string[] = t.assignees || [];
      for (const aId of assignees) {
        if (!workload[aId]) workload[aId] = { total: 0, doing: 0, overdue: 0, done: 0 };
        workload[aId].total++;
        if (doneIds.has(t.status_id || '')) {
          workload[aId].done++;
        } else {
          workload[aId].doing++;
          if (t.due_date && t.due_date < today) workload[aId].overdue++;
        }
      }
    }

    // If specific employee requested
    if (args.employeeId) {
      const w = workload[args.employeeId] || { total: 0, doing: 0, overdue: 0, done: 0 };
      const { data: emp } = await supabase.from('employees').select('name').eq('id', args.employeeId).single();
      return {
        nhanVien: emp?.name || args.employeeId,
        tongTask: w.total,
        dangLam: w.doing,
        quaHan: w.overdue,
        hoanThanh: w.done,
      };
    }

    // Top 10 busiest
    const { data: emps } = await supabase.from('employees').select('id, name');
    const empMap: Record<string, string> = {};
    (emps || []).forEach((e: any) => { empMap[e.id] = e.name; });

    const sorted = Object.entries(workload)
      .map(([id, w]) => ({ nhanVien: empMap[id] || id, dangLam: w.doing, quaHan: w.overdue, hoanThanh: w.done, tongTask: w.total }))
      .sort((a, b) => b.dangLam - a.dangLam)
      .slice(0, 10);

    return { top10: sorted };
  }
};

// ═══════════════════════════════════════════════
// Tool 18: Phê duyệt Task trong chat
// ═══════════════════════════════════════════════

export const approveTaskTool: OpenClawTool = {
  name: 'approve_task',
  description: 'Phê duyệt hoặc từ chối một task đang chờ phê duyệt. Dùng khi user nói "duyệt", "approve", "chấp nhận task".',
  schema: {
    taskId: { type: 'string', description: 'ID của task cần phê duyệt' },
    action: { type: 'string', enum: ['approve', 'reject'], description: 'approve = phê duyệt, reject = từ chối' },
    comment: { type: 'string', description: 'Ghi chú khi phê duyệt/từ chối (tùy chọn)' },
  },
  execute: async (args, context: UserContext) => {
    try {
      const task = await TaskService.getById(args.taskId);
      if (!task) return { error: 'Không tìm thấy task.' };
      
      if (args.action === 'approve') {
        // Mark as approved: move to completed status
        const statuses = await TaskService.getStatuses();
        const doneStatus = statuses.find(s => s.is_done && s.name?.includes('Hoàn thành'));
        if (doneStatus) {
          await TaskService.update(args.taskId, { 
            status_id: doneStatus.id,
            approval_status: 'approved',
            approval_comment: args.comment || 'Đã phê duyệt qua AI Agent',
            completed_at: new Date().toISOString(),
            completed_by: context.userId,
          } as any);
        }
        const link = `/tasks?taskId=${args.taskId}`;
        return { success: true, message: `✅ Đã phê duyệt task "${task.title}".\n\n👉 [Xem chi tiết](${link})` };
      } else {
        await TaskService.update(args.taskId, {
          approval_status: 'rejected',
          approval_comment: args.comment || 'Từ chối qua AI Agent',
        } as any);
        return { success: true, message: `❌ Đã từ chối task "${task.title}". Lý do: ${args.comment || 'Không có'}` };
      }
    } catch (err: any) {
      return { error: err.message };
    }
  }
};

// ═══════════════════════════════════════════════
// Tool 19: Tra cứu kiến thức nội bộ (RAG)
// ═══════════════════════════════════════════════

export const searchKnowledgeBaseTool: OpenClawTool = {
  name: 'search_knowledge_base',
  description: 'Tra cứu kiến thức nội bộ, tài liệu công ty, quy trình, hướng dẫn từ cơ sở tri thức (Knowledge Base). Dùng khi user hỏi về quy trình, chính sách, tài liệu nội bộ.',
  schema: {
    query: { type: 'string', description: 'Câu hỏi hoặc từ khóa tìm kiếm' },
  },
  execute: async (args) => {
    try {
      // Import RAG service dynamically
      const { searchKnowledgeBase } = await import('../../../ragService');
      const results = await searchKnowledgeBase(args.query, 5);
      if (!results || results.trim().length === 0) {
        return { message: 'Không tìm thấy tài liệu nào liên quan trong Cơ sở Tri thức.' };
      }
      return { ketQua: results };
    } catch (err: any) {
      return { message: 'Hệ thống RAG chưa sẵn sàng. Lỗi: ' + err.message };
    }
  }
};

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

export const erpToolsRegistry: OpenClawTool[] = [
  searchContractsTool,
  getContractDetailTool,
  getContractStatsTool,
  searchCustomersTool,
  getDashboardKpiTool,
  searchPaymentsTool,
  searchEmployeesTool,
  createTaskAiTool,
  exportDocumentTool,
  sendNotificationEmailTool,
  getComparativeReportTool,
  getUnitRankingTool,
  // Phase 2 — New tools
  getOverdueContractsTool,
  getDebtReportTool,
  getCashflowSummaryTool,
  getRevenueForecastTool,
  getEmployeeWorkloadTool,
  approveTaskTool,
  searchKnowledgeBaseTool,
  // Phase 3 — Daily Briefing
  getDailyBriefingTool,
];
