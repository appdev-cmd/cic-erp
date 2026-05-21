/**
 * Contract CRUD Utilities
 *
 * Internal helpers used by contractService.ts:
 *   - Error messages (Vietnamese)
 *   - withRetry  — exponential backoff retry
 *   - validateContract — input validation
 *   - buildPayload — Frontend Contract → DB payload mapping
 *   - logOperation — audit trail helper
 *
 * Extracted to reduce contractService.ts file size.
 */

import { dataClient as supabase } from '../../lib/dataClient';
import { Contract, ExecutionCostItem } from '../../types';
import { AuditLogService } from '../auditLogService';

// ─── Error Messages ───────────────────────────────────────────────────────────

export const ERROR_MESSAGES = {
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

// ─── Retry Logic ──────────────────────────────────────────────────────────────

/**
 * Retry with exponential backoff.
 * Does NOT retry on: validation errors, permission errors, duplicate key (23505).
 */
export const withRetry = async <T>(
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

            if (
                error.message?.includes('VALIDATION') ||
                error.message?.includes('permission') ||
                error.code === '23505'
            ) {
                throw error;
            }

            if (attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError || new Error(ERROR_MESSAGES.NETWORK_ERROR);
};

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate contract input data before create/update.
 * Returns a list of Vietnamese error messages.
 */
export const validateContract = (data: Partial<Contract>, isCreate = false): string[] => {
    const errors: string[] = [];

    if (isCreate) {
        if (!data.contractCode?.trim()) errors.push('Mã hợp đồng là bắt buộc');
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

// ─── Payload Builder ─────────────────────────────────────────────────────────

/**
 * Map Frontend Contract type → DB payload.
 * Single source of truth for Frontend → DB field mapping.
 */
export const buildPayload = (data: Partial<Contract>): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};

    const fieldMap: Record<string, string> = {
        contractCode: 'contract_code',
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
        salespersonId: 'employee_id',
        value: 'value',
        estimatedCost: 'estimated_cost',
        actualRevenue: 'actual_revenue',
        actualCost: 'actual_cost',
        invoicedAmount: 'invoiced_amount',
        status: 'status',
        stage: 'stage',
        category: 'category',
        classification: 'classification',
        signedDate: 'signed_date',
        startDate: 'start_date',
        endDate: 'end_date',
        content: 'content',
        customerContractNumber: 'customer_contract_number',
        paymentTermDays: 'payment_term_days',
        contacts: 'contacts',
        milestones: 'milestones',
        paymentPhases: 'payment_phases',
        draft_url: 'draft_url',
        suspendedDate: 'suspended_date',
        handoverDate: 'handover_date',
        acceptanceDate: 'acceptance_date',
        acceptanceValue: 'acceptance_value',
        completedDate: 'completed_date',
        notes: 'notes',
    };

    Object.entries(fieldMap).forEach(([key, dbKey]) => {
        if ((data as Record<string, unknown>)[key] !== undefined) {
            payload[dbKey] = (data as Record<string, unknown>)[key];
        }
    });

    // JSONB details field
    if (
        data.lineItems !== undefined ||
        data.adminCosts !== undefined ||
        data.executionCosts !== undefined ||
        (data as Record<string, unknown>).revenueSchedules !== undefined
    ) {
        payload.details = {
            lineItems: data.lineItems || [],
            adminCosts: data.executionCosts?.length ? undefined : (data.adminCosts || {}),
            executionCosts: data.executionCosts || [],
            revenueSchedules: (data as Record<string, unknown>).revenueSchedules || [],
        };

        if (data.lineItems !== undefined || data.executionCosts !== undefined) {
            const execSum = ((data.executionCosts as ExecutionCostItem[]) || []).reduce(
                (sum, c) => sum + (c.amount || 0), 0
            );
            const inputSum = ((data.lineItems as any[]) || []).reduce(
                (sum: number, li: any) => {
                    const directVal = (li.directCosts as number) || 0;
                    const effectiveDirectCosts = directVal > 0
                        ? directVal
                        : ((li.directCostDetails as any[]) || []).reduce((s: number, d: any) => s + (d.amount || 0), 0);
                    return sum + ((li.inputPrice as number) || 0) * ((li.quantity as number) || 1) + effectiveDirectCosts;
                },
                0
            );
            payload.estimated_cost = inputSum + execSum;
        }
    }

    // unitAllocations JSONB (QĐ 09.2024)
    if ((data as Record<string, unknown>).unitAllocations !== undefined) {
        const allocs = (data as Record<string, unknown>).unitAllocations;
        payload.unit_allocations = allocs ? { allocations: allocs } : null;
    }

    // employeeAllocations JSONB
    if ((data as Record<string, unknown>).employeeAllocations !== undefined) {
        const empAllocs = (data as Record<string, unknown>).employeeAllocations;
        payload.employee_allocations = empAllocs || null;
    }

    // workflowSteps JSONB
    if ((data as Record<string, unknown>).workflowSteps !== undefined) {
        payload.workflow_steps = (data as Record<string, unknown>).workflowSteps || null;
    }

    return payload;
};

// ─── Audit Log ────────────────────────────────────────────────────────────────

/**
 * Log contract operation to audit trail.
 * Silently swallows errors to avoid breaking the main operation.
 */
export const logOperation = async (
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    contractId: string,
    newData?: Record<string, unknown>,
    oldData?: Record<string, unknown>
): Promise<void> => {
    try {
        const user = (await supabase.auth.getUser()).data.user;
        const userId = user?.id || null;
        console.log(`[Audit] ${action} contract ${contractId} by ${user?.email || 'unknown'}`, { newData, oldData });

        await AuditLogService.create({
            user_id: userId,
            table_name: 'contracts',
            record_id: contractId,
            action,
            old_data: oldData || null,
            new_data: newData || null,
            comment: null,
        });
    } catch (e) {
        console.warn('[Audit] Failed to log operation:', e);
    }
};
