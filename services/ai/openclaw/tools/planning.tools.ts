// @ts-nocheck
import { dataClient as supabase } from '../../../../lib/dataClient';
import { ContractService } from '../../../contractService';
import { EmployeeService } from '../../../employeeService';
import { UnitService } from '../../../unitService';
import { TaskService } from '../../../taskService';
import { ProjectService } from '../../../projectService';
import type { OpenClawTool, UserContext } from '../types';
import { fmtMoney, isBusinessUnit, canViewAll, getUnitFilter } from './_helpers';

// ═══════════════════════════════════════════════
// createSmartPlanTool
// ═══════════════════════════════════════════════
export const createSmartPlanTool: OpenClawTool = {
  name: 'create_smart_plan',
  description: 'Tự động lên kế hoạch tuần/tháng dựa trên dữ liệu thực tế: workload nhân viên, HĐ sắp hết hạn, công nợ cần thu. Tự động tạo tasks luôn mà không cần xác nhận. Dùng khi user hỏi "lên kế hoạch", "plan tuần này", "phân công việc".',
  schema: {
    planType: { type: 'string', enum: ['weekly', 'monthly'], description: 'Loại kế hoạch: weekly (tuần) hoặc monthly (tháng)' },
    focusArea: { type: 'string', description: 'Lĩnh vực ưu tiên: "contracts" (HĐ), "debt_collection" (công nợ), "sales" (kinh doanh), "all" (toàn diện)' },
    assignedTo: { type: 'string', description: 'ID nhân viên được giao (để trống = tự động phân công)' },
  },
  execute: async (args, context: UserContext) => {
    // SECURITY: Role gate — only Leadership/UnitLeader/Admin can auto-create plans
    const allowedPlanRoles = ['Admin', 'Leadership', 'UnitLeader'];
    if (!allowedPlanRoles.includes(context.role)) {
      return 'Truy cập bị từ chối: Chỉ Ban Giám đốc, Trưởng đơn vị hoặc Admin mới có thể tạo kế hoạch tự động.';
    }

    // SECURITY: Unit scope for queries
    const forcedUnitId = getUnitFilter(args, context);

    const today = new Date();
    const focusArea = args.focusArea || 'all';
    const isWeekly = args.planType !== 'monthly';
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (isWeekly ? 7 : 30));
    const todayStr = today.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // 1. Lấy dữ liệu song song
    let overdueQuery = supabase.from('contracts').select('id, name, end_date, unit_id').eq('status', 'Processing').lt('end_date', todayStr).limit(10);
    let expiryQuery = supabase.from('contracts').select('id, name, end_date, unit_id').eq('status', 'Processing').gte('end_date', todayStr).lte('end_date', endStr).limit(10);
    let debtQuery = supabase.from('payments').select('id, contract_id, amount, paid_amount, due_date, contracts!inner(unit_id)').in('status', ['Chưa thanh toán', 'Đã xuất HĐ']).lt('due_date', endStr).limit(10);

    if (forcedUnitId) {
      overdueQuery = overdueQuery.eq('unit_id', forcedUnitId);
      expiryQuery = expiryQuery.eq('unit_id', forcedUnitId);
      debtQuery = debtQuery.eq('contracts.unit_id', forcedUnitId);
    }

    const [overdueRes, expiryRes, debtRes] = await Promise.all([overdueQuery, expiryQuery, debtQuery]);

    const overdueContracts = overdueRes.data || [];
    const expiringContracts = expiryRes.data || [];
    const pendingPayments = debtRes.data || [];

    // 2. Lấy danh sách task chưa hoàn thành để chống spam tạo trùng lặp
    const { data: existingTasksData } = await supabase
      .from('tasks')
      .select('source_entity_id')
      .eq('source_module', 'contracts')
      .is('completed_at', null);
    
    const existingTaskEntityIds = new Set((existingTasksData || []).map((t: any) => t.source_entity_id));

    // 3. Tạo tasks tự động
    const createdTasks: string[] = [];
    const assignee = args.assignedTo || context.userId;

    if (focusArea === 'all' || focusArea === 'contracts') {
      for (const c of overdueContracts.slice(0, 3)) {
        if (existingTaskEntityIds.has(c.id)) {
          createdTasks.push(`⏭️ Bỏ qua HĐ **${c.name}** (Đã có task đang mở)`);
          continue;
        }
        try {
          await TaskService.create({
            title: `[KH AUTO] Đốc thúc HĐ quá hạn: ${c.name}`,
            description: `Hợp đồng ${c.name} đã quá hạn hoàn thành. Cần liên hệ khách hàng và cập nhật tiến độ.`,
            due_date: endStr,
            assignees: assignee ? [assignee] : [],
            priority: 'high',
            source_module: 'contracts',
            source_entity_id: c.id,
            auto_generated: true,
            created_by: context.userId,
            tags: ['auto-plan'],
          });
          createdTasks.push(`✅ Task: Đốc thúc HĐ **${c.name}**`);
        } catch { createdTasks.push(`⚠️ Lỗi tạo task cho HĐ ${c.name}`); }
      }
    }

    if (focusArea === 'all' || focusArea === 'debt_collection') {
      let totalDebt = 0;
      pendingPayments.forEach(p => { totalDebt += (p.amount || 0) - (p.paid_amount || 0); });
      if (totalDebt > 0) {
        try {
          await TaskService.create({
            title: `[KH AUTO] Thu hồi công nợ ${isWeekly ? 'tuần' : 'tháng'} này`,
            description: `Có ${pendingPayments.length} khoản công nợ cần thu, tổng ${fmtMoney(totalDebt)}. Ưu tiên liên hệ khách hàng theo danh sách đính kèm.`,
            due_date: endStr,
            assignees: assignee ? [assignee] : [],
            priority: 'high',
            source_module: 'payment',
            auto_generated: true,
            created_by: context.userId,
            tags: ['auto-plan', 'debt-collection'],
          });
          createdTasks.push(`✅ Task: Thu hồi công nợ **${fmtMoney(totalDebt)}**`);
        } catch { createdTasks.push(`⚠️ Lỗi tạo task thu hồi công nợ`); }
      }
    }

    // 3. Build markdown report
    let md = `## 📋 KẾ HOẠCH ${isWeekly ? 'TUẦN' : 'THÁNG'} TỰ ĐỘNG\n`;
    md += `_Tạo bởi AI Planning Agent — ${todayStr} đến ${endStr}_\n\n`;

    md += `### 🔴 Tình hình cần xử lý ngay\n`;
    if (overdueContracts.length > 0) {
      md += `- **${overdueContracts.length} HĐ đã quá hạn hoàn thành** — cần đốc thúc ngay\n`;
      overdueContracts.forEach(c => { md += `  - [${c.name}](/contracts/${c.id}) — hạn: ${c.end_date}\n`; });
    }
    if (pendingPayments.length > 0) {
      const total = pendingPayments.reduce((s, p) => s + ((p.amount || 0) - (p.paid_amount || 0)), 0);
      md += `- **Công nợ cần thu:** ${fmtMoney(total)} (${pendingPayments.length} khoản đến hạn trước ${endStr})\n`;
    }
    if (expiringContracts.length > 0) {
      md += `\n### 🟡 HĐ sắp hết hạn (cần theo dõi)\n`;
      expiringContracts.forEach(c => { md += `- [${c.name}](/contracts/${c.id}) — hạn: ${c.end_date}\n`; });
    }

    md += `\n### ✅ Tasks đã tự động tạo (${createdTasks.length})\n`;
    if (createdTasks.length > 0) {
      createdTasks.forEach(t => { md += `${t}\n`; });
    } else {
      md += `_Không có tasks mới cần tạo._\n`;
    }

    md += `\n> *(AI Instruction: Trình bày kế hoạch trên, nhận xét ưu tiên và đề xuất thêm hành động cụ thể nếu cần)*`;
    return md;
  }
};

