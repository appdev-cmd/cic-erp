// Contract Form Sub-components
export { default as StepIndicator } from './StepIndicator';
export { default as FinancialSummary } from './FinancialSummary';
export { default as FormHeader } from './FormHeader';
export { PAKDImportButton } from './PAKDImportButton';

// Utilities (consolidated in contractFormUtils)
export {
    formatVND,
    calculateLineMargin,
    generateContractId,
    getClientInitials,
    parseVND,
    STATUS_COLORS,
    CONTRACT_TYPE_PREFIXES,
    DEFAULT_ADMIN_COSTS,
} from './contractFormUtils';

export interface FinancialTotals {
    signingValue: number;
    estimatedRevenue: number;
    totalCosts: number;
    grossProfit: number;
    profitMargin: number;
}
