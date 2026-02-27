import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { PermissionService } from '../services';
import { PermissionAction, PermissionResource, UserRole, UserPermission } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { UnitVisibilityService } from '../services/unitVisibilityService';
import { GLOBAL_VIEW_ROLES } from '../lib/permissions';

// Query keys
const permissionKeys = {
    all: ['permissions'] as const,
    byUser: (userId: string) => ['permissions', 'user', userId] as const,
    crossUnit: (employeeId: string) => ['cross-unit-visibility', employeeId] as const,
};

/**
 * Get permissions for a specific user
 */
export function useUserPermissions(userId: string) {
    return useQuery({
        queryKey: permissionKeys.byUser(userId),
        queryFn: () => PermissionService.getByUserId(userId),
        enabled: !!userId,
        staleTime: 10 * 60 * 1000, // 10 minutes
    });
}

/**
 * Get all permissions (admin view)
 */
export function useAllPermissions() {
    return useQuery({
        queryKey: permissionKeys.all,
        queryFn: () => PermissionService.getAll(),
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Update permission mutation
 */
export function useUpdatePermission() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, resource, actions }: {
            userId: string;
            resource: PermissionResource;
            actions: PermissionAction[]
        }) => PermissionService.upsert(userId, resource, actions),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: permissionKeys.byUser(variables.userId) });
            queryClient.invalidateQueries({ queryKey: permissionKeys.all });
        },
    });
}

/**
 * Initialize permissions for new user
 */
export function useInitializePermissions() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
            PermissionService.initializeForUser(userId, role),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: permissionKeys.byUser(variables.userId) });
            queryClient.invalidateQueries({ queryKey: permissionKeys.all });
        },
    });
}

/**
 * Legacy: Check if current user has specific permission
 * @deprecated Use usePermissionCheck() instead
 */
export function useCheckPermission(resource: PermissionResource, action: PermissionAction) {
    const { can, isLoading } = usePermissionCheck();
    return {
        hasPermission: can(resource, action),
        isLoading,
    };
}

// ═══════════════════════════════════════════
// Main permission check hook (DB-backed)
// ═══════════════════════════════════════════

/**
 * Comprehensive permission check hook.
 * 
 * ── How it works ──
 * 1. Fetches user_permissions from DB for the effective user (real or impersonated)
 * 2. `can(resource, action)` checks the DB record → deny-by-default if no record
 * 3. Role is used ONLY for data scope (unit vs company-wide)
 * 4. Cross-unit visibility is fetched for unit-scoped roles
 * 
 * ── Special rules ──
 * - Contract editing: NVKD → own contracts only; AdminUnit/UnitLeader → unit
 * - Payment types: business roles → planned; accounting → actual
 * - Employees nav: only if has 'view' on 'employees'
 * - Units nav: only if has 'view' on 'units'
 */
