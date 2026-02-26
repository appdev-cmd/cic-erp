import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UnitVisibilityService } from '../services/unitVisibilityService';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

// Roles that always see all units
const GLOBAL_VIEW_ROLES: UserRole[] = ['Admin', 'Leadership', 'Legal', 'Accountant', 'ChiefAccountant'];

const visibilityKeys = {
    all: ['unitVisibility'] as const,
    byEmployee: (id: string) => ['unitVisibility', 'employee', id] as const,
};

/**
 * Get allowed unit IDs for a specific employee
 */
export function useEmployeeVisibility(employeeId: string) {
    return useQuery({
        queryKey: visibilityKeys.byEmployee(employeeId),
        queryFn: () => UnitVisibilityService.getByEmployeeId(employeeId),
        enabled: !!employeeId,
        staleTime: 10 * 60 * 1000,
    });
}

/**
 * Get all visibility records (admin view)
 */
export function useAllVisibility() {
    return useQuery({
        queryKey: visibilityKeys.all,
        queryFn: () => UnitVisibilityService.getAll(),
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Returns the list of unit IDs the current user is allowed to view.
 * - Global roles → returns 'all'
 * - Other roles → returns [own unit] + granted units
 */
export function useCurrentUserVisibleUnits(): {
    visibleUnits: string[] | 'all';
    isLoading: boolean;
} {
    const { profile } = useAuth();
    const employeeId = profile?.employeeId || profile?.id || '';
    const role = profile?.role;
    const ownUnitId = profile?.unitId;

    // Global roles always see everything
    const isGlobalRole = role && GLOBAL_VIEW_ROLES.includes(role);

    const { data: grantedUnits, isLoading } = useQuery({
        queryKey: visibilityKeys.byEmployee(employeeId),
        queryFn: () => UnitVisibilityService.getByEmployeeId(employeeId),
        enabled: !!employeeId && !isGlobalRole,
        staleTime: 10 * 60 * 1000,
    });

    if (isGlobalRole) {
        return { visibleUnits: 'all', isLoading: false };
    }

    // Build list: own unit + granted units
    const unitSet = new Set<string>();
    if (ownUnitId) unitSet.add(ownUnitId);
    if (grantedUnits) {
        grantedUnits.forEach(id => unitSet.add(id));
    }

    return {
        visibleUnits: Array.from(unitSet),
        isLoading,
    };
}

/**
 * Toggle unit visibility mutation
 */
export function useToggleVisibility() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ employeeId, unitId, enabled, grantedBy }: {
            employeeId: string;
            unitId: string;
            enabled: boolean;
            grantedBy?: string;
        }) => UnitVisibilityService.toggle(employeeId, unitId, enabled, grantedBy),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: visibilityKeys.byEmployee(variables.employeeId) });
            queryClient.invalidateQueries({ queryKey: visibilityKeys.all });
        },
    });
}

/**
 * Set all allowed units for an employee (batch)
 */
export function useSetVisibility() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ employeeId, allowedUnitIds, grantedBy }: {
            employeeId: string;
            allowedUnitIds: string[];
            grantedBy?: string;
        }) => UnitVisibilityService.setForEmployee(employeeId, allowedUnitIds, grantedBy),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: visibilityKeys.byEmployee(variables.employeeId) });
            queryClient.invalidateQueries({ queryKey: visibilityKeys.all });
        },
    });
}
