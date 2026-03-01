import { dataClient as supabase } from '../lib/dataClient';
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

    return {
        id: u.id || 'unknown',
        name: u.name || 'Unknown Unit',
        type: u.type || 'Center',
        code: u.code || 'UNK',
        target: u.target || { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 },
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
                // Progress handled by UI or calculated here if we fetch target too. 
                // For consistency with EmployeeService, we return raw values.
                signingProgress: 0,
                revenueProgress: 0
            };
        } catch (error) {
            console.error('Error in getStats:', error);
            return {
                contractCount: 0,
                totalSigning: 0,
                totalRevenue: 0,
                signingProgress: 0,
                revenueProgress: 0
            };
        }
    },

    getWithStats: async (year?: number | null): Promise<Unit[]> => {
        try {
            const { data, error } = await supabase.rpc('get_units_with_stats', {
                p_year: year !== undefined ? year : new Date().getFullYear()
            });

            if (error) {
                console.error('[UnitService.getWithStats] RPC failed, falling back:', error);
                const allUnits = await UnitService.getAll();
                return allUnits.map(u => ({
                    ...u,
                    stats: { contractCount: 0, totalSigning: 0, totalRevenue: 0, totalProfit: 0 }
                }));
            }

            return data.map((u: any) => ({
                ...mapUnit(u),
                functions: u.functions || '',
                stats: {
                    contractCount: u.contract_count || 0,
                    totalSigning: u.total_signing,
                    totalRevenue: u.total_revenue,
                    totalProfit: u.total_profit,
                    totalCash: u.total_cash
                }
            }));
        } catch (error) {
            console.error('[UnitService.getWithStats] Exception, falling back:', error);
            const allUnits = await UnitService.getAll();
            return allUnits.map(u => ({
                ...u,
                stats: { contractCount: 0, totalSigning: 0, totalRevenue: 0, totalProfit: 0 }
            }));
        }
    }
};
