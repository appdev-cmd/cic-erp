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
// searchProductsTool
// ═══════════════════════════════════════════════

export const searchProductsTool: OpenClawTool = {
  name: 'search_products',
  description: 'Tìm kiếm sản phẩm cụ thể. CHÚ Ý: CHỈ DÙNG để tìm TỪNG sản phẩm lẻ. KHÔNG DÙNG tool này khi user yêu cầu "thống kê doanh thu các hãng", phải dùng tool get_brands_report thay thế.',
  schema: {
    search: { type: 'string', description: 'Từ khóa tìm kiếm (tên sản phẩm, mã, hoặc thương hiệu hãng)' },
    year: { type: 'string', description: 'Năm cần xem kết quả (vd: 2026, 2025, hoặc bỏ trống)' }
  },
  execute: async (args, context: UserContext) => {
    const res = await ProductService.list({
      page: 1, limit: 50,
      search: args.search,
      year: args.year
    });
    return res.data.map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      basePrice: fmtMoney(p.basePrice || 0),
      totalContractValue: fmtMoney(p.totalContractValue || 0),
      totalRevenue: fmtMoney(p.totalRevenue || 0)
    }));
  }
};

// ═══════════════════════════════════════════════
// getBrandsReportTool
// ═══════════════════════════════════════════════

export const getBrandsReportTool: OpenClawTool = {
  name: 'get_brands_report',
  description: 'Báo cáo thống kê kết quả kinh doanh (ký kết, doanh thu, số sản phẩm) QUY MÔ TOÀN CÔNG TY nhóm theo Hãng Sản Xuất (Brands). Dùng BẮT BUỘC khi user yêu cầu "thống kê doanh thu các hãng", "báo cáo doanh thu hãng", "doanh thu bentley/autodesk".',
  schema: {
    year: { type: 'string', description: 'Năm cần xem báo cáo (vd: 2026). Để trống là Tất cả năm.' },
    period: { type: 'string', description: 'Kỳ lọc (vd: Q1, M4) hoặc bỏ trống' }
  },
  execute: async (args, context: UserContext) => {
    try {
      const { BrandService } = await import('../../../brandService');
      const yearStr = args.year || 'All';
      const periodStr = args.period || 'Toàn thời gian';

      const brands = await BrandService.getAllWithStats('all', yearStr, periodStr);

      if (!brands || brands.length === 0) return 'Không có dữ liệu hợp lệ.';

      // Sort by Revenue descending
      brands.sort((a: any, b: any) => (b.totalRevenue || 0) - (a.totalRevenue || 0));

      let totalSigning = 0, totalRevenue = 0;
      let md = `## 🏢 BÁO CÁO KẾT QUẢ KINH DOANH THEO HÃNG SẢN XUẤT (${yearStr})\n\n`;
      md += `| Hãng sản xuất | Số SP | Tổng ký kết (Hợp đồng) | Tổng doanh thu thực |\n`;
      md += `|:---|---:|---:|---:|\n`;

      brands.forEach((b: any) => {
        if ((b.totalContractValue || 0) > 0 || (b.totalRevenue || 0) > 0) {
          md += `| **${b.name}** | ${b.productCount || 0} | ${fmtMoney(b.totalContractValue || 0)} | ${fmtMoney(b.totalRevenue || 0)} |\n`;
          totalSigning += (b.totalContractValue || 0);
          totalRevenue += (b.totalRevenue || 0);
        }
      });

      md += `| **TỔNG CỘNG** | | **${fmtMoney(totalSigning)}** | **${fmtMoney(totalRevenue)}** |\n\n`;
      md += `*(AI Instruction: BẮT BUỘC sử dụng lại toàn bộ bảng markdown này xuất ra cho user, và vẽ biểu đồ Pie chart thể hiện cơ cấu tỷ trọng Ký Kết của các Hãng lớn nhất)*`;
      return md;
    } catch (e: any) {
      return { error: 'Lỗi khi gọi thống kê Hãng: ' + e.message };
    }
  }
};

