// @ts-nocheck
// ═══════════════════════════════════════════════
// HR Finance & Recruitment Tools — Phase 3
// Tuyển dụng pipeline, Lương, Payroll, Onboarding
// ═══════════════════════════════════════════════

import type { OpenClawTool, UserContext } from '../types';
import { dataClient as supabase } from '../../../../lib/dataClient';
import { fmtMoney, canViewAll, getUnitFilter } from './_helpers';
import { UnitService } from '../../../unitService';

// ═══════════════════════════════════════════════
// 1. getRecruitmentPipelineTool
// ═══════════════════════════════════════════════

export const getRecruitmentPipelineTool: OpenClawTool = {
  name: 'get_recruitment_pipeline',
  description: 'Dashboard tuyển dụng chi tiết: Phễu pipeline, thời gian tuyển trung bình, tỷ lệ chuyển đổi, top vị trí khó tuyển. Dùng khi user hỏi "tuyển dụng", "ứng viên", "phễu tuyển dụng", "recruitment".',
  schema: {},
  execute: async (args, context: UserContext) => {
    const [jobsRes, appsRes] = await Promise.all([
      supabase.from('job_openings').select('id, title, status, quantity, department, created_at'),
      supabase.from('applications').select('id, stage, job_opening_id, created_at, stage_updated_at'),
    ]);

    const jobs = jobsRes.data || [];
    const apps = appsRes.data || [];

    // Phễu pipeline
    const stages: Record<string, number> = {};
    apps.forEach((a: any) => { stages[a.stage] = (stages[a.stage] || 0) + 1; });

    const totalApps = apps.length;
    const hired = stages['hired'] || 0;
    const conversionRate = totalApps > 0 ? ((hired / totalApps) * 100).toFixed(1) : '0';

    // Thời gian tuyển trung bình (từ applied → hired)
    const hiredApps = apps.filter((a: any) => a.stage === 'hired' && a.created_at && a.stage_updated_at);
    let avgDays = 0;
    if (hiredApps.length > 0) {
      const totalDays = hiredApps.reduce((s: number, a: any) => {
        const diff = (new Date(a.stage_updated_at).getTime() - new Date(a.created_at).getTime()) / 86400000;
        return s + diff;
      }, 0);
      avgDays = Math.round(totalDays / hiredApps.length);
    }

    // Top vị trí nhiều ứng viên nhất
    const jobMap: Record<string, { title: string; count: number }> = {};
    apps.forEach((a: any) => {
      const jid = a.job_opening_id;
      if (!jobMap[jid]) {
        const job = jobs.find((j: any) => j.id === jid);
        jobMap[jid] = { title: job?.title || 'N/A', count: 0 };
      }
      jobMap[jid].count++;
    });
    const topJobs = Object.values(jobMap).sort((a, b) => b.count - a.count).slice(0, 5);

    // Vị trí urgent
    const urgentJobs = jobs.filter((j: any) => j.status === 'urgent');
    const openJobs = jobs.filter((j: any) => j.status === 'open' || j.status === 'urgent');

    let md = `## 🎯 DASHBOARD TUYỂN DỤNG\n\n`;
    md += `### Tổng quan\n`;
    md += `| Chỉ số | Giá trị |\n|:---|:---:|\n`;
    md += `| Vị trí đang mở | ${openJobs.length} |\n`;
    md += `| Tổng ứng viên | ${totalApps} |\n`;
    md += `| Đã tuyển (Hired) | ${hired} |\n`;
    md += `| Tỷ lệ chuyển đổi | ${conversionRate}% |\n`;
    md += `| Thời gian tuyển TB | ${avgDays} ngày |\n\n`;

    md += `### Phễu Tuyển dụng\n`;
    md += `| Giai đoạn | Số ứng viên |\n|:---|:---:|\n`;
    const stageOrder = ['applied', 'screening', 'interview_1', 'interview_2', 'offer', 'hired', 'rejected'];
    const stageNames: Record<string, string> = {
      applied: 'Ứng tuyển', screening: 'Sàng lọc', interview_1: 'PV vòng 1',
      interview_2: 'PV vòng 2', offer: 'Offer', hired: 'Đã tuyển', rejected: 'Từ chối'
    };
    stageOrder.forEach(s => {
      if (stages[s]) md += `| ${stageNames[s] || s} | ${stages[s]} |\n`;
    });

    if (urgentJobs.length > 0) {
      md += `\n### 🚨 Vị trí Khẩn cấp\n`;
      urgentJobs.forEach((j: any) => { md += `- **${j.title}** (${j.department || '—'})\n`; });
    }

    if (topJobs.length > 0) {
      md += `\n### Top vị trí nhiều ứng viên\n`;
      md += `| Vị trí | Số ứng viên |\n|:---|:---:|\n`;
      topJobs.forEach(j => { md += `| ${j.title} | ${j.count} |\n`; });
    }

    md += `\n*(AI Instruction: Nhận xét phễu tuyển dụng có lành mạnh không, tỷ lệ chuyển đổi có tốt không, thời gian tuyển có quá lâu không)*`;
    return md;
  }
};

