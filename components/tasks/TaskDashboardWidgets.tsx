import React, { useState, useEffect, useMemo } from 'react';
import {
    CheckCircle2, Clock, AlertTriangle, TrendingUp, BarChart3,
    ListChecks, Users, Zap, Target
} from 'lucide-react';
import { Task } from '../../types';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '../../constants';

// ============================================================================
// TASK DASHBOARD WIDGETS — Summary cards, charts, and metrics for tasks
// ============================================================================

interface WidgetProps {
    tasks: Task[];
}

const TaskDashboardWidgets: React.FC<WidgetProps> = ({ tasks }) => {
    // Computed stats
    const stats = useMemo(() => {
        const todayStr = new Date().toISOString().slice(0, 10);

        let total = tasks.length;
        let completed = 0;
        let inProgress = 0;
        let notStarted = 0;
        let overdue = 0;
        let noDate = 0;
        let totalEstimate = 0;
        let totalSpent = 0;

        const byPriority: Record<string, number> = {};
        const byAssignee: Record<string, number> = {};

        tasks.forEach(t => {
            if (t.status_id === 'status_done' || t.status_id === 'status_cancelled') completed++;
            else if (t.status_id === 'status_pending') notStarted++;
            else inProgress++;

            if (t.due_date && t.due_date < todayStr && t.status_id !== 'status_done' && t.status_id !== 'status_cancelled') {
                overdue++;
            }

            if (!t.due_date) noDate++;
            totalEstimate += t.time_estimate || 0;
            totalSpent += t.time_spent || 0;

            const p = t.priority || 'none';
            byPriority[p] = (byPriority[p] || 0) + 1;

            (t.assignees || []).forEach(uid => {
                byAssignee[uid] = (byAssignee[uid] || 0) + 1;
            });
        });

        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { total, completed, inProgress, notStarted, overdue, noDate, totalEstimate, totalSpent, completionRate, byPriority, byAssignee };
    }, [tasks]);

    const priorityData = useMemo(() => {
        return Object.entries(stats.byPriority)
            .map(([key, count]) => ({
                label: TASK_PRIORITY_LABELS[key]?.label || key,
                color: TASK_PRIORITY_LABELS[key]?.color || '#94A3B8',
                count,
                pct: stats.total > 0 ? Math.round((count / stats.total) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count);
    }, [stats]);

    return (
        <div className="space-y-4 p-4">
            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPICard
                    icon={<ListChecks size={18} />}
                    label="Tổng công việc"
                    value={stats.total}
                    color="indigo"
                />
                <KPICard
                    icon={<CheckCircle2 size={18} />}
                    label="Hoàn thành"
                    value={`${stats.completionRate}%`}
                    subtext={`${stats.completed}/${stats.total}`}
                    color="emerald"
                />
                <KPICard
                    icon={<TrendingUp size={18} />}
                    label="Đang thực hiện"
                    value={stats.inProgress}
                    color="blue"
                />
                <KPICard
                    icon={<AlertTriangle size={18} />}
                    label="Quá hạn"
                    value={stats.overdue}
                    color={stats.overdue > 0 ? 'red' : 'slate'}
                />
            </div>

            {/* Status progress bar */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Tiến độ tổng thể</h4>
                <div className="w-full h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    {stats.completed > 0 && (
                        <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${(stats.completed / Math.max(stats.total, 1)) * 100}%` }}
                            title={`Hoàn thành: ${stats.completed}`}
                        />
                    )}
                    {stats.inProgress > 0 && (
                        <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${(stats.inProgress / Math.max(stats.total, 1)) * 100}%` }}
                            title={`Đang làm: ${stats.inProgress}`}
                        />
                    )}
                    {stats.notStarted > 0 && (
                        <div
                            className="h-full bg-slate-300 dark:bg-slate-600 transition-all"
                            style={{ width: `${(stats.notStarted / Math.max(stats.total, 1)) * 100}%` }}
                            title={`Chưa bắt đầu: ${stats.notStarted}`}
                        />
                    )}
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Hoàn thành ({stats.completed})</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Đang làm ({stats.inProgress})</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" /> Chưa bắt đầu ({stats.notStarted})</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Priority distribution */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Phân bố ưu tiên</h4>
                    <div className="space-y-2">
                        {priorityData.map(item => (
                            <div key={item.label} className="flex items-center gap-2">
                                <span className="w-16 text-xs text-slate-600 dark:text-slate-400 truncate">{item.label}</span>
                                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                                    />
                                </div>
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-8 text-right">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Time tracking summary */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Thời gian</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                {stats.totalEstimate > 0 ? `${Math.round(stats.totalEstimate / 60)}h` : '—'}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Ước tính</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                {stats.totalSpent > 0 ? `${Math.round(stats.totalSpent / 60)}h` : '—'}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Đã dùng</div>
                        </div>
                    </div>
                    {stats.totalEstimate > 0 && (
                        <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                <span>Sử dụng</span>
                                <span>{Math.round((stats.totalSpent / Math.max(stats.totalEstimate, 1)) * 100)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${stats.totalSpent > stats.totalEstimate ? 'bg-red-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(100, (stats.totalSpent / Math.max(stats.totalEstimate, 1)) * 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Reusable KPI Card
const KPICard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subtext?: string;
    color: string;
}> = ({ icon, label, value, subtext, color }) => {
    const colorMap: Record<string, string> = {
        indigo: 'from-indigo-500 to-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
        emerald: 'from-emerald-500 to-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
        blue: 'from-blue-500 to-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
        red: 'from-red-500 to-red-600 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
        slate: 'from-slate-400 to-slate-500 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800',
    };

    const cls = colorMap[color] || colorMap.slate;
    const parts = cls.split(' ');
    const textColor = parts.filter(p => p.startsWith('text-') || p.startsWith('dark:text-')).join(' ');
    const bgColor = parts.filter(p => p.startsWith('bg-') || p.startsWith('dark:bg-')).join(' ');

    return (
        <div className={`rounded-xl ${bgColor} p-3 border border-slate-200/50 dark:border-slate-700/50`}>
            <div className={`${textColor} mb-1`}>{icon}</div>
            <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
            {subtext && <div className="text-[10px] text-slate-400 dark:text-slate-500">{subtext}</div>}
        </div>
    );
};

export default TaskDashboardWidgets;
