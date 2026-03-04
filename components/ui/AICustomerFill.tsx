import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, Upload, Link2, Loader2, CheckCircle2, AlertCircle, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { AIExtractService, ExtractModel, EXTRACT_MODELS } from '../../services/aiExtractService';
import { Customer } from '../../types';

interface AICustomerFillProps {
    onExtracted: (data: Partial<Customer>) => void;
    compact?: boolean;
}

const AICustomerFill: React.FC<AICustomerFillProps> = ({ onExtracted, compact = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputText, setInputText] = useState('');
    const [pastedImage, setPastedImage] = useState<{ dataUrl: string; file: File } | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractStatus, setExtractStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [selectedModel, setSelectedModel] = useState<ExtractModel>('gemini');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Handle Paste (Ctrl+V screenshot) — document level ─
    useEffect(() => {
        if (!isOpen) return;

        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    e.preventDefault();
                    const file = items[i].getAsFile();
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        setPastedImage({ dataUrl: ev.target?.result as string, file });
                        toast.success('Đã dán ảnh! Nhấn "Trích xuất" để phân tích.');
                    };
                    reader.readAsDataURL(file);
                    return;
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [isOpen]);

    // ─── Process extraction ──────────────────────────────
    const processExtraction = useCallback(async () => {
        if (isExtracting) return;
        setIsExtracting(true);
        setExtractStatus('idle');

        try {
            let data: Partial<Customer>;

            if (pastedImage) {
                data = await AIExtractService.extractFromImage(pastedImage.file, selectedModel);
            } else {
                const text = inputText.trim();
                if (!text) {
                    toast.error('Vui lòng nhập link hoặc thông tin');
                    return;
                }
                if (text.match(/^https?:\/\//i) || text.match(/masothue\.com|thongtindoanhnghiep/i)) {
                    const url = text.startsWith('http') ? text : `https://${text}`;
                    data = await AIExtractService.extractFromURL(url, selectedModel);
                } else {
                    data = await AIExtractService.extractFromText(text, selectedModel);
                }
            }

            onExtracted(data);
            setExtractStatus('success');
            toast.success(`Đã trích xuất: ${data.name || 'Chưa có tên'}`);

            // Reset after success
            setInputText('');
            setPastedImage(null);
            setTimeout(() => setExtractStatus('idle'), 3000);
        } catch (err: any) {
            setExtractStatus('error');
            toast.error(`Lỗi: ${err.message}`);
            setTimeout(() => setExtractStatus('idle'), 3000);
        } finally {
            setIsExtracting(false);
        }
    }, [inputText, pastedImage, selectedModel, isExtracting, onExtracted]);

    // ─── Handle File Upload ──────────────────────────────
    const handleFileSelect = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Chỉ hỗ trợ file ảnh');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            setPastedImage({ dataUrl: e.target?.result as string, file });
        };
        reader.readAsDataURL(file);
    }, []);

    // ─── Key Handler ─────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            processExtraction();
        }
    };

    return (
        <div className="mb-4">
            {/* Toggle Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer border",
                    isOpen
                        ? "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-200 dark:hover:border-violet-800 hover:text-violet-700 dark:hover:text-violet-300"
                )}
            >
                <span className="flex items-center gap-2">
                    <Sparkles size={14} className={isOpen ? "text-violet-500" : "text-slate-400 dark:text-slate-500"} />
                    🤖 Nạp nhanh bằng AI
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 ml-1">
                        Dán ảnh · Link masothue · Text
                    </span>
                </span>
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Expandable Panel */}
            {isOpen && (
                <div className="mt-2 p-3 bg-violet-50/50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800/50 rounded-lg space-y-3 animate-in slide-in-from-top-2 duration-200">
                    {/* Pasted Image Preview */}
                    {pastedImage && (
                        <div className="flex items-center gap-3 p-2 bg-white dark:bg-slate-800 border border-violet-200 dark:border-violet-700 rounded-lg">
                            <img src={pastedImage.dataUrl} alt="Pasted" className="h-12 rounded-md object-contain shadow" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-violet-700 dark:text-violet-300 truncate">📸 Ảnh đã dán</p>
                                <p className="text-[10px] text-violet-500 dark:text-violet-400">Nhấn "Trích xuất" để phân tích</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPastedImage(null)}
                                className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                            >✕</button>
                        </div>
                    )}

                    {/* Input Row */}
                    <div className="flex gap-2">
                        {/* Upload Button */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isExtracting}
                            className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-violet-100 dark:hover:bg-violet-900/30 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                            title="Upload ảnh"
                        >
                            <ImageIcon size={15} />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(file);
                                e.target.value = '';
                            }}
                        />

                        {/* Model Selector */}
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value as ExtractModel)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 py-1 px-2 rounded-lg cursor-pointer focus:outline-none transition-all shrink-0"
                            title="Chọn Model AI"
                            disabled={isExtracting}
                        >
                            {(Object.entries(EXTRACT_MODELS) as [ExtractModel, typeof EXTRACT_MODELS[ExtractModel]][]).map(([key, m]) => (
                                <option key={key} value={key}>{m.emoji} {m.label}</option>
                            ))}
                        </select>

                        {/* Text Input */}
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Dán ảnh (Ctrl+V), link masothue.com, hoặc mô tả..."
                            className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-violet-400 dark:focus:border-violet-600 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all min-w-0"
                            disabled={isExtracting}
                        />

                        {/* Extract Button */}
                        <button
                            type="button"
                            onClick={processExtraction}
                            disabled={isExtracting || (!inputText.trim() && !pastedImage)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0",
                                extractStatus === 'success'
                                    ? "bg-emerald-600 text-white"
                                    : extractStatus === 'error'
                                        ? "bg-rose-600 text-white"
                                        : (inputText.trim() || pastedImage)
                                            ? "bg-violet-600 hover:bg-violet-700 text-white shadow-md"
                                            : "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                            )}
                            title="Trích xuất bằng AI"
                        >
                            {isExtracting ? (
                                <><Loader2 size={13} className="animate-spin" /> Đang xử lý...</>
                            ) : extractStatus === 'success' ? (
                                <><CheckCircle2 size={13} /> Đã fill!</>
                            ) : extractStatus === 'error' ? (
                                <><AlertCircle size={13} /> Lỗi</>
                            ) : (
                                <><Sparkles size={13} /> Trích xuất</>
                            )}
                        </button>
                    </div>

                    <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                        💡 Ctrl+V dán ảnh danh thiếp/GPKD · Nhập link masothue.com · Hoặc mô tả thông tin
                    </p>
                </div>
            )}
        </div>
    );
};

export default AICustomerFill;
