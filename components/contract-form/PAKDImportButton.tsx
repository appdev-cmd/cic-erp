import React, { useRef, useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Download, X, CheckCircle, Loader2, Sparkles, ImagePlus, Server, Key } from 'lucide-react';
import { parsePAKDExcel, generatePAKDTemplate, ParsedPAKD, PAKDLineItem as ParsedLineItem, PAKDAdminCosts, PAKDFinancials, PAKDExecutionCost } from '../../services/pakdExcelParser';
import { extractPAKDFromText, extractPAKDFromImage, PAKDExtraction, GeminiApiSource, hasPersonalGeminiKey } from '../../services/aiExtractService';
import { useAIPermission } from '../../hooks/useAIPermission';
import { toast } from 'sonner';

interface PAKDImportButtonProps {
    onImport: (data: ParsedPAKD) => void;
    disabled?: boolean;
    isImporting?: boolean;
}

/**
 * Convert PAKDExtraction (AI output) → ParsedPAKD (ContractForm input)
 */
function convertAIToParsedPAKD(ai: PAKDExtraction): ParsedPAKD {
    const lineItems: ParsedLineItem[] = ai.lineItems.map((item, idx) => ({
        id: `ai-${Date.now()}-${idx}`,
        stt: item.stt || idx + 1,
        name: item.name || '',
        supplier: item.supplier || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'VNĐ',
        unitCost: item.unitCost || 0,
        totalCost: item.totalCost || 0,
        unitPrice: item.unitPrice || 0,
        totalPrice: item.totalPrice || 0,
        importFee: item.importFee || 0,
        contractorTax: item.contractorTax || 0,
        transferFee: item.transferFee || 0,
        margin: item.margin || ((item.totalPrice || 0) - (item.totalCost || 0)),
        marginPercent: item.totalPrice ? Math.round(((item.margin || 0) / item.totalPrice) * 100 * 100) / 100 : 0,
        vatRate: 0,
    }));

    const totalCostSum = lineItems.reduce((sum, i) => sum + i.totalCost, 0);
    const totalPriceSum = lineItems.reduce((sum, i) => sum + i.totalPrice, 0);

    const adminCosts: PAKDAdminCosts = {
        bankFee: 0,
        subcontractorFee: 0,
        importLogistics: 0,
        expertFee: ai.financials?.expertFee || 0,
        documentFee: ai.financials?.documentFee || 0,
    };

    // Dynamic execution costs from AI extraction (ưu tiên)
    const executionCosts: PAKDExecutionCost[] = [];
    if (ai.executionCosts && ai.executionCosts.length > 0) {
        // Use dynamic execution costs from AI
        ai.executionCosts.forEach((c, idx) => {
            if (c.amount > 0) {
                executionCosts.push({
                    id: `ai-exec-${Date.now()}-${idx}`,
                    name: c.name,
                    amount: c.amount,
                });
            }
        });
    } else {
        // Fallback: build from fixed financials fields (backward compatibility)
        if (ai.financials?.expertFee) {
            executionCosts.push({ id: `ai-expert-${Date.now()}`, name: 'Phí thuê chuyên gia (net)', amount: ai.financials.expertFee });
        }
        if (ai.financials?.documentFee) {
            executionCosts.push({ id: `ai-doc-${Date.now()}`, name: 'Phí thanh toán chứng từ', amount: ai.financials.documentFee });
        }
        if (ai.financials?.completionBonus) {
            executionCosts.push({ id: `ai-bonus-${Date.now()}`, name: 'Thưởng hoàn thành dự án', amount: ai.financials.completionBonus });
        }
        if (ai.financials?.dealPromotion) {
            executionCosts.push({ id: `ai-promo-${Date.now()}`, name: 'Xúc tiến hợp đồng', amount: ai.financials.dealPromotion });
        }
        if (ai.financials?.managementSupport) {
            executionCosts.push({ id: `ai-mgmt-${Date.now()}`, name: 'Ban lãnh đạo hỗ trợ', amount: ai.financials.managementSupport });
        }
    }

    const financials: PAKDFinancials = {
        revenue: ai.financials?.revenue || totalPriceSum,
        costs: ai.financials?.totalCosts || totalCostSum,
        profit: ai.financials?.profit || (totalPriceSum - totalCostSum),
        margin: ai.financials?.marginRevenue || (totalPriceSum > 0 ? Math.round(((totalPriceSum - totalCostSum) / totalPriceSum) * 100 * 100) / 100 : 0),
        vatRate: 0,
        signingValue: ai.financials?.production || totalPriceSum,
    };

    return {
        header: {
            contractNumber: ai.contractNumber || '',
            customerName: ai.customerName || '',
        },
        lineItems,
        adminCosts,
        executionCosts,
        financials,
    };
}

