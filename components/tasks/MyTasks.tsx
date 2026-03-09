import React, { useState, useEffect } from 'react';
import {
    CheckSquare, Calendar, AlertTriangle, Clock, ArrowRight,
    User, Flag, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { TaskService } from '../../services';
import { Task } from '../../types';
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '../../constants';
import { toast } from 'sonner';

// ============================================================================
// MY TASKS — "Công việc của tôi" page
// ============================================================================
const MyTasks: React.FC = () => {
    const { user } = useAuth();

    const [overdue, setOverdue] = useState<Task[]>([]);
    const [today, setToday] = useState<Task[]>([]);
    const [upcoming, setUpcoming] = useState<Task[]>([]);
    const [noDate, setNoDate] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    const loadMyTasks = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const result = await TaskService.getMyTasks(user.id);
            setOverdue(result.overdue);
            setToday(result.today);
            setUpcoming(result.upcoming);
            setNoDate(result.noDate);
        } catch (e: any) {
            toast.error('Lỗi tải công việc: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadMyTasks(); }, [user?.id]);

    const handleStatusToggle = async (task: Task) => {
        const newStatus = task.status_id === 'status_done' ? 'status_pending' : 'status_done';
        try {
            await TaskService.update(task.id, { status_id: newStatus }, user?.id);
            await loadMyTasks();
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const totalTasks = overdue.length + today.length + upcoming.length + noDate.length;
    const todayStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Công việc của tôi</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{todayStr}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Quá hạn', count: overdue.length, color: 'red', icon: <AlertTriangle size={20} /> },
                    { label: 'Hôm nay', count: today.length, color: 'amber', icon: <Clock size={20} /> },
                    { label: 'Sắp tới', count: upcoming.length, color: 'blue', icon: <Calendar size={20} /> },
                    { label: 'Tổng cộng', count: totalTasks, color: 'indigo', icon: <CheckSquare size={20} /> },
                ].map(card => (
                    <div
                        key={card.label}
                        className={`bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm`}
                    >
                        <div className={`flex items-center justify-between mb-2`}>
                            <span className={`text-${card.color}-500 dark:text-${card.color}-400`}>{card.icon}</span>
                        </div>
                        <div className={`text-2xl font-bold text-${card.color}-600 dark:text-${card.color}-400`}>{card.count}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{card.label}</div>
                    </div>
                ))}
            </div>

            {/* Task Groups */}
            <div className="space-y-6">
                {/* Overdue */}
                {overdue.length > 0 && (
                    <TaskGroup title="Quá hạn" tasks={overdue} variant="red" onStatusToggle={handleStatusToggle} />
                )}

                {/* Today */}
                <TaskGroup title="Hôm nay" tasks={today} variant="amber" onStatusToggle={handleStatusToggle} />

                {/* Upcoming */}
                {upcoming.length > 0 && (
                    <TaskGroup title="Sắp tới" tasks={upcoming} variant="blue" onStatusToggle={handleStatusToggle} />
                )}

                {/* No date */}
                {noDate.length > 0 && (
                    <TaskGroup title="Không có hạn" tasks={noDate} variant="slate" onStatusToggle={handleStatusToggle} />
                )}

                {/* Empty state */}
                {totalTasks === 0 && (
                    <div className="text-center py-20">
                        <CheckSquare size={48} className="mx-auto text-emerald-400 dark:text-emerald-500 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Tất cả đã hoàn thành!</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Không có công việc nào được giao cho bạn.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Task group component
const TaskGroup: React.FC<{
    title: string;
    tasks: Task[];
    variant: string;
    onStatusToggle: (t: Task) => void;
}> = ({ title, tasks, variant, onStatusToggle }) => {
    const colorMap: Record<string, string> = {
        red: 'border-red-200 dark:border-red-800',
        amber: 'border-amber-200 dark:border-amber-800',
        blue: 'border-blue-200 dark:border-blue-800',
        slate: 'border-slate-200 dark:border-slate-700',
        indigo: 'border-indigo-200 dark:border-indigo-800',
    };

    const dotMap: Record<string, string> = {
        red: 'bg-red-500',
        amber: 'bg-amber-500',
        blue: 'bg-blue-500',
        slate: 'bg-slate-400',
        indigo: 'bg-indigo-500',
    };

    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${dotMap[variant] || dotMap.slate}`} />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{title}</h3>
                <span className="text-xs text-slate-400 dark:text-slate-500">({tasks.length})</span>
            </div>

            <div className={`bg-white dark:bg-slate-800 rounded-xl border ${colorMap[variant] || colorMap.slate} divide-y divide-slate-100 dark:divide-slate-700 shadow-sm overflow-hidden`}>
                {tasks.map(task => (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        {/* Status toggle */}
                        <button
                            onClick={() => onStatusToggle(task)}
                            className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${task.status_id === 'status_done'
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                                }`}
                        />

                        {/* Title */}
                        <span className={`flex-1 text-sm ${task.status_id === 'status_done'
                                ? 'text-slate-400 dark:text-slate-500 line-through'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}>
                            {task.title}
                        </span>

                        {/* Priority */}
                        {task.priority && task.priority !== 'none' && (
                            <span
                                className="text-xs font-medium px-1.5 py-0.5 rounded"
                                style={{
                                    color: TASK_PRIORITY_LABELS[task.priority]?.color || '#94A3B8',
                                    backgroundColor: (TASK_PRIORITY_LABELS[task.priority]?.color || '#94A3B8') + '15',
                                }}
                            >
                                {TASK_PRIORITY_LABELS[task.priority]?.label || task.priority}
                            </span>
                        )}

                        {/* Due date */}
                        {task.due_date && (
                            <span className={`text-xs ${task.due_date < new Date().toISOString().slice(0, 10)
                                    ? 'text-red-500 dark:text-red-400 font-medium'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}>
                                {new Date(task.due_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                            </span>
                        )}
                    </div>
                ))}

                {tasks.length === 0 && (
                    <div className="text-center py-6 text-sm text-slate-400 dark:text-slate-500">
                        Không có công việc
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyTasks;
