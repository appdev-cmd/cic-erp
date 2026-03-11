import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, Calendar, DollarSign } from 'lucide-react';
import DateInput from './DateInput';

interface AcceptanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { date: string; value: number }) => void;
    defaultValue: number; // Giá trị ký kết mặc định
}

/**
 * Dialog nhập ngày nghiệm thu và giá trị nghiệm thu khi chuyển trạng thái → Acceptance
 */
const AcceptanceDialog: React.FC<AcceptanceDialogProps> = ({ isOpen, onClose, onConfirm, defaultValue }) => {
    const todayISO = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState(todayISO);
    const [valueStr, setValueStr] = useState('');

    useEffect(() => {
        if (isOpen) {
            setDate(todayISO);
            setValueStr(new Intl.NumberFormat('vi-VN').format(Math.round(defaultValue)));
        }
    }, [isOpen, defaultValue]);

    const parseNumber = (str: string): number => {
        return Number(str.replace(/[.,\s]/g, '')) || 0;
    };

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^\d]/g, '');
        if (raw === '') {
            setValueStr('');
            return;
        }
        setValueStr(new Intl.NumberFormat('vi-VN').format(Number(raw)));
    };

    const handleConfirm = () => {
        const numValue = parseNumber(valueStr);
        onConfirm({ date, value: numValue });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <CheckCircle2 size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Nghiệm thu / Thanh lý</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Nhập thông tin nghiệm thu hợp đồng</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <div className="space-y-4">
                    {/* Ngày nghiệm thu */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            <Calendar size={12} /> Ngày nghiệm thu / thanh lý
                        </label>
                        <DateInput
                            value={date}
                            onChange={setDate}
                            className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                    </div>

                    {/* Giá trị nghiệm thu */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            <DollarSign size={12} /> Giá trị nghiệm thu (VND)
                        </label>
                        <input
                            type="text"
                            value={valueStr}
                            onChange={handleValueChange}
                            placeholder="Nhập giá trị..."
                            className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                            autoFocus
                        />
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            Mặc định bằng giá trị ký kết. Có thể sửa nếu giá trị nghiệm thu khác.
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end mt-6">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!date}
                        className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-100 dark:shadow-none"
                    >
                        <CheckCircle2 size={16} /> Xác nhận
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AcceptanceDialog;
