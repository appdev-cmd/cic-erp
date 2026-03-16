import React, { useState } from 'react';
import { X, AlertTriangle, Send } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    isLoading?: boolean;
}

export const RejectDialog: React.FC<Props> = ({ isOpen, onClose, onConfirm, isLoading = false }) => {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!reason.trim()) {
            setError('Vui lòng nhập lý do từ chối');
            return;
        }
        if (reason.trim().length < 10) {
            setError('Lý do từ chối cần ít nhất 10 ký tự');
            return;
        }
        onConfirm(reason.trim());
        setReason('');
        setError('');
    };

    const handleClose = () => {
        setReason('');
        setError('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Dialog */}
            <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                            <AlertTriangle className="text-rose-600" size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Từ chối PAKD</h3>
                            <p className="text-xs text-slate-500">PAKD sẽ chuyển về trạng thái "Đã từ chối"</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={18} className="text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Lý do từ chối <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => {
                            setReason(e.target.value);
                            setError('');
                        }}
                        placeholder="Nhập lý do từ chối để người lập PAKD biết cần chỉnh sửa gì..."
                        className={`w-full px-4 py-3 rounded-lg border text-sm resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-rose-200 ${error
                                ? 'border-rose-300 bg-rose-50'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800'
                            }`}
                        rows={4}
                        autoFocus
                    />
                    {error && (
                        <p className="mt-2 text-sm text-rose-600 flex items-center gap-1">
                            <AlertTriangle size={14} /> {error}
                        </p>
                    )}

                    {/* Quick Reasons */}
                    <div className="mt-3">
                        <p className="text-xs text-slate-400 mb-2">Lý do thường gặp:</p>
                        <div className="flex flex-wrap gap-2">
                            {[
                                'Thiếu thông tin sản phẩm',
                                'Tỷ suất lợi nhuận quá thấp',
                                'Cần bổ sung chứng từ',
                                'Sai giá đầu vào'
                            ].map((quickReason) => (
                                <button
                                    key={quickReason}
                                    onClick={() => setReason(quickReason)}
                                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                                >
                                    {quickReason}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-b-2xl">
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || !reason.trim()}
                        className="flex-1 px-4 py-2.5 text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-lg shadow-rose-200 dark:shadow-none transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Send size={14} />
                                Xác nhận Từ chối
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
