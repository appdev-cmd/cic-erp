import { useMemo } from 'react';
import { LineItem, AdministrativeCosts } from '../../types';

export interface ContractTotals {
    signingValue: number;
    estimatedRevenue: number;
    totalCosts: number;
    grossProfit: number;
    profitMargin: number;
    totalInput: number;
    totalDirectCosts: number;
    adminSum: number;
    supplierDiscount: number; // Chiết khấu từ NCC (giảm chi phí)
}

export interface UseContractCalculationsProps {
    lineItems: LineItem[];
    adminCosts: AdministrativeCosts;
    supplierDiscount?: number; // Chiết khấu từ NCC - separate from admin costs
    vatRate?: number; // Default 10%
}

/**
 * Hook to calculate contract financial totals
 * Extracted from ContractForm for reusability
 */
export function useContractCalculations({
    lineItems,
    adminCosts,
    supplierDiscount = 0,
    vatRate = 0.1,
}: UseContractCalculationsProps): ContractTotals {
    return useMemo(() => {
        // Sum of all output prices WITH VAT (signing value from line items)
        const lineItemsOutput = lineItems.reduce(
            (acc, item) => acc + (item.quantity * item.outputPrice * (1 + (item.vatRate ?? 10) / 100)),
            0
        );

        // TOTAL SIGNING VALUE = Line items output (incl VAT) + Supplier Discount
        // Supplier discount ADDS to revenue
        const signingValue = lineItemsOutput + supplierDiscount;

        // Sum of all input prices
        const totalInput = lineItems.reduce(
            (acc, item) => acc + (item.quantity * item.inputPrice),
            0
        );

        // Sum of all direct costs
        const totalDirectCosts = lineItems.reduce(
            (acc, item) => acc + item.directCosts,
            0
        );

        // Sum of administrative costs (pure admin costs, no supplierDiscount)
        const adminSum = (Object.values(adminCosts) as number[]).reduce(
            (acc: number, val: number) => acc + (typeof val === 'number' ? val : 0),
            0
        );

        // Revenue = tổng đầu ra chưa VAT
        const estimatedRevenue = lineItems.reduce(
            (acc, item) => acc + (item.quantity * item.outputPrice),
            0
        );

        // Total costs = input + direct + admin (supplier discount is NOT here anymore)
        const totalCosts = totalInput + totalDirectCosts + adminSum;

        // Gross profit = revenue (incl supplier discount) - costs
        const grossProfit = signingValue - totalCosts;
        const profitMargin = signingValue > 0 ? (grossProfit / signingValue) * 100 : 0;

        return {
            signingValue,
            estimatedRevenue,
            totalCosts,
            grossProfit,
            profitMargin,
            totalInput,
            totalDirectCosts,
            adminSum,
            supplierDiscount,
        };
    }, [lineItems, adminCosts, supplierDiscount, vatRate]);
}

/**
 * Utility to format numbers as VND currency
 */
export function formatVND(val: number): string {
    return new Intl.NumberFormat('vi-VN').format(Math.round(val));
}

/**
 * Calculate line item margin
 */
export function calculateLineMargin(item: LineItem): { margin: number; marginRate: number } {
    const inputTotal = item.quantity * item.inputPrice;
    const outputTotal = item.quantity * item.outputPrice;
    const margin = outputTotal - inputTotal - item.directCosts;
    const marginRate = outputTotal > 0 ? (margin / outputTotal) * 100 : 0;

    return { margin, marginRate };
}

/**
 * Generate contract ID from components
 */
export function generateContractId(
    unitCode: string,
    sequenceNumber: number,
    clientInitials: string,
    year: number
): string {
    const stt = sequenceNumber.toString().padStart(3, '0');
    return `HĐ_${stt}/${unitCode}_${clientInitials}_${year}`;
}

/**
 * Extract client initials from name
 */
export function getClientInitials(clientName: string, maxLength = 5): string {
    if (!clientName) return 'KH';
    return clientName
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, maxLength);
}

export default useContractCalculations;
