// @ts-nocheck
import { ContractService } from '../../../contractService';
import type { OpenClawTool, UserContext } from '../types';
import { dataClient as supabase } from '../../../../lib/dataClient';
import { fmtMoney, fmtMoneyWithRaw, canViewAll, getUnitFilter } from './_helpers';

// ═══════════════════════════════════════════════
// searchContractsTool
// ═══════════════════════════════════════════════

export const searchContractsTool: OpenClawTool = {
  name: 'search_contracts',
  description: 'Tìm kiếm hợp đồng theo từ khóa, thời gian, trạng thái, phòng ban. Dùng để lấy danh sách hợp đồng cụ thể, hoặc tìm TOP N hợp đồng lớn nhất/nhỏ nhất (sử dụng sortBy="value" và sortDir="desc").',
  schema: {
    search: { type: 'string', description: 'Từ khóa tìm kiếm (tên, mã hợp đồng, khách hàng)' },
    status: { type: 'string', description: 'Trạng thái (Processing, Completed, Suspended, Cancelled)', enum: ['Processing', 'Completed', 'Suspended', 'Cancelled', 'All'] },
    unitId: { type: 'string', description: 'Mã phòng ban (nếu cần lọc theo phòng cụ thể)' },
    year: { type: 'string', description: 'Năm (vd: 2026, 2025)' },
    dateFrom: { type: 'string', description: 'Từ ngày (YYYY-MM-DD)' },
    dateTo: { type: 'string', description: 'Đến ngày (YYYY-MM-DD)' },
    sortBy: { type: 'string', description: 'Trường để sắp xếp (vd: value, signedDate)' },
    sortDir: { type: 'string', description: 'Chiều sắp xếp (asc hoặc desc)', enum: ['asc', 'desc'] },
    limit: { type: 'number', description: 'Số lượng kết quả trả về (mặc định 10, tối đa 50)' }
  },
  execute: async (args, context: UserContext) => {
    // Phân quyền: nếu unit-scoped, tự filter theo đơn vị mình
    let unitFilter = args.unitId || undefined;
    if (!canViewAll(context) && context.unitId) {
      unitFilter = context.unitId;
    }

    const limit = args.limit ? Math.min(Number(args.limit), 50) : 10;

    const res = await ContractService.list({
      page: 1, limit,
      search: args.search,
      status: args.status,
      year: args.year,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
      unitId: unitFilter,
      sortBy: args.sortBy,
      sortDir: args.sortDir as 'asc' | 'desc' | undefined
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
// getContractDetailTool
// ═══════════════════════════════════════════════

export const getContractDetailTool: OpenClawTool = {
  name: 'get_contract_detail',
  description: 'Lấy thông tin chi tiết đầy đủ của 1 hợp đồng: giá trị, tiến độ thanh toán, rủi ro. Dùng khi user hỏi chi tiết 1 HĐ cụ thể.',
  schema: {
    contractId: { type: 'string', description: 'ID hợp đồng' }
  },
  execute: async (args, context: UserContext) => {
    const data = await ContractService.getById(args.contractId);
    if (!data) return "Không tìm thấy hợp đồng.";

    // SECURITY: Check unit ownership for non-global roles
    if (!canViewAll(context) && context.unitId && (data as any).unitId !== context.unitId) {
      return "Truy cập bị từ chối: Hợp đồng này không thuộc đơn vị của bạn.";
    }

    const totalValue = data.value || 0;
    const totalRevenue = data.actualRevenue || 0;
    const totalCash = data.cashReceived || 0;
    const receivables = data.receivables || 0;
    const today = new Date().toISOString().split('T')[0];

    // Tính tiến độ thanh toán
    const paymentProgress = totalValue > 0 ? ((totalCash / totalValue) * 100).toFixed(1) : '0';

    // Phát hiện rủi ro
    const riskFlags: string[] = [];
    if (data.status === 'Processing' && data.endDate && data.endDate < today) {
      const daysLate = Math.ceil((Date.now() - new Date(data.endDate).getTime()) / 86400000);
      riskFlags.push(`🔴 Quá hạn hoàn thành ${daysLate} ngày`);
    }
    if (receivables > 0) {
      riskFlags.push(`💰 Công nợ phải thu: ${fmtMoney(receivables)}`);
    }
    const overduePhases = (data.paymentPhases || []).filter((p: any) =>
      (p.status === 'Chưa thanh toán' || p.status === 'Pending') && p.dueDate && p.dueDate < today
    );
    if (overduePhases.length > 0) {
      riskFlags.push(`⚠️ ${overduePhases.length} đợt thanh toán trễ hạn`);
    }

    return {
      title: data.title,
      code: data.contractCode,
      giaTriHD: fmtMoney(totalValue),
      doanhThuThucHien: fmtMoney(totalRevenue),
      tienDaThu: fmtMoney(totalCash),
      tienConLai: fmtMoney(Math.max(totalValue - totalCash, 0)),
      tienDoThanhToan: `${paymentProgress}%`,
      congNoPhaiThu: fmtMoney(receivables),
      trangThai: data.status,
      loaiHD: data.category,
      ngayKy: data.signedDate || '—',
      ngayKetThuc: data.endDate || '—',
      noiDungHopDong: data.content || '—',
      chiPhiUocTinh: fmtMoney(data.estimatedCost || 0),
      sanPhamDichVu: data.lineItems?.map((li: any) => ({
        ten: li.name || '—',
        soLuong: li.quantity || 1,
        donGiaGoc: fmtMoney(li.inputPrice || 0),
        donGiaBan: fmtMoney(li.outputPrice || 0),
        loiNhuanDuKien: fmtMoney((li.outputPrice || 0) - (li.inputPrice || 0))
      })),
      cacDotThanhToan: data.paymentPhases?.map((p: any) => ({
        soTien: fmtMoney(p.amount || 0),
        trangThai: p.status,
        hanChot: p.dueDate || '—',
        quaHan: (p.status === 'Chưa thanh toán' || p.status === 'Pending') && p.dueDate && p.dueDate < today
      })),
      canhBaoRuiRo: riskFlags.length > 0 ? riskFlags : ['✅ Không có cảnh báo'],
    };
  }
};

// ═══════════════════════════════════════════════
// getContractStatsTool
// ═══════════════════════════════════════════════

export const getContractStatsTool: OpenClawTool = {
  name: 'get_contract_stats',
  description: 'Lấy thống kê tổng quan: Tổng doanh thu, Tổng giá trị, Số lượng. ĐẶC BIÊT DÙNG KHI CẦN HỎI TỔNG QUAN, TỈ LỆ, CƠ CẤU (Bao nhiêu HĐ Mới, Bao nhiêu Gia hạn, Tỉ lệ các Đơn vị như thế nào), và tìm HỢP ĐỒNG LỚN NHẤT / NHỎ NHẤT. Không dùng search_contracts để đếm số lượng vì nó sẽ bị limit 10 hợp đồng.',
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

    // Format values in max/min
    const maxContract = res.maxContract ? { ...res.maxContract, value: fmtMoneyWithRaw(res.maxContract.value) } : null;
    const minContract = res.minContract ? { ...res.minContract, value: fmtMoneyWithRaw(res.minContract.value) } : null;
    const unitBreakdown = Object.entries(res.unitBreakdown || {}).map(([unit, data]: [string, any]) => ({
      donVi: unit === 'UNKNOWN' ? 'Khác' : unit,
      soLuongHopDong: data.count,
      giaTri: fmtMoneyWithRaw(data.value)
    }));

    return {
      tongSoHopDong: res.totalContracts,
      hopDongMoi: res.newContractsCount || 0,
      hopDongGiaHan: res.renewalContractsCount || 0,
      tongGiaTriKyKet: fmtMoneyWithRaw(res.totalValue),
      tongDoanhThu: fmtMoneyWithRaw(res.totalRevenue),
      dongTienThucNhan: fmtMoneyWithRaw(res.totalCash),
      phanBoTheoDonVi: unitBreakdown,
      hopDongLonNhat: maxContract,
      hopDongNhoNhat: minContract
    };
  }
};

// ═══════════════════════════════════════════════
// getOverdueContractsTool
// ═══════════════════════════════════════════════

export const getOverdueContractsTool: OpenClawTool = {
  name: 'get_overdue_contracts',
  description: 'Lấy danh sách hợp đồng quá hạn thanh toán hoặc quá hạn hoàn thành. Dùng khi user hỏi "hợp đồng trễ", "quá hạn", "overdue", "cảnh báo".',
  schema: {
    type: { type: 'string', enum: ['payment', 'completion', 'all'], description: 'Loại quá hạn: payment (thanh toán), completion (hoàn thành), all (tất cả). Mặc định: all' },
  },
  execute: async (args, context: UserContext) => {
    // Ép buộc phạm vi dữ liệu
    const forcedUnitId = getUnitFilter(args, context);

    const today = new Date().toISOString().split('T')[0];

    // HĐ quá hạn thanh toán: payments chưa thanh toán + quá deadline
    const overduePayments: any[] = [];
    if (args.type !== 'completion') {
      let query = supabase
        .from('payments')
        .select('id, amount, due_date, status, contract_id, contracts!inner(title, customer_contract_number, unit_id)')
        .in('status', ['Chưa thanh toán', 'Pending', 'Chờ thanh toán'])
        .lt('due_date', today)
        .order('due_date')
        .limit(15);
        
      if (forcedUnitId) {
        query = query.eq('contracts.unit_id', forcedUnitId);
      }

      const { data: payments } = await query;
      if (payments) {
        overduePayments.push(...payments.map((p: any) => ({
          loai: '💰 Quá hạn thanh toán',
          hopDong: p.contracts?.title || '—',
          maHD: p.contracts?.customer_contract_number || '—',
          soTien: fmtMoney(p.amount || 0),
          hanChot: p.due_date,
          soNgayTre: Math.ceil((Date.now() - new Date(p.due_date).getTime()) / 86400000),
          id: p.contract_id,
        })));
      }
    }

    // HĐ quá hạn hoàn thành: end_date < today & status = Processing
    const overdueContracts: any[] = [];
    if (args.type !== 'payment') {
      let query = supabase
        .from('contracts')
        .select('id, title, customer_contract_number, end_date, value, status, unit_id')
        .eq('status', 'Processing')
        .lt('end_date', today)
        .order('end_date')
        .limit(15);
        
      if (forcedUnitId) {
        query = query.eq('unit_id', forcedUnitId);
      }

      const { data: contracts } = await query;
      if (contracts) {
        overdueContracts.push(...contracts.map((c: any) => ({
          loai: '📋 Quá hạn hoàn thành',
          hopDong: c.title,
          maHD: c.customer_contract_number || '—',
          giaTriHD: fmtMoney(c.value || 0),
          hanHoanThanh: c.end_date,
          soNgayTre: Math.ceil((Date.now() - new Date(c.end_date).getTime()) / 86400000),
          id: c.id,
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
// getContractExpiryTimelineTool
// ═══════════════════════════════════════════════

export const getContractExpiryTimelineTool: OpenClawTool = {
  name: 'get_contract_expiry_timeline',
  description: 'Xem timeline HĐ sắp hết hạn trong 30/60/90 ngày tới. Dùng khi user hỏi "HĐ nào sắp hết hạn", "thanh lý HĐ", "gia hạn HĐ".',
  schema: {
    days: { type: 'string', description: 'Số ngày tới (30, 60, 90). Mặc định: 60' },
  },
  execute: async (args, context: UserContext) => {
    const forcedUnitId = getUnitFilter(args, context);
    
    const days = parseInt(args.days) || 60;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    const todayStr = today.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];

    let query = supabase
      .from('contracts')
      .select('id, title, contract_code, value, actual_revenue, end_date, status, unit_id, units(name)')
      .gte('end_date', todayStr)
      .lte('end_date', futureStr)
      .eq('status', 'Processing')
      .order('end_date')
      .limit(30);

    if (forcedUnitId) {
      query = query.eq('unit_id', forcedUnitId);
    }

    const { data: contracts } = await query;

    if (!contracts || contracts.length === 0) {
      return `Không có HĐ nào hết hạn trong ${days} ngày tới. ✅`;
    }

    const totalValue = contracts.reduce((s, c: any) => s + (c.value || 0), 0);

    let md = `## 📅 TIMELINE HĐ SẮP HẾT HẠN (${days} ngày tới)\n\n`;
    md += `**Tổng cộng:** ${contracts.length} HĐ — Giá trị: **${fmtMoney(totalValue)}**\n\n`;

    md += `| # | Hết hạn | Mã HĐ | Tên HĐ | Giá trị | Đơn vị | Còn |\n`;
    md += `|---|---|---|---|---|---|---|\n`;

    contracts.forEach((c: any, i: number) => {
      const daysLeft = Math.ceil((new Date(c.end_date).getTime() - today.getTime()) / 86400000);
      const urgency = daysLeft <= 7 ? '🔴' : daysLeft <= 30 ? '🟡' : '🟢';
      md += `| ${i + 1} | ${c.end_date} | ${c.contract_code || '—'} | ${c.title?.substring(0, 35)} | ${fmtMoney(c.value || 0)} | ${(c as any).units?.name || '—'} | ${urgency} ${daysLeft} ngày |\n`;
    });

    // Phân nhóm theo urgency
    const urgent = contracts.filter((c: any) => {
      const d = Math.ceil((new Date(c.end_date).getTime() - today.getTime()) / 86400000);
      return d <= 7;
    });
    const soon = contracts.filter((c: any) => {
      const d = Math.ceil((new Date(c.end_date).getTime() - today.getTime()) / 86400000);
      return d > 7 && d <= 30;
    });

    md += `\n### Tóm tắt\n`;
    md += `- 🔴 **Cần xử lý ngay** (≤ 7 ngày): ${urgent.length} HĐ\n`;
    md += `- 🟡 **Lên kế hoạch** (8-30 ngày): ${soon.length} HĐ\n`;
    md += `- 🟢 **Theo dõi** (>30 ngày): ${contracts.length - urgent.length - soon.length} HĐ\n`;

    md += `\n*(AI Instruction: Phân tích HĐ nào cần gia hạn, HĐ nào cần thanh lý. Đề xuất cụ thể cho mỗi nhóm 🔴)*`;

    return md;
  }
};

