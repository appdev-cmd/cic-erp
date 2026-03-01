import { ContractStatus } from '../types';

/**
 * Định dạng tiền tệ VND (làm tròn đến nghìn đồng)
 */
export const formatVND = (amount: number): string => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount / 1000) * 1000);
};

/**
 * Lấy style CSS tương ứng với trạng thái hợp đồng (dùng chung cho List, Detail, Form)
 */
export const getStatusColor = (status: ContractStatus | string): string => {
    switch (status) {
        case 'Active':
        case 'Processing':
            return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800';
        case 'Pending':
        case 'Pending_Review':
        case 'Pending_Sign':
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
        case 'Reviewing':
            return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800';
        case 'Suspended':
        case 'Expired':
            return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800';
        case 'Acceptance':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
        case 'Liquidated':
            return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800';
        case 'Both_Approved':
        case 'Completed':
            return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
        default:
            return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-800';
    }
};
