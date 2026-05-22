import { dataClient as supabase } from '../lib/dataClient';
import { Contract } from '../types';
import { TelegramNotificationService } from './telegramNotificationService';
import { normalizeTag } from './contractTagService';
import { ContractTaskDefinitionService } from './contractTaskDefinitionService';
import type { MilestoneBaseDateType } from './contractTaskDefinitionService';

// Sub-module imports
import { mapContract } from './contract/contractMapper';
import * as ContractRelations from './contract/contractRelations';
import { withRetry, validateContract, buildPayload, logOperation, ERROR_MESSAGES } from './contract/contractUtils';
import {
    isAll,
    getUnitSharePct,
    calculateCashReceived,
    calculateInvoicedFromPayments,
    calculateRevenueFromPayments,
    calculatePeriodFinancials,
} from './contract/contractFinancials';

// Re-exports — keep backward compatibility for consumers importing from contractService
export {
    isAll,
    getUnitSharePct,
    calculateRevenueFromPayments,
    calculateInvoicedFromPayments,
    calculateCashReceived,
    calculateAdvanceAmount,
    calculateReceivables,
    calculatePayables,
    getEmployeeSharePct,
} from './contract/contractFinancials';

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
            .select('*, payments(amount, paid_amount, status, payment_type, voucher_type, vat_invoice_items, phase_id)')
            .eq('id', id)
            .single();

        if (contractError) {
            if (contractError.code === 'PGRST116') return undefined; // Not found
            console.error('ContractService.getById:', contractError.message);
            return undefined;
        }

        console.log('[DEBUG ContractService] getById DB raw data:', contractData.employee_id, contractData.employee_allocations);

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
        dateFrom?: string;
        dateTo?: string;
        salespersonId?: string;
        classification?: string;
        sortBy?: string;
        sortDir?: 'asc' | 'desc';
        matchingCustomerIds?: string[];
        filterByIds?: string[];
    }): Promise<{ data: Contract[]; count: number }> => {
        const { page, limit, search, status, unitId, year, dateFrom, dateTo, salespersonId, classification, sortBy, sortDir, matchingCustomerIds, filterByIds } = params;

        // Build search OR filter including customer short name matches AND unaccent matches
        // PostgREST .or() filter: IDs must be double-quoted if they contain special chars (/, commas, etc.)
        const quoteId = (id: string): string => /[,/()\s]/.test(id) ? `"${id}"` : id;
        const buildSearchFilter = (searchTerm: string, customerIds?: string[], unaccentIds?: string[]): string => {
            // Sanitize search term: escape commas (PostgREST delimiter) and backslashes
            const safeTerm = searchTerm.replace(/\\/g, '\\\\').replace(/,/g, '\\,');
            let filter = `title.ilike.%${safeTerm}%,contract_code.ilike.%${safeTerm}%,party_a.ilike.%${safeTerm}%,customer_contract_number.ilike.%${safeTerm}%,content.ilike.%${safeTerm}%,end_user_name.ilike.%${safeTerm}%,category.ilike.%${safeTerm}%`;
            if (customerIds && customerIds.length > 0) {
                filter += `,customer_id.in.(${customerIds.map(quoteId).join(',')})`;
            }
            if (unaccentIds && unaccentIds.length > 0) {
                filter += `,id.in.(${unaccentIds.map(quoteId).join(',')})`;
            }
            return filter;
        };

        // Fetch contract IDs matching accent-insensitive search via RPC
        let unaccentMatchIds: string[] | undefined;
        if (search) {
            try {
                const { data: rpcData } = await supabase.rpc('search_contracts_ids_unaccent', { search_term: search });
                if (rpcData && rpcData.length > 0) {
                    unaccentMatchIds = rpcData.map((r: any) => r.id);
                }
            } catch (e) {
                console.warn('[ContractService] unaccent search RPC failed, falling back to ilike:', e);
            }
        }

        // Determine if we need allocation-aware filtering (single unit, not 'All' or comma-separated)
        const isSingleUnitFilter = !isAll(unitId) && !unitId!.includes(',');

        if (isSingleUnitFilter) {
            // === ALLOCATION-AWARE MODE ===
            // Fetch ALL contracts (no unit_id filter) to find collaborative contracts
            let query = supabase
                .from('contracts')
                .select('*, payments(amount, paid_amount, status, payment_type, voucher_type, vat_invoice_items)');

            // Filter by specific IDs (e.g. from personal tags)
            if (filterByIds && filterByIds.length > 0) {
                query = query.in('id', filterByIds);
            }

            if (search) {
                query = query.or(buildSearchFilter(search, matchingCustomerIds, unaccentMatchIds));
            }
            if (status && status !== 'All') {
                query = query.eq('status', status);
            }
            if (classification && classification !== 'All') {
                query = query.eq('classification', classification);
            }
            if (dateFrom || dateTo) {
                if (dateFrom) query = query.gte('signed_date', dateFrom);
                if (dateTo) query = query.lte('signed_date', dateTo);
            } else if (year && year !== 'All') {
                const startDate = `${year}-01-01`;
                const endDate = `${year}-12-31`;
                query = query.gte('signed_date', startDate).lte('signed_date', endDate);
            }
            // DO NOT filter by salespersonId in SQL here — we need to find
            // contracts where the employee appears in employee_allocations too.
            // Salesperson filtering is done in JS below.

            // Sort mapping
            const SORT_MAP: Record<string, string> = {
                id: 'id', signedDate: 'signed_date', value: 'value',
                actualRevenue: 'actual_revenue', estimatedCost: 'estimated_cost',
                status: 'status', title: 'title', partyA: 'party_a',
                adminProfit: 'admin_profit', revProfit: 'rev_profit',
            };
            const dbSortColumn = sortBy ? SORT_MAP[sortBy] : null;
            if (dbSortColumn) {
                query = query.order(dbSortColumn, { ascending: sortDir === 'asc' });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query;
            if (error) throw error;

            // Helper: get employee's percentage within the contract (from employee_allocations)
            const getEmployeePct = (c: any, targetEmployeeId: string): number => {
                // Check unit_allocations FIRST — support unit employee stored here
                // (must run before empAllocs early-return to avoid missing support contracts)
                const unitAllocations: any[] = c.unit_allocations?.allocations || [];
                const supportMatch = unitAllocations.find(
                    (a: any) => a.role === 'support' && a.employeeId === targetEmployeeId
                );
                if (supportMatch) return 100; // support unit PIC gets 100% of their unit's share

                const empAllocs: any[] = c.employee_allocations || [];
                if (empAllocs.length === 0) {
                    // Legacy: if contract's employee_id matches, 100%
                    return c.employee_id === targetEmployeeId ? 100 : 0;
                }
                const match = empAllocs.find((a: any) => a.employeeId === targetEmployeeId);
                return match ? (match.percent || 100) : 0;
            };

            // Filter in JS: include contracts where this unit is lead or support
            const filteredContracts: Contract[] = [];
            (data || []).forEach((c: any) => {
                const allocationPct = getUnitSharePct(c, unitId!);
                if (allocationPct === 0) return;

                // If salesperson filter is active, also check employee_allocations
                if (salespersonId) {
                    const empPct = getEmployeePct(c, salespersonId);
                    if (empPct === 0) return; // This employee has no role in this contract
                }

                const isLeadUnit = c.unit_id === unitId;
                const allocationRole = isLeadUnit ? 'lead' : 'support';

                const mapped = mapContract(c);
                // Tag with allocation info for UI display
                (mapped as any)._allocationRole = allocationRole;
                (mapped as any)._allocationPct = allocationPct;
                // Tag with employee allocation info
                if (salespersonId) {
                    (mapped as any)._employeePct = getEmployeePct(c, salespersonId);
                }
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
                .select('*, payments(amount, paid_amount, status, payment_type, voucher_type, vat_invoice_items)', { count: 'exact' });

            // Filter by specific IDs (e.g. from personal tags)
            if (filterByIds && filterByIds.length > 0) {
                query = query.in('id', filterByIds);
            }

            if (search) {
                query = query.or(buildSearchFilter(search, matchingCustomerIds, unaccentMatchIds));
            }
            if (status && status !== 'All') {
                query = query.eq('status', status);
            }
            if (classification && classification !== 'All') {
                query = query.eq('classification', classification);
            }
            if (unitId && unitId !== 'All' && unitId !== 'all') {
                if (unitId.includes(',')) {
                    query = query.in('unit_id', unitId.split(',').map(id => id.trim()));
                } else {
                    query = query.eq('unit_id', unitId);
                }
            }
            if (dateFrom || dateTo) {
                if (dateFrom) query = query.gte('signed_date', dateFrom);
                if (dateTo) query = query.lte('signed_date', dateTo);
            } else if (year && year !== 'All') {
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
                adminProfit: 'admin_profit', revProfit: 'rev_profit',
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
            .or(`title.ilike.%${safeTerm}%,contract_code.ilike.%${safeTerm}%,party_a.ilike.%${safeTerm}%,customer_contract_number.ilike.%${safeTerm}%,content.ilike.%${safeTerm}%,end_user_name.ilike.%${safeTerm}%,category.ilike.%${safeTerm}%`)
            .order('signed_date', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data.map(mapContract);
    },

    /**
     * Advanced Search for EntityPicker
     * Supports filtering by permissions, tags, JSONB products, and unaccent names
     */
    searchAuthorized: async (query: string, profile: any, limit = 20): Promise<Contract[]> => {
        if (!query || query.length < 2) return [];

        let tagMatchIds: string[] = [];
        try {
            const safeTagQuery = normalizeTag(query);
            if (safeTagQuery.length > 0) {
               const { data: tagData } = await supabase
                 .from('contract_tags')
                 .select('contract_id')
                 .eq('user_id', profile.id)
                 .ilike('tag', `%${safeTagQuery}%`);
               if (tagData) {
                   tagMatchIds = tagData.map((r: any) => r.contract_id);
               }
            }
        } catch (e) {
            console.warn('[ContractService] searchAuthorized tag search failed:', e);
        }

        let unaccentMatchIds: string[] = [];
        try {
            const { data: rpcData } = await supabase.rpc('search_contracts_ids_unaccent', { search_term: query });
            if (rpcData && rpcData.length > 0) {
                unaccentMatchIds = rpcData.map((r: any) => r.id);
            }
        } catch (e) {
            console.warn('[ContractService] searchAuthorized unaccent RPC failed:', e);
        }

        const safeTerm = query.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/[%_]/g, '\\$&');
        const quoteId = (id: string) => /[,/()\s]/.test(id) ? `"${id}"` : id;

        // Build main OR filter
        let orFilter = `title.ilike.%${safeTerm}%,contract_code.ilike.%${safeTerm}%,party_a.ilike.%${safeTerm}%,customer_contract_number.ilike.%${safeTerm}%,content.ilike.%${safeTerm}%,end_user_name.ilike.%${safeTerm}%,category.ilike.%${safeTerm}%`;
        // Removed details->>lineItems as it crashes PostgREST for JSON arrays

        const combinedIds = [...new Set([...tagMatchIds, ...unaccentMatchIds])];
        if (combinedIds.length > 0) {
            orFilter += `,id.in.(${combinedIds.map(quoteId).join(',')})`;
        }

        const { data, error } = await supabase
            .from('contracts')
            .select('*, payments(amount, paid_amount, status, payment_type, voucher_type, vat_invoice_items)')
            .or(orFilter)
            .order('signed_date', { ascending: false });

        if (error) {
            console.error('[ContractService] searchAuthorized Error:', error);
            return [];
        }

        // Client-side grouping/filtering to enforce permissions
        const isAdmin = profile?.role === 'Admin' || profile?.role === 'BOD';
        const userUnitId = profile?.unit_id;
        const userId = profile?.id;

        const getEmployeePct = (c: any, targetEmployeeId: string): number => {
            const empAllocs: any[] = c.employee_allocations || [];
            if (empAllocs.length === 0) return c.employee_id === targetEmployeeId ? 100 : 0;
            const match = empAllocs.find((a: any) => a.employeeId === targetEmployeeId);
            if (match) return match.percent || 100;
            const unitAllocations: any[] = c.unit_allocations?.allocations || [];
            const supportMatch = unitAllocations.find((a: any) => a.role === 'support' && a.employeeId === targetEmployeeId);
            if (supportMatch) return 100;
            return 0;
        };

        const filteredContracts: Contract[] = [];
        
        for (const c of (data || [])) {
            let hasAccess = false;
            
            if (isAdmin) {
                hasAccess = true;
            } else {
                const allocationPct = getUnitSharePct(c, userUnitId);
                const empPct = getEmployeePct(c, userId);
                if (allocationPct > 0 || empPct > 0) {
                    hasAccess = true;
                }
            }

            if (hasAccess) {
                filteredContracts.push(mapContract(c));
                if (filteredContracts.length >= limit) break; // Stop when limit reached
            }
        }

        return filteredContracts;
    },

    /**
     * Get unique line item name suggestions from past contracts (for autocomplete).
     * Fetches only 'details' column to minimize data transfer.
     * Optionally filter by unitId to scope to current unit's contracts.
     */
    getLineItemSuggestions: async (unitId?: string): Promise<string[]> => {
        try {
            let query = supabase
                .from('contracts')
                .select('details')
                .order('created_at', { ascending: false })
                .limit(200); // Limit to recent 200 contracts

            if (unitId) {
                query = query.eq('unit_id', unitId);
            }

            const { data, error } = await query;
            if (error) throw error;

            const nameSet = new Set<string>();
            (data || []).forEach((c: any) => {
                const lineItems = c.details?.lineItems || [];
                lineItems.forEach((li: any) => {
                    if (li.name && li.name.trim()) {
                        nameSet.add(li.name.trim());
                    }
                });
            });

            return Array.from(nameSet).sort();
        } catch (err) {
            console.warn('[ContractService] getLineItemSuggestions failed:', err);
            return [];
        }
    },

    // Find contracts that contain a specific product in lineItems (via DB RPC)
    getRelated: async (category: string, productName: string, limit = 20): Promise<Contract[]> => {
        let query = supabase.from('contracts').select('*').order('signed_date', { ascending: false }).limit(limit);
        query = query.or(`category.eq.${category},title.ilike.%${productName}%`);
        const { data, error } = await query;
        if (error) throw error;
        return data.map(mapContract);
    },

    getByProductId: async (productId: string, limit = 50): Promise<Contract[]> => {
        const { data, error } = await supabase.rpc('get_contracts_by_product_id', {
            p_product_id: productId,
            p_limit: limit
        });
        if (error) throw error;
        return (data || []).map(mapContract);
    },

    getStats: async (params: {
        search?: string;
        status?: string;
        unitId?: string;
        year?: string;
        dateFrom?: string;
        dateTo?: string;
        salespersonId?: string;
        classification?: string;
        matchingCustomerIds?: string[];
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
        handoverCount: number,
        acceptanceCount: number,
        completedCount: number,
        newContractsCount?: number,
        renewalContractsCount?: number,
        maxContract?: { title: string, code: string, value: number, customer: string, unit_id: string } | null,
        minContract?: { title: string, code: string, value: number, customer: string, unit_id: string } | null,
        unitBreakdown?: Record<string, { count: number, value: number }>
    }> => {
        const { search, status, unitId, year, dateFrom, dateTo, salespersonId, classification, matchingCustomerIds } = params;

        // Build search OR filter including customer short name matches AND unaccent matches
        // PostgREST .or() filter: IDs must be double-quoted if they contain special chars (/, commas, etc.)
        const quoteId = (id: string): string => /[,/()\s]/.test(id) ? `"${id}"` : id;
        const buildSearchFilter = (searchTerm: string, customerIds?: string[], unaccentIds?: string[]): string => {
            // Sanitize search term: escape commas (PostgREST delimiter) and backslashes
            const safeTerm = searchTerm.replace(/\\/g, '\\\\').replace(/,/g, '\\,');
            let filter = `title.ilike.%${safeTerm}%,contract_code.ilike.%${safeTerm}%,party_a.ilike.%${safeTerm}%,customer_contract_number.ilike.%${safeTerm}%,content.ilike.%${safeTerm}%,end_user_name.ilike.%${safeTerm}%,category.ilike.%${safeTerm}%`;
            if (customerIds && customerIds.length > 0) {
                filter += `,customer_id.in.(${customerIds.map(quoteId).join(',')})`;
            }
            if (unaccentIds && unaccentIds.length > 0) {
                filter += `,id.in.(${unaccentIds.map(quoteId).join(',')})`;
            }
            return filter;
        };

        // Fetch contract IDs matching accent-insensitive search via RPC
        let unaccentMatchIds: string[] | undefined;
        if (search) {
            try {
                const { data: rpcData } = await supabase.rpc('search_contracts_ids_unaccent', { search_term: search });
                if (rpcData && rpcData.length > 0) {
                    unaccentMatchIds = rpcData.map((r: any) => r.id);
                }
            } catch (e) {
                console.warn('[ContractService] unaccent search RPC failed in getStats:', e);
            }
        }

        // Fetch ALL contracts with unit_allocations for allocation-aware filtering
        // OPTIMIZED: No payments JOIN — use pre-computed columns
        let query = supabase.from('contracts').select('id, value, expected_revenue, actual_revenue, admin_profit, rev_profit, cash_received, status, title, contract_code, party_a, signed_date, unit_id, unit_allocations, employee_id, employee_allocations');

        if (search) {
            query = query.or(buildSearchFilter(search, matchingCustomerIds, unaccentMatchIds));
        }
        if (status && status !== 'All') {
            query = query.eq('status', status);
        }
        if (classification && classification !== 'All') {
            query = query.eq('classification', classification);
        }
        // NOTE: Unit filter is NOT applied at SQL level — done in JS below for allocation support
        if (dateFrom || dateTo) {
            if (dateFrom) query = query.gte('signed_date', dateFrom);
            if (dateTo) query = query.lte('signed_date', dateTo);
        } else if (year && year !== 'All') {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            query = query.gte('signed_date', startDate).lte('signed_date', endDate);
        }
        // DO NOT filter by salespersonId in SQL — we need to also find
        // contracts where the employee appears in employee_allocations.
        // Salesperson filtering is done in JS below.

        const { data, error } = await query;
        if (error) throw error;

        // Also fetch status counts WITHOUT status filter for accurate status card display
        let statusCountQuery = supabase.from('contracts').select('id, status, unit_id, unit_allocations, signed_date');
        if (search) {
            statusCountQuery = statusCountQuery.or(buildSearchFilter(search, matchingCustomerIds, unaccentMatchIds));
        }
        if (dateFrom || dateTo) {
            if (dateFrom) statusCountQuery = statusCountQuery.gte('signed_date', dateFrom);
            if (dateTo) statusCountQuery = statusCountQuery.lte('signed_date', dateTo);
        } else if (year && year !== 'All') {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;
            statusCountQuery = statusCountQuery.gte('signed_date', startDate).lte('signed_date', endDate);
        }
        // Salesperson filtering for status counts is also done in JS.
        const { data: statusData } = await statusCountQuery;

        // Determine if filtering by specific unit(s)
        const isFilteringByUnit = !isAll(unitId);
        const unitIds = isFilteringByUnit && unitId!.includes(',')
            ? unitId!.split(',').map(id => id.trim())
            : isFilteringByUnit ? [unitId!] : [];

        // Helper: check if employee is associated with a contract (via employee_id or employee_allocations)
        const isEmployeeInContract = (c: any, empId: string): boolean => {
            if (c.employee_id === empId) return true;
            const empAllocs: any[] = c.employee_allocations || [];
            if (empAllocs.some((a: any) => a.employeeId === empId)) return true;
            const unitAllocs: any[] = c.unit_allocations?.allocations || [];
            return unitAllocs.some((a: any) => a.role === 'support' && a.employeeId === empId);
        };

        // Helper: get employee's fraction = unitSharePct × employeePct / 100
        const getEmployeeSharePct = (c: any, empId: string): number => {
            const empAllocs: any[] = c.employee_allocations || [];
            if (empAllocs.length > 0) {
                const match = empAllocs.find((a: any) => a.employeeId === empId);
                if (match) return match.percent || 100;
            }
            // Check support unit allocations
            const unitAllocs: any[] = c.unit_allocations?.allocations || [];
            const supportMatch = unitAllocs.find((a: any) => a.role === 'support' && a.employeeId === empId);
            if (supportMatch) return 100; // PIC of support unit gets 100% of that unit's share
            // Legacy: primary employee gets 100%
            if (c.employee_id === empId) return 100;
            return 0;
        };

        // Count statuses from unfiltered data (but respecting unit + salesperson filter)
        const statusCounts = { processingCount: 0, suspendedCount: 0, handoverCount: 0, acceptanceCount: 0, completedCount: 0, newContractsCount: 0, renewalContractsCount: 0 };
        (statusData || []).forEach((c: any) => {
            if (isFilteringByUnit) {
                let matchedPct = 0;
                for (const targetUnitId of unitIds) {
                    matchedPct = Math.max(matchedPct, getUnitSharePct(c, targetUnitId));
                }
                if (matchedPct === 0) return;
            }
            if (salespersonId && !isEmployeeInContract(c, salespersonId)) return;
            
            const cat = c.category || 'Mới';
            if (cat === 'Mới') statusCounts.newContractsCount++;
            else if (['Gia hạn', 'Bảo trì'].includes(cat)) statusCounts.renewalContractsCount++;

            if (c.status === 'Processing') statusCounts.processingCount++;
            else if (c.status === 'Suspended') statusCounts.suspendedCount++;
            else if (c.status === 'Handover') statusCounts.handoverCount++;
            else if (c.status === 'Acceptance') statusCounts.acceptanceCount++;
            else if (c.status === 'Completed') statusCounts.completedCount++;
        });

        // OPTIMIZED: Calculate aggregates from pre-computed columns — no payment recalculation
        let maxContract: any = null;
        let minContract: any = null;
        const unitBreakdown: Record<string, { count: number, value: number }> = {};

        const financials = (data || []).reduce((acc, curr: any) => {
            const val = curr.value || 0;
            const rev = curr.actual_revenue || 0;
            const adminProfit = curr.admin_profit || 0;
            const revProfit = curr.rev_profit || 0;
            const cash = curr.cash_received || 0;

            // Determine this unit's share percentage using shared helper
            let unitSharePct = 100; // Default: 100% for "all" view

            if (isFilteringByUnit) {
                let matchedPct = 0;
                for (const targetUnitId of unitIds) {
                    matchedPct = Math.max(matchedPct, getUnitSharePct(curr, targetUnitId));
                }
                unitSharePct = matchedPct;
            }

            if (unitSharePct === 0) return acc; // Skip contracts where unit has no share

            // If filtering by salesperson, check if they're in this contract
            if (salespersonId && !isEmployeeInContract(curr, salespersonId)) return acc;

            // Combined fraction: unitPct × employeePct
            let fraction = unitSharePct / 100;
            if (salespersonId) {
                const empPct = getEmployeeSharePct(curr, salespersonId);
                fraction = fraction * empPct / 100;
            }
            
            const trueVal = val * fraction;

            // Track Max and Min
            if (trueVal > 0) {
                if (!maxContract || trueVal > maxContract.value) {
                    maxContract = { title: curr.title, code: curr.contract_code, value: trueVal, customer: curr.party_a, unit_id: curr.unit_id };
                }
                if (!minContract || trueVal < minContract.value) {
                    minContract = { title: curr.title, code: curr.contract_code, value: trueVal, customer: curr.party_a, unit_id: curr.unit_id };
                }
            }

            // Track Unit Breakdown
            const unit = curr.unit_id || 'UNKNOWN';
            if (!unitBreakdown[unit]) {
                unitBreakdown[unit] = { count: 0, value: 0 };
            }
            unitBreakdown[unit].count += 1;
            unitBreakdown[unit].value += trueVal;

            return {
                totalContracts: acc.totalContracts + 1,
                totalValue: acc.totalValue + val * fraction,
                totalRevenue: acc.totalRevenue + rev * fraction,
                totalProfit: acc.totalProfit + adminProfit * fraction,
                totalSigningProfit: acc.totalSigningProfit + adminProfit * fraction,
                totalRevenueProfit: acc.totalRevenueProfit + revProfit * fraction,
                totalCash: acc.totalCash + cash * fraction
            };
        }, { totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0, totalSigningProfit: 0, totalRevenueProfit: 0, totalCash: 0 });

        return { ...financials, ...statusCounts, maxContract, minContract, unitBreakdown };
    },

    // OPTIMIZED RPC-BASED STATS with fallback
    getStatsRPC: async (unitId: string = 'all', year: string = 'all', periodFilter?: string): Promise<{
        totalContracts: number,
        totalValue: number,
        totalRevenue: number,
        totalProfit: number,
        totalSigningProfit: number,
        totalRevenueProfit: number,
        totalCash: number,
        activeCount: number,
        pendingCount: number,
        newContractsCount?: number,
        renewalContractsCount?: number
    }> => {
        const logPrefix = '[ContractService.getStatsRPC]';
        console.log(`${logPrefix} START (Forcing DIRECT QUERY)`, {
            unitId,
            year,
            periodFilter,
            typeUnit: typeof unitId,
            typeYear: typeof year
        });

        // FORCE FALLBACK - Bypass RPC due to timeout issues
        return ContractService.getStatsFallback(unitId, year, periodFilter);

    },


    getStatsFallback: async (unitId: string = 'all', year: string = 'all', periodFilter?: string): Promise<{
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
        suspendedCount: number,
        handoverCount: number,
        newContractsCount: number,
        renewalContractsCount: number
    }> => {
        console.log('[ContractService.getStatsFallback] Using direct query with payments');
        // We MUST fetch payments to correctly calculate revenue/cash by time period.
        let query = supabase.from('contracts').select('id, value, expected_revenue, estimated_cost, status, unit_id, unit_allocations, end_date, signed_date, vat_rate, has_vat, admin_profit, rev_profit, payments(amount, paid_amount, status, payment_type, voucher_type, payment_date, invoice_date, vat_invoice_items)');

        const { data, error } = await query;
        if (error) {
            console.error('[ContractService.getStatsFallback] Query error:', error);
            return {
                totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0,
                totalSigningProfit: 0, totalRevenueProfit: 0, totalCash: 0,
                activeCount: 0, pendingCount: 0, completedCount: 0, expiredCount: 0,
                processingCount: 0, acceptanceCount: 0, suspendedCount: 0,
                handoverCount: 0, newContractsCount: 0, renewalContractsCount: 0
            };
        }

        console.log('[ContractService.getStatsFallback] Got contracts:', data?.length);

        const isFilteringByUnit = !isAll(unitId);
        
        // Parse time filters
        const targetYear = year && year !== 'All' && year !== 'all' ? parseInt(year) : null;
        let startPeriodDate: Date | null = null;
        let endPeriodDate: Date | null = null;
        
        if (targetYear) {
            startPeriodDate = new Date(`${targetYear}-01-01T00:00:00`);
            endPeriodDate = new Date(`${targetYear}-12-31T23:59:59`);
            
            if (periodFilter) {
                if (periodFilter.startsWith('M')) {
                    const month = parseInt(periodFilter.substring(1));
                    startPeriodDate = new Date(targetYear, month - 1, 1);
                    endPeriodDate = new Date(targetYear, month, 0, 23, 59, 59);
                } else if (periodFilter.startsWith('Q')) {
                    const quarter = parseInt(periodFilter.substring(1));
                    const startMonth = (quarter - 1) * 3;
                    const endMonth = quarter * 3 - 1;
                    startPeriodDate = new Date(targetYear, startMonth, 1);
                    endPeriodDate = new Date(targetYear, endMonth + 1, 0, 23, 59, 59);
                }
            }
        } else if (periodFilter) {
            const currentYear = new Date().getFullYear();
            if (periodFilter.startsWith('M')) {
                const month = parseInt(periodFilter.substring(1));
                startPeriodDate = new Date(currentYear, month - 1, 1);
                endPeriodDate = new Date(currentYear, month, 0, 23, 59, 59);
            } else if (periodFilter.startsWith('Q')) {
                const quarter = parseInt(periodFilter.substring(1));
                const startMonth = (quarter - 1) * 3;
                const endMonth = quarter * 3 - 1;
                startPeriodDate = new Date(currentYear, startMonth, 1);
                endPeriodDate = new Date(currentYear, endMonth + 1, 0, 23, 59, 59);
            }
        }

        const isInPeriod = (dateStr: string | null | undefined): boolean => {
            if (!dateStr) return false;
            if (!startPeriodDate || !endPeriodDate) return true;
            const d = new Date(dateStr);
            return d >= startPeriodDate && d <= endPeriodDate;
        };

        return (data || []).reduce((acc: any, curr: any) => {
            let sharePct = 100;
            if (isFilteringByUnit) {
                sharePct = getUnitSharePct(curr, unitId);
            }
            if (sharePct === 0) return acc;
            
            const fraction = sharePct / 100;
            const isSignedMatch = isInPeriod(curr.signed_date);
            const val = curr.value || 0;
            const estimatedCost = curr.estimated_cost || 0;
            const hasVat = curr.has_vat !== false;
            const vatRate = curr.vat_rate ?? 10;
            const expectedRevenue = curr.expected_revenue !== null && curr.expected_revenue !== undefined
                ? Number(curr.expected_revenue)
                : (hasVat && vatRate > 0 ? Math.round(val / (1 + vatRate / 100)) : val);
            const expectedProfit = curr.admin_profit !== null && curr.admin_profit !== undefined
                ? Number(curr.admin_profit)
                : expectedRevenue - estimatedCost;

            // Stats from contract (only if signed_date matches filter)
            if (isSignedMatch) {
                acc.totalContracts++;
                acc.totalValue += val * fraction;
                acc.totalProfit += expectedProfit * fraction;
                acc.totalSigningProfit += expectedProfit * fraction;
                
                acc.activeCount += (['Processing', 'Acceptance', 'Handover'].includes(curr.status) ? 1 : 0);
                acc.pendingCount += (curr.status === 'Pending' ? 1 : 0);
                acc.suspendedCount += (curr.status === 'Suspended' ? 1 : 0);
                acc.completedCount += (curr.status === 'Completed' ? 1 : 0);
                acc.acceptanceCount += (curr.status === 'Acceptance' ? 1 : 0);
                acc.processingCount += (curr.status === 'Processing' ? 1 : 0);
                acc.handoverCount += (curr.status === 'Handover' ? 1 : 0);
                acc.expiredCount += (
                    ['Processing', 'Acceptance'].includes(curr.status) && curr.end_date && new Date(curr.end_date) < new Date() ? 1 : 0
                );
            }
            
            // Calculate period financials using the shared helper
            const { revenueInPeriod, cashInPeriod, revProfitInPeriod } = calculatePeriodFinancials(curr, isInPeriod);
            
            acc.totalRevenue += revenueInPeriod * fraction;
            acc.totalCash += cashInPeriod * fraction;
            acc.totalRevenueProfit += revProfitInPeriod * fraction;

            return acc;
        }, { totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0, totalSigningProfit: 0, totalRevenueProfit: 0, totalCash: 0, activeCount: 0, pendingCount: 0, completedCount: 0, expiredCount: 0, processingCount: 0, acceptanceCount: 0, suspendedCount: 0, handoverCount: 0 });
    },

    /**
     * Recalculate completed_date for a single contract based on its payments.
     * Called after voucher save/delete for immediate update.
     * Also auto-transitions to 'Completed' if conditions are met.
     */
    recalculateCompletionDate: async (contractId: string): Promise<void> => {
        try {
            const { data: contract, error } = await supabase
                .from('contracts')
                .select('id, value, status, completed_date, payments(amount, paid_amount, status, payment_type, due_date, voucher_type, vat_invoice_items, payment_date, invoice_date)')
                .eq('id', contractId)
                .single();

            if (error || !contract) return;

            const payments = contract.payments || [];
            const totalCash = calculateCashReceived(payments);
            const totalInvoiced = calculateInvoicedFromPayments(payments);
            const contractValue = contract.value || 0;

            // Calculate completion date = max(last VAT invoice date, last receipt date)
            const vatDates = payments
                .filter((p: any) => p.voucher_type === 'VAT_INVOICE' && ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về'].includes(p.status))
                .map((p: any) => p.invoice_date || p.payment_date || p.due_date)
                .filter(Boolean);
            const receiptDates = payments
                .filter((p: any) => p.voucher_type === 'RECEIPT' && ['Tạm ứng', 'Tiền về'].includes(p.status))
                .map((p: any) => p.payment_date)
                .filter(Boolean);
            const allDates = [...vatDates, ...receiptDates].sort();
            const newCompletedDate = allDates.length > 0 ? allDates[allDates.length - 1] : null;

            // Auto-transition to Completed if VAT >= value AND cash >= value
            if (contractValue > 0 && totalInvoiced >= contractValue && totalCash >= contractValue && contract.status !== 'Completed') {
                await supabase
                    .from('contracts')
                    .update({ status: 'Completed', completed_date: newCompletedDate || new Date().toISOString().split('T')[0] })
                    .eq('id', contractId);
                console.log(`[recalcCompletionDate] ${contractId}: → Completed (date: ${newCompletedDate})`);
            } else if (contract.status === 'Completed' && newCompletedDate && newCompletedDate !== contract.completed_date) {
                // Already Completed but date changed
                await supabase
                    .from('contracts')
                    .update({ completed_date: newCompletedDate })
                    .eq('id', contractId);
                console.log(`[recalcCompletionDate] ${contractId}: Updated completed_date ${contract.completed_date} → ${newCompletedDate}`);
            }
        } catch (e) {
            console.error('[recalcCompletionDate] Error:', e);
        }
    },

    /**
     * Auto-transition logic — runs on Dashboard load.
     * Only 1 rule: Completed — tổng giá trị sau thuế VAT invoices ≥ giá trị ký VÀ tiền về ≥ giá trị ký
     * Also backfills completed_date for contracts already Completed but missing the date.
     */
    checkAutoStatusTransitions: async (): Promise<{ updated: number; details: string[] }> => {
        const logPrefix = '[AutoStatus]';
        console.log(`${logPrefix} Checking auto status transitions...`);
        const details: string[] = [];
        let updated = 0;

        try {
            // Fetch active contracts with payments
            const { data: contracts, error } = await supabase
                .from('contracts')
                .select('id, value, status, payments(amount, paid_amount, status, payment_type, due_date, voucher_type, vat_invoice_items, payment_date, invoice_date)')
                .in('status', ['Processing', 'Handover', 'Acceptance']);

            if (error || !contracts) {
                console.error(`${logPrefix} Query error:`, error);
                return { updated: 0, details: ['Query error'] };
            }

            for (const contract of contracts) {
                const contractValue = contract.value || 0;
                if (contractValue <= 0) continue;

                const payments = contract.payments || [];
                const totalCash = calculateCashReceived(payments);
                const totalInvoiced = calculateInvoicedFromPayments(payments);

                // Completed: tổng VAT invoice (after tax) ≥ value VÀ tiền về ≥ value
                if (totalInvoiced >= contractValue && totalCash >= contractValue && contract.status !== 'Completed') {
                    // Calculate completed_date = max(last VAT invoice date, last receipt date)
                    const vatDates = payments
                        .filter((p: any) => p.voucher_type === 'VAT_INVOICE' && ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về'].includes(p.status))
                        .map((p: any) => p.invoice_date || p.payment_date || p.due_date)
                        .filter(Boolean);
                    const receiptDates = payments
                        .filter((p: any) => p.voucher_type === 'RECEIPT' && ['Tạm ứng', 'Tiền về'].includes(p.status))
                        .map((p: any) => p.payment_date)
                        .filter(Boolean);
                    const allDates = [...vatDates, ...receiptDates].sort();
                    const completedDate = allDates.length > 0 ? allDates[allDates.length - 1] : new Date().toISOString().split('T')[0];

                    const { error: updateError } = await supabase
                        .from('contracts')
                        .update({ status: 'Completed', completed_date: completedDate })
                        .eq('id', contract.id);
                    if (!updateError) {
                        updated++;
                        details.push(`${contract.id}: → Hoàn thành (VAT ${totalInvoiced} ≥ ${contractValue}, tiền về ${totalCash} ≥ ${contractValue}, ngày ${completedDate})`);
                        console.log(`${logPrefix} ${contract.id}: ${contract.status} → Completed (date: ${completedDate})`);
                    }
                }
            }

            // === BACKFILL: Fix Completed contracts missing completed_date ===
            const { data: missingDateContracts, error: missingError } = await supabase
                .from('contracts')
                .select('id, value, status, completed_date, payments(amount, paid_amount, status, payment_type, due_date, voucher_type, vat_invoice_items, payment_date, invoice_date)')
                .eq('status', 'Completed');

            if (!missingError && missingDateContracts && missingDateContracts.length > 0) {
                console.log(`${logPrefix} Found ${missingDateContracts.length} Completed contracts, recalculating completed_date...`);
                for (const contract of missingDateContracts) {
                    const payments = contract.payments || [];
                    const vatDates = payments
                        .filter((p: any) => p.voucher_type === 'VAT_INVOICE' && ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về'].includes(p.status))
                        .map((p: any) => p.invoice_date || p.payment_date || p.due_date)
                        .filter(Boolean);
                    const receiptDates = payments
                        .filter((p: any) => p.voucher_type === 'RECEIPT' && ['Tạm ứng', 'Tiền về'].includes(p.status))
                        .map((p: any) => p.payment_date)
                        .filter(Boolean);
                    const allDates = [...vatDates, ...receiptDates].sort();
                    const completedDate = allDates.length > 0 ? allDates[allDates.length - 1] : new Date().toISOString().split('T')[0];

                    // Only update if the date actually changed
                    if (completedDate !== contract.completed_date) {
                        const { error: updateErr } = await supabase
                            .from('contracts')
                            .update({ completed_date: completedDate })
                            .eq('id', contract.id);
                        if (!updateErr) {
                            updated++;
                            details.push(`${contract.id}: Fix completed_date ${contract.completed_date} → ${completedDate}`);
                            console.log(`${logPrefix} ${contract.id}: Fixed completed_date ${contract.completed_date} → ${completedDate}`);
                        }
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

    getChartDataRPC: async (unitId: string = 'all', year: string = 'all'): Promise<Array<{ month: number, revenue: number, profit: number, revProfit: number, signing: number }>> => {
        const logPrefix = '[ContractService.getChartDataRPC]';
        console.log(`${logPrefix} START (Forcing DIRECT QUERY)`, { unitId, year });

        // FORCE FALLBACK - Bypass RPC
        return ContractService.getChartDataFallback(unitId, year);
    },

    // FALLBACK for chart data (with unit_allocations support)
    getChartDataFallback: async (unitId: string = 'all', year: string = 'all'): Promise<Array<{ month: number, revenue: number, profit: number, revProfit: number, signing: number }>> => {
        console.log('[ContractService.getChartDataFallback] Using direct query with payments');
        // Fetch ALL contracts with payments, NO signed_date filter at query level!
        let query = supabase.from('contracts').select('signed_date, value, expected_revenue, admin_profit, estimated_cost, unit_id, unit_allocations, vat_rate, has_vat, payments(amount, paid_amount, status, payment_type, voucher_type, payment_date, invoice_date, vat_invoice_items)');

        const { data, error } = await query;
        if (error) {
            console.error('[ContractService.getChartDataFallback] Query error:', error);
            return [];
        }

        const isFilteringByUnit = !isAll(unitId);
        const targetYear = year && year !== 'All' && year !== 'all' ? parseInt(year) : null;

        // Aggregate by month
        const monthlyData: Record<number, { revenue: number, profit: number, revProfit: number, signing: number }> = {};
        for (let m = 1; m <= 12; m++) {
            monthlyData[m] = { revenue: 0, profit: 0, revProfit: 0, signing: 0 };
        }

        (data || []).forEach((c: any) => {
            let sharePct = 100;
            if (isFilteringByUnit) {
                sharePct = getUnitSharePct(c, unitId);
            }
            if (sharePct === 0) return;
            const fraction = sharePct / 100;
            const val = c.value || 0;
            const estimatedCost = c.estimated_cost || 0;
            const hasVat = c.has_vat !== false;
            const vatRate = c.vat_rate ?? 10;
            
            const expectedRevenue = c.expected_revenue !== null && c.expected_revenue !== undefined
                ? Number(c.expected_revenue)
                : (hasVat && vatRate > 0 ? Math.round(val / (1 + vatRate / 100)) : val);
            
            const expectedProfit = c.admin_profit !== null && c.admin_profit !== undefined
                ? Number(c.admin_profit)
                : expectedRevenue - estimatedCost;

            // 1. Signing & Profit (based on signed_date)
            if (c.signed_date) {
                const sDate = new Date(c.signed_date);
                if (!targetYear || sDate.getFullYear() === targetYear) {
                    const month = sDate.getMonth() + 1;
                    monthlyData[month].signing += val * fraction;
                    monthlyData[month].profit += expectedProfit * fraction;
                }
            }

            // 2. Revenue & RevProfit (based on monthly periods)
            for (let month = 1; month <= 12; month++) {
                const isInMonth = (dateStr: string | null | undefined): boolean => {
                    if (!dateStr) return false;
                    const d = new Date(dateStr);
                    const yearMatch = targetYear ? d.getFullYear() === targetYear : true;
                    return yearMatch && (d.getMonth() + 1) === month;
                };

                const { revenueInPeriod, revProfitInPeriod } = calculatePeriodFinancials(c, isInMonth);
                monthlyData[month].revenue += revenueInPeriod * fraction;
                monthlyData[month].revProfit += revProfitInPeriod * fraction;
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
        console.log('[DEBUG ContractService.update] Payload employee_id:', payload.employee_id);
        // Set id = contractCode for new contracts (backward compat with existing FKs)
        payload.id = data.contractCode || data.id;

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

        // 4.5. Save task definitions from Step 4 (Milestone-Triggered Task System)
        try {
            const user = (await supabase.auth.getUser()).data.user;
            const rawUnitId = data.unitId || result.unit_id;
            const spaceId = (rawUnitId && rawUnitId !== 'all') ? rawUnitId : undefined;

            // A. Workflow-driven tasks (from checkbox system)
            if ((data as any).workflowSteps) {
                await ContractTaskDefinitionService.generateFromWorkflow(
                    result.id,
                    (data as any).workflowSteps,
                    {
                        lineItems: data.lineItems || [],
                        salespersonId: data.salespersonId || result.employee_id || '',
                        unitId: rawUnitId || '',
                        createdBy: user?.id,
                    }
                );
                console.log(`[ContractService.create] Generated workflow tasks for ${result.id}`);
            }

            // B. Manual custom tasks (legacy + manual add-ons)
            if (data.customTasks && data.customTasks.length > 0) {
                await ContractTaskDefinitionService.bulkCreate(
                    data.customTasks.map((taskDef: any, idx: number) => ({
                        contract_id: result.id,
                        title: taskDef.title,
                        description: taskDef.description || '',
                        assignees: taskDef.assignees || [],
                        priority: 'medium',
                        base_date_type: (taskDef.base_date_type || 'signed_date') as MilestoneBaseDateType,
                        duration_days: taskDef.duration_days || 0,
                        origin: 'manual' as const,
                        sort_order: 100 + idx, // manual tasks after workflow tasks
                        created_by: user?.id,
                    }))
                );
                console.log(`[ContractService.create] Saved ${data.customTasks.length} manual task definitions for ${result.id}`);
            }

            // C. Activate tasks whose milestones already exist (signed_date, current_date)
            await ContractTaskDefinitionService.checkAndActivateAll(
                result.id,
                {
                    signed_date: data.signedDate || result.signed_date,
                    handover_date: result.handover_date,
                    acceptance_date: result.acceptance_date,
                    completed_date: result.completed_date,
                    status: result.status,
                },
                spaceId
            );
        } catch (err) {
            console.warn("[ContractService.create] Failed to save task definitions:", err);
        }

        // 5. Log audit
        await logOperation('CREATE', result.id, payload);

        // 6. Telegram notification (fire-and-forget)
        TelegramNotificationService.notifyContractChange({
            eventType: 'created',
            contractTitle: data.title || data.contractCode || data.id,
            contractId: result.id,
            value: data.value,
            changedBy: (await supabase.auth.getUser()).data.user?.email || undefined,
        }).catch(() => { }); // Silent

        const mapped = mapContract(result);

        // 7. Notify UI components to refresh lists
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('contract-created', {
                detail: { contractId: result.id, contract: mapped }
            }));
        }

        return mapped;
    },

    /**
     * UPDATE - Professional implementation with partial update support
     */
    update: async (id: string, data: Partial<Contract>): Promise<Contract | undefined> => {
        // Fetch old data for detailed audit log
        const oldContract = await ContractService.getById(id);
        const oldPayload = oldContract ? buildPayload(oldContract) : null;

        // 1. Validate
        if (!id) throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);

        const errors = validateContract(data, false);
        if (errors.length > 0) {
            throw new Error(`${ERROR_MESSAGES.VALIDATION_ERROR}\n${errors.join('\n')}`);
        }

        // 2. Build payload (id is never updated — it's the PK used by all FK relationships)
        const payload = buildPayload(data);
        delete payload.id; // Never change the primary key

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
        await logOperation('UPDATE', id, payload, oldPayload || undefined);

        // 4.5. Milestone-Triggered Task System hooks
        try {
            const rawUnitId = data.unitId || result.unit_id;
            const spaceId = (rawUnitId && rawUnitId !== 'all') ? rawUnitId : undefined;
            const user = (await supabase.auth.getUser()).data.user;

            // A. Workflow-driven tasks (from checkbox system)
            if ((data as any).workflowSteps) {
                await ContractTaskDefinitionService.generateFromWorkflow(
                    id,
                    (data as any).workflowSteps,
                    {
                        lineItems: data.lineItems || [],
                        salespersonId: data.salespersonId || result.employee_id || '',
                        unitId: rawUnitId || '',
                        createdBy: user?.id,
                    }
                );
            }

            // B. Manual custom tasks (legacy + manual add-ons)
            if (data.customTasks && data.customTasks.length > 0) {
                await ContractTaskDefinitionService.bulkCreate(
                    data.customTasks.map((taskDef: any, idx: number) => ({
                        contract_id: id,
                        title: taskDef.title,
                        description: taskDef.description || '',
                        assignees: taskDef.assignees || [],
                        priority: 'medium',
                        base_date_type: (taskDef.base_date_type || 'signed_date') as MilestoneBaseDateType,
                        duration_days: taskDef.duration_days || 0,
                        origin: 'manual' as const,
                        sort_order: 100 + idx,
                        created_by: user?.id,
                    }))
                );
            }

            // B. Detect contract status change → fire milestone hooks
            const oldStatus = oldContract?.status;
            const newStatus = data.status || result.status;
            if (oldStatus && newStatus && oldStatus !== newStatus) {
                const milestoneDate = (() => {
                    switch (newStatus) {
                        case 'Handover': return data.handoverDate || result.handover_date;
                        case 'Acceptance': return data.acceptanceDate || result.acceptance_date;
                        case 'Completed': return data.completedDate || result.completed_date;
                        default: return null;
                    }
                })();

                await ContractTaskDefinitionService.onContractStatusChange(
                    id,
                    newStatus,
                    milestoneDate ? new Date(milestoneDate) : new Date(),
                    {
                        creatorUserId: user?.id,
                        salespersonId: result.employee_id,
                        unitId: rawUnitId,
                        spaceId,
                    }
                );
            }

            // C. Always check & activate any dormant tasks with available milestones
            await ContractTaskDefinitionService.checkAndActivateAll(
                id,
                {
                    signed_date: data.signedDate || result.signed_date,
                    handover_date: data.handoverDate || result.handover_date,
                    acceptance_date: data.acceptanceDate || result.acceptance_date,
                    completed_date: data.completedDate || result.completed_date,
                    status: newStatus,
                },
                spaceId
            );
        } catch (err) {
            console.warn("[ContractService.update] Failed to process task definitions:", err);
        }

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

        // 6. Notify UI components (ContractDetail) to refresh
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('contract-updated', {
                detail: { contractId: id, contract: mapped }
            }));
        }

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

        // Notify UI components to refresh lists
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('contract-deleted', {
                detail: { contractId: id }
            }));
        }

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
     * CHECK EXISTS - Verify if a contract code already exists
     * Checks both contract_code AND id columns, because new contracts
     * use contractCode as their PK (id). If a user edits the code
     * (e.g. HĐ → VV), only contract_code is updated but id (PK) stays.
     */
    exists: async (contractCode: string): Promise<boolean> => {
        const { count, error } = await supabase
            .from('contracts')
            .select('*', { count: 'exact', head: true })
            .or(`contract_code.eq.${contractCode},id.eq.${contractCode}`);

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
    duplicate: async (sourceId: string, newContractCode: string): Promise<Contract> => {
        // 1. Fetch source contract
        const source = await ContractService.getById(sourceId);
        if (!source) {
            throw new Error(ERROR_MESSAGES.NOT_FOUND);
        }

        // 2. Check if new contract code exists
        if (await ContractService.exists(newContractCode)) {
            throw new Error(ERROR_MESSAGES.DUPLICATE_ID);
        }

        // 3. Create clone with new contract code and reset status
        const clone: Contract = {
            ...source,
            id: '', // Will be set by create method
            contractCode: newContractCode,
            status: 'Processing',
            stage: 'Signed',
            actualRevenue: 0,
            actualCost: 0,
            invoicedAmount: 0,
        };

        return await ContractService.create(clone);
    },

    // ========================================================================
    // RELATED CONTRACTS — Delegated to services/contract/contractRelations.ts
    // ========================================================================
    getRelatedContracts: ContractRelations.getRelatedContracts,
    getOutgoingPendingLinks: ContractRelations.getOutgoingPendingLinks,
    getIncomingPendingLinks: ContractRelations.getIncomingPendingLinks,
    linkContracts: ContractRelations.linkContracts,
    approveLink: ContractRelations.approveLink,
    rejectLink: ContractRelations.rejectLink,
    unlinkContracts: ContractRelations.unlinkContracts,
};

