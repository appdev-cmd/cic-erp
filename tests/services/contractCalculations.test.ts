import { describe, it, expect } from 'vitest';
import {
    calculateRevenueFromPayments,
    calculateCashReceived,
    getUnitSharePct,
} from '../../services/contractService';

// ============================================================================
// calculateRevenueFromPayments
// ============================================================================
describe('calculateRevenueFromPayments', () => {
    it('returns 0 for empty payments', () => {
        expect(calculateRevenueFromPayments([], 10, true, 0)).toBe(0);
    });

    it('calculates revenue from eligible payments with VAT exclusion', () => {
        const payments = [
            { amount: 110_000_000, status: 'Đã xuất HĐ', payment_type: 'Revenue' },
        ];
        // Revenue = 110M / 1.10 = 100M
        expect(calculateRevenueFromPayments(payments, 10, true, 0)).toBe(100_000_000);
    });

    it('returns full amount when hasVat is false', () => {
        const payments = [
            { amount: 100_000_000, status: 'Tiền về', payment_type: 'Revenue' },
        ];
        expect(calculateRevenueFromPayments(payments, 10, false, 0)).toBe(100_000_000);
    });

    it('ignores Expense payment_type', () => {
        const payments = [
            { amount: 50_000_000, status: 'Đã xuất HĐ', payment_type: 'Revenue' },
            { amount: 30_000_000, status: 'Đã xuất HĐ', payment_type: 'Expense' },
        ];
        // Only the Revenue payment: 50M / 1.10 ≈ 45_454_545.45
        const result = calculateRevenueFromPayments(payments, 10, true, 0);
        expect(result).toBeCloseTo(45_454_545.45, 0);
    });

    it('includes payments with status Tiền về', () => {
        const payments = [
            { amount: 55_000_000, status: 'Tiền về', payment_type: 'Revenue' },
        ];
        // 55M / 1.10 = 50M
        expect(calculateRevenueFromPayments(payments, 10, true, 0)).toBe(50_000_000);
    });

    it('falls back to actualRevenue when no payments', () => {
        const result = calculateRevenueFromPayments([], 10, true, 999_000);
        expect(result).toBe(999_000);
    });

    it('includes payments with no payment_type (defaults to Revenue)', () => {
        const payments = [
            { amount: 110_000_000, status: 'Đã xuất HĐ' },
        ];
        expect(calculateRevenueFromPayments(payments, 10, true, 0)).toBe(100_000_000);
    });
});

// ============================================================================
// calculateCashReceived
// ============================================================================
describe('calculateCashReceived', () => {
    it('returns 0 for empty payments', () => {
        expect(calculateCashReceived([])).toBe(0);
    });

    it('sums amount of Tiền về payments', () => {
        const payments = [
            { amount: 50_000_000, status: 'Tiền về', payment_type: 'Revenue' },
            { amount: 30_000_000, status: 'Tiền về', payment_type: 'Revenue' },
        ];
        expect(calculateCashReceived(payments)).toBe(80_000_000);
    });

    it('includes Paid status', () => {
        const payments = [
            { amount: 40_000_000, status: 'Paid', payment_type: 'Revenue' },
        ];
        expect(calculateCashReceived(payments)).toBe(40_000_000);
    });

    it('excludes Đã xuất HĐ payments (not cash yet)', () => {
        const payments = [
            { amount: 50_000_000, status: 'Đã xuất HĐ', payment_type: 'Revenue' },
            { amount: 30_000_000, status: 'Tiền về', payment_type: 'Revenue' },
        ];
        expect(calculateCashReceived(payments)).toBe(30_000_000);
    });

    it('excludes Expense payment_type from cash calculation', () => {
        const payments = [
            { amount: 100_000_000, status: 'Tiền về', payment_type: 'Revenue' },
            { amount: 50_000_000, status: 'Tiền về', payment_type: 'Expense' },
        ];
        expect(calculateCashReceived(payments)).toBe(100_000_000);
    });

    it('uses amount field (not paid_amount)', () => {
        const payments = [
            { amount: 100_000_000, paid_amount: 0, status: 'Tiền về', payment_type: 'Revenue' },
        ];
        // Should use amount, not paid_amount
        expect(calculateCashReceived(payments)).toBe(100_000_000);
    });

    it('includes Tạm ứng (advance) payments in cash', () => {
        const payments = [
            { amount: 60_000_000, status: 'Tạm ứng', payment_type: 'Revenue' },
            { amount: 40_000_000, status: 'Tiền về', payment_type: 'Revenue' },
        ];
        expect(calculateCashReceived(payments)).toBe(100_000_000);
    });
});

// ============================================================================
// getUnitSharePct
// ============================================================================
describe('getUnitSharePct', () => {
    it('returns 100% for lead unit without allocations', () => {
        const contract = { unit_id: 'unit-A' };
        expect(getUnitSharePct(contract, 'unit-A')).toBe(100);
    });

    it('returns lead percentage when available', () => {
        const contract = {
            unit_id: 'unit-A',
            unit_allocations: {
                allocations: [
                    { unitId: 'unit-A', role: 'lead', percent: 70 },
                    { unitId: 'unit-B', role: 'support', percent: 30 },
                ],
            },
        };
        expect(getUnitSharePct(contract, 'unit-A')).toBe(70);
    });

    it('returns support percentage for support units', () => {
        const contract = {
            unit_id: 'unit-A',
            unit_allocations: {
                allocations: [
                    { unitId: 'unit-A', role: 'lead', percent: 70 },
                    { unitId: 'unit-B', role: 'support', percent: 30 },
                ],
            },
        };
        expect(getUnitSharePct(contract, 'unit-B')).toBe(30);
    });

    it('returns 0 for unrelated unit', () => {
        const contract = { unit_id: 'unit-A' };
        expect(getUnitSharePct(contract, 'unit-C')).toBe(0);
    });

    it('returns 0 for support unit with zero percent', () => {
        const contract = {
            unit_id: 'unit-A',
            unit_allocations: {
                allocations: [
                    { unitId: 'unit-B', role: 'support', percent: 0 },
                ],
            },
        };
        expect(getUnitSharePct(contract, 'unit-B')).toBe(0);
    });

    it('returns 100% for lead unit with allocations but no explicit lead entry', () => {
        const contract = {
            unit_id: 'unit-A',
            unit_allocations: {
                allocations: [
                    { unitId: 'unit-B', role: 'support', percent: 30 },
                ],
            },
        };
        // Lead unit with allocations array but no explicit lead entry → defaults to 100
        expect(getUnitSharePct(contract, 'unit-A')).toBe(100);
    });
});
