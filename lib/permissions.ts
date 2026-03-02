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
    'Admin', 'Leadership', 'Legal', 'Accountant', 'ChiefAccountant'
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
 * Only Admin and Leadership
 */
export function canViewUnits(role: UserRole): boolean {
    return role === 'Admin' || role === 'Leadership';
}

/**
 * Items that should be hidden from sidebar based on role.
 * Returns Set of nav item IDs to HIDE.
 */
export function getHiddenNavItems(role: UserRole, userUnitCode?: string): Set<string> {
    const hidden = new Set<string>();

    // Settings: only Admin
    if (role !== 'Admin') {
        hidden.add('settings');
    }

    // Units: only Admin & Leadership
    if (!canViewUnits(role)) {
        hidden.add('units');
    }

    // Personnel: only Admin, Leadership, ChiefAccountant, AdminUnit of HCNS
    if (!canViewEmployees(role, userUnitCode)) {
        hidden.add('personnel');
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

/** Business roles that can enter PLANNED payment data */
export const PAYMENT_PLANNED_ROLES: UserRole[] = ['NVKD', 'AdminUnit', 'UnitLeader', 'Admin'];

/** Accounting roles that can enter ACTUAL payment data */
export const PAYMENT_ACTUAL_ROLES: UserRole[] = ['Accountant', 'ChiefAccountant', 'Admin'];
