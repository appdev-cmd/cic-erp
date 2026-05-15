// @ts-nocheck
// ═══════════════════════════════════════════════
// HR Extended Tools — Phase 2
// Nghỉ phép, Chấm công, HĐLĐ hết hạn, Hồ sơ 360°
// ═══════════════════════════════════════════════

import type { OpenClawTool, UserContext } from '../types';
import { dataClient as supabase } from '../../../../lib/dataClient';
import { fmtMoney, getUnitFilter, canViewAll } from './_helpers';
import { LeaveService } from '../../../leaveService';
import { UnitService } from '../../../unitService';

// ═══════════════════════════════════════════════
// 1. getLeaveSummaryTool
// ═══════════════════════════════════════════════

export const getLeaveSummaryTool: OpenClawTool = {
  name: 'get_leave_summary',
  description: 'Báo cáo nghỉ phép: Tổng ngày phép đã dùng/còn lại, ai nghỉ nhiều nhất, phân bổ theo loại phép. Dùng khi user hỏi "nghỉ phép", "ai nghỉ nhiều", "phép còn lại".',
  schema: {
    year: { type: 'string', description: 'Năm (VD: 2026). Mặc định năm hiện tại.' },
    unitId: { type: 'string', description: 'ID đơn vị (để trống = toàn công ty)' },
  },
  execute: async (args, context: UserContext) => {
    const year = args.year ? parseInt(args.year) : new Date().getFullYear();
    const forcedUnitId = getUnitFilter(args, context);

    // Lấy tất cả leave requests trong năm
    const allRequests = await LeaveService.getAllRequests({
      year,
      unit_id: forcedUnitId || undefined,
    });

    const approved = allRequests.filter(r => r.status === 'approved');
    const pending = allRequests.filter(r => r.status === 'pending');
    const totalDaysUsed = approved.reduce((s, r) => s + (r.total_days || 0), 0);
    const totalDaysPending = pending.reduce((s, r) => s + (r.total_days || 0), 0);

    // Theo loại phép
    const byType: Record<string, { count: number; days: number }> = {};
    approved.forEach(r => {
      const t = r.leave_type || 'Khác';
      if (!byType[t]) byType[t] = { count: 0, days: 0 };
      byType[t].count++;
      byType[t].days += (r.total_days || 0);
    });

    // Top nghỉ nhiều nhất
    const byEmp: Record<string, { name: string; days: number }> = {};
    approved.forEach(r => {
      const id = r.employee_id;
      if (!byEmp[id]) byEmp[id] = { name: r.employee_name || id, days: 0 };
      byEmp[id].days += (r.total_days || 0);
    });
    const topLeave = Object.values(byEmp).sort((a, b) => b.days - a.days).slice(0, 10);

    let md = `## 🏖️ BÁO CÁO NGHỈ PHÉP NĂM ${year}\n\n`;
    md += `### Tổng quan\n`;
    md += `- **Tổng đơn nghỉ phép:** ${allRequests.length} (Duyệt: ${approved.length}, Chờ: ${pending.length})\n`;
    md += `- **Tổng ngày phép đã dùng:** ${totalDaysUsed} ngày\n`;
    md += `- **Ngày phép đang chờ duyệt:** ${totalDaysPending} ngày\n\n`;

    md += `### Phân bổ theo Loại phép\n`;
    md += `| Loại phép | Số đơn | Tổng ngày |\n|:---|:---:|:---:|\n`;
    Object.entries(byType).sort((a, b) => b[1].days - a[1].days).forEach(([t, v]) => {
      md += `| ${t} | ${v.count} | ${v.days} |\n`;
    });

    if (topLeave.length > 0) {
      md += `\n### Top nhân viên nghỉ nhiều nhất\n`;
      md += `| Nhân viên | Tổng ngày nghỉ |\n|:---|:---:|\n`;
      topLeave.forEach(e => { md += `| ${e.name} | ${e.days} |\n`; });
    }

    md += `\n*(AI Instruction: Nhận xét tình hình nghỉ phép, có ai nghỉ quá nhiều không. Nếu có đơn chờ duyệt hãy nhắc nhở)*`;
    return md;
  }
};

