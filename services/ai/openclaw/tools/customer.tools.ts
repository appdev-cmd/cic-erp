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
// searchCustomersTool
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
// getCustomer360Tool
// ═══════════════════════════════════════════════

export const getCustomer360Tool: OpenClawTool = {
  name: 'get_customer_360',
  description: 'Xem hồ sơ 360° của khách hàng/đối tác: tổng HĐ, doanh thu, lịch sử thanh toán, công nợ, đánh giá. Dùng khi user hỏi "tình hình khách hàng X", "khách hàng ABC thế nào".',
  schema: {
    customerId: { type: 'string', description: 'ID khách hàng (nếu biết)' },
    customerName: { type: 'string', description: 'Tên khách hàng (dùng khi chưa biết ID)' },
  },
  execute: async (args) => {
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
    const { data: contracts } = await supabase
      .from('contracts')
      .select('id, title, value, actual_revenue, cash_received, status, signed_date, end_date')
      .eq('customer_id', customerId)
      .order('signed_date', { ascending: false })
      .limit(20);

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

