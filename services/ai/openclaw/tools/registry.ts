import { ContractService } from '../../../contractService';
import { CustomerService } from '../../../customerService';
import { PaymentService } from '../../../paymentService';
import { UnitService } from '../../../unitService';
import type { OpenClawTool, UserContext } from '../types';
import { dataClient as supabase } from '../../../../lib/dataClient';
import { fmtMoney, fmtMoneyWithRaw, calcChange, canViewAll, isBusinessUnit, getUnitFilter } from './_helpers';


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
  description: 'Lấy thông tin chi tiết đầy đủ của 1 hợp đồng: giá trị, tiến độ thanh toán, rủi ro. Dùng khi user hỏi chi tiết 1 HĐ cụ thể.',
  schema: {
    contractId: { type: 'string', description: 'ID hợp đồng' }
  },
  execute: async (args) => {
    const data = await ContractService.getById(args.contractId);
    if (!data) return "Không tìm thấy hợp đồng.";
    
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
// Tool 3: Thống kê hợp đồng
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
      .filter(isBusinessUnit)
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
  description: 'Tìm kiếm nhân sự theo tên (ví dụ: Trần Văn A) hoặc Tên phòng ban (ví dụ: trung tâm BIM, phòng Hành chính). LƯU Ý: NẾU TRONG [CONTEXT] ĐÃ CÓ MÃ ID NHÂN SỰ RỒI THÌ BỎ QUA TOOL NÀY VÀ DÙNG LUÔN ID ĐÓ CHO CREATE_TASK MÀ KHÔNG CẦN TÌM KIẾM!',
  schema: {
    searchName: { type: 'string', description: 'Tên nhân sự hoặc Tên Phòng Ban (VD: BIM, Kế Toán) cần tìm' }
  },
  execute: async (args) => {
    let term = args.searchName.replace('@', '').trim();
    // Bỏ các chữ dư thừa để tìm chính xác hơn
    const excludeWords = ['phòng ', 'trung tâm ', 'phong ', 'trung tam '];
    for (const w of excludeWords) {
      if (term.toLowerCase().startsWith(w)) {
        term = term.substring(w.length).trim();
      }
    }

    // 1. Tìm trong bảng employees (Hỗ trợ cả tên và phòng ban)
    const { data: emps } = await supabase
      .from('employees')
      .select('id, name, position, department')
      .or(`name.ilike.%${term}%,department.ilike.%${term}%`)
      .limit(30);

    let results = [];
    if (emps && emps.length > 0) {
      results = emps.map((e: any) => ({
        id: e.id,
        ten: e.name,
        thongTin: `${e.position || 'Nhân viên'} - ${e.department || 'Chưa rõ phòng'}`
      }));
    } else {
      // 2. Fallback tìm profiles (Cho những user admin hoặc user mới chưa nhập HR)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .ilike('full_name', `%${term}%`)
        .limit(10);
      
      if (profiles && profiles.length > 0) {
        results = profiles.map((e: any) => ({
          id: e.id,
          ten: e.full_name,
          thongTin: e.email || '—'
        }));
      }
    }

    if (results.length === 0) return { error: `Không tìm thấy ai liên quan đến từ khóa: ${term}` };
    return results;
  }
};

