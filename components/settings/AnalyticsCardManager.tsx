import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Check, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardPreferenceService } from '../../services/dashboardPreferenceService';
import { useAuth } from '../../contexts/AuthContext';
import { ALL_ROLES, ROLE_LABELS, ROLE_TAB_COLORS } from '../../lib/permissionConstants';
import {
    ANALYTICS_CARDS, TAB_ORDER, TAB_LABELS, AnalyticsTab,
} from '../analytics/cardRegistry';
import type { UserRole } from '../../types';

/** key = `${role}|${cardId}` → enabled */
type CardState = Record<string, boolean>;

const keyOf = (role: string, cardId: string) => `${role}|${cardId}`;

/**
 * AnalyticsCardManager — Admin cấu hình card nào MỖI ROLE được phép xem
 * trong phân hệ Phân tích kinh doanh. Ma trận Role × Card (nhóm theo tab).
 */
const AnalyticsCardManager: React.FC = () => {
    const { profile } = useAuth();
    const [activeRole, setActiveRole] = useState<UserRole>('NVKD');
    const [state, setState] = useState<CardState>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const rows = await DashboardPreferenceService.getRoleCardsRaw();
            const next: CardState = {};
            // Mặc định: chưa có row → coi như BẬT (registry default).
            for (const role of ALL_ROLES) {
                for (const card of ANALYTICS_CARDS) {
                    next[keyOf(role, card.id)] = true;
                }
            }
            for (const r of rows) {
                next[keyOf(r.role, r.cardId)] = r.enabled;
            }
            setState(next);
            setDirty(false);
        } catch {
            toast.error('Không tải được cấu hình card');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const cardsByTab = useMemo(() => {
        const map: Record<AnalyticsTab, typeof ANALYTICS_CARDS> = {
            overview: [], cashflow: [], product_brand: [], employee_customer: [],
        };
        for (const c of ANALYTICS_CARDS) map[c.tab].push(c);
        return map;
    }, []);

    const toggle = (cardId: string) => {
        setState(prev => ({ ...prev, [keyOf(activeRole, cardId)]: !prev[keyOf(activeRole, cardId)] }));
        setDirty(true);
    };

    const setAll = (enabled: boolean) => {
        setState(prev => {
            const next = { ...prev };
            for (const c of ANALYTICS_CARDS) next[keyOf(activeRole, c.id)] = enabled;
            return next;
        });
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const cards = ANALYTICS_CARDS.map(c => ({
                cardId: c.id,
                enabled: state[keyOf(activeRole, c.id)] ?? true,
            }));
            await DashboardPreferenceService.setRoleCardsBulk(
                activeRole, cards, profile?.employeeId || profile?.id
            );
            toast.success(`Đã lưu cấu hình cho role ${ROLE_LABELS[activeRole]}`);
            setDirty(false);
        } catch {
            toast.error('Lưu thất bại');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
                <Loader2 size={16} className="animate-spin" /> Đang tải cấu hình...
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Role tabs */}
            <div className="flex flex-wrap gap-1.5">
                {ALL_ROLES.map(role => {
                    const colors = ROLE_TAB_COLORS[role];
                    const isActive = activeRole === role;
                    return (
                        <button
                            key={role}
                            onClick={() => setActiveRole(role)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                isActive ? colors.active : `border-transparent ${colors.bg} hover:bg-slate-100 dark:hover:bg-slate-800`
                            }`}
                        >
                            {ROLE_LABELS[role]}
                        </button>
                    );
                })}
            </div>

            {/* Bulk actions */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chọn card mà <span className="font-bold text-slate-700 dark:text-slate-200">{ROLE_LABELS[activeRole]}</span> được phép xem.
                </p>
                <div className="flex items-center gap-2">
                    <button onClick={() => setAll(true)} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">Chọn tất cả</button>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <button onClick={() => setAll(false)} className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer">Bỏ chọn</button>
                </div>
            </div>

            {/* Card matrix grouped by tab */}
            <div className="space-y-4">
                {TAB_ORDER.map(tab => (
                    <div key={tab}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">{TAB_LABELS[tab]}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {cardsByTab[tab].map(card => {
                                const checked = state[keyOf(activeRole, card.id)] ?? true;
                                return (
                                    <button
                                        key={card.id}
                                        onClick={() => toggle(card.id)}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                            checked
                                                ? 'bg-orange-50/60 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/40'
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                            checked ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300 dark:border-slate-600'
                                        }`}>
                                            {checked && <Check size={13} strokeWidth={3} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{card.title}</p>
                                            {card.sensitivity === 'profit' && (
                                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Nhạy cảm · Lợi nhuận</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                    onClick={load}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                    <RotateCcw size={14} /> Hoàn tác
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Lưu cấu hình
                </button>
            </div>
        </div>
    );
};

export default AnalyticsCardManager;