// ═══════════════════════════════════════════════
// analyzeBottleneckTool
// ═══════════════════════════════════════════════
export const analyzeBottleneckTool: OpenClawTool = {
  name: 'analyze_bottleneck',
  description: 'Phát hiện bottleneck: nhân viên quá tải, HĐ bị chậm, tasks bị block. Dùng khi user hỏi "ai đang quá tải", "bottleneck", "tắc nghẽn", "đơn vị nào chậm".',
  schema: {
    unit_id: { type: 'string', description: 'ID đơn vị cần phân tích (để trống = toàn công ty)' },
  },
  execute: async (args, context: UserContext) => {
    // SECURITY: Unit scope
    const forcedUnitId = getUnitFilter(args, context);

    const today = new Date().toISOString().split('T')[0];

    let overdueTasksQuery = supabase.from('tasks').select('id, title, assignees, due_date').lt('due_date', today).is('completed_at', null).limit(50);
    let overdueContractsQuery = supabase.from('contracts').select('id, name, end_date, unit_id').eq('status', 'Processing').lt('end_date', today).limit(20);

    if (forcedUnitId) {
      overdueContractsQuery = overdueContractsQuery.eq('unit_id', forcedUnitId);
    }

    const [overdueTasksRes, overdueContractsRes, employeesRes] = await Promise.all([
      overdueTasksQuery,
      overdueContractsQuery,
      EmployeeService.getAll(),
    ]);

    const overdueTasks = overdueTasksRes.data || [];
    const overdueContracts = overdueContractsRes.data || [];
    let employees = employeesRes || [];

    // SECURITY: Filter employees by unit for non-global roles
    if (forcedUnitId) {
      employees = employees.filter((e: any) => e.unit_id === forcedUnitId);
    }
    const empIds = new Set(employees.map((e: any) => e.id));

    // Tính workload theo nhân viên (filtered by unit)
    const workloadMap: Record<string, number> = {};
    overdueTasks.forEach(t => {
      const assignees: string[] = t.assignees || [];
      assignees.forEach(aId => {
        if (!forcedUnitId || empIds.has(aId)) {
          workloadMap[aId] = (workloadMap[aId] || 0) + 1;
        }
      });
    });

    const empMap = new Map(employees.map((e: any) => [e.id, e.name]));
    const overloadedEmps = Object.entries(workloadMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ name: empMap.get(id) || id, overdueTaskCount: count }));

    let md = `## 🔍 PHÂN TÍCH BOTTLENECK\n_Dữ liệu tính đến: ${today}_\n\n`;

    md += `### ⚠️ Tóm tắt rủi ro\n`;
    md += `- **Tasks trễ deadline:** ${overdueTasks.length}\n`;
    md += `- **HĐ quá hạn hoàn thành:** ${overdueContracts.length}\n\n`;

    if (overloadedEmps.length > 0) {
      md += `### 👤 Nhân viên đang quá tải (tasks trễ nhiều nhất)\n`;
      md += `| Nhân viên | Tasks trễ |\n|---|:---:|\n`;
      overloadedEmps.forEach(e => { md += `| ${e.name} | 🔴 ${e.overdueTaskCount} |\n`; });
      md += '\n';
    }

    if (overdueContracts.length > 0) {
      md += `### 📄 HĐ đang bị chậm\n`;
      overdueContracts.slice(0, 8).forEach(c => {
        md += `- [${c.name}](/contracts/${c.id}) — hạn: ${c.end_date}\n`;
      });
    }

    md += `\n> *(AI Instruction: Nhận định nguyên nhân bottleneck và đề xuất tái phân công nguồn lực cụ thể)*`;
    return md;
  }
};