export function usePermissionCheck() {
    const { profile: realProfile } = useAuth();
    const { impersonatedUser, isImpersonating } = useImpersonation();

    // Effective profile (impersonated or real)
    const profile = isImpersonating && impersonatedUser ? impersonatedUser : realProfile;
    const userId = profile?.id || '';
    const role = profile?.role;
    const unitId = profile?.unitId;
    const unitCode = profile?.unitCode;
    const employeeId = profile?.employeeId || profile?.id;

    // Fetch DB permissions for the effective user
    const { data: permissions, isLoading: permLoading } = useUserPermissions(userId);

    // Fetch cross-unit visibility for unit-scoped roles
    const isUnitScoped = role ? !GLOBAL_VIEW_ROLES.includes(role) : true;
    const { data: crossUnitIds } = useQuery({
        queryKey: permissionKeys.crossUnit(employeeId || ''),
        queryFn: () => UnitVisibilityService.getByEmployeeId(employeeId || ''),
        enabled: !!employeeId && isUnitScoped,
        staleTime: 10 * 60 * 1000,
    });

    // Build permission map for fast lookups
    const permissionMap = useMemo(() => {
        const map = new Map<string, Set<string>>();
        if (permissions) {
            for (const p of permissions) {
                map.set(p.resource, new Set(p.actions));
            }
        }
        return map;
    }, [permissions]);

    /**
     * Check if user has a specific action on a resource.
     * Deny-by-default: if no DB record exists → false.
     */
    const can = (resource: PermissionResource, action: PermissionAction): boolean => {
        const actions = permissionMap.get(resource);
        if (!actions) return false; // deny by default
        return actions.has(action);
    };

    /**
     * Check contract-specific edit permission.
     * - NVKD: only contracts where salespersonId === own employeeId
     * - AdminUnit/UnitLeader: all contracts in their unit
     * - Accountant/ChiefAccountant: update = financial fields only (UI handles field restriction)
     * - Leadership/Admin: all contracts
     */
    const canOnContract = (
        action: PermissionAction,
        contract?: { unitId?: string; salespersonId?: string }
    ): boolean => {
        // First check DB permission
        if (!can('contracts', action)) return false;

        // For view/create/delete, DB permission is sufficient
        if (action !== 'update' || !contract) return true;

        // For update, apply scoping rules
        if (role === 'Admin' || role === 'Leadership') return true;
        if (role === 'Accountant' || role === 'ChiefAccountant') return true; // financial fields, enforced in UI
        if (role === 'Legal') return false; // Legal has view only

        // Unit-scoped roles: must be in same unit
        if (contract.unitId && unitId && contract.unitId !== unitId) return false;

        // AdminUnit/UnitLeader: can edit all in their unit
        if (role === 'AdminUnit' || role === 'UnitLeader') return true;

        // NVKD: only own contracts
        if (role === 'NVKD') {
            return !!contract.salespersonId && !!employeeId && contract.salespersonId === employeeId;
        }

        return false;
    };

    /**
     * Check payment-specific permission.
     * - Business roles (NVKD/AdminUnit/UnitLeader): can only create PLANNED entries
     * - Accounting roles: can create/edit ACTUAL entries
     */
    const canOnPayment = (action: PermissionAction, isPlanned: boolean = true): boolean => {
        if (!can('payments', action)) return false;

        // View is always allowed if DB says so
        if (action === 'view') return true;

        // Create/update distinction
        if (action === 'create' || action === 'update') {
            const isBusinessRole = role === 'NVKD' || role === 'AdminUnit' || role === 'UnitLeader';
            const isAccountingRole = role === 'Accountant' || role === 'ChiefAccountant';

            if (isBusinessRole && !isPlanned) return false;    // Business can't create actual
            if (isAccountingRole && isPlanned) return false;   // Accounting can't create planned
            return true; // Admin can do both
        }

        return true;
    };

    /**
     * Get all unit IDs the user can see data for.
     * - Global roles: null (all units)
     * - Unit-scoped: own unit + cross_unit_visibility entries
     */
    const getVisibleUnitIds = (): string[] | null => {
        if (!role) return [];
        if (GLOBAL_VIEW_ROLES.includes(role)) return null; // null = all units
        const ids: string[] = [];
        if (unitId) ids.push(unitId);
        if (crossUnitIds) ids.push(...crossUnitIds);
        return ids;
    };

    return {
        /** Check permission: resource + action (DB-backed, deny-by-default) */
        can,
        /** Check contract-specific permission with scoping */
        canOnContract,
        /** Check payment-specific permission (planned vs actual) */
        canOnPayment,
        /** Get visible unit IDs (null = all units for global roles) */
        getVisibleUnitIds,
        /** Is this a global-scope role (sees all units)? */
        isGlobalScope: role ? GLOBAL_VIEW_ROLES.includes(role) : false,
        /** Effective role (for data scope decisions only) */
        role,
        /** Effective unit ID */
        unitId,
        /** Effective unit code */
        unitCode,
        /** Effective employee ID */
        employeeId,
        /** User's DB permissions (raw) */
        permissions: permissions || [],
        /** Loading state */
        isLoading: permLoading,
    };
}
