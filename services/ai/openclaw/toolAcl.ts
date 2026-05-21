/**
 * Tool Access Control List (ACL) Registry
 * 
 * Defines which roles can access which tools.
 * This is the CENTRAL source of truth for AI tool permissions.
 * 
 * Rules:
 * - If a tool is NOT listed here, it defaults to GLOBAL_ROLES only (restrictive by default)
 * - '*' means all authenticated roles can access
 * - Array of roles means only those specific roles
 */

export type ToolSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

export interface ToolACLEntry {
  allowedRoles: string[] | '*';
  dataScope: 'company' | 'unit' | 'personal';
  isWriteAction: boolean;
  sensitivity: ToolSensitivity;
}

// Role constants for readability
const LEADERSHIP = 'Leadership';
const ADMIN = 'Admin';
const LEGAL = 'Legal';
const ACCOUNTANT = 'Accountant';
const CHIEF_ACCOUNTANT = 'ChiefAccountant';
const MARKETING = 'Marketing';
const UNIT_LEADER = 'UnitLeader';
const ADMIN_UNIT = 'AdminUnit';
const NVKD = 'NVKD';
const NVKT = 'NVKT';

// Shorthand role groups
const GLOBAL_ROLES = [ADMIN, LEADERSHIP, LEGAL, ACCOUNTANT, CHIEF_ACCOUNTANT, MARKETING];
const FINANCE_ROLES = [ADMIN, LEADERSHIP, ACCOUNTANT, CHIEF_ACCOUNTANT, LEGAL];
const HR_ROLES = [ADMIN, LEADERSHIP];
const UNIT_ROLES = [ADMIN, LEADERSHIP, UNIT_LEADER, ADMIN_UNIT, NVKD, NVKT, ACCOUNTANT, CHIEF_ACCOUNTANT, LEGAL];
const PLANNING_ROLES = [ADMIN, LEADERSHIP, UNIT_LEADER];

/**
 * Master ACL Map: toolName → permissions
 */