// ═══════════════════════════════════════════════
// 2. getAttendanceReportTool
// ═══════════════════════════════════════════════

export const getAttendanceReportTool: OpenClawTool = {
  name: 'get_attendance_report',
  description: 'Thống kê chấm công: Tổng ngày công, tỷ lệ đi muộn, overtime, nghỉ không phép. Dùng khi user hỏi "chấm công", "đi muộn", "overtime", "tăng ca".',
  schema: {
    year: { type: 'string', description: 'Năm (VD: 2026)' },
    month: { type: 'string', description: 'Tháng (1-12). Mặc định tháng hiện tại.' },
  },
  execute: async (args, context: UserContext) => {
    const year = args.year ? parseInt(args.year) : new Date().getFullYear();
    const month = args.month ? parseInt(args.month) : new Date().getMonth() + 1;
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    // Lấy bản ghi chấm công
    const { data: records } = await supabase
      .from('attendance_records')
      .select('*, employee:employees!employee_id(name)')
      .gte('date', startDate)
      .lte('date', endDate);

    // Lấy overtime requests
    const { data: otRequests } = await supabase
      .from('overtime_requests')
      .select('*, employee:employees!employee_id(name)')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('status', 'approved');

    const totalRecords = records?.length || 0;
    const lateCount = records?.filter((r: any) => r.is_late).length || 0;
    const absentCount = records?.filter((r: any) => r.status === 'absent').length || 0;
    const totalOTHours = otRequests?.reduce((s: number, r: any) => s + (r.hours || 0), 0) || 0;

    let md = `## ⏰ BÁO CÁO CHẤM CÔNG THÁNG ${month}/${year}\n\n`;
    md += `### Tổng quan\n`;
    md += `| Chỉ số | Giá trị |\n|:---|:---:|\n`;
    md += `| Tổng bản ghi chấm công | ${totalRecords} |\n`;
    md += `| Số lần đi muộn | ${lateCount} (${totalRecords > 0 ? ((lateCount / totalRecords) * 100).toFixed(1) : 0}%) |\n`;
    md += `| Nghỉ không phép | ${absentCount} |\n`;
    md += `| Tổng giờ OT (đã duyệt) | ${totalOTHours} giờ (${otRequests?.length || 0} đơn) |\n\n`;

    // Top đi muộn
    if (records && records.length > 0) {
      const lateByEmp: Record<string, { name: string; count: number }> = {};
      records.filter((r: any) => r.is_late).forEach((r: any) => {
        const id = r.employee_id;
        if (!lateByEmp[id]) lateByEmp[id] = { name: r.employee?.name || id, count: 0 };
        lateByEmp[id].count++;
      });
      const topLate = Object.values(lateByEmp).sort((a, b) => b.count - a.count).slice(0, 5);
      if (topLate.length > 0) {
        md += `### Top đi muộn\n`;
        md += `| Nhân viên | Số lần muộn |\n|:---|:---:|\n`;
        topLate.forEach(e => { md += `| ${e.name} | ${e.count} |\n`; });
      }
    }

    md += `\n*(AI Instruction: Nhận xét tỷ lệ đi muộn có cao không, và tình hình OT có hợp lý không)*`;
    return md;
  }
};

// ═══════════════════════════════════════════════
// 3. getContractLaborExpiryTool
// ═══════════════════════════════════════════════

