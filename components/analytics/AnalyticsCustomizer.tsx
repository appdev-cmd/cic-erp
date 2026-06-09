import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, GripVertical, Eye, EyeOff, RotateCcw, Lock } from 'lucide-react';
import {
    AnalyticsCardPref,
    CARD_BY_ID,
    TAB_LABELS,
    TAB_ORDER,
    AnalyticsTab,
} from './cardRegistry';

interface AnalyticsCustomizerProps {
    isOpen: boolean;
    onClose: () => void;
    layout: AnalyticsCardPref[];
    /** Card được phép theo role — card ngoài tập này sẽ hiển thị mờ + khoá. */
    allowedIds: Set<string>;
    onSave: (next: AnalyticsCardPref[]) => void;
    onReset: () => void;
    isSaving?: boolean;
}

/**
 * Drawer cho phép user chọn hiện/ẩn & kéo-thả sắp xếp card.
 * Dùng HTML5 drag-and-drop gốc (không thêm dependency).
 */
const AnalyticsCustomizer: React.FC<AnalyticsCustomizerProps> = ({
    isOpen, onClose, layout, allowedIds, onSave, onReset, isSaving,
}) => {
    // Bản nháp cục bộ, chỉ ghi khi bấm "Lưu".
    const [draft, setDraft] = useState<AnalyticsCardPref[]>(layout);
    const [dragId, setDragId] = useState<string | null>(null);

    // Đồng bộ lại draft mỗi khi mở drawer hoặc layout đổi.
    React.useEffect(() => {
        if (isOpen) setDraft(layout);
    }, [isOpen, layout]);

    // Nhóm theo tab để hiển thị, giữ thứ tự trong draft.
    const grouped = useMemo(() => {
        const map: Record<AnalyticsTab, AnalyticsCardPref[]> = {
            overview: [], cashflow: [], product_brand: [], employee_customer: [],
        };
        for (const p of draft) {
            const meta = CARD_BY_ID[p.cardId];
            if (meta) map[meta.tab].push(p);
        }
        return map;
    }, [draft]);

    if (!isOpen) return null;

    const toggleVisible = (cardId: string) => {
        setDraft(prev => prev.map(p => p.cardId === cardId ? { ...p, visible: !p.visible } : p));
    };

    /** Sắp xếp lại: đưa dragId vào trước targetId (chỉ trong cùng tab). */
    const handleDrop = (targetId: string) => {
        if (!dragId || dragId === targetId) { setDragId(null); return; }
        const dragMeta = CARD_BY_ID[dragId];
        const targetMeta = CARD_BY_ID[targetId];
        if (!dragMeta || !targetMeta || dragMeta.tab !== targetMeta.tab) { setDragId(null); return; }

        setDraft(prev => {
            const arr = [...prev];
            const from = arr.findIndex(p => p.cardId === dragId);
            const to = arr.findIndex(p => p.cardId === targetId);
            if (from === -1 || to === -1) return prev;
            const [moved] = arr.splice(from, 1);
            const newTo = arr.findIndex(p => p.cardId === targetId);
            arr.splice(newTo, 0, moved);
            return arr;
        });
        setDragId(null);
    };

    const handleSave = () => { onSave(draft); onClose(); };

    return createPortal(
        <div className="fixed inset-0 z-[9998] flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Tùy chỉnh bố cục</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Chọn & kéo-thả sắp xếp các thẻ hiển thị</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        <X size={18} className="text-slate-500 dark:text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 styled-scrollbar">
                    {TAB_ORDER.map(tab => {
                        const items = grouped[tab];
                        if (items.length === 0) return null;
                        return (
                            <div key={tab}>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 px-1">
                                    {TAB_LABELS[tab]}
                                </p>
                                <div className="space-y-1.5">
                                    {items.map(p => {
                                        const meta = CARD_BY_ID[p.cardId];
                                        const locked = !allowedIds.has(p.cardId);
                                        return (
                                            <div
                                                key={p.cardId}
                                                draggable={!locked}
                                                onDragStart={() => setDragId(p.cardId)}
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={() => handleDrop(p.cardId)}
                                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                                                    locked
                                                        ? 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 opacity-60'
                                                        : dragId === p.cardId
                                                            ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-900/10'
                                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700 cursor-grab active:cursor-grabbing'
                                                }`}
                                            >
                                                {locked
                                                    ? <Lock size={15} className="text-slate-300 dark:text-slate-600 shrink-0" />
                                                    : <GripVertical size={15} className="text-slate-300 dark:text-slate-600 shrink-0" />}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-bold truncate ${p.visible && !locked ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                                                        {meta.title}
                                                    </p>
                                                    {locked
                                                        ? <p className="text-[10px] text-slate-400 dark:text-slate-500">Không có quyền xem thẻ này</p>
                                                        : meta.subtitle && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{meta.subtitle}</p>}
                                                </div>
                                                {!locked && (
                                                    <button
                                                        onClick={() => toggleVisible(p.cardId)}
                                                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                                                        title={p.visible ? 'Ẩn thẻ' : 'Hiện thẻ'}
                                                    >
                                                        {p.visible
                                                            ? <Eye size={16} className="text-orange-500" />
                                                            : <EyeOff size={16} className="text-slate-400" />}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => { onReset(); onClose(); }}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors"
                    >
                        <RotateCcw size={14} /> Khôi phục mặc định
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-5 py-2 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                        >
                            Lưu thay đổi
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AnalyticsCustomizer;
