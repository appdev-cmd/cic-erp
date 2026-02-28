import React, { useState, useRef, useCallback } from 'react';
import {
    Upload, Link2, Loader2, CheckCircle2, AlertCircle,
    Sparkles, Building2, User, Phone, Mail, MapPin, Hash,
    Globe, Landmark, Calendar, Briefcase, ShieldCheck,
    Image as ImageIcon, Save, Send, Camera, Edit3, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { AIExtractService, ExtractModel, EXTRACT_MODELS } from '../services/aiExtractService';
import { CustomerService } from '../services';
import { Customer } from '../types';

// ─── Types ───────────────────────────────────────────────
interface ChatMessage {
    id: string;
    type: 'user-image' | 'user-url' | 'user-text' | 'ai-extracting' | 'ai-result' | 'ai-error' | 'system-success';
    content?: string;
    imageDataUrl?: string;
    extractedData?: Partial<Customer>;
    timestamp: Date;
}

interface FieldConfig {
    key: keyof Partial<Customer>;
    label: string;
    icon: any;
    type?: 'text' | 'array' | 'date';
}

const FIELDS: FieldConfig[] = [
    { key: 'name', label: 'Tên công ty', icon: Building2 },
    { key: 'shortName', label: 'Tên viết tắt', icon: Building2 },
    { key: 'internationalName', label: 'Tên quốc tế', icon: Globe },
    { key: 'taxCode', label: 'Mã số thuế', icon: Hash },
    { key: 'representative', label: 'Người đại diện', icon: User },
    { key: 'contactPerson', label: 'Người liên hệ', icon: User },
    { key: 'phone', label: 'Điện thoại', icon: Phone },
    { key: 'email', label: 'Email', icon: Mail },
    { key: 'address', label: 'Địa chỉ', icon: MapPin },
    { key: 'website', label: 'Website', icon: Globe },
    { key: 'industry', label: 'Ngành nghề', icon: Briefcase, type: 'array' },
    { key: 'businessType', label: 'Loại hình DN', icon: Building2 },
    { key: 'businessStatus', label: 'Tình trạng', icon: ShieldCheck },
    { key: 'foundedDate', label: 'Ngày hoạt động', icon: Calendar, type: 'date' },
    { key: 'bankName', label: 'Ngân hàng', icon: Landmark },
    { key: 'bankBranch', label: 'Chi nhánh NH', icon: Landmark },
    { key: 'bankAccount', label: 'Số tài khoản', icon: Hash },
];

// ─── Extraction Result Card ──────────────────────────────
const ExtractionCard: React.FC<{
    data: Partial<Customer>;
    onSave: (data: Partial<Customer>) => void;
    saving: boolean;
}> = ({ data, onSave, saving }) => {
    const [editData, setEditData] = useState<Partial<Customer>>(data);
    const [showEmpty, setShowEmpty] = useState(false);

    const filledFields = FIELDS.filter(f => {
        const val = (editData as any)[f.key];
        return val && (Array.isArray(val) ? val.length > 0 : String(val).trim() !== '');
    });
    const emptyFields = FIELDS.filter(f => {
        const val = (editData as any)[f.key];
        return !val || (Array.isArray(val) ? val.length === 0 : String(val).trim() === '');
    });

    const updateField = (key: string, value: any) => {
        setEditData(prev => ({ ...prev, [key]: value }));
    };

    const renderField = (field: FieldConfig) => {
        const val = (editData as any)[field.key];
        const display = field.type === 'array'
            ? (Array.isArray(val) ? val.join(', ') : val || '')
            : (val ?? '');
        const isFilled = display && String(display).trim() !== '';
        const Icon = field.icon;

        return (
            <div key={field.key} className="flex items-center gap-2 py-1.5">
                <Icon size={13} className={isFilled ? "text-violet-500 shrink-0" : "text-slate-400 dark:text-slate-600 shrink-0"} />
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 w-24 shrink-0">{field.label}</span>
                <input
                    type={field.type === 'date' ? 'date' : 'text'}
                    value={display}
                    onChange={(e) => {
                        const v = field.type === 'array'
                            ? e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                            : e.target.value;
                        updateField(field.key, v);
                    }}
                    className={cn(
                        "flex-1 px-2 py-1 text-sm rounded-md border bg-transparent transition-colors",
                        "focus:outline-none focus:ring-1 focus:ring-violet-400",
                        isFilled
                            ? "border-violet-200/50 dark:border-violet-800/30 text-slate-800 dark:text-slate-200 font-medium"
                            : "border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                    )}
                    placeholder="Nhập bổ sung..."
                />
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
            {/* Header with progress bar */}
            <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800/30">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                            Trích xuất: {filledFields.length}/{FIELDS.length} trường
                        </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-500">
                        {Math.round((filledFields.length / FIELDS.length) * 100)}%
                    </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${(filledFields.length / FIELDS.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* All filled fields — always visible */}
            <div className="px-4 py-2">
                {filledFields.map(renderField)}
            </div>

            {/* Empty fields — expandable */}
            {emptyFields.length > 0 && (
                <>
                    <button
                        onClick={() => setShowEmpty(!showEmpty)}
                        className="w-full flex items-center justify-center gap-1 py-2 text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-violet-500 dark:hover:text-violet-400 border-t border-slate-100 dark:border-slate-700 cursor-pointer"
                    >
                        {showEmpty ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {showEmpty ? 'Ẩn trường trống' : `${emptyFields.length} trường trống — bổ sung thủ công`}
                    </button>
                    {showEmpty && (
                        <div className="px-4 pb-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
                            {emptyFields.map(renderField)}
                        </div>
                    )}
                </>
            )}

            {/* Save Button */}
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <button
                    onClick={() => onSave(editData)}
                    disabled={saving || !editData.name}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl text-sm font-black transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-emerald-200 dark:shadow-none"
                >
                    {saving ? (
                        <><Loader2 size={16} className="animate-spin" /> Đang lưu...</>
                    ) : (
                        <><Save size={16} /> Nạp vào Khách hàng</>
                    )}
                </button>
            </div>
        </div>
    );
};

// ─── Module-level flag to prevent double extraction (StrictMode safe) ─────
let _isExtracting = false;

// ─── Main Component ──────────────────────────────────────
const AIDataIngestion: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([{
        id: 'welcome',
        type: 'user-text',
        content: '',
        timestamp: new Date(),
    }]);
    const [inputText, setInputText] = useState('');
    const [pastedImage, setPastedImage] = useState<{ dataUrl: string; file: File } | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<ExtractModel>('gemini');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Remove welcome message
    const realMessages = messages.filter(m => m.id !== 'welcome');

    const scrollToBottom = useCallback(() => {
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, []);

    const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        const newMsg: ChatMessage = { ...msg, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date() };
        let returnId = newMsg.id;

        // Dedup: if last message has same type and was added within 2s, skip
        setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.type === newMsg.type) {
                const timeDiff = newMsg.timestamp.getTime() - last.timestamp.getTime();
                if (timeDiff < 2000) {
                    returnId = last.id; // Return existing message's ID
                    return prev; // Skip duplicate
                }
            }
            return [...prev, newMsg];
        });

        return returnId;
    }, []);

    const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    }, []);

    // ─── Handle Paste (Ctrl+V screenshot) ────────────────
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
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
                };
                reader.readAsDataURL(file);
                return;
            }
        }
    }, []);

    // ─── Process extraction ──────────────────────────────
    const processExtraction = useCallback(async (
        source: { type: 'image'; file: File; dataUrl: string } | { type: 'url'; url: string }
    ) => {
        if (_isExtracting) return;
        _isExtracting = true;
        setIsExtracting(true);

        // Add user message
        if (source.type === 'image') {
            addMessage({ type: 'user-image', imageDataUrl: source.dataUrl });
        } else {
            addMessage({ type: 'user-url', content: source.url });
        }

        // Add extracting message
        const extractId = addMessage({ type: 'ai-extracting' });
        scrollToBottom();

        try {
            let data: Partial<Customer>;
            if (source.type === 'image') {
                data = await AIExtractService.extractFromImage(source.file, selectedModel);
            } else {
                data = await AIExtractService.extractFromURL(source.url, selectedModel);
            }
            updateMessage(extractId, { type: 'ai-result', extractedData: data });
            toast.success(`Trích xuất thành công: ${data.name || 'Chưa có tên'}`);
        } catch (err: any) {
            updateMessage(extractId, { type: 'ai-error', content: err.message });
            toast.error('Lỗi trích xuất');
        } finally {
            _isExtracting = false;
            setIsExtracting(false);
            scrollToBottom();
        }
    }, [isExtracting, addMessage, updateMessage, scrollToBottom, selectedModel]);

    // ─── Handle Send ─────────────────────────────────────
    const handleSend = useCallback(() => {
        // Guard against double invocation (React StrictMode)
        if (_isExtracting) return;

        // If there's a pasted image, process it
        if (pastedImage) {
            processExtraction({ type: 'image', file: pastedImage.file, dataUrl: pastedImage.dataUrl });
            setPastedImage(null);
            setInputText('');
            return;
        }

        // If text looks like a URL
        const text = inputText.trim();
        if (!text) return;

        if (text.match(/^https?:\/\//i) || text.match(/masothue\.com|thongtindoanhnghiep/i)) {
            const url = text.startsWith('http') ? text : `https://${text}`;
            processExtraction({ type: 'url', url });
        } else {
            // Just text — show as user message and try text extraction
            _isExtracting = true;
            addMessage({ type: 'user-text', content: text });
            const extractId = addMessage({ type: 'ai-extracting' });
            scrollToBottom();
            setIsExtracting(true);

            AIExtractService.extractFromText(text, selectedModel)
                .then(data => {
                    updateMessage(extractId, { type: 'ai-result', extractedData: data });
                    toast.success(`Trích xuất thành công`);
                })
                .catch(err => {
                    updateMessage(extractId, { type: 'ai-error', content: err.message });
                })
                .finally(() => {
                    _isExtracting = false;
                    setIsExtracting(false);
                    scrollToBottom();
                });
        }
        setInputText('');
    }, [inputText, pastedImage, processExtraction, addMessage, updateMessage, scrollToBottom, selectedModel]);

    // ─── Handle File Upload ──────────────────────────────
    const handleFileSelect = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Chỉ hỗ trợ file ảnh');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            processExtraction({ type: 'image', file, dataUrl: e.target?.result as string });
        };
        reader.readAsDataURL(file);
    }, [processExtraction]);

    // ─── Handle Save (Upsert: update if MST exists, create if new) ─────
    const handleSaveCustomer = useCallback(async (msgId: string, data: Partial<Customer>) => {
        if (!data.name) {
            toast.error('Tên công ty là bắt buộc');
            return;
        }
        setSavingId(msgId);
        try {
            // Check if customer with same tax code already exists
            let existing: Customer | null = null;
            if (data.taxCode && data.taxCode.trim()) {
                existing = await CustomerService.findByTaxCode(data.taxCode.trim());
            }

            if (existing) {
                // UPDATE existing customer — only overwrite non-empty fields
                const updatePayload: Partial<Customer> = {};
                for (const [key, value] of Object.entries(data)) {
                    if (value && (Array.isArray(value) ? value.length > 0 : String(value).trim() !== '')) {
                        (updatePayload as any)[key] = value;
                    }
                }
                const updated = await CustomerService.update(existing.id, updatePayload);
                addMessage({ type: 'system-success', content: `🔄 Đã **cập nhật** thông tin KH **${updated?.name || existing.name}** (MST: ${data.taxCode})` });
                toast.success(`Đã cập nhật: ${updated?.name || existing.name}`);
            } else {
                // CREATE new customer
                const created = await CustomerService.create({
                    ...data,
                    name: data.name || '',
                    shortName: data.shortName || '',
                    contactPerson: data.contactPerson || '',
                    phone: data.phone || '',
                    email: data.email || '',
                    address: data.address || '',
                    industry: data.industry || [],
                } as Omit<Customer, 'id'>);
                addMessage({ type: 'system-success', content: `✅ Đã tạo khách hàng mới **${created.name}** thành công!` });
                toast.success(`Đã tạo: ${created.name}`);
            }
            scrollToBottom();
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`);
        } finally {
            setSavingId(null);
        }
    }, [addMessage, scrollToBottom]);

    // ─── Handle Drop ─────────────────────────────────────
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    // ─── Key Handler ─────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const hasContent = realMessages.length > 0;

    return (
        <div className="flex flex-col h-full">
            {/* ═══ Header ═══════════════════════════════════ */}
            <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm">AI Nạp dữ liệu — Khách hàng</h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Dán ảnh (Ctrl+V), kéo thả file, hoặc nhập link → AI trích xuất → Nạp vào hệ thống</p>
                    </div>
                </div>
            </div>

            {/* ═══ Chat Area ════════════════════════════════ */}
            <div
                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
            >
                {/* Empty State */}
                {!hasContent && (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
                        <div className="w-20 h-20 rounded-2xl bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center mb-4">
                            <Camera size={32} className="text-violet-400" />
                        </div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Chưa có dữ liệu</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
                            Chụp màn hình → <strong>Ctrl+V</strong> dán vào đây, hoặc kéo thả ảnh danh thiếp/GPKD, hoặc dán link masothue.com
                        </p>
                    </div>
                )}

                {/* Messages */}
                {realMessages.map((msg) => (
                    <div key={msg.id} className={cn(
                        "flex gap-3",
                        msg.type.startsWith('user') ? "justify-end" : "justify-start"
                    )}>
                        {/* AI Avatar */}
                        {!msg.type.startsWith('user') && (
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shrink-0 mt-1 shadow">
                                <Sparkles size={14} />
                            </div>
                        )}

                        <div className={cn("max-w-[85%]", msg.type.startsWith('user') ? "order-1" : "")}>
                            {/* User Image */}
                            {msg.type === 'user-image' && msg.imageDataUrl && (
                                <div className="bg-indigo-600 rounded-2xl rounded-tr-md p-2 shadow">
                                    <img src={msg.imageDataUrl} alt="Uploaded" className="max-h-48 rounded-xl object-contain" />
                                    <p className="text-[10px] text-indigo-200 mt-1 text-center">📸 Ảnh đã gửi</p>
                                </div>
                            )}

                            {/* User URL */}
                            {msg.type === 'user-url' && (
                                <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-md px-4 py-3 shadow">
                                    <div className="flex items-center gap-2">
                                        <Link2 size={14} />
                                        <span className="text-sm font-medium break-all">{msg.content}</span>
                                    </div>
                                </div>
                            )}

                            {/* User Text */}
                            {msg.type === 'user-text' && msg.content && (
                                <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-md px-4 py-3 shadow">
                                    <p className="text-sm">{msg.content}</p>
                                </div>
                            )}

                            {/* AI Extracting */}
                            {msg.type === 'ai-extracting' && (
                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-md px-5 py-4 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <Loader2 size={18} className="text-violet-500 animate-spin" />
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Đang phân tích...</p>
                                            <p className="text-xs text-slate-400">AI đang trích xuất thông tin doanh nghiệp</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI Result — Extraction Card */}
                            {msg.type === 'ai-result' && msg.extractedData && (
                                <div className="w-full min-w-[360px]">
                                    <ExtractionCard
                                        data={msg.extractedData}
                                        onSave={(data) => handleSaveCustomer(msg.id, data)}
                                        saving={savingId === msg.id}
                                    />
                                </div>
                            )}

                            {/* AI Error */}
                            {msg.type === 'ai-error' && (
                                <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle size={16} className="text-rose-500" />
                                        <span className="text-sm text-rose-700 dark:text-rose-300">{msg.content || 'Lỗi trích xuất'}</span>
                                    </div>
                                </div>
                            )}

                            {/* System Success */}
                            {msg.type === 'system-success' && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{msg.content}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                <div ref={chatEndRef} />
            </div>

            {/* ═══ Input Area ═══════════════════════════════ */}
            <div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                {/* Pasted Image Preview */}
                {pastedImage && (
                    <div className="mb-3 flex items-center gap-3 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl">
                        <img src={pastedImage.dataUrl} alt="Pasted" className="h-16 rounded-lg object-contain shadow" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-violet-700 dark:text-violet-300">📸 Ảnh đã dán</p>
                            <p className="text-xs text-violet-500">Nhấn Enter hoặc nút gửi để trích xuất</p>
                        </div>
                        <button
                            onClick={() => setPastedImage(null)}
                            className="text-violet-400 hover:text-rose-500 p-1 cursor-pointer"
                        >✕</button>
                    </div>
                )}

                <div className="relative max-w-4xl mx-auto flex gap-2">
                    {/* Upload Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isExtracting}
                        className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer shrink-0 self-end disabled:opacity-50"
                        title="Upload ảnh"
                    >
                        <ImageIcon size={18} />
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
                        className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 py-2 px-2 rounded-xl cursor-pointer focus:outline-none border border-slate-200 dark:border-slate-700 transition-all self-end shrink-0"
                        title="Chọn Model AI"
                        disabled={isExtracting}
                    >
                        {(Object.entries(EXTRACT_MODELS) as [ExtractModel, typeof EXTRACT_MODELS[ExtractModel]][]).map(([key, m]) => (
                            <option key={key} value={key}>{m.emoji} {m.label}</option>
                        ))}
                    </select>

                    {/* Text Input */}
                    <textarea
                        ref={inputRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder="Dán ảnh (Ctrl+V), nhập link masothue.com, hoặc mô tả thông tin..."
                        className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-violet-400 dark:focus:border-violet-600 focus:bg-white dark:focus:bg-slate-900 rounded-xl resize-none max-h-32 min-h-[44px] text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                        rows={1}
                        disabled={isExtracting}
                    />

                    {/* Send Button */}
                    <button
                        onClick={handleSend}
                        disabled={isExtracting || (!inputText.trim() && !pastedImage)}
                        className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 self-end",
                            (inputText.trim() || pastedImage)
                                ? "bg-violet-600 text-white shadow-lg hover:bg-violet-700 hover:scale-105 active:scale-95"
                                : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                        )}
                        title="Gửi & Trích xuất"
                    >
                        {isExtracting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
                <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-2">
                    💡 Chụp màn hình → Ctrl+V dán ảnh | Kéo thả file | Dán link masothue.com
                </p>
            </div>
        </div>
    );
};

export default AIDataIngestion;
