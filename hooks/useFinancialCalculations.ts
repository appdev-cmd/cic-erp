import { useMemo } from 'react';
import { LineItem, ExecutionCostItem } from '../types';
import { safeEval } from '../utils/formulaEval';

export interface FinancialTotals {
    signingValue: number;
    estimatedRevenue: number;
    totalCosts: number;
    grossProfit: number;
    profitMargin: number;
    totalInput: number;
    totalDirectCosts: number;
    executionCostsSum: number;
}

/**
 * Shared hook for financial calculations.
 * Pure computed values from line items and execution costs.
 * Used by ContractForm, ContractBusinessPlanTab, and ContractDetail.
 */
export function useFinancialCalculations(
    lineItems: LineItem[],
    executionCosts: ExecutionCostItem[] = [],
): FinancialTotals {
    return useMemo(() => {
        let signingValue = 0;
        let totalInput = 0;
        let totalDirectCosts = 0;
        let estimatedRevenue = 0;

        lineItems.forEach(item => {
            let exactOutputPrice = item.outputPrice;
            if (item.outputPriceFormula) {
                const evalPrice = safeEval(item.outputPriceFormula);
                if (!isNaN(evalPrice) && evalPrice > 0) exactOutputPrice = evalPrice;
            }
            let exactInputPrice = item.inputPrice;
            if (item.inputPriceFormula) {
                const evalPrice = safeEval(item.inputPriceFormula);
                if (!isNaN(evalPrice) && evalPrice > 0) exactInputPrice = evalPrice;
            }

            const itemOutputTotal = item.quantity * exactOutputPrice;
            const itemInputTotal = item.quantity * exactInputPrice;
            const itemVatRate = item.vatRate ?? 0;

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

        // Execution costs (Chi phí thực hiện hợp đồng)
        const executionCostsSum = executionCosts.reduce((acc, c) => acc + (c.amount || 0), 0);

        // Total costs = Đầu vào + CP trực tiếp + CP thực hiện
        const totalCosts = totalInput + totalDirectCosts + executionCostsSum;
        // Lợi nhuận gộp = Doanh thu (trước VAT) - Tổng chi phí
        const grossProfit = estimatedRevenue - totalCosts;
        const profitMargin = estimatedRevenue > 0 ? (grossProfit / estimatedRevenue) * 100 : 0;

        return {
            signingValue: Math.round(signingValue),
            estimatedRevenue: Math.round(estimatedRevenue),
            totalCosts: Math.round(totalCosts),
            grossProfit: Math.round(grossProfit),
            profitMargin,
            totalInput: Math.round(totalInput),
            totalDirectCosts: Math.round(totalDirectCosts),
            executionCostsSum: Math.round(executionCostsSum),
        };
    }, [lineItems, executionCosts]);
}
