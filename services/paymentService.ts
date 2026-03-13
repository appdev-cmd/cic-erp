import { dataClient as supabase } from '../lib/dataClient';
import { Payment, VoucherType } from '../types';
import { TelegramNotificationService } from './telegramNotificationService';

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
    voucherType: p.voucher_type || 'RECEIPT',
    expenseCategory: p.expense_category || undefined,
    vatAmount: p.vat_amount || 0,
    vatInvoiceItems: p.vat_invoice_items || [],
    createdBy: p.created_by || undefined,
    unitId: p.contracts?.unit_id || undefined
});

// Auto-derive payment_type from voucher_type
const derivePaymentType = (voucherType: VoucherType): 'Revenue' | 'Expense' => {
    return voucherType === 'EXPENSE' ? 'Expense' : 'Revenue';
};

export const PaymentService = {
    getAll: async (): Promise<Payment[]> => {
        const { data, error } = await supabase.from('payments').select('*').order('due_date', { ascending: true });
        if (error) throw error;
        return data.map(mapPayment);
    },

    getByContractId: async (contractId: string): Promise<Payment[]> => {
        const { data, error } = await supabase
            .from('payments')
            .select('*, contracts!inner(unit_id)')
            .eq('contract_id', contractId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapPayment);
    },

    list: async (params: {
        page: number;
        limit: number;
        search?: string;
        voucherType?: VoucherType;
        type?: string; // backward compat
        status?: string;
        unitIds?: string[] | 'all';
        year?: string;
    }): Promise<{ data: Payment[]; count: number }> => {
        const { page, limit, search, voucherType, type, status, unitIds, year } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('payments')
            .select('*, contracts(unit_id)', { count: 'exact' });

        // Filters
        if (search) {
            query = query.ilike('invoice_number', `%${search}%`);
        }
        // New: filter by voucher_type
        if (voucherType) {
            query = query.eq('voucher_type', voucherType);
        } else if (type) {
            // Backward compat: filter by payment_type
            query = query.eq('payment_type', type);
        }
        // Status filter
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        // Year + Unit filter: filter contracts by year and unit, then get matching payments
        const needContractFilter = (unitIds && unitIds !== 'all' && unitIds.length > 0) || (year && year !== 'All');
        if (needContractFilter) {
            let contractQuery = supabase.from('contracts').select('id');
            if (unitIds && unitIds !== 'all' && unitIds.length > 0) {
                contractQuery = contractQuery.in('unit_id', unitIds);
            }
            if (year && year !== 'All') {
                contractQuery = contractQuery
                    .gte('signed_date', `${year}-01-01`)
                    .lte('signed_date', `${year}-12-31`);
            }
            const { data: contracts } = await contractQuery;
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


    getByCustomerId: async (customerId: string): Promise<Payment[]> => {
        const { data, error } = await supabase.from('payments').select('*').eq('customer_id', customerId);
        if (error) throw error;
        return data.map(mapPayment);
    },

    /**
     * Get financial stats — by voucher type or overall
     */
    getStats: async (params: { voucherType?: VoucherType; type?: string; unitIds?: string[] | 'all'; year?: string }) => {
        const { voucherType, type, unitIds, year } = params;
        let query = supabase.from('payments').select('*');

        if (voucherType) {
            query = query.eq('voucher_type', voucherType);
        } else if (type) {
            query = query.eq('payment_type', type);
        }

        // Year + Unit filter: filter contracts first, then get matching payments
        const needContractFilter = (unitIds && unitIds !== 'all' && unitIds.length > 0) || (year && year !== 'All');
        if (needContractFilter) {
            let contractQuery = supabase.from('contracts').select('id');
            if (unitIds && unitIds !== 'all' && unitIds.length > 0) {
                contractQuery = contractQuery.in('unit_id', unitIds);
            }
            if (year && year !== 'All') {
                contractQuery = contractQuery
                    .gte('signed_date', `${year}-01-01`)
                    .lte('signed_date', `${year}-12-31`);
            }
            const { data: contracts } = await contractQuery;
            const contractIds = contracts?.map(c => c.id) || [];
            if (contractIds.length > 0) {
                query = query.in('contract_id', contractIds);
            } else {
                return { totalAmount: 0, revenueAmount: 0, invoicedAmount: 0, cashReceivedAmount: 0, invoicedCount: 0, cashReceivedCount: 0, expenseAmount: 0, expenseCount: 0, pendingExpenseAmount: 0, advanceAmount: 0, advanceCount: 0 };
            }
        }

        const { data, error } = await query;
        if (error || !data) return { totalAmount: 0, revenueAmount: 0, invoicedAmount: 0, cashReceivedAmount: 0, invoicedCount: 0, cashReceivedCount: 0, expenseAmount: 0, expenseCount: 0, pendingExpenseAmount: 0, advanceAmount: 0, advanceCount: 0 };

        const total = data.reduce((sum, p) => sum + (p.amount || 0), 0);

        // VAT Invoice stats
        const vatData = data.filter(p => p.voucher_type === 'VAT_INVOICE');
        const invoiced = vatData.reduce((sum, p) => sum + (p.amount || 0), 0);

        // Pre-VAT revenue (matches Dashboard "Doanh thu")
        // Use vat_invoice_items JSONB for accuracy, fallback to VAT division
        const vatContractIds = [...new Set(vatData.map(p => p.contract_id).filter(Boolean))];
        let contractVatMap: Record<string, { vatRate: number; hasVat: boolean }> = {};
        if (vatContractIds.length > 0) {
            const { data: contractsVat } = await supabase
                .from('contracts')
                .select('id, vat_rate, has_vat')
                .in('id', vatContractIds);
            (contractsVat || []).forEach((c: any) => {
                contractVatMap[c.id] = { vatRate: c.vat_rate ?? 10, hasVat: c.has_vat !== false };
            });
        }
        let revenuePreVat = 0;
        for (const inv of vatData) {
            const items = inv.vat_invoice_items || [];
            if (Array.isArray(items) && items.length > 0) {
                revenuePreVat += items.reduce((s: number, item: any) => s + (Number(item.amountBeforeVAT) || 0), 0);
            } else {
                const gross = Number(inv.amount) || 0;
                const cInfo = contractVatMap[inv.contract_id] || { vatRate: 10, hasVat: true };
                if (cInfo.hasVat && cInfo.vatRate > 0) {
                    revenuePreVat += gross / (1 + cInfo.vatRate / 100);
                } else {
                    revenuePreVat += gross;
                }
            }
        }

        // Receipt stats (Tiền về + Tạm ứng)
        const receiptData = data.filter(p => p.voucher_type === 'RECEIPT');
        const cashData = receiptData.filter(p => p.status === 'Tiền về' || p.status === 'Paid');
        const cash = cashData.reduce((sum, p) => sum + (p.amount || 0), 0);
        const advanceData = receiptData.filter(p => p.status === 'Tạm ứng');
        const advance = advanceData.reduce((sum, p) => sum + (p.amount || 0), 0);

        // Expense stats
        const expenseData = data.filter(p => p.voucher_type === 'EXPENSE');
        const paidExpense = expenseData.filter(p => p.status === 'Đã chi');
        const expense = paidExpense.reduce((sum, p) => sum + (p.amount || 0), 0);
        const pendingExpense = expenseData.filter(p => p.status === 'Đề nghị chi').reduce((sum, p) => sum + (p.amount || 0), 0);

        return {
            totalAmount: total,
            revenueAmount: revenuePreVat,
            invoicedAmount: invoiced,
            invoicedCount: vatData.length,
            cashReceivedAmount: cash,
            cashReceivedCount: cashData.length,
            advanceAmount: advance,
            advanceCount: advanceData.length,
            expenseAmount: expense,
            expenseCount: paidExpense.length,
            pendingExpenseAmount: pendingExpense,
        };
    },

    create: async (data: Omit<Payment, 'id'>): Promise<Payment> => {
        const voucherType = data.voucherType || 'RECEIPT';
        const paymentType = derivePaymentType(voucherType);

        const payload = {
            id: crypto.randomUUID(),
            contract_id: data.contractId || null,
            customer_id: data.customerId || null,
            phase_id: data.phaseId || null,
            amount: data.amount,
            paid_amount: (data.status === 'Tiền về' || data.status === 'Tạm ứng' || data.status === 'Đã chi') ? data.amount : 0,
            status: data.status || (voucherType === 'VAT_INVOICE' ? 'Đã xuất HĐ' : voucherType === 'EXPENSE' ? 'Đề nghị chi' : 'Tiền về'),
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
            payment_type: paymentType,
            voucher_type: voucherType,
            expense_category: data.expenseCategory || null,
            vat_amount: data.vatAmount || 0,
            vat_invoice_items: data.vatInvoiceItems || [],
            created_by: data.createdBy || null,
        };
        const { data: res, error } = await supabase.from('payments').insert(payload).select().single();
        if (error) throw error;

        // Telegram notification (fire-and-forget)
        if (data.contractId) {
            supabase.from('contracts').select('title, contract_code').eq('id', data.contractId).single().then(({ data: c }) => {
                const label = c?.contract_code ? `${c.contract_code} — ${c.title || ''}` : (c?.title || data.contractId!);
                TelegramNotificationService.notifyPaymentChange({
                    eventType: 'created',
                    contractTitle: label,
                    contractId: data.contractId!,
                    amount: data.amount,
                    status: data.status,
                    paymentType: paymentType,
                }).catch(() => { });
            });
        }

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
            // When status is cash-received or paid, set paid_amount = amount
            if (data.status === 'Tiền về' || data.status === 'Tạm ứng' || data.status === 'Đã chi') {
                if (data.amount !== undefined) {
                    payload.paid_amount = data.amount;
                } else {
                    const { data: current } = await supabase.from('payments').select('amount').eq('id', id).single();
                    payload.paid_amount = current?.amount || 0;
                }
            }
        }
        if (data.method !== undefined) payload.method = data.method;
        if (data.dueDate !== undefined) payload.due_date = data.dueDate || null;
        if (data.paymentDate !== undefined) payload.payment_date = data.paymentDate || null;
        if (data.bankAccount !== undefined) payload.bank_account = data.bankAccount;
        if (data.reference !== undefined) payload.reference = data.reference;
        if (data.invoiceNumber !== undefined) payload.invoice_number = data.invoiceNumber;
        if (data.invoiceDate !== undefined) payload.invoice_date = data.invoiceDate || null;
        if (data.externalInvoiceId !== undefined) payload.external_invoice_id = data.externalInvoiceId;
        if (data.notes !== undefined) payload.notes = data.notes;
        if (data.voucherType !== undefined) {
            payload.voucher_type = data.voucherType;
            payload.payment_type = derivePaymentType(data.voucherType);
        }
        if (data.paymentType !== undefined) payload.payment_type = data.paymentType;
        if (data.expenseCategory !== undefined) payload.expense_category = data.expenseCategory;
        if (data.vatAmount !== undefined) payload.vat_amount = data.vatAmount;
        if (data.vatInvoiceItems !== undefined) payload.vat_invoice_items = data.vatInvoiceItems;
        if (data.source !== undefined) payload.source = data.source;

        const { data: res, error } = await supabase.from('payments').update(payload).eq('id', id).select().single();
        if (error) throw error;
        const mapped = mapPayment(res);

        // Telegram notification (fire-and-forget)
        if (mapped.contractId) {
            supabase.from('contracts').select('title, contract_code').eq('id', mapped.contractId).single().then(({ data: c }) => {
                const label = c?.contract_code ? `${c.contract_code} — ${c.title || ''}` : (c?.title || mapped.contractId);
                TelegramNotificationService.notifyPaymentChange({
                    eventType: 'updated',
                    contractTitle: label,
                    contractId: mapped.contractId,
                    amount: mapped.amount,
                    status: mapped.status,
                    paymentType: mapped.paymentType,
                    oldStatus: data.status ? undefined : undefined,
                    newStatus: data.status,
                }).catch(() => { });
            });
        }

        return mapped;
    },

    delete: async (id: string): Promise<boolean> => {
        // Fetch payment info before deleting for notification
        const { data: payment } = await supabase.from('payments').select('contract_id, amount, payment_type').eq('id', id).single();

        const { error } = await supabase.from('payments').delete().eq('id', id);
        if (error) throw error;

        // Telegram notification (fire-and-forget)
        if (payment?.contract_id) {
            supabase.from('contracts').select('title, contract_code').eq('id', payment.contract_id).single().then(({ data: c }) => {
                const label = c?.contract_code ? `${c.contract_code} — ${c.title || ''}` : (c?.title || payment.contract_id);
                TelegramNotificationService.notifyPaymentChange({
                    eventType: 'deleted',
                    contractTitle: label,
                    contractId: payment.contract_id,
                    amount: payment.amount || 0,
                    paymentType: payment.payment_type || 'Revenue',
                }).catch(() => { });
            });
        }

        return true;
    },
};
