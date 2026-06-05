// @ts-nocheck
import type { OpenClawTool } from '../types';
import { marketingToolsRegistry } from './marketingTools';

import { searchContractsTool, getContractDetailTool, getContractStatsTool, getOverdueContractsTool, getContractExpiryTimelineTool } from './contract.tools';
import { searchCustomersTool, getCustomer360Tool, getCrmPipelineTool } from './customer.tools';
import { searchProductsTool, getBrandsReportTool } from './product.tools';
import { searchPaymentsTool, getDebtReportTool, getCashflowSummaryTool, getRevenueForecastTool, getExpenseBreakdownTool, getBudgetVarianceReportTool } from './finance.tools';
import { searchEmployeesTool, getEmployeeRankingTool, getEmployeeWorkloadTool, getHrHeadcountStatsTool } from './hr.tools';
import { createTaskAiTool, approveTaskTool, exportDocumentTool, sendNotificationEmailTool, searchTasksTool } from './system.tools';
import { getDashboardKpiTool, getComparativeReportTool, getUnitRankingTool, getDailyBriefingTool, getComprehensiveReportTool, getSmartInsightsTool } from './dashboard.tools';
import { searchKnowledgeBaseTool, searchDocumentRegistryTool } from './knowledge.tools';
import { delegateTaskTool } from './master.tools';
import { createSmartPlanTool, analyzeBottleneckTool, forecastNextQuarterTool, getProjectStatusTool } from './planning.tools';
import { getLeaveSummaryTool, getAttendanceReportTool, getContractLaborExpiryTool, getEmployeeProfile360Tool } from './hrExtended.tools';
import { getRecruitmentPipelineTool, getSalaryInsightsTool, getPayrollSummaryTool, getOnboardingStatusTool } from './hrFinance.tools';

export {
    searchContractsTool, getContractDetailTool, getContractStatsTool, getOverdueContractsTool, getContractExpiryTimelineTool,
    searchCustomersTool, getCustomer360Tool, getCrmPipelineTool,
    searchProductsTool, getBrandsReportTool,
    searchPaymentsTool, getDebtReportTool, getCashflowSummaryTool, getRevenueForecastTool, getExpenseBreakdownTool, getBudgetVarianceReportTool,
    searchEmployeesTool, getEmployeeRankingTool, getEmployeeWorkloadTool, getHrHeadcountStatsTool,
    getLeaveSummaryTool, getAttendanceReportTool, getContractLaborExpiryTool, getEmployeeProfile360Tool,
    getRecruitmentPipelineTool, getSalaryInsightsTool, getPayrollSummaryTool, getOnboardingStatusTool,
    createTaskAiTool, approveTaskTool, exportDocumentTool, sendNotificationEmailTool, searchTasksTool,
    getDashboardKpiTool, getComparativeReportTool, getUnitRankingTool, getDailyBriefingTool, getComprehensiveReportTool, getSmartInsightsTool,
    searchKnowledgeBaseTool, searchDocumentRegistryTool,
    delegateTaskTool,
    createSmartPlanTool, analyzeBottleneckTool, forecastNextQuarterTool, getProjectStatusTool,
};

import { createGuardedTool } from '../permissionGuard';

export const erpToolsRegistry: OpenClawTool[] = [
  ...marketingToolsRegistry.map(t => createGuardedTool(t)),
  createGuardedTool(searchContractsTool),
  createGuardedTool(getContractDetailTool),
  createGuardedTool(getContractStatsTool),
  createGuardedTool(getOverdueContractsTool),
  createGuardedTool(getContractExpiryTimelineTool),
  createGuardedTool(searchCustomersTool),
  createGuardedTool(getCustomer360Tool),
  createGuardedTool(searchProductsTool),
  createGuardedTool(getBrandsReportTool),
  createGuardedTool(searchPaymentsTool),
  createGuardedTool(getDebtReportTool),
  createGuardedTool(getCashflowSummaryTool),
  createGuardedTool(getRevenueForecastTool),
  createGuardedTool(getExpenseBreakdownTool),
  createGuardedTool(getBudgetVarianceReportTool),
  createGuardedTool(searchEmployeesTool),
  createGuardedTool(getEmployeeRankingTool),
  createGuardedTool(getEmployeeWorkloadTool),
  createGuardedTool(getHrHeadcountStatsTool),
  createGuardedTool(createTaskAiTool),
  createGuardedTool(approveTaskTool),
  createGuardedTool(exportDocumentTool),
  createGuardedTool(sendNotificationEmailTool),
  createGuardedTool(getDashboardKpiTool),
  createGuardedTool(getComparativeReportTool),
  createGuardedTool(getUnitRankingTool),
  createGuardedTool(getDailyBriefingTool),
  createGuardedTool(getComprehensiveReportTool),
  createGuardedTool(getSmartInsightsTool),
  createGuardedTool(searchKnowledgeBaseTool),
  createGuardedTool(searchDocumentRegistryTool),
  createGuardedTool(delegateTaskTool),
  createGuardedTool(createSmartPlanTool),
  createGuardedTool(analyzeBottleneckTool),
  createGuardedTool(forecastNextQuarterTool),
  // HR Extended (Phase 2)
  createGuardedTool(getLeaveSummaryTool),
  createGuardedTool(getAttendanceReportTool),
  createGuardedTool(getContractLaborExpiryTool),
  createGuardedTool(getEmployeeProfile360Tool),
  // HR Finance & Recruitment (Phase 3)
  createGuardedTool(getRecruitmentPipelineTool),
  createGuardedTool(getSalaryInsightsTool),
  createGuardedTool(getPayrollSummaryTool),
  createGuardedTool(getOnboardingStatusTool),
  // New Tools (Phase 2, 3 & 4 additions)
  createGuardedTool(searchTasksTool),
  createGuardedTool(getCrmPipelineTool),
  createGuardedTool(getProjectStatusTool),
];
