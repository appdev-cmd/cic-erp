import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Task } from '../../types';
import { TASK_STATUS_LABELS } from '../../constants';

// ============================================================================
// TASK TIMELINE — Resource-based timeline (who is doing what, when)
// ============================================================================

interface TaskTimelineProps {
    tasks: Task[];
    onTaskClick?: (task: Task) => void;
}

const TaskTimeline: React.FC<TaskTimelineProps> = ({ tasks, onTaskClick }) => {
    const [weekOffset, setWeekOffset] = useState(0);

    const today = new Date();
    const startOfWeek = useMemo(() => {
        const d = new Date(today);
        d.setDate(d.getDate() - d.getDay() + 1 + weekOffset * 7); // Monday
        d.setHours(0, 0, 0, 0);
        return d;
    }, [weekOffset]);

    const days = useMemo(() => {
        return Array.from({ length: 14 }, (_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);
            return d;
        });
    }, [startOfWeek]);

    // Group tasks by assignees
    const assigneeGroups = useMemo(() => {
        const groups: Record<string, { name: string; tasks: Task[] }> = {};

        tasks.forEach(task => {
            const assignees = task.assignees || [];
            if (assignees.length === 0) {
                const key = '__unassigned__';
                if (!groups[key]) groups[key] = { name: 'Chưa phân công', tasks: [] };
                groups[key].tasks.push(task);
            } else {
                assignees.forEach(uid => {
                    if (!groups[uid]) {
                        const profile = task.assignee_profiles?.find(p => p.id === uid);
                        groups[uid] = { name: profile?.fullName || uid.slice(0, 8), tasks: [] };
                    }
                    groups[uid].tasks.push(task);
                });
            }
        });

        return Object.entries(groups).sort((a, b) => a[1].name.localeCompare(b[1].name));
    }, [tasks]);

    const getTaskPosition = (task: Task) => {
        if (!task.start_date && !task.due_date) return null;

        const start = task.start_date ? new Date(task.start_date) : (task.due_date ? new Date(task.due_date) : today);
        const end = task.due_date ? new Date(task.due_date) : start;

        const dayMs = 86400000;
        const timelineStart = startOfWeek.getTime();
        const timelineEnd = days[days.length - 1].getTime() + dayMs;

        if (end.getTime() < timelineStart || start.getTime() > timelineEnd) return null;

        const left = Math.max(0, (start.getTime() - timelineStart) / dayMs);
        const right = Math.min(14, (end.getTime() - timelineStart + dayMs) / dayMs);
        const width = right - left;

        return { left: `${(left / 14) * 100}%`, width: `${(width / 14) * 100}%` };
    };

    const getStatusColor = (statusId: string) => {
        const info = TASK_STATUS_LABELS[statusId];
        return info?.color || '#808080';
    };

    const isToday = (d: Date) => {
        return d.toDateString() === today.toDateString();
    };

    const isWeekend = (d: Date) => {
        return d.getDay() === 0 || d.getDay() === 6;
    };

    const weekLabel = useMemo(() => {
        const s = days[0];
        const e = days[13];
        return `${s.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} — ${e.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    }, [days]);

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setWeekOffset(prev => prev - 1)}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        onClick={() => setWeekOffset(0)}
                        className="px-2 py-0.5 text-xs rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                    >
                        Hôm nay
                    </button>
                    <button
                        onClick={() => setWeekOffset(prev => prev + 1)}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{weekLabel}</span>
            </div>

            {/* Day headers */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
                <div className="w-36 flex-shrink-0 px-3 py-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase border-r border-slate-200 dark:border-slate-800">
                    Người thực hiện
                </div>
                <div className="flex-1 flex">
                    {days.map((d, i) => (
                        <div
                            key={i}
                            className={`flex-1 text-center py-1.5 text-[10px] font-medium border-r border-slate-100 dark:border-slate-800 ${isToday(d)
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold'
                                    : isWeekend(d)
                                        ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                        >
                            <div>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]}</div>
                            <div className={`text-sm ${isToday(d) ? 'font-bold' : ''}`}>{d.getDate()}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto">
                {assigneeGroups.map(([key, group]) => (
                    <div key={key} className="flex border-b border-slate-100 dark:border-slate-800 min-h-[48px]">
                        {/* Name */}
                        <div className="w-36 flex-shrink-0 px-3 py-2 flex items-center gap-2 border-r border-slate-200 dark:border-slate-800">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px]">
                                <User size={10} />
                            </div>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{group.name}</span>
                        </div>

                        {/* Timeline bars */}
                        <div className="flex-1 relative">
                            {/* Grid lines */}
                            <div className="absolute inset-0 flex">
                                {days.map((d, i) => (
                                    <div
                                        key={i}
                                        className={`flex-1 border-r border-slate-100 dark:border-slate-800 ${isWeekend(d) ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''
                                            } ${isToday(d) ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                                    />
                                ))}
                            </div>

                            {/* Task bars */}
                            {group.tasks.map((task, tIdx) => {
                                const pos = getTaskPosition(task);
                                if (!pos) return null;

                                const color = getStatusColor(task.status_id);
                                return (
                                    <div
                                        key={task.id}
                                        className="absolute h-5 rounded-md cursor-pointer hover:opacity-80 transition-opacity flex items-center px-1.5 overflow-hidden shadow-sm"
                                        style={{
                                            left: pos.left,
                                            width: pos.width,
                                            top: `${4 + tIdx * 24}px`,
                                            backgroundColor: color + '25',
                                            borderLeft: `3px solid ${color}`,
                                        }}
                                        onClick={() => onTaskClick?.(task)}
                                        title={task.title}
                                    >
                                        <span className="text-[10px] font-medium truncate" style={{ color }}>
                                            {task.title}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {assigneeGroups.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-sm text-slate-400 dark:text-slate-500">
                        Không có dữ liệu timeline
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskTimeline;
