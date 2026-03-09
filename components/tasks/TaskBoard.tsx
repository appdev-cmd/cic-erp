import React, { useState } from 'react';
import { Task, TaskStatus } from '../../types';
import { Plus, User, Calendar, Flag, GripVertical, CheckSquare } from 'lucide-react';

interface Props {
    tasks: Task[];
    statuses: TaskStatus[];
    onUpdateTask: (id: string, updates: Partial<Task>) => void;
    onSelectTask: (id: string) => void;
    getPriorityInfo: (p: string) => { label: string; color: string; icon: string };
}

// ============================================================================
// TASK BOARD — Kanban board view grouped by status
// ============================================================================
const TaskBoard: React.FC<Props> = ({ tasks, statuses, onUpdateTask, onSelectTask, getPriorityInfo }) => {
    const [draggedId, setDraggedId] = useState<string | null>(null);

    // Group tasks by status
    const columns = statuses.map(status => ({
        ...status,
        tasks: tasks.filter(t => t.status_id === status.id),
    }));

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        setDraggedId(taskId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', taskId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, statusId: string) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId && taskId !== draggedId) return;
        if (taskId) {
            onUpdateTask(taskId, { status_id: statusId });
        }
        setDraggedId(null);
    };

    return (
        <div className="flex gap-3 p-4 overflow-x-auto h-full">
            {columns.map(col => (
                <div
                    key={col.id}
                    className="flex-shrink-0 w-72 flex flex-col bg-slate-50 dark:bg-slate-800 rounded-xl"
                    onDragOver={handleDragOver}
                    onDrop={e => handleDrop(e, col.id)}
                >
                    {/* Column Header */}
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 dark:border-slate-700">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1">{col.name}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                            {col.tasks.length}
                        </span>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {col.tasks.map(task => (
                            <div
                                key={task.id}
                                draggable
                                onDragStart={e => handleDragStart(e, task.id)}
                                onClick={() => onSelectTask(task.id)}
                                className={`bg-white dark:bg-slate-900 rounded-lg p-3 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer transition-all group ${draggedId === task.id ? 'opacity-50' : ''
                                    }`}
                            >
                                {/* Drag handle */}
                                <div className="flex items-start gap-1">
                                    <GripVertical size={14} className="text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        {/* Priority + Title */}
                                        <div className="flex items-center gap-1.5">
                                            {task.priority && task.priority !== 'none' && (
                                                <span className="text-xs" style={{ color: getPriorityInfo(task.priority).color }}>
                                                    <Flag size={12} fill={getPriorityInfo(task.priority).color} />
                                                </span>
                                            )}
                                            <span className={`text-sm font-medium truncate ${task.status_id === 'status_done'
                                                    ? 'text-slate-400 dark:text-slate-500 line-through'
                                                    : 'text-slate-800 dark:text-slate-200'
                                                }`}>
                                                {task.title}
                                            </span>
                                        </div>

                                        {/* Tags */}
                                        {(task.tags || []).length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {task.tags.slice(0, 2).map(tag => (
                                                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Bottom row: date, subtask count, assignees */}
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-center gap-2">
                                                {task.due_date && (
                                                    <span className={`text-[11px] flex items-center gap-0.5 ${task.due_date < new Date().toISOString().slice(0, 10) && task.status_id !== 'status_done'
                                                            ? 'text-red-500 dark:text-red-400'
                                                            : 'text-slate-400 dark:text-slate-500'
                                                        }`}>
                                                        <Calendar size={10} />
                                                        {new Date(task.due_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                                    </span>
                                                )}
                                                {task.subtask_count && task.subtask_count > 0 && (
                                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                                                        <CheckSquare size={10} />
                                                        {task.completed_subtask_count || 0}/{task.subtask_count}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Assignees */}
                                            {task.assignees && task.assignees.length > 0 && (
                                                <div className="flex -space-x-1">
                                                    {task.assignees.slice(0, 2).map((_, i) => (
                                                        <div key={i} className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 border border-white dark:border-slate-900 flex items-center justify-center">
                                                            <User size={8} className="text-white" />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {col.tasks.length === 0 && (
                            <div className="text-center py-6 text-slate-400 dark:text-slate-600 text-xs">
                                Kéo thả task vào đây
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TaskBoard;