// ═══════════════════════════════════════════════
// forecastNextQuarterTool
// ═══════════════════════════════════════════════
export const forecastNextQuarterTool: OpenClawTool = {
  name: 'forecast_next_quarter',
  description: 'Dự báo kết quả kinh doanh Quý tiếp theo dựa trên xu hướng lịch sử. Dùng khi user hỏi "dự báo", "forecast", "quý tới đạt bao nhiêu", "dự kiến doanh thu".',
  schema: {
    targetQuarter: { type: 'string', description: 'Quý mục tiêu: Q1, Q2, Q3, Q4 (VD: Q3). Mặc định = quý tiếp theo.' },
    targetYear: { type: 'string', description: 'Năm mục tiêu (VD: 2026). Mặc định = năm hiện tại.' },
  },
  execute: async (args, context: UserContext) => {
    // SECURITY: Unit scope
    const forcedUnitId = getUnitFilter(args, context);

    const year = parseInt(args.targetYear || String(new Date().getFullYear()));
    const now = new Date();
    const currentQ = Math.ceil((now.getMonth() + 1) / 3);
    const targetQ = args.targetQuarter
      ? parseInt(args.targetQuarter.replace('Q', ''))
      : (currentQ % 4) + 1;

    // Lấy dữ liệu 2 quý gần nhất để tính trend
    const getQRange = (q: number, y: number) => {
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = q * 3;
      const pad = (n: number) => String(n).padStart(2, '0');
      return {
        from: `${y}-${pad(startMonth)}-01`,
        to: `${y}-${pad(endMonth)}-${endMonth === 3 ? '31' : endMonth === 6 ? '30' : endMonth === 9 ? '30' : '31'}`
      };
    };

    const prevQ = targetQ === 1 ? 4 : targetQ - 1;
    const prevYear = targetQ === 1 ? year - 1 : year;
    const prev2Q = prevQ === 1 ? 4 : prevQ - 1;
    const prev2Year = prevQ === 1 ? prevYear - 1 : prevYear;

    const r1 = getQRange(prevQ, prevYear);
    const r2 = getQRange(prev2Q, prev2Year);

    let q1Query = supabase.from('contracts').select('value, actual_revenue').gte('signed_date', r1.from).lte('signed_date', r1.to);
    let q2Query = supabase.from('contracts').select('value, actual_revenue').gte('signed_date', r2.from).lte('signed_date', r2.to);
    let pipelineQuery = supabase.from('contracts').select('value').eq('status', 'Processing').gte('end_date', new Date().toISOString().split('T')[0]);

    if (forcedUnitId) {
      q1Query = q1Query.eq('unit_id', forcedUnitId);
      q2Query = q2Query.eq('unit_id', forcedUnitId);
      pipelineQuery = pipelineQuery.eq('unit_id', forcedUnitId);
    }

    const [q1Res, q2Res, pipelineRes] = await Promise.all([q1Query, q2Query, pipelineQuery]);

    const calcTotals = (rows: any[]) => ({
      signing: (rows || []).reduce((s: number, r: any) => s + (r.value || 0), 0),
      revenue: (rows || []).reduce((s: number, r: any) => s + (r.actual_revenue || 0), 0),
    });

    const q1 = calcTotals(q1Res.data || []);
    const q2 = calcTotals(q2Res.data || []);
    const pipeline = (pipelineRes.data || []).reduce((s: number, r: any) => s + (r.value || 0), 0);

    // Tính growth rate (có chặn cap +/- 30% để tránh forecast phi thực tế)
    let signingGrowth = q2.signing > 0 ? (q1.signing - q2.signing) / q2.signing : 0;
    let revenueGrowth = q2.revenue > 0 ? (q1.revenue - q2.revenue) / q2.revenue : 0;
    
    signingGrowth = Math.max(Math.min(signingGrowth, 0.3), -0.3);
    revenueGrowth = Math.max(Math.min(revenueGrowth, 0.3), -0.3);

    // Dự báo = quý gần nhất × (1 + growth rate)
    const forecastSigning = Math.round(q1.signing * (1 + signingGrowth));
    const forecastRevenue = Math.round(q1.revenue * (1 + revenueGrowth));

    const chartJson = JSON.stringify({
      type: 'bar',
      title: `Dự báo Q${targetQ}/${year} so với 2 quý trước`,
      xAxisKey: 'name',
      data: [
        { name: `Q${prev2Q}/${prev2Year}`, 'Ký kết': Math.round(q2.signing / 1e9 * 100) / 100, 'Doanh thu': Math.round(q2.revenue / 1e9 * 100) / 100 },
        { name: `Q${prevQ}/${prevYear}`, 'Ký kết': Math.round(q1.signing / 1e9 * 100) / 100, 'Doanh thu': Math.round(q1.revenue / 1e9 * 100) / 100 },
        { name: `Q${targetQ}/${year} (DỰ BÁO)`, 'Ký kết': Math.round(forecastSigning / 1e9 * 100) / 100, 'Doanh thu': Math.round(forecastRevenue / 1e9 * 100) / 100 },
      ],
      lines: [
        { dataKey: 'Ký kết', color: '#6366f1' },
        { dataKey: 'Doanh thu', color: '#10b981' },
      ],
      unit: 'tỷ VND',
    });

    let md = `## 📈 DỰ BÁO Q${targetQ}/${year}\n\n`;
    md += `### Căn cứ dự báo\n`;
    md += `| Chỉ tiêu | Q${prev2Q}/${prev2Year} | Q${prevQ}/${prevYear} | Tăng trưởng | **Dự báo Q${targetQ}** |\n`;
    md += `|---|---|---|:---:|:---:|\n`;
    md += `| Ký kết | ${fmtMoney(q2.signing)} | ${fmtMoney(q1.signing)} | ${(signingGrowth * 100).toFixed(1)}% | **${fmtMoney(forecastSigning)}** |\n`;
    md += `| Doanh thu | ${fmtMoney(q2.revenue)} | ${fmtMoney(q1.revenue)} | ${(revenueGrowth * 100).toFixed(1)}% | **${fmtMoney(forecastRevenue)}** |\n\n`;
    md += `- **Pipeline HĐ đang thực hiện:** ${fmtMoney(pipeline)} (sẽ tiếp tục ghi nhận doanh thu)\n\n`;
    md += `### Biểu đồ xu hướng\n\`\`\`chart\n${chartJson}\n\`\`\`\n\n`;
    md += `> *(AI Instruction: Nhận xét xu hướng, nêu rõ yếu tố rủi ro và cơ hội, đề xuất KPI cụ thể cho Q${targetQ})*`;
    return md;
  }
};

