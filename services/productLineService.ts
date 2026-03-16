import { dataClient as supabase } from '../lib/dataClient';

export interface ProductLine {
    id: string;
    name: string;
    sortOrder: number;
    createdAt?: string;
}

const mapRow = (r: any): ProductLine => ({
    id: r.id,
    name: r.name,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
});

export const ProductLineService = {
    getAll: async (): Promise<ProductLine[]> => {
        const { data, error } = await supabase
            .from('product_lines')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });
        if (error) throw error;
        return (data || []).map(mapRow);
    },

    findOrCreate: async (name: string): Promise<ProductLine> => {
        const trimmed = name.trim();
        if (!trimmed) throw new Error('Product line name is required');

        // Check existing
        const { data: existing } = await supabase
            .from('product_lines')
            .select('*')
            .ilike('name', trimmed)
            .limit(1);

        if (existing && existing.length > 0) {
            return mapRow(existing[0]);
        }

        // Create new
        const { data: created, error } = await supabase
            .from('product_lines')
            .insert({ name: trimmed })
            .select()
            .single();
        if (error) throw error;
        return mapRow(created);
    },
};