// ═══════════════════════════════════════════════
// 2. getSalaryInsightsTool
// ═══════════════════════════════════════════════

export const getSalaryInsightsTool: OpenClawTool = {
  name: 'get_salary_insights',
  description: 'Phân tích lương: Benchmark theo phòng ban, tổng chi lương, trend tăng lương. CHỈ TGĐ và Kế toán trưởng xem toàn bộ. Trưởng đơn vị chỉ xem đơn vị mình.',
  schema: {
    unitId: { type: 'string', description: 'ID đơn vị (để trống = toàn công ty, chỉ TGĐ/KTT)' },
  },
  execute: async (args, context: UserContext) => {
    // Phân quyền nghiêm ngặt: chỉ TGĐ, KTT xem toàn bộ
    const isTopLevel = context.role === 'Director' || context.role === 'AccountantChief';
    const isUnitLeader = context.role === 'UnitLeader' || context.role === 'AdminUnit';

    if (!isTopLevel && !isUnitLeader) {
      return '🔒 Bạn không có quyền xem thông tin lương. Chỉ TGĐ, Kế toán trưởng hoặc Trưởng đơn vị mới được truy cập.';
    }

    let unitFilter: string | undefined;
    if (isUnitLeader && !isTopLevel) {
      // Trưởng đơn vị chỉ xem đơn vị mình
      unitFilter = context.unitId;
      if (!unitFilter) return '🔒 Không xác định được đơn vị của bạn.';
    } else {
      unitFilter = args.unitId || undefined;
    }

    // Lấy lương mới nhất của mỗi nhân viên
    let empQuery = supabase
      .from('employees')
      .select('id, name, position, unit_id')
      .or('status.is.null,status.eq.active');
    if (unitFilter) empQuery = empQuery.eq('unit_id', unitFilter);

    const { data: employees } = await empQuery;
    if (!employees || employees.length === 0) return 'Không có dữ liệu nhân viên.';

    const empIds = employees.map((e: any) => e.id);
    const { data: salaries } = await supabase
      .from('employee_salary_history')
      .select('employee_id, base_salary, allowance, effective_date')
      .in('employee_id', empIds)
      .order('effective_date', { ascending: false });

    // Lấy lương mới nhất cho mỗi NV
    const latestSalary: Record<string, any> = {};
    (salaries || []).forEach((s: any) => {
      if (!latestSalary[s.employee_id]) latestSalary[s.employee_id] = s;
    });

    const units = await UnitService.getAll();
    const unitMap: Record<string, string> = {};
    units.forEach((u: any) => { unitMap[u.id] = u.name; });

    // Aggregate theo đơn vị
    const byUnit: Record<string, { count: number; totalBase: number; totalAllow: number }> = {};
    let grandTotalBase = 0;
    let grandTotalAllow = 0;
    let hasDataCount = 0;

    employees.forEach((e: any) => {
      const uName = unitMap[e.unit_id] || 'Khác';
      if (!byUnit[uName]) byUnit[uName] = { count: 0, totalBase: 0, totalAllow: 0 };
      byUnit[uName].count++;

      const sal = latestSalary[e.id];
      if (sal) {
        byUnit[uName].totalBase += (sal.base_salary || 0);
        byUnit[uName].totalAllow += (sal.allowance || 0);
        grandTotalBase += (sal.base_salary || 0);
        grandTotalAllow += (sal.allowance || 0);
        hasDataCount++;
      }
    });

    const avgSalary = hasDataCount > 0 ? Math.round(grandTotalBase / hasDataCount) : 0;

    let md = `## 💰 PHÂN TÍCH LƯƠNG${unitFilter ? ` — ${unitMap[unitFilter] || ''}` : ' TOÀN CÔNG TY'}\n\n`;
    md += `### Tổng quan\n`;
    md += `| Chỉ số | Giá trị |\n|:---|---:|\n`;
    md += `| Tổng nhân sự | ${employees.length} |\n`;
    md += `| Có dữ liệu lương | ${hasDataCount} |\n`;
    md += `| Tổng chi lương cơ bản/tháng | ${fmtMoney(grandTotalBase)} |\n`;
    md += `| Tổng phụ cấp/tháng | ${fmtMoney(grandTotalAllow)} |\n`;
    md += `| **Tổng chi/tháng** | **${fmtMoney(grandTotalBase + grandTotalAllow)}** |\n`;
    md += `| Lương TB/người | ${fmtMoney(avgSalary)} |\n\n`;

    if (!unitFilter) {
      md += `### Phân bổ theo Đơn vị\n`;
      md += `| Đơn vị | Số NV | Lương TB | Tổng chi/tháng |\n|:---|:---:|---:|---:|\n`;
      Object.entries(byUnit).sort((a, b) => b[1].totalBase - a[1].totalBase).forEach(([name, v]) => {
        const avg = v.count > 0 ? Math.round(v.totalBase / v.count) : 0;
        md += `| ${name} | ${v.count} | ${fmtMoney(avg)} | ${fmtMoney(v.totalBase + v.totalAllow)} |\n`;
      });
    }

    md += `\n*(AI Instruction: Phân tích benchmark lương theo phòng ban. Nhận xét tổng chi lương có phù hợp với quy mô không)*`;
    return md;
  }
};

