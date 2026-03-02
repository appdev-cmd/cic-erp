import { dataClient as supabase } from '../lib/dataClient';
import { HistoricalProduction } from '../types';

const mapRecord = (r: any): HistoricalProduction => ({
    id: r.id,
    unitId: r.unit_id,
    year: r.year,
    signing: Number(r.signing) || 0,
    revenue: Number(r.revenue) || 0,
    adminProfit: Number(r.admin_profit) || 0,
    revProfit: Number(r.rev_profit) || 0,
    notes: r.notes,
    updatedBy: r.updated_by,
});

export const HistoricalProductionService = {
    getAll: async (): Promise<HistoricalProduction[]> => {
        const { data, error } = await supabase
            .from('historical_production')
            .select('*')
            .order('year', { ascending: true })
            .order('unit_id', { ascending: true });
        if (error) throw error;
        return data.map(mapRecord);
    },

    getByYear: async (year: number): Promise<HistoricalProduction[]> => {
        const { data, error } = await supabase
            .from('historical_production')
            .select('*')
            .eq('year', year)
            .order('unit_id', { ascending: true });
        if (error) throw error;
        return data.map(mapRecord);
    },

    getByUnit: async (unitId: string): Promise<HistoricalProduction[]> => {
        const { data, error } = await supabase
            .from('historical_production')
            .select('*')
            .eq('unit_id', unitId)
            .order('year', { ascending: true });
        if (error) throw error;
        return data.map(mapRecord);
    },

    upsert: async (record: Omit<HistoricalProduction, 'id'>): Promise<HistoricalProduction> => {
        const payload = {
            unit_id: record.unitId,
            year: record.year,
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
            .upsert(payload, { onConflict: 'unit_id,year' })
            .select()
            .single();
        if (error) throw error;
        return mapRecord(data);
    },

    bulkUpsert: async (records: Omit<HistoricalProduction, 'id'>[]): Promise<void> => {
        const payloads = records.map(r => ({
            unit_id: r.unitId,
            year: r.year,
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
            .upsert(payloads, { onConflict: 'unit_id,year' });
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
