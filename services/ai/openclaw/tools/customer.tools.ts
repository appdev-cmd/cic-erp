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

// ═══════════════════════════════════════════════
// searchCustomersTool
// ═══════════════════════════════════════════════

export const searchCustomersTool: OpenClawTool = {
  name: 'search_customers',
  description: 'Tìm kiếm khách hàng, đối tác, nhà cung cấp theo tên hoặc mã số thuế. Trả về thông tin cơ bản + thống kê hợp đồng.',
  schema: {
    search: { type: 'string', description: 'Từ khóa tìm kiếm (tên KH, tên viết tắt, MST)' },
    type: { type: 'string', description: 'Loại: Customer, Supplier, Both, all', enum: ['Customer', 'Supplier', 'Both', 'all'] },
  },
  execute: async (args, context: UserContext) => {
    const res = await CustomerService.getAll({
      page: 1,
      pageSize: 10,
      search: args.search || undefined,
      type: args.type || undefined,
    });

    // SECURITY: For unit-scoped roles, filter customers to only those with contracts in user's unit
    if (!canViewAll(context) && context.unitId) {
      const { data: unitContractCusts } = await supabase
        .from('contracts')
        .select('customer_id')
        .eq('unit_id', context.unitId);
      const allowedCustIds = new Set((unitContractCusts || []).map((c: any) => c.customer_id));
      const filtered = res.data.filter(c => allowedCustIds.has(c.id));
      return filtered.map(c => ({
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
// getCustomer360Tool
// ═══════════════════════════════════════════════

export const getCustomer360Tool: OpenClawTool = {
  name: 'get_customer_360',
  description: 'Xem hồ sơ 360° của khách hàng/đối tác: tổng HĐ, doanh thu, lịch sử thanh toán, công nợ, đánh giá. Dùng khi user hỏi "tình hình khách hàng X", "khách hàng ABC thế nào".',
  schema: {
    customerId: { type: 'string', description: 'ID khách hàng (nếu biết)' },
    customerName: { type: 'string', description: 'Tên khách hàng (dùng khi chưa biết ID)' },
  },
  execute: async (args, context: UserContext) => {
    let customerId = args.customerId;

    // Tìm theo tên nếu không có ID
    if (!customerId && args.customerName) {
      const { data: found } = await supabase
        .from('customers')
        .select('id, name')
        .ilike('name', `%${args.customerName}%`)
        .limit(1);
      if (found && found.length > 0) {
        customerId = found[0].id;
      } else {
        return { error: `Không tìm thấy khách hàng tên "${args.customerName}"` };
      }
    }

    if (!customerId) return { error: 'Cần cung cấp customerId hoặc customerName' };

    // Lấy thông tin KH
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (!customer) return { error: 'Không tìm thấy khách hàng.' };

    // Lấy HĐ liên quan
    // SECURITY: Apply unit filter for non-global roles
    const forcedUnitId = getUnitFilter(args, context);
    let contractQuery = supabase
      .from('contracts')
      .select('id, title, value, actual_revenue, cash_received, status, signed_date, end_date, unit_id')
      .eq('customer_id', customerId)
      .order('signed_date', { ascending: false })
      .limit(20);
    if (forcedUnitId) {
      contractQuery = contractQuery.eq('unit_id', forcedUnitId);
    }
    const { data: contracts } = await contractQuery;

    const allContracts = contracts || [];
    const totalContracts = allContracts.length;
    const totalValue = allContracts.reduce((s, c: any) => s + (c.value || 0), 0);
    const totalRevenue = allContracts.reduce((s, c: any) => s + (c.actual_revenue || 0), 0);
    const totalCash = allContracts.reduce((s, c: any) => s + (c.cash_received || 0), 0);
    const activeContracts = allContracts.filter((c: any) => c.status === 'Processing').length;

    // Lấy công nợ
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, paid_amount, due_date, status')
      .in('contract_id', allContracts.map((c: any) => c.id))
      .in('status', ['Chưa thanh toán', 'Pending', 'Đã xuất HĐ', 'Đã giao KH']);

    let totalDebt = 0;
    let overdueDebt = 0;
    const today = new Date().toISOString().split('T')[0];
    (payments || []).forEach((p: any) => {
      const owing = (p.amount || 0) - (p.paid_amount || 0);
      if (owing > 0) {
        totalDebt += owing;
        if (p.due_date && p.due_date < today) overdueDebt += owing;
      }
    });

    let md = `## 🏢 HỒ SƠ KHÁCH HÀNG 360°: ${customer.name}\n\n`;
    md += `### Thông tin cơ bản\n`;
    md += `- **Tên**: ${customer.name}\n`;
    md += `- **MST**: ${customer.tax_code || '—'}\n`;
    md += `- **Loại**: ${customer.type || '—'}\n`;
    md += `- **Ngành**: ${Array.isArray(customer.industry) ? customer.industry.join(', ') : customer.industry || '—'}\n`;
    md += `- **Đánh giá**: ${customer.rating || '—'}\n\n`;

    md += `### Tổng quan Hợp đồng\n`;
    md += `| Chỉ số | Giá trị |\n|---|---|\n`;
    md += `| Tổng số HĐ | **${totalContracts}** |\n`;
    md += `| HĐ đang thực hiện | **${activeContracts}** |\n`;
    md += `| Tổng giá trị ký kết | **${fmtMoney(totalValue)}** |\n`;
    md += `| Doanh thu đã ghi nhận | **${fmtMoney(totalRevenue)}** |\n`;
    md += `| Tiền đã thu | **${fmtMoney(totalCash)}** |\n`;
    md += `| Công nợ phải thu | **${fmtMoney(totalDebt)}** |\n`;
    if (overdueDebt > 0) {
      md += `| 🚨 Nợ quá hạn | **${fmtMoney(overdueDebt)}** |\n`;
    }

    md += `\n### Danh sách HĐ gần nhất\n`;
    md += `| Tên HĐ | Giá trị | Trạng thái |\n|---|---|---|\n`;
    allContracts.slice(0, 10).forEach((c: any) => {
      md += `| ${c.title?.substring(0, 40)} | ${fmtMoney(c.value || 0)} | ${c.status} |\n`;
    });

    // Đề xuất
    const suggestions: string[] = [];
    if (overdueDebt > 0) suggestions.push(`🚨 Cần liên hệ thu hồi ${fmtMoney(overdueDebt)} nợ quá hạn`);
    if (activeContracts > 3) suggestions.push(`📋 Đang có ${activeContracts} HĐ hoạt động — cần theo dõi sát tiến độ`);
    if (totalContracts >= 5) suggestions.push(`⭐ Khách hàng lớn (${totalContracts} HĐ) — nên duy trì mối quan hệ`);

    if (suggestions.length > 0) {
      md += `\n### 💡 Đề xuất\n`;
      suggestions.forEach(s => { md += `- ${s}\n`; });
    }

    md += `\n*(AI Instruction: Phân tích tổng quan khách hàng này: đánh giá mức độ quan trọng, rủi ro công nợ, và gợi ý hành động)*`;

    return md;
  }
};

// ═══════════════════════════════════════════════
// getCrmPipelineTool
// ═══════════════════════════════════════════════
export const getCrmPipelineTool: OpenClawTool = {
  name: 'get_crm_pipeline',
  description: 'Tổng hợp phễu bán hàng CRM (CRM Pipeline): số lượng Leads, Deals, và tỷ lệ chuyển đổi qua các giai đoạn (Stages). Dùng khi user hỏi "CRM", "phễu bán hàng", "lead mới", "deal".',
  schema: {
    unitId: { type: 'string', description: 'ID đơn vị cần lọc (để trống = toàn công ty)' }
  },
  execute: async (args, context: UserContext) => {
    const forcedUnitId = getUnitFilter(args, context);

    const { CrmLeadService, CrmDealService, CrmStageTemplateService } = await import('../../../crmService');

    // Load song song dữ liệu
    const [leads, deals, leadStages, dealStages] = await Promise.all([
      CrmLeadService.getAll(forcedUnitId || undefined),
      CrmDealService.getAll(forcedUnitId || undefined),
      CrmStageTemplateService.getAll('lead'),
      CrmStageTemplateService.getAll('deal')
    ]);

    // Thống kê Leads theo Stages
    const leadCountByStage: Record<string, number> = {};
    leadStages.forEach((s: any) => { leadCountByStage[s.name] = 0; });
    leads.forEach((l: any) => {
      const stageName = l.stage?.name || 'Chưa phân loại';
      leadCountByStage[stageName] = (leadCountByStage[stageName] || 0) + 1;
    });

    // Thống kê Deals theo Stages
    const dealCountByStage: Record<string, number> = {};
    const dealValueByStage: Record<string, number> = {};
    dealStages.forEach((s: any) => {
      dealCountByStage[s.name] = 0;
      dealValueByStage[s.name] = 0;
    });
    deals.forEach((d: any) => {
      const stageName = d.stage?.name || 'Chưa phân loại';
      dealCountByStage[stageName] = (dealCountByStage[stageName] || 0) + 1;
      dealValueByStage[stageName] = (dealValueByStage[stageName] || 0) + (d.value || 0);
    });

    const totalLeads = leads.length;
    const totalDeals = deals.length;
    const totalDealsValue = deals.reduce((sum: number, d: any) => sum + (d.value || 0), 0);

    const units = await UnitService.getAll();
    const unitMap = units.reduce((acc: any, u: any) => { acc[u.id] = u.name; return acc; }, {});

    return {
      tongLeads: totalLeads,
      tongDeals: totalDeals,
      tongGiaTriDeals: fmtMoney(totalDealsValue),
      leadsTheoGiaiDoan: leadCountByStage,
      dealsTheoGiaiDoan: Object.keys(dealCountByStage).map(stage => ({
        giaiDoan: stage,
        soLuong: dealCountByStage[stage],
        giaTri: fmtMoney(dealValueByStage[stage])
      })),
      topLeadsMoi: leads.slice(0, 5).map((l: any) => ({
        ten: l.name,
        congTy: l.company || '—',
        nguon: l.source || '—',
        giaiDoan: l.stage?.name || '—',
        nguoiPhuTrach: l.assignee?.full_name || '—'
      })),
      topDealsLon: deals
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
        .slice(0, 5)
        .map((d: any) => ({
          ten: d.title,
          giaTri: fmtMoney(d.value || 0),
          khachHang: d.customer?.name || '—',
          giaiDoan: d.stage?.name || '—',
          nguoiPhuTrach: d.assignee?.full_name || '—'
        }))
    };
  }
};

