/**
 * PAKD Import from Clipboard Paste Modal
 * Allows users to paste tab-separated data copied from Excel
 */
import React, { useState } from 'react';
import { ClipboardPaste, X, Loader2, CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { parsePAKDFromClipboard, ParsedPAKD } from '../../services/pakdExcelParser';
import { toast } from 'sonner';

interface PAKDClipboardPasteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (data: ParsedPAKD) => void;
}

export function PAKDClipboardPasteModal({ isOpen, onClose, onImport }: PAKDClipboardPasteModalProps) {
    const [pastedText, setPastedText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewData, setPreviewData] = useState<ParsedPAKD | null>(null);
    const [error, setError] = useState('');

    const handleParse = () => {
        if (!pastedText.trim()) {
            setError('Vui lòng dán dữ liệu từ Excel');
            return;
        }

        setIsProcessing(true);
        setError('');

        try {
            const parsed = parsePAKDFromClipboard(pastedText);
            if (parsed.lineItems.length === 0) {
                setError('Không tìm thấy hạng mục nào trong dữ liệu dán. Hãy kiểm tra lại.');
                setIsProcessing(false);
                return;
            }
            setPreviewData(parsed);
            toast.success(`Đã đọc ${parsed.lineItems.length} hạng mục từ clipboard`);
        } catch (err: any) {
            setError(err.message || 'Lỗi xử lý dữ liệu dán');
            console.error('[PAKDClipboardPaste] Error:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirmImport = () => {
        if (!previewData) return;
        onImport(previewData);
        handleClose();
    };

    const handleClose = () => {
        setPastedText('');
        setPreviewData(null);
        setError('');
        onClose();
    };

    const formatVND = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(Math.round(amount));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden m-4 flex flex-col animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                            <ClipboardPaste className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Paste dữ liệu từ Excel</h3>
                            <p className="text-xs text-slate-500">Copy bảng PAKD trong Excel rồi dán vào đây</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {!previewData ? (
                        <div className="space-y-4">
                            <div className="bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-800 rounded-lg p-4">
                                <p className="text-xs text-violet-700 dark:text-violet-300 font-medium leading-relaxed">
                                    <b>Hướng dẫn:</b> Mở file PAKD trong Excel → Chọn toàn bộ bảng (Ctrl+A) → Copy (Ctrl+C) → Dán vào ô bên dưới (Ctrl+V)
                                </p>
                            </div>

                            <textarea
                                value={pastedText}
                                onChange={(e) => { setPastedText(e.target.value); setError(''); }}
                                placeholder="Dán dữ liệu Excel tại đây... (Ctrl+V)"
                                rows={12}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all resize-none"
                                autoFocus
                            />

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg">
                                    <AlertTriangle size={14} className="text-rose-500 flex-shrink-0" />
                                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleParse}
                                    disabled={isProcessing || !pastedText.trim()}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-lg font-bold text-sm hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isProcessing ? (
                                        <><Loader2 size={16} className="animate-spin" /> Đang xử lý...</>
                                    ) : (
                                        <><FileSpreadsheet size={16} /> Phân tích dữ liệu</>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Financial Summary */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                                    <p className="text-[10px] text-emerald-600 uppercase font-bold">Doanh thu</p>
                                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{formatVND(previewData.financials.revenue)} đ</p>
                                </div>
                                <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-lg border border-rose-100 dark:border-rose-800/50">
                                    <p className="text-[10px] text-rose-600 uppercase font-bold">Chi phí</p>
                                    <p className="text-lg font-black text-rose-700 dark:text-rose-400">{formatVND(previewData.financials.costs)} đ</p>
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                                    <p className="text-[10px] text-indigo-600 uppercase font-bold">Lợi nhuận</p>
                                    <p className="text-lg font-black text-indigo-700 dark:text-indigo-400">{formatVND(previewData.financials.profit)} đ</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-800/50">
                                    <p className="text-[10px] text-amber-600 uppercase font-bold">Tỷ lệ LN</p>
                                    <p className="text-lg font-black text-amber-700 dark:text-amber-400">{previewData.financials.margin}%</p>
                                </div>
                            </div>

                            {/* Line Items Table */}
                            <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800">
                                        <tr>
                                            <th className="py-3 px-4 text-left font-bold text-slate-500 uppercase">STT</th>
                                            <th className="py-3 px-4 text-left font-bold text-slate-500 uppercase">Tên Hạng mục</th>
                                            <th className="py-3 px-4 text-left font-bold text-slate-500 uppercase">NCC</th>
                                            <th className="py-3 px-4 text-right font-bold text-slate-500 uppercase">Số lượng</th>
                                            <th className="py-3 px-4 text-right font-bold text-slate-500 uppercase">VAT</th>
                                            <th className="py-3 px-4 text-right font-bold text-slate-500 uppercase">Thành tiền (Ra)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {previewData.lineItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="py-3 px-4 text-slate-500">{item.stt}</td>
                                                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{item.name}</td>
                                                <td className="py-3 px-4 text-slate-500">{item.supplier}</td>
                                                <td className="py-3 px-4 text-right">{item.quantity}</td>
                                                <td className="py-3 px-4 text-right text-slate-500">{previewData.financials.vatRate ?? 10}%</td>
                                                <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatVND(item.totalPrice)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer (only for preview) */}
                {previewData && (
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 dark:border-slate-800">
                        <button
                            onClick={() => setPreviewData(null)}
                            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                        >
                            Quay lại
                        </button>
                        <button
                            onClick={handleConfirmImport}
                            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-lg font-bold text-sm hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/20"
                        >
                            <CheckCircle size={16} />
                            Xác nhận Import
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
