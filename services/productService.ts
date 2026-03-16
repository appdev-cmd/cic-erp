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
    unitId: p.unit_id,
    // Structured Name Builder fields
    productLine: p.product_line,
    edition: p.edition,
    licenseType: p.license_type,
    // CRM fields
    brandId: p.brand_id,
    supplierId: p.supplier_id,
    sku: p.sku,
    model: p.model,
    warrantyMonths: p.warranty_months,
    // Joined display fields
    brandName: p.brands?.name || p.brand_name,
    supplierName: p.suppliers?.name || p.supplier_name,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
});

// Select query with joined brand and supplier names
const SELECT_WITH_JOINS = '*, brands:brand_id(name), suppliers:supplier_id(name)';

export const ProductService = {
    /**
     * Generate next product code following pattern: [CategoryCode]-[BrandName]-[UnitCode]-[Seq]
     * e.g. PM-Bentley-DCS-001
     */
    getNextCode: async (prefix: string): Promise<string> => {
        const like = `${prefix}-%`;
        const { count, error } = await supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .ilike('code', like);
        if (error) throw error;
        const seq = ((count || 0) + 1).toString().padStart(3, '0');
        return `${prefix}-${seq}`;
    },

    getAll: async (): Promise<Product[]> => {
        const { data, error } = await supabase.from('products').select(SELECT_WITH_JOINS);
        if (error) throw error;
        return data.map(mapProduct);
    },

    getById: async (id: string): Promise<Product | undefined> => {
        const { data, error } = await supabase.from('products').select(SELECT_WITH_JOINS).eq('id', id).single();
        if (error) return undefined;
        return mapProduct(data);
    },

    getByCategory: async (category: string): Promise<Product[]> => {
        let query = supabase.from('products').select(SELECT_WITH_JOINS);
        if (category !== 'all') {
            query = query.eq('category', category);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data.map(mapProduct);
    },

    getByUnitId: async (unitId: string): Promise<Product[]> => {
        let query = supabase.from('products').select(SELECT_WITH_JOINS);
        if (unitId !== 'all') {
            query = query.eq('unit_id', unitId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data.map(mapProduct);
    },

    getByBrand: async (brandId: string): Promise<Product[]> => {
        let query = supabase.from('products').select(SELECT_WITH_JOINS);
        if (brandId !== 'all') {
            query = query.eq('brand_id', brandId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data.map(mapProduct);
    },

    getBySupplier: async (supplierId: string): Promise<Product[]> => {
        let query = supabase.from('products').select(SELECT_WITH_JOINS);
        if (supplierId !== 'all') {
            query = query.eq('supplier_id', supplierId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data.map(mapProduct);
    },

    getActive: async (): Promise<Product[]> => {
        const { data, error } = await supabase.from('products').select(SELECT_WITH_JOINS).eq('is_active', true);
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
            unit_id: data.unitId || null,
            product_line: data.productLine || null,
            edition: data.edition || null,
            license_type: data.licenseType || null,
            brand_id: data.brandId || null,
            supplier_id: data.supplierId || null,
            sku: data.sku || null,
            model: data.model || null,
            warranty_months: data.warrantyMonths || null,
        };
        const { data: res, error } = await supabase.from('products').insert(payload).select(SELECT_WITH_JOINS).single();
        if (error) throw error;
        return mapProduct(res);
    },

    update: async (id: string, data: Partial<Product>): Promise<Product | undefined> => {
        const payload: any = {};
        if (data.code !== undefined) payload.code = data.code;
        if (data.name !== undefined) payload.name = data.name;
        if (data.category !== undefined) payload.category = data.category;
        if (data.description !== undefined) payload.description = data.description;
        if (data.unit !== undefined) payload.unit = data.unit;
        if (data.basePrice !== undefined) payload.base_price = data.basePrice;
        if (data.costPrice !== undefined) payload.cost_price = data.costPrice;
        if (data.isActive !== undefined) payload.is_active = data.isActive;
        if (data.unitId !== undefined) payload.unit_id = data.unitId || null;
        if (data.productLine !== undefined) payload.product_line = data.productLine || null;
        if (data.edition !== undefined) payload.edition = data.edition || null;
        if (data.licenseType !== undefined) payload.license_type = data.licenseType || null;
        if (data.brandId !== undefined) payload.brand_id = data.brandId || null;
        if (data.supplierId !== undefined) payload.supplier_id = data.supplierId || null;
        if (data.sku !== undefined) payload.sku = data.sku || null;
        if (data.model !== undefined) payload.model = data.model || null;
        if (data.warrantyMonths !== undefined) payload.warranty_months = data.warrantyMonths || null;
        payload.updated_at = new Date().toISOString();

        const { data: res, error } = await supabase.from('products').update(payload).eq('id', id).select(SELECT_WITH_JOINS).single();
        if (error) throw error;
        return mapProduct(res);
    },

    list: async (params: { page?: number; pageSize?: number; search?: string; category?: string; brandId?: string; supplierId?: string; isActive?: boolean; sortBy?: string; sortOrder?: 'asc' | 'desc' }): Promise<{ data: Product[]; total: number }> => {
        let query = supabase.from('products').select(SELECT_WITH_JOINS, { count: 'exact' });

        if (params.category && params.category !== 'all') {
            query = query.eq('category', params.category);
        }
        if (params.brandId && params.brandId !== 'all') {
            query = query.eq('brand_id', params.brandId);
        }
        if (params.supplierId && params.supplierId !== 'all') {
            query = query.eq('supplier_id', params.supplierId);
        }
        if (params.isActive !== undefined) {
            query = query.eq('is_active', params.isActive);
        }
        if (params.search) {
            query = query.or(`name.ilike.%${params.search}%,code.ilike.%${params.search}%,sku.ilike.%${params.search}%`);
        }

        if (params.page !== undefined && params.pageSize !== undefined) {
            const from = (params.page - 1) * params.pageSize;
            const to = from + params.pageSize - 1;
            query = query.range(from, to);
        }

        // Sorting
        const sortColumn = params.sortBy || 'created_at';
        const ascending = params.sortOrder === 'asc';
        query = query.order(sortColumn, { ascending });

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
            .select(SELECT_WITH_JOINS)
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
            category: 'Phần mềm',
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
        // Debug log removed for production
        return mapProduct(created);
    },
};
