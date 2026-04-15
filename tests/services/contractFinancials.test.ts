import { describe, it, expect } from 'vitest';
import {
    calculateInvoicedFromPayments,
    calculateAdvanceAmount,
    calculateReceivables,
    calculatePayables,
} from '../../services/contractService';

// ============================================================================
// calculateInvoicedFromPayments
// ============================================================================
describe('calculateInvoicedFromPayments', () => {
    it('returns 0 for empty payments', () => {
        expect(calculateInvoicedFromPayments([])).toBe(0);
    });

    it('sums VAT_INVOICE payments with eligible statuses', () => {
        const payments = [
            { amount: 1_100_000, status: 'Đã xuất HĐ', voucher_type: 'VAT_INVOICE' },
            { amount: 2_200_000, status: 'Đã giao KH', voucher_type: 'VAT_INVOICE' },
        ];
        expect(calculateInvoicedFromPayments(payments)).toBe(3_300_000);
    });

    it('includes Tiền về and Paid statuses', () => {
        const payments = [
            { amount: 500_000, status: 'Tiền về', voucher_type: 'VAT_INVOICE' },
            { amount: 300_000, status: 'Paid', voucher_type: 'VAT_INVOICE' },
        ];
        expect(calculateInvoicedFromPayments(payments)).toBe(800_000);
    });

    it('excludes RECEIPT vouchers even if status eligible', () => {
        const payments = [
            { amount: 1_000_000, status: 'Đã xuất HĐ', voucher_type: 'RECEIPT' },
            { amount: 500_000, status: 'Đã xuất HĐ', voucher_type: 'VAT_INVOICE' },
        ];
        expect(calculateInvoicedFromPayments(payments)).toBe(500_000);
    });

    it('excludes EXPENSE vouchers', () => {
        const payments = [
            { amount: 200_000, status: 'Đã xuất HĐ', voucher_type: 'EXPENSE' },
            { amount: 800_000, status: 'Đã xuất HĐ', voucher_type: 'VAT_INVOICE' },
        ];
        expect(calculateInvoicedFromPayments(payments)).toBe(800_000);
    });

    it('returns 0 when no VAT_INVOICE type', () => {
        const payments = [
            { amount: 999_000, status: 'Đã xuất HĐ', voucher_type: 'RECEIPT' },
        ];
        expect(calculateInvoicedFromPayments(payments)).toBe(0);
    });

    it('handles non-numeric amount gracefully', () => {
        const payments = [
            { amount: null, status: 'Đã xuất HĐ', voucher_type: 'VAT_INVOICE' },
            { amount: undefined, status: 'Tiền về', voucher_type: 'VAT_INVOICE' },
        ];
        expect(calculateInvoicedFromPayments(payments)).toBe(0);
    });
});

// ============================================================================
// calculateAdvanceAmount
// ============================================================================
describe('calculateAdvanceAmount', () => {
    it('returns 0 for empty payments', () => {
        expect(calculateAdvanceAmount([])).toBe(0);
    });

    it('sums RECEIPT vouchers with Tạm ứng status', () => {
        const payments = [
            { amount: 300_000, status: 'Tạm ứng', voucher_type: 'RECEIPT' },
            { amount: 200_000, status: 'Tạm ứng', voucher_type: 'RECEIPT' },
        ];
        expect(calculateAdvanceAmount(payments)).toBe(500_000);
    });

    it('excludes Tiền về status (not advance)', () => {
        const payments = [
            { amount: 300_000, status: 'Tạm ứng', voucher_type: 'RECEIPT' },
            { amount: 200_000, status: 'Tiền về', voucher_type: 'RECEIPT' },
        ];
        expect(calculateAdvanceAmount(payments)).toBe(300_000);
    });

    it('excludes VAT_INVOICE vouchers with Tạm ứng status', () => {
        const payments = [
            { amount: 500_000, status: 'Tạm ứng', voucher_type: 'VAT_INVOICE' },
            { amount: 300_000, status: 'Tạm ứng', voucher_type: 'RECEIPT' },
        ];
        // Only RECEIPT type counts
        expect(calculateAdvanceAmount(payments)).toBe(300_000);
    });

    it('returns 0 when no advance payments exist', () => {
        const payments = [
            { amount: 1_000_000, status: 'Tiền về', voucher_type: 'RECEIPT' },
            { amount: 500_000, status: 'Đã xuất HĐ', voucher_type: 'VAT_INVOICE' },
        ];
        expect(calculateAdvanceAmount(payments)).toBe(0);
    });
});

