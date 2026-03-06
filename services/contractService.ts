import { dataClient as supabase } from '../lib/dataClient';
import { Contract, ExecutionCostItem } from '../types';
import { AuditLogService } from './auditLogService';
import { TelegramNotificationService } from './telegramNotificationService';

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
        customerContractNumber: 'customer_contract_number',
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
    if (data.lineItems !== undefined || data.adminCosts !== undefined || data.executionCosts !== undefined || (data as any).revenueSchedules !== undefined) {
        payload.details = {
            lineItems: data.lineItems || [],
            adminCosts: data.executionCosts?.length ? undefined : (data.adminCosts || {}),
            executionCosts: data.executionCosts || [],
            revenueSchedules: (data as any).revenueSchedules || []
        };

        // Sync estimated_cost from executionCosts so dashboard aggregates stay fresh
        if (data.executionCosts) {
            const execSum = (data.executionCosts as ExecutionCostItem[]).reduce(
                (sum, c) => sum + (c.amount || 0), 0
            );
            const inputSum = (data.lineItems || []).reduce(
                (sum: number, li: any) => sum + (li.inputPrice || 0) * (li.quantity || 1) + (li.directCosts || 0), 0
            );
            payload.estimated_cost = inputSum + execSum;
        }
    }

    // Handle unitAllocations JSONB field (QĐ 09.2024)
    if ((data as any).unitAllocations !== undefined) {
        payload.unit_allocations = (data as any).unitAllocations
            ? { allocations: (data as any).unitAllocations }
            : null;
    }

    // Handle employeeAllocations JSONB field
    if ((data as any).employeeAllocations !== undefined) {
        payload.employee_allocations = (data as any).employeeAllocations
            ? (data as any).employeeAllocations
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
        const userId = user?.id || null;
        console.log(`[Audit] ${action} contract ${contractId} by ${user?.email || 'unknown'}`, changes || {});

        await AuditLogService.create({
            user_id: userId,
            table_name: 'contracts',
            record_id: contractId,
            action: action,
            old_data: changes?.oldData || null,
            new_data: changes || null, // Assuming payload is new_data
            comment: null
        });
    } catch (e) {
        console.warn('[Audit] Failed to log operation:', e);
    }
};

// ============================================================================
// SHARED FINANCIAL CALCULATORS (Pure functions — reusable across service)
// ============================================================================

/**
 * Case-insensitive check for "All" / "all" / "ALL" filter values.
 */
const isAll = (value: string | undefined | null): boolean =>
    !value || value.toLowerCase() === 'all';

/**
 * Calculate a unit's share percentage from a contract's unit_allocations.
 * Eliminates 4x duplicated allocation logic across getStats, getStatsFallback,
 * list (allocation-aware mode), and getChartDataFallback.
 * @returns 0-100 percentage. 0 means "skip this contract for this unit".
 */
export const getUnitSharePct = (
    contract: { unit_id?: string; unit_allocations?: { allocations?: any[] } },
    targetUnitId: string
): number => {
    const allocations: any[] = contract.unit_allocations?.allocations || [];
    const isLeadUnit = contract.unit_id === targetUnitId;
    const supportAlloc = allocations.find(
        (a: any) => a.unitId === targetUnitId && a.role === 'support'
    );

    if (isLeadUnit && allocations.length > 0) {
        const leadAlloc = allocations.find(
            (a: any) => a.unitId === targetUnitId && a.role === 'lead'
        );
        return leadAlloc ? (leadAlloc.percent || 100) : 100;
    } else if (isLeadUnit) {
        return 100; // Lead unit, no allocations → full share
    } else if (supportAlloc) {
        return supportAlloc.percent || 0;
    }
    return 0; // Not associated with this unit
};

/**
 * Calculate revenue from payments, excluding VAT.
 * Only counts payments with status 'Đã xuất HĐ', 'Tiền về', 'Paid'.
 * Falls back to DB actual_revenue ONLY when no payments exist at all.
 */
