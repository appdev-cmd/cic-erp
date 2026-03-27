import { dataClient as supabase } from '../lib/dataClient';
import { getUnitSharePct } from './contractService';
import { Unit } from '../types';

// Helper to map DB Unit to Frontend Unit
const mapUnit = (u: any): Unit => {
    if (!u) return {
        id: 'unknown',
        name: 'Unknown',
        type: 'Center',
        code: 'UNK',
        target: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 },
        lastYearActual: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 }
    } as Unit;

    const t = u.target || { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 };
    if (typeof t.adminProfit === 'number' && t.adminProfit > 0) {
        t.revProfit = t.adminProfit;
    }

    return {
        id: u.id || 'unknown',
        name: u.name || 'Unknown Unit',
        type: u.type || 'Center',
        code: u.code || 'UNK',
        target: t,
        lastYearActual: u.last_year_actual || { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 },
        functions: u.functions || '',
        // Phase 2 fields
        managerId: u.manager_id,
        logoUrl: u.logo_url,
        address: u.address,
        phone: u.phone,
        email: u.email,
        description: u.description,
        parentId: u.parent_id,
        sortOrder: u.sort_order ?? 0,
        isActive: u.is_active ?? true,
        targetMembers: u.target_members || [],
        createdAt: u.created_at,
        updatedAt: u.updated_at
    };
};


