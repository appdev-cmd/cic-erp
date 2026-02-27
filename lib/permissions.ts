/**
 * Centralized Permission Helpers — CIC ERP
 * 
 * Based on PhanQuyenHeThong.md specification.
 * All permission checking logic should go through these helpers
 * to avoid inline duplication across components.
 */
import { UserRole } from '../types';

// ═══════════════════════════════════════════
// Role groups
// ═══════════════════════════════════════════

/** Roles that can see data across ALL units (toàn công ty) */
export const GLOBAL_VIEW_ROLES: UserRole[] = [
    'Admin', 'Leadership', 'Legal', 'Accountant', 'ChiefAccountant'
];

/** Roles scoped to their own unit only */
export const UNIT_SCOPED_ROLES: UserRole[] = [
    'NVKD', 'AdminUnit', 'UnitLeader'
];

// ═══════════════════════════════════════════
// Data scope helpers
// ═══════════════════════════════════════════

/** Can this role view data across all units? */
export function canViewAllUnits(role: UserRole): boolean {
    return GLOBAL_VIEW_ROLES.includes(role);
}

// ═══════════════════════════════════════════
// Contract permissions
// ═══════════════════════════════════════════

/** Roles allowed to CREATE contracts (spec §6.2) */
const CONTRACT_CREATE_ROLES: UserRole[] = [
    'NVKD', 'AdminUnit', 'UnitLeader', 'Leadership', 'Admin'
];

export function canCreateContract(role: UserRole): boolean {
    return CONTRACT_CREATE_ROLES.includes(role);
}

/**
 * Can user EDIT a specific contract? (spec §6.2)
 * 
 * - NVKD: only contracts they created/assigned to (salespersonId === employeeId)
 * - AdminUnit/UnitLeader: all contracts in their unit
 * - Accountant/ChiefAccountant: only financial fields (handled in UI)
 * - Leadership/Admin: all contracts
 */
export function canEditContract(
    role: UserRole,
    contractUnitId?: string,
    contractSalespersonId?: string,
    userUnitId?: string,
    userEmployeeId?: string,
): boolean {
    if (role === 'Admin' || role === 'Leadership') return true;

    // Accountant/ChiefAccountant can update financial fields only
    if (role === 'Accountant' || role === 'ChiefAccountant') return true;

    // Legal: cannot edit
    if (role === 'Legal') return false;

    // Unit-scoped roles: must be in same unit
    if (contractUnitId && userUnitId && contractUnitId !== userUnitId) return false;

    // AdminUnit/UnitLeader: can edit all contracts in their unit
    if (role === 'AdminUnit' || role === 'UnitLeader') return true;

    // NVKD: only contracts they created/assigned to
    if (role === 'NVKD') {
        return !!contractSalespersonId && !!userEmployeeId && contractSalespersonId === userEmployeeId;
    }

    return false;
}

/** Can DELETE contracts? Only Leadership and Admin (spec §6.2) */
export function canDeleteContract(role: UserRole): boolean {
    return role === 'Admin' || role === 'Leadership';
}

/**
 * Can this role update FINANCIAL fields on a contract? (spec §6.2)
 * Only Accountant, ChiefAccountant, Leadership, Admin
 */
export function canUpdateContractFinancials(role: UserRole): boolean {
    return ['Accountant', 'ChiefAccountant', 'Leadership', 'Admin'].includes(role);
}

// ═══════════════════════════════════════════
// Payment permissions (spec §6.4)
// ═══════════════════════════════════════════

/**
 * Planned/estimated data (dự kiến): NVKD, AdminUnit, UnitLeader, Admin
 * Actual financial data (thực tế): Accountant, ChiefAccountant, Admin
 */

const PAYMENT_PLANNED_ROLES: UserRole[] = ['NVKD', 'AdminUnit', 'UnitLeader', 'Admin'];
const PAYMENT_ACTUAL_ROLES: UserRole[] = ['Accountant', 'ChiefAccountant', 'Admin'];

/** Can create PLANNED payment entries (dự kiến) */
export function canCreatePaymentPlanned(role: UserRole): boolean {
    return PAYMENT_PLANNED_ROLES.includes(role);
}

