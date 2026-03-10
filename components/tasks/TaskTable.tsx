import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Edit3, Check, X } from 'lucide-react';
import { Task, TaskStatus } from '../../types';
import { TASK_PRIORITY_LABELS } from '../../constants';

interface Props {
    tasks: Task[];
    statuses: TaskStatus[];
    onSelectTask: (id: string) => void;
    onUpdateTask: (id: string, updates: Partial<Task>) => void;
    getPriorityInfo: (p: string) => { label: string; color: string; icon: string };
}

type SortField = 'title' | 'status_id' | 'priority' | 'due_date' | 'assignees' | 'created_at';
type SortDir = 'asc' | 'desc';

interface EditingCell {
    taskId: string;
    field: string;
    value: any;
}

// ============================================================================
// TASK TABLE — Spreadsheet-like view with inline editing
// ============================================================================
const TaskTable: React.FC<Props> = ({ tasks, statuses, onSelectTask, onUpdateTask, getPriorityInfo }) => {
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    // Sort tasks
    const sortedTasks = useMemo(() => {
        return [...tasks].sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'title': cmp = (a.title || '').localeCompare(b.title || ''); break;
                case 'status_id': cmp = (a.status_id || '').localeCompare(b.status_id || ''); break;
                case 'priority': {
                    const order = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
                    cmp = (order[a.priority as keyof typeof order] ?? 4) - (order[b.priority as keyof typeof order] ?? 4);
                    break;
                }
                case 'due_date': cmp = (a.due_date || 'z').localeCompare(b.due_date || 'z'); break;
                case 'assignees': cmp = (a.assignees?.length || 0) - (b.assignees?.length || 0); break;
                case 'created_at': cmp = (a.created_at || '').localeCompare(b.created_at || ''); break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [tasks, sortField, sortDir]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const startEdit = (taskId: string, field: string, currentValue: any) => {
        setEditingCell({ taskId, field, value: currentValue });
    };

    const saveEdit = () => {
        if (!editingCell) return;
        onUpdateTask(editingCell.taskId, { [editingCell.field]: editingCell.value });
        setEditingCell(null);
    };

    const cancelEdit = () => setEditingCell(null);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') cancelEdit();
    };

    const toggleRow = (id: string) => {
        const next = new Set(selectedRows);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedRows(next);
    };

    const toggleAll = () => {
        if (selectedRows.size === tasks.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(tasks.map(t => t.id)));
        }
    };

    const getStatusInfo = (statusId: string) => {
        const s = statuses.find(st => st.id === statusId);
        return { name: s?.name || statusId, color: s?.color || '#808080' };
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30" />;
        return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
    };

    const today = new Date().toISOString().slice(0, 10);

    const columns = [
        { key: 'title' as SortField, label: 'Tên công việc', width: 'min-w-[300px]' },
        { key: 'status_id' as SortField, label: 'Trạng thái', width: 'w-[140px]' },
        { key: 'priority' as SortField, label: 'Ưu tiên', width: 'w-[120px]' },
        { key: 'due_date' as SortField, label: 'Hạn chót', width: 'w-[130px]' },
        { key: 'assignees' as SortField, label: 'Người thực hiện', width: 'w-[140px]' },
        { key: 'created_at' as SortField, label: 'Ngày tạo', width: 'w-[120px]' },
    ];

    return (
        <div className="flex flex-col h-full overflow-auto">
            <table className="w-full border-collapse">
                {/* Header */}
                <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        {/* Checkbox */}
                        <th className="w-[40px] px-3 py-2.5">
                            <input
                                type="checkbox"
                                checked={selectedRows.size === tasks.length && tasks.length > 0}
                                onChange={toggleAll}
                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                            />
                        </th>
                        {columns.map(col => (
                            <th
                                key={col.key}
                                onClick={() => handleSort(col.key)}
                                className={`${col.width} px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors select-none`}
                            >
                                <div className="flex items-center gap-1">
                                    {col.label}
                                    <SortIcon field={col.key} />
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>

                {/* Body */}
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedTasks.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="text-center py-16 text-sm text-slate-500 dark:text-slate-400">
                                Chưa có công việc nào
                            </td>
                        </tr>
                    ) : (
                        sortedTasks.map(task => (
                            <tr
                                key={task.id}
                                className={`group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${selectedRows.has(task.id) ? 'bg-indigo-50 dark:bg-indigo-900/10' : 'bg-white dark:bg-slate-900'
                                    }`}
                            >
                                {/* Checkbox */}
                                <td className="px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedRows.has(task.id)}
                                        onChange={() => toggleRow(task.id)}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </td>

                                {/* Title */}
                                <td className="px-3 py-2 min-w-[300px]">
                                    {editingCell?.taskId === task.id && editingCell.field === 'title' ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                autoFocus
                                                value={editingCell.value}
                                                onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                                onKeyDown={handleKeyDown}
                                                className="flex-1 text-sm px-2 py-0.5 rounded border border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                            <button onClick={saveEdit} className="text-green-500 hover:text-green-600"><Check size={14} /></button>
                                            <button onClick={cancelEdit} className="text-red-500 hover:text-red-600"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: getStatusInfo(task.status_id).color }}
                                            />
                                            <span
                                                onClick={() => onSelectTask(task.id)}
                                                className={`text-sm font-medium cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${task.status_id === 'status_done'
                                                    ? 'text-slate-400 dark:text-slate-500 line-through'
                                                    : 'text-slate-800 dark:text-slate-200'
                                                    }`}
                                            >
                                                {task.title}
                                            </span>
                                            <button
                                                onClick={() => startEdit(task.id, 'title', task.title)}
                                                className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all"
                                            >
                                                <Edit3 size={12} />
                                            </button>
                                        </div>
                                    )}
                                    {/* Tags */}
                                    {(task.tags || []).length > 0 && (
                                        <div className="flex gap-1 mt-0.5">
                                            {task.tags.slice(0, 3).map(tag => (
                                                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </td>

                                {/* Status */}
                                <td className="px-3 py-2 w-[140px]">
                                    {editingCell?.taskId === task.id && editingCell.field === 'status_id' ? (
                                        <select
                                            autoFocus
                                            value={editingCell.value}
                                            onChange={e => {
                                                onUpdateTask(task.id, { status_id: e.target.value });
                                                setEditingCell(null);
                                            }}
                                            onBlur={cancelEdit}
                                            className="text-xs px-2 py-1 rounded border border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
                                        >
                                            {statuses.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <button
                                            onClick={() => startEdit(task.id, 'status_id', task.status_id)}
                                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full transition-colors cursor-pointer hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-600"
                                            style={{
                                                color: getStatusInfo(task.status_id).color,
                                                backgroundColor: getStatusInfo(task.status_id).color + '18',
                                            }}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStatusInfo(task.status_id).color }} />
                                            {getStatusInfo(task.status_id).name}
                                        </button>
                                    )}
                                </td>

                                {/* Priority */}
                                <td className="px-3 py-2 w-[120px]">
                                    {editingCell?.taskId === task.id && editingCell.field === 'priority' ? (
                                        <select
                                            autoFocus
                                            value={editingCell.value}
                                            onChange={e => {
                                                onUpdateTask(task.id, { priority: e.target.value as any });
                                                setEditingCell(null);
                                            }}
                                            onBlur={cancelEdit}
                                            className="text-xs px-2 py-1 rounded border border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
                                        >
                                            {Object.entries(TASK_PRIORITY_LABELS).map(([key, val]) => (
                                                <option key={key} value={key}>{val.label}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <button
                                            onClick={() => startEdit(task.id, 'priority', task.priority)}
                                            className="text-xs font-medium px-2 py-0.5 rounded transition-colors cursor-pointer hover:ring-2 hover:ring-indigo-300 dark:hover:ring-indigo-600"
                                            style={{
                                                color: getPriorityInfo(task.priority).color,
                                                backgroundColor: getPriorityInfo(task.priority).color + '15',
                                            }}
                                        >
                                            {getPriorityInfo(task.priority).label}
                                        </button>
                                    )}
                                </td>

                                {/* Due Date */}
                                <td className="px-3 py-2 w-[130px]">
                                    {editingCell?.taskId === task.id && editingCell.field === 'due_date' ? (
                                        <input
                                            type="date"
                                            autoFocus
                                            value={editingCell.value || ''}
                                            onChange={e => {
                                                onUpdateTask(task.id, { due_date: e.target.value || undefined });
                                                setEditingCell(null);
                                            }}
                                            onBlur={cancelEdit}
                                            className="text-xs px-2 py-1 rounded border border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
                                        />
                                    ) : (
                                        <button
                                            onClick={() => startEdit(task.id, 'due_date', task.due_date)}
                                            className={`text-xs cursor-pointer hover:underline ${task.due_date && task.due_date < today && task.status_id !== 'status_done'
                                                ? 'text-red-500 dark:text-red-400 font-medium'
                                                : 'text-slate-600 dark:text-slate-400'
                                                }`}
                                        >
                                            {task.due_date
                                                ? new Date(task.due_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                : '—'
                                            }
                                        </button>
                                    )}
                                </td>

                                {/* Assignees */}
                                <td className="px-3 py-2 w-[140px]">
                                    <div className="flex -space-x-1">
                                        {(task.assignees || []).slice(0, 3).map((_, i) => (
                                            <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 dark:from-indigo-500 dark:to-purple-600 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] text-white font-bold">
                                                {i + 1}
                                            </div>
                                        ))}
                                        {(task.assignees?.length || 0) > 3 && (
                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-400">
                                                +{task.assignees!.length - 3}
                                            </div>
                                        )}
                                        {(!task.assignees || task.assignees.length === 0) && (
                                            <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                                        )}
                                    </div>
                                </td>

                                {/* Created At */}
                                <td className="px-3 py-2 w-[120px]">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {task.created_at
                                            ? new Date(task.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' })
                                            : '—'
                                        }
                                    </span>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            {/* Summary bar */}
            <div className="sticky bottom-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    {sortedTasks.length} công việc
                    {selectedRows.size > 0 && ` · ${selectedRows.size} đã chọn`}
                </span>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>{sortedTasks.filter(t => t.status_id === 'status_done').length} hoàn thành</span>
                    <span>{sortedTasks.filter(t => t.due_date && t.due_date < today && t.status_id !== 'status_done').length} quá hạn</span>
                </div>
            </div>
        </div>
    );
};

export default TaskTable;