export const calculateRevenueFromPayments = (
    payments: any[],
    vatRate: number = 10,
    hasVat: boolean = true,
    fallbackRevenue: number = 0
): number => {
    // Only use fallback when there are truly no payment records
    if (!payments || payments.length === 0) return fallbackRevenue;

    const vatDivisor = hasVat && vatRate > 0 ? (1 + vatRate / 100) : 1;
    const revenuePayments = payments.filter(
        (p: any) => (!p.payment_type || p.payment_type === 'Revenue') &&
            ['Đã xuất HĐ', 'Tiền về', 'Paid'].includes(p.status)
    );
    const invoicedGross = revenuePayments.reduce(
        (sum: number, p: any) => sum + (Number(p.amount) || 0), 0
    );
    return Math.round(invoicedGross / vatDivisor);
};

/**
 * Calculate invoiced amount from payments (payments with HĐ issued).
 * Only counts payments with status 'Đã xuất HĐ', 'Tiền về', 'Paid'.
 */
export const calculateInvoicedFromPayments = (payments: any[]): number => {
    if (!payments || payments.length === 0) return 0;
    return payments
        .filter((p: any) => (!p.payment_type || p.payment_type === 'Revenue') &&
            ['Đã xuất HĐ', 'Tiền về', 'Paid'].includes(p.status))
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
};

/**
 * Calculate cash received from payments (only money actually in bank).
 */
export const calculateCashReceived = (payments: any[]): number => {
    return payments
        .filter((p: any) => (!p.payment_type || p.payment_type === 'Revenue') &&
            ['Tạm ứng', 'Tiền về', 'Paid'].includes(p.status))
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
};

/**
 * Calculate advance (Tạm ứng) amount — cash received without invoice.
 */
export const calculateAdvanceAmount = (payments: any[]): number => {
    return payments
        .filter((p: any) => (!p.payment_type || p.payment_type === 'Revenue') &&
            p.status === 'Tạm ứng')
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
};

// Helper to map DB Contract to Frontend Contract
const mapContract = (c: any): Contract => {
    if (!c) return {
        id: 'unknown',
        title: 'Unknown Contract',
        contractType: 'HĐ',
        status: 'Processing',
        stage: 'Signed',
        value: 0
    } as any; // Partial fallback

    const payments: any[] = c.payments || [];

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
        customerContractNumber: c.customer_contract_number || undefined,
        unitId: c.unit_id || '',
        coordinatingUnitId: c.coordinating_unit_id || undefined,
        unitAllocations: c.unit_allocations?.allocations || undefined,
        employeeAllocations: c.employee_allocations || undefined,
        // Map from DB 'employee_id' (new) or 'salesperson_id' (legacy)
        salespersonId: c.employee_id || c.salesperson_id || undefined,
        value: c.value || 0,
        estimatedCost: c.estimated_cost || 0,
        actualCost: c.actual_cost || 0,
        status: c.status || 'Processing',
        stage: c.stage || 'Signed',
        category: c.category || 'Mới',
        signedDate: c.signed_date || '',
        startDate: c.start_date || '',
        endDate: c.end_date || '',
        content: c.content || '',
        contacts: c.contacts || [],
        milestones: c.milestones || [],
        paymentPhases: c.payment_phases || [],
        // Map details from JSONB (single source of truth)
        lineItems: c.details?.lineItems || c.line_items || [],
        adminCosts: c.details?.adminCosts || undefined,
        executionCosts: c.details?.executionCosts || c.execution_costs || [],
        revenueSchedules: c.details?.revenueSchedules || [],
        documents: c.documents || [],
        draft_url: c.draft_url || undefined,
        // Revenue & Cash — calculated from payments using shared pure functions
        actualRevenue: calculateRevenueFromPayments(
            payments, c.vat_rate ?? 10, c.has_vat !== false, c.actual_revenue || 0
        ),
        // Invoiced: prefer calculated from payments over stale DB column
        invoicedAmount: payments.length > 0
            ? calculateInvoicedFromPayments(payments)
            : (c.invoiced_amount || 0),
        cashReceived: calculateCashReceived(payments),
        advanceAmount: calculateAdvanceAmount(payments),
        // Parallel approval workflow fields
        legal_approved: c.legal_approved || false,
        finance_approved: c.finance_approved || false
    };
};

