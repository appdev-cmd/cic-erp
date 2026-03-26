// Contract Form Sub-components
export { default as StepIndicator } from './StepIndicator';
export { default as FinancialSummary } from './FinancialSummary';
export { default as FormHeader } from './FormHeader';

// Step Components
export { default as ContractFormStep1 } from './ContractFormStep1';
export { default as ContractFormStep2 } from './ContractFormStep2';
export { default as ContractFormStep3 } from './ContractFormStep3';
export { default as DirectCostModal } from './DirectCostModal';

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
