import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, Flag, User } from 'lucide-react';
import { Task, TaskStatus } from '../../types';

interface Props {
    tasks: Task[];
    statuses: TaskStatus[];
    onSelectTask: (id: string) => void;
    onUpdateTask: (id: string, updates: Partial<Task>) => void;
    getPriorityInfo: (p: string) => { label: string; color: string; icon: string };
}

type CalendarMode = 'month' | 'week';

// ============================================================================
// TASK CALENDAR — Calendar view for tasks with month/week modes
// ============================================================================
const TaskCalendar: React.FC<Props> = ({ tasks, statuses, onSelectTask, onUpdateTask, getPriorityInfo }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [mode, setMode] = useState<CalendarMode>('month');
    const [draggedTask, setDraggedTask] = useState<string | null>(null);

    // Navigation
    const navigate = (dir: -1 | 1) => {
        const d = new Date(currentDate);
        if (mode === 'month') d.setMonth(d.getMonth() + dir);
        else d.setDate(d.getDate() + dir * 7);
        setCurrentDate(d);
    };

    const goToday = () => setCurrentDate(new Date());

    // Build calendar grid
    const calendarDays = useMemo(() => {
        if (mode === 'month') {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);

            // Start from Monday
            let startDate = new Date(firstDay);
            const dayOfWeek = startDate.getDay();
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
            startDate.setDate(startDate.getDate() - diff);

            const days: Date[] = [];
            const endDate = new Date(lastDay);
            const endDayOfWeek = endDate.getDay();
            const endDiff = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
            endDate.setDate(endDate.getDate() + endDiff);

            let d = new Date(startDate);
            while (d <= endDate) {
                days.push(new Date(d));
                d.setDate(d.getDate() + 1);
            }
            return days;
        } else {
            // Week view
            const d = new Date(currentDate);
            const dayOfWeek = d.getDay();
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            d.setDate(d.getDate() - diff);

            const days: Date[] = [];
            for (let i = 0; i < 7; i++) {
                days.push(new Date(d));
                d.setDate(d.getDate() + 1);
            }
            return days;
        }
    }, [currentDate, mode]);

    // Map tasks to dates
    const tasksByDate = useMemo(() => {
        const map = new Map<string, Task[]>();
        tasks.forEach(task => {
            const dateKey = task.due_date?.slice(0, 10);
            if (dateKey) {
                if (!map.has(dateKey)) map.set(dateKey, []);
                map.get(dateKey)!.push(task);
            }
            // Also show on start_date if different
            const startKey = task.start_date?.slice(0, 10);
            if (startKey && startKey !== dateKey) {
                if (!map.has(startKey)) map.set(startKey, []);
                map.get(startKey)!.push(task);
            }
        });
        return map;
    }, [tasks]);

    // No-date tasks
    const noDateTasks = useMemo(() => tasks.filter(t => !t.due_date && !t.start_date), [tasks]);

    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = currentDate.getMonth();

    const formatHeader = () => {
        if (mode === 'month') {
            return currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
        }
        const start = calendarDays[0];
        const end = calendarDays[calendarDays.length - 1];
        if (start.getMonth() === end.getMonth()) {
            return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}`;
        }
        return `${start.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    };

    const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    // Drag & Drop handlers
    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.stopPropagation();
        setDraggedTask(taskId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, dateStr: string) => {
        e.preventDefault();
        if (draggedTask) {
            onUpdateTask(draggedTask, { due_date: dateStr });
            setDraggedTask(null);
        }
    };

    const getStatusColor = (statusId: string) => {
        const s = statuses.find(st => st.id === statusId);
        return s?.color || '#808080';
    };

    return (
        <div className="flex flex-col h-full">
            {/* Calendar Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 min-w-[220px] text-center capitalize">
                        {formatHeader()}
                    </h3>
                    <button
                        onClick={() => navigate(1)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                    <button
                        onClick={goToday}
                        className="px-3 py-1 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Hôm nay
                    </button>
                </div>

                {/* Mode Toggle */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                    <button
                        onClick={() => setMode('month')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${mode === 'month'
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        Tháng
                    </button>
                    <button
                        onClick={() => setMode('week')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${mode === 'week'
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        Tuần
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto">
                {/* Day Names Header */}
                <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                    {dayNames.map(name => (
                        <div key={name} className="text-center py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {name}
                        </div>
                    ))}
                </div>

                {/* Day Cells */}
                <div className={`grid grid-cols-7 ${mode === 'week' ? 'flex-1' : ''}`} style={mode === 'week' ? { minHeight: 'calc(100vh - 14rem)' } : {}}>
                    {calendarDays.map((day, idx) => {
                        const dateStr = day.toISOString().slice(0, 10);
                        const dayTasks = tasksByDate.get(dateStr) || [];
                        const isToday = dateStr === today;
                        const isCurrentMonth = day.getMonth() === currentMonth;
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                        return (
                            <div
                                key={idx}
                                onDragOver={handleDragOver}
                                onDrop={e => handleDrop(e, dateStr)}
                                className={`border-b border-r border-slate-200 dark:border-slate-800 ${mode === 'month' ? 'min-h-[100px]' : 'min-h-[300px]'} 
                                    ${!isCurrentMonth && mode === 'month' ? 'bg-slate-50 dark:bg-slate-900/50' : 'bg-white dark:bg-slate-900'}
                                    ${isWeekend ? 'bg-slate-50/50 dark:bg-slate-900/70' : ''}
                                    ${isToday ? 'ring-inset ring-2 ring-indigo-400 dark:ring-indigo-500' : ''}
                                    transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50`}
                            >
                                {/* Day Number */}
                                <div className="flex items-center justify-between px-2 py-1">
                                    <span className={`text-sm font-medium ${isToday
                                        ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs'
                                        : isCurrentMonth || mode === 'week'
                                            ? 'text-slate-700 dark:text-slate-300'
                                            : 'text-slate-400 dark:text-slate-600'
                                        }`}>
                                        {day.getDate()}
                                    </span>
                                    {dayTasks.length > 0 && (
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                            {dayTasks.length}
                                        </span>
                                    )}
                                </div>

                                {/* Tasks */}
                                <div className="px-1 pb-1 space-y-0.5">
                                    {dayTasks.slice(0, mode === 'month' ? 3 : 20).map(task => (
                                        <div
                                            key={task.id}
                                            draggable
                                            onDragStart={e => handleDragStart(e, task.id)}
                                            onClick={(e) => { e.stopPropagation(); onSelectTask(task.id); }}
                                            className={`group flex items-center gap-1 px-1.5 py-0.5 rounded text-xs cursor-pointer transition-all
                                                hover:shadow-sm hover:scale-[1.02]
                                                ${task.status_id === 'status_done'
                                                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 line-through opacity-70'
                                                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600'
                                                }`}
                                        >
                                            {/* Status dot */}
                                            <span
                                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: getStatusColor(task.status_id) }}
                                            />
                                            {/* Title */}
                                            <span className="truncate flex-1 font-medium">{task.title}</span>
                                            {/* Priority indicator */}
                                            {task.priority && task.priority !== 'none' && (
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: getPriorityInfo(task.priority).color }}
                                                />
                                            )}
                                        </div>
                                    ))}
                                    {/* Show more indicator */}
                                    {mode === 'month' && dayTasks.length > 3 && (
                                        <button className="text-[10px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 px-1.5 font-medium">
                                            +{dayTasks.length - 3} thêm
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* No-date tasks summary */}
            {noDateTasks.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-4 py-2">
                    <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-400 dark:text-slate-500" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            {noDateTasks.length} công việc chưa có ngày hạn
                        </span>
                        <div className="flex gap-1 flex-wrap">
                            {noDateTasks.slice(0, 5).map(task => (
                                <button
                                    key={task.id}
                                    onClick={() => onSelectTask(task.id)}
                                    className="text-xs px-2 py-0.5 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors cursor-pointer"
                                >
                                    {task.title.slice(0, 20)}{task.title.length > 20 ? '...' : ''}
                                </button>
                            ))}
                            {noDateTasks.length > 5 && (
                                <span className="text-xs text-slate-400 dark:text-slate-500 py-0.5">
                                    +{noDateTasks.length - 5}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskCalendar;
