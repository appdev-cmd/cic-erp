import { dataClient as supabase } from '../lib/dataClient';
import { KPIPlan } from '../types';

export interface UnitTarget {
    id: string;
    unitId: string;
    year: number;
    signing: number;
    revenue: number;
    adminProfit: number;
    revProfit: number;
    cash: number;
}

const mapTarget = (row: any): UnitTarget => ({
    id: row.id,
    unitId: row.unit_id,
    year: row.year,
    signing: Number(row.signing) || 0,
    revenue: Number(row.revenue) || 0,
    adminProfit: Number(row.admin_profit) || 0,
    revProfit: Number(row.rev_profit) || 0,
    cash: Number(row.cash) || 0,
});

export const UnitTargetService = {
    /** Get target for a specific unit and year */
    getByUnitAndYear: async (unitId: string, year: number): Promise<UnitTarget | null> => {
        const { data, error } = await supabase
            .from('unit_targets')
            .select('*')
            .eq('unit_id', unitId)
            .eq('year', year)
            .maybeSingle();
        if (error) throw error;
        return data ? mapTarget(data) : null;
    },

    /** Get all targets for a unit (all years) */
    getByUnit: async (unitId: string): Promise<UnitTarget[]> => {
        const { data, error } = await supabase
            .from('unit_targets')
            .select('*')
            .eq('unit_id', unitId)
            .order('year', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapTarget);
    },

    /** Upsert (create or update) a target for unit+year */
    upsert: async (unitId: string, year: number, target: Partial<KPIPlan>): Promise<UnitTarget> => {
        const { data, error } = await supabase
            .from('unit_targets')
            .upsert({
                unit_id: unitId,
                year,
                signing: target.signing || 0,
                revenue: target.revenue || 0,
                admin_profit: target.adminProfit || 0,
                rev_profit: target.revProfit || 0,
                cash: target.cash || 0,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'unit_id,year' })
            .select()
            .single();
        if (error) throw error;
        return mapTarget(data);
    },

    /** Convert UnitTarget to KPIPlan for compatibility */
    toKPIPlan: (ut: UnitTarget | null): KPIPlan => {
        if (!ut) return { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 };
        return {
            signing: ut.signing,
            revenue: ut.revenue,
            adminProfit: ut.adminProfit,
            revProfit: ut.revProfit,
            cash: ut.cash,
        };
    },
};