export const ContractService = {
    /**
     * Find contract by title (Số HĐ) — for upsert logic
     */
    findByTitle: async (title: string): Promise<Contract | null> => {
        if (!title || title.trim().length < 3) return null;
        const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .eq('title', title.trim())
            .limit(1)
            .maybeSingle();
        if (error || !data) return null;
        return mapContract(data);
    },

    getAll: async (): Promise<Contract[]> => {
        const { data, error } = await supabase
            .from('contracts')
            .select('*')
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
            .select('*, payments(amount, paid_amount, status, payment_type, phase_id)')
            .eq('id', id)
            .single();

        if (contractError) {
            if (contractError.code === 'PGRST116') return undefined; // Not found
            console.error('ContractService.getById:', contractError.message);
            return undefined;
        }

        const contract = mapContract(contractData);

        // Sync payment phase statuses from actual payments
        const paymentsData: any[] = contractData?.payments || [];

        if (paymentsData.length > 0 && contract.paymentPhases) {
            contract.paymentPhases = contract.paymentPhases.map(phase => {
                const linkedPayment = paymentsData.find((p: any) => p.phase_id === phase.id);
                if (linkedPayment) {
                    let newStatus = phase.status;
                    if (linkedPayment.status === 'Tiền về' || linkedPayment.status === 'Paid') {
                        newStatus = 'Paid';
                    } else if (linkedPayment.status === 'Tạm ứng') {
                        newStatus = 'Advance';
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
        salespersonId?: string;
        sortBy?: string;
        sortDir?: 'asc' | 'desc';
    }): Promise<{ data: Contract[]; count: number }> => {
        const { page, limit, search, status, unitId, year, salespersonId, sortBy, sortDir } = params;

        // Determine if we need allocation-aware filtering (single unit, not 'All' or comma-separated)
        const isSingleUnitFilter = !isAll(unitId) && !unitId!.includes(',');

        if (isSingleUnitFilter) {
            // === ALLOCATION-AWARE MODE ===
            // Fetch ALL contracts (no unit_id filter) to find collaborative contracts
            let query = supabase
                .from('contracts')
                .select('*, payments(amount, paid_amount, status, payment_type)');

            if (search) {
                query = query.or(`title.ilike.%${search}%,id.ilike.%${search}%,party_a.ilike.%${search}%,customer_contract_number.ilike.%${search}%,content.ilike.%${search}%,end_user_name.ilike.%${search}%,category.ilike.%${search}%`);
            }
            if (status && status !== 'All') {
                query = query.eq('status', status);
            }
            if (year && year !== 'All') {
                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;
                query = query.gte('signed_date', startDate).lte('signed_date', endDate);
            }
            if (salespersonId) {
                query = query.eq('employee_id', salespersonId);
            }

            // Sort mapping
            const SORT_MAP: Record<string, string> = {
                id: 'id', signedDate: 'signed_date', value: 'value',
                actualRevenue: 'actual_revenue', estimatedCost: 'estimated_cost',
                status: 'status', title: 'title', partyA: 'party_a',
            };
            const dbSortColumn = sortBy ? SORT_MAP[sortBy] : null;
            if (dbSortColumn) {
                query = query.order(dbSortColumn, { ascending: sortDir === 'asc' });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query;
            if (error) throw error;

            // Filter in JS: include contracts where this unit is lead or support
            const filteredContracts: Contract[] = [];
            (data || []).forEach((c: any) => {
                const allocationPct = getUnitSharePct(c, unitId!);
                if (allocationPct === 0) return;

                const isLeadUnit = c.unit_id === unitId;
                const allocationRole = isLeadUnit ? 'lead' : 'support';

                const mapped = mapContract(c);
                // Tag with allocation info for UI display
                (mapped as any)._allocationRole = allocationRole;
                (mapped as any)._allocationPct = allocationPct;
                filteredContracts.push(mapped);
            });

            // Apply JS-level pagination
            const totalCount = filteredContracts.length;
            const from = (page - 1) * limit;
            const pageData = filteredContracts.slice(from, from + limit);

            return { data: pageData, count: totalCount };

        } else {
            // === STANDARD MODE (All units or comma-separated) ===
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            let query = supabase
                .from('contracts')
                .select('*, payments(amount, paid_amount, status, payment_type)', { count: 'exact' });

            if (search) {
                query = query.or(`title.ilike.%${search}%,id.ilike.%${search}%,party_a.ilike.%${search}%,customer_contract_number.ilike.%${search}%,content.ilike.%${search}%,end_user_name.ilike.%${search}%,category.ilike.%${search}%`);
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
            if (salespersonId) {
                query = query.eq('employee_id', salespersonId);
            }

            const SORT_MAP: Record<string, string> = {
                id: 'id', signedDate: 'signed_date', value: 'value',
                actualRevenue: 'actual_revenue', estimatedCost: 'estimated_cost',
                status: 'status', title: 'title', partyA: 'party_a',
            };
            const dbSortColumn = sortBy ? SORT_MAP[sortBy] : null;
            if (dbSortColumn) {
                query = query.order(dbSortColumn, { ascending: sortDir === 'asc' });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            query = query.range(from, to);

            const { data, error, count } = await query;
            if (error) throw error;

            return {
                data: data.map(mapContract),
                count: count || 0
            };
        }
    },

    // Optimized Search for Performance
    search: async (term: string, limit = 20): Promise<Contract[]> => {
        // Sanitize search term to prevent injection
        const safeTerm = term.replace(/[%_\\]/g, '\\$&');
        const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .or(`title.ilike.%${safeTerm}%,id.ilike.%${safeTerm}%,party_a.ilike.%${safeTerm}%,customer_contract_number.ilike.%${safeTerm}%,content.ilike.%${safeTerm}%,end_user_name.ilike.%${safeTerm}%,category.ilike.%${safeTerm}%`)
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
        salespersonId?: string;
    }): Promise<{
        totalContracts: number,
        totalValue: number,
        totalRevenue: number,
        totalProfit: number,
        totalSigningProfit: number,
        totalRevenueProfit: number,
        totalCash: number,
        processingCount: number,
        suspendedCount: number,
        overdueAdvanceCount: number,
        handoverCount: number,
        acceptanceCount: number,
        overduePaymentCount: number,
        completedCount: number
    }> => {
        const { search, status, unitId, year, salespersonId } = params;
        // Fetch ALL contracts with unit_allocations for allocation-aware filtering
        // Unit filter is done in JS to support contracts where the unit is a collaborative partner
        let query = supabase.from('contracts').select('id, value, actual_revenue, estimated_cost, actual_cost, status, title, party_a, signed_date, unit_id, unit_allocations, vat_rate, has_vat, payments(amount, paid_amount, status, payment_type)');

        if (search) {
            query = query.or(`title.ilike.%${search}%,id.ilike.%${search}%,party_a.ilike.%${search}%,customer_contract_number.ilike.%${search}%,content.ilike.%${search}%,end_user_name.ilike.%${search}%,category.ilike.%${search}%`);
        }
        if (status && status !== 'All') {
            query = query.eq('status', status);
        }
        // NOTE: Unit filter is NOT applied at SQL level — done in JS below for allocation support
        if (year && year !== 'All') {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            query = query.gte('signed_date', startDate).lte('signed_date', endDate);
        }
        if (salespersonId) {
            query = query.eq('employee_id', salespersonId);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Also fetch status counts WITHOUT status filter for accurate status card display
        let statusCountQuery = supabase.from('contracts').select('id, status, unit_id, unit_allocations, signed_date');
        if (search) {
            statusCountQuery = statusCountQuery.or(`title.ilike.%${search}%,id.ilike.%${search}%,party_a.ilike.%${search}%,customer_contract_number.ilike.%${search}%,content.ilike.%${search}%,end_user_name.ilike.%${search}%,category.ilike.%${search}%`);
        }
        if (year && year !== 'All') {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            statusCountQuery = statusCountQuery.gte('signed_date', startDate).lte('signed_date', endDate);
        }
        if (salespersonId) {
            statusCountQuery = statusCountQuery.eq('employee_id', salespersonId);
        }
        const { data: statusData } = await statusCountQuery;

        // Determine if filtering by specific unit(s)
        const isFilteringByUnit = !isAll(unitId);
        const unitIds = isFilteringByUnit && unitId!.includes(',')
            ? unitId!.split(',').map(id => id.trim())
            : isFilteringByUnit ? [unitId!] : [];

        // Count statuses from unfiltered data (but respecting unit filter)
        const statusCounts = { processingCount: 0, suspendedCount: 0, overdueAdvanceCount: 0, handoverCount: 0, acceptanceCount: 0, overduePaymentCount: 0, completedCount: 0 };
        (statusData || []).forEach((c: any) => {
            if (isFilteringByUnit) {
                let matchedPct = 0;
                for (const targetUnitId of unitIds) {
                    matchedPct = Math.max(matchedPct, getUnitSharePct(c, targetUnitId));
                }
                if (matchedPct === 0) return;
            }
            if (c.status === 'Processing') statusCounts.processingCount++;
            else if (c.status === 'Suspended') statusCounts.suspendedCount++;
            else if (c.status === 'Overdue_Advance') statusCounts.overdueAdvanceCount++;
            else if (c.status === 'Handover') statusCounts.handoverCount++;
            else if (c.status === 'Acceptance' || c.status === 'Liquidated') statusCounts.acceptanceCount++;
            else if (c.status === 'Overdue_Payment') statusCounts.overduePaymentCount++;
            else if (c.status === 'Completed') statusCounts.completedCount++;
        });

        // Calculate aggregates in JS — with unit_allocations support (same as getStatsFallback)
        const financials = (data || []).reduce((acc, curr: any) => {
            const val = curr.value || 0;
            const cost = curr.estimated_cost || 0;
            const actCost = curr.actual_cost || 0;

            // Revenue and Cash calculations using shared pure functions
            const rev = calculateRevenueFromPayments(curr.payments || [], curr.vat_rate ?? 10, curr.has_vat !== false, curr.actual_revenue || 0);
            const cash = calculateCashReceived(curr.payments || []);

            // Determine this unit's share percentage using shared helper
            let sharePct = 100; // Default: 100% for "all" view

            if (isFilteringByUnit) {
                let matchedPct = 0;
                for (const targetUnitId of unitIds) {
                    matchedPct = Math.max(matchedPct, getUnitSharePct(curr, targetUnitId));
                }
                sharePct = matchedPct;
            }

            if (sharePct === 0) return acc; // Skip contracts where unit has no share

            const fraction = sharePct / 100;

            return {
                totalContracts: acc.totalContracts + 1,
                totalValue: acc.totalValue + val * fraction,
                totalRevenue: acc.totalRevenue + rev * fraction,
                totalProfit: acc.totalProfit + (val - cost) * fraction,
                totalSigningProfit: acc.totalSigningProfit + (val - cost) * fraction,
                totalRevenueProfit: acc.totalRevenueProfit + (rev > 0 ? Math.round((rev - actCost) * fraction) : 0),
                totalCash: acc.totalCash + cash * fraction
            };
        }, { totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0, totalSigningProfit: 0, totalRevenueProfit: 0, totalCash: 0 });

        return { ...financials, ...statusCounts };
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

    },


    getStatsFallback: async (unitId: string = 'all', year: string = 'all'): Promise<{
        totalContracts: number,
        totalValue: number,
        totalRevenue: number,
        totalProfit: number,
        totalSigningProfit: number,
        totalRevenueProfit: number,
        totalCash: number,
        activeCount: number,
        pendingCount: number,
        completedCount: number,
        expiredCount: number,
        processingCount: number,
        acceptanceCount: number,
        liquidatedCount: number,
        suspendedCount: number,
        overdueAdvanceCount: number,
        handoverCount: number,
        overduePaymentCount: number
    }> => {
        console.log('[ContractService.getStatsFallback] Using direct query');
        // When filtering by unit, we need ALL contracts to check unit_allocations too
        // Include payment status+amount to calculate revenue from invoiced payments
        let query = supabase.from('contracts').select('id, value, actual_revenue, estimated_cost, actual_cost, status, unit_id, unit_allocations, vat_rate, has_vat, end_date, payments(amount, paid_amount, status, payment_type)');

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
                activeCount: 0, pendingCount: 0, completedCount: 0, expiredCount: 0,
                processingCount: 0, acceptanceCount: 0, liquidatedCount: 0, suspendedCount: 0,
                overdueAdvanceCount: 0, handoverCount: 0, overduePaymentCount: 0
            };
        }

        console.log('[ContractService.getStatsFallback] Got contracts:', data?.length);

        const isFilteringByUnit = !isAll(unitId);

        return (data || []).reduce((acc: any, curr: any) => {
            const val = curr.value || 0;
            const cost = curr.estimated_cost || 0;
            const actCost = curr.actual_cost || 0;

            // Revenue and Cash calculations using shared pure functions
            const rev = calculateRevenueFromPayments(curr.payments || [], curr.vat_rate ?? 10, curr.has_vat !== false, curr.actual_revenue || 0);
            const cash = calculateCashReceived(curr.payments || []);

            // Determine this unit's share percentage using shared helper
            let sharePct = 100;

            if (isFilteringByUnit) {
                sharePct = getUnitSharePct(curr, unitId);
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
                activeCount: acc.activeCount + (['Processing', 'Acceptance', 'Handover'].includes(curr.status) ? 1 : 0),
                pendingCount: acc.pendingCount + (curr.status === 'Pending' ? 1 : 0),
                suspendedCount: acc.suspendedCount + (curr.status === 'Suspended' ? 1 : 0),
                completedCount: acc.completedCount + (curr.status === 'Completed' ? 1 : 0),
                liquidatedCount: acc.liquidatedCount + (curr.status === 'Liquidated' ? 1 : 0),
                acceptanceCount: acc.acceptanceCount + (['Acceptance', 'Liquidated'].includes(curr.status) ? 1 : 0),
                processingCount: acc.processingCount + (curr.status === 'Processing' ? 1 : 0),
                overdueAdvanceCount: acc.overdueAdvanceCount + (curr.status === 'Overdue_Advance' ? 1 : 0),
                handoverCount: acc.handoverCount + (curr.status === 'Handover' ? 1 : 0),
                overduePaymentCount: acc.overduePaymentCount + (curr.status === 'Overdue_Payment' ? 1 : 0),
                expiredCount: acc.expiredCount + (
                    ['Processing', 'Acceptance'].includes(curr.status) && curr.end_date && new Date(curr.end_date) < new Date() ? 1 : 0
                )
            };
        }, { totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0, totalSigningProfit: 0, totalRevenueProfit: 0, totalCash: 0, activeCount: 0, pendingCount: 0, completedCount: 0, expiredCount: 0, processingCount: 0, acceptanceCount: 0, liquidatedCount: 0, suspendedCount: 0, overdueAdvanceCount: 0, handoverCount: 0, overduePaymentCount: 0 });
    },

    /**
     * Auto-transition logic — runs on Dashboard load.
     * Checks 3 rules:
     * 1. Overdue_Advance: Kế hoạch tiền về có mục "Tạm ứng" đã quá hạn mà chưa nhận tiền
     * 2. Overdue_Payment: Đã xuất HĐ VAT, quá hạn thanh toán (due_date), tiền về < doanh thu xuất HĐ
     * 3. Completed: Tổng tiền về >= giá trị ký kết
     */
    checkAutoStatusTransitions: async (): Promise<{ updated: number; details: string[] }> => {
        const logPrefix = '[AutoStatus]';
        console.log(`${logPrefix} Checking auto status transitions...`);
        const details: string[] = [];
        let updated = 0;
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        try {
            // Fetch active contracts with payments and payment_schedules
            const { data: contracts, error } = await supabase
                .from('contracts')
                .select('id, value, status, payment_schedules, payments(amount, paid_amount, status, payment_type, due_date)')
                .in('status', ['Processing', 'Handover', 'Acceptance', 'Overdue_Advance', 'Overdue_Payment']);

            if (error || !contracts) {
                console.error(`${logPrefix} Query error:`, error);
                return { updated: 0, details: ['Query error'] };
            }

            for (const contract of contracts) {
                const contractValue = contract.value || 0;
                const payments = contract.payments || [];
                const totalCash = calculateCashReceived(payments);
                const totalInvoiced = calculateInvoicedFromPayments(payments);
                const paymentSchedules = (contract.payment_schedules as any)?.schedules || contract.payment_schedules || [];

                let newStatus: string | null = null;

                // Rule 1: Completed — tiền về >= giá trị ký kết
                if (contractValue > 0 && totalCash >= contractValue && contract.status !== 'Completed') {
                    newStatus = 'Completed';
                    details.push(`${contract.id}: → Hoàn thành (tiền về ${totalCash} >= giá trị ${contractValue})`);
                }

                // Rule 2: Overdue_Payment — đã xuất HĐ, quá hạn, tiền chưa về đủ
                if (!newStatus && totalInvoiced > 0 && totalCash < totalInvoiced) {
                    const overdueInvoice = payments.find((p: any) =>
                        ['Đã xuất HĐ', 'Tiền về', 'Paid'].includes(p.status) &&
                        p.payment_type === 'INVOICE' &&
                        p.due_date && p.due_date < today
                    );
                    if (overdueInvoice && contract.status !== 'Overdue_Payment') {
                        newStatus = 'Overdue_Payment';
                        details.push(`${contract.id}: → QH thanh toán (HĐ quá hạn ${overdueInvoice.due_date})`);
                    }
                }

                // Rule 3: Overdue_Advance — có kế hoạch tạm ứng quá hạn mà chưa nhận
                if (!newStatus && Array.isArray(paymentSchedules)) {
                    const advanceEntry = paymentSchedules.find((s: any) =>
                        s.description && s.description.toLowerCase().includes('tạm ứng') &&
                        s.date && s.date < today &&
                        s.amount > 0
                    );
                    if (advanceEntry && totalCash === 0 && contract.status !== 'Overdue_Advance') {
                        newStatus = 'Overdue_Advance';
                        details.push(`${contract.id}: → QH tạm ứng (hạn ${advanceEntry.date}, chưa nhận tiền)`);
                    }
                }

                // Apply status change
                if (newStatus) {
                    const { error: updateError } = await supabase
                        .from('contracts')
                        .update({ status: newStatus })
                        .eq('id', contract.id);
                    if (!updateError) {
                        updated++;
                        console.log(`${logPrefix} ${contract.id}: ${contract.status} → ${newStatus}`);
                    }
                }
            }

            console.log(`${logPrefix} Done. Updated ${updated} contracts.`);
            return { updated, details };
        } catch (err) {
            console.error(`${logPrefix} Error:`, err);
            return { updated: 0, details: ['Error occurred'] };
        }
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

    },

    // FALLBACK for chart data (with unit_allocations support)
    getChartDataFallback: async (unitId: string = 'all', year: string = 'all'): Promise<Array<{ month: number, revenue: number, profit: number, signing: number }>> => {
        console.log('[ContractService.getChartDataFallback] Using direct query');
        // Fetch all contracts with unit_allocations for allocation-aware filtering
        let query = supabase.from('contracts').select('signed_date, value, actual_revenue, estimated_cost, unit_id, unit_allocations, vat_rate, has_vat, payments(amount, paid_amount, status, payment_type)');

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

        const isFilteringByUnit = !isAll(unitId);

        // Aggregate by month
        const monthlyData: Record<number, { revenue: number, profit: number, signing: number }> = {};
        for (let m = 1; m <= 12; m++) {
            monthlyData[m] = { revenue: 0, profit: 0, signing: 0 };
        }

        (data || []).forEach((c: any) => {
            if (!c.signed_date) return;

            // Determine unit share percentage using shared helper
            let sharePct = 100;
            if (isFilteringByUnit) {
                sharePct = getUnitSharePct(c, unitId);
            }

            if (sharePct === 0) return;

            const fraction = sharePct / 100;
            const month = new Date(c.signed_date).getMonth() + 1;
            // Use payment-calculated revenue (consistent with stats)
            const rev = calculateRevenueFromPayments(
                c.payments || [], c.vat_rate ?? 10, c.has_vat !== false, c.actual_revenue || 0
            );
            if (monthlyData[month]) {
                monthlyData[month].signing += (c.value || 0) * fraction;
                monthlyData[month].revenue += rev * fraction;
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
        const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
        if (error) throw error;
        return data.map(mapContract);
    },

    getByCustomerId: async (customerId: string): Promise<Contract[]> => {
        const { data, error } = await supabase.from('contracts').select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(200);
        if (error) throw error;
        return data.map(mapContract);
    },

    getBySalespersonId: async (salespersonId: string): Promise<Contract[]> => {
        const { data, error } = await supabase.from('contracts').select('*')
            .eq('employee_id', salespersonId)
            .order('created_at', { ascending: false })
            .limit(200);
        if (error) throw error;
        return data.map(mapContract);
    },

    getByEmployeeId: async (employeeId: string): Promise<Contract[]> => {
        const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .eq('employee_id', employeeId)
            .order('created_at', { ascending: false })
            .limit(200);

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

        // 6. Telegram notification (fire-and-forget)
        TelegramNotificationService.notifyContractChange({
            eventType: 'created',
            contractTitle: data.title || data.id,
            contractId: result.id,
            value: data.value,
            changedBy: (await supabase.auth.getUser()).data.user?.email || undefined,
        }).catch(() => { }); // Silent

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

        // 5. Telegram notification (fire-and-forget)
        const mapped = mapContract(result);
        const isStatusChange = data.status && payload.status;
        TelegramNotificationService.notifyContractChange({
            eventType: isStatusChange ? 'status_changed' : 'updated',
            contractTitle: mapped.title || id,
            contractId: id,
            value: mapped.value,
            oldStatus: isStatusChange ? undefined : undefined, // old status not available here
            newStatus: isStatusChange ? data.status : undefined,
            changedFields: Object.keys(payload).filter(k => k !== 'updated_at'),
            changedBy: (await supabase.auth.getUser()).data.user?.email || undefined,
        }).catch(() => { });

        return mapped;
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

        // Telegram notification (fire-and-forget)
        TelegramNotificationService.notifyContractChange({
            eventType: 'deleted',
            contractTitle: id,
            contractId: id,
            changedBy: (await supabase.auth.getUser()).data.user?.email || undefined,
        }).catch(() => { });

        return true;
    },

    /**
     * BATCH DELETE - Delete multiple contracts at once
     */
    batchDelete: async (ids: string[]): Promise<{ success: string[], failed: string[] }> => {
        const results = { success: [] as string[], failed: [] as string[] };

        if (!ids || ids.length === 0) return results;

        try {
            await withRetry(async () => {
                const { error } = await supabase
                    .from('contracts')
                    .delete()
                    .in('id', ids);

                if (error) {
                    console.error('ContractService.batchDelete:', error.message);
                    throw new Error(ERROR_MESSAGES.DELETE_FAILED);
                }
            });

            results.success = [...ids];

            // Log audit asynchronously for all
            Promise.all(ids.map(id => logOperation('DELETE', id))).catch(console.error);

        } catch (error) {
            console.error('Batch delete failed:', error);
            results.failed = [...ids];
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
     * @param isPreview If true, strictly returns the next number without locking/incrementing the sequence
     */
    getNextContractNumber: async (unitId: string, year: number, isPreview: boolean = false): Promise<number> => {
        const rpcName = isPreview ? 'preview_next_contract_number' : 'get_next_contract_number';
        const { data, error } = await supabase.rpc(rpcName as any, {
            p_unit_id: unitId,
            p_year: year
        });

        if (error) {
            console.error("Error getting next contract number via RPC, using fallback:", error);
            // Fallback for environments where migration hasn't been applied yet
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;

            const { count, error: fallbackError } = await supabase
                .from('contracts')
                .select('*', { count: 'exact', head: true })
                .eq('unit_id', unitId)
                .gte('signed_date', startDate)
                .lte('signed_date', endDate);

            if (fallbackError) {
                console.error("Fallback error getting contract count:", fallbackError);
                return 1;
            }

            return (count || 0) + 1;
        }

        return data as number;
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
            status: 'Processing',
            stage: 'Signed',
            actualRevenue: 0,
            actualCost: 0,
            invoicedAmount: 0,
        };

        return await ContractService.create(clone);
    }
};

