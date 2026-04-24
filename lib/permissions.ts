/**
 * Centralized Permission Helpers — CIC ERP
 * 
 * Based on PHANQUYENHETHONG.md v1.0 specification.
 * 
 * ── Architecture ──
 * - Actual permissions (view/create/update/delete) are stored in DB (user_permissions)
 *   and checked via usePermissionCheck().can(resource, action).
 * - This file provides SCOPE helpers (which units can a role see?)
 *   and NAV helpers (which sidebar items to hide?).
 * - Role determines DATA SCOPE, not permissions. Permissions come from DB.
 */
import { UserRole } from '../types';

// ═══════════════════════════════════════════
// Role groups — data scope
// ═══════════════════════════════════════════

/** Roles that can see data across ALL units (toàn công ty) */
export const GLOBAL_VIEW_ROLES: UserRole[] = [
    'Admin', 'Leadership', 'Legal', 'Accountant', 'ChiefAccountant',
    'Marketing', // Marketing xem news/projects toàn công ty để quảng bá
];

/** Roles scoped to their own unit only */
export const UNIT_SCOPED_ROLES: UserRole[] = [
    'NVKD', 'NVKT', 'AdminUnit', 'UnitLeader'
];

// ═══════════════════════════════════════════
// Data scope helpers
// ═══════════════════════════════════════════

/** Can this role view data across all units? */
export function canViewAllUnits(role: UserRole): boolean {
    return GLOBAL_VIEW_ROLES.includes(role);
}

// ═══════════════════════════════════════════
// Navigation visibility
// ═══════════════════════════════════════════

/** HR unit code — Phòng Tổng Hợp */
const HR_UNIT_CODE = 'HCNS';

/**
 * Can VIEW the Personnel section at all?
 * Only: Admin, Leadership, ChiefAccountant, AdminUnit of Phòng Tổng Hợp (HCNS)
 * 
 * Note: This is a hardcoded nav-visibility check because employees access
 * depends on unit code, which isn't in user_permissions.
 */
export function canViewEmployees(role: UserRole, userUnitCode?: string): boolean {
    if (role === 'Admin' || role === 'Leadership' || role === 'ChiefAccountant') return true;
    if (role === 'AdminUnit' && userUnitCode === HR_UNIT_CODE) return true;
    return false;
}

/**
 * Can VIEW the Units section?
 * Admin, Leadership: see all units
 * UnitLeader, AdminUnit: see their own unit (needed for KPI target allocation)
 */
export function canViewUnits(role: UserRole): boolean {
    return role === 'Admin' || role === 'Leadership' || role === 'UnitLeader' || role === 'AdminUnit';
}

/** BIM unit code */
const BIM_UNIT_CODE = 'BIM';

/**
 * Can VIEW the BIM Projects section?
 * Per PHANQUYENHETHONG.md: Admin, Leadership, users in BIM center, and Marketing.
 * Marketing xem projects để khai thác nội dung truyền thông.
 */
export function canViewProjects(role: UserRole, userUnitCode?: string): boolean {
    if (role === 'Admin' || role === 'Leadership' || role === 'Marketing') return true;
    if (userUnitCode === BIM_UNIT_CODE) return true;
    return false;
}

/**
 * Items that should be hidden from sidebar based on role + DB permissions.
 * Returns Set of nav item IDs to HIDE.
 * 
 * @param dbPermissions - Optional permission map from user_permissions DB table.
 *   If provided, DB permissions override role-based defaults for employees/units.
 */
export function getHiddenNavItems(
    role: UserRole,
    userUnitCode?: string,
    dbPermissions?: Map<string, Set<string>>
): Set<string> {
    const hidden = new Set<string>();

    // Settings: only Admin
    if (role !== 'Admin') {
        hidden.add('settings');
    }

    // Units: check DB permission first, fallback to role-based
    const hasUnitsViewInDB = dbPermissions?.get('units')?.has('view');
    if (hasUnitsViewInDB === undefined) {
        // DB not loaded yet → fallback to role-based
        if (!canViewUnits(role)) hidden.add('units');
    } else if (!hasUnitsViewInDB) {
        hidden.add('units');
    }

    // Personnel: check DB permission first, fallback to role-based
    const hasEmployeesViewInDB = dbPermissions?.get('employees')?.has('view');
    if (hasEmployeesViewInDB === undefined) {
        // DB not loaded yet → fallback to role-based
        if (!canViewEmployees(role, userUnitCode)) hidden.add('personnel');
    } else if (!hasEmployeesViewInDB) {
        hidden.add('personnel');
    }

    // Tools: Admin by default, or DB-granted permission.
    // To grant a specific user access to Tools, add user_permissions.tools.view = true in DB.
    const hasToolsViewInDB = dbPermissions?.get('tools')?.has('view');
    if (hasToolsViewInDB === undefined) {
        if (role !== 'Admin') hidden.add('tools');
    } else if (!hasToolsViewInDB) {
        hidden.add('tools');
    }

    // BIM Projects: only Devs or localhost
    const hasProjectsViewInDB = dbPermissions?.get('projects')?.has('view');
    if (hasProjectsViewInDB === undefined) {
        if (!canViewProjects(role, userUnitCode)) hidden.add('projects');
    } else if (!hasProjectsViewInDB) {
        hidden.add('projects');
    }

    // Tasks: check DB permission first, default to visible for all roles
    const hasTasksViewInDB = dbPermissions?.get('tasks')?.has('view');
    if (hasTasksViewInDB === undefined) {
        // DB not loaded yet → default: show tasks for everyone
    } else if (!hasTasksViewInDB) {
        hidden.add('tasks');
    }

    // Reports: only Admin
    const hasReportsViewInDB = dbPermissions?.get('reports')?.has('view');
    if (hasReportsViewInDB === undefined) {
        if (role !== 'Admin') hidden.add('reports');
    } else if (!hasReportsViewInDB) {
        hidden.add('reports');
    }

    return hidden;
}

// ═══════════════════════════════════════════
// Contract financial fields — role-based
// ═══════════════════════════════════════════

/**
 * Can this role update FINANCIAL fields on a contract? (spec §6.2)
 * Only Accountant, ChiefAccountant, Leadership, Admin
 * 
 * Note: This supplements the DB permission check. A user needs both
 * user_permissions.contracts.update AND this check to edit financial fields.
 */
export function canUpdateContractFinancials(role: UserRole): boolean {
    return ['Accountant', 'ChiefAccountant', 'Leadership', 'Admin'].includes(role);
}

// ═══════════════════════════════════════════
// Payment type helpers — role-based
// ═══════════════════════════════════════════

/** Roles that can VIEW payment data (xem phiếu thu/chi) */
export const PAYMENT_VIEW_ROLES: UserRole[] = [
    'NVKD', 'NVKT', 'AdminUnit', 'UnitLeader',
    'Accountant', 'ChiefAccountant', 'Admin', 'Leadership',
];

/** Business roles that can enter PLANNED payment data */
export const PAYMENT_PLANNED_ROLES: UserRole[] = ['NVKD', 'AdminUnit', 'UnitLeader', 'Admin'];

/** Accounting roles that can enter ACTUAL payment data */
export const PAYMENT_ACTUAL_ROLES: UserRole[] = ['Accountant', 'ChiefAccountant', 'Admin'];
