import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Download, X, CheckCircle, Loader2, Link2, ClipboardPaste } from 'lucide-react';
import { parsePAKDExcel, generatePAKDTemplate, ParsedPAKD } from '../../services/pakdExcelParser';
import { PAKDImportGoogleModal } from './PAKDImportGoogleModal';
import { PAKDClipboardPasteModal } from './PAKDClipboardPasteModal';
import { toast } from 'sonner';

interface PAKDImportButtonProps {
    onImport: (data: ParsedPAKD) => void;
    disabled?: boolean;
    isImporting?: boolean;
}

export function PAKDImportButton({ onImport, disabled }: PAKDImportButtonProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewData, setPreviewData] = useState<ParsedPAKD | null>(null);
    const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);

    const handleFileSelect = async (file: File) => {
        if (!file) return;

        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            toast.error('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
            return;
        }

        setIsProcessing(true);
        try {
            const parsed = await parsePAKDExcel(file);
            setPreviewData(parsed);
            toast.success(`Đã đọc ${parsed.lineItems.length} hạng mục từ file Excel`);
        } catch (error: any) {
            toast.error(error.message || 'Lỗi đọc file Excel');
            console.error('[PAKDImport] Error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirmImport = () => {
        if (!previewData) return;
        onImport(previewData);
        setPreviewData(null);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
        e.target.value = '';
    };

    const formatVND = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount);
    };

    return (
        <>
            {/* Compact Import Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
                    disabled={disabled || isProcessing}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all
                        ${disabled || isProcessing
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-white dark:bg-slate-700 text-indigo-600 hover:shadow-md dark:text-indigo-400'
                        }
                    `}
                    title="Import từ file PAKD Excel"
                >
                    {isProcessing ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <Upload size={14} />
                    )}
                    <span className="hidden sm:inline">File</span>
                </button>

                <button
                    onClick={() => !disabled && setIsGoogleModalOpen(true)}
                    disabled={disabled}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all
                        ${disabled
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-white dark:bg-slate-700 text-green-600 hover:shadow-md dark:text-green-400'
                        }
                    `}
                    title="Import từ Google Sheets link"
                >
                    <Link2 size={14} />
                    <span className="hidden sm:inline">Google Sheets</span>
                </button>

                <button
                    onClick={() => !disabled && setIsPasteModalOpen(true)}
                    disabled={disabled}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all
                        ${disabled
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-white dark:bg-slate-700 text-violet-600 hover:shadow-md dark:text-violet-400'
                        }
                    `}
                    title="Paste dữ liệu từ Excel clipboard"
                >
                    <ClipboardPaste size={14} />
                    <span className="hidden sm:inline">Paste</span>
                </button>

                <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" />

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        generatePAKDTemplate();
                        toast.success('Đồ tải template PAKD_Template_Unified.xlsx');
                    }}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                    title="Tải template Excel mẫu"
                >
                    <Download size={14} />
                </button>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleInputChange}
                className="hidden"
                disabled={disabled || isProcessing}
            />

            {/* Google Sheets Modal */}
            <PAKDImportGoogleModal
                isOpen={isGoogleModalOpen}
                onClose={() => setIsGoogleModalOpen(false)}
                onImport={(data) => {
                    onImport(data);
                    setIsGoogleModalOpen(false);
                }}
            />

            {/* Clipboard Paste Modal */}
            <PAKDClipboardPasteModal
                isOpen={isPasteModalOpen}
                onClose={() => setIsPasteModalOpen(false)}
                onImport={(data) => {
                    onImport(data);
                    setIsPasteModalOpen(false);
                }}
            />

            {/* Preview Modal for Local File */}
            {previewData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden m-4 flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                    <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">Xem trước PAKD từ File</h3>
                                    <p className="text-xs text-slate-500">{previewData.lineItems.length} hạng mục</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPreviewData(null)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Financial Summary */}
                            <div className="grid grid-cols-4 gap-4 mb-6">
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
                                                <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatVND(item.totalPrice)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setPreviewData(null)}
                                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                            >
                                <CheckCircle size={16} />
                                Xác nhận Import
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
