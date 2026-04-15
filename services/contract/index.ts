/**
 * Contract Service — Modular Exports
 * 
 * This barrel re-exports sub-modules for direct, tree-shakable imports.
 * 
 * Usage:
 *   import { calculateRevenueFromPayments } from '@/services/contract';
 *   import { mapContract } from '@/services/contract/contractMapper';
 *   import { linkContracts } from '@/services/contract/contractRelations';
 */

// Financial calculators (pure functions)
export {
    isAll,
    getUnitSharePct,
    calculateRevenueFromPayments,
    calculateInvoicedFromPayments,
    calculateCashReceived,
    calculateAdvanceAmount,
    calculateReceivables,
    calculatePayables,
    getEmployeeSharePct,
} from './contractFinancials';

// DB → Frontend mapper
export { mapContract } from './contractMapper';

// Contract relations (link/unlink with approval)
export {
    getRelatedContracts,
    getOutgoingPendingLinks,
    getIncomingPendingLinks,
    linkContracts,
    approveLink,
    rejectLink,
    unlinkContracts,
} from './contractRelations';

// CRUD utilities (retry, validation, payload builder, audit log)
export {
    ERROR_MESSAGES,
    withRetry,
    validateContract,
    buildPayload,
    logOperation,
} from './contractUtils';
