// ============================================================
// Performance Page — CIC ERP
// Hệ thống quản lý Chu kỳ, KPI, Đánh giá Hiệu suất
// ============================================================

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Target, Trophy, CalendarDays, Plus, Filter,
    Search, Award, Loader2, ArrowRight, User
} from 'lucide-react';
import { PerformanceService } from '../../services/performanceService';
import type { PerformanceCycle, KpiGoal, PerformanceReview } from '../../types/performanceTypes';
import { formatDate } from '../../utils/formatters';
import { useSlidePanel } from '../../contexts/SlidePanelContext';

export const PerformancePage: React.FC = () => {
    const { openPanel, closePanel } = useSlidePanel();
    const [activeTab, setActiveTab] = useState<'cycles' | 'kpis' | 'reviews'>('cycles');

    // Data states
    const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
    const [kpis, setKpis] = useState<KpiGoal[]>([]);
    const [reviews, setReviews] = useState<PerformanceReview[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedCycleId, setSelectedCycleId] = useState<string>('all');

    useEffect(() => {
        loadCycles();
    }, []);

    useEffect(() => {
        if (activeTab === 'kpis') loadKpis();
        if (activeTab === 'reviews') loadReviews();
    }, [activeTab, selectedCycleId]);

    const loadCycles = async () => {
        setLoading(true);
        try {
            const data = await PerformanceService.getCycles();
            setCycles(data);
            if (data.length > 0 && selectedCycleId === 'all') {
                setSelectedCycleId(data[0].id);
            }
        } catch {
            toast.error('Lỗi tải danh sách chu kỳ đánh giá');
        } finally {
            setLoading(false);
        }
    };

    const loadKpis = async () => {
        if (selectedCycleId === 'all') return;
        setLoading(true);
        try {
            const data = await PerformanceService.getKpisByCycle(selectedCycleId);
            setKpis(data);
        } catch {
            toast.error('Lỗi tải danh sách KPIs');
        } finally {
            setLoading(false);
        }
    };

    const loadReviews = async () => {
        if (selectedCycleId === 'all') return;
        setLoading(true);
        try {
            const data = await PerformanceService.getReviewsByCycle(selectedCycleId);
            setReviews(data);
        } catch {
            toast.error('Lỗi tải Feedback/Reviews');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
                        <Target className="text-rose-600 dark:text-rose-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Đánh giá Hiệu suất</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">KPIs, OKRs và Feedback Đánh giá</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={selectedCycleId}
                        onChange={(e) => setSelectedCycleId(e.target.value)}
                        className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none"
                    >
                        {cycles.length === 0 && <option value="all">Chưa có chu kỳ nào</option>}
                        {cycles.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>

                    <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition">
                        <Plus size={16} />
                        {activeTab === 'cycles' ? 'Tạo Chu kỳ' : activeTab === 'kpis' ? 'Gán KPI Mới' : 'Tạo Phiếu ĐG'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center border-b border-slate-200 dark:border-slate-800">
                <button
                    onClick={() => setActiveTab('cycles')}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition ${activeTab === 'cycles' ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    <CalendarDays size={18} /> Chu kỳ (Cycles)
                </button>
                <button
                    onClick={() => setActiveTab('kpis')}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition ${activeTab === 'kpis' ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    <Target size={18} /> Mục tiêu KPIs
                </button>
                <button
                    onClick={() => setActiveTab('reviews')}
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 transition ${activeTab === 'reviews' ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                >
                    <Award size={18} /> Phiếu Đánh Giá
                </button>
            </div>

            {/* Content Payload */}
            <div className="mt-4">
                {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="animate-spin text-rose-500" size={32} /></div>
                ) : (
                    <>
                        {/* 1. Cycles View */}
                        {activeTab === 'cycles' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {cycles.length === 0 ? (
                                    <div className="col-span-full text-center py-12"><CalendarDays className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={40} /><p className="text-sm text-slate-500">Chưa có chu kỳ đánh giá nào.</p></div>
                                ) : cycles.map(c => (
                                    <div key={c.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-rose-300 dark:hover:border-rose-800 transition">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="font-black text-lg text-slate-900 dark:text-slate-100">{c.name}</h3>
                                            <span className={`px-2 py-1 flex items-center text-xs font-bold rounded ${c.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    c.status === 'review' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                        c.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                }`}>
                                                {c.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1 mb-4">
                                            <p>Loại: <span className="font-medium text-slate-700 dark:text-slate-300">{c.type.toUpperCase()}</span></p>
                                            <p>Kéo dài: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(c.start_date || '')} ➝ {formatDate(c.end_date || '')}</span></p>
                                        </div>
                                        <button className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:underline">
                                            Xem Setup Chu kỳ <ArrowRight size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 2. KPIs View */}
                        {activeTab === 'kpis' && (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-black uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                            <tr>
                                                <th className="p-3 pl-4">Nhân viên</th>
                                                <th className="p-3">Mục tiêu (Title)</th>
                                                <th className="p-3">Tiến độ (Actual/Target)</th>
                                                <th className="p-3">Trọng số (W)</th>
                                                <th className="p-3">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {kpis.length === 0 ? (
                                                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Không có KPI nào được gán trong chu kỳ này.</td></tr>
                                            ) : kpis.map(k => (
                                                <tr key={k.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                                    <td className="p-3 pl-4">
                                                        <div className="font-bold text-slate-900 dark:text-slate-100">{k.employee_name}</div>
                                                        <div className="text-[10px] text-slate-500 font-normal">{k.employee_code} • {k.department_name}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-800 dark:text-slate-200">{k.title}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-slate-900 dark:text-slate-100 font-black">{k.actual_value} / {k.target_value}</div>
                                                            <span className="text-[10px] text-slate-500">{k.unit}</span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1.5 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${k.status === 'achieved' ? 'bg-emerald-500' : k.status === 'behind' || k.status === 'at_risk' ? 'bg-rose-500' : 'bg-blue-500'}`}
                                                                style={{ width: `${Math.min((k.actual_value / (k.target_value || 1)) * 100, 100)}%` }}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-black text-rose-600 dark:text-rose-400">{k.weight}%</td>
                                                    <td className="p-3 text-[10px] uppercase font-bold tracking-wider">
                                                        {k.status === 'achieved' ? <span className="text-emerald-600 dark:text-emerald-400">Đạt</span> :
                                                            k.status === 'behind' ? <span className="text-rose-600 dark:text-rose-400">Trễ</span> :
                                                                <span className="text-blue-600 dark:text-blue-400">Ontrack</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 3. Reviews View */}
                        {activeTab === 'reviews' && (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-black uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                            <tr>
                                                <th className="p-3 pl-4">Người Đánh giá</th>
                                                <th className="p-3">Loại Đánh giá</th>
                                                <th className="p-3 text-center">Trạng thái</th>
                                                <th className="p-3 text-right">Tổng điểm</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {reviews.length === 0 ? (
                                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Chưa có dữ liệu Feedback Đánh giá trong chu kỳ này.</td></tr>
                                            ) : reviews.map(r => (
                                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                                    <td className="p-3 pl-4">
                                                        <div className="font-bold text-slate-900 dark:text-slate-100">{r.employee_name}</div>
                                                        <div className="text-[10px] text-slate-500">Người chấm: {r.reviewer_name || r.employee_name}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded text-[10px] font-bold uppercase tracking-wider">
                                                            {r.review_type}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {r.status === 'draft' ? <span className="text-amber-600">Nháp</span> : <span className="text-emerald-600">Đã Gửi</span>}
                                                    </td>
                                                    <td className="p-3 text-right text-lg font-black text-rose-600 dark:text-rose-400">
                                                        {r.overall_score !== null ? r.overall_score?.toFixed(1) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
