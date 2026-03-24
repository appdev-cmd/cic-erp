import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, LayoutGrid, List, CheckSquare, Filter, Search,
  Clock, AlertTriangle, Calendar, ChevronDown, X,
  MessageSquare, Link2, MoreHorizontal, Tag, Copy, FolderKanban,
  Pin, Play, CheckCircle2, Users, Eye, UserCheck, Briefcase,
  ArrowUpDown, ChevronRight, BarChart3, GanttChartSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import { useLayoutContext } from '../layout/MainLayout';
import { TaskService } from '../../services/taskService';
import { dataClient } from '../../lib/dataClient';
import TaskDetailPanel from './TaskDetailPanel';
import CreateTaskPanel from './CreateTaskPanel';
import CalendarView from './CalendarView';
import { GanttView } from './GanttView';
import TaskTemplateManagerPanel from './TaskTemplateManagerPanel';
import { useTaskVisibility } from '../../hooks/useTaskVisibility';
import { formatDate, formatDateShort, formatDateTime } from '../../utils/formatters';
import type {
  Task, TaskStatus, TaskPriority, TaskFilterOptions, CreateTaskInput, TaskRoleFilter
} from '../../types/taskTypes';

// ═══════════════════════════════════════
// PRIORITY CONFIG
// ═══════════════════════════════════════
const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; darkColor: string; bg: string; darkBg: string }> = {
  urgent: { label: 'Khẩn cấp', color: 'text-red-600', darkColor: 'dark:text-red-400', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/20' },
  high: { label: 'Cao', color: 'text-orange-600', darkColor: 'dark:text-orange-400', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-900/20' },
  medium: { label: 'Trung bình', color: 'text-blue-600', darkColor: 'dark:text-blue-400', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20' },
  low: { label: 'Thấp', color: 'text-slate-500', darkColor: 'dark:text-slate-400', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-800' },
  none: { label: 'Không', color: 'text-slate-400', darkColor: 'dark:text-slate-500', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-800' },
};

// ═══════════════════════════════════════
// TOP ROLE TABS CONFIG (Bitrix24-style)
// ═══════════════════════════════════════
const ROLE_TABS: { key: TaskRoleFilter; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'Công việc', icon: <CheckSquare size={15} /> },
  { key: 'ongoing', label: 'Đang làm', icon: <Play size={15} /> },
  { key: 'assisting', label: 'Phối hợp', icon: <Users size={15} /> },
  { key: 'set_by_me', label: 'Tôi giao', icon: <UserCheck size={15} /> },
  { key: 'following', label: 'Theo dõi', icon: <Eye size={15} /> },
];

// ═══════════════════════════════════════
// VIEW MODE TABS
// ═══════════════════════════════════════
type ViewMode = 'list' | 'deadline' | 'planner' | 'calendar' | 'gantt';

const VIEW_TABS: { mode: ViewMode; label: string }[] = [
  { mode: 'list', label: 'Danh sách' },
  { mode: 'deadline', label: 'Deadline' },
  { mode: 'planner', label: 'Planner' },
  { mode: 'calendar', label: 'Lịch' },
  { mode: 'gantt', label: 'Gantt' },
];

// ═══════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════
const PersonAvatar: React.FC<{ name: string; avatar?: string; size?: number }> = ({ name, avatar, size = 28 }) => (
  <div
    className="rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0 border-2 border-white dark:border-slate-900 overflow-hidden"
    style={{ width: size, height: size, fontSize: size * 0.38 }}
    title={name}
  >
    {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
  </div>
);

// ═══════════════════════════════════════
// INLINE QUICK TASK (Bitrix24 quick-add)
// ═══════════════════════════════════════
const QuickTaskInput: React.FC<{
  onCreateTask: (title: string, tags: string[]) => Promise<void>;
  placeholder?: string;
}> = ({ onCreateTask, placeholder = '+ Thêm nhanh công việc...' }) => {
  const [value, setValue] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async () => {
    if (!value.trim() || creating) return;
    setCreating(true);
    try {
      // Parse #tags from title
      const tags = (value.match(/#(\S+)/g) || []).map(t => t.slice(1));
      const title = value.replace(/#\S+/g, '').trim();
      if (!title) { toast.error('Nhập tên công việc'); setCreating(false); return; }
      await onCreateTask(title, tags);
      setValue('');
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder={placeholder}
        disabled={creating}
        className="flex-1 text-sm bg-transparent border-none outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 px-1 py-1.5"
      />
      {value.trim() && (
        <button
          onClick={handleSubmit}
          disabled={creating}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold cursor-pointer whitespace-nowrap"
        >
          {creating ? '...' : 'Enter ↵'}
        </button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// COLUMN CONFIG & RESIZABLE COLUMNS
// ═══════════════════════════════════════
const COLUMN_KEYS = ['status', 'deadline', 'created_at', 'assigner', 'assignee', 'project', 'tags'] as const;
type ColumnKey = typeof COLUMN_KEYS[number];

const DEFAULT_COL_WIDTHS: Record<ColumnKey, number> = {
  status: 110,
  deadline: 150,
  created_at: 150,
  assigner: 140,
  assignee: 140,
  project: 120,
  tags: 80,
};

const COL_LABELS: Record<ColumnKey, string> = {
  status: 'Trạng thái',
  deadline: 'Deadline',
  created_at: 'Ngày tạo',
  assigner: 'Người giao',
  assignee: 'Người thực hiện',
  project: 'Liên kết',
  tags: 'Tags',
};

const COL_RESPONSIVE: Partial<Record<ColumnKey, string>> = {
  created_at: 'hidden xl:table-cell',
  project: 'hidden lg:table-cell',
  tags: 'hidden lg:table-cell',
};

const STORAGE_KEY_COL_WIDTHS = 'cic_task_col_widths';

function loadColWidths(): Record<ColumnKey, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COL_WIDTHS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_COL_WIDTHS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_COL_WIDTHS };
}

function saveColWidths(widths: Record<ColumnKey, number>) {
  try { localStorage.setItem(STORAGE_KEY_COL_WIDTHS, JSON.stringify(widths)); } catch { /* ignore */ }
}

// Drag handle component for column resizing
const ResizeHandle: React.FC<{ columnKey: ColumnKey; getWidth: () => number; onWidthChange: (col: ColumnKey, width: number) => void }> = ({ columnKey, getWidth, onWidthChange }) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = getWidth();
    
    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + (ev.clientX - startX));
      onWidthChange(columnKey, newWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize group/handle z-10 hover:bg-indigo-400/40 transition-colors"
      title="Kéo để thay đổi độ rộng"
    >
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-300 dark:bg-slate-600 group-hover/handle:bg-indigo-500 dark:group-hover/handle:bg-indigo-400 rounded-full transition-colors" />
    </div>
  );
};

// ═══════════════════════════════════════
// LIST VIEW (Bitrix24-style table)
// ═══════════════════════════════════════
const BitrixListView: React.FC<{
  tasks: Task[];
  statuses: TaskStatus[];
  employees: Record<string, { name: string; avatar?: string }>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onSelect: (id: string) => void;
  onToggleComplete: (task: Task) => void;
  onTogglePin: (taskId: string) => void;
  onStartTask: (task: Task) => void;
  onQuickCreate: (title: string, tags: string[]) => Promise<void>;
  onTagClick: (tag: string) => void;
}> = ({ tasks, statuses, employees, selectedIds, onToggleSelect, onSelectAll, onSelect, onToggleComplete, onTogglePin, onStartTask, onQuickCreate, onTagClick }) => {
  const [colWidths, setColWidths] = useState<Record<ColumnKey, number>>(loadColWidths);

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
    <div className="overflow-x-auto">
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
            {/* Name col — auto to take remaining space */}
            <th className={thClass}>
              <span className="flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
                Tên <ArrowUpDown size={12} />
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
          
          {tasks.map((task) => {
            const priorityConf = PRIORITY_CONFIG[task.priority];
            const status = statuses.find(s => s.id === task.status_id);
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed_at;
            const isDone = task.status?.is_done || status?.is_done;
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
                  <div className="flex items-start gap-2">
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
                      {!isDone && (
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

                {/* Status — clickable to quick change */}
                <td className="px-3 py-2.5" onClick={() => onSelect(task.id)}>
                  {status ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(task.id); }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                      title="Bấm để thay đổi trạng thái"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
                      <span className="text-slate-600 dark:text-slate-400 truncate">{status.name}</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                  )}
                </td>

                {/* Deadline — clickable to set/change */}
                <td className="px-3 py-2.5" onClick={() => onSelect(task.id)}>
                  {task.due_date ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(task.id); }}
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
                      onClick={(e) => { e.stopPropagation(); onSelect(task.id); }}
                      className="text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                      title="Bấm để đặt deadline"
                    >
                      <Plus size={12} className="inline" /> Chọn
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

                {/* Người thực hiện — hover shows + */}
                <td className="px-3 py-2.5" onClick={() => onSelect(task.id)}>
                  {assignee ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(task.id); }}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      title="Bấm để thay đổi"
                    >
                      <PersonAvatar name={assignee.name} avatar={assignee.avatar} size={24} />
                      <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{assignee.name}</span>
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(task.id); }}
                      className="text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                      title="Chọn người thực hiện"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </td>

                {/* Liên kết — hover shows + */}
                <td className="px-3 py-2.5 hidden lg:table-cell" onClick={() => onSelect(task.id)}>
                  {(task as any)._projectName ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(task.id); }}
                      className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full truncate inline-block max-w-[120px] cursor-pointer hover:opacity-80 transition-opacity"
                      title="Bấm để thay đổi liên kết"
                    >
                      {(task as any)._projectName}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(task.id); }}
                      className="text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                      title="Gắn vào Dự án/Hợp đồng/Gói thầu"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </td>

                {/* Tags — clickable to search + hover shows add */}
                <td className="px-3 py-2.5 hidden lg:table-cell" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1 flex-wrap">
                    {task.tags.slice(0, 2).map(tag => (
                      <button
                        key={tag}
                        onClick={() => onTagClick(tag)}
                        className="text-[10px] text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                        title={`Tìm theo #${tag}`}
                      >
                        #{tag}
                      </button>
                    ))}
                    {task.tags.length > 2 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">+{task.tags.length - 2}</span>
                    )}
                    {/* + button to add tag (hover only) */}
                    <button
                      onClick={() => onSelect(task.id)}
                      className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer transition-all opacity-0 group-hover:opacity-100 flex items-center"
                      title="Thêm tag"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
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
// DEADLINE VIEW (Kanban by deadline)
// ═══════════════════════════════════════
const DeadlineView: React.FC<{
  tasks: Task[];
  statuses: TaskStatus[];
  employees: Record<string, { name: string; avatar?: string }>;
  onSelect: (id: string) => void;
  onToggleComplete: (task: Task) => void;
  onQuickCreate: (title: string, tags: string[], dueDate?: string) => Promise<void>;
}> = ({ tasks, statuses, employees, onSelect, onToggleComplete, onQuickCreate }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  const endOfWeekStr = endOfWeek.toISOString().split('T')[0];
  
  const endOfNextWeek = new Date(endOfWeek);
  endOfNextWeek.setDate(endOfWeek.getDate() + 7);
  const endOfNextWeekStr = endOfNextWeek.toISOString().split('T')[0];

  const doneStatusIds = new Set(statuses.filter(s => s.is_done).map(s => s.id));
  const activeTasks = tasks.filter(t => !doneStatusIds.has(t.status_id || ''));

  const columns = [
    {
      title: 'Quá hạn',
      color: 'bg-red-500',
      headerBg: 'bg-red-500',
      tasks: activeTasks.filter(t => t.due_date && t.due_date < todayStr),
    },
    {
      title: 'Hôm nay',
      color: 'bg-amber-500',
      headerBg: 'bg-amber-500',
      tasks: activeTasks.filter(t => t.due_date === todayStr),
    },
    {
      title: 'Tuần này',
      color: 'bg-emerald-500',
      headerBg: 'bg-emerald-500',
      tasks: activeTasks.filter(t => t.due_date && t.due_date > todayStr && t.due_date <= endOfWeekStr),
    },
    {
      title: 'Tuần sau',
      color: 'bg-blue-500',
      headerBg: 'bg-blue-500',
      tasks: activeTasks.filter(t => t.due_date && t.due_date > endOfWeekStr && t.due_date <= endOfNextWeekStr),
    },
    {
      title: 'Không có deadline',
      color: 'bg-slate-400',
      headerBg: 'bg-slate-400',
      tasks: activeTasks.filter(t => !t.due_date),
    },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
      {columns.map(col => (
        <div key={col.title} className="flex-1 min-w-[240px] sm:min-w-[260px] max-w-[340px]">
          {/* Column header */}
          <div className={`${col.headerBg} text-white text-sm font-bold px-3 py-2 rounded-t-xl flex items-center justify-between`}>
            <span>{col.title}</span>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{col.tasks.length}</span>
          </div>

          {/* Cards */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-b-xl p-2 space-y-2 min-h-[200px]">
            {/* Quick add */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-1.5">
              <QuickTaskInput
                onCreateTask={(title, tags) => onQuickCreate(title, tags, col.title === 'Hôm nay' ? todayStr : undefined)}
                placeholder="+ Thêm nhanh"
              />
            </div>

            {col.tasks.map(task => {
              const assignee = task.assignees?.[0] ? employees[task.assignees[0]] : null;
              const isOverdue = task.due_date && task.due_date < todayStr;

              return (
                <div
                  key={task.id}
                  onClick={() => onSelect(task.id)}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }}
                      className="w-4 h-4 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer border-slate-300 dark:border-slate-600 hover:border-indigo-400"
                    >
                      {task.status?.is_done && <CheckSquare size={10} className="text-emerald-500" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">{task.title}</h4>
                      {/* Tags */}
                      {task.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {task.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] text-indigo-500 dark:text-indigo-400">#{tag}</span>
                          ))}
                        </div>
                      )}
                      {/* Deadline badge */}
                      {task.due_date && (
                        <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isOverdue
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {formatDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Footer: assignees */}
                  {task.assignees.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 -ml-1">
                      {task.assignees.slice(0, 3).map(id => {
                        const emp = employees[id];
                        return emp ? (
                          <PersonAvatar key={id} name={emp.name} avatar={emp.avatar} size={22} />
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════
// PLANNER VIEW (Bitrix24 Planner)
// ═══════════════════════════════════════
const PlannerView: React.FC<{
  tasks: Task[];
  statuses: TaskStatus[];
  employees: Record<string, { name: string; avatar?: string }>;
  onSelect: (id: string) => void;
  onToggleComplete: (task: Task) => void;
  onQuickCreate: (title: string, tags: string[]) => Promise<void>;
}> = ({ tasks, statuses, employees, onSelect, onToggleComplete, onQuickCreate }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  const endOfWeekStr = endOfWeek.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const doneStatusIds = new Set(statuses.filter(s => s.is_done).map(s => s.id));
  const activeTasks = tasks.filter(t => !doneStatusIds.has(t.status_id || ''));

  const thisWeekTasks = activeTasks.filter(t => t.due_date && t.due_date >= todayStr && t.due_date <= endOfWeekStr);
  const notPlannedTasks = activeTasks.filter(t => !t.due_date || t.due_date > endOfWeekStr || t.due_date < todayStr);

  const plannerColumns = [
    { title: 'Chưa lên kế hoạch', icon: <Clock size={15} />, headerClass: 'bg-slate-500', tasks: notPlannedTasks },
    { title: 'Làm tuần này', icon: <Calendar size={15} />, headerClass: 'bg-indigo-500', tasks: thisWeekTasks },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: '60vh' }}>
      {plannerColumns.map(col => (
        <div key={col.title} className="flex flex-col">
          <div className={`${col.headerClass} text-white text-sm font-bold px-4 py-2.5 rounded-t-xl flex items-center justify-between`}>
            <span className="flex items-center gap-2">{col.icon} {col.title}</span>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{col.tasks.length}</span>
          </div>
          <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-b-xl p-3 space-y-2 min-h-[200px]">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-1.5">
              <QuickTaskInput onCreateTask={(title, tags) => onQuickCreate(title, tags)} placeholder="+ Thêm nhanh" />
            </div>
            {col.tasks.map(task => {
              const assignee = task.assignees?.[0] ? employees[task.assignees[0]] : null;
              const priorityConf = PRIORITY_CONFIG[task.priority];
              return (
                <div key={task.id} onClick={() => onSelect(task.id)} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }} className="w-4 h-4 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer border-slate-300 dark:border-slate-600 hover:border-indigo-400">
                      {task.status?.is_done && <CheckSquare size={10} className="text-emerald-500" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">{task.title}</h4>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${priorityConf.bg} ${priorityConf.darkBg} ${priorityConf.color} ${priorityConf.darkColor}`}>
                          {priorityConf.label}
                        </span>
                        {task.due_date && <span className="text-[10px] text-slate-500 dark:text-slate-400">{formatDate(task.due_date)}</span>}
                      </div>
                      {task.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {task.tags.slice(0, 3).map(tag => (<span key={tag} className="text-[10px] text-indigo-500 dark:text-indigo-400">#{tag}</span>))}
                        </div>
                      )}
                    </div>
                    {assignee && <PersonAvatar name={assignee.name} avatar={assignee.avatar} size={24} />}
                  </div>
                </div>
              );
            })}
            {col.tasks.length === 0 && (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <Clock size={28} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">Chưa có công việc</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════
// BULK ACTIONS BAR
// ═══════════════════════════════════════
const BulkActionsBar: React.FC<{
  selectedCount: number;
  totalCount: number;
  onComplete: () => void;
  onSetDeadline: () => void;
  onClearSelection: () => void;
}> = ({ selectedCount, totalCount, onComplete, onSetDeadline, onClearSelection }) => {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-lg px-6 py-3 flex items-center justify-between -mx-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onComplete}
            className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 size={14} /> Hoàn thành
          </button>
          <button
            onClick={onSetDeadline}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Calendar size={14} /> Đặt deadline
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Đã chọn: <strong className="text-slate-900 dark:text-slate-100">{selectedCount} / {totalCount}</strong>
        </span>
        <button
          onClick={onClearSelection}
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer underline"
        >
          Bỏ chọn
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// MAIN TASKS PAGE (Bitrix24-style)
// ═══════════════════════════════════════
interface TasksPageProps {
  onSelectTask?: (taskId: string) => void;
}

const TasksPage: React.FC<TasksPageProps> = ({ onSelectTask }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<TaskRoleFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [projects, setProjects] = useState<{id: string; name: string}[]>([]);
  const [employees, setEmployees] = useState<Record<string, { name: string; avatar?: string }>>({});
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);

  const { getVisibleTasks, getMyTasks, isAdmin, visibilityContext } = useTaskVisibility();
  const { openPanel, closePanel } = useSlidePanel();
  const { selectedUnit } = useLayoutContext();

  // Load projects
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await dataClient.from('projects').select('id, name').order('name');
        if (data) setProjects(data.map((p: any) => ({ id: p.id, name: p.name })));
      } catch { /* ignore */ }
    };
    load();
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Parse #tags from search query
      const tagMatches = (searchQuery || '').match(/#(\S+)/g);
      const searchTags = tagMatches ? tagMatches.map(t => t.substring(1)) : [];
      const textSearch = (searchQuery || '').replace(/#\S+/g, '').trim();

      const [statusList, taskList, counts] = await Promise.all([
        TaskService.getStatuses(),
        TaskService.getTasksByRole(visibilityContext.userId, roleFilter, {
          search: textSearch || undefined,
          project_id: filterProjectId !== 'all' ? filterProjectId : undefined,
          tags: searchTags.length > 0 ? searchTags : undefined,
        }),
        TaskService.getRoleCounts(visibilityContext.userId),
      ]);
      setStatuses(statusList);
      setRoleCounts(counts);

      // Enrich tasks with project names
      const projectIds = [...new Set(taskList.filter(t => t.project_id).map(t => t.project_id!))];
      let projectMap: Record<string, string> = {};
      if (projectIds.length > 0) {
        const { data: projData } = await dataClient.from('projects').select('id, name').in('id', projectIds);
        if (projData) projData.forEach((p: any) => { projectMap[p.id] = p.name; });
      }
      const enriched = taskList.map(t => ({
        ...t,
        _projectName: t.project_id ? projectMap[t.project_id] : undefined,
      }));
      setTasks(enriched);

      // Load employee info for all referenced people
      const allPeopleIds = new Set<string>();
      taskList.forEach(t => {
        if (t.created_by) allPeopleIds.add(t.created_by);
        t.assignees?.forEach(id => allPeopleIds.add(id));
        t.supporters?.forEach(id => allPeopleIds.add(id));
      });
      if (allPeopleIds.size > 0) {
        const { data: empData } = await dataClient.from('employees').select('id, name, avatar').in('id', Array.from(allPeopleIds));
        if (empData) {
          const map: Record<string, { name: string; avatar?: string }> = {};
          empData.forEach((e: any) => { map[e.id] = { name: e.name || e.id.substring(0, 8), avatar: e.avatar }; });
          setEmployees(map);
        }
      }
    } catch (err: any) {
      console.error('Failed to load tasks:', err);
      toast.error('Lỗi tải công việc: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }, [roleFilter, searchQuery, filterProjectId, visibilityContext.userId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter tasks by selected unit
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (selectedUnit && selectedUnit.id !== 'all') {
      result = result.filter(t => t.unit_id === selectedUnit.id);
    }
    return result;
  }, [tasks, selectedUnit]);

  // Handlers
  const handleToggleComplete = useCallback(async (task: Task) => {
    try {
      if (task.status?.is_done) {
        const defaultId = await TaskService.getDefaultStatusId();
        if (defaultId) await TaskService.update(task.id, { status_id: defaultId, completed_at: undefined, completed_by: undefined });
      } else {
        await TaskService.complete(task.id, visibilityContext.userId);
      }
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  }, [visibilityContext.userId, loadData]);

  const handleSelectTask = useCallback((taskId: string) => {
    if (onSelectTask) {
      onSelectTask(taskId);
    } else {
      openPanel({
        component: (
          <TaskDetailPanel
            taskId={taskId}
            onUpdate={loadData}
            currentUserId={visibilityContext.userId}
            onClose={closePanel}
          />
        ),
        title: 'Chi tiết công việc',
        url: `/tasks/${taskId}`,
      });
    }
  }, [onSelectTask, openPanel, closePanel, loadData, visibilityContext.userId]);

  const handleTogglePin = useCallback(async (taskId: string) => {
    try {
      const pinned = await TaskService.togglePin(taskId);
      toast.success(pinned ? 'Đã ghim công việc' : 'Đã bỏ ghim');
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  }, [loadData]);

  const handleStartTask = useCallback(async (task: Task) => {
    try {
      const inProgressStatus = statuses.find(s => s.name?.includes('Đang') || s.name?.includes('In Progress'));
      if (inProgressStatus) {
        await TaskService.update(task.id, { status_id: inProgressStatus.id });
        toast.success('Đã bắt đầu công việc');
        loadData();
      } else {
        toast.error('Không tìm thấy trạng thái "Đang thực hiện"');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  }, [statuses, loadData]);

  const handleTagClick = useCallback((tag: string) => {
    setSearchQuery(`#${tag}`);
    setShowSearch(true);
  }, []);

  const handleQuickCreate = useCallback(async (title: string, tags: string[], dueDate?: string) => {
    try {
      await TaskService.create({
        title,
        tags,
        due_date: dueDate,
        assignees: [visibilityContext.userId],
        created_by: visibilityContext.userId,
      });
      toast.success('Đã tạo công việc');
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  }, [visibilityContext.userId, loadData]);

  // Selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const handleSelectAll = () => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map(t => t.id)));
    }
  };

  // Bulk actions
  const handleBulkComplete = async () => {
    try {
      const doneStatus = statuses.find(s => s.is_done && s.name !== 'Hủy');
      if (!doneStatus) return;
      await TaskService.bulkUpdateStatus(Array.from(selectedIds), doneStatus.id, visibilityContext.userId);
      toast.success(`Đã hoàn thành ${selectedIds.size} công việc`);
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  const handleBulkSetDeadline = async () => {
    const dateStr = prompt('Nhập deadline (dd/mm/yyyy):');
    if (!dateStr) return;
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) { toast.error('Sai định dạng ngày, dùng dd/mm/yyyy'); return; }
    const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
    try {
      await TaskService.bulkSetDeadline(Array.from(selectedIds), isoDate);
      toast.success(`Đã đặt deadline cho ${selectedIds.size} công việc`);
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  // Stats
  const today = new Date().toISOString().split('T')[0];
  const doneStatusIds = statuses.filter(s => s.is_done).map(s => s.id);
  const overdueCount = tasks.filter(t => t.due_date && t.due_date < today && !doneStatusIds.includes(t.status_id || '')).length;
  const commentsCount = 0;

  return (
    <div className="space-y-0">
      {/* ═══ TOP ROLE TABS (Bitrix24-style) ═══ */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 -mx-6 -mt-6 px-6">
        <div className="flex items-center gap-0 overflow-x-auto">
          {ROLE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setRoleFilter(tab.key); setSelectedIds(new Set()); }}
              className={`relative flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer border-b-2
                ${roleFilter === tab.key
                  ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
            >
              {tab.icon}
              {tab.label}
              {roleCounts[tab.key] !== undefined && roleCounts[tab.key] > 0 && (
                <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                  ${roleFilter === tab.key
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {roleCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ SUB-HEADER ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-5 pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* NEW TASK button */}
          <button
            onClick={() => {
              openPanel({
                component: <CreateTaskPanel onTaskCreated={loadData} onClose={() => closePanel()} currentUserId={visibilityContext.userId} />,
                title: 'Thêm công việc',
              });
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} /> CÔNG VIỆC MỚI
          </button>

          {/* Filter chips */}
          {filterProjectId !== 'all' && (
            <span className="flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-full text-xs font-semibold">
              <FolderKanban size={12} />
              {projects.find(p => p.id === filterProjectId)?.name || 'Dự án'}
              <button onClick={() => setFilterProjectId('all')} className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          {/* Search toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
          >
            <Search size={14} /> {showSearch ? '' : '+ tìm kiếm'}
          </button>

          {showSearch && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm..."
                className="pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setShowSearch(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Project filter */}
          <select
            value={filterProjectId}
            onChange={e => setFilterProjectId(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[180px] truncate cursor-pointer"
          >
            <option value="all">Tất cả dự án</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Template manager */}
          <button
            onClick={() => {
              openPanel({
                component: <TaskTemplateManagerPanel onClose={() => closePanel()} />,
                title: 'Quản lý Mẫu Công Việc',
              });
            }}
            className="hidden sm:flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Copy size={13} /> Mẫu
          </button>
        </div>
      </div>

      {/* ═══ VIEW MODE TABS + COUNTERS ═══ */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-0 mb-4">
        <div className="flex items-center gap-0">
          {VIEW_TABS.map(tab => (
            <button
              key={tab.mode}
              onClick={() => setViewMode(tab.mode)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer border-b-2
                ${viewMode === tab.mode
                  ? 'text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pb-2">
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-semibold">
              <AlertTriangle size={12} /> {overdueCount} Quá hạn
            </span>
          )}
          <span className="flex items-center gap-1">
            <MessageSquare size={12} /> {commentsCount} Bình luận
          </span>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {viewMode === 'list' && (
            <BitrixListView
              tasks={filteredTasks}
              statuses={statuses}
              employees={employees}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onSelect={handleSelectTask}
              onToggleComplete={handleToggleComplete}
              onTogglePin={handleTogglePin}
              onStartTask={handleStartTask}
              onQuickCreate={handleQuickCreate}
              onTagClick={handleTagClick}
            />
          )}
          {viewMode === 'deadline' && (
            <DeadlineView
              tasks={filteredTasks}
              statuses={statuses}
              employees={employees}
              onSelect={handleSelectTask}
              onToggleComplete={handleToggleComplete}
              onQuickCreate={handleQuickCreate}
            />
          )}
          {viewMode === 'planner' && (
            <PlannerView
              tasks={filteredTasks}
              statuses={statuses}
              employees={employees}
              onSelect={handleSelectTask}
              onToggleComplete={handleToggleComplete}
              onQuickCreate={handleQuickCreate}
            />
          )}
          {viewMode === 'calendar' && (
            <CalendarView tasks={filteredTasks} statuses={statuses} onSelect={handleSelectTask} />
          )}
          {viewMode === 'gantt' && (
            <GanttView tasks={filteredTasks} statuses={statuses} onSelect={handleSelectTask} />
          )}
        </>
      )}

      {/* ═══ BULK ACTIONS BAR ═══ */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        totalCount={filteredTasks.length}
        onComplete={handleBulkComplete}
        onSetDeadline={handleBulkSetDeadline}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </div>
  );
};

export default TasksPage;
