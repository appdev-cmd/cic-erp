import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import DateInput from './DateInput';

interface DatePromptDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (isoDate: string) => void;
    title: string;
    description?: string;
    icon?: React.ReactNode;
    confirmLabel?: string;
    colorScheme?: 'rose' | 'cyan' | 'orange' | 'amber';
}

/**
 * Dialog nhập ngày khi chuyển trạng thái HĐ (thay thế prompt() native bị browser chặn)
 */
const DatePromptDialog: React.FC<DatePromptDialogProps> = ({
    isOpen, onClose, onConfirm, title, description, icon, confirmLabel = 'Xác nhận', colorScheme = 'cyan'
}) => {
    const todayISO = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState(todayISO);

    useEffect(() => {
        if (isOpen) setDate(todayISO);
    }, [isOpen]);

    if (!isOpen) return null;

    const colors = {
        rose: {
            iconBg: 'bg-rose-100 dark:bg-rose-900/30',
            iconText: 'text-rose-600 dark:text-rose-400',
            btn: 'bg-rose-600 hover:bg-rose-700 shadow-rose-100',
        },
        cyan: {
            iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
            iconText: 'text-cyan-600 dark:text-cyan-400',
            btn: 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-100',
        },
        orange: {
            iconBg: 'bg-orange-100 dark:bg-orange-900/30',
            iconText: 'text-orange-600 dark:text-orange-400',
            btn: 'bg-orange-600 hover:bg-orange-700 shadow-orange-100',
        },
        amber: {
            iconBg: 'bg-amber-100 dark:bg-amber-900/30',
            iconText: 'text-amber-600 dark:text-amber-400',
            btn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-100',
        },
    };
    const c = colors[colorScheme];

    return (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${c.iconBg} flex items-center justify-center`}>
                            {icon || <Calendar size={20} className={c.iconText} />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                            {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Date Input */}
                <div className="mb-6">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        <Calendar size={12} /> Chọn ngày
                    </label>
                    <DateInput
                        value={date}
                        onChange={setDate}
                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={() => onConfirm(date)}
                        disabled={!date}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold text-white ${c.btn} transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg dark:shadow-none`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DatePromptDialog;