export const TOOL_ACL: Record<string, ToolACLEntry> = {
  // ═══ Contract Tools ═══════════════════════════════════
  search_contracts:              { allowedRoles: [...UNIT_ROLES],           dataScope: 'unit',    isWriteAction: false, sensitivity: 'internal' },
  get_contract_detail:           { allowedRoles: [...UNIT_ROLES],           dataScope: 'unit',    isWriteAction: false, sensitivity: 'confidential' },
  get_contract_stats:            { allowedRoles: [...UNIT_ROLES],           dataScope: 'unit',    isWriteAction: false, sensitivity: 'internal' },
  get_overdue_contracts:         { allowedRoles: [...UNIT_ROLES],           dataScope: 'unit',    isWriteAction: false, sensitivity: 'internal' },
  get_contract_expiry_timeline:  { allowedRoles: [...UNIT_ROLES],           dataScope: 'unit',    isWriteAction: false, sensitivity: 'internal' },

  // ═══ Finance Tools ════════════════════════════════════
  search_payments:               { allowedRoles: [...FINANCE_ROLES, UNIT_LEADER, ADMIN_UNIT], dataScope: 'unit', isWriteAction: false, sensitivity: 'confidential' },
  get_debt_report:               { allowedRoles: FINANCE_ROLES,             dataScope: 'company', isWriteAction: false, sensitivity: 'confidential' },
  get_cashflow_summary:          { allowedRoles: FINANCE_ROLES,             dataScope: 'company', isWriteAction: false, sensitivity: 'restricted' },
  get_revenue_forecast:          { allowedRoles: [...FINANCE_ROLES, UNIT_LEADER], dataScope: 'unit', isWriteAction: false, sensitivity: 'confidential' },
  get_expense_breakdown:         { allowedRoles: FINANCE_ROLES,             dataScope: 'company', isWriteAction: false, sensitivity: 'restricted' },
  get_budget_variance_report:    { allowedRoles: FINANCE_ROLES,             dataScope: 'company', isWriteAction: false, sensitivity: 'restricted' },

  // ═══ HR Tools ═════════════════════════════════════════
  search_employees:              { allowedRoles: [...HR_ROLES, UNIT_LEADER, ADMIN_UNIT, NVKD, NVKT], dataScope: 'unit', isWriteAction: false, sensitivity: 'internal' },
  get_employee_ranking:          { allowedRoles: [...HR_ROLES, UNIT_LEADER], dataScope: 'unit', isWriteAction: false, sensitivity: 'confidential' },
  get_employee_workload:         { allowedRoles: [...HR_ROLES, UNIT_LEADER, ADMIN_UNIT], dataScope: 'unit', isWriteAction: false, sensitivity: 'internal' },
  get_hr_headcount_stats:        { allowedRoles: HR_ROLES,                  dataScope: 'company', isWriteAction: false, sensitivity: 'confidential' },

  // ═══ HR Extended Tools ════════════════════════════════
  get_leave_summary:             { allowedRoles: [...HR_ROLES, UNIT_LEADER, ADMIN_UNIT], dataScope: 'unit', isWriteAction: false, sensitivity: 'internal' },
  get_attendance_report:         { allowedRoles: [...HR_ROLES, UNIT_LEADER, ADMIN_UNIT], dataScope: 'unit', isWriteAction: false, sensitivity: 'internal' },
  get_contract_labor_expiry:     { allowedRoles: [...HR_ROLES, UNIT_LEADER, ADMIN_UNIT], dataScope: 'unit', isWriteAction: false, sensitivity: 'internal' },
  get_employee_profile_360:      { allowedRoles: [...HR_ROLES, UNIT_LEADER], dataScope: 'unit', isWriteAction: false, sensitivity: 'confidential' },

  // ═══ HR Finance Tools ═════════════════════════════════
  get_recruitment_pipeline:      { allowedRoles: HR_ROLES,                  dataScope: 'company', isWriteAction: false, sensitivity: 'internal' },
  get_salary_insights:           { allowedRoles: [ADMIN, LEADERSHIP, CHIEF_ACCOUNTANT, UNIT_LEADER], dataScope: 'unit', isWriteAction: false, sensitivity: 'restricted' },
  get_payroll_summary:           { allowedRoles: [ADMIN, LEADERSHIP, CHIEF_ACCOUNTANT], dataScope: 'company', isWriteAction: false, sensitivity: 'restricted' },
  get_onboarding_status:         { allowedRoles: [...HR_ROLES, UNIT_LEADER, ADMIN_UNIT], dataScope: 'unit', isWriteAction: false, sensitivity: 'internal' },

  // ═══ Customer Tools ═══════════════════════════════════
  search_customers:              { allowedRoles: '*',                       dataScope: 'company', isWriteAction: false, sensitivity: 'internal' },
  get_customer_360:              { allowedRoles: [...FINANCE_ROLES, UNIT_LEADER, NVKD], dataScope: 'unit', isWriteAction: false, sensitivity: 'confidential' },

  // ═══ Product Tools ════════════════════════════════════
  search_products:               { allowedRoles: '*',                       dataScope: 'company', isWriteAction: false, sensitivity: 'public' },
  get_brands_report:             { allowedRoles: [...FINANCE_ROLES, UNIT_LEADER], dataScope: 'company', isWriteAction: false, sensitivity: 'internal' },

  // ═══ Dashboard Tools ══════════════════════════════════
  get_dashboard_kpi:             { allowedRoles: '*',                       dataScope: 'unit',    isWriteAction: false, sensitivity: 'internal' },
  get_comparative_report:        { allowedRoles: FINANCE_ROLES,             dataScope: 'company', isWriteAction: false, sensitivity: 'confidential' },
  get_unit_ranking:              { allowedRoles: FINANCE_ROLES,             dataScope: 'company', isWriteAction: false, sensitivity: 'confidential' },
  get_daily_briefing:            { allowedRoles: [...FINANCE_ROLES, UNIT_LEADER], dataScope: 'unit', isWriteAction: false, sensitivity: 'internal' },
  get_comprehensive_report:      { allowedRoles: FINANCE_ROLES,             dataScope: 'company', isWriteAction: false, sensitivity: 'restricted' },
  get_smart_insights:            { allowedRoles: FINANCE_ROLES,             dataScope: 'company', isWriteAction: false, sensitivity: 'confidential' },

  // ═══ System Tools (WRITE) ═════════════════════════════
  create_task_ai:                { allowedRoles: [ADMIN, LEADERSHIP, UNIT_LEADER, ADMIN_UNIT, NVKD, MARKETING], dataScope: 'personal', isWriteAction: true, sensitivity: 'internal' },
  approve_task:                  { allowedRoles: [ADMIN, LEADERSHIP, UNIT_LEADER], dataScope: 'personal', isWriteAction: true, sensitivity: 'confidential' },
  export_document:               { allowedRoles: [ADMIN, LEADERSHIP, ACCOUNTANT, CHIEF_ACCOUNTANT, UNIT_LEADER, MARKETING], dataScope: 'unit', isWriteAction: true, sensitivity: 'internal' },
  send_notification_email:       { allowedRoles: [ADMIN, LEADERSHIP, UNIT_LEADER], dataScope: 'company', isWriteAction: true, sensitivity: 'internal' },

  // ═══ Knowledge Tools ══════════════════════════════════
  search_knowledge_base:         { allowedRoles: '*',                       dataScope: 'company', isWriteAction: false, sensitivity: 'public' },
  search_document_registry:      { allowedRoles: '*',                       dataScope: 'company', isWriteAction: false, sensitivity: 'internal' },

  // ═══ Planning Tools (WRITE) ═══════════════════════════
  create_smart_plan:             { allowedRoles: PLANNING_ROLES,            dataScope: 'unit',    isWriteAction: true,  sensitivity: 'confidential' },
  analyze_bottleneck:            { allowedRoles: PLANNING_ROLES,            dataScope: 'unit',    isWriteAction: false, sensitivity: 'confidential' },
  forecast_next_quarter:         { allowedRoles: [...FINANCE_ROLES, UNIT_LEADER], dataScope: 'unit', isWriteAction: false, sensitivity: 'confidential' },

  // ═══ Master Tools ═════════════════════════════════════
  delegate_task_to_agent:        { allowedRoles: '*',                       dataScope: 'company', isWriteAction: false, sensitivity: 'internal' },

  // ═══ Marketing Tools (WRITE) ══════════════════════════
  draft_social_post:             { allowedRoles: [ADMIN, MARKETING],        dataScope: 'company', isWriteAction: true,  sensitivity: 'internal' },
  schedule_social_post:          { allowedRoles: [ADMIN, MARKETING],        dataScope: 'company', isWriteAction: true,  sensitivity: 'internal' },
  analyze_seo_content:           { allowedRoles: [ADMIN, MARKETING],        dataScope: 'company', isWriteAction: false, sensitivity: 'public' },
  generate_newsletter:           { allowedRoles: [ADMIN, MARKETING],        dataScope: 'company', isWriteAction: true,  sensitivity: 'internal' },
  schedule_email_campaign:       { allowedRoles: [ADMIN, MARKETING],        dataScope: 'company', isWriteAction: true,  sensitivity: 'internal' },
  read_web_url:                  { allowedRoles: [ADMIN, MARKETING],        dataScope: 'company', isWriteAction: false, sensitivity: 'public' },
  web_search:                    { allowedRoles: [ADMIN, MARKETING, LEADERSHIP], dataScope: 'company', isWriteAction: false, sensitivity: 'public' },
  save_lead:                     { allowedRoles: [ADMIN, MARKETING],        dataScope: 'company', isWriteAction: true,  sensitivity: 'internal' },
  get_leads:                     { allowedRoles: [ADMIN, MARKETING],        dataScope: 'company', isWriteAction: false, sensitivity: 'internal' },
};

/**
 * Check if a user role is allowed to use a specific tool
 */
export function isToolAllowedForRole(toolName: string, role: string): boolean {
  const acl = TOOL_ACL[toolName];
  
  // If tool not in ACL → restrictive default (only global roles)
  if (!acl) {
    return ['Admin', 'Leadership'].includes(role);
  }

  // '*' means all roles allowed
  if (acl.allowedRoles === '*') return true;

  return acl.allowedRoles.includes(role);
}

/**
 * Get all tools that a specific role is allowed to use
 */
export function getAllowedToolsForRole(role: string): string[] {
  return Object.entries(TOOL_ACL)
    .filter(([_, acl]) => acl.allowedRoles === '*' || acl.allowedRoles.includes(role))
    .map(([toolName]) => toolName);
}
