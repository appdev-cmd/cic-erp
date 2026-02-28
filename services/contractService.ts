import { dataClient as supabase } from '../lib/dataClient';
import { Contract } from '../types';

// Error messages in Vietnamese for better UX
const ERROR_MESSAGES = {
    FETCH_FAILED: 'Không thể tải danh sách hợp đồng. Vui lòng thử lại.',
    NOT_FOUND: 'Không tìm thấy hợp đồng.',
    CREATE_FAILED: 'Không thể tạo hợp đồng mới. Vui lòng kiểm tra thông tin.',
    UPDATE_FAILED: 'Không thể cập nhật hợp đồng. Vui lòng thử lại.',
    DELETE_FAILED: 'Không thể xóa hợp đồng. Vui lòng thử lại.',
    VALIDATION_ERROR: 'Dữ liệu không hợp lệ.',
    NETWORK_ERROR: 'Lỗi kết nối mạng. Vui lòng kiểm tra internet.',
    DUPLICATE_ID: 'Mã hợp đồng đã tồn tại.',
    PERMISSION_DENIED: 'Bạn không có quyền thực hiện thao tác này.',
};

// ============================================================================
// PROFESSIONAL CRUD UTILITIES
// ============================================================================

/**
 * Retry logic with exponential backoff
 * Automatically retries failed operations up to maxRetries times
 */
