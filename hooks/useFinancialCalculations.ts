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
        let estimatedRevenue = 0;

        lineItems.forEach(item => {
            const itemOutputTotal = item.quantity * item.outputPrice;
            const itemInputTotal = item.quantity * item.inputPrice;
            const itemVatRate = item.vatRate ?? 10;

            // Giá trị ký HĐ = Đầu ra × (1 + VAT%) cho từng SP
            signingValue += itemOutputTotal * (1 + itemVatRate / 100);
            totalInput += itemInputTotal;
            // directCosts: dùng trực tiếp hoặc fallback từ directCostDetails
            const directVal = item.directCosts || 0;
            totalDirectCosts += directVal > 0 ? directVal
                : ((item as any).directCostDetails || []).reduce((s: number, d: any) => s + (d.amount || 0), 0);
            // Doanh thu = giá đầu ra chưa VAT
            estimatedRevenue += itemOutputTotal;
        });

        // Admin costs (legacy)
        const adminSum = (Object.values(adminCosts) as number[])
            .reduce((acc: number, val: number) => acc + val, 0);

        // Execution costs (Chi phí thực hiện hợp đồng - dynamic list)
        const executionCostsSum = executionCosts.reduce((acc, c) => acc + (c.amount || 0), 0);

        // Overhead: executionCosts ưu tiên, fallback adminCosts cho HĐ cũ
        const overheadSum = executionCostsSum > 0 ? executionCostsSum : adminSum;

        // Total costs = Đầu vào + CP trực tiếp + CP thực hiện/quản lý
        const totalCosts = totalInput + totalDirectCosts + overheadSum;
        // Lợi nhuận gộp = Doanh thu (trước VAT) - Tổng chi phí
        const grossProfit = estimatedRevenue - totalCosts;
        const profitMargin = estimatedRevenue > 0 ? (grossProfit / estimatedRevenue) * 100 : 0;

        return {
            signingValue, estimatedRevenue, totalCosts, grossProfit, profitMargin,
            totalInput, totalDirectCosts, adminSum, executionCostsSum,
        };
    }, [lineItems, adminCosts, executionCosts]);
}