// ============================================================================
// calculateReceivables
// ============================================================================
describe('calculateReceivables', () => {
    it('returns 0 for empty payments', () => {
        expect(calculateReceivables([])).toBe(0);
    });

    it('calculates invoiced minus cash received', () => {
        const payments = [
            // Invoiced 1.1M (after VAT)
            { amount: 1_100_000, status: 'Đã xuất HĐ', voucher_type: 'VAT_INVOICE' },
            // Cash received 500k
            { amount: 500_000, status: 'Tiền về', voucher_type: 'RECEIPT' },
        ];
        // Receivables = 1,100,000 - 500,000 = 600,000
        expect(calculateReceivables(payments)).toBe(600_000);
    });

    it('returns 0 when all invoices are paid', () => {
        const payments = [
            { amount: 1_000_000, status: 'Đã xuất HĐ', voucher_type: 'VAT_INVOICE' },
            { amount: 1_000_000, status: 'Tiền về', voucher_type: 'RECEIPT' },
        ];
        expect(calculateReceivables(payments)).toBe(0);
    });

    it('returns negative when cash exceeds invoiced (advance scenario)', () => {
        const payments = [
            { amount: 500_000, status: 'Đã xuất HĐ', voucher_type: 'VAT_INVOICE' },
            { amount: 1_000_000, status: 'Tiền về', voucher_type: 'RECEIPT' },
        ];
        // Cash > Invoiced → negative receivable
        expect(calculateReceivables(payments)).toBe(-500_000);
    });

    it('only counts eligible voucher types', () => {
        const payments = [
            { amount: 2_000_000, status: 'Đã xuất HĐ', voucher_type: 'EXPENSE' }, // excluded
            { amount: 1_000_000, status: 'Đã xuất HĐ', voucher_type: 'VAT_INVOICE' },
            { amount: 300_000, status: 'Tiền về', voucher_type: 'RECEIPT' },
        ];
        expect(calculateReceivables(payments)).toBe(700_000);
    });
});

// ============================================================================
// calculatePayables
// ============================================================================
describe('calculatePayables', () => {
    it('returns totalInputCost when no payments', () => {
        expect(calculatePayables([], 5_000_000)).toBe(5_000_000);
    });

    it('subtracts paid EXPENSE vouchers from total input cost', () => {
        const payments = [
            { amount: 2_000_000, status: 'Đã chi', voucher_type: 'EXPENSE' },
        ];
        expect(calculatePayables(payments, 5_000_000)).toBe(3_000_000);
    });

    it('ignores EXPENSE vouchers with non-Đã-chi status', () => {
        const payments = [
            { amount: 2_000_000, status: 'Chờ thanh toán', voucher_type: 'EXPENSE' },
            { amount: 1_000_000, status: 'Đã chi', voucher_type: 'EXPENSE' },
        ];
        // Only the Đã chi payment is subtracted
        expect(calculatePayables(payments, 5_000_000)).toBe(4_000_000);
    });

    it('ignores non-EXPENSE vouchers', () => {
        const payments = [
            { amount: 3_000_000, status: 'Đã chi', voucher_type: 'RECEIPT' },
            { amount: 1_000_000, status: 'Đã chi', voucher_type: 'EXPENSE' },
        ];
        expect(calculatePayables(payments, 5_000_000)).toBe(4_000_000);
    });

    it('returns 0 when all costs are paid', () => {
        const payments = [
            { amount: 5_000_000, status: 'Đã chi', voucher_type: 'EXPENSE' },
        ];
        expect(calculatePayables(payments, 5_000_000)).toBe(0);
    });

    it('handles 0 input cost', () => {
        const payments = [
            { amount: 1_000_000, status: 'Đã chi', voucher_type: 'EXPENSE' },
        ];
        expect(calculatePayables(payments, 0)).toBe(-1_000_000);
    });
});
