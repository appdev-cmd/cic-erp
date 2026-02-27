/**
 * Shared utility functions for contract forms.
 * Extracted from ContractForm.tsx to reduce duplication.
 */

/** Format number as Vietnamese Dong currency string */
export const formatVND = (val: number): string =>
    new Intl.NumberFormat('vi-VN').format(Math.round(val));

/** Parse VND formatted string back to number */
export const parseVND = (str: string): number => {
    const cleaned = str.replace(/[^0-9-]/g, '');
    return parseInt(cleaned, 10) || 0;
};

/** Generate client initials from full name (max 5 chars) */
export const getClientInitials = (clientName: string): string => {
    if (!clientName) return 'KH';
    return clientName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 5);
};

/** Contract type prefixes for ID generation */
export const CONTRACT_TYPE_PREFIXES: Record<string, string> = {
    'HĐ': 'HĐ',
    'HĐNT': 'HĐNT',
    'PL': 'PL',
};

/** Status badge color mapping */
export const STATUS_COLORS: Record<string, string> = {
    'Pending': 'bg-yellow-500/20 text-yellow-400',
    'Active': 'bg-green-500/20 text-green-400',
    'Completed': 'bg-blue-500/20 text-blue-400',
    // CRM: Approval statuses hidden — will be re-enabled in CRM module
    // 'Pending_Review': 'bg-orange-500/20 text-orange-400',
    // 'Both_Approved': 'bg-teal-500/20 text-teal-400',
    // 'Pending_Sign': 'bg-purple-500/20 text-purple-400',
    // 'Rejected': 'bg-red-500/20 text-red-400',
};

/** Default empty admin costs object */
export const DEFAULT_ADMIN_COSTS = {
    transferFee: 0,
    contractorTax: 0,
    importFee: 0,
    expertHiring: 0,
    documentProcessing: 0,
};
