// @ts-nocheck
import { UnitService } from '../../../unitService';
import type { OpenClawTool, UserContext } from '../types';
import { dataClient as supabase } from '../../../../lib/dataClient';
import { fmtMoney, fmtMoneyWithRaw, canViewAll, getUnitFilter, enforceUnitScope } from './_helpers';
import { EmployeeService } from '../../../employeeService';
import { TaskService } from '../../../taskService';

// ═══════════════════════════════════════════════
// searchEmployeesTool
// ═══════════════════════════════════════════════

export const searchEmployeesTool: OpenClawTool = {
  name: 'search_employees',
  description: 'Tìm kiếm nhân sự theo tên (ví dụ: Trần Văn A) hoặc Tên phòng ban (ví dụ: trung tâm BIM, phòng Hành chính). LƯU Ý: NẾU TRONG [CONTEXT] ĐÃ CÓ MÃ ID NHÂN SỰ RỒI THÌ BỎ QUA TOOL NÀY VÀ DÙNG LUÔN ID ĐÓ CHO CREATE_TASK MÀ KHÔNG CẦN TÌM KIẾM!',
  schema: {
    searchName: { type: 'string', description: 'Tên nhân sự hoặc Tên Phòng Ban (VD: BIM, Kế Toán) cần tìm' }
  },
  execute: async (args, context: UserContext) => {
    let term = args.searchName.replace('@', '').trim();
    // Bỏ các chữ dư thừa để tìm chính xác hơn
    const excludeWords = ['phòng ', 'trung tâm ', 'phong ', 'trung tam '];
    for (const w of excludeWords) {
      if (term.toLowerCase().startsWith(w)) {
        term = term.substring(w.length).trim();
      }
    }

    // SECURITY: Unit filter for non-global roles
    const forcedUnitId = getUnitFilter(args, context);

    // 1. Tìm trong bảng employees (Hỗ trợ cả tên và phòng ban)
    let empQuery = supabase
      .from('employees')
      .select('id, name, position, department, unit_id')
      .or(`name.ilike.%${term}%,department.ilike.%${term}%`)
      .limit(30);
    if (forcedUnitId) {
      empQuery = empQuery.eq('unit_id', forcedUnitId);
    }
    const { data: emps } = await empQuery;

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
      // SECURITY: Enforce unitId for non-global roles
      const unitId = (!canViewAll(context) && context.unitId) ? context.unitId : (args.unitId || 'all');

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
  execute: async (args, context: UserContext) => {
    // SECURITY: Unit filter for non-global roles
    const forcedUnitId = getUnitFilter(args, context);

    // Lấy tất cả task chưa done
    const allStatuses = await TaskService.getStatuses();
    const doneIds = new Set(allStatuses.filter(s => s.is_done).map(s => s.id));
    const today = new Date().toISOString().split('T')[0];

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, assignees, status_id, due_date, completed_at')
      .is('parent_id', null);

    if (!tasks) return { message: 'Không có dữ liệu task.' };

    // SECURITY: Get employees in user's unit to filter workload
    let allowedEmployeeIds: Set<string> | null = null;
    if (forcedUnitId) {
      const { data: unitEmps } = await supabase
        .from('employees')
        .select('id')
        .eq('unit_id', forcedUnitId);
      allowedEmployeeIds = new Set((unitEmps || []).map((e: any) => e.id));
    }

    // Aggregate by assignee
    const workload: Record<string, { total: number; doing: number; overdue: number; done: number }> = {};

    for (const t of tasks) {
      const assignees: string[] = t.assignees || [];
      for (const aId of assignees) {
        // SECURITY: Skip employees not in user's unit
        if (allowedEmployeeIds && !allowedEmployeeIds.has(aId)) continue;
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
      // SECURITY: Check employee belongs to user's unit
      if (allowedEmployeeIds && !allowedEmployeeIds.has(args.employeeId)) {
        return { error: 'Truy cập bị từ chối: Nhân viên này không thuộc đơn vị của bạn.' };
      }
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
      .sort((a, b) => b[1].doing - a[1].doing)
      .slice(0, 10)
      .map(([id, w]) => `${empMap[id] || id} (ID: ${id}): Đang làm ${w.doing}, Quá hạn ${w.overdue}, Hoàn thành ${w.done}, Tổng task ${w.total}`);

    return { top10: sorted };
  }
};

// ═══════════════════════════════════════════════
// getHrHeadcountStatsTool — VIẾT LẠI HOÀN TOÀN
// ═══════════════════════════════════════════════

export const getHrHeadcountStatsTool: OpenClawTool = {
  name: 'get_hr_headcount_stats',
  description: 'Thống kê toàn diện tình hình nhân sự: Tổng headcount (chỉ đếm active), biến động nhân sự mới/nghỉ việc, turnover rate, cơ cấu theo đơn vị/giới tính/loại HĐLĐ/thâm niên, và tình hình tuyển dụng. Dùng khi user hỏi "tình hình nhân sự", "headcount", "quy mô", "biến động nhân sự", "turnover".',
  schema: {
    year: { type: 'string', description: 'Năm thống kê (VD: 2026). Mặc định năm hiện tại.' },
  },
  execute: async (args, context: UserContext) => {
    const year = args.year ? parseInt(args.year) : new Date().getFullYear();
    const today = new Date().toISOString().split('T')[0];
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // SECURITY: Unit filter for non-global roles
    const forcedUnitId = getUnitFilter(args, context);

    // ── 1. Lấy tất cả nhân viên ──
    let empQuery = supabase
      .from('employees')
      .select('id, name, status, gender, unit_id, position, contract_type, date_joined, join_date');
    if (forcedUnitId) {
      empQuery = empQuery.eq('unit_id', forcedUnitId);
    }
    const { data: allEmployees, error: empError } = await empQuery;

    if (empError) {
      return `## 👥 BÁO CÁO NHÂN SỰ\n\nLỗi truy vấn dữ liệu: ${empError.message}`;
    }

    if (!allEmployees || allEmployees.length === 0) {
      return '## 👥 BÁO CÁO NHÂN SỰ\n\nKhông có dữ liệu nhân viên trong hệ thống.';
    }

    // ── 2. Phân loại ──
    // Nếu bảng không có cột status → coi tất cả là active
    const hasStatus = allEmployees.some((e: any) => e.status !== undefined && e.status !== null);
    const activeEmps = hasStatus
      ? allEmployees.filter((e: any) => !e.status || e.status === 'active')
      : allEmployees; // Không có cột status → tất cả là active
    const resignedInYear = hasStatus
      ? allEmployees.filter((e: any) => e.status === 'resigned' || e.status === 'inactive')
      : [];
    // Hỗ trợ cả date_joined và join_date (2 tên cột có thể tồn tại)
    const getJoinDate = (e: any) => e.date_joined || e.join_date || null;
    const newInYear = activeEmps.filter((e: any) => {
      const jd = getJoinDate(e);
      return jd && jd >= yearStart && jd <= yearEnd;
    });
    const totalActive = activeEmps.length;
    const totalNew = newInYear.length;
    const totalResigned = resignedInYear.length;

    // Turnover rate
    const headcountStart = totalActive - totalNew + totalResigned;
    const turnoverRate = headcountStart > 0
      ? ((totalResigned / headcountStart) * 100).toFixed(1)
      : '0.0';

    // ── 3. Cơ cấu theo Đơn vị (join units) ──
    const units = await UnitService.getAll();
    const unitMap: Record<string, string> = {};
    units.forEach((u: any) => { unitMap[u.id] = u.name; });

    const byUnit: Record<string, number> = {};
    activeEmps.forEach((e: any) => {
      const uName = e.unit_id && unitMap[e.unit_id] ? unitMap[e.unit_id] : 'Chưa phân bổ';
      byUnit[uName] = (byUnit[uName] || 0) + 1;
    });

    // ── 4. Cơ cấu theo Giới tính ──
    const byGender: Record<string, number> = { 'Nam': 0, 'Nữ': 0, 'Khác/Chưa cập nhật': 0 };
    activeEmps.forEach((e: any) => {
      if (e.gender === 'male') byGender['Nam']++;
      else if (e.gender === 'female') byGender['Nữ']++;
      else byGender['Khác/Chưa cập nhật']++;
    });

    // ── 5. Cơ cấu theo Loại HĐLĐ ──
    const byContract: Record<string, number> = {};
    activeEmps.forEach((e: any) => {
      const ct = e.contract_type || 'Chưa cập nhật';
      byContract[ct] = (byContract[ct] || 0) + 1;
    });

    // ── 6. Cơ cấu theo Thâm niên ──
    const seniority = { 'Dưới 1 năm': 0, '1-3 năm': 0, '3-5 năm': 0, 'Trên 5 năm': 0, 'Chưa rõ': 0 };
    activeEmps.forEach((e: any) => {
      const jd = getJoinDate(e);
      if (!jd) { seniority['Chưa rõ']++; return; }
      const joinDate = new Date(jd);
      const years = (Date.now() - joinDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (years < 1) seniority['Dưới 1 năm']++;
      else if (years < 3) seniority['1-3 năm']++;
      else if (years < 5) seniority['3-5 năm']++;
      else seniority['Trên 5 năm']++;
    });

    // ── 7. Tuyển dụng ──
    const { data: jobs } = await supabase
      .from('job_openings')
      .select('id, title, status, quantity, department')
      .in('status', ['open', 'urgent', 'draft']);
    const openJobs = jobs ? jobs.length : 0;
    const totalNeeds = jobs ? jobs.reduce((s: number, j: any) => s + (j.quantity || 1), 0) : 0;
    const urgentJobs = jobs ? jobs.filter((j: any) => j.status === 'urgent') : [];

    const { data: applications } = await supabase
      .from('applications')
      .select('stage');
    const stages: Record<string, number> = {};
    (applications || []).forEach((a: any) => {
      stages[a.stage] = (stages[a.stage] || 0) + 1;
    });

    // ── 8. Build Markdown Report ──
    let md = `## 👥 BÁO CÁO TÌNH HÌNH NHÂN SỰ NĂM ${year}\n`;
    md += `_Cập nhật tới: ${today}_\n\n`;

    // 8.1 Thống kê & Biến động
    md += `### 📊 1. Thống kê Quy mô & Biến động (Headcount)\n\n`;
    md += `| Chỉ số | Giá trị | Ghi chú |\n`;
    md += `|:---|:---:|:---|\n`;
    md += `| **Tổng nhân sự hiện tại** | **${totalActive} nhân sự** | Chỉ đếm nhân viên đang active |\n`;
    md += `| Nhân sự mới (năm ${year}) | +${totalNew} | Tuyển mới trong năm |\n`;
    md += `| Nhân sự nghỉ việc (năm ${year}) | -${totalResigned} | Đã nghỉ/inactive |\n`;
    md += `| **Tỷ lệ nghỉ việc (Turnover)** | **${turnoverRate}%** | = Nghỉ / Đầu năm × 100 |\n\n`;

    // 8.2 Cơ cấu theo Đơn vị
    md += `### 🏢 2. Cơ cấu Nhân sự theo Đơn vị (Phòng ban)\n\n`;
    md += `| Đơn vị | Số lượng | Tỷ trọng |\n`;
    md += `|:---|:---:|:---:|\n`;
    const sortedUnits = Object.entries(byUnit).sort((a, b) => b[1] - a[1]);
    sortedUnits.forEach(([name, count]) => {
      const pct = ((count / totalActive) * 100).toFixed(1);
      md += `| ${name} | ${count} | ${pct}% |\n`;
    });

    // Biểu đồ pie
    const pieData = sortedUnits.map(([name, count]) => ({ name, value: count }));
    const chartJson = JSON.stringify({
      type: 'pie',
      title: `Cơ cấu nhân sự theo đơn vị (${totalActive} người)`,
      dataKey: 'value',
      nameKey: 'name',
      data: pieData,
      unit: 'người'
    });
    md += `\n\`\`\`chart\n${chartJson}\n\`\`\`\n\n`;

    // 8.3 Cơ cấu theo Giới tính
    md += `### 👫 3. Cơ cấu theo Giới tính\n\n`;
    md += `| Giới tính | Số lượng | Tỷ lệ |\n|:---|:---:|:---:|\n`;
    Object.entries(byGender).forEach(([g, c]) => {
      if (c > 0) md += `| ${g} | ${c} | ${((c / totalActive) * 100).toFixed(1)}% |\n`;
    });

    // 8.4 Cơ cấu theo Thâm niên
    md += `\n### ⏳ 4. Cơ cấu theo Thâm niên\n\n`;
    md += `| Thâm niên | Số lượng | Tỷ lệ |\n|:---|:---:|:---:|\n`;
    Object.entries(seniority).forEach(([s, c]) => {
      if (c > 0) md += `| ${s} | ${c} | ${((c / totalActive) * 100).toFixed(1)}% |\n`;
    });

    // 8.5 Cơ cấu theo Loại HĐLĐ
    md += `\n### 📄 5. Cơ cấu theo Loại Hợp đồng Lao động\n\n`;
    md += `| Loại HĐLĐ | Số lượng |\n|:---|:---:|\n`;
    Object.entries(byContract).sort((a, b) => b[1] - a[1]).forEach(([ct, c]) => {
      md += `| ${ct} | ${c} |\n`;
    });

    // 8.6 Tuyển dụng
    md += `\n### 🎯 6. Tình hình Tuyển dụng\n\n`;
    md += `- **Vị trí đang mở:** ${openJobs} job (Cần tuyển: ${totalNeeds} người)\n`;
    if (urgentJobs.length > 0) {
      md += `- 🚨 **Vị trí KHẨN CẤP:** ${urgentJobs.map((j: any) => j.title).join(', ')}\n`;
    }
    md += `- **Phễu ứng viên:**\n`;
    md += `  - Ứng tuyển mới: ${stages['applied'] || 0}\n`;
    md += `  - Sàng lọc: ${stages['screening'] || 0}\n`;
    md += `  - Phỏng vấn: ${(stages['interview_1'] || 0) + (stages['interview_2'] || 0)}\n`;
    md += `  - Đã Offer: ${stages['offer'] || 0}\n`;
    md += `  - Đã Hired: ${stages['hired'] || 0}\n`;

    md += `\n*(AI Instruction: BẮT BUỘC paste toàn bộ bảng và biểu đồ trên. Phân tích turnover rate có cao không (benchmark ngành IT ~15-20%). Nhận xét tỷ lệ nam/nữ, thâm niên. Nếu có vị trí tuyển khẩn cấp hãy nhấn mạnh 🚨)*`;

    return md;
  }
};


