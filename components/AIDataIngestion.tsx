import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Upload, Link2, Loader2, CheckCircle2, AlertCircle,
    Sparkles, Building2, User, Phone, Mail, MapPin, Hash,
    Globe, Landmark, Calendar, Briefcase, ShieldCheck,
    Image as ImageIcon, Save, Send, Camera, Edit3, ChevronDown, ChevronUp,
    FileText, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { AIExtractService, ExtractModel, EXTRACT_MODELS, ContractExtraction, PAKDExtraction } from '../services/aiExtractService';
import { CustomerService, ContractService, PaymentService } from '../services';
import { Customer } from '../types';

// ─── Types ───────────────────────────────────────────────
type IngestionModule = 'customer' | 'contract' | 'pakd';

interface ChatMessage {
    id: string;
    type: 'user-image' | 'user-url' | 'user-text' | 'ai-extracting' | 'ai-result' | 'ai-error' | 'system-success';
    content?: string;
    imageDataUrl?: string;
    extractedData?:
    | { type: 'customer'; data: Partial<Customer> }
    | { type: 'contract'; data: ContractExtraction[] }
    | { type: 'pakd'; data: PAKDExtraction };
    timestamp: Date;
}

interface FieldConfig {
    key: keyof Partial<Customer>;
    label: string;
    icon: any;
    type?: 'text' | 'array' | 'date';
}

import { CustomerExtractCard, CUSTOMER_FIELDS } from './ai-extract/CustomerExtractCard';

// ─── PAKD Extraction Result Card ──────────────────────────
import { PAKDExtractionCard } from './ai-extract/PAKDExtractionCard';