export function PAKDImportButton({ onImport, disabled }: PAKDImportButtonProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewData, setPreviewData] = useState<ParsedPAKD | null>(null);

    // AI Modal state
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [aiText, setAIText] = useState('');
    const [aiImage, setAIImage] = useState<{ file: File; dataUrl: string } | null>(null);
    const [isAIProcessing, setIsAIProcessing] = useState(false);
    const aiPerm = useAIPermission();
    const [apiSource, setApiSource] = useState<GeminiApiSource>(aiPerm.defaultApiSource);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Sync apiSource when permission loads
    React.useEffect(() => {
        if (!aiPerm.isLoading) setApiSource(aiPerm.defaultApiSource);
    }, [aiPerm.isLoading, aiPerm.defaultApiSource]);

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

    // Handle paste in AI modal — capture images from clipboard
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;

                const reader = new FileReader();
                reader.onload = (ev) => {
                    setAIImage({
                        file,
                        dataUrl: ev.target?.result as string,
                    });
                    toast.success('📸 Đã dán ảnh! Click "Trích xuất" để AI phân tích');
                };
                reader.readAsDataURL(file);
                return; // Only handle first image
            }
        }
    }, []);

    const handleAIExtract = async () => {
        if (!aiText.trim() && !aiImage) {
            toast.error('Vui lòng nhập text hoặc dán ảnh PAKD trước');
            return;
        }
        setIsAIProcessing(true);
        try {
            let aiResult: PAKDExtraction;

            if (aiImage) {
                // Extract from image
                aiResult = await extractPAKDFromImage(aiImage.file, 'gemini', apiSource);
            } else {
                // Extract from text
                aiResult = await extractPAKDFromText(aiText, 'gemini', apiSource);
            }

            const parsed = convertAIToParsedPAKD(aiResult);
            onImport(parsed);
            toast.success(`🤖 AI đã trích xuất ${parsed.lineItems.length} hạng mục thành công!`);
            setIsAIModalOpen(false);
            setAIText('');
            setAIImage(null);
        } catch (error: any) {
            console.error('[AI PAKD Extract] Error:', error);
            toast.error('AI trích xuất thất bại: ' + (error.message || 'Unknown error'));
        } finally {
            setIsAIProcessing(false);
        }
    };

    const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount);

    return (
        <>
            {/* Compact Import Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                {/* AI Extract Button */}
                <button
                    onClick={() => !disabled && setIsAIModalOpen(true)}
                    disabled={disabled}
                    className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all
                        ${disabled
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-violet-500/20'
                        }
                    `}
                    title="Nạp PAKD bằng AI (dán text hoặc ảnh)"
                >
                    <Sparkles size={14} />
                    <span>AI Nạp PAKD</span>
                </button>

                {/* File Upload Button */}
                <button
                    onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
                    disabled={disabled || isProcessing}
                    className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all
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

                <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1" />

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        generatePAKDTemplate();
                        toast.success('Đã tải template PAKD_Template_Unified.xlsx');
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

            {/* AI Extract Modal */}
            {isAIModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden m-4 flex flex-col border border-slate-200 dark:border-slate-800">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl shadow-lg shadow-violet-500/20">
                                    <Sparkles size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">🤖 Nạp PAKD bằng AI</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Dán text hoặc <strong>ảnh chụp màn hình</strong> PAKD → AI trích xuất tự động
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setIsAIModalOpen(false); setAIText(''); setAIImage(null); }}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 flex-1 overflow-y-auto space-y-4" onPaste={handlePaste}>
                            {/* Image preview */}
                            {aiImage && (
                                <div className="relative rounded-xl overflow-hidden border-2 border-violet-300 dark:border-violet-600 bg-slate-50 dark:bg-slate-800">
                                    <img
                                        src={aiImage.dataUrl}
                                        alt="PAKD screenshot"
                                        className="max-h-64 w-full object-contain"
                                    />
                                    <button
                                        onClick={() => setAIImage(null)}
                                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                                        title="Xóa ảnh"
                                    >
                                        <X size={14} />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                                            <ImagePlus size={12} />
                                            Ảnh PAKD đã sẵn sàng — Click "Trích xuất" bên dưới
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                    <span>{aiImage ? 'Hoặc nhập thêm text bổ sung (tùy chọn)' : 'Nội dung PAKD (text hoặc Ctrl+V ảnh)'}</span>
                                    {!aiImage && (
                                        <span className="text-violet-500 dark:text-violet-400 normal-case font-medium flex items-center gap-1">
                                            <ImagePlus size={12} />
                                            Ctrl+V để dán ảnh
                                        </span>
                                    )}
                                </label>
                                <textarea
                                    ref={textareaRef}
                                    value={aiText}
                                    onChange={(e) => setAIText(e.target.value)}
                                    onPaste={handlePaste}
                                    placeholder={aiImage
                                        ? 'Ảnh đã sẵn sàng. Bạn có thể thêm ghi chú bổ sung tại đây (không bắt buộc)...'
                                        : `Dán nội dung PAKD vào đây (text hoặc Ctrl+V ảnh)...\n\nVí dụ:\nSTT | Tên SP | NCC | SL | Giá vào | Giá ra\n1 | Revit | Autodesk | 5 | 30.000.000 | 45.000.000\n2 | MapInfo | Advintek | 2 | 46.785.750 | 46.195.000\n...\nThuế nhà thầu: 10.396.833\nChuyển tiền: 732.858`}
                                    className="w-full h-48 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none transition-all"
                                    disabled={isAIProcessing}
                                />
                                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                    💡 <strong>Ảnh:</strong> Ctrl+V dán ảnh chụp màn hình Excel, PDF... &nbsp;|&nbsp; <strong>Text:</strong> Dán bảng từ Excel, email, tài liệu. AI sẽ tự nhận dạng.
                                </p>
                            </div>

                            {/* API Source Toggle */}
                            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Nguồn API:</span>
                                <div className="flex flex-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!aiPerm.canUseSystemApi) {
                                                toast.error('Bạn chưa được cấp quyền dùng API hệ thống. Liên hệ Admin.');
                                                return;
                                            }
                                            setApiSource('system');
                                        }}
                                        disabled={!aiPerm.canUseSystemApi}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${apiSource === 'system'
                                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 shadow-sm'
                                            : !aiPerm.canUseSystemApi
                                                ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        <Server size={12} />
                                        Hệ thống
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!hasPersonalGeminiKey()) {
                                                toast.error('Chưa có API Key cá nhân. Vui lòng nhập key trong Cài đặt AI (⚙️).');
                                                return;
                                            }
                                            setApiSource('personal');
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${apiSource === 'personal'
                                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        <Key size={12} />
                                        Cá nhân
                                    </button>
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
                                    {apiSource === 'system'
                                        ? (aiPerm.canUseSystemApi ? 'Dùng key hệ thống' : '❌ Không có quyền')
                                        : 'Dùng key cá nhân của bạn'
                                    }
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-3 p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                            <span className="text-xs text-slate-400">
                                {aiImage ? '📸 Ảnh đã dán' : (aiText.length > 0 ? `${aiText.length} ký tự` : '')}
                            </span>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { setIsAIModalOpen(false); setAIText(''); setAIImage(null); }}
                                    className="px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleAIExtract}
                                    disabled={isAIProcessing || (!aiText.trim() && !aiImage)}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${isAIProcessing || (!aiText.trim() && !aiImage)
                                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed shadow-none'
                                        : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-violet-500/30'
                                        }`}
                                >
                                    {isAIProcessing ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            {aiImage ? 'Đang phân tích ảnh...' : 'Đang trích xuất...'}
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={16} />
                                            Trích xuất bằng AI
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal for Local File */}
            {previewData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden m-4 flex flex-col">
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
                            <button onClick={() => setPreviewData(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
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
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 dark:border-slate-800">
                            <button onClick={() => setPreviewData(null)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">Hủy</button>
                            <button onClick={handleConfirmImport} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20">
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
