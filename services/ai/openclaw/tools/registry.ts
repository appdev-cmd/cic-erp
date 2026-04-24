// @ts-nocheck
import type { OpenClawTool } from '../types';
import { marketingToolsRegistry } from './marketingTools';

import { searchContractsTool, getContractDetailTool, getContractStatsTool, getOverdueContractsTool, getContractExpiryTimelineTool } from './contract.tools';
import { searchCustomersTool, getCustomer360Tool } from './customer.tools';
import { searchProductsTool, getBrandsReportTool } from './product.tools';
import { searchPaymentsTool, getDebtReportTool, getCashflowSummaryTool, getRevenueForecastTool, getExpenseBreakdownTool, getBudgetVarianceReportTool } from './finance.tools';
import { searchEmployeesTool, getEmployeeRankingTool, getEmployeeWorkloadTool, getHrHeadcountStatsTool } from './hr.tools';
import { createTaskAiTool, approveTaskTool, exportDocumentTool, sendNotificationEmailTool } from './system.tools';
import { getDashboardKpiTool, getComparativeReportTool, getUnitRankingTool, getDailyBriefingTool, getComprehensiveReportTool, getSmartInsightsTool } from './dashboard.tools';
import { searchKnowledgeBaseTool, searchDocumentRegistryTool } from './knowledge.tools';
import { delegateTaskTool } from './master.tools';

export {
    searchContractsTool, getContractDetailTool, getContractStatsTool, getOverdueContractsTool, getContractExpiryTimelineTool,
    searchCustomersTool, getCustomer360Tool,
    searchProductsTool, getBrandsReportTool,
    searchPaymentsTool, getDebtReportTool, getCashflowSummaryTool, getRevenueForecastTool, getExpenseBreakdownTool, getBudgetVarianceReportTool,
    searchEmployeesTool, getEmployeeRankingTool, getEmployeeWorkloadTool, getHrHeadcountStatsTool,
    createTaskAiTool, approveTaskTool, exportDocumentTool, sendNotificationEmailTool,
    getDashboardKpiTool, getComparativeReportTool, getUnitRankingTool, getDailyBriefingTool, getComprehensiveReportTool, getSmartInsightsTool,
    searchKnowledgeBaseTool, searchDocumentRegistryTool,
    delegateTaskTool
};

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
