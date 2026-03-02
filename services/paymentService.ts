import { dataClient as supabase } from '../lib/dataClient';
import { Payment } from '../types';

// Helper to map DB Payment to Frontend Payment
const mapPayment = (p: any): Payment & { unitId?: string } => ({
    id: p.id,
    contractId: p.contract_id,
    customerId: p.customer_id,
    phaseId: p.phase_id,
    amount: p.amount,
    paidAmount: p.paid_amount || 0,
    status: p.status,
    method: p.method,
    dueDate: p.due_date,
    paymentDate: p.payment_date,
    bankAccount: p.bank_account,
    reference: p.reference,
    invoiceNumber: p.invoice_number,
    invoiceDate: p.invoice_date,
    externalInvoiceId: p.external_invoice_id,
    source: p.source || 'manual',
    notes: p.notes,
    paymentType: p.payment_type || 'Revenue',
    unitId: p.contracts?.unit_id || undefined
});

export const PaymentService = {
    getAll: async (): Promise<Payment[]> => {
        const { data, error } = await supabase.from('payments').select('*').order('due_date', { ascending: true });
        if (error) throw error;
        return data.map(mapPayment);
    },

    list: async (params: {
        page: number;
        limit: number;
        search?: string;
        type?: string;
        status?: string;
        unitIds?: string[] | 'all';
    }): Promise<{ data: Payment[]; count: number }> => {
        const { page, limit, search, type, status, unitIds } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('payments')
            .select('*, contracts(unit_id)', { count: 'exact' });

        // Filters
        if (search) {
            query = query.ilike('invoice_number', `%${search}%`);
        }
        if (type) {
            query = query.eq('payment_type', type);
        }
        // Simplified 2-status filter
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        if (unitIds && unitIds !== 'all' && unitIds.length > 0) {
            const { data: contracts } = await supabase
                .from('contracts')
                .select('id')
                .in('unit_id', unitIds);

            const contractIds = contracts?.map(c => c.id) || [];
            if (contractIds.length > 0) {
                query = query.in('contract_id', contractIds);
            } else {
                return { data: [], count: 0 };
            }
        }

        // Pagination & Sort
        query = query.order('due_date', { ascending: false }).range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        return {
            data: data.map(mapPayment),
            count: count || 0
        };
    },

    getById: async (id: string): Promise<Payment | undefined> => {
        const { data, error } = await supabase.from('payments').select('*').eq('id', id).single();
        if (error) return undefined;
        return mapPayment(data);
    },

    getByContractId: async (contractId: string): Promise<Payment[]> => {
        const { data, error } = await supabase.from('payments').select('*').eq('contract_id', contractId);
        if (error) throw error;
        return data.map(mapPayment);
    },

    getByCustomerId: async (customerId: string): Promise<Payment[]> => {
        const { data, error } = await supabase.from('payments').select('*').eq('customer_id', customerId);
        if (error) throw error;
        return data.map(mapPayment);
    },

    /**
     * Get financial stats — simplified 2-status model
     * invoicedAmount = sum of payments with status 'Đã xuất HĐ'
     * cashReceivedAmount = sum of payments with status 'Tiền về'
     */
    getStats: async (params: { type?: string; unitIds?: string[] | 'all' }) => {
        const { type, unitIds } = params;
        let query = supabase.from('payments').select('*');

        if (type) {
            query = query.eq('payment_type', type);
        }

        if (unitIds && unitIds !== 'all' && unitIds.length > 0) {
            const { data: contracts } = await supabase
                .from('contracts')
                .select('id')
                .in('unit_id', unitIds);

            const contractIds = contracts?.map(c => c.id) || [];
            if (contractIds.length > 0) {
                query = query.in('contract_id', contractIds);
            } else {
                return { totalAmount: 0, invoicedAmount: 0, cashReceivedAmount: 0, invoicedCount: 0, cashReceivedCount: 0 };
            }
        }

        const { data, error } = await query;
        if (error || !data) return { totalAmount: 0, invoicedAmount: 0, cashReceivedAmount: 0, invoicedCount: 0, cashReceivedCount: 0 };

        const total = data.reduce((sum, p) => sum + (p.amount || 0), 0);

        // Đã xuất HĐ
        const invoicedData = data.filter(p => p.status === 'Đã xuất HĐ');
        const invoiced = invoicedData.reduce((sum, p) => sum + (p.amount || 0), 0);

        // Tiền về
        const cashData = data.filter(p => p.status === 'Tiền về' || p.status === 'Paid');
        const cash = cashData.reduce((sum, p) => sum + (p.amount || 0), 0);

        return {
            totalAmount: total,
            invoicedAmount: invoiced,
            cashReceivedAmount: cash,
            invoicedCount: invoicedData.length,
            cashReceivedCount: cashData.length,
        };
    },

    create: async (data: Omit<Payment, 'id'>): Promise<Payment> => {
        const payload = {
            id: crypto.randomUUID(),
            contract_id: data.contractId || null,
            customer_id: data.customerId || null,
            phase_id: data.phaseId || null,
            amount: data.amount,
            paid_amount: data.status === 'Tiền về' ? data.amount : 0,
            status: data.status || 'Đã xuất HĐ',
            method: data.method || null,
            due_date: data.dueDate || null,
            payment_date: data.paymentDate || null,
            bank_account: data.bankAccount || null,
            reference: data.reference || null,
            invoice_number: data.invoiceNumber || null,
            invoice_date: data.invoiceDate || null,
            external_invoice_id: data.externalInvoiceId || null,
            source: data.source || 'manual',
            notes: data.notes || null,
            payment_type: data.paymentType || 'Revenue'
        };
        const { data: res, error } = await supabase.from('payments').insert(payload).select().single();
        if (error) throw error;
        return mapPayment(res);
    },

    update: async (id: string, data: Partial<Payment>): Promise<Payment | undefined> => {
        const payload: any = {};
        if (data.contractId !== undefined) payload.contract_id = data.contractId;
        if (data.customerId !== undefined) payload.customer_id = data.customerId;
        if (data.phaseId !== undefined) payload.phase_id = data.phaseId;
        if (data.amount !== undefined) payload.amount = data.amount;
        if (data.status) {
            payload.status = data.status;
            // When status changes to Tiền về, set paid_amount = amount
            if (data.status === 'Tiền về') {
                if (data.amount !== undefined) {
                    payload.paid_amount = data.amount;
                } else {
                    // Fetch current amount from DB if not provided
                    const { data: current } = await supabase.from('payments').select('amount').eq('id', id).single();
                    payload.paid_amount = current?.amount || 0;
                }
            }
        }
        if (data.method !== undefined) payload.method = data.method;
        if (data.dueDate !== undefined) payload.due_date = data.dueDate;
        if (data.paymentDate !== undefined) payload.payment_date = data.paymentDate;
        if (data.bankAccount !== undefined) payload.bank_account = data.bankAccount;
        if (data.reference !== undefined) payload.reference = data.reference;
        if (data.invoiceNumber !== undefined) payload.invoice_number = data.invoiceNumber;
        if (data.invoiceDate !== undefined) payload.invoice_date = data.invoiceDate;
        if (data.externalInvoiceId !== undefined) payload.external_invoice_id = data.externalInvoiceId;
        if (data.notes !== undefined) payload.notes = data.notes;
        if (data.paymentType !== undefined) payload.payment_type = data.paymentType;
        if (data.source !== undefined) payload.source = data.source;

        const { data: res, error } = await supabase.from('payments').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return mapPayment(res);
    },

    delete: async (id: string): Promise<boolean> => {
        const { error } = await supabase.from('payments').delete().eq('id', id);
        if (error) throw error;
        return true;
    },
};
