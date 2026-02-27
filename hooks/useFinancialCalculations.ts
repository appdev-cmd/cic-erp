import { useMemo } from 'react';
import { LineItem, AdministrativeCosts, ExecutionCostItem } from '../types';

export interface FinancialTotals {
    signingValue: number;
    estimatedRevenue: number;
    totalCosts: number;
    grossProfit: number;
    profitMargin: number;
    totalInput: number;
    totalDirectCosts: number;
    adminSum: number;
    executionCostsSum: number;
    supplierDiscountAmount: number;
}

/**
 * Shared hook for financial calculations.
 * Pure computed values from line items, admin costs, and execution costs.
 * Used by both ContractForm and ContractBusinessPlanTab.
 */
export function useFinancialCalculations(
    lineItems: LineItem[],
    adminCosts: AdministrativeCosts,
    executionCosts: ExecutionCostItem[] = [],
): FinancialTotals {
    return useMemo(() => {
        let signingValue = 0;
        let totalInput = 0;
        let totalDirectCosts = 0;
        let totalSupplierDiscount = 0;
        let estimatedRevenue = 0;

        lineItems.forEach(item => {
            const itemOutputTotal = item.quantity * item.outputPrice;
            const itemInputTotal = item.quantity * item.inputPrice;
            const itemVatRate = item.vatRate ?? 10;
            const itemDiscount = item.supplierDiscount ?? 0;

            signingValue += itemOutputTotal;
            totalInput += itemInputTotal;
            totalDirectCosts += item.directCosts;
            totalSupplierDiscount += itemInputTotal * (itemDiscount / 100);
            // Doanh thu = giá đầu ra / (1 + VAT%) cho từng SP
            estimatedRevenue += itemVatRate > 0
                ? itemOutputTotal / (1 + itemVatRate / 100)
                : itemOutputTotal;
        });

        // Admin costs (legacy)
        const adminSum = (Object.values(adminCosts) as number[])
            .reduce((acc: number, val: number) => acc + val, 0);

        // Execution costs (Chi phí thực hiện hợp đồng - dynamic list)
        const executionCostsSum = executionCosts.reduce((acc, c) => acc + (c.amount || 0), 0);

        // Total costs = Đầu vào + CP trực tiếp + CP thực hiện - Chiết khấu NCC (per item)
        const totalCosts = totalInput + totalDirectCosts + executionCostsSum - totalSupplierDiscount;
        const grossProfit = signingValue - totalCosts;
        const profitMargin = signingValue > 0 ? (grossProfit / signingValue) * 100 : 0;

        return {
            signingValue, estimatedRevenue, totalCosts, grossProfit, profitMargin,
            totalInput, totalDirectCosts, adminSum, executionCostsSum,
            supplierDiscountAmount: totalSupplierDiscount,
        };
    }, [lineItems, adminCosts, executionCosts]);
}
