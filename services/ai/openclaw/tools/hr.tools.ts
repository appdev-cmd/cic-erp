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
// searchEmployeesTool
// ═══════════════════════════════════════════════

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

// ═══════════════════════════════════════════════
// getEmployeeRankingTool
// ═══════════════════════════════════════════════

export const getEmployeeRankingTool: OpenClawTool = {
  name: 'get_employee_ranking',
  description: 'Lấy danh sách và xếp hạng hiệu suất KPI kinh doanh của TẤT CẢ các cá nhân/nhân sự/nhân viên (Ký kết, doanh thu thực, danh hiệu). BẮT BUỘC dùng khi người dùng hỏi về "nhân viên", "nhân sự", "ai có doanh thu cao nhất", "nhân viên xuất sắc".',
  schema: {
    year: { type: 'string', description: 'Năm (vd: 2026). Nhưng nếu để trống sẽ lấy năm hiện tại.' },
    sortBy: { type: 'string', description: 'Tiêu chí xếp hạng: "revenue" (doanh thu), "signing" (ký kết), "profit" (lợi nhuận). Mặc định là revenue.', enum: ['revenue', 'signing', 'profit'] },
    limit: { type: 'string', description: 'Số lượng tối đa. VD: 10.' },
    unitId: { type: 'string', description: 'Mã đơn vị (nếu muốn xếp hạng nhân sự trong 1 trung tâm). Để trống = toàn công ty.' }
  },
  execute: async (args, context: UserContext) => {
    try {
      const { EmployeeService } = await import('../../../employeeService');
      const { UnitService } = await import('../../../unitService');

      const year = args.year ? parseInt(args.year) : new Date().getFullYear();
      const sortBy = args.sortBy || 'revenue';
      const limit = args.limit ? parseInt(args.limit) : 10;
      const unitId = args.unitId || 'all';

      // Load units for translation
      const units = await UnitService.getAll();
      const unitMap = units.reduce((acc: any, u: any) => { acc[u.id] = u.name; return acc; }, {});

      let emps = await EmployeeService.getWithStats(unitId, undefined, year);
      if (!emps || emps.length === 0) return 'Không có dữ liệu nhân sự phù hợp.';

      // Lọc những người có số liệu lớn hơn 0
      emps = emps.filter((e: any) => e.stats && (e.stats.totalSigning > 0 || e.stats.totalRevenue > 0));

      if (sortBy === 'revenue') {
        emps.sort((a: any, b: any) => (b.stats?.totalRevenue || 0) - (a.stats?.totalRevenue || 0));
      } else if (sortBy === 'signing') {
        emps.sort((a: any, b: any) => (b.stats?.totalSigning || 0) - (a.stats?.totalSigning || 0));
      } else {
        emps.sort((a: any, b: any) => (b.stats?.totalProfit || 0) - (a.stats?.totalProfit || 0));
      }

      emps = emps.slice(0, limit);

      if (emps.length === 0) return `Trong năm ${year}, chưa có nhân sự nào được ghi nhận doanh thu hoặc ký kết.`;

      let md = `## 🏆 BẢNG XẾP HẠNG NHÂN SỰ XUẤT SẮC NĂM ${year}\n\n`;
      md += `| Hạng | Nhân sự | Đơn vị | Tổng ký kết | Doanh thu | Lợi nhuận QT |\n`;
      md += `|:---:|:---|:---|---:|---:|---:|\n`;

      emps.forEach((e: any, idx: number) => {
        const stats = e.stats;
        const uName = e.unitId && unitMap[e.unitId] ? unitMap[e.unitId] : e.unitId || '—';
        md += `| ${idx + 1} | **${e.name}** | ${uName} | ${fmtMoneyWithRaw(stats.totalSigning || 0)} | ${fmtMoneyWithRaw(stats.totalRevenue || 0)} | ${fmtMoneyWithRaw(stats.totalProfit || 0)} |\n`;
      });

      return md;
    } catch (e: any) {
      return { error: 'Lỗi lấy bảng xếp hạng nhân sự: ' + e.message };
    }
  }
};

// ═══════════════════════════════════════════════
// getEmployeeWorkloadTool
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
// getHrHeadcountStatsTool
// ═══════════════════════════════════════════════

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

