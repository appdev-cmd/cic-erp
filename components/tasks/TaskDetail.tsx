import React, { useState, useEffect } from 'react';
import {
    X, Edit3, Trash2, ChevronDown, ChevronRight, Plus, Send,
    Calendar, Clock, Flag, User, Tag, Paperclip, MessageSquare,
    CheckSquare, Activity, ExternalLink
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { TaskService } from '../../services';
import { Task, TaskStatus, TaskComment, Checklist, ChecklistItem, TaskActivity } from '../../types';
import { TASK_PRIORITY_LABELS } from '../../constants';
import { toast } from 'sonner';

interface Props {
    taskId: string;
    statuses: TaskStatus[];
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<Task>) => void;
    onDelete: (id: string) => void;
    onRefresh: () => void;
}

// ============================================================================
// TASK DETAIL — Slide-over panel showing full task details
// ============================================================================
const TaskDetail: React.FC<Props> = ({ taskId, statuses, onClose, onUpdate, onDelete, onRefresh }) => {
    const { user } = useAuth();

    const [task, setTask] = useState<Task | null>(null);
    const [subtasks, setSubtasks] = useState<Task[]>([]);
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [activities, setActivities] = useState<TaskActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'subtasks' | 'comments' | 'checklist' | 'activity'>('subtasks');

    // Form states
    const [newComment, setNewComment] = useState('');
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [showSubtaskInput, setShowSubtaskInput] = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');
    const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());

    // Load task data
    const loadTask = async () => {
        setLoading(true);
        try {
            const detail = await TaskService.getDetailById(taskId);
            if (detail) {
                setTask(detail);
                setSubtasks(detail.subtasks || []);
                setComments(detail.comments || []);
                setChecklists(detail.checklists || []);
                setActivities(detail.activities || []);
                setTitleDraft(detail.title);
            }
        } catch (e: any) {
            toast.error('Lỗi tải chi tiết: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadTask(); }, [taskId]);

    // Handlers
    const handleTitleSave = async () => {
        if (!titleDraft.trim() || titleDraft === task?.title) {
            setEditingTitle(false);
            return;
        }
        await onUpdate(taskId, { title: titleDraft });
        setEditingTitle(false);
        loadTask();
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        try {
            await TaskService.addComment(taskId, user?.id || '', newComment);
            setNewComment('');
            const updated = await TaskService.getComments(taskId);
            setComments(updated);
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const handleAddSubtask = async () => {
        if (!newSubtaskTitle.trim() || !task) return;
        try {
            await TaskService.create({
                list_id: task.list_id,
                parent_id: task.id,
                title: newSubtaskTitle.trim(),
                created_by: user?.id,
            });
            setNewSubtaskTitle('');
            setShowSubtaskInput(false);
            await loadTask();
            onRefresh();
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const handleSubtaskStatusToggle = async (st: Task) => {
        const newStatus = st.status_id === 'status_done' ? 'status_pending' : 'status_done';
        await onUpdate(st.id, { status_id: newStatus });
        loadTask();
    };

    const toggleExpandSubtask = async (subtaskId: string) => {
        const next = new Set(expandedSubtasks);
        if (next.has(subtaskId)) {
            next.delete(subtaskId);
        } else {
            next.add(subtaskId);
        }
        setExpandedSubtasks(next);
    };

    const handleChecklistToggle = async (checklist: Checklist, itemIdx: number) => {
        const newItems = [...checklist.items];
        newItems[itemIdx] = { ...newItems[itemIdx], checked: !newItems[itemIdx].checked };
        try {
            await TaskService.updateChecklistItems(checklist.id, newItems);
            await loadTask();
        } catch (e: any) {
            toast.error('Lỗi: ' + e.message);
        }
    };

    const getStatusInfo = (sid: string): TaskStatus => {
        const s = statuses.find(st => st.id === sid);
        return s || { id: sid, name: sid, color: '#808080', group: 'not_started' as const, order: 0 };
    };

    if (loading) {
        return (
            <div className="w-96 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!task) return null;

    const statusInfo = getStatusInfo(task.status_id);

    return (
        <div className="w-[420px] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
                    <X size={18} />
                </button>
                <div className="flex-1" />
                <button
                    onClick={() => onDelete(taskId)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                    {/* Title */}
                    {editingTitle ? (
                        <input
                            autoFocus
                            value={titleDraft}
                            onChange={e => setTitleDraft(e.target.value)}
                            onBlur={handleTitleSave}
                            onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
                            className="w-full text-lg font-bold px-2 py-1 rounded border border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
                        />
                    ) : (
                        <h2
                            onClick={() => { setEditingTitle(true); setTitleDraft(task.title); }}
                            className="text-lg font-bold text-slate-900 dark:text-slate-100 cursor-text hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 py-1 -mx-2 transition-colors"
                        >
                            {task.title}
                        </h2>
                    )}

                    {/* Status + Priority row */}
                    <div className="flex items-center gap-3">
                        <select
                            value={task.status_id}
                            onChange={e => { onUpdate(taskId, { status_id: e.target.value }); loadTask(); }}
                            className="text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer"
                            style={{
                                backgroundColor: statusInfo.color + '20',
                                color: statusInfo.color,
                            }}
                        >
                            {statuses.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>

                        <select
                            value={task.priority}
                            onChange={e => { onUpdate(taskId, { priority: e.target.value as any }); loadTask(); }}
                            className="text-xs font-medium px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                            {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Meta fields */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {/* Due date */}
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Calendar size={14} />
                            <span className="text-xs">Hạn:</span>
                            <input
                                type="date"
                                value={task.due_date || ''}
                                onChange={e => { onUpdate(taskId, { due_date: e.target.value || undefined }); loadTask(); }}
                                className="text-xs bg-transparent border-0 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none"
                            />
                        </div>

                        {/* Start date */}
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Clock size={14} />
                            <span className="text-xs">Từ:</span>
                            <input
                                type="date"
                                value={task.start_date || ''}
                                onChange={e => { onUpdate(taskId, { start_date: e.target.value || undefined }); loadTask(); }}
                                className="text-xs bg-transparent border-0 text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    {task.description && (
                        <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 whitespace-pre-wrap">
                            {task.description}
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 dark:border-slate-700 gap-1">
                        {[
                            { key: 'subtasks', label: 'Subtask', icon: <CheckSquare size={14} />, count: subtasks.length },
                            { key: 'comments', label: 'Bình luận', icon: <MessageSquare size={14} />, count: comments.length },
                            { key: 'checklist', label: 'Checklist', icon: <CheckSquare size={14} />, count: checklists.reduce((s, c) => s + c.items.length, 0) },
                            { key: 'activity', label: 'Nhật ký', icon: <Activity size={14} />, count: activities.length },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.key
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded-full">{tab.count}</span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-[200px]">
                        {/* SUBTASKS TAB */}
                        {activeTab === 'subtasks' && (
                            <div className="space-y-1">
                                {subtasks.map(st => (
                                    <SubtaskItem
                                        key={st.id}
                                        subtask={st}
                                        level={0}
                                        expanded={expandedSubtasks}
                                        onToggleExpand={toggleExpandSubtask}
                                        onStatusToggle={handleSubtaskStatusToggle}
                                        getStatusInfo={getStatusInfo}
                                    />
                                ))}

                                {showSubtaskInput ? (
                                    <div className="flex items-center gap-2 mt-2">
                                        <input
                                            autoFocus
                                            value={newSubtaskTitle}
                                            onChange={e => setNewSubtaskTitle(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                                            placeholder="Tên subtask..."
                                            className="flex-1 text-sm px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <button onClick={handleAddSubtask} className="text-indigo-500 hover:text-indigo-600"><Plus size={16} /></button>
                                        <button onClick={() => { setShowSubtaskInput(false); setNewSubtaskTitle(''); }} className="text-slate-400"><X size={16} /></button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowSubtaskInput(true)}
                                        className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 mt-2 transition-colors"
                                    >
                                        <Plus size={14} /> Thêm subtask
                                    </button>
                                )}
                            </div>
                        )}

                        {/* COMMENTS TAB */}
                        {activeTab === 'comments' && (
                            <div className="space-y-3">
                                {comments.map(c => (
                                    <div key={c.id} className="flex gap-2">
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs flex-shrink-0">
                                            <User size={12} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                                    {c.author?.fullName || 'Người dùng'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                    {c.created_at ? new Date(c.created_at).toLocaleString('vi-VN') : ''}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 whitespace-pre-wrap">
                                                {c.content}
                                            </p>
                                        </div>
                                    </div>
                                ))}

                                {comments.length === 0 && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Chưa có bình luận</p>
                                )}

                                {/* Comment input */}
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <input
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                                        placeholder="Viết bình luận..."
                                        className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <button onClick={handleAddComment} className="p-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors">
                                        <Send size={14} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* CHECKLIST TAB */}
                        {activeTab === 'checklist' && (
                            <div className="space-y-3">
                                {checklists.map(cl => (
                                    <div key={cl.id}>
                                        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{cl.title}</h4>
                                        {/* Progress */}
                                        {cl.items.length > 0 && (
                                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-2">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                                    style={{ width: `${(cl.items.filter(i => i.checked).length / cl.items.length) * 100}%` }}
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            {cl.items.map((item, idx) => (
                                                <label key={item.id} className="flex items-center gap-2 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.checked}
                                                        onChange={() => handleChecklistToggle(cl, idx)}
                                                        className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600"
                                                    />
                                                    <span className={`text-sm ${item.checked ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {item.text}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {checklists.length === 0 && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Chưa có checklist</p>
                                )}
                            </div>
                        )}

                        {/* ACTIVITY TAB */}
                        {activeTab === 'activity' && (
                            <div className="space-y-2">
                                {activities.map(a => (
                                    <div key={a.id} className="flex gap-2 text-xs">
                                        <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mt-1.5 flex-shrink-0" />
                                        <div>
                                            <span className="text-slate-600 dark:text-slate-400">
                                                {a.action === 'created' && 'Đã tạo công việc'}
                                                {a.action === 'updated' && 'Đã cập nhật'}
                                                {a.action === 'status_changed' && `Đã đổi trạng thái`}
                                                {a.action === 'assigned' && 'Đã phân công'}
                                                {a.action === 'commented' && 'Đã bình luận'}
                                                {a.action === 'deleted' && 'Đã xóa'}
                                            </span>
                                            <span className="text-slate-400 dark:text-slate-500 ml-2">
                                                {a.created_at ? new Date(a.created_at).toLocaleString('vi-VN') : ''}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {activities.length === 0 && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Chưa có hoạt động</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Recursive subtask component for multi-level display
const SubtaskItem: React.FC<{
    subtask: Task;
    level: number;
    expanded: Set<string>;
    onToggleExpand: (id: string) => void;
    onStatusToggle: (t: Task) => void;
    getStatusInfo: (sid: string) => TaskStatus;
}> = ({ subtask, level, expanded, onToggleExpand, onStatusToggle, getStatusInfo }) => {
    const [children, setChildren] = useState<Task[]>([]);
    const [loadedChildren, setLoadedChildren] = useState(false);
    const isExpanded = expanded.has(subtask.id);

    useEffect(() => {
        if (isExpanded && !loadedChildren) {
            TaskService.getSubtasks(subtask.id).then(data => {
                setChildren(data);
                setLoadedChildren(true);
            });
        }
    }, [isExpanded, loadedChildren, subtask.id]);

    const status = getStatusInfo(subtask.status_id);

    return (
        <div>
            <div
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 group transition-colors"
                style={{ paddingLeft: `${8 + level * 16}px` }}
            >
                {/* Expand/collapse for children */}
                <button
                    onClick={() => onToggleExpand(subtask.id)}
                    className="w-4 h-4 flex items-center justify-center text-slate-400 dark:text-slate-500"
                >
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>

                {/* Status toggle */}
                <button
                    onClick={() => onStatusToggle(subtask)}
                    className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors"
                    style={{
                        borderColor: status.color,
                        backgroundColor: subtask.status_id === 'status_done' ? status.color : 'transparent',
                    }}
                />

                <span className={`text-sm flex-1 truncate ${subtask.status_id === 'status_done'
                    ? 'text-slate-400 dark:text-slate-500 line-through'
                    : 'text-slate-700 dark:text-slate-300'
                    }`}>
                    {subtask.title}
                </span>

                {subtask.due_date && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(subtask.due_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </span>
                )}
            </div>

            {/* Recursive children */}
            {isExpanded && children.length > 0 && (
                <div>
                    {children.map(child => (
                        <SubtaskItem
                            key={child.id}
                            subtask={child}
                            level={level + 1}
                            expanded={expanded}
                            onToggleExpand={onToggleExpand}
                            onStatusToggle={onStatusToggle}
                            getStatusInfo={getStatusInfo}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default TaskDetail;
