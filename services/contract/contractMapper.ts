/**
 * Contract Mapper — DB → Frontend mapping
 * 
 * Maps raw Supabase DB rows to the frontend Contract interface.
 * Extracted from contractService.ts to reduce file size.
 */

import { Contract } from '../../types';
import {
    calculateRevenueFromPayments,
    calculateInvoicedFromPayments,
    calculateCashReceived,
    calculateAdvanceAmount,
    calculatePayables,
} from './contractFinancials';
import { safeEval } from '../../utils/formulaEval';

/**
 * Map a raw DB contract row to the frontend Contract interface.
 * This is the single source of truth for DB→Frontend mapping.
 */
export const mapContract = (c: any): Contract => {
    if (!c) return {
        id: 'unknown',
        title: 'Unknown Contract',
        contractType: 'HĐ',
        status: 'Processing',
        stage: 'Signed',
        value: 0
    } as any; // Partial fallback

    const payments: any[] = c.payments || [];

    // Line items for total input cost
    const lineItems = c.details?.lineItems || c.line_items || [];
    const executionCosts = c.details?.executionCosts || c.execution_costs || [];

    // Compute estimated cost dynamically from lineItems + executionCosts
    // Uses inputPrice (authoritative stored value), not inputPriceFormula which can be stale
    const computedInputCost = lineItems.reduce((sum: number, li: any) => {
        const directVal = (li.directCosts as number) || 0;
        const effectiveDirectCosts = directVal > 0
            ? directVal
            : ((li.directCostDetails as any[]) || []).reduce((s: number, d: any) => s + (d.amount || 0), 0);
        return sum + ((li.inputPrice as number) || 0) * ((li.quantity as number) || 1) + effectiveDirectCosts;
    }, 0);
    const computedExecCost = executionCosts.reduce((sum: number, ec: any) => sum + (ec.amount || 0), 0);
    const fallbackEstimatedCost = computedInputCost + computedExecCost;

    // Ưu tiên lấy estimated_cost tĩnh từ DB
    const estimatedCost = c.estimated_cost !== null && c.estimated_cost !== undefined
        ? Number(c.estimated_cost)
        : fallbackEstimatedCost;

    const totalInputCost = lineItems.reduce((sum: number, li: any) => sum + (li.inputPrice || 0) * (li.quantity || 1), 0);

    // Revenue calculations
    const actualRevenue = calculateRevenueFromPayments(
        payments, c.vat_rate ?? 10, c.has_vat !== false, c.actual_revenue || 0
    );

    const invoicedAmount = payments.length > 0
        ? calculateInvoicedFromPayments(payments)
        : (c.invoiced_amount || 0);

    const cashReceived = calculateCashReceived(payments);

    // Expected Revenue (Doanh thu dự kiến) = Sum(outputPrice * quantity) — pre-VAT
    const expectedRevenue = lineItems.reduce((sum: number, li: any) => sum + (li.outputPrice || 0) * (li.quantity || 1), 0);

    // Profit Metrics Calculations
    // LNG Quản trị = Doanh thu dự kiến - Chi phí dự kiến
    const fallbackAdminProfit = expectedRevenue - estimatedCost;
    const adminProfit = c.admin_profit !== null && c.admin_profit !== undefined
        ? Number(c.admin_profit)
        : fallbackAdminProfit;

    const revenueRatio = expectedRevenue > 0 ? (actualRevenue / expectedRevenue) : 0;
    const fallbackRevProfit = actualRevenue - (estimatedCost * revenueRatio);
    const revProfit = c.rev_profit !== null && c.rev_profit !== undefined
        ? Number(c.rev_profit)
        : fallbackRevProfit;


    // Compute warning flags (not stored in DB — derived from data)
    const today = new Date().toISOString().split('T')[0];
    const paymentSchedules = (c.payment_schedules as any)?.schedules || c.payment_schedules || [];

    // QH tạm ứng: kế hoạch tạm ứng quá hạn + chưa nhận tiền
    let isOverdueAdvance = false;
    if (Array.isArray(paymentSchedules)) {
        const advanceEntry = paymentSchedules.find((s: any) =>
            s.description && s.description.toLowerCase().includes('tạm ứng') &&
            s.date && s.date < today && s.amount > 0
        );
        if (advanceEntry && cashReceived === 0) isOverdueAdvance = true;
    }

    // QH thanh toán: đã xuất HĐ VAT + quá hạn due_date + tiền chưa về đủ
    let isOverduePayment = false;
    if (invoicedAmount > 0 && cashReceived < invoicedAmount) {
        const overdueInvoice = payments.find((p: any) =>
            ['Đã xuất HĐ', 'Tiền về', 'Paid'].includes(p.status) &&
            p.payment_type === 'INVOICE' &&
            p.due_date && p.due_date < today
        );
        if (overdueInvoice) isOverduePayment = true;
    }

    // Nghiệm thu chưa xuất HĐ: status = Acceptance nhưng không có VAT invoice
    const currentStatus = c.status || 'Processing';
    const isAcceptedNoInvoice = currentStatus === 'Acceptance' && invoicedAmount === 0;

    return {
        id: c.id || 'unknown',
        contractCode: c.contract_code || c.id || 'unknown',
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
        paymentTermDays: c.payment_term_days != null ? Number(c.payment_term_days) : undefined,
        unitId: c.unit_id || '',
        coordinatingUnitId: c.coordinating_unit_id || undefined,
        unitAllocations: c.unit_allocations?.allocations || undefined,
        employeeAllocations: c.employee_allocations || undefined,
        // Map from DB 'employee_id' (new) or 'salesperson_id' (legacy)
        salespersonId: c.employee_id || c.salesperson_id || undefined,
        value: c.value || 0,
        estimatedCost: estimatedCost,
        actualCost: c.actual_cost || 0,
        status: currentStatus,
        stage: c.stage || 'Signed',
        category: c.category || 'Mới',
        classification: c.classification || (c.is_dealer_sale ? 'Bán qua đại lý' : 'Thông thường'),
        signedDate: c.signed_date || '',
        startDate: c.start_date || '',
        endDate: c.end_date || '',
        content: c.content || '',
        contacts: c.contacts || [],
        milestones: c.milestones || [],
        paymentPhases: c.payment_phases || [],
        // Map details from JSONB (single source of truth)
        lineItems: lineItems,
        adminCosts: c.details?.adminCosts || undefined,
        executionCosts: executionCosts,
        revenueSchedules: c.details?.revenueSchedules || [],
        documents: c.documents || [],
        draft_url: c.draft_url || undefined,
        notes: c.notes || '',
        // Status transition dates
        suspendedDate: c.suspended_date || undefined,
        handoverDate: c.handover_date || undefined,
        acceptanceDate: c.acceptance_date || undefined,
        acceptanceValue: c.acceptance_value != null ? Number(c.acceptance_value) : undefined,
        completedDate: c.completed_date || undefined,
        // Revenue & Cash & Profit
        actualRevenue: actualRevenue,
        invoicedAmount: invoicedAmount,
        cashReceived: cashReceived,
        advanceAmount: calculateAdvanceAmount(payments),
        receivables: invoicedAmount - cashReceived,
        payables: calculatePayables(payments, totalInputCost),
        adminProfit: adminProfit,
        revProfit: revProfit,
        // Warning flags (computed)
        warnings: { isOverdueAdvance, isOverduePayment, isAcceptedNoInvoice },
        // Workflow steps
        workflowSteps: c.workflow_steps || undefined,
        // Legacy fields
        legal_approved: c.legal_approved || false,
        finance_approved: c.finance_approved || false
    };
};
