import { ContractStatus } from '../types';

/**
 * Định dạng tiền tệ VND (làm tròn đến hàng đồng)
 */
export const formatVND = (amount: number): string => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount));
};

/**
 * Lấy style CSS tương ứng với trạng thái hợp đồng (dùng chung cho List, Detail, Form)
 */
export const getStatusColor = (status: ContractStatus | string): string => {
    switch (status) {
        case 'Active':
        case 'Processing':
        case 'Pending':
        case 'Reviewing':
        case 'Draft':
            return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800';
        case 'Pending_Review':
        case 'Pending_Sign':
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
        case 'Suspended':
            return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800';
        case 'Overdue_Advance':
            return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
        case 'Handover':
            return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800';
        case 'Acceptance':
        case 'Liquidated':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
        case 'Overdue_Payment':
            return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800';
        case 'Both_Approved':
        case 'Completed':
            return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
        case 'Expired':
            return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800';
        default:
            return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-800';
    }
};
