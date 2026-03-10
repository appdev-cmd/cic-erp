import { dataClient as supabase } from '../lib/dataClient';
import { Customer, CustomerContact } from '../types';

// Normalize industry: DB may store string or JSON array string
const normalizeIndustry = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        if (raw.startsWith('[')) {
            try { return JSON.parse(raw); } catch { /* fall through */ }
        }
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
    shortName: c.short_name || c.shortName,
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
    // Extended info
    internationalName: c.international_name || c.internationalName || null,
    representative: c.representative || null,
    businessType: c.business_type || c.businessType || null,
    businessStatus: c.business_status || c.businessStatus || 'Đang hoạt động',
    // CRM fields
    rating: c.rating || 'Standard',
    source: c.source,
    paymentTerms: c.payment_terms || c.paymentTerms,
    creditLimit: c.credit_limit !== undefined ? Number(c.credit_limit) : (c.creditLimit !== undefined ? Number(c.creditLimit) : 0),
    stats: c.contract_count !== undefined ? {
        contractCount: Number(c.contract_count),
        totalValue: Number(c.total_value),
        totalRevenue: Number(c.total_revenue),
        activeContracts: Number(c.active_contracts_count)
    } : undefined
});

// Map DB customer_contacts row
const mapContact = (c: any): CustomerContact => ({
    id: c.id,
    customerId: c.customer_id,
    name: c.name,
    position: c.position,
    department: c.department,
    phone: c.phone,
    email: c.email,
    isPrimary: c.is_primary ?? false,
    notes: c.notes,
    createdAt: c.created_at,
});

export const CustomerService = {
    getAll: async (params?: { page?: number; pageSize?: number; search?: string; type?: string; industry?: string; rating?: string }): Promise<{ data: Customer[]; total: number }> => {
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

        let results = (listRes.data || []).map(mapCustomer);

        // Client-side rating filter (until RPC is updated)
        if (params?.rating && params.rating !== 'all') {
            results = results.filter(c => c.rating === params.rating);
        }

        return {
            data: results,
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
            type: data.type || 'Customer',
            // CRM fields
            rating: data.rating || 'Standard',
            source: data.source || null,
            payment_terms: data.paymentTerms || null,
            credit_limit: data.creditLimit || 0,
            // Extended info
            international_name: data.internationalName || null,
            representative: data.representative || null,
            business_type: data.businessType || null,
            business_status: data.businessStatus || null,
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
        // CRM fields
        if (data.rating !== undefined) payload.rating = data.rating;
        if (data.source !== undefined) payload.source = data.source || null;
        if (data.paymentTerms !== undefined) payload.payment_terms = data.paymentTerms || null;
        if (data.creditLimit !== undefined) payload.credit_limit = data.creditLimit;
        // Extended info
        if (data.internationalName !== undefined) payload.international_name = data.internationalName || null;
        if (data.representative !== undefined) payload.representative = data.representative || null;
        if (data.businessType !== undefined) payload.business_type = data.businessType || null;
        if (data.businessStatus !== undefined) payload.business_status = data.businessStatus || null;
        payload.updated_at = new Date().toISOString();

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
     * Find customer by tax code — for upsert logic
     */
    findByTaxCode: async (taxCode: string): Promise<Customer | null> => {
        if (!taxCode || taxCode.trim().length < 5) return null;
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('tax_code', taxCode.trim())
            .limit(1)
            .maybeSingle();
        if (error || !data) return null;
        return mapCustomer(data);
    },

    /**
     * Lightweight search for dropdowns - returns max 20 results
     */
    search: async (query: string, limit: number = 20): Promise<Customer[]> => {
        if (!query || query.length < 2) return [];

        const { data, error } = await supabase
            .from('customers')
            .select('id, name, short_name, industry, type, rating')
            .or(`name.ilike.%${query}%,short_name.ilike.%${query}%`)
            .limit(limit);

        if (error) {
            console.error('[CustomerService.search] Error:', error);
            return [];
        }
        return (data || []).map(mapCustomer);
    },

    /**
     * Search suppliers only
     */
    searchSuppliers: async (query: string, limit: number = 20): Promise<Customer[]> => {
        if (!query || query.length < 2) return [];

        const { data, error } = await supabase
            .from('customers')
            .select('id, name, short_name, industry, type, rating')
            .in('type', ['Supplier', 'Both'])
            .or(`name.ilike.%${query}%,short_name.ilike.%${query}%`)
            .limit(limit);

        if (error) {
            console.error('[CustomerService.searchSuppliers] Error:', error);
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

        const { data: existing, error: searchError } = await supabase
            .from('customers')
            .select('*')
            .ilike('name', name.trim())
            .in('type', ['Supplier', 'Both'])
            .limit(1);

        if (searchError) throw searchError;

        if (existing && existing.length > 0) {
            return mapCustomer(existing[0]);
        }

        const newSupplier = {
            name: name.trim(),
            short_name: name.trim().substring(0, 20),
            industry: '["Công nghệ"]',
            type: 'Supplier',
            contact_person: '',
            phone: '',
            email: '',
            address: '',
            rating: 'Standard',
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

    // =============================================
    // Customer Contacts sub-CRUD
    // =============================================

    getContacts: async (customerId: string): Promise<CustomerContact[]> => {
        const { data, error } = await supabase
            .from('customer_contacts')
            .select('*')
            .eq('customer_id', customerId)
            .order('is_primary', { ascending: false })
            .order('name');
        if (error) throw error;
        return (data || []).map(mapContact);
    },

    createContact: async (contact: Omit<CustomerContact, 'id'>): Promise<CustomerContact> => {
        const payload = {
            customer_id: contact.customerId,
            name: contact.name,
            position: contact.position || null,
            department: contact.department || null,
            phone: contact.phone || null,
            email: contact.email || null,
            is_primary: contact.isPrimary ?? false,
            notes: contact.notes || null,
        };
        const { data, error } = await supabase
            .from('customer_contacts')
            .insert(payload)
            .select()
            .single();
        if (error) throw error;
        return mapContact(data);
    },

    updateContact: async (id: string, contact: Partial<CustomerContact>): Promise<CustomerContact> => {
        const payload: any = {};
        if (contact.name !== undefined) payload.name = contact.name;
        if (contact.position !== undefined) payload.position = contact.position || null;
        if (contact.department !== undefined) payload.department = contact.department || null;
        if (contact.phone !== undefined) payload.phone = contact.phone || null;
        if (contact.email !== undefined) payload.email = contact.email || null;
        if (contact.isPrimary !== undefined) payload.is_primary = contact.isPrimary;
        if (contact.notes !== undefined) payload.notes = contact.notes || null;

        const { data, error } = await supabase
            .from('customer_contacts')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return mapContact(data);
    },

    deleteContact: async (id: string): Promise<boolean> => {
        const { error } = await supabase.from('customer_contacts').delete().eq('id', id);
        if (error) throw error;
        return true;
    },
};
