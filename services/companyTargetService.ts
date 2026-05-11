import { dataClient as supabase } from '../lib/dataClient';
import { KPIPlan } from '../types';

export interface CompanyTarget {
    id: string;
    year: number;
    signing: number;
    revenue: number;
    adminProfit: number;
    revProfit: number;
    cash: number;
    notes?: string;
}

const mapTarget = (row: any): CompanyTarget => ({
    id: row.id,
    year: row.year,
    signing: Number(row.signing) || 0,
    revenue: Number(row.revenue) || 0,
    adminProfit: Number(row.admin_profit) || 0,
    revProfit: Number(row.rev_profit) || 0,
    cash: Number(row.cash) || 0,
    notes: row.notes || '',
});

export const CompanyTargetService = {
    /** Get company target (ĐHCĐ) for a specific year */
    getByYear: async (year: number): Promise<CompanyTarget | null> => {
        const { data, error } = await supabase
            .from('company_targets')
            .select('*')
            .eq('year', year)
            .maybeSingle();
        if (error) throw error;
        return data ? mapTarget(data) : null;
    },

    /** Get all company targets (all years) */
    getAll: async (): Promise<CompanyTarget[]> => {
        const { data, error } = await supabase
            .from('company_targets')
            .select('*')
            .order('year', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapTarget);
    },

    /** Upsert (create or update) ĐHCĐ target for a year */
    upsert: async (year: number, target: Partial<KPIPlan>, notes?: string): Promise<CompanyTarget> => {
        const adminProfit = target.adminProfit || 0;
        const { data, error } = await supabase
            .from('company_targets')
            .upsert({
                year,
                signing: target.signing || 0,
                revenue: target.revenue || 0,
                admin_profit: adminProfit,
                rev_profit: adminProfit, // LNG DT = LNG QT per business rule
                cash: target.cash || 0,
                notes: notes || null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'year' })
            .select()
            .single();
        if (error) throw error;
        return mapTarget(data);
    },

    /** Convert CompanyTarget to KPIPlan for compatibility */
    toKPIPlan: (ct: CompanyTarget | null): KPIPlan => {
        if (!ct) return { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 };
        return {
            signing: ct.signing,
            revenue: ct.revenue,
            adminProfit: ct.adminProfit,
            revProfit: ct.revProfit,
            cash: ct.cash,
        };
    },
};
