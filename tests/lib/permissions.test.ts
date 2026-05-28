import { describe, it, expect, vi } from 'vitest';
import {
    canViewAllUnits,
    canViewEmployees,
    canViewUnits,
    canViewProjects,
    getHiddenNavItems,
    canUpdateContractFinancials,
    GLOBAL_VIEW_ROLES,
    UNIT_SCOPED_ROLES,
    PAYMENT_PLANNED_ROLES,
    PAYMENT_ACTUAL_ROLES
} from '../../lib/permissions';
import { UserRole } from '../../types';

describe('Permission Helpers', () => {
    describe('Role Groups', () => {
        it('has expected GLOBAL_VIEW_ROLES', () => {
            expect(GLOBAL_VIEW_ROLES).toContain('Admin');
            expect(GLOBAL_VIEW_ROLES).toContain('Leadership');
            expect(GLOBAL_VIEW_ROLES).toContain('ChiefAccountant');
        });

        it('has expected UNIT_SCOPED_ROLES', () => {
            expect(UNIT_SCOPED_ROLES).toContain('NVKD');
            expect(UNIT_SCOPED_ROLES).toContain('UnitLeader');
        });
    });

    describe('canViewAllUnits', () => {
        it('should return true for roles in GLOBAL_VIEW_ROLES', () => {
            expect(canViewAllUnits('Leadership')).toBe(true);
            expect(canViewAllUnits('Admin')).toBe(true);
            expect(canViewAllUnits('Accountant')).toBe(true);
        });

        it('should return false for roles not in GLOBAL_VIEW_ROLES', () => {
            expect(canViewAllUnits('NVKD')).toBe(false);
            expect(canViewAllUnits('UnitLeader')).toBe(false);
        });
    });

    describe('canViewEmployees', () => {
        it('should allow Admin, Leadership, ChiefAccountant', () => {
            expect(canViewEmployees('Admin')).toBe(true);
            expect(canViewEmployees('Leadership')).toBe(true);
            expect(canViewEmployees('ChiefAccountant')).toBe(true);
        });

        it('should allow AdminUnit if unit code is HCNS', () => {
            expect(canViewEmployees('AdminUnit', 'HCNS')).toBe(true);
        });

        it('should deny AdminUnit if unit code is not HCNS', () => {
            expect(canViewEmployees('AdminUnit', 'IT')).toBe(false);
        });

        it('should allow UnitLeader if unit code is HCNS', () => {
            expect(canViewEmployees('UnitLeader', 'HCNS')).toBe(true);
        });

        it('should deny UnitLeader if unit code is not HCNS', () => {
            expect(canViewEmployees('UnitLeader', 'IT')).toBe(false);
        });

        it('should deny NVKD', () => {
            expect(canViewEmployees('NVKD')).toBe(false);
        });
    });

    describe('canViewUnits', () => {
        it('should allow Admin, Leadership, UnitLeader, AdminUnit', () => {
            expect(canViewUnits('Admin')).toBe(true);
            expect(canViewUnits('Leadership')).toBe(true);
            expect(canViewUnits('UnitLeader')).toBe(true);
            expect(canViewUnits('AdminUnit')).toBe(true);
        });

        it('should deny NVKD, Accountant', () => {
            expect(canViewUnits('NVKD')).toBe(false);
            expect(canViewUnits('Accountant')).toBe(false);
        });
    });

    describe('canViewProjects', () => {
        it('should allow Admin and Leadership', () => {
            expect(canViewProjects('Admin')).toBe(true);
            expect(canViewProjects('Leadership')).toBe(true);
        });

        it('should allow BIM unit members regardless of role', () => {
            expect(canViewProjects('NVKD', 'BIM')).toBe(true);
            expect(canViewProjects('NVKT', 'BIM')).toBe(true);
        });

        it('should deny non-BIM, non-leadership roles', () => {
            expect(canViewProjects('NVKD')).toBe(false);
            expect(canViewProjects('Accountant', 'HCNS')).toBe(false);
        });
    });

    describe('getHiddenNavItems', () => {
        it('should hide settings for non-Admin', () => {
            const hidden = getHiddenNavItems('NVKD');
            expect(hidden.has('settings')).toBe(true);
        });

        it('should not hide settings for Admin', () => {
            const hidden = getHiddenNavItems('Admin');
            expect(hidden.has('settings')).toBe(false);
        });

        it('should use DB permissions if provided', () => {
            const dbPerms = new Map([
                ['units', new Set(['view'])],
                ['employees', new Set()] // Empty set -> no 'view'
            ]);
            
            // Even if NVKD normally can't view units, DB says yes
            const hidden = getHiddenNavItems('NVKD', undefined, dbPerms);
            expect(hidden.has('units')).toBe(false);

            // Employees view is false in DB
            expect(hidden.has('personnel')).toBe(true);
        });

        it('should fallback to role-based if DB permission is undefined', () => {
            const dbPerms = new Map([
                ['something_else', new Set(['view'])]
            ]);

            // NVKD cannot view units by default role rules
            const hidden = getHiddenNavItems('NVKD', undefined, dbPerms);
            expect(hidden.has('units')).toBe(true);
        });
    });

    describe('canUpdateContractFinancials', () => {
        it('should allow Accountant, ChiefAccountant, Leadership, Admin', () => {
            expect(canUpdateContractFinancials('Accountant')).toBe(true);
            expect(canUpdateContractFinancials('ChiefAccountant')).toBe(true);
            expect(canUpdateContractFinancials('Leadership')).toBe(true);
            expect(canUpdateContractFinancials('Admin')).toBe(true);
        });

        it('should not allow NVKD', () => {
            expect(canUpdateContractFinancials('NVKD')).toBe(false);
        });
    });
});
