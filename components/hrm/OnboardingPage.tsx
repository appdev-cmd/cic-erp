// ============================================================
// Onboarding Dashboard — CIC ERP
// Theo dõi tiến độ hội nhập (Onboarding)
// ============================================================

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    GraduationCap, Search, Plus, Filter, Loader2, PlayCircle,
    CheckCircle2, Clock, CheckCircle, ChevronRight, FileText, User
} from 'lucide-react';
import { OnboardingService } from '../../services/onboardingService';
import type { OnboardingChecklist, OnboardingChecklistItem } from '../../types/onboardingTypes';
import { formatDate } from '../../utils/formatters';
import { useSlidePanel } from '../../contexts/SlidePanelContext';

export const OnboardingPage: React.FC = () => {
    const { openPanel, closePanel } = useSlidePanel();
    const [checklists, setChecklists] = useState<OnboardingChecklist[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await OnboardingService.getChecklists();
            setChecklists(data);
        } catch {
            toast.error('Lỗi tải danh sách Onboarding');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const openChecklistDetail = (id: string, name: string) => {
        openPanel({
            title: `Tiến độ hội nhập: ${name}`,
            url: `/hrm/onboarding/${id}`,
            component: <OnboardingDetail checklistId={id} onRefresh={loadData} />
        });
    };

    const getStatusBadge = (s: string) => {
        if (s === 'completed') return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded text-[10px] font-bold uppercase tracking-wider">Hoàn tất</span>;
        if (s === 'cancelled') return <span className="px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded text-[10px] font-bold uppercase tracking-wider">Hủy</span>;
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-[10px] font-bold uppercase tracking-wider">Đang chạy</span>;
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-fuchsia-50 dark:bg-fuchsia-900/20 rounded-xl">
                        <GraduationCap className="text-fuchsia-600 dark:text-fuchsia-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Tiến trình Hội nhập</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Theo dõi công tác Onboarding cho nhân sự mới</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Tìm nhân viên..."
                            className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-fuchsia-500"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-fuchsia-600 rounded-lg hover:bg-fuchsia-700 transition">
                        <Plus size={16} /> Gán Model
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-fuchsia-500" size={32} /></div>
            ) : checklists.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {checklists.map(c => (
                        <div key={c.id} onClick={() => openChecklistDetail(c.id, c.employee_name || '')} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-lg transition overflow-hidden">
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                                            {c.employee_name?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-slate-100">{c.employee_name}</p>
                                            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">{c.employee_code}</p>
                                        </div>
                                    </div>
                                    {getStatusBadge(c.status)}
                                </div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{c.template_name || 'Mẫu tự do'}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 whitespace-nowrap overflow-hidden text-ellipsis">
                                    Bắt đầu từ: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(c.start_date)}</span>
                                </p>

                                {/* Progress Bar */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="text-slate-600 dark:text-slate-400">Tiến độ</span>
                                        <span className="text-fuchsia-600 dark:text-fuchsia-400">{c.progress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-fuchsia-500 rounded-full transition-all duration-500 ease-out"
                                            style={{ width: `${c.progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <GraduationCap className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
                    <p className="text-slate-500 font-medium">Chưa có nhân viên nào đang trong tiến trình Onboarding.</p>
                </div>
            )}
        </div>
    );
};

// ── Chi tiết Tiến độ (Slide Panel Content) ──
const OnboardingDetail: React.FC<{ checklistId: string, onRefresh?: () => void }> = ({ checklistId, onRefresh }) => {
    const [items, setItems] = useState<OnboardingChecklistItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchItems = async () => {
        try {
            const data = await OnboardingService.getChecklistItems(checklistId);
            setItems(data);
        } catch {
            toast.error('Lỗi tải danh mục tasks');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, [checklistId]);

    const toggleStatus = async (item: OnboardingChecklistItem) => {
        const nextStatus = item.status === 'completed' ? 'pending' : 'completed';
        toast.promise(
            OnboardingService.updateItemStatus(item.id, nextStatus),
            {
                loading: 'Đang cập nhật...',
                success: () => {
                    fetchItems();
                    if (onRefresh) onRefresh();
                    return 'Cập nhật thành công';
                },
                error: 'Lỗi cập nhật trạng thái'
            }
        );
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-fuchsia-500" size={32} /></div>;

    const completedCount = items.filter(i => i.status === 'completed').length;
    const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

    return (
        <div className="space-y-6">
            <div className="bg-fuchsia-50 dark:bg-fuchsia-900/10 p-5 rounded-xl border border-fuchsia-100 dark:border-fuchsia-800/30">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <h3 className="font-bold text-fuchsia-900 dark:text-fuchsia-100">Tiến độ hoàn thiện: {completedCount}/{items.length}</h3>
                        <p className="text-xs text-fuchsia-600/80 dark:text-fuchsia-400">Các hạng mục onboarding cần giải quyết</p>
                    </div>
                    <span className="text-2xl font-black text-fuchsia-700 dark:text-fuchsia-400">{progress}%</span>
                </div>
                <div className="w-full h-2.5 bg-fuchsia-100 dark:bg-fuchsia-950 rounded-full overflow-hidden">
                    <div className="h-full bg-fuchsia-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className="space-y-3">
                {items.map(item => (
                    <div
                        key={item.id}
                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${item.status === 'completed'
                                ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 opacity-70'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm'
                            }`}
                    >
                        <button
                            onClick={() => toggleStatus(item)}
                            className={`mt-0.5 rounded-full p-0.5 flex-shrink-0 transition-colors ${item.status === 'completed'
                                    ? 'text-emerald-500 dark:text-emerald-400'
                                    : 'text-slate-300 dark:text-slate-600 hover:text-emerald-400'
                                }`}
                        >
                            <CheckCircle2 size={24} fill="currentColor" className="text-white dark:text-slate-900" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-bold ${item.status === 'completed' ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                                {item.title}
                            </h4>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
                                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                    <User size={12} /> {item.assignee_name || 'HR Team'}
                                </span>
                                {item.due_days !== null && item.due_days !== undefined && (
                                    <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-500">
                                        <Clock size={12} /> {item.due_days === 0 ? 'Ngay ngày đầu' : `Sau ${item.due_days} ngày`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
