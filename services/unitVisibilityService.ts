import { dataClient } from '../lib/dataClient';

export interface CrossUnitVisibility {
    id: string;
    employeeId: string;
    allowedUnitId: string;
    grantedBy?: string;
    createdAt?: string;
}

const mapRow = (row: any): CrossUnitVisibility => ({
    id: row.id,
    employeeId: row.employee_id,
    allowedUnitId: row.allowed_unit_id,
    grantedBy: row.granted_by,
    createdAt: row.created_at,
});

export const UnitVisibilityService = {
    /**
     * Get all allowed unit IDs for an employee
     */
    async getByEmployeeId(employeeId: string): Promise<string[]> {
        const { data, error } = await dataClient
            .from('cross_unit_visibility')
            .select('allowed_unit_id')
            .eq('employee_id', employeeId);

        if (error) {
            console.error('[UnitVisibilityService] getByEmployeeId error:', error);
            return [];
        }
        return (data || []).map((r: any) => r.allowed_unit_id);
    },

    /**
     * Get all records (for admin view)
     */
    async getAll(): Promise<CrossUnitVisibility[]> {
        const { data, error } = await dataClient
            .from('cross_unit_visibility')
            .select('*');

        if (error) {
            console.error('[UnitVisibilityService] getAll error:', error);
            return [];
        }
        return (data || []).map(mapRow);
    },

    /**
     * Set allowed units for an employee (replaces existing)
     * @param employeeId - Employee ID
     * @param allowedUnitIds - Array of unit IDs the employee can view
     * @param grantedBy - Who is granting this permission
     */
    async setForEmployee(
        employeeId: string,
        allowedUnitIds: string[],
        grantedBy?: string
    ): Promise<void> {
        // 1. Delete existing entries for this employee
        const { error: deleteError } = await dataClient
            .from('cross_unit_visibility')
            .delete()
            .eq('employee_id', employeeId);

        if (deleteError) {
            console.error('[UnitVisibilityService] delete error:', deleteError);
            throw deleteError;
        }

        // 2. Insert new entries
        if (allowedUnitIds.length === 0) return;

        const rows = allowedUnitIds.map(unitId => ({
            employee_id: employeeId,
            allowed_unit_id: unitId,
            granted_by: grantedBy || null,
        }));

        const { error: insertError } = await dataClient
            .from('cross_unit_visibility')
            .insert(rows);

        if (insertError) {
            console.error('[UnitVisibilityService] insert error:', insertError);
            throw insertError;
        }
    },

    /**
     * Toggle a single unit visibility for an employee
     */
    async toggle(
        employeeId: string,
        unitId: string,
        enabled: boolean,
        grantedBy?: string
    ): Promise<void> {
        if (enabled) {
            const { error } = await dataClient
                .from('cross_unit_visibility')
                .upsert({
                    employee_id: employeeId,
                    allowed_unit_id: unitId,
                    granted_by: grantedBy || null,
                }, { onConflict: 'employee_id,allowed_unit_id' });

            if (error) throw error;
        } else {
            const { error } = await dataClient
                .from('cross_unit_visibility')
                .delete()
                .eq('employee_id', employeeId)
                .eq('allowed_unit_id', unitId);

            if (error) throw error;
        }
    },

    /**
     * Delete all visibility entries for an employee
     */
    async deleteByEmployeeId(employeeId: string): Promise<void> {
        const { error } = await dataClient
            .from('cross_unit_visibility')
            .delete()
            .eq('employee_id', employeeId);

        if (error) throw error;
    },
};
