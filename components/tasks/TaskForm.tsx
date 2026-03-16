import React, { useState } from 'react';
import { X, Plus, Trash2, Calendar, Flag, User, Tag } from 'lucide-react';
import { Task, TaskStatus } from '../../types';
import { TASK_PRIORITY_LABELS } from '../../constants';

interface Props {
    task?: Partial<Task>;
    listId: string;
    statuses: TaskStatus[];
    onSave: (data: Partial<Task>) => void;
    onCancel: () => void;
}

// ============================================================================
// TASK FORM — Modal form for creating/editing tasks
// ============================================================================
const TaskForm: React.FC<Props> = ({ task, listId, statuses, onSave, onCancel }) => {
    const isEdit = !!task?.id;

    const [title, setTitle] = useState(task?.title || '');
    const [description, setDescription] = useState(task?.description || '');
    const [statusId, setStatusId] = useState(task?.status_id || 'status_pending');
    const [priority, setPriority] = useState(task?.priority || 'none');
    const [dueDate, setDueDate] = useState(task?.due_date || '');
    const [startDate, setStartDate] = useState(task?.start_date || '');
    const [tags, setTags] = useState<string[]>(task?.tags || []);
    const [tagInput, setTagInput] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        setSaving(true);
        try {
            await onSave({
                ...(task?.id && { id: task.id }),
                list_id: listId,
                title: title.trim(),
                description: description.trim() || undefined,
                status_id: statusId,
                priority: priority as any,
                due_date: dueDate || undefined,
                start_date: startDate || undefined,
                tags,
            });
        } finally {
            setSaving(false);
        }
    };

    const addTag = () => {
        const t = tagInput.trim();
        if (t && !tags.includes(t)) {
            setTags([...tags, t]);
            setTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        setTags(tags.filter(t => t !== tag));
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div
                className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {isEdit ? 'Sửa công việc' : 'Tạo công việc mới'}
                    </h3>
                    <button onClick={onCancel} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Tiêu đề <span className="text-red-500">*</span>
                        </label>
                        <input
                            autoFocus
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Nhập tên công việc..."
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mô tả</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Mô tả chi tiết công việc..."
                            rows={3}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 resize-none"
                        />
                    </div>

                    {/* Status + Priority */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Trạng thái</label>
                            <select
                                value={statusId}
                                onChange={e => setStatusId(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {statuses.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ưu tiên</label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value as Task['priority'])}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ngày bắt đầu</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hạn hoàn thành</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nhãn</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {tags.map(tag => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                                >
                                    {tag}
                                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500"><X size={10} /></button>
                                </span>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                                placeholder="Thêm nhãn..."
                                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button type="button" onClick={addTag} className="text-indigo-500 hover:text-indigo-600">
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={!title.trim() || saving}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
                        >
                            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                            {isEdit ? 'Cập nhật' : 'Tạo công việc'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TaskForm;
