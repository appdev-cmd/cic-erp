// ============================================================
// HR Analytics Dashboard — CIC ERP
// Theo dõi biến động nhân sự, tỷ lệ nghỉ việc, chi phí
// ============================================================

import React, { useState, useEffect } from 'react';
import {
    Users, UserPlus, UserMinus, TrendingUp, DollarSign,
    Briefcase, AlertCircle, Loader2
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, BarChart, Bar, Legend
} from 'recharts';

// Giả lập dữ liệu cho bản demo UI
const MOCK_TURNOVER_DATA = [
    { month: 'T1', newHires: 12, left: 2, total: 150 },
    { month: 'T2', newHires: 8, left: 3, total: 155 },
    { month: 'T3', newHires: 15, left: 1, total: 169 },
    { month: 'T4', newHires: 5, left: 4, total: 170 },
    { month: 'T5', newHires: 10, left: 2, total: 178 },
    { month: 'T6', newHires: 18, left: 5, total: 191 },
    { month: 'T7', newHires: 22, left: 3, total: 210 },
];

const MOCK_COST_DATA = [
    { department: 'Kinh doanh', salary: 1250, bonus: 320 },
    { department: 'Kỹ thuật', salary: 980, bonus: 150 },
    { department: 'Nhân sự', salary: 200, bonus: 50 },
    { department: 'Hành chính', salary: 180, bonus: 30 },
    { department: 'Marketing', salary: 350, bonus: 120 },
];

export const HRAnalyticsDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Giả lập fetching data
        const t = setTimeout(() => setLoading(false), 800);
        return () => clearTimeout(t);
    }, []);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                        <TrendingUp className="text-indigo-600 dark:text-indigo-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">HR Analytics</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Báo cáo tổng quan nguồn nhân lực</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <select className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 outline-none">
                        <option>Năm nay (2026)</option>
                        <option>Năm trước (2025)</option>
                    </select>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <StatCard icon={<Users size={20} />} title="Tổng Nhân sự" value="210" trend="+12.5%" trendUp color="bg-indigo-500" />
                <StatCard icon={<UserPlus size={20} />} title="Tuyển mới (YTD)" value="90" trend="+20.1%" trendUp color="bg-emerald-500" />
                <StatCard icon={<UserMinus size={20} />} title="Nghỉ việc (YTD)" value="20" trend="-5.2%" trendUp color="bg-rose-500" />
                <StatCard icon={<DollarSign size={20} />} title="Quỹ Lương TB/Tháng" value="2.9 Tỷ" trend="+8.4%" trendUp={false} color="bg-amber-500" />
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Biến động nhân sự */}
                <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="mb-6">
                        <h3 className="font-black text-slate-900 dark:text-slate-100">Biến động Nhân sự (T1 - T7)</h3>
                        <p className="text-xs text-slate-500">So sánh lượng tuyển dụng mới và số người nghỉ việc</p>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={MOCK_TURNOVER_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorLeft" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', borderColor: '#334155', backgroundColor: '#0f172a', color: '#fff' }}
                                    itemStyle={{ fontSize: '13px', fontWeight: 600 }}
                                />
                                <Area type="monotone" dataKey="newHires" name="Tuyển mới" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorNew)" />
                                <Area type="monotone" dataKey="left" name="Nghỉ việc" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorLeft)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chi phí theo PB */}
                <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div className="mb-6">
                        <h3 className="font-black text-slate-900 dark:text-slate-100">Luồng Chi Phí Theo Phòng Ban</h3>
                        <p className="text-xs text-slate-500">Chi phí cơ bản và Thưởng hiệu suất (Triệu VNĐ)</p>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={MOCK_COST_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                <XAxis dataKey="department" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(51, 65, 85, 0.1)' }}
                                    contentStyle={{ borderRadius: '12px', borderColor: '#334155', backgroundColor: '#0f172a', color: '#fff' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Bar dataKey="salary" name="Lương Cơ Bản" stackId="a" fill="#6366f1" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="bonus" name="Thưởng/Phụ Cấp" stackId="a" fill="#818cf8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Warning Alert */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-4">
                <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                <div>
                    <h4 className="font-bold text-amber-800 dark:text-amber-300">Tỷ lệ Turnover phòng Kỹ Thuật đang tăng</h4>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">Trong Quý 2 vừa qua, tỷ lệ biến động nhân sự phòng kỹ thuật vượt ngưỡng 12%. Đề xuất bộ phận C&B rà soát lại chính sách đãi ngộ.</p>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{
    icon: React.ReactNode,
    title: string,
    value: string,
    trend: string,
    trendUp: boolean,
    color: string
}> = ({ icon, title, value, trend, trendUp, color }) => (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 group hover:border-indigo-200 dark:hover:border-indigo-800 transition">
        <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg text-white ${color} shadow-sm group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 leading-tight">{title}</span>
        </div>
        <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</h3>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${trendUp ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                {trend}
            </span>
        </div>
    </div>
);