// ═══════════════════════════════════════════════
// getProjectStatusTool
// ═══════════════════════════════════════════════
export const getProjectStatusTool: OpenClawTool = {
  name: 'get_project_status',
  description: 'Truy xuất thông tin tiến độ hoàn thành, giá trị hợp đồng, phòng ban chủ quản của các dự án tư vấn BIM đang thực hiện. Dùng khi user hỏi "tiến độ dự án", "dự án BIM", "dự án đang làm".',
  schema: {
    unit_id: { type: 'string', description: 'ID đơn vị cần lọc (để trống = toàn công ty)' },
    status: { type: 'string', description: 'Trạng thái dự án để lọc (VD: Potential, Ongoing, Completed, Suspended)' },
  },
  execute: async (args, context: UserContext) => {
    // SECURITY: Unit scope
    const forcedUnitId = getUnitFilter(args, context);

    const [projects, units] = await Promise.all([
      ProjectService.getAll(),
      UnitService.getAll(),
    ]);

    const unitMap = new Map(units.map((u: any) => [u.id, u.name]));

    let filtered = projects;

    if (forcedUnitId) {
      filtered = filtered.filter(p => p.unitId === forcedUnitId);
    }
    if (args.status) {
      filtered = filtered.filter(p => p.status === args.status);
    }

    let md = `## 🏗️ TIẾN ĐỘ DỰ ÁN BIM\n`;
    md += `_Số lượng dự án tìm thấy: ${filtered.length}_\n\n`;

    if (filtered.length === 0) {
      md += `Không có dự án nào phù hợp với bộ lọc hiện tại.\n`;
      return md;
    }

    md += `| Mã dự án | Tên dự án | Khách hàng | Đơn vị | Tiến độ | Giá trị | Trạng thái |\n`;
    md += `|---|---|---|---|---|---|---|\n`;

    filtered.forEach(p => {
      const unitName = unitMap.get(p.unitId || '') || 'N/A';
      md += `| ${p.code || 'N/A'} | [${p.name}](/projects/${p.id}) | ${p.clientName || 'N/A'} | ${unitName} | ${p.progress}% | ${fmtMoney(p.contractValue)} | ${p.status} |\n`;
    });

    md += `\n> *(AI Instruction: Phân tích danh sách dự án, nhận diện các dự án bị chậm tiến độ (tiến độ thấp so với timeline dự kiến), hoặc có giá trị lớn cần lưu ý để cập nhật)*`;
    return md;
  }
};