import { ContractExtractionTable } from './ai-extract/ContractExtractionTable';

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
    const [activeModule, setActiveModule] = useState<IngestionModule>('customer');
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
        source: { type: 'image'; file: File; dataUrl: string } | { type: 'url'; url: string } | { type: 'text'; text: string }
    ) => {
        if (_isExtracting) return;
        _isExtracting = true;
        setIsExtracting(true);

        // Add user message
        if (source.type === 'image') {
            addMessage({ type: 'user-image', imageDataUrl: source.dataUrl });
        } else if (source.type === 'url') {
            addMessage({ type: 'user-url', content: source.url });
        } else {
            addMessage({ type: 'user-text', content: source.text });
        }

        // Add extracting message
        const extractId = addMessage({ type: 'ai-extracting' });
        scrollToBottom();

        try {
            if (activeModule === 'contract') {
                // Contract mode — extract table rows
                if (source.type === 'image') {
                    const rows = await AIExtractService.extractContractsFromImage(source.file, selectedModel);
                    updateMessage(extractId, { type: 'ai-result', extractedData: { type: 'contract', data: rows } });
                    toast.success(`Trích xuất: ${rows.length} hợp đồng`);
                } else {
                    throw new Error('Hợp đồng chỉ hỗ trợ trích xuất từ ảnh bảng');
                }
            } else if (activeModule === 'pakd') {
                // PAKD mode
                let pakdResult;
                if (source.type === 'image') {
                    pakdResult = await AIExtractService.extractPAKDFromImage(source.file, selectedModel);
                } else if (source.type === 'text') {
                    pakdResult = await AIExtractService.extractPAKDFromText(source.text, selectedModel);
                } else {
                    throw new Error('PAKD chưa hỗ trợ trích xuất từ URL');
                }
                updateMessage(extractId, { type: 'ai-result', extractedData: { type: 'pakd', data: pakdResult } });
                toast.success(`Trích xuất PAKD thành công`);
            } else {
                // Customer mode
                let data: Partial<Customer>;
                if (source.type === 'image') {
                    data = await AIExtractService.extractFromImage(source.file, selectedModel);
                } else if (source.type === 'url') {
                    data = await AIExtractService.extractFromURL(source.url, selectedModel);
                } else {
                    data = await AIExtractService.extractFromText(source.text, selectedModel);
                }
                updateMessage(extractId, { type: 'ai-result', extractedData: { type: 'customer', data: data } });
                toast.success(`Trích xuất thành công: ${data.name || 'Chưa có tên'}`);
            }
        } catch (err: any) {
            updateMessage(extractId, { type: 'ai-error', content: err.message });
            toast.error('Lỗi trích xuất');
        } finally {
            _isExtracting = false;
            setIsExtracting(false);
            scrollToBottom();
        }
    }, [isExtracting, addMessage, updateMessage, scrollToBottom, selectedModel, activeModule]);

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
            // Just text — Let processExtraction handle it based on activeModule
            processExtraction({ type: 'text', text });
        }
        setInputText('');
    }, [inputText, pastedImage, processExtraction, selectedModel]);

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

    // ─── Handle Save Contracts (Upsert + Payment creation) ─────
    const handleSaveContracts = useCallback(async (msgId: string, rows: ContractExtraction[], unitId: string, salespersonId: string) => {
        if (rows.length === 0) return;
        setSavingId(msgId);

        let created = 0, updated = 0, failed = 0;
        const failMessages: string[] = [];

        try {
            for (const row of rows) {
                try {
                    // 1. Lookup customer by name — auto-create if not found
                    let customerId = '';
                    if (row.customerName && row.customerName.length >= 2) {
                        const customers = await CustomerService.search(row.customerName, 1);
                        if (customers.length > 0) {
                            customerId = customers[0].id;
                        } else {
                            try {
                                const newCustomer = await CustomerService.create({
                                    name: row.customerName,
                                    shortName: '',
                                    contactPerson: row.contactPerson || '',
                                    phone: '',
                                    email: '',
                                    address: '',
                                    industry: [],
                                } as any);
                                customerId = newCustomer.id;
                            } catch (custErr) {
                                console.warn(`[AI] Auto-create customer failed:`, custErr);
                            }
                        }
                    }

                    // 2. Check if contract already exists (by title)
                    const existing = await ContractService.findByTitle(row.contractCode);

                    // Sanitize contract ID: replace / with -
                    const sanitizedId = row.contractCode.replace(/\//g, '-');

                    const contractData: any = {
                        title: row.contractCode,
                        content: row.content || '',
                        category: row.content || 'BIM',
                        value: row.signedValue || 0,
                        signedDate: row.signedDate || null,
                        startDate: row.signedDate || null,
                        endDate: null,
                        actualRevenue: row.acceptanceValue || 0,
                        unitId,
                        salespersonId: (row as any).salespersonId || salespersonId,
                        contacts: row.contactPerson ? [{ id: crypto.randomUUID(), name: row.contactPerson, role: 'Đầu mối' }] : [],
                    };

                    if (customerId) contractData.customerId = customerId;

                    if (existing) {
                        // UPDATE
                        await ContractService.update(existing.id, contractData);
                        updated++;
                    } else {
                        // CREATE — need required fields
                        const newContract = {
                            ...contractData,
                            id: sanitizedId,
                            contractType: 'HĐ' as const,
                            partyA: row.customerName || '',
                            partyB: 'CIC',
                            clientInitials: '',
                            estimatedCost: 0,
                            actualCost: 0,
                            status: 'Processing' as const,
                            stage: 'Signed' as const,
                        };
                        await ContractService.create(newContract);
                        created++;
                    }

                } catch (err: any) {
                    console.error(`[AI] Failed to save contract ${row.contractCode}:`, err?.message || err);
                    failMessages.push(`${row.contractCode}: ${err?.message || 'Unknown error'}`);
                    failed++;
                }
            }

            const summary: string[] = [];
            if (created > 0) summary.push(`✅ Tạo mới: ${created}`);
            if (updated > 0) summary.push(`🔄 Cập nhật: ${updated}`);
            if (failed > 0) summary.push(`❌ Lỗi: ${failed}`);
            if (failMessages.length > 0) {
                addMessage({ type: 'ai-error', content: failMessages.join('\n') });
            }
            addMessage({ type: 'system-success', content: summary.join(' • ') });
            toast.success(`Đã nạp ${created + updated}/${rows.length} hợp đồng`);
            scrollToBottom();
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`);
        } finally {
            setSavingId(null);
        }
    }, [addMessage, scrollToBottom]);

    // ─── Handle Save PAKD (Update Contract + Create Business Plan) ─────
    const handleSavePAKD = useCallback(async (msgId: string, data: PAKDExtraction) => {
        if (!data.contractNumber) {
            toast.error('Không tìm thấy số hợp đồng trong PAKD');
            return;
        }
        setSavingId(msgId);
        try {
            // Find contract by title (contract code)
            const contractCode = data.contractNumber;
            const existing = await ContractService.findByTitle(contractCode);

            if (!existing) {
                toast.error(`Không tìm thấy hợp đồng ${contractCode} trên hệ thống`);
                return;
            }

            // Transform lineItems for Contract.details
            const lineItems = data.lineItems.map(item => ({
                id: crypto.randomUUID(),
                name: item.name,
                supplier: item.supplier,
                quantity: item.quantity,
                inputPrice: item.unitCost,
                outputPrice: item.unitPrice,
                directCosts: item.transferFee || 0,
                vatRate: 10,
            }));

            // Prepare adminCosts (legacy)
            const adminCosts = {
                transferFee: 0,
                contractorTax: 0,
                importFee: 0,
                expertHiring: data.financials.expertFee || 0,
                documentProcessing: data.financials.documentFee || 0,
            };

            // Prepare dynamic executionCosts for the new format
            const executionCosts: any[] = [];
            if (data.financials.completionBonus) executionCosts.push({ id: crypto.randomUUID(), name: 'Thưởng hoàn thành dự án', amount: data.financials.completionBonus });
            if (data.financials.dealPromotion) executionCosts.push({ id: crypto.randomUUID(), name: 'Xúc tiến hợp đồng (DCS)', amount: data.financials.dealPromotion });
            if (data.financials.managementSupport) executionCosts.push({ id: crypto.randomUUID(), name: 'Ban lãnh đạo hỗ trợ', amount: data.financials.managementSupport });
            if (data.financials.expertFee) executionCosts.push({ id: crypto.randomUUID(), name: 'Phí thuê chuyên gia', amount: data.financials.expertFee });
            if (data.financials.documentFee) executionCosts.push({ id: crypto.randomUUID(), name: 'Phí thanh toán CT', amount: data.financials.documentFee });

            // 1. Update Contract
            await ContractService.update(existing.id, {
                lineItems,
                adminCosts,
                executionCosts,
                estimatedCost: data.financials.totalCosts || existing.estimatedCost,
                value: data.financials.revenue || existing.value,
            });

            // 2. Upsert Business Plan
            const { supabase } = await import('../lib/supabase');
            const { data: userData } = await supabase.auth.getUser();
            const financials = {
                revenue: data.financials.revenue,
                costs: data.financials.totalCosts,
                grossProfit: data.financials.profit,
                margin: data.financials.marginRevenue,
                cashflow: existing.paymentPhases || [],
                executionCosts: executionCosts,
                adminCosts: adminCosts,
                lineItems: lineItems
            };

            const { data: plans } = await supabase.from('contract_business_plans').select('id').eq('contract_id', existing.id);
            if (plans && plans.length > 0) {
                await supabase.from('contract_business_plans')
                    .update({ financials })
                    .eq('id', plans[0].id);
            } else {
                await supabase.from('contract_business_plans').insert({
                    contract_id: existing.id,
                    version: 1,
                    status: 'Approved',
                    financials: financials,
                    is_active: true,
                    created_by: userData?.user?.id
                });
            }

            toast.success(`Nạp cấu trúc PAKD vào HĐ ${contractCode} thành công`);
            addMessage({ type: 'system-success', content: `Đã nạp PAKD cho HĐ: ${contractCode}` });
            scrollToBottom();
        } catch (err: any) {
            toast.error(`Lỗi nạp PAKD: ${err.message}`);
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
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm">
                                AI Nạp dữ liệu — {activeModule === 'customer' ? 'Khách hàng' : activeModule === 'contract' ? 'Hợp đồng' : 'PAKD'}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {activeModule === 'customer'
                                    ? 'Dán ảnh (Ctrl+V), kéo thả file, hoặc nhập link → AI trích xuất → Nạp vào hệ thống'
                                    : activeModule === 'contract'
                                        ? 'Chụp/dán ảnh bảng Excel hợp đồng → AI trích xuất nhiều dòng → Nạp vào hệ thống'
                                        : 'Chụp/dán ảnh bảng PAKD → AI trích xuất chi phí & lợi nhuận → Nạp vào hợp đồng'
                                }
                            </p>
                        </div>
                    </div>
                    {/* Module Selector */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                        <button
                            onClick={() => setActiveModule('customer')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                                activeModule === 'customer'
                                    ? "bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                        >
                            <Users size={12} className="inline mr-1" />Khách hàng
                        </button>
                        <button
                            onClick={() => setActiveModule('contract')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                                activeModule === 'contract'
                                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                        >
                            <FileText size={12} className="inline mr-1" />Hợp đồng
                        </button>
                        <button
                            onClick={() => setActiveModule('pakd')}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                                activeModule === 'pakd'
                                    ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                        >
                            <Landmark size={12} className="inline mr-1" />PAKD
                        </button>
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

                            {msg.type === 'ai-result' && msg.extractedData && (
                                <div className="w-full min-w-[360px]">
                                    {msg.extractedData.type === 'customer' && (
                                        <CustomerExtractCard
                                            data={msg.extractedData.data as Partial<Customer>}
                                            onSave={(data) => handleSaveCustomer(msg.id, data)}
                                            saving={savingId === msg.id}
                                        />
                                    )}
                                    {msg.extractedData.type === 'contract' && (
                                        <ContractExtractionTable
                                            data={msg.extractedData.data as ContractExtraction[]}
                                            onSave={(rows, unitId, salespersonId) => handleSaveContracts(msg.id, rows, unitId, salespersonId)}
                                            saving={savingId === msg.id}
                                        />
                                    )}
                                    {msg.extractedData.type === 'pakd' && (
                                        <PAKDExtractionCard
                                            data={msg.extractedData.data as PAKDExtraction}
                                            onSave={(data) => handleSavePAKD(msg.id, data)}
                                            saving={savingId === msg.id}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Obsolete specific result blocks removed - now handled by ai-result */}

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