// ═══════════════════════════════════════════════
// 3. getPayrollSummaryTool
// ═══════════════════════════════════════════════

export const getPayrollSummaryTool: OpenClawTool = {
  name: 'get_payroll_summary',
  description: 'Tổng hợp bảng lương tháng: Tổng chi, trạng thái thanh toán, phân bổ theo đơn vị. Dùng khi user hỏi "bảng lương", "payroll", "chi lương tháng".',
  schema: {
    year: { type: 'string', description: 'Năm (VD: 2026)' },
    month: { type: 'string', description: 'Tháng (1-12)' },
  },
  execute: async (args, context: UserContext) => {
    const isTopLevel = context.role === 'Director' || context.role === 'AccountantChief';
    if (!isTopLevel) {
      return '🔒 Chỉ TGĐ và Kế toán trưởng mới có quyền xem bảng lương tổng hợp.';
    }

    const year = args.year ? parseInt(args.year) : new Date().getFullYear();
    const month = args.month ? parseInt(args.month) : new Date().getMonth() + 1;

    const { data: payrolls } = await supabase
      .from('payroll_records')
      .select('*, employee:employees!employee_id(name, unit_id)')
      .eq('year', year)
      .eq('month', month);

    if (!payrolls || payrolls.length === 0) {
      return `Chưa có dữ liệu bảng lương tháng ${month}/${year}.`;
    }

    const units = await UnitService.getAll();
    const unitMap: Record<string, string> = {};
    units.forEach((u: any) => { unitMap[u.id] = u.name; });

    let totalGross = 0, totalNet = 0, totalDeductions = 0;
    const byUnit: Record<string, { count: number; gross: number; net: number }> = {};

    payrolls.forEach((p: any) => {
      const gross = p.gross_salary || 0;
      const net = p.net_salary || 0;
      const deductions = p.total_deductions || 0;
      totalGross += gross;
      totalNet += net;
      totalDeductions += deductions;

      const uName = unitMap[p.employee?.unit_id] || 'Khác';
      if (!byUnit[uName]) byUnit[uName] = { count: 0, gross: 0, net: 0 };
      byUnit[uName].count++;
      byUnit[uName].gross += gross;
      byUnit[uName].net += net;
    });

    let md = `## 💵 BẢNG LƯƠNG THÁNG ${month}/${year}\n\n`;
    md += `### Tổng quan\n`;
    md += `| Chỉ số | Giá trị |\n|:---|---:|\n`;
    md += `| Tổng nhân viên | ${payrolls.length} |\n`;
    md += `| Tổng lương Gross | ${fmtMoney(totalGross)} |\n`;
    md += `| Tổng khấu trừ | ${fmtMoney(totalDeductions)} |\n`;
    md += `| **Tổng lương Net** | **${fmtMoney(totalNet)}** |\n\n`;

    md += `### Phân bổ theo Đơn vị\n`;
    md += `| Đơn vị | Số NV | Gross | Net |\n|:---|:---:|---:|---:|\n`;
    Object.entries(byUnit).sort((a, b) => b[1].gross - a[1].gross).forEach(([name, v]) => {
      md += `| ${name} | ${v.count} | ${fmtMoney(v.gross)} | ${fmtMoney(v.net)} |\n`;
    });

    md += `\n*(AI Instruction: So sánh với tháng trước nếu có. Nhận xét tổng chi lương)*`;
    return md;
  }
};