export const getContractLaborExpiryTool: OpenClawTool = {
  name: 'get_contract_labor_expiry',
  description: 'Cảnh báo HĐLĐ sắp hết hạn trong 30/60/90 ngày. Dùng khi user hỏi "hợp đồng lao động sắp hết hạn", "HĐLĐ", "gia hạn HĐLĐ".',
  schema: {
    days: { type: 'string', description: 'Số ngày tới (30, 60, 90). Mặc định 60.' },
  },
  execute: async (args, context: UserContext) => {
    const days = parseInt(args.days) || 60;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    const todayStr = today.toISOString().split('T')[0];
    const futureStr = futureDate.toISOString().split('T')[0];

    const { data: employees } = await supabase
      .from('employees')
      .select('id, name, position, unit_id, contract_type, contract_end_date')
      .or(`status.is.null,status.eq.active`)
      .not('contract_end_date', 'is', null)
      .gte('contract_end_date', todayStr)
      .lte('contract_end_date', futureStr)
      .order('contract_end_date');

    if (!employees || employees.length === 0) {
      return `✅ Không có HĐLĐ nào hết hạn trong ${days} ngày tới.`;
    }

    const units = await UnitService.getAll();
    const unitMap: Record<string, string> = {};
    units.forEach((u: any) => { unitMap[u.id] = u.name; });

    let md = `## 📋 CẢNH BÁO HĐLĐ SẮP HẾT HẠN (${days} ngày tới)\n\n`;
    md += `**Tổng:** ${employees.length} nhân viên cần gia hạn/xử lý HĐLĐ\n\n`;
    md += `| # | Nhân viên | Chức vụ | Đơn vị | Loại HĐ | Hết hạn | Còn |\n`;
    md += `|---|:---|:---|:---|:---|:---|:---:|\n`;

    employees.forEach((e: any, i: number) => {
      const daysLeft = Math.ceil((new Date(e.contract_end_date).getTime() - today.getTime()) / 86400000);
      const urgency = daysLeft <= 7 ? '🔴' : daysLeft <= 30 ? '🟡' : '🟢';
      const uName = unitMap[e.unit_id] || '—';
      md += `| ${i + 1} | ${e.name} | ${e.position || '—'} | ${uName} | ${e.contract_type || '—'} | ${e.contract_end_date} | ${urgency} ${daysLeft}d |\n`;
    });

    md += `\n*(AI Instruction: Nhấn mạnh những HĐLĐ 🔴 cần xử lý ngay. Đề xuất gia hạn hoặc thanh lý)*`;
    return md;
  }
};

// ═══════════════════════════════════════════════
// 4. getEmployeeProfile360Tool
// ═══════════════════════════════════════════════

