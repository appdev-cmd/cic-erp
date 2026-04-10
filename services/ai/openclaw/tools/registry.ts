import { ContractService } from '../../../contractService';
import { CustomerService } from '../../../customerService';
import { PaymentService } from '../../../paymentService';
import { UnitService } from '../../../unitService';
import type { OpenClawTool, UserContext } from '../types';
import { GLOBAL_VIEW_ROLES } from '../../../../lib/permissions';

/** Helper: format số thành chuỗi tiền tệ dễ đọc */
const fmtMoney = (v: number): string => {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} tỷ VND`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} triệu VND`;
  return `${v.toLocaleString('vi-VN')} VND`;
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
      tongGiaTriKyKet: fmtMoney(res.totalValue),
      tongDoanhThu: fmtMoney(res.totalRevenue),
      dongTienThucNhan: fmtMoney(res.totalCash),
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
  description: 'Lấy KPI tổng quan toàn công ty hoặc từng đơn vị: Ký kết, Doanh thu, Lợi nhuận QT, số hợp đồng. Dùng khi user hỏi "tổng quan", "KPI", "tiến độ".',
  schema: {
    unitId: { type: 'string', description: 'ID đơn vị (để trống = toàn công ty)' },
    year: { type: 'string', description: 'Năm (vd: 2026). Mặc định năm hiện tại.' },
  },
  execute: async (args, context: UserContext) => {
    const year = args.year ? parseInt(args.year) : new Date().getFullYear();

    if (args.unitId) {
      // KPI 1 đơn vị cụ thể
      const stats = await UnitService.getStats(args.unitId, year);
      return {
        kyKet: fmtMoney(stats.totalSigning || 0),
        doanhThu: fmtMoney(stats.totalRevenue || 0),
        loiNhuanQT: fmtMoney(stats.totalProfit || 0),
        soHopDong: stats.contractCount || 0,
      };
    }

    // Toàn công ty: lấy tất cả đơn vị + tổng
    const units = await UnitService.getWithStats(year);
    const results = units
      .filter((u: any) => u.id !== 'all')
      .map((u: any) => ({
        tenDonVi: u.name,
        maDonVi: u.code,
        kyKet: fmtMoney(u.stats?.totalSigning || 0),
        doanhThu: fmtMoney(u.stats?.totalRevenue || 0),
        loiNhuanQT: fmtMoney(u.stats?.totalProfit || 0),
        soHopDong: u.stats?.contractCount || 0,
        soNhanVien: u.employeeCount || 0,
      }));

    // Tổng hợp
    const totals = {
      tongKyKet: fmtMoney(results.reduce((s: number, r: any) => s + (parseFloat(r.kyKet) || 0), 0)),
      tongDoanhThu: fmtMoney(results.reduce((s: number, r: any) => s + (parseFloat(r.doanhThu) || 0), 0)),
    };

    return { nam: year, danhSachDonVi: results, tongHop: totals };
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
export const erpToolsRegistry: OpenClawTool[] = [
  searchContractsTool,
  getContractDetailTool,
  getContractStatsTool,
  searchCustomersTool,
  getDashboardKpiTool,
  searchPaymentsTool,
];
