import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFinancialCalculations } from '../../hooks/useFinancialCalculations';
import { LineItem, ExecutionCostItem } from '../../types';

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
    ...overrides,
});

describe('useFinancialCalculations', () => {
    it('calculates basic totals correctly', () => {
        const items: LineItem[] = [
            makeLineItem({ quantity: 10, inputPrice: 100, outputPrice: 200 }),
        ];

        const { result } = renderHook(() =>
            useFinancialCalculations(items, [])
        );

        // signingValue = 200 × 10 × 1.1 (VAT 10%) = 2200
        expect(result.current.signingValue).toBe(2200);
        expect(result.current.totalInput).toBe(1000);
        expect(result.current.totalCosts).toBe(1000);
        // grossProfit = estimatedRevenue - totalCosts = 2000 - 1000 = 1000
        expect(result.current.grossProfit).toBe(1000);
        // profitMargin = grossProfit / estimatedRevenue × 100 = 50%
        expect(result.current.profitMargin).toBeCloseTo(50, 1);
    });

    it('calculates VAT-adjusted signing value and revenue correctly', () => {
        const items: LineItem[] = [
            makeLineItem({ quantity: 1, outputPrice: 1000, vatRate: 10 }),
        ];

        const { result } = renderHook(() =>
            useFinancialCalculations(items, [])
        );

        // signingValue = 1000 × 1 × 1.1 = 1100
        expect(result.current.signingValue).toBe(1100);
        // estimatedRevenue = outputPrice (chưa VAT) = 1000
        expect(result.current.estimatedRevenue).toBe(1000);
    });

    it('handles 0% VAT items', () => {
        const items: LineItem[] = [
            makeLineItem({ quantity: 1, outputPrice: 1000, vatRate: 0 }),
        ];

        const { result } = renderHook(() =>
            useFinancialCalculations(items, [])
        );

        // signingValue = 1000 × 1.0 = 1000 (no VAT)
        expect(result.current.signingValue).toBe(1000);
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
            useFinancialCalculations(items, execCosts)
        );

        expect(result.current.executionCostsSum).toBe(80);
        expect(result.current.totalCosts).toBe(180); // 100 input + 80 exec
        // estimatedRevenue = 200; grossProfit = 200 - 180 = 20
        expect(result.current.grossProfit).toBeCloseTo(20, 2);
    });

    it('handles empty line items gracefully', () => {
        const { result } = renderHook(() =>
            useFinancialCalculations([], [])
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
            useFinancialCalculations(items, [])
        );

        expect(result.current.totalDirectCosts).toBe(25);
        expect(result.current.totalCosts).toBe(125); // 100 input + 25 direct
    });

    it('handles multiple line items with different VAT rates', () => {
        const items: LineItem[] = [
            makeLineItem({ id: '1', quantity: 1, outputPrice: 1000, vatRate: 10 }),
            makeLineItem({ id: '2', quantity: 1, outputPrice: 1000, vatRate: 8 }),
        ];

        const { result } = renderHook(() =>
            useFinancialCalculations(items, [])
        );

        // signingValue = 1000×1.1 + 1000×1.08 = 1100 + 1080 = 2180
        expect(result.current.signingValue).toBe(2180);
        // estimatedRevenue = 1000 + 1000 = 2000
        expect(result.current.estimatedRevenue).toBe(2000);
    });
});