const withRetry = async <T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
): Promise<T> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            // Don't retry on validation or permission errors
            if (error.message?.includes('VALIDATION') ||
                error.message?.includes('permission') ||
                error.code === '23505') { // Duplicate key
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s
            if (attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError || new Error(ERROR_MESSAGES.NETWORK_ERROR);
};

/**
 * Validate contract data before create/update
 */
const validateContract = (data: Partial<Contract>, isCreate = false): string[] => {
    const errors: string[] = [];

    if (isCreate) {
        if (!data.id?.trim()) errors.push('Mã hợp đồng là bắt buộc');
        if (!data.title?.trim()) errors.push('Tiêu đề hợp đồng là bắt buộc');
        if (!data.unitId) errors.push('Đơn vị là bắt buộc');
    }

    if (data.value !== undefined && data.value < 0) {
        errors.push('Giá trị hợp đồng không được âm');
    }

    if (data.signedDate && data.endDate) {
        if (new Date(data.signedDate) > new Date(data.endDate)) {
            errors.push('Ngày ký không được sau ngày kết thúc');
        }
    }

    return errors;
};

/**
 * Build database payload from Contract type
 * Ensures type-safe mapping between frontend and DB schema
 */
const buildPayload = (data: Partial<Contract>): Record<string, any> => {
    const payload: Record<string, any> = {};

    // Direct mappings
    const fieldMap: Record<string, string> = {
        id: 'id',
        title: 'title',
        contractType: 'contract_type',
        partyA: 'party_a',
        partyB: 'party_b',
        clientInitials: 'client_initials',
        customerId: 'customer_id',
        isDealerSale: 'is_dealer_sale',
        hasVat: 'has_vat',
        vatRate: 'vat_rate',
        endUserId: 'end_user_id',
        endUserName: 'end_user_name',
        unitId: 'unit_id',
        coordinatingUnitId: 'coordinating_unit_id',
        // unitAllocations handled separately as JSONB wrapper
        salespersonId: 'employee_id',
        value: 'value',
        estimatedCost: 'estimated_cost',
        actualRevenue: 'actual_revenue',
        actualCost: 'actual_cost',
        invoicedAmount: 'invoiced_amount',
        status: 'status',
        stage: 'stage',
        category: 'category',
        signedDate: 'signed_date',
        startDate: 'start_date',
        endDate: 'end_date',
        content: 'content',
        contacts: 'contacts',
        milestones: 'milestones',
        paymentPhases: 'payment_phases',
        draft_url: 'draft_url',
    };

    Object.entries(fieldMap).forEach(([key, dbKey]) => {
        if ((data as any)[key] !== undefined) {
            payload[dbKey] = (data as any)[key];
        }
    });

    // Handle JSONB details field
    if (data.lineItems !== undefined || data.adminCosts !== undefined || (data as any).revenueSchedules !== undefined) {
        payload.details = {
            lineItems: data.lineItems || [],
            adminCosts: data.adminCosts || {},
            revenueSchedules: (data as any).revenueSchedules || []
        };
    }

    // Handle unitAllocations JSONB field (QĐ 09.2024)
    if ((data as any).unitAllocations !== undefined) {
        payload.unit_allocations = (data as any).unitAllocations
            ? { allocations: (data as any).unitAllocations }
            : null;
    }

    return payload;
};

/**
 * Log operation for audit trail (integrates with AuditLogService)
 */
const logOperation = async (
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    contractId: string,
    changes?: Record<string, any>
) => {
    try {
        const user = (await supabase.auth.getUser()).data.user;
        console.log(`[Audit] ${action} contract ${contractId} by ${user?.email || 'unknown'}`, changes || {});
        // Integration point: AuditLogService.log({ ... })
    } catch (e) {
        console.warn('[Audit] Failed to log operation:', e);
    }
};

// Helper to map DB Contract to Frontend Contract
const mapContract = (c: any): Contract => {
    if (!c) return {
        id: 'unknown',
        title: 'Unknown Contract',
        contractType: 'HĐ',
        status: 'Pending',
        stage: 'Signed',
        value: 0
    } as any; // Partial fallback

    return {
        id: c.id || 'unknown',
        title: c.title || 'Untitled',
        contractType: c.contract_type || 'HĐ',
        partyA: c.party_a || '',
        partyB: c.party_b || '',
        clientInitials: c.client_initials || '',
        customerId: c.customer_id || '',
        isDealerSale: c.is_dealer_sale || false,
        hasVat: c.has_vat !== false, // default true
        vatRate: c.vat_rate ?? 10,
        endUserId: c.end_user_id || undefined,
        endUserName: c.end_user_name || undefined,
        unitId: c.unit_id || '',
        coordinatingUnitId: c.coordinating_unit_id || undefined,
        unitAllocations: c.unit_allocations?.allocations || undefined,
        // Map from DB 'employee_id' (new) or 'salesperson_id' (legacy)
        salespersonId: c.employee_id || c.salesperson_id || undefined,
        value: c.value || 0,
        estimatedCost: c.estimated_cost || 0,
        invoicedAmount: c.invoiced_amount || 0,
        actualCost: c.actual_cost || 0,
        status: c.status || 'Pending',
        stage: c.stage || 'Signed',
        category: c.category || 'Mới',
        signedDate: c.signed_date || '',
        startDate: c.start_date || '',
        endDate: c.end_date || '',
        content: c.content || '',
        contacts: c.contacts || [],
        milestones: c.milestones || [],
        paymentPhases: c.payment_phases || [],
        // Map details from JSONB
        lineItems: c.details?.lineItems || [],
        adminCosts: c.details?.adminCosts || undefined,
        revenueSchedules: c.details?.revenueSchedules || [],
        documents: c.documents || [],
        draft_url: c.draft_url || undefined,
        // Doanh thu: tính từ hoá đơn đã xuất (payments có status 'Đã xuất HĐ' hoặc 'Tiền về')
        actualRevenue: (() => {
            const payments: any[] = c.payments || [];
            const invoicedRevenue = payments
                .filter((p: any) => (p.payment_type === 'Revenue' || !p.payment_type) && ['Đã xuất HĐ', 'Tiền về', 'Paid'].includes(p.status))
                .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
            // Ưu tiên doanh thu từ hoá đơn, fallback về actual_revenue từ contract
            return invoicedRevenue > 0 ? invoicedRevenue : (c.actual_revenue || 0);
        })(),
        // Tiền về: chỉ tính payments đã nhận tiền thực tế
        cashReceived: (() => {
            const payments: any[] = c.payments || [];
            return payments
                .filter((p: any) => (p.payment_type === 'Revenue' || !p.payment_type) && ['Tiền về', 'Paid'].includes(p.status))
                .reduce((sum: number, p: any) => sum + (Number(p.paid_amount) || 0), 0);
        })(),
        // Parallel approval workflow fields
        legal_approved: c.legal_approved || false,
        finance_approved: c.finance_approved || false
    };
};

export const ContractService = {
    getAll: async (): Promise<Contract[]> => {
        const { data, error } = await supabase
            .from('contracts')
            .select('id, title, contract_type, party_a, party_b, customer_id, unit_id, value, status, stage, signed_date, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('ContractService.getAll:', error.message);
            throw new Error(ERROR_MESSAGES.FETCH_FAILED);
        }
        return data.map(mapContract);
    },

    getById: async (id: string): Promise<Contract | undefined> => {
        if (!id) return undefined;

        const { data: contractData, error: contractError } = await supabase
            .from('contracts')
            .select('*')
            .eq('id', id)
            .single();

        if (contractError) {
            if (contractError.code === 'PGRST116') return undefined; // Not found
            console.error('ContractService.getById:', contractError.message);
            return undefined;
        }

        const contract = mapContract(contractData);

        // 2. Fetch Payments to sync status (Optimization: Could be a Join or separate service call logic)
        // Keeping logic from original api.ts for consistency
        const { data: paymentsData } = await supabase.from('payments').select('phase_id, status, paid_amount').eq('contract_id', id);

        if (paymentsData && paymentsData.length > 0 && contract.paymentPhases) {
            contract.paymentPhases = contract.paymentPhases.map(phase => {
                const linkedPayment = paymentsData.find((p: any) => p.phase_id === phase.id);
                if (linkedPayment) {
                    let newStatus = phase.status;
                    if (linkedPayment.status === 'Tiền về' || linkedPayment.status === 'Paid') {
                        newStatus = 'Paid';
                    }
                    return { ...phase, status: newStatus as any };
                }
                return phase;
            });
        }

        return contract;
    },

    list: async (params: {
        page: number;
        limit: number;
        search?: string;
        status?: string;
        unitId?: string;
        year?: string;
        sortBy?: string;
        sortDir?: 'asc' | 'desc';
    }): Promise<{ data: Contract[]; count: number }> => {
        const { page, limit, search, status, unitId, year, sortBy, sortDir } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('contracts')
            .select('*, payments(amount, paid_amount, status, payment_type)', { count: 'exact' });

        // Apply filters
        if (search) {
            query = query.or(`title.ilike.%${search}%,id.ilike.%${search}%,party_a.ilike.%${search}%`);
        }
        if (status && status !== 'All') {
            query = query.eq('status', status);
        }
        if (unitId && unitId !== 'All' && unitId !== 'all') {
            // Support comma-separated unit IDs for cross-unit visibility
            if (unitId.includes(',')) {
                query = query.in('unit_id', unitId.split(',').map(id => id.trim()));
            } else {
                query = query.eq('unit_id', unitId);
            }
        }
        if (year && year !== 'All') {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            query = query.gte('signed_date', startDate).lte('signed_date', endDate);
        }

        // Sort mapping: frontend key → DB column
        const SORT_MAP: Record<string, string> = {
            id: 'id',
            signedDate: 'signed_date',
            value: 'value',
            actualRevenue: 'actual_revenue',
            estimatedCost: 'estimated_cost',
            status: 'status',
            title: 'title',
            partyA: 'party_a',
        };

        const dbSortColumn = sortBy ? SORT_MAP[sortBy] : null;
        if (dbSortColumn) {
            query = query.order(dbSortColumn, { ascending: sortDir === 'asc' });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        // Apply pagination
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        return {
            data: data.map(mapContract),
            count: count || 0
        };
    },

    // Optimized Search for Performance
    search: async (term: string, limit = 20): Promise<Contract[]> => {
        const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .or(`title.ilike.%${term}%,id.ilike.%${term}%,party_a.ilike.%${term}%`)
            .order('signed_date', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data.map(mapContract);
    },

    // New method for Server-Side Filtering (Replaces getAll().filter())
    getRelated: async (category: string, productName: string, limit = 20): Promise<Contract[]> => {
        let query = supabase.from('contracts').select('*').order('signed_date', { ascending: false }).limit(limit);

        // Simple heuristic: match category OR title contains product Name
        query = query.or(`category.eq.${category},title.ilike.%${productName}%`);

        const { data, error } = await query;
        if (error) throw error;
        return data.map(mapContract);
    },

    getStats: async (params: {
        search?: string;
        status?: string;
        unitId?: string;
        year?: string;
    }): Promise<{
        totalContracts: number,
        totalValue: number,
        totalRevenue: number,
        totalProfit: number,
        totalSigningProfit: number,
        totalRevenueProfit: number,
        totalCash: number
    }> => {
        const { search, status, unitId, year } = params;
        // Include payment status+type to calculate revenue from invoiced payments (same as getStatsFallback)
        let query = supabase.from('contracts').select('id, value, actual_revenue, estimated_cost, actual_cost, status, title, party_a, signed_date, unit_id, payments(amount, paid_amount, status, payment_type)');

        if (search) {
            query = query.or(`title.ilike.%${search}%,id.ilike.%${search}%,party_a.ilike.%${search}%`);
        }
        if (status && status !== 'All') {
            query = query.eq('status', status);
        }
        if (unitId && unitId !== 'All' && unitId !== 'all') {
            if (unitId.includes(',')) {
                query = query.in('unit_id', unitId.split(',').map(id => id.trim()));
            } else {
                query = query.eq('unit_id', unitId);
            }
        }
        if (year && year !== 'All') {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            query = query.gte('signed_date', startDate).lte('signed_date', endDate);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Calculate aggregates in JS — revenue computed from payments (not stale actual_revenue)
        return data.reduce((acc, curr: any) => {
            const val = curr.value || 0;
            const cost = curr.estimated_cost || 0;
            const actCost = curr.actual_cost || 0;

            // Revenue = sum of invoiced/paid payment amounts (same logic as getStatsFallback & mapContract)
            const revenuePayments: any[] = (curr.payments || []).filter(
                (p: any) => (!p.payment_type || p.payment_type === 'Revenue') &&
                    ['Đã xuất HĐ', 'Tiền về', 'Paid'].includes(p.status)
            );
            const rev = revenuePayments.length > 0
                ? revenuePayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
                : (curr.actual_revenue || 0); // Fallback to DB field if no matching payments

            // Cash = only payments with money received
            const cash = (curr.payments || []).filter(
                (p: any) => (!p.payment_type || p.payment_type === 'Revenue') &&
                    ['Tiền về', 'Paid'].includes(p.status)
            ).reduce((sum: number, p: any) => sum + (Number(p.paid_amount) || 0), 0);

            return {
                totalContracts: acc.totalContracts + 1,
                totalValue: acc.totalValue + val,
                totalRevenue: acc.totalRevenue + rev,
                totalProfit: acc.totalProfit + (val - cost), // Legacy
                totalSigningProfit: acc.totalSigningProfit + (val - cost),
                totalRevenueProfit: acc.totalRevenueProfit + (rev > 0 ? Math.round(rev - actCost) : 0),
                totalCash: acc.totalCash + cash
            };
        }, { totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0, totalSigningProfit: 0, totalRevenueProfit: 0, totalCash: 0 });
    },

    // OPTIMIZED RPC-BASED STATS with fallback
    getStatsRPC: async (unitId: string = 'all', year: string = 'all'): Promise<{
        totalContracts: number,
        totalValue: number,
        totalRevenue: number,
        totalProfit: number,
        totalSigningProfit: number,
        totalRevenueProfit: number,
        totalCash: number,
        activeCount: number,
        pendingCount: number
    }> => {
        const logPrefix = '[ContractService.getStatsRPC]';
        console.log(`${logPrefix} START (Forcing DIRECT QUERY)`, {
            unitId,
            year,
            typeUnit: typeof unitId,
            typeYear: typeof year
        });

        // FORCE FALLBACK - Bypass RPC due to timeout issues
        return ContractService.getStatsFallback(unitId, year);

        /* RPC DISABLED FOR DEBUGGING */
        /*
        try {
            // Create a timeout promise to prevent infinite hanging
            const timeoutMs = 5000;
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`RPC_TIMEOUT_5000MS`)), timeoutMs)
            );

            // Execute RPC
            const rpcPromise = supabase.rpc('get_contract_stats', {
                p_unit_id: String(unitId), // Ensure string to prevent object injection
                p_year: String(year)       // Ensure string
            });

            console.log(`${logPrefix} Awaiting RPC with 5s timeout...`);

            // Race against timeout
            const result: any = await Promise.race([rpcPromise, timeoutPromise]);
            const { data, error } = result;

            console.log(`${logPrefix} Raw response received:`, {
                hasData: !!data,
                errorMsg: error?.message,
                isArray: Array.isArray(data)
            });

            if (error) {
                console.warn(`${logPrefix} RPC Error:`, error.message);
                throw error; // Throw to trigger fallback
            }

            // Handle different data formats
            let statsRow = null;
            if (Array.isArray(data) && data.length > 0) {
                statsRow = data[0];
            } else if (data && typeof data === 'object' && !Array.isArray(data)) {
                statsRow = data;
            }

            if (statsRow) {
                const result = {
                    totalContracts: Number(statsRow.total_contracts || 0),
                    totalValue: Number(statsRow.total_value || 0),
                    totalRevenue: Number(statsRow.total_revenue || 0),
                    totalProfit: Number(statsRow.total_profit || 0),
                    activeCount: Number(statsRow.active_count || 0),
                    pendingCount: Number(statsRow.pending_count || 0)
                };
                console.log(`${logPrefix} Returning parsed stats:`, result);
                return result;
            }

            console.warn(`${logPrefix} Empty data returned`);
            throw new Error('EMPTY_DATA');

        } catch (err: any) {
            console.error(`${logPrefix} FAILED or TIMEOUT:`, err.message || err);
            console.log(`${logPrefix} Switching to FALLBACK QUERY`);
            return ContractService.getStatsFallback(unitId, year);
        }
        */
    },


    // FALLBACK for when RPC doesn't exist
    // Supports unit_allocations: when filtering by a specific unit, includes contracts
    // where the unit participates as a collaborative partner, applying % distribution.
    getStatsFallback: async (unitId: string = 'all', year: string = 'all'): Promise<{
        totalContracts: number,
        totalValue: number,
        totalRevenue: number,
        totalProfit: number, // Legacy
        totalSigningProfit: number,
        totalRevenueProfit: number,
        totalCash: number,
        activeCount: number,
        pendingCount: number
    }> => {
        console.log('[ContractService.getStatsFallback] Using direct query');
        // When filtering by unit, we need ALL contracts to check unit_allocations too
        // Include payment status+amount to calculate revenue from invoiced payments
        let query = supabase.from('contracts').select('id, value, actual_revenue, estimated_cost, actual_cost, status, unit_id, unit_allocations, payments(amount, paid_amount, status, payment_type)');

        // Only apply year filter at query level (unit filter is done in JS for allocation support)
        if (year && year !== 'All' && year !== 'all') {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            query = query.gte('signed_date', startDate).lte('signed_date', endDate);
        }

        const { data, error } = await query;
        if (error) {
            console.error('[ContractService.getStatsFallback] Query error:', error);
            return {
                totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0,
                totalSigningProfit: 0, totalRevenueProfit: 0, totalCash: 0,
                activeCount: 0, pendingCount: 0
            };
        }

        console.log('[ContractService.getStatsFallback] Got contracts:', data?.length);

        const isFilteringByUnit = unitId && unitId !== 'all';

        return (data || []).reduce((acc: any, curr: any) => {
            const val = curr.value || 0;
            const cost = curr.estimated_cost || 0;
            const actCost = curr.actual_cost || 0;
            // Revenue = sum of payments with status 'Đã xuất HĐ' or 'Tiền về' (recognized at invoice)
            const revenuePayments: any[] = (curr.payments || []).filter(
                (p: any) => (!p.payment_type || p.payment_type === 'Revenue') &&
                    ['Đã xuất HĐ', 'Tiền về', 'Paid'].includes(p.status)
            );
            const rev = revenuePayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
            const cash = (curr.payments || []).filter(
                (p: any) => (!p.payment_type || p.payment_type === 'Revenue') &&
                    ['Tiền về', 'Paid'].includes(p.status)
            ).reduce((sum: number, p: any) => sum + (Number(p.paid_amount) || 0), 0);

            // Determine this unit's share percentage (0-100)
            let sharePct = 100; // Default: 100% for "all" view or lead unit without allocations

            if (isFilteringByUnit) {
                const allocations: any[] = curr.unit_allocations?.allocations || [];
                const isLeadUnit = curr.unit_id === unitId;
                const supportAlloc = allocations.find((a: any) => a.unitId === unitId && a.role === 'support');

                if (isLeadUnit && allocations.length > 0) {
                    // Lead unit with allocations: gets the lead allocation percentage
                    const leadAlloc = allocations.find((a: any) => a.unitId === unitId && a.role === 'lead');
                    sharePct = leadAlloc ? (leadAlloc.percent || 100) : 100;
                } else if (supportAlloc) {
                    // Support unit: gets their declared percentage
                    sharePct = supportAlloc.percent || 0;
                } else if (!isLeadUnit) {
                    // Not the lead unit and not in allocations → skip this contract
                    sharePct = 0;
                }
                // isLeadUnit && no allocations → sharePct stays 100
            }

            if (sharePct === 0) return acc; // Skip contracts where unit has no share

            const fraction = sharePct / 100;

            return {
                totalContracts: acc.totalContracts + (sharePct > 0 ? 1 : 0),
                totalValue: acc.totalValue + val * fraction,
                totalRevenue: acc.totalRevenue + rev * fraction,
                totalProfit: acc.totalProfit + (val - cost) * fraction,
                totalSigningProfit: acc.totalSigningProfit + (val - cost) * fraction,
                totalRevenueProfit: acc.totalRevenueProfit + (rev > 0 ? Math.round((rev - actCost) * fraction) : 0),
                totalCash: acc.totalCash + cash * fraction,
                activeCount: acc.activeCount + (curr.status === 'Processing' || curr.status === 'Active' ? 1 : 0),
                pendingCount: acc.pendingCount + (curr.status === 'Pending' ? 1 : 0)
            };
        }, { totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0, totalSigningProfit: 0, totalRevenueProfit: 0, totalCash: 0, activeCount: 0, pendingCount: 0 });
    },

    getPaymentStatsRPC: async (contractId: string): Promise<{
        totalAmount: number,
        paidAmount: number,
        remainingAmount: number,
        overdueAmount: number
    }> => {
        const { data, error } = await supabase.rpc('get_payment_stats', {
            p_contract_id: contractId
        });

        if (error) {
            console.error('get_payment_stats RPC error:', error);
            return { totalAmount: 0, paidAmount: 0, remainingAmount: 0, overdueAmount: 0 };
        }

        if (data && data.length > 0) {
            return {
                totalAmount: Number(data[0].total_amount),
                paidAmount: Number(data[0].paid_amount),
                remainingAmount: Number(data[0].remaining_amount),
                overdueAmount: Number(data[0].overdue_amount)
            };
        }
        return { totalAmount: 0, paidAmount: 0, remainingAmount: 0, overdueAmount: 0 };
    },

    getChartDataRPC: async (unitId: string = 'all', year: string = 'all'): Promise<Array<{ month: number, revenue: number, profit: number, signing: number }>> => {
        const logPrefix = '[ContractService.getChartDataRPC]';
        console.log(`${logPrefix} START (Forcing DIRECT QUERY)`, { unitId, year });

        // FORCE FALLBACK - Bypass RPC
        return ContractService.getChartDataFallback(unitId, year);

        /* RPC DISABLED FOR DEBUGGING */
        /*
        try {
            // Create a timeout promise to prevent infinite hanging
            const timeoutMs = 5000;
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`RPC_TIMEOUT_5000MS`)), timeoutMs)
            );

            const rpcPromise = supabase.rpc('get_dashboard_chart_data', {
                p_unit_id: String(unitId),
                p_year: String(year)
            });

            console.log(`${logPrefix} Awaiting RPC with 5s timeout...`);
            const result: any = await Promise.race([rpcPromise, timeoutPromise]);
            const { data, error } = result;

            if (error) {
                console.warn(`${logPrefix} RPC failed:`, error.message);
                throw error;
            }

            return (data || []).map((d: any) => ({
                month: Number(d.month),
                revenue: Number(d.revenue),
                profit: Number(d.profit),
                signing: Number(d.signing)
            }));

        } catch (err: any) {
            console.error(`${logPrefix} FAILED or TIMEOUT:`, err.message);
            console.log(`${logPrefix} Switching to FALLBACK`);
            return ContractService.getChartDataFallback(unitId, year);
        }
        */
    },

    // FALLBACK for chart data (with unit_allocations support)
    getChartDataFallback: async (unitId: string = 'all', year: string = 'all'): Promise<Array<{ month: number, revenue: number, profit: number, signing: number }>> => {
        console.log('[ContractService.getChartDataFallback] Using direct query');
        // Fetch all contracts with unit_allocations for allocation-aware filtering
        let query = supabase.from('contracts').select('signed_date, value, actual_revenue, estimated_cost, unit_id, unit_allocations');

        // Only apply year filter at query level (unit filter is done in JS)
        if (year && year !== 'All' && year !== 'all') {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            query = query.gte('signed_date', startDate).lte('signed_date', endDate);
        }

        const { data, error } = await query;
        if (error) {
            console.error('[ContractService.getChartDataFallback] Query error:', error);
            return [];
        }

        const isFilteringByUnit = unitId && unitId !== 'all';

        // Aggregate by month
        const monthlyData: Record<number, { revenue: number, profit: number, signing: number }> = {};
        for (let m = 1; m <= 12; m++) {
            monthlyData[m] = { revenue: 0, profit: 0, signing: 0 };
        }

        (data || []).forEach((c: any) => {
            if (!c.signed_date) return;

            // Determine unit share percentage
            let sharePct = 100;
            if (isFilteringByUnit) {
                const allocations: any[] = c.unit_allocations?.allocations || [];
                const isLeadUnit = c.unit_id === unitId;
                const supportAlloc = allocations.find((a: any) => a.unitId === unitId && a.role === 'support');

                if (isLeadUnit && allocations.length > 0) {
                    const leadAlloc = allocations.find((a: any) => a.unitId === unitId && a.role === 'lead');
                    sharePct = leadAlloc ? (leadAlloc.percent || 100) : 100;
                } else if (supportAlloc) {
                    sharePct = supportAlloc.percent || 0;
                } else if (!isLeadUnit) {
                    sharePct = 0;
                }
            }

            if (sharePct === 0) return;

            const fraction = sharePct / 100;
            const month = new Date(c.signed_date).getMonth() + 1;
            if (monthlyData[month]) {
                monthlyData[month].signing += (c.value || 0) * fraction;
                monthlyData[month].revenue += (c.actual_revenue || 0) * fraction;
                monthlyData[month].profit += ((c.value || 0) - (c.estimated_cost || 0)) * fraction;
            }
        });

        return Object.entries(monthlyData).map(([month, vals]) => ({
            month: Number(month),
            ...vals
        }));
    },

    getByUnitId: async (unitId: string): Promise<Contract[]> => {
        let query = supabase.from('contracts').select('*');
        if (unitId !== 'all') {
            query = query.eq('unit_id', unitId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data.map(mapContract);
    },

    getByCustomerId: async (customerId: string): Promise<Contract[]> => {
        const { data, error } = await supabase.from('contracts').select('*').eq('customer_id', customerId);
        if (error) throw error;
        return data.map(mapContract);
    },

    getBySalespersonId: async (salespersonId: string): Promise<Contract[]> => {
        const { data, error } = await supabase.from('contracts').select('*').eq('salesperson_id', salespersonId);
        if (error) throw error;
        return data.map(mapContract);
    },

    getByEmployeeId: async (employeeId: string): Promise<Contract[]> => {
        // Handle migration period where column might be salesperson_id or employee_id
        // Try precise match first
        const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .or(`salesperson_id.eq.${employeeId},employee_id.eq.${employeeId}`);

        if (error) throw error;
        return data.map(mapContract);
    },

    /**
     * CREATE - Professional implementation with validation, retry, and audit
     */
    create: async (data: Contract): Promise<Contract> => {
        // 1. Validate input
        const errors = validateContract(data, true);
        if (errors.length > 0) {
            throw new Error(`${ERROR_MESSAGES.VALIDATION_ERROR}\n${errors.join('\n')}`);
        }

        // 2. Build type-safe payload
        const payload = buildPayload(data);

        // 3. Execute with retry logic
        const result = await withRetry(async () => {
            const { data: res, error } = await supabase
                .from('contracts')
                .insert(payload)
                .select()
                .single();

            if (error) {
                // Handle specific error codes
                if (error.code === '23505') {
                    throw new Error(ERROR_MESSAGES.DUPLICATE_ID);
                }
                if (error.code === '42501') {
                    throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
                }
                console.error('ContractService.create:', error.message);
                throw new Error(ERROR_MESSAGES.CREATE_FAILED);
            }

            return res;
        });

        // 4. Auto-create Business Plan (PAKD) for Workflow
        try {
            const financials = {
                revenue: data.value || 0,
                costs: data.estimatedCost || 0,
                grossProfit: (data.value || 0) - (data.estimatedCost || 0),
                margin: data.value ? (((data.value - data.estimatedCost) / data.value) * 100) : 0,
                cashflow: data.paymentPhases || []
            };

            const user = (await supabase.auth.getUser()).data.user;

            await supabase.from('contract_business_plans').insert({
                contract_id: result.id,
                version: 1,
                status: 'Approved', // Auto-approved - PAKD workflow temporarily disabled
                financials: financials,
                is_active: true,
                created_by: user?.id
            });
        } catch (planError) {
            console.warn("[ContractService.create] Failed to auto-create PAKD:", planError);
        }

        // 5. Log audit
        await logOperation('CREATE', result.id);

        return mapContract(result);
    },

    /**
     * UPDATE - Professional implementation with partial update support
     */
    update: async (id: string, data: Partial<Contract>): Promise<Contract | undefined> => {
        // 1. Validate
        if (!id) throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);

        const errors = validateContract(data, false);
        if (errors.length > 0) {
            throw new Error(`${ERROR_MESSAGES.VALIDATION_ERROR}\n${errors.join('\n')}`);
        }

        // 2. Build payload (excluding id)
        const payload = buildPayload(data);
        delete payload.id; // Don't update the primary key

        if (Object.keys(payload).length === 0) {
            console.warn('[ContractService.update] No fields to update');
            return await ContractService.getById(id);
        }

        // 3. Execute with retry
        const result = await withRetry(async () => {
            const { data: res, error } = await supabase
                .from('contracts')
                .update(payload)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new Error(ERROR_MESSAGES.NOT_FOUND);
                }
                if (error.code === '42501') {
                    throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
                }
                console.error('ContractService.update:', error.message);
                throw new Error(ERROR_MESSAGES.UPDATE_FAILED);
            }

            return res;
        });

        // 4. Log audit
        await logOperation('UPDATE', id, payload);

        return mapContract(result);
    },

    /**
     * DELETE - Professional implementation with confirmation
     */
    delete: async (id: string): Promise<boolean> => {
        if (!id?.trim()) {
            throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
        }

        // Execute with retry
        await withRetry(async () => {
            const { error } = await supabase
                .from('contracts')
                .delete()
                .eq('id', id);

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new Error(ERROR_MESSAGES.NOT_FOUND);
                }
                if (error.code === '42501') {
                    throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
                }
                console.error('ContractService.delete:', error.message);
                throw new Error(ERROR_MESSAGES.DELETE_FAILED);
            }
        });

        // Log audit
        await logOperation('DELETE', id);

        return true;
    },

    /**
     * BATCH DELETE - Delete multiple contracts at once
     */
    batchDelete: async (ids: string[]): Promise<{ success: string[], failed: string[] }> => {
        const results = { success: [] as string[], failed: [] as string[] };

        for (const id of ids) {
            try {
                await ContractService.delete(id);
                results.success.push(id);
            } catch (error) {
                console.error(`Failed to delete contract ${id}:`, error);
                results.failed.push(id);
            }
        }

        return results;
    },

    /**
     * CHECK EXISTS - Verify if a contract ID already exists
     */
    exists: async (id: string): Promise<boolean> => {
        const { count, error } = await supabase
            .from('contracts')
            .select('*', { count: 'exact', head: true })
            .eq('id', id);

        if (error) {
            console.error('ContractService.exists:', error.message);
            return false;
        }

        return (count || 0) > 0;
    },

    /**
     * GET NEXT CONTRACT NUMBER - Auto-generate sequential ID
     */
    getNextContractNumber: async (unitId: string, year: number): Promise<number> => {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        const { count, error } = await supabase
            .from('contracts')
            .select('*', { count: 'exact', head: true })
            .eq('unit_id', unitId)
            .gte('signed_date', startDate)
            .lte('signed_date', endDate);

        if (error) {
            console.error("Error getting contract count:", error);
            return 1;
        }

        return (count || 0) + 1;
    },

    /**
     * DUPLICATE - Clone an existing contract with new ID
     */
    duplicate: async (sourceId: string, newId: string): Promise<Contract> => {
        // 1. Fetch source contract
        const source = await ContractService.getById(sourceId);
        if (!source) {
            throw new Error(ERROR_MESSAGES.NOT_FOUND);
        }

        // 2. Check if new ID exists
        if (await ContractService.exists(newId)) {
            throw new Error(ERROR_MESSAGES.DUPLICATE_ID);
        }

        // 3. Create clone with new ID and reset status
        const clone: Contract = {
            ...source,
            id: newId,
            status: 'Pending',
            stage: 'Signed',
            actualRevenue: 0,
            actualCost: 0,
            invoicedAmount: 0,
        };

        return await ContractService.create(clone);
    }
};