// ═══════════════════════════════════════════════
// 4. getOnboardingStatusTool
// ═══════════════════════════════════════════════

export const getOnboardingStatusTool: OpenClawTool = {
  name: 'get_onboarding_status',
  description: 'Theo dõi tiến độ onboarding nhân viên mới: Checklist hoàn thành, ai đang onboard. Dùng khi user hỏi "onboarding", "nhân viên mới", "tiến độ hội nhập".',
  schema: {},
  execute: async (args, context: UserContext) => {
    const { data: sessions } = await supabase
      .from('onboarding_sessions')
      .select('*, employee:employees!employee_id(name, position, unit_id), template:onboarding_templates!template_id(name)')
      .in('status', ['in_progress', 'not_started'])
      .order('start_date', { ascending: false });

    if (!sessions || sessions.length === 0) {
      return '✅ Không có nhân viên nào đang trong quá trình onboarding.';
    }

    const units = await UnitService.getAll();
    const unitMap: Record<string, string> = {};
    units.forEach((u: any) => { unitMap[u.id] = u.name; });

    let md = `## 🚀 THEO DÕI ONBOARDING\n\n`;
    md += `**Tổng:** ${sessions.length} nhân viên đang onboard\n\n`;
    md += `| # | Nhân viên | Chức vụ | Đơn vị | Template | Trạng thái | Ngày bắt đầu |\n`;
    md += `|---|:---|:---|:---|:---|:---:|:---|\n`;

    sessions.forEach((s: any, i: number) => {
      const uName = unitMap[s.employee?.unit_id] || '—';
      const status = s.status === 'in_progress' ? '🟡 Đang thực hiện' : '⚪ Chưa bắt đầu';
      md += `| ${i + 1} | ${s.employee?.name || '—'} | ${s.employee?.position || '—'} | ${uName} | ${s.template?.name || '—'} | ${status} | ${s.start_date || '—'} |\n`;
    });

    md += `\n*(AI Instruction: Nhận xét tiến độ onboarding, nhắc nhở nếu có nhân viên chưa bắt đầu)*`;
    return md;
  }
};
