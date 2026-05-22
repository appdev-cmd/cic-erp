/**
 * Contract Financial Calculators
 * 
 * Pure functions for calculating financial metrics from payment data.
 * Extracted from contractService.ts to reduce file size and improve reusability.
 */

/**
 * Case-insensitive check for "All" / "all" / "ALL" filter values.
 */
export const isAll = (value: string | undefined | null): boolean =>
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
 * Only counts VAT_INVOICE vouchers with status 'Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'.
 * RECEIPT payments are cash received (tiền về), NOT revenue.
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

    // Only count VAT_INVOICE vouchers as revenue (not RECEIPT which is cash received)
    const revenuePayments = payments.filter(
        (p: any) => p.voucher_type === 'VAT_INVOICE' &&
            ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'].includes(p.status)
    );

    let totalPreVat = 0;
    let fallbackGross = 0;

    for (const p of revenuePayments) {
        // Use precise amountBeforeVAT from line items if available
        if (p.vat_invoice_items && p.vat_invoice_items.length > 0) {
            totalPreVat += p.vat_invoice_items.reduce((s: number, item: any) => s + (Number(item.amountBeforeVAT) || 0), 0);
        } else {
            // Otherwise tally up gross amount for fallback division
            fallbackGross += (Number(p.amount) || 0);
        }
    }

    if (fallbackGross > 0) {
        const vatDivisor = hasVat && vatRate > 0 ? (1 + vatRate / 100) : 1;
        totalPreVat += Math.round(fallbackGross / vatDivisor);
    }

    return totalPreVat;
};

/**
 * Calculate invoiced amount from payments (VAT invoices issued).
 * Only counts VAT_INVOICE vouchers with status 'Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'.
 * RECEIPT payments are NOT invoiced revenue.
 */
