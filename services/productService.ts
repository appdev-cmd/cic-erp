import { dataClient as supabase } from '../lib/dataClient';
import { Product } from '../types';

// Helper to map DB Product to Frontend Product
const mapProduct = (p: any): Product => ({
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    description: p.description,
    unit: p.unit,
    basePrice: p.base_price,
    costPrice: p.cost_price,
    isActive: p.is_active,
    unitId: p.unit_id
});

export const ProductService = {
    getAll: async (): Promise<Product[]> => {
        const { data, error } = await supabase.from('products').select('*');
        if (error) throw error;
        return data.map(mapProduct);
    },

    getById: async (id: string): Promise<Product | undefined> => {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
        if (error) return undefined;
        return mapProduct(data);
    },

    getByCategory: async (category: string): Promise<Product[]> => {
        let query = supabase.from('products').select('*');
        if (category !== 'all') {
            query = query.eq('category', category);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data.map(mapProduct);
    },

    getByUnitId: async (unitId: string): Promise<Product[]> => {
        let query = supabase.from('products').select('*');
        if (unitId !== 'all') {
            query = query.eq('unit_id', unitId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data.map(mapProduct);
    },

    getActive: async (): Promise<Product[]> => {
        const { data, error } = await supabase.from('products').select('*').eq('is_active', true);
        if (error) throw error;
        return data.map(mapProduct);
    },

    create: async (data: Omit<Product, 'id'>): Promise<Product> => {
        const payload = {
            code: data.code,
            name: data.name,
            category: data.category,
            description: data.description,
            unit: data.unit,
            base_price: data.basePrice,
            cost_price: data.costPrice,
            is_active: data.isActive,
            unit_id: data.unitId
        };
        const { data: res, error } = await supabase.from('products').insert(payload).select().single();
        if (error) throw error;
        return mapProduct(res);
    },

    update: async (id: string, data: Partial<Product>): Promise<Product | undefined> => {
        const payload: any = {};
        if (data.code) payload.code = data.code;
        if (data.name) payload.name = data.name;
        if (data.category) payload.category = data.category;
        if (data.description) payload.description = data.description;
        if (data.unit) payload.unit = data.unit;
        if (data.basePrice) payload.base_price = data.basePrice;
        if (data.costPrice) payload.cost_price = data.costPrice;
        if (data.isActive !== undefined) payload.is_active = data.isActive;
        if (data.unitId) payload.unit_id = data.unitId;

        const { data: res, error } = await supabase.from('products').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return mapProduct(res);
    },

    list: async (params: { page?: number; pageSize?: number; search?: string; category?: string }): Promise<{ data: Product[]; total: number }> => {
        let query = supabase.from('products').select('*', { count: 'exact' });

        if (params.category && params.category !== 'all') {
            query = query.eq('category', params.category);
        }
        if (params.search) {
            query = query.or(`name.ilike.%${params.search}%,code.ilike.%${params.search}%`);
        }

        if (params.page !== undefined && params.pageSize !== undefined) {
            const from = (params.page - 1) * params.pageSize;
            const to = from + params.pageSize - 1;
            query = query.range(from, to);
        }

        query = query.order('created_at', { ascending: false });

        const { data, error, count } = await query;
        if (error) throw error;
        return { data: data.map(mapProduct), total: count || 0 };
    },

    delete: async (id: string): Promise<boolean> => {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    /**
     * Search products by name or code (for SearchableSelect)
     */
    search: async (query: string, limit: number = 20): Promise<Product[]> => {
        if (!query || query.trim().length < 2) return [];
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .or(`name.ilike.%${query.trim()}%,code.ilike.%${query.trim()}%`)
            .limit(limit);
        if (error) throw error;
        return (data || []).map(mapProduct);
    },

    /**
     * Find product by name or create new one
     * Used for PAKD Excel import
     */
    findOrCreate: async (name: string, costPrice: number = 0, basePrice: number = 0): Promise<Product> => {
        if (!name || name.trim() === '') {
            throw new Error('Product name is required');
        }

        // Search by exact name match
        const { data: existing, error: searchError } = await supabase
            .from('products')
            .select('*')
            .ilike('name', name.trim())
            .limit(1);

        if (searchError) throw searchError;

        if (existing && existing.length > 0) {
            return mapProduct(existing[0]);
        }

        // Create new product
        const newProduct = {
            code: `IMPORT-${Date.now()}`,
            name: name.trim(),
            category: 'Software', // Default category
            description: `Imported from PAKD Excel`,
            unit: 'VNĐ',
            base_price: basePrice,
            cost_price: costPrice,
            is_active: true,
        };

        const { data: created, error: createError } = await supabase
            .from('products')
            .insert(newProduct)
            .select()
            .single();

        if (createError) throw createError;
        console.log('[ProductService] Created new product:', created.name);
        return mapProduct(created);
    },
};
