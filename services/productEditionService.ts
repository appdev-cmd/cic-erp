import { dataClient as supabase } from '../lib/dataClient';

export interface ProductEdition {
    id: string;
    name: string;
    sortOrder: number;
    createdAt?: string;
}

const mapRow = (r: any): ProductEdition => ({
    id: r.id,
    name: r.name,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
});

export const ProductEditionService = {
    getAll: async (): Promise<ProductEdition[]> => {
        const { data, error } = await supabase
            .from('product_editions')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapRow);
    },

    findOrCreate: async (name: string): Promise<ProductEdition> => {
        const trimmed = name.trim();
        if (!trimmed) throw new Error('Product edition name is required');

        // Check existing
        const { data: existing } = await supabase
            .from('product_editions')
            .select('*')
            .ilike('name', trimmed)
            .limit(1);

        if (existing && existing.length > 0) {
            return mapRow(existing[0]);
        }

        // Create new
        const { data: created, error } = await supabase
            .from('product_editions')
            .insert({ name: trimmed })
            .select()
            .single();
        if (error) throw error;
        return mapRow(created);
    },
};
