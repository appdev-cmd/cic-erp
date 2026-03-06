import { dataClient as supabase } from '../lib/dataClient';
import { HistoricalProduction } from '../types';

const mapRecord = (r: any): HistoricalProduction => ({
    id: r.id,
    unitId: r.unit_id,
    year: r.year,
    month: r.month ?? null,
    signing: Number(r.signing) || 0,
    revenue: Number(r.revenue) || 0,
    adminProfit: Number(r.admin_profit) || 0,
    revProfit: Number(r.rev_profit) || 0,
    notes: r.notes,
    updatedBy: r.updated_by,
});

export const HistoricalProductionService = {
    /** Get all records (yearly aggregates: month IS NULL) */
    getAll: async (): Promise<HistoricalProduction[]> => {
        const { data, error } = await supabase
            .from('historical_production')
            .select('*')
            .is('month', null)
            .order('year', { ascending: true })
            .order('unit_id', { ascending: true });
        if (error) throw error;
        return data.map(mapRecord);
    },

    /** Get yearly aggregates for a specific year */
    getByYear: async (year: number): Promise<HistoricalProduction[]> => {
        const { data, error } = await supabase
            .from('historical_production')
            .select('*')
            .eq('year', year)
            .is('month', null)
            .order('unit_id', { ascending: true });
        if (error) throw error;
        return data.map(mapRecord);
    },

    /** Get yearly aggregates for a specific unit */
    getByUnit: async (unitId: string): Promise<HistoricalProduction[]> => {
        const { data, error } = await supabase
            .from('historical_production')
            .select('*')
            .eq('unit_id', unitId)
            .is('month', null)
            .order('year', { ascending: true });
        if (error) throw error;
        return data.map(mapRecord);
    },

    /** Get monthly data for a specific year (all units) */
    getMonthlyByYear: async (year: number): Promise<HistoricalProduction[]> => {
        const { data, error } = await supabase
            .from('historical_production')
            .select('*')
            .eq('year', year)
            .not('month', 'is', null)
            .order('unit_id', { ascending: true })
            .order('month', { ascending: true });
        if (error) throw error;
        return data.map(mapRecord);
    },

    /** Get monthly data for a specific year + unit */
    getMonthlyByYearAndUnit: async (year: number, unitId: string): Promise<HistoricalProduction[]> => {
        const { data, error } = await supabase
            .from('historical_production')
            .select('*')
            .eq('year', year)
            .eq('unit_id', unitId)
            .not('month', 'is', null)
            .order('month', { ascending: true });
        if (error) throw error;
        return data.map(mapRecord);
    },

    upsert: async (record: Omit<HistoricalProduction, 'id'>): Promise<HistoricalProduction> => {
        const payload = {
            unit_id: record.unitId,
            year: record.year,
            month: record.month ?? null,
            signing: record.signing,
            revenue: record.revenue,
            admin_profit: record.adminProfit,
            rev_profit: record.revProfit,
            notes: record.notes || null,
            updated_by: record.updatedBy || null,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('historical_production')
            .upsert(payload, { onConflict: 'unit_id,year,month' })
            .select()
            .single();
        if (error) throw error;
        return mapRecord(data);
    },

    bulkUpsert: async (records: Omit<HistoricalProduction, 'id'>[]): Promise<void> => {
        const payloads = records.map(r => ({
            unit_id: r.unitId,
            year: r.year,
            month: r.month ?? null,
            signing: r.signing,
            revenue: r.revenue,
            admin_profit: r.adminProfit,
            rev_profit: r.revProfit,
            notes: r.notes || null,
            updated_by: r.updatedBy || null,
            updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('historical_production')
            .upsert(payloads, { onConflict: 'unit_id,year,month' });
        if (error) throw error;
    },

    delete: async (unitId: string, year: number): Promise<boolean> => {
        const { error } = await supabase
            .from('historical_production')
            .delete()
            .eq('unit_id', unitId)
            .eq('year', year);
        if (error) throw error;
        return true;
    },
};
