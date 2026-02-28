import { supabase } from '../lib/supabase';
import { KPIPlan } from '../types';

export interface EmployeeTarget {
    id: string;
    employeeId: string;
    unitId: string;
    year: number;
    signing: number;
    revenue: number;
    adminProfit: number;
    revProfit: number;
    cash: number;
}

const mapTarget = (row: any): EmployeeTarget => ({
    id: row.id,
    employeeId: row.employee_id,
    unitId: row.unit_id,
    year: row.year,
    signing: Number(row.signing) || 0,
    revenue: Number(row.revenue) || 0,
    adminProfit: Number(row.admin_profit) || 0,
    revProfit: Number(row.rev_profit) || 0,
    cash: Number(row.cash) || 0,
});

export const EmployeeTargetService = {
    /** Get all targets for a unit in a given year */
    getByUnitAndYear: async (unitId: string, year: number): Promise<EmployeeTarget[]> => {
        const { data, error } = await supabase
            .from('employee_targets')
            .select('*')
            .eq('unit_id', unitId)
            .eq('year', year);
        if (error) throw error;
        return (data || []).map(mapTarget);
    },

    /** Upsert (create or update) a target for employee+unit+year */
    upsert: async (employeeId: string, unitId: string, year: number, target: KPIPlan): Promise<EmployeeTarget> => {
        const { data, error } = await supabase
            .from('employee_targets')
            .upsert({
                employee_id: employeeId,
                unit_id: unitId,
                year,
                signing: target.signing || 0,
                revenue: target.revenue || 0,
                admin_profit: target.adminProfit || 0,
                rev_profit: target.revProfit || 0,
                cash: target.cash || 0,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'employee_id,unit_id,year' })
            .select()
            .single();
        if (error) throw error;
        return mapTarget(data);
    },

    /** Delete a target record */
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from('employee_targets').delete().eq('id', id);
        if (error) throw error;
    },

    /** Get all years that have targets for a unit */
    getAvailableYears: async (unitId: string): Promise<number[]> => {
        const { data, error } = await supabase
            .from('employee_targets')
            .select('year')
            .eq('unit_id', unitId);
        if (error) throw error;
        const years = [...new Set((data || []).map(d => d.year))];
        return years.sort((a, b) => b - a);
    },
};
