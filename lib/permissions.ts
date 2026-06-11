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
import { UserRole, PermissionResource, DEFAULT_ROLE_PERMISSIONS } from '../types';

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

/** HR unit codes — Phòng Tổng hợp / Hành chính Nhân sự */
const HR_UNIT_CODES = ['HCNS', 'TH'];

/**
 * Can VIEW the Personnel section at all?
 * Only: Admin, Leadership, ChiefAccountant, AdminUnit/UnitLeader of Phòng Tổng Hợp (HCNS/TH)
 * 
 * Note: This is a hardcoded nav-visibility check because employees access
 * depends on unit code, which isn't in user_permissions.
 */
export function canViewEmployees(role: UserRole, userUnitCode?: string): boolean {
    if (role === 'Admin' || role === 'Leadership' || role === 'ChiefAccountant') return true;
    if ((role === 'AdminUnit' || role === 'UnitLeader') && userUnitCode && HR_UNIT_CODES.includes(userUnitCode.toUpperCase())) return true;
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
 * Sidebar nav items mapped to the SAME permission resources that RouteGuard
 * checks (see routes/routePermissions.ts). Keeping the two in sync guarantees:
 * menu hiện ⇔ vào được bằng link.
 */
const NAV_RESOURCE_MAP: { navId: string; resource: PermissionResource }[] = [
    { navId: 'crm', resource: 'crm' },
    { navId: 'contracts', resource: 'contracts' },
    { navId: 'payments', resource: 'payments' },
    { navId: 'customers', resource: 'customers' },
    { navId: 'products', resource: 'products' },
    { navId: 'website', resource: 'news' },
    { navId: 'tasks', resource: 'tasks' },
    { navId: 'reports', resource: 'reports' },
    { navId: 'units', resource: 'units' },
    { navId: 'analytics', resource: 'analytics' },
    { navId: 'tools', resource: 'tools' },
];

/**
 * Items that should be hidden from sidebar based on role + DB permissions.
 * Returns Set of nav item IDs to HIDE.
 *
 * Deny-by-default, mirror của RouteGuard:
 * - DB đã load → chỉ hiện khi có user_permissions.<resource>.view
 * - DB chưa load (dbPermissions === undefined) → fallback DEFAULT_ROLE_PERMISSIONS
 *
 * @param dbPermissions - Permission map from user_permissions DB table.
 *   undefined = DB chưa load. Map rỗng = user không có quyền nào.
 */
export function getHiddenNavItems(
    role: UserRole,
    userUnitCode?: string,
    dbPermissions?: Map<string, Set<string>>
): Set<string> {
    const hidden = new Set<string>();

    // Admin: full access (mirrors the Admin bypass in usePermissionCheck.can)
    if (role === 'Admin') return hidden;

    // Settings & AI Dashboard: only Admin
    hidden.add('settings');
    hidden.add('ai-dashboard');

    const dbLoaded = dbPermissions !== undefined;
    const dbView = (resource: PermissionResource) =>
        dbPermissions?.get(resource)?.has('view') ?? false;
    const roleDefaultView = (resource: PermissionResource) =>
        DEFAULT_ROLE_PERMISSIONS[role]?.[resource]?.includes('view') ?? false;

    for (const { navId, resource } of NAV_RESOURCE_MAP) {
        const visible = dbLoaded ? dbView(resource) : roleDefaultView(resource);
        if (!visible) hidden.add(navId);
    }

    // Personnel: can() có special-case role-based (canViewEmployees), nên OR thêm
    const employeesVisible = dbLoaded ? dbView('employees') : roleDefaultView('employees');
    if (!employeesVisible && !canViewEmployees(role, userUnitCode)) hidden.add('personnel');

    // BIM Projects: fallback role/đơn vị BIM khi DB chưa load
    const projectsVisible = dbLoaded ? dbView('projects') : canViewProjects(role, userUnitCode);
    if (!projectsVisible) hidden.add('projects');

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
