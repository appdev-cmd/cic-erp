// @ts-nocheck
import type { OpenClawTool } from '../types';
import { marketingToolsRegistry } from './marketingTools';

export { searchContractsTool, getContractDetailTool, getContractStatsTool, getOverdueContractsTool, getContractExpiryTimelineTool } from './contract.tools';
export { searchCustomersTool, getCustomer360Tool } from './customer.tools';
export { searchProductsTool, getBrandsReportTool } from './product.tools';
export { searchPaymentsTool, getDebtReportTool, getCashflowSummaryTool, getRevenueForecastTool, getExpenseBreakdownTool, getBudgetVarianceReportTool } from './finance.tools';
export { searchEmployeesTool, getEmployeeRankingTool, getEmployeeWorkloadTool, getHrHeadcountStatsTool } from './hr.tools';
export { createTaskAiTool, approveTaskTool, exportDocumentTool, sendNotificationEmailTool } from './system.tools';
export { getDashboardKpiTool, getComparativeReportTool, getUnitRankingTool, getDailyBriefingTool, getComprehensiveReportTool, getSmartInsightsTool } from './dashboard.tools';
export { searchKnowledgeBaseTool, searchDocumentRegistryTool } from './knowledge.tools';
export { delegateTaskTool } from './master.tools';

export const erpToolsRegistry: OpenClawTool[] = [
  ...marketingToolsRegistry,
  searchContractsTool,
  getContractDetailTool,
  getContractStatsTool,
  getOverdueContractsTool,
  getContractExpiryTimelineTool,
  searchCustomersTool,
  getCustomer360Tool,
  searchProductsTool,
  getBrandsReportTool,
  searchPaymentsTool,
  getDebtReportTool,
  getCashflowSummaryTool,
  getRevenueForecastTool,
  getExpenseBreakdownTool,
  getBudgetVarianceReportTool,
  searchEmployeesTool,
  getEmployeeRankingTool,
  getEmployeeWorkloadTool,
  getHrHeadcountStatsTool,
  createTaskAiTool,
  approveTaskTool,
  exportDocumentTool,
  sendNotificationEmailTool,
  getDashboardKpiTool,
  getComparativeReportTool,
  getUnitRankingTool,
  getDailyBriefingTool,
  getComprehensiveReportTool,
  getSmartInsightsTool,
  searchKnowledgeBaseTool,
  searchDocumentRegistryTool,
  delegateTaskTool
];