export const UnitService = {
    getAll: async (): Promise<Unit[]> => {
        const { data, error } = await supabase.from('units').select('*');
        if (error) throw error;
        return data.map(mapUnit);
    },

    getById: async (id: string): Promise<Unit | undefined> => {
        const { data, error } = await supabase.from('units').select('*').eq('id', id).single();
        if (error) return undefined;
        return mapUnit(data);
    },

    getActive: async (): Promise<Unit[]> => {
        const { data, error } = await supabase.from('units').select('*').neq('id', 'all');
        if (error) throw error;
        return data.map(mapUnit);
    },

    create: async (data: Omit<Unit, 'id'>): Promise<Unit> => {
        const payload: any = {
            name: data.name,
            type: data.type,
            code: data.code,
            target: data.target
        };
        // Add Phase 2 fields if provided
        if (data.functions !== undefined) payload.functions = data.functions;
        if (data.lastYearActual) payload.last_year_actual = data.lastYearActual;
        if (data.managerId) payload.manager_id = data.managerId;
        if (data.logoUrl) payload.logo_url = data.logoUrl;
        if (data.address) payload.address = data.address;
        if (data.phone) payload.phone = data.phone;
        if (data.email) payload.email = data.email;
        if (data.description) payload.description = data.description;
        if (data.parentId) payload.parent_id = data.parentId;
        if (data.sortOrder !== undefined) payload.sort_order = data.sortOrder;
        if (data.isActive !== undefined) payload.is_active = data.isActive;

        const { data: res, error } = await supabase.from('units').insert(payload).select().single();
        if (error) throw error;
        return mapUnit(res);
    },

    update: async (id: string, data: Partial<Unit>): Promise<Unit | undefined> => {
        const payload: any = {};
        if (data.name !== undefined) payload.name = data.name;
        if (data.type !== undefined) payload.type = data.type;
        if (data.code !== undefined) payload.code = data.code;
        if (data.target) payload.target = data.target;
        if (data.functions !== undefined) payload.functions = data.functions;
        if (data.lastYearActual !== undefined) payload.last_year_actual = data.lastYearActual;
        // Phase 2 fields
        if (data.managerId !== undefined) payload.manager_id = data.managerId || null;
        if (data.logoUrl !== undefined) payload.logo_url = data.logoUrl || null;
        if (data.address !== undefined) payload.address = data.address || null;
        if (data.phone !== undefined) payload.phone = data.phone || null;
        if (data.email !== undefined) payload.email = data.email || null;
        if (data.description !== undefined) payload.description = data.description || null;
        if (data.parentId !== undefined) payload.parent_id = data.parentId || null;
        if (data.sortOrder !== undefined) payload.sort_order = data.sortOrder;
        if (data.isActive !== undefined) payload.is_active = data.isActive;
        if (data.targetMembers !== undefined) payload.target_members = data.targetMembers;
        // Always update updated_at
        payload.updated_at = new Date().toISOString();

        const { data: res, error } = await supabase.from('units').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return mapUnit(res);
    },

    delete: async (id: string): Promise<boolean> => {
        const { error } = await supabase.from('units').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    getStats: async (id: string, year?: number | null): Promise<any> => {
        try {
            const { data, error } = await supabase.rpc('get_kpi_stats', {
                p_entity_id: id,
                p_type: 'unit',
                p_year: year !== undefined ? year : new Date().getFullYear()
            });

            if (error) {
                // If there's an error from the RPC, treat it like an exception
                throw error;
            }

            return {
                contractCount: data.contractCount || 0,
                totalSigning: data.totalSigning || 0,
                totalRevenue: data.totalRevenue || 0,
                totalProfit: data.totalProfit || 0,
                totalRevenueProfit: data.totalRevenueProfit || 0,
                // Progress handled by UI or calculated here if we fetch target too. 
                // For consistency with EmployeeService, we return raw values.
                signingProgress: 0,
                revenueProgress: 0,
                profitProgress: 0,
                revProfitProgress: 0
            };
        } catch (error) {
            console.error('Error in getStats:', error);
            return {
                contractCount: 0,
                totalSigning: 0,
                totalRevenue: 0,
                totalProfit: 0,
                totalRevenueProfit: 0,
                signingProgress: 0,
                revenueProgress: 0,
                profitProgress: 0,
                revProfitProgress: 0
            };
        }
    },

    getWithStats: async (year?: number | null, periodFilter?: string): Promise<Unit[]> => {
        try {
            if (!periodFilter) {
                const { data, error } = await supabase.rpc('get_units_with_stats', {
                    p_year: year !== undefined && year !== null ? year : new Date().getFullYear()
                });

                if (!error && data) {
                    return data.map((u: any) => ({
                        ...mapUnit(u),
                        functions: u.functions || '',
                        stats: {
                            contractCount: u.contract_count || 0,
                            totalSigning: u.total_signing,
                            totalRevenue: u.total_revenue,
                            totalProfit: u.total_profit,
                            totalRevenueProfit: u.total_revenue_profit || 0,
                            totalCash: u.total_cash
                        }
                    }));
                }
            }

            // Fallback / PeriodFilter JS aggregation
            const allUnits = await UnitService.getAll();

            const effectiveYear = year !== undefined && year !== null ? year : new Date().getFullYear();
            let startDate = `${effectiveYear}-01-01`;
            let endDate = `${effectiveYear}-12-31`;

            if (periodFilter) {
                if (periodFilter.startsWith('M')) {
                    const month = parseInt(periodFilter.substring(1));
                    startDate = `${effectiveYear}-${month.toString().padStart(2, '0')}-01`;
                    endDate = new Date(effectiveYear, month, 0).toISOString().split('T')[0];
                } else if (periodFilter.startsWith('Q')) {
                    const quarter = parseInt(periodFilter.substring(1));
                    const startMonth = (quarter - 1) * 3 + 1;
                    const endMonth = quarter * 3;
                    startDate = `${effectiveYear}-${startMonth.toString().padStart(2, '0')}-01`;
                    endDate = new Date(effectiveYear, endMonth, 0).toISOString().split('T')[0];
                }
            }

            const { data: contracts, error } = await supabase
                .from('contracts')
                .select('id, value, actual_revenue, admin_profit, rev_profit, cash_received, unit_id, unit_allocations')
                .gte('signed_date', startDate)
                .lte('signed_date', endDate);

            if (error) throw error;

            return allUnits.map(u => {
                let contractCount = 0;
                let totalSigning = 0;
                let totalRevenue = 0;
                let totalProfit = 0;
                let totalRevenueProfit = 0;
                let totalCash = 0;

                (contracts || []).forEach((c: any) => {
                    const sharePct = getUnitSharePct(c, u.id);
                    if (sharePct === 0) return;

                    const fraction = sharePct / 100;
                    contractCount++;
                    totalSigning += (Number(c.value) || 0) * fraction;
                    totalRevenue += (Number(c.actual_revenue) || 0) * fraction;
                    totalProfit += (Number(c.admin_profit) || 0) * fraction;
                    totalRevenueProfit += (Number(c.rev_profit) || 0) * fraction;
                    totalCash += (Number(c.cash_received) || 0) * fraction;
                });

                return {
                    ...u,
                    stats: {
                        contractCount,
                        totalSigning,
                        totalRevenue,
                        totalProfit,
                        totalRevenueProfit,
                        totalCash
                    }
                };
            });
        } catch (error) {
            console.error('[UnitService.getWithStats] Exception, falling back:', error);
            const allUnits = await UnitService.getAll();
            return allUnits.map(u => ({
                ...u,
                stats: { contractCount: 0, totalSigning: 0, totalRevenue: 0, totalProfit: 0, totalCash: 0 }
            }));
        }
    }
};
