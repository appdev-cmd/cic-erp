import { ContractStatus, ContractWarnings } from '../types';

/**
 * Định dạng tiền tệ VND (làm tròn đến hàng đồng)
 */
export const formatVND = (amount: number): string => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount));
};

/**
 * Format tiền tệ VND dạng compact cho bảng hẹp
 * Ví dụ: 4,011,000,000 → "4.01 tỷ", 208,840,000 → "208.8 tr", 54,850,000 → "54.8 tr"
 * Số < 1 triệu hiển thị đầy đủ
 */
export const formatCompactVND = (amount: number): string => {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (abs >= 1_000_000_000) {
        const val = abs / 1_000_000_000;
        return sign + (val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2)) + ' tỷ';
    }
    if (abs >= 1_000_000) {
        const val = abs / 1_000_000;
        return sign + (val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(1)) + ' tr';
    }
    if (abs >= 1_000) {
        return sign + Math.round(abs / 1_000).toLocaleString('vi-VN') + ' ng';
    }
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
        case 'Pending_Review':
        case 'Pending_Sign':
        case 'Overdue_Advance':
        case 'Overdue_Payment':
            return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800';
        case 'Suspended':
            return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800';
        case 'Handover':
            return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800';
        case 'Acceptance':
        case 'Liquidated':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
        case 'PendingSettlement':
            return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-800';
        case 'Both_Approved':
        case 'Completed':
            return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
        default:
            return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-800';
    }
};

/**
 * Trả về danh sách cảnh báo với label + CSS cho hiển thị trên UI
 */
export const getWarningBadges = (warnings?: ContractWarnings): { label: string; icon: string; color: string }[] => {
    if (!warnings) return [];
    const badges: { label: string; icon: string; color: string }[] = [];

    if (warnings.isOverdueAdvance) {
        badges.push({
            label: 'QH tạm ứng',
            icon: '⚠️',
            color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
        });
    }
    if (warnings.isOverduePayment) {
        badges.push({
            label: 'QH thanh toán',
            icon: '🔴',
            color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
        });
    }
    if (warnings.isAcceptedNoInvoice) {
        badges.push({
            label: 'Chưa xuất HĐ',
            icon: '📋',
            color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
        });
    }

    return badges;
};
