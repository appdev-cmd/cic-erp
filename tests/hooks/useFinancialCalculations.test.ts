import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFinancialCalculations } from '../../hooks/useFinancialCalculations';
import { LineItem, AdministrativeCosts, ExecutionCostItem } from '../../types';

const makeLineItem = (overrides: Partial<LineItem> = {}): LineItem => ({
    id: '1',
    name: 'Test Product',
    quantity: 1,
    supplier: '',
    inputPrice: 100,
    outputPrice: 200,
    directCosts: 0,
    directCostDetails: [],
    vatRate: 10,
    supplierDiscount: 0,
    ...overrides,
});

const defaultAdminCosts: AdministrativeCosts = {
    transferFee: 0, contractorTax: 0, importFee: 0,
    expertHiring: 0, documentProcessing: 0,
};

describe('useFinancialCalculations', () => {
    it('calculates basic totals correctly', () => {
        const items: LineItem[] = [
            makeLineItem({ quantity: 10, inputPrice: 100, outputPrice: 200 }),
        ];

        const { result } = renderHook(() =>
            useFinancialCalculations(items, defaultAdminCosts, [])
        );

        expect(result.current.signingValue).toBe(2000);
        expect(result.current.totalInput).toBe(1000);
        expect(result.current.totalCosts).toBe(1000);
        expect(result.current.grossProfit).toBe(1000);
        expect(result.current.profitMargin).toBe(50);
    });

    it('calculates VAT-adjusted revenue correctly', () => {
        const items: LineItem[] = [
            makeLineItem({ quantity: 1, outputPrice: 1100, vatRate: 10 }),
        ];

        const { result } = renderHook(() =>
            useFinancialCalculations(items, defaultAdminCosts, [])
        );

        expect(result.current.signingValue).toBe(1100);
        expect(result.current.estimatedRevenue).toBe(1000);
    });

    it('handles 0% VAT items', () => {
        const items: LineItem[] = [
            makeLineItem({ quantity: 1, outputPrice: 1000, vatRate: 0 }),
        ];

        const { result } = renderHook(() =>
            useFinancialCalculations(items, defaultAdminCosts, [])
        );

        expect(result.current.estimatedRevenue).toBe(1000);
    });

    it('includes execution costs in total', () => {
        const items: LineItem[] = [
            makeLineItem({ quantity: 1, inputPrice: 100, outputPrice: 200 }),
        ];
        const execCosts: ExecutionCostItem[] = [
            { id: '1', name: 'Travel', amount: 50 },
            { id: '2', name: 'Insurance', amount: 30 },
        ];

        const { result } = renderHook(() =>
            useFinancialCalculations(items, defaultAdminCosts, execCosts)
        );

        expect(result.current.executionCostsSum).toBe(80);
        expect(result.current.totalCosts).toBe(180); // 100 input + 80 exec
        expect(result.current.grossProfit).toBe(20); // 200 - 180
    });

    it('applies supplier discount per item', () => {
        const items: LineItem[] = [
            makeLineItem({ quantity: 10, inputPrice: 100, outputPrice: 200, supplierDiscount: 10 }),
        ];

        const { result } = renderHook(() =>
            useFinancialCalculations(items, defaultAdminCosts, [])
        );

        // Discount = 10 * 100 * 10% = 100
        expect(result.current.supplierDiscountAmount).toBe(100);
        expect(result.current.totalCosts).toBe(900); // 1000 input - 100 discount
        expect(result.current.grossProfit).toBe(1100); // 2000 - 900
    });

    it('handles empty line items gracefully', () => {
        const { result } = renderHook(() =>
            useFinancialCalculations([], defaultAdminCosts, [])
        );

        expect(result.current.signingValue).toBe(0);
        expect(result.current.totalCosts).toBe(0);
        expect(result.current.grossProfit).toBe(0);
        expect(result.current.profitMargin).toBe(0);
    });

    it('includes direct costs in total', () => {
        const items: LineItem[] = [
            makeLineItem({ quantity: 1, inputPrice: 100, outputPrice: 200, directCosts: 25 }),
        ];

        const { result } = renderHook(() =>
            useFinancialCalculations(items, defaultAdminCosts, [])
        );

        expect(result.current.totalDirectCosts).toBe(25);
        expect(result.current.totalCosts).toBe(125); // 100 input + 25 direct
    });

    it('handles multiple line items with different VAT rates', () => {
        const items: LineItem[] = [
            makeLineItem({ id: '1', quantity: 1, outputPrice: 1100, vatRate: 10 }),
            makeLineItem({ id: '2', quantity: 1, outputPrice: 1080, vatRate: 8 }),
        ];

        const { result } = renderHook(() =>
            useFinancialCalculations(items, defaultAdminCosts, [])
        );

        expect(result.current.signingValue).toBe(2180);
        // Revenue: 1100/1.1 + 1080/1.08 = 1000 + 1000 = 2000
        expect(result.current.estimatedRevenue).toBe(2000);
    });
});
