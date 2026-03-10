import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { Task, TaskStatus } from '../../types';

interface Props {
    tasks: Task[];
    statuses: TaskStatus[];
    onSelectTask: (id: string) => void;
    onUpdateTask: (id: string, updates: Partial<Task>) => void;
    getPriorityInfo: (p: string) => { label: string; color: string; icon: string };
}

type ZoomLevel = 'day' | 'week' | 'month';

// ============================================================================
// TASK GANTT — Gantt chart view for timeline visualization
// ============================================================================
const TaskGantt: React.FC<Props> = ({ tasks, statuses, onSelectTask, onUpdateTask, getPriorityInfo }) => {
    const [zoom, setZoom] = useState<ZoomLevel>('week');
    const scrollRef = useRef<HTMLDivElement>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']));

    // Calculate date range from tasks
    const { startDate, endDate, totalDays, columns } = useMemo(() => {
        const now = new Date();
        let minDate = new Date(now);
        let maxDate = new Date(now);
        minDate.setDate(minDate.getDate() - 7);
        maxDate.setDate(maxDate.getDate() + 60);

        tasks.forEach(task => {
            if (task.start_date) {
                const d = new Date(task.start_date);
                if (d < minDate) minDate = new Date(d);
            }
            if (task.due_date) {
                const d = new Date(task.due_date);
                if (d > maxDate) maxDate = new Date(d);
            }
        });

        // Add padding
        minDate.setDate(minDate.getDate() - 3);
        maxDate.setDate(maxDate.getDate() + 14);

        const total = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

        // Build columns
        const cols: { date: Date; label: string; isToday: boolean; isWeekend: boolean; monthLabel?: string }[] = [];
        const todayStr = new Date().toISOString().slice(0, 10);
        let lastMonth = -1;

        for (let i = 0; i < total; i++) {
            const d = new Date(minDate);
            d.setDate(d.getDate() + i);
            const isNewMonth = d.getMonth() !== lastMonth;
            lastMonth = d.getMonth();

            cols.push({
                date: d,
                label: d.getDate().toString(),
                isToday: d.toISOString().slice(0, 10) === todayStr,
                isWeekend: d.getDay() === 0 || d.getDay() === 6,
                monthLabel: isNewMonth ? d.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' }) : undefined,
            });
        }

        return { startDate: minDate, endDate: maxDate, totalDays: total, columns: cols };
    }, [tasks]);

    // Column width based on zoom
    const colWidth = zoom === 'day' ? 40 : zoom === 'week' ? 28 : 12;

    // Calculate bar position for a task
    const getBarStyle = (task: Task) => {
        const start = task.start_date ? new Date(task.start_date) : task.due_date ? new Date(task.due_date) : null;
        const end = task.due_date ? new Date(task.due_date) : start ? new Date(start) : null;
        if (!start || !end) return null;

        const startOffset = Math.max(0, Math.floor((start.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        const duration = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        return {
            left: startOffset * colWidth,
            width: duration * colWidth - 2,
        };
    };

    const getStatusColor = (statusId: string) => {
        const s = statuses.find(st => st.id === statusId);
        return s?.color || '#808080';
    };

    const getStatusGroup = (statusId: string) => {
        const s = statuses.find(st => st.id === statusId);
        return s?.group || 'not_started';
    };

    // Group tasks by status group
    const groupedTasks = useMemo(() => {
        const groups = [
            { key: 'not_started', label: 'Chưa bắt đầu', tasks: [] as Task[] },
            { key: 'in_progress', label: 'Đang thực hiện', tasks: [] as Task[] },
            { key: 'completed', label: 'Hoàn thành', tasks: [] as Task[] },
        ];

        tasks.forEach(task => {
            const group = getStatusGroup(task.status_id);
            const g = groups.find(g => g.key === group);
            if (g) g.tasks.push(task);
            else groups[0].tasks.push(task);
        });

        return groups.filter(g => g.tasks.length > 0);
    }, [tasks, statuses]);

    // Today line position
    const todayOffset = useMemo(() => {
        const now = new Date();
        return Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * colWidth;
    }, [startDate, colWidth]);

    // Scroll to today on mount
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = Math.max(0, todayOffset - 300);
        }
    }, [todayOffset]);

    // Flatten visible tasks for row indexing
    const visibleTasks = useMemo(() => {
        const result: { task: Task; groupKey: string; isGroupHeader?: boolean; label?: string }[] = [];
        groupedTasks.forEach(group => {
            result.push({ task: group.tasks[0], groupKey: group.key, isGroupHeader: true, label: group.label });
            if (expandedGroups.has(group.key) || expandedGroups.has('all')) {
                group.tasks.forEach(task => result.push({ task, groupKey: group.key }));
            }
        });
        return result;
    }, [groupedTasks, expandedGroups]);

    const toggleGroup = (key: string) => {
        const next = new Set(expandedGroups);
        if (next.has(key)) next.delete(key); else next.add(key);
        next.delete('all');
        setExpandedGroups(next);
    };

    const ROW_HEIGHT = 36;

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Thu phóng:</span>
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                        {(['day', 'week', 'month'] as ZoomLevel[]).map(z => (
                            <button
                                key={z}
                                onClick={() => setZoom(z)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${zoom === z
                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {z === 'day' ? 'Ngày' : z === 'week' ? 'Tuần' : 'Tháng'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-blue-500" /> Đang thực hiện</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-green-500" /> Hoàn thành</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-slate-300 dark:bg-slate-600" /> Chưa bắt đầu</span>
                </div>
            </div>

            {/* Main Gantt Area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left sidebar — Task names */}
                <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto">
                    {/* Header */}
                    <div className="h-[52px] flex items-center px-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Công việc</span>
                    </div>
                    {/* Task rows */}
                    {visibleTasks.map((item, idx) =>
                        item.isGroupHeader ? (
                            <div
                                key={`group-${item.groupKey}`}
                                onClick={() => toggleGroup(item.groupKey)}
                                className="h-[32px] flex items-center gap-1.5 px-3 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-800"
                            >
                                {expandedGroups.has(item.groupKey) || expandedGroups.has('all')
                                    ? <ChevronDown size={12} />
                                    : <ChevronRightIcon size={12} />
                                }
                                {item.label} ({groupedTasks.find(g => g.key === item.groupKey)?.tasks.length || 0})
                            </div>
                        ) : (
                            <div
                                key={item.task.id}
                                onClick={() => onSelectTask(item.task.id)}
                                className="flex items-center gap-2 px-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                                style={{ height: ROW_HEIGHT }}
                            >
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: getStatusColor(item.task.status_id) }}
                                />
                                <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1">
                                    {item.task.title}
                                </span>
                                {item.task.priority && item.task.priority !== 'none' && (
                                    <span
                                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: getPriorityInfo(item.task.priority).color }}
                                    />
                                )}
                            </div>
                        )
                    )}
                </div>

                {/* Right — Timeline grid */}
                <div ref={scrollRef} className="flex-1 overflow-auto">
                    {/* Timeline Header */}
                    <div className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
                        {/* Month row */}
                        <div className="flex h-[26px]">
                            {columns.map((col, i) =>
                                col.monthLabel ? (
                                    <div
                                        key={`m-${i}`}
                                        className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-1 flex items-center border-l border-slate-200 dark:border-slate-700"
                                        style={{ minWidth: colWidth }}
                                    >
                                        {col.monthLabel}
                                    </div>
                                ) : (
                                    <div key={`m-${i}`} style={{ minWidth: colWidth }} />
                                )
                            )}
                        </div>
                        {/* Day row */}
                        <div className="flex h-[26px] border-t border-slate-200 dark:border-slate-700">
                            {columns.map((col, i) => (
                                <div
                                    key={`d-${i}`}
                                    className={`flex items-center justify-center text-[10px] border-r border-slate-200 dark:border-slate-700
                                        ${col.isToday
                                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold'
                                            : col.isWeekend
                                                ? 'text-slate-400 dark:text-slate-500 bg-slate-100/50 dark:bg-slate-800/50'
                                                : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                    style={{ minWidth: colWidth }}
                                >
                                    {col.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Task Bars */}
                    <div className="relative" style={{ width: totalDays * colWidth }}>
                        {/* Today line */}
                        <div
                            className="absolute top-0 bottom-0 w-px bg-indigo-500 dark:bg-indigo-400 z-10 opacity-60"
                            style={{ left: todayOffset + colWidth / 2 }}
                        />

                        {/* Weekend columns */}
                        {columns.map((col, i) =>
                            col.isWeekend ? (
                                <div
                                    key={`wb-${i}`}
                                    className="absolute top-0 bottom-0 bg-slate-50 dark:bg-slate-800/30"
                                    style={{ left: i * colWidth, width: colWidth }}
                                />
                            ) : null
                        )}

                        {/* Rows */}
                        {visibleTasks.map((item, idx) => {
                            if (item.isGroupHeader) {
                                return (
                                    <div
                                        key={`gr-${item.groupKey}`}
                                        className="h-[32px] border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20"
                                    />
                                );
                            }

                            const bar = getBarStyle(item.task);
                            const statusColor = getStatusColor(item.task.status_id);
                            const group = getStatusGroup(item.task.status_id);

                            return (
                                <div
                                    key={item.task.id}
                                    className="relative border-b border-slate-100 dark:border-slate-800"
                                    style={{ height: ROW_HEIGHT }}
                                >
                                    {bar && (
                                        <div
                                            onClick={() => onSelectTask(item.task.id)}
                                            className={`absolute top-1.5 rounded-md cursor-pointer transition-all hover:shadow-md hover:scale-y-110
                                                ${group === 'completed'
                                                    ? 'opacity-60'
                                                    : 'hover:brightness-110'
                                                }`}
                                            style={{
                                                left: bar.left,
                                                width: Math.max(bar.width, colWidth),
                                                height: ROW_HEIGHT - 12,
                                                backgroundColor: statusColor + '30',
                                                borderLeft: `3px solid ${statusColor}`,
                                            }}
                                        >
                                            <div className="flex items-center h-full px-2 overflow-hidden">
                                                <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate">
                                                    {zoom !== 'month' ? item.task.title : ''}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskGantt;
