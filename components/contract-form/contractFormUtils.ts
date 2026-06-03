/**
 * Shared utility functions for contract forms.
 * Extracted from ContractForm.tsx to reduce duplication.
 */

import { LineItem } from '../../types';

/** Format number as Vietnamese Dong currency string */
export const formatVND = (val: number): string =>
    new Intl.NumberFormat('vi-VN').format(Math.round(val));

/** Parse VND formatted string back to number */
export const parseVND = (str: string): number => {
    const cleaned = str.replace(/[^0-9-]/g, '');
    return parseInt(cleaned, 10) || 0;
};

/** Generate client initials from full name (max 5 chars) */
export const getClientInitials = (clientName: string, maxLength = 5): string => {
    if (!clientName) return 'KH';
    return clientName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, maxLength);
};

/** Calculate line item margin (per-item, ignores VAT) */
export const calculateLineMargin = (item: LineItem): { margin: number; marginRate: number } => {
    const inputTotal = item.quantity * item.inputPrice;
    const outputTotal = item.quantity * item.outputPrice;
    const margin = outputTotal - inputTotal - (item.directCosts || 0);
    const marginRate = outputTotal > 0 ? (margin / outputTotal) * 100 : 0;
    return { margin, marginRate };
};

/** Generate contract ID from components */
export const generateContractId = (
    unitCode: string,
    sequenceNumber: number,
    clientInitials: string,
    year: number
): string => {
    const stt = sequenceNumber.toString().padStart(3, '0');
    return `HĐ_${stt}/${unitCode}_${clientInitials}_${year}`;
};

/** Contract type prefixes for ID generation */
export const CONTRACT_TYPE_PREFIXES: Record<string, string> = {
    'HĐ': 'HĐ',
    'HĐNT': 'HĐNT',
    'PL': 'PL',
};

/** Status badge color mapping */
export const STATUS_COLORS: Record<string, string> = {
    'Draft': 'bg-slate-500/20 text-slate-400',
    'Pending_Review': 'bg-orange-500/20 text-orange-400',
    'Both_Approved': 'bg-teal-500/20 text-teal-400',
    'Pending_Sign': 'bg-purple-500/20 text-purple-400',
    'Pending': 'bg-yellow-500/20 text-yellow-400',
    'Processing': 'bg-blue-500/20 text-blue-400',
    'Active': 'bg-green-500/20 text-green-400',
    'Completed': 'bg-green-500/20 text-green-400',
    'Suspended': 'bg-yellow-500/20 text-yellow-400',
    'Cancelled': 'bg-red-500/20 text-red-400',
};

/** Default empty admin costs object */
export const DEFAULT_ADMIN_COSTS = {
    transferFee: 0,
    contractorTax: 0,
    importFee: 0,
    expertHiring: 0,
    documentProcessing: 0,
};

