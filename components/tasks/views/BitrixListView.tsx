import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CheckSquare, ChevronRight, Play, CheckCircle2, Pin, 
  AlertTriangle, Calendar, Plus, MessageSquare, ArrowUpDown, ChevronUp, ChevronDown
} from 'lucide-react';
import { Task, TaskStatus } from '../../../types/taskTypes';
import { DiscussionService } from '../../../services/discussionService';
import { formatDateTime } from '../../../utils/formatters';
import {
  PRIORITY_CONFIG,
  COLUMN_KEYS,
  ColumnKey,
  COL_LABELS,
  COL_RESPONSIVE,
  loadColWidths,
  saveColWidths,
  ResizeHandle,
  QuickTaskInput,
  StatusDropdown,
  DeadlineInput,
  PersonAvatar,
  InlineCommentInput
} from '../TasksPageSubComponents';
import PeoplePickerPopover from '../PeoplePickerPopover';


// ═══════════════════════════════════════
// LIST VIEW (Bitrix24-style table)
// ═══════════════════════════════════════
export const BitrixListView: React.FC<{
  tasks: Task[];
  statuses: TaskStatus[];
  employees: Record<string, { name: string; avatar?: string }>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onSelect: (id: string, initialTab?: 'detail' | 'comments' | 'history' | 'links' | 'time') => void;
  onToggleComplete: (task: Task) => void;
  onTogglePin: (taskId: string) => void;
  onStartTask: (task: Task) => void;
  onQuickCreate: (title: string, tags: string[]) => Promise<void>;
  onTagClick: (tag: string) => void;
  onUpdateStatus: (taskId: string, statusId: string) => void;
  onUpdateDeadline: (taskId: string, deadline: string | null) => void;
  onUpdateAssignee: (taskId: string, assigneeIds: string[]) => void;
  onUpdateProject: (taskId: string, projectId: string | null) => void;
  onQuickComment: (taskId: string, content: string) => Promise<void>;
  projects: { id: string; name: string }[];
}> = ({ tasks, statuses, employees, selectedIds, onToggleSelect, onSelectAll, onSelect, onToggleComplete, onTogglePin, onStartTask, onQuickCreate, onTagClick, onUpdateStatus, onUpdateDeadline, onUpdateAssignee, onUpdateProject, onQuickComment, projects }) => {
  const [colWidths, setColWidths] = useState<Record<ColumnKey, number>>(loadColWidths);
  // Inline edit state: which cell is being edited
  const [editingCell, setEditingCell] = useState<{ taskId: string; col: 'status' | 'deadline' | 'assignee' | 'comment' } | null>(null);
  // Comment counts loaded via batch
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  // Expand/collapse state for tree view
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const taskIds = tasks.map(t => t.id);
    if (taskIds.length === 0) return;
    DiscussionService.getCountsBatch('task', taskIds)
      .then(counts => setCommentCounts(counts))
      .catch((err) => { console.error(err); });
  }, [tasks]);

  const toggleExpand = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // ─── Sort state ─── (phải declare trước useMemo)
  const [sortBy, setSortBy] = useState<'title' | 'priority' | 'due_date' | 'created_at' | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortAsc(prev => !prev);
    else { setSortBy(col); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <ArrowUpDown size={11} className="opacity-40" />;
    return sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
  };

  // Sort source tasks before building tree
  const sortedSourceTasks = useMemo(() => {
    if (!sortBy) return tasks;
    return [...tasks].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'title') cmp = a.title.localeCompare(b.title, 'vi');
      else if (sortBy === 'priority') {
        const order = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
        cmp = (order[a.priority] ?? 5) - (order[b.priority] ?? 5);
      }
      else if (sortBy === 'due_date') {
        const da = a.due_date || '9999';
        const db = b.due_date || '9999';
        cmp = da < db ? -1 : da > db ? 1 : 0;
      }
      else if (sortBy === 'created_at') {
        cmp = (a.created_at || '') < (b.created_at || '') ? -1 : 1;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [tasks, sortBy, sortAsc]);

  const flattenedTasks = useMemo(() => {
    const childrenMap = new Map<string, Task[]>();
    const roots: Task[] = [];
    
    // Group by parent_id
    sortedSourceTasks.forEach(t => {
      if (t.parent_id && sortedSourceTasks.some(x => x.id === t.parent_id)) {
        if (!childrenMap.has(t.parent_id)) childrenMap.set(t.parent_id, []);
        childrenMap.get(t.parent_id)!.push(t);
      } else {
        roots.push(t);
      }
    });

    const result: (Task & { _level: number; _hasChildren: boolean })[] = [];
    
    const traverse = (t: Task, level: number) => {
      const children = childrenMap.get(t.id) || [];
      result.push({ ...t, _level: level, _hasChildren: children.length > 0 });
      if (expandedIds.has(t.id)) {
        // Có thể sort children theo sort_order nếu muốn
        children.sort((a, b) => a.sort_order - b.sort_order).forEach(c => traverse(c, level + 1));
      }
    };

    roots.forEach(r => traverse(r, 0));
    return result;
  }, [sortedSourceTasks, expandedIds]);


  const handleWidthChange = useCallback((col: ColumnKey, width: number) => {
    setColWidths(prev => ({ ...prev, [col]: width }));
  }, []);

  // Save to localStorage on width change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => saveColWidths(colWidths), 300);
    return () => clearTimeout(timer);
  }, [colWidths]);

  const thClass = "text-left px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative select-none";
  
  return (
    <div className="overflow-x-auto" style={{ overflow: 'visible' }}>
      <table className="w-full text-sm table-fixed">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            {/* Checkbox col */}
            <th className="w-10 px-2 py-3" style={{ width: 40 }}>
              <button
                onClick={onSelectAll}
                className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all cursor-pointer
                  ${selectedIds.size > 0 && selectedIds.size === tasks.length
                    ? 'bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500'
                    : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                  }`}
                style={{ width: 18, height: 18 }}
              >
                {selectedIds.size > 0 && selectedIds.size === tasks.length && <CheckSquare size={11} className="text-white" />}
              </button>
            </th>
            {/* Name col — sortable */}
            <th className={thClass} onClick={() => handleSort('title')}>
              <span className="flex items-center gap-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Tên <SortIcon col="title" />
              </span>
            </th>
            {/* Data columns — resizable */}
            {COLUMN_KEYS.map(col => (
              <th
                key={col}
                className={`${thClass} ${COL_RESPONSIVE[col] || ''}`}
                style={{ width: colWidths[col] }}
              >
                {COL_LABELS[col]}
                <ResizeHandle columnKey={col} getWidth={() => colWidths[col]} onWidthChange={handleWidthChange} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Quick add row */}
          <tr className="border-b border-slate-100 dark:border-slate-800">
            <td colSpan={2 + COLUMN_KEYS.length} className="px-3 py-1">
              <QuickTaskInput onCreateTask={onQuickCreate} />
            </td>
          </tr>
          
          {flattenedTasks.map((task) => {
            const priorityConf = PRIORITY_CONFIG[task.priority];
            const status = statuses.find(s => s.id === task.status_id);
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed_at;
            const isDone = task.status?.is_done || status?.is_done;
            const isInProgress = status?.name === 'Đang tiến hành' || status?.name === 'Đang thực hiện';
            const hasPastStartDate = !!(task.start_date && task.start_date <= new Date().toISOString().split('T')[0]);
            const isPendingApproval = task.approval_status === 'pending';
            const showStartButton = !isDone && !isInProgress && !hasPastStartDate && !isPendingApproval;
            const creator = task.created_by ? employees[task.created_by] : null;
            const assignee = task.assignees?.[0] ? employees[task.assignees[0]] : null;

            return (
              <tr
                key={task.id}
                className={`group border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-colors
                  ${selectedIds.has(task.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
                  ${isDone ? 'opacity-60' : ''}`}
              >
                {/* Checkbox */}
                <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onToggleSelect(task.id)}
                    className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all cursor-pointer
                      ${selectedIds.has(task.id)
                        ? 'bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500'
                        : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                      }`}
                    style={{ width: 18, height: 18 }}
                  >
                    {selectedIds.has(task.id) && <CheckSquare size={11} className="text-white" />}
                  </button>
                </td>

                {/* Name + priority on second line */}
                <td className="px-3 py-2" onClick={() => onSelect(task.id)}>
                  <div className="flex items-start gap-2" style={{ paddingLeft: `${Math.min(task._level, 5) * 20}px` }}>
                    {/* Expand/Collapse Toggle or Indent Line */}
                    {task._hasChildren ? (
                      <button 
                        onClick={(e) => toggleExpand(e, task.id)}
                        className="mt-0.5 w-4 h-4 flex-shrink-0 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      >
                        <ChevronRight size={14} className={`transform transition-transform ${expandedIds.has(task.id) ? 'rotate-90' : ''}`} />
                      </button>
                    ) : task._level > 0 ? (
                      <div className="w-4 h-4 flex-shrink-0 relative mt-0.5">
                         <div className="absolute top-0 left-1.5 w-2 h-2.5 border-l-2 border-b-2 border-slate-300 dark:border-slate-600 rounded-bl" />
                      </div>
                    ) : null}

                    <div className="min-w-0 flex-1">
                      <span className={`font-semibold text-sm leading-tight ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                        {task.title}
                      </span>
                      {/* Priority badge on second line */}
                      {task.priority !== 'none' && (
                        <div className="mt-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${priorityConf.bg} ${priorityConf.darkBg} ${priorityConf.color} ${priorityConf.darkColor}`}>
                            {priorityConf.label}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Hover quick actions: Start + Complete + Pin (pin last) */}
                    <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
                      {showStartButton && (
                        <button
                          onClick={() => onStartTask(task)}
                          className="p-1 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded cursor-pointer transition-colors"
                          title="Bắt đầu"
                        >
                          <Play size={13} />
                        </button>
                      )}
                      {!isDone && (
                        <button
                          onClick={() => onToggleComplete(task)}
                          className="p-1 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded cursor-pointer transition-colors"
                          title="Hoàn thành"
                        >
                          <CheckCircle2 size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => onTogglePin(task.id)}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          task.is_pinned
                            ? 'text-amber-500 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            : 'text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                        }`}
                        title={task.is_pinned ? 'Bỏ ghim' : 'Ghim'}
                      >
                        <Pin size={13} />
                      </button>
                    </div>
                    {/* Show pin icon when pinned (non-hover) */}
                    {task.is_pinned && (
                      <span className="flex-shrink-0 text-amber-500 dark:text-amber-400 group-hover:hidden mt-0.5">
                        <Pin size={13} />
                      </span>
                    )}
                  </div>
                </td>

                {/* Status — inline dropdown */}
                <td className="px-3 py-2.5 relative" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setEditingCell(editingCell?.taskId === task.id && editingCell?.col === 'status' ? null : { taskId: task.id, col: 'status' })}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                    title="Bấm để thay đổi trạng thái"
                  >
                    {status && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />}
                    <span className="text-slate-600 dark:text-slate-400 truncate">{status?.name || '—'}</span>
                  </button>
                  {/* Status dropdown popover */}
                  {editingCell?.taskId === task.id && editingCell?.col === 'status' && (
                    <StatusDropdown
                      statuses={statuses}
                      currentStatusId={task.status_id || ''}
                      onSelect={(statusId) => { onUpdateStatus(task.id, statusId); setEditingCell(null); }}
                      onClose={() => setEditingCell(null)}
                    />
                  )}
                </td>

                {/* Deadline — inline date picker */}
                <td className="px-3 py-2.5 relative" onClick={e => e.stopPropagation()}>
                  {editingCell?.taskId === task.id && editingCell?.col === 'deadline' ? (
                    <DeadlineInput
                      currentValue={task.due_date || ''}
                      onSave={(val) => { onUpdateDeadline(task.id, val || null); setEditingCell(null); }}
                      onClose={() => setEditingCell(null)}
                    />
                  ) : task.due_date ? (
                    <button
                      onClick={() => setEditingCell({ taskId: task.id, col: 'deadline' })}
                      className={`text-xs font-medium px-2 py-1 rounded-lg inline-block cursor-pointer hover:opacity-80 transition-opacity ${
                        isOverdue
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                      title="Bấm để thay đổi deadline"
                    >
                      {isOverdue && <AlertTriangle size={11} className="inline mr-1" />}
                      {formatDateTime(task.due_date)}
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingCell({ taskId: task.id, col: 'deadline' })}
                      className="text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                      title="Bấm để đặt deadline"
                    >
                      <Calendar size={14} />
                    </button>
                  )}
                </td>

                {/* Ngày tạo (Created at) — date + time */}
                <td className="px-3 py-2.5 hidden xl:table-cell" onClick={() => onSelect(task.id)}>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDateTime(task.created_at)}
                  </span>
                </td>

                {/* Người giao (Assigner / Created by) */}
                <td className="px-3 py-2.5" onClick={() => onSelect(task.id)}>
                  {creator ? (
                    <div className="flex items-center gap-2">
                      <PersonAvatar name={creator.name} avatar={creator.avatar} size={24} />
                      <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{creator.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                  )}
                </td>

                {/* Người thực hiện — inline people picker */}
                <td className="px-3 py-2.5 relative" onClick={e => e.stopPropagation()}>
                  {assignee ? (
                    <button
                      onClick={() => setEditingCell(editingCell?.taskId === task.id && editingCell?.col === 'assignee' ? null : { taskId: task.id, col: 'assignee' })}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      title="Bấm để thay đổi"
                    >
                      <PersonAvatar name={assignee.name} avatar={assignee.avatar} size={24} />
                      <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{assignee.name}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingCell({ taskId: task.id, col: 'assignee' })}
                      className="text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                      title="Chọn người thực hiện"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                  {/* People picker popover — opens upward, wider */}
                  {editingCell?.taskId === task.id && editingCell?.col === 'assignee' && (
                    <PeoplePickerPopover
                      currentIds={task.assignees || []}
                      onChange={(newIds) => { onUpdateAssignee(task.id, newIds); setEditingCell(null); }}
                      onClose={() => setEditingCell(null)}
                      align="left"
                      minSelections={0}
                      singleSelect
                    />
                  )}
                </td>



                {/* Bình luận — comment count badge and optional simple comment icon */}
                <td className="px-3 py-2.5 hidden lg:table-cell relative" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-center">
                    {(commentCounts[task.id] || 0) > 0 ? (
                      <div className="flex items-center gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                        <button
                          onClick={() => setEditingCell(editingCell?.taskId === task.id && editingCell?.col === 'comment' ? null : { taskId: task.id, col: 'comment' })}
                          className="flex items-center text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors p-0.5 rounded-sm"
                          title="Nhắn tin nhanh"
                        >
                          <MessageSquare size={13} />
                        </button>
                        <button
                          onClick={() => onSelect(task.id, 'comments')}
                          className="flex items-center font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 cursor-pointer transition-colors p-0.5 rounded-sm"
                          title="Xem bình luận"
                        >
                          {commentCounts[task.id]}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingCell(editingCell?.taskId === task.id && editingCell?.col === 'comment' ? null : { taskId: task.id, col: 'comment' })}
                        className="flex items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer transition-colors opacity-0 group-hover:opacity-100 p-0.5 rounded"
                        title="Để lại bình luận"
                      >
                        <MessageSquare size={14} />
                      </button>
                    )}
                  </div>
                  {editingCell?.taskId === task.id && editingCell?.col === 'comment' && (
                    <InlineCommentInput
                      onSave={async (content) => { 
                        await onQuickComment(task.id, content); 
                        setEditingCell(null);
                        setCommentCounts(prev => ({ ...prev, [task.id]: (prev[task.id] || 0) + 1 }));
                      }}
                      onClose={() => setEditingCell(null)}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {tasks.length === 0 && (
        <div className="text-center py-16">
          <CheckSquare size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400">Chưa có công việc nào</h3>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Tạo công việc mới hoặc chờ được giao từ hệ thống</p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════