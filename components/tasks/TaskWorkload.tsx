import React, { useMemo, useState } from 'react';
import { User, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Task } from '../../types';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '../../constants';

// ============================================================================
// TASK WORKLOAD — Capacity planning view: see each member's load
// ============================================================================

interface TaskWorkloadProps {
    tasks: Task[];
    onTaskClick?: (task: Task) => void;
}

interface AssigneeWorkload {
    id: string;
    name: string;
    tasks: Task[];
    completed: number;
    inProgress: number;
    overdue: number;
    totalEstimate: number;
    totalSpent: number;
}

const CAPACITY_HOURS = 40; // Weekly capacity in hours

const TaskWorkload: React.FC<TaskWorkloadProps> = ({ tasks, onTaskClick }) => {
    const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<'load' | 'name' | 'overdue'>('load');

    const todayStr = new Date().toISOString().slice(0, 10);

    const workloads = useMemo(() => {
        const map: Record<string, AssigneeWorkload> = {};

        // Collect unassigned
        const unassigned: Task[] = [];

        tasks.forEach(task => {
            const assignees = task.assignees || [];
            if (assignees.length === 0) {
                unassigned.push(task);
                return;
            }

            assignees.forEach(uid => {
                if (!map[uid]) {
                    const profile = (task as any).assignee_profiles?.find((p: any) => p.id === uid);
                    map[uid] = {
                        id: uid,
                        name: profile?.fullName || uid.slice(0, 8),
                        tasks: [],
                        completed: 0,
                        inProgress: 0,
                        overdue: 0,
                        totalEstimate: 0,
                        totalSpent: 0,
                    };
                }
                const w = map[uid];
                w.tasks.push(task);

                if (task.status_id === 'status_done' || task.status_id === 'status_cancelled') {
                    w.completed++;
                } else {
                    w.inProgress++;
                    if (task.due_date && task.due_date < todayStr) w.overdue++;
                }
                w.totalEstimate += task.time_estimate || 0;
                w.totalSpent += task.time_spent || 0;
            });
        });

        // Add unassigned group
        if (unassigned.length > 0) {
            map['__unassigned__'] = {
                id: '__unassigned__',
                name: 'Chưa phân công',
                tasks: unassigned,
                completed: unassigned.filter(t => t.status_id === 'status_done' || t.status_id === 'status_cancelled').length,
                inProgress: unassigned.filter(t => t.status_id !== 'status_done' && t.status_id !== 'status_cancelled').length,
                overdue: unassigned.filter(t => t.due_date && t.due_date < todayStr && t.status_id !== 'status_done' && t.status_id !== 'status_cancelled').length,
                totalEstimate: unassigned.reduce((sum, t) => sum + (t.time_estimate || 0), 0),
                totalSpent: unassigned.reduce((sum, t) => sum + (t.time_spent || 0), 0),
            };
        }

        let result = Object.values(map);

        if (sortBy === 'load') result.sort((a, b) => b.inProgress - a.inProgress);
        else if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
        else if (sortBy === 'overdue') result.sort((a, b) => b.overdue - a.overdue);

        return result;
    }, [tasks, sortBy]);

    const totalTasks = tasks.length;
    const totalOverdue = workloads.reduce((s, w) => s + w.overdue, 0);
    const avgLoad = workloads.length > 0 ? Math.round(totalTasks / workloads.length) : 0;

    const toggleExpand = (id: string) => {
        const next = new Set(expandedUsers);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedUsers(next);
    };

    const getLoadLevel = (w: AssigneeWorkload): { label: string; color: string; bg: string } => {
        const estimateHours = w.totalEstimate / 60;
        const ratio = CAPACITY_HOURS > 0 ? estimateHours / CAPACITY_HOURS : 0;
        if (w.inProgress === 0) return { label: 'Rảnh', color: 'text-slate-400 dark:text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' };
        if (ratio > 1 || w.inProgress > 8) return { label: 'Quá tải', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
        if (ratio > 0.7 || w.inProgress > 5) return { label: 'Nhiều', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
        return { label: 'Vừa', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' };
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Summary Header */}
            <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">Khối lượng công việc</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Sắp xếp:</span>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
                        >
                            <option value="load">Khối lượng</option>
                            <option value="overdue">Quá hạn</option>
                            <option value="name">Tên</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
                        <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{workloads.length}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Thành viên</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{avgLoad}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">TB mỗi người</div>
                    </div>
                    <div className={`text-center p-2 rounded-lg ${totalOverdue > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                        <div className={`text-lg font-bold ${totalOverdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{totalOverdue}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Quá hạn</div>
                    </div>
                </div>
            </div>

            {/* Member rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {workloads.map(w => {
                    const loadInfo = getLoadLevel(w);
                    const isExpanded = expandedUsers.has(w.id);
                    const completionPct = w.tasks.length > 0 ? Math.round(((w.completed) / w.tasks.length) * 100) : 0;

                    return (
                        <div key={w.id}>
                            {/* User row */}
                            <div
                                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                                onClick={() => toggleExpand(w.id)}
                            >
                                <button className="text-slate-400 dark:text-slate-500 flex-shrink-0">
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>

                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                    {w.name.charAt(0).toUpperCase()}
                                </div>

                                {/* Name + load badge */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{w.name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${loadInfo.color} ${loadInfo.bg}`}>
                                            {loadInfo.label}
                                        </span>
                                    </div>
                                    {/* Mini progress bar */}
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-[120px]">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full transition-all"
                                                style={{ width: `${completionPct}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{completionPct}%</span>
                                    </div>
                                </div>

                                {/* Stats badges */}
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-0.5 text-xs text-blue-600 dark:text-blue-400" title="Đang làm">
                                        <Clock size={12} /> {w.inProgress}
                                    </span>
                                    <span className="flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400" title="Hoàn thành">
                                        <CheckCircle2 size={12} /> {w.completed}
                                    </span>
                                    {w.overdue > 0 && (
                                        <span className="flex items-center gap-0.5 text-xs text-red-600 dark:text-red-400" title="Quá hạn">
                                            <AlertCircle size={12} /> {w.overdue}
                                        </span>
                                    )}
                                </div>

                                {/* Time estimate */}
                                {w.totalEstimate > 0 && (
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                                        {Math.round(w.totalEstimate / 60)}h
                                    </span>
                                )}
                            </div>

                            {/* Expanded task list */}
                            {isExpanded && (
                                <div className="bg-slate-50/50 dark:bg-slate-800/30 px-4 pb-2">
                                    {w.tasks.map(task => {
                                        const statusInfo = TASK_STATUS_LABELS[task.status_id] || { label: task.status_id, color: '#808080' };
                                        const priorityInfo = TASK_PRIORITY_LABELS[task.priority] || { label: task.priority, color: '#94A3B8' };
                                        const isOverdue = task.due_date && task.due_date < todayStr && task.status_id !== 'status_done' && task.status_id !== 'status_cancelled';

                                        return (
                                            <div
                                                key={task.id}
                                                className="flex items-center gap-2 py-1.5 pl-8 pr-2 rounded-md hover:bg-white dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                                                onClick={e => { e.stopPropagation(); onTaskClick?.(task); }}
                                            >
                                                <div
                                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: statusInfo.color }}
                                                    title={statusInfo.label}
                                                />
                                                <span className={`text-xs flex-1 truncate ${task.status_id === 'status_done' ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-300'
                                                    }`}>
                                                    {task.title}
                                                </span>
                                                {isOverdue && (
                                                    <span className="text-[10px] text-red-500 dark:text-red-400 flex-shrink-0">Quá hạn</span>
                                                )}
                                                <span
                                                    className="text-[10px] px-1 py-0.5 rounded flex-shrink-0"
                                                    style={{ color: priorityInfo.color, backgroundColor: priorityInfo.color + '15' }}
                                                >
                                                    {priorityInfo.label}
                                                </span>
                                                {task.due_date && (
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
                                                        {new Date(task.due_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {workloads.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-sm text-slate-400 dark:text-slate-500">
                        Không có dữ liệu workload
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskWorkload;