export const getEmployeeProfile360Tool: OpenClawTool = {
  name: 'get_employee_profile_360',
  description: 'Hồ sơ 360° nhân viên: Thông tin cá nhân + KPI kinh doanh + nghỉ phép + workload tasks + lịch sử lương. Dùng khi user hỏi chi tiết 1 nhân viên cụ thể.',
  schema: {
    employeeId: { type: 'string', description: 'ID nhân viên. BẮT BUỘC. Nếu chưa có ID hãy dùng search_employees trước.' },
  },
  execute: async (args, context: UserContext) => {
    if (!args.employeeId) return { error: 'Thiếu employeeId. Hãy dùng search_employees để tìm ID trước.' };

    const { data: emp } = await supabase
      .from('employees')
      .select('*')
      .eq('id', args.employeeId)
      .single();

    if (!emp) return { error: 'Không tìm thấy nhân viên với ID này.' };

    const units = await UnitService.getAll();
    const unitMap: Record<string, string> = {};
    units.forEach((u: any) => { unitMap[u.id] = u.name; });

    // KPI kinh doanh
    const { EmployeeService } = await import('../../../employeeService');
    let kpiData: any = null;
    try {
      const year = new Date().getFullYear();
      const emps = await EmployeeService.getWithStats('all', undefined, year);
      kpiData = emps?.find((e: any) => e.id === args.employeeId)?.stats;
    } catch {}

    // Nghỉ phép
    let leaveData: any[] = [];
    try {
      leaveData = await LeaveService.getRequestsByEmployee(args.employeeId, new Date().getFullYear());
    } catch {}
    const approvedLeave = leaveData.filter(r => r.status === 'approved');
    const totalLeaveDays = approvedLeave.reduce((s, r) => s + (r.total_days || 0), 0);

    // Tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, status_id, due_date, completed_at')
      .contains('assignees', [args.employeeId]);
    const totalTasks = tasks?.length || 0;
    const doneTasks = tasks?.filter((t: any) => t.completed_at).length || 0;
    const overdueTasks = tasks?.filter((t: any) => !t.completed_at && t.due_date && t.due_date < new Date().toISOString().split('T')[0]).length || 0;

    // Lương (chỉ cho phép BGĐ/KTT xem)
    let salaryInfo = '';
    const canSeeSalary = canViewAll(context) || context.role === 'AccountantChief';
    if (canSeeSalary) {
      const { data: salaries } = await supabase
        .from('employee_salary_history')
        .select('*')
        .eq('employee_id', args.employeeId)
        .order('effective_date', { ascending: false })
        .limit(3);
      if (salaries && salaries.length > 0) {
        salaryInfo = `\n### 💰 Lịch sử Lương (gần nhất)\n`;
        salaryInfo += `| Ngày hiệu lực | Lương cơ bản | Phụ cấp | Ghi chú |\n|:---|---:|---:|:---|\n`;
        salaries.forEach((s: any) => {
          salaryInfo += `| ${s.effective_date} | ${fmtMoney(s.base_salary || 0)} | ${fmtMoney(s.allowance || 0)} | ${s.note || '—'} |\n`;
        });
      }
    }

    // Build report
    let md = `## 👤 HỒ SƠ 360° — ${emp.name}\n\n`;
    md += `### 📋 Thông tin Cá nhân\n`;
    md += `| Mục | Giá trị |\n|:---|:---|\n`;
    md += `| Họ tên | **${emp.name}** |\n`;
    md += `| Mã NV | ${emp.employee_code || '—'} |\n`;
    md += `| Chức vụ | ${emp.position || '—'} |\n`;
    md += `| Đơn vị | ${unitMap[emp.unit_id] || '—'} |\n`;
    md += `| Email | ${emp.email || '—'} |\n`;
    md += `| SĐT | ${emp.phone || '—'} |\n`;
    md += `| Ngày vào | ${emp.date_joined || emp.join_date || '—'} |\n`;
    md += `| Giới tính | ${emp.gender === 'male' ? 'Nam' : emp.gender === 'female' ? 'Nữ' : '—'} |\n`;
    md += `| Loại HĐLĐ | ${emp.contract_type || '—'} |\n`;
    md += `| HĐ hết hạn | ${emp.contract_end_date || '—'} |\n\n`;

    if (kpiData) {
      md += `### 📊 KPI Kinh doanh ${new Date().getFullYear()}\n`;
      md += `| Chỉ số | Giá trị |\n|:---|---:|\n`;
      md += `| Tổng ký kết | ${fmtMoney(kpiData.totalSigning || 0)} |\n`;
      md += `| Doanh thu thực | ${fmtMoney(kpiData.totalRevenue || 0)} |\n`;
      md += `| Lợi nhuận QT | ${fmtMoney(kpiData.totalProfit || 0)} |\n\n`;
    }

    md += `### 📌 Công việc (Tasks)\n`;
    md += `- Tổng: ${totalTasks} | Hoàn thành: ${doneTasks} | Quá hạn: ${overdueTasks}\n\n`;

    md += `### 🏖️ Nghỉ phép ${new Date().getFullYear()}\n`;
    md += `- Tổng ngày đã nghỉ: ${totalLeaveDays} ngày (${approvedLeave.length} đơn)\n`;

    md += salaryInfo;

    md += `\n*(AI Instruction: Tổng hợp đánh giá nhân viên dựa trên KPI, workload và tình hình nghỉ phép. Đưa ra nhận xét cụ thể)*`;
    return md;
  }
};