export const calculateInvoicedFromPayments = (payments: any[]): number => {
    if (!payments || payments.length === 0) return 0;
    return payments
        .filter((p: any) => p.voucher_type === 'VAT_INVOICE' &&
            ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'].includes(p.status))
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
};

/**
 * Calculate cash received from RECEIPT vouchers (only money actually in bank)
 * Only counts RECEIPT vouchers with status 'Tiền về' or 'Tạm ứng'.
 */
export const calculateCashReceived = (payments: any[]): number => {
    return payments
        .filter((p: any) => p.voucher_type === 'RECEIPT' &&
            ['Tạm ứng', 'Tiền về', 'Paid'].includes(p.status))
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
};

/**
 * Calculate advance (Tạm ứng) amount — cash received via RECEIPT without VAT invoice.
 * Only counts RECEIPT vouchers with status 'Tạm ứng'.
 */
export const calculateAdvanceAmount = (payments: any[]): number => {
    return payments
        .filter((p: any) => p.voucher_type === 'RECEIPT' &&
            p.status === 'Tạm ứng')
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
};

/**
 * Calculate Receivables (Công nợ phải thu)
 * Total Invoiced Amount (After VAT) - Total Cash Received
 */
export const calculateReceivables = (payments: any[]): number => {
    const totalInvoiced = calculateInvoicedFromPayments(payments);
    const totalCash = calculateCashReceived(payments);
    return totalInvoiced - totalCash;
};

/**
 * Calculate Payables (Công nợ phải trả)
 * Total Input Cost - Total Expenses Paid
 */
export const calculatePayables = (payments: any[], totalInputCost: number): number => {
    const totalPaidExpenses = payments
        .filter((p: any) => p.voucher_type === 'EXPENSE' && p.status === 'Đã chi')
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    return totalInputCost - totalPaidExpenses;
};

/**
 * Helper: get employee's percentage within a contract (from employee_allocations)
 */
export const getEmployeeSharePct = (contract: any, targetEmployeeId: string): number => {
    const empAllocs: any[] = contract.employee_allocations || [];
    if (empAllocs.length === 0) {
        // Legacy: if contract's employee_id matches, 100%
        return contract.employee_id === targetEmployeeId ? 100 : 0;
    }
    const match = empAllocs.find((a: any) => a.employeeId === targetEmployeeId);
    if (match) return match.percent || 100;
    // Also check unit_allocations for support unit employees
    const unitAllocations: any[] = contract.unit_allocations?.allocations || [];
    const supportMatch = unitAllocations.find(
        (a: any) => a.role === 'support' && a.employeeId === targetEmployeeId
    );
    if (supportMatch) return 100; // support unit PIC gets 100% of their unit's share
    return 0;
};

/**
 * Calculate Expected Revenue (Doanh thu dự kiến trước thuế) from line items.
 * Sum of (outputPrice * quantity) for each line item.
 */
export const calculateExpectedRevenue = (lineItems: any[]): number => {
    if (!lineItems || lineItems.length === 0) return 0;
    return lineItems.reduce((sum: number, li: any) => {
        return sum + (Number(li.outputPrice) || 0) * (Number(li.quantity) || 1);
    }, 0);
};

/**
 * Calculate Admin Profit (LNG Quản trị)
 * expectedRevenue - estimatedCost
 */
export const calculateAdminProfit = (expectedRevenue: number, estimatedCost: number): number => {
    return Math.round(expectedRevenue - estimatedCost);
};

/**
 * Calculate Rev Profit (LNG theo DT)
 * (actualRevenue / expectedRevenue) * adminProfit
 */
export const calculateRevProfit = (
    actualRevenue: number,
    expectedRevenue: number,
    adminProfit: number
): number => {
    if (expectedRevenue <= 0) return 0;
    return Math.round((actualRevenue / expectedRevenue) * adminProfit);
};

/**
 * Calculate financial metrics for a contract within a specific time period.
 * Shared across getStatsFallback, getChartDataFallback, and unitService.getWithStats.
 */
export const calculatePeriodFinancials = (
    contract: any,
    isInPeriod: (dateStr: string | null | undefined) => boolean
): {
    revenueInPeriod: number;
    cashInPeriod: number;
    revProfitInPeriod: number;
} => {
    const payments = contract.payments || [];
    const val = contract.value || 0;
    const estimatedCost = contract.estimated_cost || 0;
    const hasVat = contract.has_vat !== false;
    const vatRate = contract.vat_rate ?? 10;

    // 1. Xác định Expected Revenue (Doanh thu dự kiến trước thuế)
    const expectedRevenue = contract.expected_revenue !== null && contract.expected_revenue !== undefined
        ? Number(contract.expected_revenue)
        : (hasVat && vatRate > 0 ? Math.round(val / (1 + vatRate / 100)) : val);

    // 2. Xác định Expected Admin Profit (Lợi nhuận gộp quản trị dự kiến)
    const expectedProfit = contract.admin_profit !== null && contract.admin_profit !== undefined
        ? Number(contract.admin_profit)
        : expectedRevenue - estimatedCost;

    // 3. Doanh thu thực tế trong kỳ (Revenue in Period)
    const revenuePayments = payments.filter(
        (p: any) => p.voucher_type === 'VAT_INVOICE' &&
            ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'].includes(p.status) &&
            isInPeriod(p.invoice_date || p.payment_date)
    );

    let revenueInPeriod = 0;
    revenuePayments.forEach((p: any) => {
        if (p.vat_invoice_items && p.vat_invoice_items.length > 0) {
            revenueInPeriod += p.vat_invoice_items.reduce((s: number, item: any) => s + (Number(item.amountBeforeVAT) || 0), 0);
        } else {
            const gross = Number(p.amount) || 0;
            const vatDivisor = hasVat && vatRate > 0 ? (1 + vatRate / 100) : 1;
            revenueInPeriod += Math.round(gross / vatDivisor);
        }
    });

    // 4. Tiền về thực tế trong kỳ (Cash in Period)
    const cashPayments = payments.filter(
        (p: any) => p.voucher_type === 'RECEIPT' &&
            ['Tạm ứng', 'Tiền về', 'Paid'].includes(p.status) &&
            isInPeriod(p.payment_date)
    );
    const cashInPeriod = cashPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

    // 5. Lợi nhuận gộp theo doanh thu trong kỳ (Revenue Profit in Period)
    let revProfitInPeriod = 0;
    if (expectedRevenue > 0) {
        const profitRatio = expectedProfit / expectedRevenue;
        revProfitInPeriod = revenueInPeriod * profitRatio;
    }

    return {
        revenueInPeriod,
        cashInPeriod,
        revProfitInPeriod
    };
};


