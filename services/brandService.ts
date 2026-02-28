import { dataClient as supabase } from '../lib/dataClient';
import { Brand } from '../types';

const mapBrand = (b: any): Brand => ({
    id: b.id,
    name: b.name,
    code: b.code,
    logoUrl: b.logo_url,
    website: b.website,
    country: b.country,
    description: b.description,
    isActive: b.is_active ?? true,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
});

export const BrandService = {
    getAll: async (): Promise<Brand[]> => {
        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .order('name');
        if (error) throw error;
        return (data || []).map(mapBrand);
    },

    getActive: async (): Promise<Brand[]> => {
        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .eq('is_active', true)
            .order('name');
        if (error) throw error;
        return (data || []).map(mapBrand);
    },

    getById: async (id: string): Promise<Brand | undefined> => {
        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return undefined;
        return mapBrand(data);
    },

    create: async (brand: Omit<Brand, 'id'>): Promise<Brand> => {
        const payload = {
            name: brand.name,
            code: brand.code || null,
            logo_url: brand.logoUrl || null,
            website: brand.website || null,
            country: brand.country || null,
            description: brand.description || null,
            is_active: brand.isActive ?? true,
        };
        const { data, error } = await supabase
            .from('brands')
            .insert(payload)
            .select()
            .single();
        if (error) throw error;
        return mapBrand(data);
    },

    update: async (id: string, brand: Partial<Brand>): Promise<Brand> => {
        const payload: any = {};
        if (brand.name !== undefined) payload.name = brand.name;
        if (brand.code !== undefined) payload.code = brand.code || null;
        if (brand.logoUrl !== undefined) payload.logo_url = brand.logoUrl || null;
        if (brand.website !== undefined) payload.website = brand.website || null;
        if (brand.country !== undefined) payload.country = brand.country || null;
        if (brand.description !== undefined) payload.description = brand.description || null;
        if (brand.isActive !== undefined) payload.is_active = brand.isActive;
        payload.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('brands')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapBrand(data);
    },

    delete: async (id: string): Promise<boolean> => {
        const { error } = await supabase.from('brands').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    search: async (query: string, limit: number = 20): Promise<Brand[]> => {
        if (!query || query.trim().length < 1) return [];
        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .or(`name.ilike.%${query.trim()}%,code.ilike.%${query.trim()}%`)
            .eq('is_active', true)
            .limit(limit)
            .order('name');
        if (error) throw error;
        return (data || []).map(mapBrand);
    },
};
