import { dataClient as supabase } from '../lib/dataClient';
import { Customer } from '../types';

// Normalize industry: DB may store string or JSON array string
// Old data: "Xây dựng" -> ["Xây dựng"]
// New data: ["Xây dựng","Công nghệ"] -> ["Xây dựng","Công nghệ"]
const normalizeIndustry = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        // Try parse JSON array
        if (raw.startsWith('[')) {
            try { return JSON.parse(raw); } catch { /* fall through */ }
        }
        // Single string value
        return raw.trim() ? [raw.trim()] : [];
    }
    return [];
};

// Serialize industry array for DB storage (as JSON string)
const serializeIndustry = (industry: string[] | string | undefined): string => {
    if (!industry) return '[]';
    if (typeof industry === 'string') return JSON.stringify([industry]);
    return JSON.stringify(industry);
};

// Helper to map DB Customer to Frontend Customer
const mapCustomer = (c: any): Customer => ({
    id: c.id,
    name: c.name,
    shortName: c.short_name || c.shortName, // Handle both snake_case (RPC) and camelCase (if any)
    industry: normalizeIndustry(c.industry),
    contactPerson: c.contact_person || c.contactPerson,
    phone: c.phone,
    email: c.email,
    address: c.address,
    taxCode: c.tax_code || c.taxCode,
    website: c.website,
    notes: c.notes,
    bankName: c.bank_name || c.bankName,
    bankBranch: c.bank_branch || c.bankBranch,
    bankAccount: c.bank_account || c.bankAccount,
    foundedDate: c.founded_date || c.foundedDate,
    type: c.type || 'Customer',
    stats: c.contract_count !== undefined ? {
        contractCount: Number(c.contract_count),
        totalValue: Number(c.total_value),
        totalRevenue: Number(c.total_revenue),
        activeContracts: Number(c.active_contracts_count)
    } : undefined
});

export const CustomerService = {
    getAll: async (params?: { page?: number; pageSize?: number; search?: string; type?: string; industry?: string }): Promise<{ data: Customer[]; total: number }> => {
        const p_search = params?.search || null;
        const p_type = params?.type === 'all' ? null : params?.type;
        const p_industry = params?.industry === 'all' ? null : params?.industry;
        const p_limit = params?.pageSize || 10;
        const p_offset = ((params?.page || 1) - 1) * p_limit;

        const [listRes, countRes] = await Promise.all([
            supabase.rpc('get_customers_with_stats', {
                p_search,
                p_type,
                p_industry,
                p_limit,
                p_offset
            }),
            supabase.rpc('get_customers_count', {
                p_search,
                p_type,
                p_industry
            })
        ]);

        if (listRes.error) throw listRes.error;
        if (countRes.error) throw countRes.error;

        return {
            data: (listRes.data || []).map(mapCustomer),
            total: Number(countRes.data) || 0
        };
    },

    getById: async (id: string): Promise<Customer | undefined> => {
        const { data, error } = await supabase.from('customers').select('*').eq('id', id).single();
        if (error) return undefined;
        return mapCustomer(data);
    },

    create: async (data: Omit<Customer, 'id'>): Promise<Customer> => {
        const payload = {
            name: data.name,
            short_name: data.shortName,
            industry: serializeIndustry(data.industry),
            contact_person: data.contactPerson,
            phone: data.phone,
            email: data.email,
            address: data.address,
            tax_code: data.taxCode || null,
            website: data.website || null,
            notes: data.notes || null,
            bank_name: data.bankName || null,
            bank_branch: data.bankBranch || null,
            bank_account: data.bankAccount || null,
            founded_date: data.foundedDate || null,
            type: data.type || 'Customer'
        };
        const { data: res, error } = await supabase.from('customers').insert(payload).select().single();
        if (error) throw error;
        return mapCustomer(res);
    },

    update: async (id: string, data: Partial<Customer>): Promise<Customer | undefined> => {
        const payload: any = {};
        if (data.name) payload.name = data.name;
        if (data.shortName) payload.short_name = data.shortName;
        if (data.industry) payload.industry = serializeIndustry(data.industry);
        if (data.contactPerson) payload.contact_person = data.contactPerson;
        if (data.phone) payload.phone = data.phone;
        if (data.email) payload.email = data.email;
        if (data.address) payload.address = data.address;
        if (data.taxCode !== undefined) payload.tax_code = data.taxCode || null;
        if (data.website !== undefined) payload.website = data.website || null;
        if (data.notes !== undefined) payload.notes = data.notes || null;
        if (data.bankName !== undefined) payload.bank_name = data.bankName || null;
        if (data.bankBranch !== undefined) payload.bank_branch = data.bankBranch || null;
        if (data.bankAccount !== undefined) payload.bank_account = data.bankAccount || null;
        if (data.foundedDate !== undefined) payload.founded_date = data.foundedDate || null;
        if (data.type) payload.type = data.type;

        const { data: res, error } = await supabase.from('customers').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return mapCustomer(res);
    },

    delete: async (id: string): Promise<boolean> => {
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    /**
     * Lightweight search for dropdowns - returns max 20 results
     * Debounce on frontend recommended (300ms)
     */
    search: async (query: string, limit: number = 20): Promise<Customer[]> => {
        if (!query || query.length < 2) return [];

        const { data, error } = await supabase
            .from('customers')
            .select('id, name, short_name, industry, type')
            .or(`name.ilike.%${query}%,short_name.ilike.%${query}%`)
            .limit(limit);

        if (error) {
            console.error('[CustomerService.search] Error:', error);
            return [];
        }
        return (data || []).map(mapCustomer);
    },

    /**
     * Find supplier by name or create new one
     * Used for PAKD Excel import
     */
    findOrCreateSupplier: async (name: string): Promise<Customer> => {
        if (!name || name.trim() === '') {
            throw new Error('Supplier name is required');
        }

        // Search by exact name match with type = Supplier
        const { data: existing, error: searchError } = await supabase
            .from('customers')
            .select('*')
            .ilike('name', name.trim())
            .eq('type', 'Supplier')
            .limit(1);

        if (searchError) throw searchError;

        if (existing && existing.length > 0) {
            return mapCustomer(existing[0]);
        }

        // Create new supplier
        const newSupplier = {
            name: name.trim(),
            short_name: name.trim().substring(0, 20),
            industry: '["Công nghệ"]',
            type: 'Supplier',
            contact_person: '',
            phone: '',
            email: '',
            address: '',
        };

        const { data: created, error: createError } = await supabase
            .from('customers')
            .insert(newSupplier)
            .select()
            .single();

        if (createError) throw createError;
        console.log('[CustomerService] Created new supplier:', created.name);
        return mapCustomer(created);
    },
};