/** Can create ACTUAL payment entries (thực tế — ghi nhận thu/chi) */
export function canCreatePaymentActual(role: UserRole): boolean {
    return PAYMENT_ACTUAL_ROLES.includes(role);
}

/** Can edit actual payment records */
export function canEditPaymentActual(role: UserRole): boolean {
    return PAYMENT_ACTUAL_ROLES.includes(role);
}

/** Can delete payment records — only ChiefAccountant and Admin (spec §6.4) */
export function canDeletePayment(role: UserRole): boolean {
    return role === 'Admin' || role === 'Leadership' || role === 'ChiefAccountant';
}

// ═══════════════════════════════════════════
// Customer permissions (spec §6.3)
// ═══════════════════════════════════════════

const CUSTOMER_CREATE_ROLES: UserRole[] = ['NVKD', 'AdminUnit', 'UnitLeader', 'Admin', 'Leadership'];

export function canCreateCustomer(role: UserRole): boolean {
    return CUSTOMER_CREATE_ROLES.includes(role);
}

export function canEditCustomer(role: UserRole): boolean {
    return CUSTOMER_CREATE_ROLES.includes(role);
}

/** Only Admin can delete customers (spec §6.3) */
export function canDeleteCustomer(role: UserRole): boolean {
    return role === 'Admin' || role === 'Leadership';
}

// ═══════════════════════════════════════════
// Employee / Unit permissions (spec §6.5)
// ═══════════════════════════════════════════

/** HR unit code — Phòng Tổng Hợp */
const HR_UNIT_CODE = 'HCNS';

/**
 * Can VIEW the Personnel section at all?
 * Only: Admin, Leadership, ChiefAccountant, AdminUnit of Phòng Tổng Hợp (HCNS)
 */
export function canViewEmployees(role: UserRole, userUnitCode?: string): boolean {
    if (role === 'Admin' || role === 'Leadership' || role === 'ChiefAccountant') return true;
    if (role === 'AdminUnit' && userUnitCode === HR_UNIT_CODE) return true;
    return false;
}

/** Can CREATE employees — Admin, Leadership, AdminUnit of HCNS (NOT ChiefAccountant) */
export function canCreateEmployee(role: UserRole, userUnitCode?: string): boolean {
    if (role === 'Admin' || role === 'Leadership') return true;
    if (role === 'AdminUnit' && userUnitCode === HR_UNIT_CODE) return true;
    return false;
}

/**
 * Can EDIT employee?
 * - Admin/Leadership: all employees
 * - AdminUnit of HCNS: all employees
 */
export function canEditEmployee(
    role: UserRole,
    employeeUnitId?: string,
    userUnitId?: string,
    userUnitCode?: string
): boolean {
    if (role === 'Admin' || role === 'Leadership') return true;
    if (role === 'AdminUnit' && userUnitCode === HR_UNIT_CODE) return true;
    return false;
}

/** Can DELETE employees — Admin, Leadership, AdminUnit of HCNS (NOT ChiefAccountant) */
export function canDeleteEmployee(role: UserRole, userUnitCode?: string): boolean {
    if (role === 'Admin' || role === 'Leadership') return true;
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

// ═══════════════════════════════════════════
// Product permissions
// ═══════════════════════════════════════════

/** Can DELETE products — only Admin and Leadership */
export function canDeleteProduct(role: UserRole): boolean {
    return role === 'Admin' || role === 'Leadership';
}

// ═══════════════════════════════════════════
// Settings & Permissions (spec §6.6)
// ═══════════════════════════════════════════

/** Only Admin can access settings management */
export function canAccessSettings(role: UserRole): boolean {
    return role === 'Admin';
}

/** Only Admin can manage permissions */
export function canManagePermissions(role: UserRole): boolean {
    return role === 'Admin';
}

// ═══════════════════════════════════════════
// Navigation visibility
// ═══════════════════════════════════════════

/**
 * Items that should be hidden from sidebar based on role.
 * Returns Set of nav item IDs to HIDE.
 * Note: 'personnel' requires unitCode check, handled separately via canViewEmployees.
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

    // Personnel: only Admin, Leadership, AdminUnit of HCNS
    if (!canViewEmployees(role, userUnitCode)) {
        hidden.add('personnel');
    }

    return hidden;
}
