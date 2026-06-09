/**
 * PAKD Import from Google Sheets Modal
 * Allows users to paste a Google Sheets URL and import data
 */
import React, { useState } from 'react';
import { Link2, X, Download, Loader2, FileSpreadsheet, CheckCircle, AlertTriangle } from 'lucide-react';
import { fetchPAKDFromGoogleSheets, ParsedPAKD } from '../../services/pakdExcelParser';
import { getGoogleAccessToken } from '../../contexts/AuthContext';
import { toast } from 'sonner';

interface PAKDImportGoogleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (data: ParsedPAKD) => void;
}

export function PAKDImportGoogleModal({ isOpen, onClose, onImport }: PAKDImportGoogleModalProps) {
    const [url, setUrl] = useState('');
    const [isFetching, setIsFetching] = useState(false);
    const [previewData, setPreviewData] = useState<ParsedPAKD | null>(null);

    const googleToken = getGoogleAccessToken();

    const handleFetch = async () => {
        if (!url.trim()) {
            toast.error('Vui lòng nhập link Google Sheets');
            return;
        }

        if (!url.includes('docs.google.com/spreadsheets')) {
            toast.error('Link không hợp lệ. Vui lòng dán link Google Sheets.');
            return;
        }

        setIsFetching(true);
        try {
            const token = getGoogleAccessToken();
            console.log('[PAKD Google Import] Token available:', !!token, token ? `(${token.substring(0, 20)}...)` : '(none)');
            const parsed = await fetchPAKDFromGoogleSheets(url, token || undefined);
            setPreviewData(parsed);
            toast.success(`Đã tải ${parsed.lineItems.length} hạng mục từ Google Sheets`);
        } catch (error: any) {
            toast.error(error.message || 'Lỗi tải dữ liệu từ Google Sheets');
            console.error('[PAKD Google Import] Error:', error);
            console.error('[PAKD Google Import] Token was:', !!getGoogleAccessToken());
        } finally {
            setIsFetching(false);
        }
    };

    const handleConfirmImport = () => {
        if (!previewData) return;
        onImport(previewData);
        setPreviewData(null);
        setUrl('');
        onClose();
    };

    const formatVND = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <Link2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Import từ Google Sheets</h3>
                            <p className="text-xs text-slate-500">Dán link để lấy dữ liệu PAKD trực tiếp</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {!previewData ? (
                        <div className="space-y-6 max-w-2xl mx-auto py-8">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Dán link Google Sheets của bạn
                                </label>
                                {/* Token status indicator */}
                                <div className={`text-xs mb-2 flex items-center gap-1.5 ${googleToken ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    <span className={`inline-block w-2 h-2 rounded-full ${googleToken ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                    {googleToken ? 'Đã kết nối Google — có thể đọc file riêng tư' : 'Chưa có Google token — chỉ đọc được file public. Hãy đăng xuất rồi đăng nhập lại.'}
                                </div>
                                <div className="relative group">
                                    <input
                                        type="url"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        placeholder="https://docs.google.com/spreadsheets/d/..."
                                        className="w-full pl-4 pr-32 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all outline-none text-sm"
                                    />
                                    <button
                                        onClick={handleFetch}
                                        disabled={isFetching || !url}
                                        className={`
                                            absolute right-2 top-2 bottom-2 px-6 rounded-lg font-bold text-sm transition-all flex items-center gap-2
                                            ${isFetching || !url
                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/20'
                                            }
                                        `}
                                    >
                                        {isFetching ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            'Tải dữ liệu'
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                                <div className="flex gap-3">
                                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Hướng dẫn</p>
                                        <ul className="text-xs text-emerald-800/80 dark:text-emerald-300/80 space-y-1 list-disc pl-4">
                                            <li>Bạn chỉ cần có <b>quyền xem</b> Google Sheet này (được share hoặc qua link). <b>Không cần public.</b></li>
                                            <li>Dữ liệu phải đúng định dạng template PAKD của hệ thống.</li>
                                            <li>Nếu Sheet có nhiều tab, hệ thống sẽ lấy dữ liệu từ tab đầu tiên.</li>
                                            <li>Nếu gặp lỗi quyền, hãy thử <b>đăng xuất rồi đăng nhập lại</b>.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Preview Header */}
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-4">
                                    <div className="text-sm">
                                        <span className="text-slate-500">Hợp đồng:</span>{' '}
                                        <span className="font-bold text-indigo-600 uppercase">{previewData.header.contractNumber || '---'}</span>
                                    </div>
                                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                                    <div className="text-sm">
                                        <span className="text-slate-500">Khách hàng:</span>{' '}
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{previewData.header.customerName || '---'}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setPreviewData(null)}
                                    className="text-xs font-bold text-rose-500 hover:text-rose-600"
                                >
                                    Đổi Link khác
                                </button>
                            </div>

                            {/* Financial Summary */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-center">
                                    <p className="text-[10px] text-emerald-600 uppercase font-bold mb-1">Doanh thu</p>
                                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{formatVND(previewData.financials.revenue)} đ</p>
                                </div>
                                <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-lg border border-rose-100 dark:border-rose-900/30 text-center">
                                    <p className="text-[10px] text-rose-600 uppercase font-bold mb-1">Chi phí</p>
                                    <p className="text-lg font-black text-rose-700 dark:text-rose-400">{formatVND(previewData.financials.costs)} đ</p>
                                </div>
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900/30 text-center">
                                    <p className="text-[10px] text-indigo-600 uppercase font-bold mb-1">Lợi nhuận</p>
                                    <p className="text-lg font-black text-indigo-700 dark:text-indigo-400">{formatVND(previewData.financials.profit)} đ</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-900/30 text-center">
                                    <p className="text-[10px] text-amber-600 uppercase font-bold mb-1">Tỷ lệ LN</p>
                                    <p className="text-lg font-black text-amber-700 dark:text-amber-400">{previewData.financials.margin}%</p>
                                </div>
                            </div>

                            {/* Items Table */}
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
                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800 transition-colors">
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

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                        {previewData ? `Sẵn sàng import ${previewData.lineItems.length} hạng mục` : 'Vui lòng dán link để tiếp tục'}
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleConfirmImport}
                            disabled={!previewData}
                            className={`
                                flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all
                                ${!previewData
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/20'
                                }
                            `}
                        >
                            <CheckCircle size={18} />
                            Xác nhận Import
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