export const createTaskAiTool: OpenClawTool = {
  name: 'create_task_ai',
  description: 'Tạo công việc (Task) lên hệ thống Kanban và giao việc cho nhân sự.',
  schema: {
    title: { type: 'string', description: 'Tiêu đề công việc' },
    description: { type: 'string', description: 'Mô tả chi tiết công việc' },
    assigneeIds: { type: 'array', items: { type: 'string' }, description: 'Danh sách ID nhân viên. BẮT BUỘC LẤY ID TỪ MỤC [CONTEXT] NẾU CÓ. CHỈ GỌI TOOL search_employees KHI TRONG CONTEXT KHÔNG CÓ ID.' },
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
  description: 'Tạo và đóng gói file báo cáo và trả về Link Tải xuống. \nCHỈ SỬ DỤNG KHI USER YÊU CẦU "XUẤT RA FILE", "LƯU THÀNH FILE", HOẶC "TẢI XUỐNG". Tuyệt đối không tự ý gọi tool này nếu user chỉ yêu cầu "Lập báo cáo". \nLƯU Ý QUAN TRỌNG: \n1. Khách hàng thường thích BÁO CÁO CỰC KỲ CHI TIẾT. Hãy viết Thuyết minh dài, phân tích sâu.\n2. Nếu có dữ liệu số, HÃY tận dụng cú pháp markdown ` ```chart ` để nhúng biểu đồ (đặc biệt là biểu đồ doanh thu hàng tháng, so sánh, v.v..).\n3. Nếu báo cáo ĐANG CÓ BIỂU ĐỒ, bạn **PHẢI** chọn format=html (Bắt buộc) để người dùng xem được màu sắc, tương tác.\n4. Nếu chỉ xuất văn bản đơn thuần để in, mới dùng doc.',
  schema: {
    title: { type: 'string', description: 'Tên báo cáo' },
    content: { type: 'string', description: 'Nội dung văn bản Markdown cực kỳ chi tiết có kèm biểu đồ ` ```chart ` nếu phù hợp' },
    format: { type: 'string', enum: ['doc', 'html'], description: 'Định dạng file xuất ra.' }
  },
  execute: async (args) => {
    try {
      const { marked } = await import('marked');
      const isHtml = args.format === 'html';

      // 1. Phân tích Chart Json
      let chartIds = 0;
      const safeContentForExport = args.content.replace(/```chart\s*([\s\S]*?)```/gim, (match, jsonString) => {
        if (!isHtml) {
          return '\n\n*[Biểu đồ động bị ẩn khi xuất file Word. Vui lòng xem trên nền tảng CIC ERP để tương tác với biểu đồ]*\n\n';
        }
        
        try {
            const config = JSON.parse(jsonString);
            chartIds++;
            const id = 'aiChart_' + chartIds;
            
            let datasets = [];
            if (config.lines && Array.isArray(config.lines)) {
                 datasets = config.lines.map((line: any) => ({
                     label: line.name || line.dataKey,
                     data: config.data.map((d: any) => d[line.dataKey]),
                     backgroundColor: line.color || '#3b82f6',
                     borderColor: line.color || '#3b82f6',
                     borderWidth: 2,
                     borderRadius: config.type === 'bar' ? 4 : 0
                 }));
            }

            const chartJsConfig = {
                type: config.type === 'bar' ? 'bar' : 'line',
                data: {
                    labels: config.data.map((d: any) => d[config.xAxisKey || 'month' || 'name']),
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' },
                        title: { display: !!config.title, text: config.title, font: { size: 16 } }
                    }
                }
            };

            return `
            <div style="background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin: 30px 0; height: 350px;">
                <canvas id="${id}"></canvas>
            </div>
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    new Chart(
                        document.getElementById('${id}'),
                        ${JSON.stringify(chartJsConfig)}
                    );
                });
            </script>
            `;
        } catch(e) {
             return '<div style="color:red; border:1px dashed red; padding:10px;">Lỗi format biểu đồ JSON</div>';
        }
      });

      // 2. Chuyển Markdown sang HTML
      const htmlContent = await marked.parse(safeContentForExport);

      let finalContent = '';
      let fileName = '';
      let contentType = '';

      if (isHtml) {
        fileName = `ai_reports/${args.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.html`;
        contentType = 'text/html;charset=utf-8';
        finalContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${args.title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b; background: #f1f5f9; margin: 0; padding: 40px 20px; }
  .container { max-width: 900px; margin: 0 auto; background: #fff; padding: 50px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
  table { border-collapse: collapse; width: 100%; margin: 20px 0; font-size: 14px; }
  table, th, td { border: 1px solid #e2e8f0; }
  th, td { padding: 12px 16px; text-align: left; }
  th { background-color: #f8fafc; font-weight: 600; color: #0f172a; white-space: nowrap; }
  h1 { font-size: 28px; text-align: center; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 30px;}
  h2 { font-size: 20px; color: #0f172a; margin-top: 40px; }
  h3 { font-size: 16px; font-weight: 600; color: #334155; }
</style>
</head>
<body>
<div class="container">
${htmlContent}
</div>
</body>
</html>`;
      } else {
        fileName = `ai_reports/${args.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.doc`;
        contentType = 'application/msword;charset=utf-8';
        finalContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${args.title}</title>
<style>
  body { font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.5; }
  table { border-collapse: collapse; width: 100%; margin: 15px 0; }
  table, th, td { border: 1px solid black; }
  th, td { padding: 8px; text-align: left; }
  th { background-color: #f2f2f2; font-weight: bold; }
  h1 { font-size: 22pt; text-align: center; font-weight: bold; }
  h2 { font-size: 18pt; font-weight: bold; margin-top: 20px; }
  h3 { font-size: 16pt; font-weight: bold; }
</style>
</head>
<body>
${htmlContent}
</body>
</html>`;
      }

      // Add BOM and upload
      const blob = new Blob(['\uFEFF' + finalContent], { type: contentType });
      
      const { error } = await supabase.storage.from('documents').upload(fileName, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: contentType
      });
      
      if (error) throw error;
      
      const { data } = supabase.storage.from('documents').getPublicUrl(fileName);

      return `Tạo file thành công! Bạn BẮT BUỘC phải dùng CHÍNH XÁC link URL này để người dùng tải xuống (TUYỆT ĐỐI KHÔNG TỰ BỊA RA LINK KHÁC):\n\nURL: [Tải báo cáo](${data.publicUrl})`;
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
      .filter((u: any) => isBusinessUnit(u) && u.stats)
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
          id: p.contract_id,
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

// ═══════════════════════════════════════════════
// Tool 19.5: Tìm kiếm Tài liệu Registry
// ═══════════════════════════════════════════════

export const searchDocumentRegistryTool: OpenClawTool = {
  name: 'search_document_registry',
  description: 'Tìm kiếm tài liệu trong Document Registry (metadata tập trung). Tìm theo tên/mô tả, lọc theo danh mục (contract/report/hr/invoice...) hoặc liên kết entity. Dùng khi user hỏi "tìm tài liệu X", "có file nào về Y không", "tài liệu hợp đồng ABC".',
  schema: {
    query: { type: 'string', description: 'Từ khóa tìm kiếm (tên/mô tả tài liệu)' },
    category: { type: 'string', enum: ['contract', 'report', 'invoice', 'hr', 'legal', 'technical', 'general'], description: 'Lọc theo danh mục (tùy chọn)' },
    entityType: { type: 'string', enum: ['contract', 'employee', 'customer', 'unit'], description: 'Lọc theo loại entity liên kết (tùy chọn)' },
    useAI: { type: 'string', enum: ['true', 'false'], description: 'Dùng AI vector search thay vì text search (mặc định: false)' },
  },
  execute: async (args) => {
    try {
      // Nếu dùng AI vector search
      if (args.useAI === 'true' && args.query) {
        const { searchKnowledgeBase } = await import('../../../ragService');
        const results = await searchKnowledgeBase(args.query, {
          limit: 5,
          category: args.category,
          entityType: args.entityType,
        });
        if (results && results.trim().length > 0) {
          return { loaiTimKiem: 'AI Vector Search', ketQua: results };
        }
        return { message: 'Không tìm thấy tài liệu nào qua AI search.' };
      }

      // Text search trong document_registry
      const { DocumentRegistryService } = await import('../../../documentRegistryService');
      const { data } = await DocumentRegistryService.getAll({
        searchTerm: args.query || undefined,
        docCategory: args.category as any || undefined,
        entityType: args.entityType || undefined,
      });

      if (!data || data.length === 0) {
        return { message: 'Không tìm thấy tài liệu nào phù hợp.' };
      }

      return {
        tongKetQua: data.length,
        taiLieu: data.slice(0, 10).map((d: any) => ({
          tieuDe: d.title,
          danhMuc: d.docCategory,
          loaiFile: d.mimeType || d.sourceType,
          dungLuong: d.fileSize ? `${(d.fileSize / 1024).toFixed(0)} KB` : '—',
          aiDaDoc: d.isAiIndexed ? 'Đã đọc' : 'Chưa đọc',
          url: d.sourceUrl || '—',
          lienKet: d.entityType ? `${d.entityType}: ${d.entityId}` : '—',
        })),
      };
    } catch (err: any) {
      return { error: 'Lỗi tìm kiếm: ' + err.message };
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

export const getComprehensiveReportTool: OpenClawTool = {
  name: 'get_comprehensive_report',
  description: 'Dùng BẮT BUỘC khi người dùng yêu cầu "lập báo cáo", "lập báo cáo tổng kết" cho 1 năm. Tool trả về nội dung báo cáo Markdown gồm Bảng phân bổ và Biểu đồ.',
  schema: {
    year: { type: 'string', description: 'Năm cần lập báo cáo (vd: 2025, 2026)' }
  },
  execute: async (args, context: UserContext) => {
    const year = args.year ? parseInt(args.year) : new Date().getFullYear();

    // 1. Lấy dữ liệu KPI theo đơn vị
    const units = await UnitService.getWithStats(year, undefined);
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
    } catch(e) { }

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
    })).sort((a,b) => b.value - a.value);

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
       } catch(e) {}

       const revTarget = uTarget.revenue_target || 0;
       const signTarget = uTarget.signing_target || 0;

       totalRevTarget += revTarget;
       totalRevActual += statRevenue;

       if (revTarget > 0) {
           const revPct = (statRevenue / revTarget) * 100;
           const icon = revPct >= 100 ? '✅' : (revPct < 30 ? '🚨' : (revPct < 80 ? '⚠️' : '👍'));
           md += `| ${unit.name} | Doanh thu | ${(revTarget/1e9).toFixed(1)}T | ${(statRevenue/1e9).toFixed(1)}T | **${revPct.toFixed(1)}%** | ${icon} |\n`;
       }
       if (signTarget > 0) {
           const signPct = (statSigning / signTarget) * 100;
           const icon = signPct >= 100 ? '✅' : (signPct < 30 ? '🚨' : (signPct < 80 ? '⚠️' : '👍'));
           md += `| ${unit.name} | Ký kết | ${(signTarget/1e9).toFixed(1)}T | ${(statSigning/1e9).toFixed(1)}T | **${signPct.toFixed(1)}%** | ${icon} |\n`;
       }
    }

    const totalPct = totalRevTarget > 0 ? ((totalRevActual / totalRevTarget) * 100).toFixed(1) : '0';
    md += `\n**TỔNG TIẾN ĐỘ DOANH THU TOÀN CÔNG TY:** Đạt ${totalPct}%\n`;
    md += `\n*(AI Instruction: BẮT BUỘC phân tích các phòng ban có tỉ lệ < 30% kèm icon 🚨 và đề xuất nhắc nhở đốc thúc)*`;

    return md;
  }
};

export const getHrHeadcountStatsTool: OpenClawTool = {
  name: 'get_hr_headcount_stats',
  description: 'Thống kê biến động nhân sự, xem tổng quy mô (headcount) báo cáo tuyển dụng, ứng viên và phễu tuyển dụng.',
  schema: {},
  execute: async (args, context) => {
    const { data: employees } = await supabase.from('employees').select('id, department');
    const totalEmployees = employees ? employees.length : 0;
    const depts: Record<string, number> = {};
    employees?.forEach((e: any) => {
        const d = e.department || 'Chưa phân bổ';
        depts[d] = (depts[d] || 0) + 1;
    });

    const { data: jobs } = await supabase.from('job_openings').select('*').in('status', ['open', 'urgent', 'draft']);
    const openJobs = jobs ? jobs.length : 0;
    const totalNeeds = jobs ? jobs.reduce((sum: number, j: any) => sum + (j.quantity || 1), 0) : 0;

    const { data: applications } = await supabase.from('applications').select('stage, offer_salary');
    
    let md = `## 👥 BÁO CÁO NHÂN SỰ & TUYỂN DỤNG\n`;
    md += `### 1. Quy mô Nhân sự (Headcount)\n`;
    md += `- **Tổng số nhân sự hiện tại:** ${totalEmployees} người\n`;
    md += `- **Phân bổ theo khối:**\n`;
    Object.keys(depts).forEach(d => {
        md += `  - ${d}: ${depts[d]} người\n`;
    });

    md += `\n### 2. Tình hình Tuyển dụng\n`;
    md += `- **Vị trí đang mở (Open Jobs):** ${openJobs} job (Cần tuyển: ${totalNeeds} người)\n`;
    if (applications) {
       const stages: Record<string, number> = {};
       applications.forEach((a: any) => {
          stages[a.stage] = (stages[a.stage] || 0) + 1;
       });
       md += `- **Phễu ứng viên (Pipeline):**\n`;
       md += `  - Ứng tuyển mới: ${stages['applied'] || 0}\n`;
       md += `  - Sàng lọc (Screening): ${stages['screening'] || 0}\n`;
       md += `  - Phỏng vấn: ${(stages['interview_1'] || 0) + (stages['interview_2'] || 0)}\n`;
       md += `  - Đã Offer: ${stages['offer'] || 0}\n`;
       md += `  - Đã Hired: ${stages['hired'] || 0}\n`;
    }

    md += `\n*(AI Instruction: BẮT BUỘC nhận xét quy mô nhân sự hiện tại so với nhu cầu tuyển dụng mở, và nếu có chức danh cần gấp hãy chỉ ra 🚨)*`;

    return md;
  }
};

// ═══════════════════════════════════════════════
// Tool 25: Hồ sơ Khách hàng 360°
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

// ═══════════════════════════════════════════════
// Tool 26: Timeline HĐ sắp hết hạn
// ═══════════════════════════════════════════════

export const getContractExpiryTimelineTool: OpenClawTool = {
  name: 'get_contract_expiry_timeline',
  description: 'Xem timeline HĐ sắp hết hạn trong 30/60/90 ngày tới. Dùng khi user hỏi "HĐ nào sắp hết hạn", "thanh lý HĐ", "gia hạn HĐ".',
  schema: {
    days: { type: 'string', description: 'Số ngày tới (30, 60, 90). Mặc định: 60' },
  },
  execute: async (args) => {
    const days = parseInt(args.days) || 60;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];
    
    const { data: contracts } = await supabase
      .from('contracts')
      .select('id, title, contract_code, value, actual_revenue, end_date, status, unit_id, units(name)')
      .gte('end_date', todayStr)
      .lte('end_date', futureStr)
      .eq('status', 'Processing')
      .order('end_date')
      .limit(30);
    
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

// ═══════════════════════════════════════════════
// Tool 27: Phân tích Thông minh Tự động
// ═══════════════════════════════════════════════

export const getSmartInsightsTool: OpenClawTool = {
  name: 'get_smart_insights',
  description: 'Phân tích đa chiều tự động: so sánh KPI tháng này vs tháng trước, đơn vị tụt mạnh nhất, xu hướng công nợ, top rủi ro. Dùng khi user hỏi "phân tích", "insights", "đánh giá tổng quan", "tư vấn chiến lược".',
  schema: {},
  execute: async (args, context: UserContext) => {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const today = new Date().toISOString().split('T')[0];
    
    // Song song query tất cả dữ liệu cần thiết
    const [
      unitsData,
      overdueRes,
      debtRes,
      tasksRes,
    ] = await Promise.all([
      UnitService.getWithStats(year),
      supabase
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Processing')
        .lt('end_date', today),
      supabase
        .from('payments')
        .select('amount, paid_amount, due_date, status')
        .in('status', ['Chưa thanh toán', 'Pending', 'Đã xuất HĐ', 'Đã giao KH']),
      supabase
        .from('tasks')
        .select('id, due_date', { count: 'exact' })
        .lt('due_date', today)
        .is('completed_at', null),
    ]);

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
import { marketingToolsRegistry } from './marketingTools';

export const erpToolsRegistry: OpenClawTool[] = [
  ...marketingToolsRegistry,
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
  searchDocumentRegistryTool,
  // Phase 3 — Daily Briefing
  getDailyBriefingTool,
  
  // Phase 4 - Comprehensive Report
  getComprehensiveReportTool,
  getExpenseBreakdownTool,
  getBudgetVarianceReportTool,
  getHrHeadcountStatsTool,

  // Phase 5 — v6.0: Customer & Timeline
  getCustomer360Tool,
  getContractExpiryTimelineTool,

  // Phase 6 — v6.0: Smart Insights
  getSmartInsightsTool,
];
