import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, LayoutGrid, List, CheckSquare, Filter, Search,
  Clock, AlertTriangle, Calendar, ChevronDown, X,
  MessageSquare, Link2, MoreHorizontal, Tag, Copy, FolderKanban,
  Pin, Play, CheckCircle2, Users, Eye, UserCheck, Briefcase,
  ArrowUpDown, ChevronRight, BarChart3, GanttChartSquare, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import { useLayoutContext } from '../layout/MainLayout';
import { TaskService } from '../../services/taskService';
import { DiscussionService } from '../../services/discussionService';
import { TaskPersonalTagService } from '../../services/taskPersonalTagService';
import { dataClient } from '../../lib/dataClient';
import TaskDetailPanel from './TaskDetailPanel';
import CreateTaskPanel from './CreateTaskPanel';
import CalendarView from './CalendarView';
import { GanttView } from './GanttView';
import TaskTemplateManagerPanel from './TaskTemplateManagerPanel';
import TeamDashboard from './TeamDashboard';
import PeoplePickerPopover from './PeoplePickerPopover';
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
// STATUS DROPDOWN (inline edit)
// ═══════════════════════════════════════
const StatusDropdown: React.FC<{
  statuses: TaskStatus[];
  currentStatusId: string;
  onSelect: (statusId: string) => void;
  onClose: () => void;
}> = ({ statuses, currentStatusId, onSelect, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute left-0 top-full mt-1 z-50 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1 overflow-hidden">
      {statuses.map(s => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
            s.id === currentStatusId
              ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
          {s.name}
          {s.id === currentStatusId && <span className="ml-auto text-[10px]">✓</span>}
        </button>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════
// DEADLINE INPUT (inline date-time picker — dd/mm/yyyy HH:mm)
// ═══════════════════════════════════════
const DeadlineInput: React.FC<{
  currentValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
}> = ({ currentValue, onSave, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  // ISO → dd/mm/yyyy HH:mm for display
  const toDisplay = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    } catch { return ''; }
  };

  // ISO → yyyy-MM-ddTHH:mm for hidden input
  const toLocalFormat = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    } catch { return ''; }
  };

  const [displayVal, setDisplayVal] = useState(toDisplay(currentValue));
  const [hiddenVal, setHiddenVal] = useState(toLocalFormat(currentValue));

  // Auto-format as user types: dd/mm/yyyy HH:mm
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 12); // max 12 digits
    let formatted = '';
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 4) formatted += '/';
      if (i === 8) formatted += ' ';
      if (i === 10) formatted += ':';
      formatted += digits[i];
    }
    setDisplayVal(formatted);
  };

  // Parse dd/mm/yyyy HH:mm → ISO
  const parseDisplayToISO = (text: string): string => {
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
    if (match) {
      const [, dd, mm, yyyy, hh, min] = match;
      return new Date(+yyyy, +mm - 1, +dd, +hh, +min).toISOString();
    }
    // Also try dd/mm/yyyy without time
    const dateOnly = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dateOnly) {
      const [, dd, mm, yyyy] = dateOnly;
      return new Date(+yyyy, +mm - 1, +dd).toISOString();
    }
    return '';
  };

  const handleSave = () => {
    const iso = parseDisplayToISO(displayVal);
    onSave(iso || (hiddenVal ? new Date(hiddenVal).toISOString() : ''));
  };

  // Handle native picker change — auto-save immediately
  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setHiddenVal(v);
    if (v) {
      const d = new Date(v);
      setDisplayVal(toDisplay(d.toISOString()));
      onSave(d.toISOString());
    }
  };

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div ref={ref} className="flex items-center gap-1">
      <div className="relative flex-1">
        <input
          type="text"
          value={displayVal}
          onChange={handleTextChange}
          placeholder="dd/mm/yyyy HH:mm"
          className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg pl-2 pr-7 py-1.5 border border-indigo-300 dark:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-400 w-full"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') onClose();
          }}
        />
        <button
          type="button"
          onClick={() => { try { hiddenRef.current?.showPicker(); } catch { hiddenRef.current?.focus(); } }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          tabIndex={-1}
        >
          <Calendar size={12} />
        </button>
        <input
          ref={hiddenRef}
          type="datetime-local"
          value={hiddenVal}
          onChange={handlePickerChange}
          className="absolute w-0 h-0 opacity-0 overflow-hidden"
          style={{ left: 'calc(100% - 24px)', top: '50%' }}
          tabIndex={-1}
        />
      </div>
      {currentValue && (
        <button
          onClick={() => onSave('')}
          className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-0.5 cursor-pointer transition-colors"
          title="Xóa deadline"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// PROJECT PICKER DROPDOWN (inline edit for "Liên kết")
// ═══════════════════════════════════════
const ProjectPickerDropdown: React.FC<{
  projects: { id: string; name: string }[];
  currentProjectId?: string;
  onSelect: (projectId: string | null) => void;
  onClose: () => void;
}> = ({ projects, currentProjectId, onSelect, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="absolute left-0 top-full mt-1 z-50 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-2 border-b border-slate-200 dark:border-slate-700">
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm dự án..."
          className="w-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5 border-none outline-none placeholder-slate-400 dark:placeholder-slate-500"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {currentProjectId && (
          <button
            onClick={() => onSelect(null)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
          >
            <X size={12} /> Bỏ liên kết
          </button>
        )}
        {filtered.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-400 dark:text-slate-500">Không tìm thấy</div>
        ) : filtered.map(p => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
              p.id === currentProjectId
                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }`}
          >
            <FolderKanban size={12} className="flex-shrink-0" />
            <span className="truncate">{p.name}</span>
            {p.id === currentProjectId && <span className="ml-auto text-[10px]">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// TAG INPUT (inline add tag)
// ═══════════════════════════════════════
const InlineTagInput: React.FC<{
  currentTags: string[];
  onSave: (tags: string[]) => void;
  onClose: () => void;
}> = ({ currentTags, onSave, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState('');

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const handleAdd = () => {
    const tag = val.replace(/^#/, '').trim();
    if (tag && !currentTags.includes(tag)) {
      onSave([...currentTags, tag]);
    }
    setVal('');
  };

  const handleRemove = (tag: string) => {
    onSave(currentTags.filter(t => t !== tag));
  };

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-50 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2">
      <div className="flex flex-wrap gap-1 mb-2">
        {currentTags.map(tag => (
          <span key={tag} className="flex items-center gap-0.5 text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
            #{tag}
            <button onClick={() => handleRemove(tag)} className="hover:text-red-500 cursor-pointer"><X size={10} /></button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onClose(); }}
          placeholder="Nhập tag..."
          className="flex-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-2 py-1.5 border border-indigo-300 dark:border-indigo-500 outline-none placeholder-slate-400 dark:placeholder-slate-500"
        />
        <button onClick={handleAdd} className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-1.5 rounded-lg cursor-pointer flex-shrink-0 transition-colors">+</button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// QUICK COMMENT INPUT (inline add comment)
// ═══════════════════════════════════════
const InlineCommentInput: React.FC<{
  onSave: (content: string) => void;
  onClose: () => void;
}> = ({ onSave, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState('');

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const handleAdd = () => {
    if (val.trim()) {
      onSave(val.trim());
    }
  };

  return (
    <div ref={ref} className="absolute right-full top-1/2 -translate-y-1/2 mr-2 z-50 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 flex items-center gap-2">
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') onClose(); }}
        placeholder="Nhập nội dung trao đổi nhanh..."
        className="flex-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-2 py-1.5 border border-indigo-300 dark:border-indigo-500 outline-none placeholder-slate-400 dark:placeholder-slate-500"
      />
      <button onClick={handleAdd} className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg cursor-pointer flex-shrink-0 transition-colors font-medium">Gửi</button>
    </div>
  );
};

// ═══════════════════════════════════════
// COLUMN CONFIG & RESIZABLE COLUMNS
// ═══════════════════════════════════════
const COLUMN_KEYS = ['status', 'deadline', 'created_at', 'assigner', 'assignee', 'comments'] as const;
type ColumnKey = typeof COLUMN_KEYS[number];

const DEFAULT_COL_WIDTHS: Record<ColumnKey, number> = {
  status: 110,
  deadline: 150,
  created_at: 150,
  assigner: 140,
  assignee: 140,
  comments: 90,
};

const COL_LABELS: Record<ColumnKey, string> = {
  status: 'Trạng thái',
  deadline: 'Deadline',
  created_at: 'Ngày tạo',
  assigner: 'Người giao',
  assignee: 'Người thực hiện',
  comments: 'Bình luận',
};

const COL_RESPONSIVE: Partial<Record<ColumnKey, string>> = {
  created_at: 'hidden xl:table-cell',
  comments: 'hidden lg:table-cell',
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

  useEffect(() => {
    const taskIds = tasks.map(t => t.id);
    if (taskIds.length === 0) return;
    DiscussionService.getCountsBatch('task', taskIds)
      .then(counts => setCommentCounts(counts))
      .catch((err) => { console.error(err); });
  }, [tasks]);

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
// DEADLINE VIEW (Kanban by deadline — with drag & drop)
// ═══════════════════════════════════════
type DeadlineColumnKey = 'later' | 'overdue' | 'today' | 'this_week' | 'next_week' | 'no_deadline';

const DeadlineView: React.FC<{
  tasks: Task[];
  statuses: TaskStatus[];
  employees: Record<string, { name: string; avatar?: string }>;
  onSelect: (id: string) => void;
  onToggleComplete: (task: Task) => void;
  onQuickCreate: (title: string, tags: string[], dueDate?: string) => Promise<void>;
  onUpdateDeadline: (taskId: string, deadline: string | null) => void;
  onUpdateAssignee: (taskId: string, assigneeIds: string[]) => void;
}> = ({ tasks, statuses, employees, onSelect, onToggleComplete, onQuickCreate, onUpdateDeadline, onUpdateAssignee }) => {
  // Helper: format Date to local YYYY-MM-DD (avoids UTC shift from toISOString)
  const localDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);
  
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  const endOfWeekStr = localDateStr(endOfWeek);
  
  const endOfNextWeek = new Date(endOfWeek);
  endOfNextWeek.setDate(endOfWeek.getDate() + 7);
  const endOfNextWeekStr = localDateStr(endOfNextWeek);

  const doneStatusIds = new Set(statuses.filter(s => s.is_done).map(s => s.id));
  const activeTasks = tasks.filter(t => !doneStatusIds.has(t.status_id || ''));

  // Helper: extract local YYYY-MM-DD from any ISO timestamp
  const toDateStr = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return localDateStr(dt);
  };

  const [dragOverCol, setDragOverCol] = useState<DeadlineColumnKey | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [editingAssigneeTaskId, setEditingAssigneeTaskId] = useState<string | null>(null);
  const [editingDeadlineTaskId, setEditingDeadlineTaskId] = useState<string | null>(null);

  // Compute target deadline for a drop or quick-create
  const getDeadlineForColumn = (colKey: DeadlineColumnKey): string | null => {
    const now = new Date();
    now.setHours(9, 0, 0, 0); // default 09:00
    switch (colKey) {
      case 'overdue': return null;
      case 'today':
        now.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
        return now.toISOString();
      case 'this_week': {
        const wed = new Date(today);
        const dayOfWeek = today.getDay();
        const daysToWed = dayOfWeek <= 3 ? 3 - dayOfWeek : 7 - dayOfWeek + 3;
        wed.setDate(today.getDate() + Math.max(daysToWed, 1));
        wed.setHours(9, 0, 0, 0);
        return wed.toISOString();
      }
      case 'next_week': {
        const monday = new Date(endOfWeek);
        monday.setDate(endOfWeek.getDate() + 1);
        monday.setHours(9, 0, 0, 0);
        return monday.toISOString();
      }
      case 'later': {
        const futureMonday = new Date(endOfWeek);
        futureMonday.setDate(endOfWeek.getDate() + 8);
        futureMonday.setHours(9, 0, 0, 0);
        return futureMonday.toISOString();
      }
      case 'no_deadline':
        return null;
      default: return null;
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, colKey: DeadlineColumnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colKey) setDragOverCol(colKey);
  };

  const handleDragLeave = (e: React.DragEvent, colKey: DeadlineColumnKey) => {
    const relatedTarget = e.relatedTarget as Node | null;
    const currentTarget = e.currentTarget as Node;
    if (!currentTarget.contains(relatedTarget)) {
      if (dragOverCol === colKey) setDragOverCol(null);
    }
  };

  const handleDrop = (e: React.DragEvent, colKey: DeadlineColumnKey) => {
    e.preventDefault();
    setDragOverCol(null);
    setDraggingTaskId(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    if (colKey === 'no_deadline') {
      onUpdateDeadline(taskId, null);
    } else if (colKey !== 'overdue') {
      const newDeadline = getDeadlineForColumn(colKey);
      if (newDeadline) onUpdateDeadline(taskId, newDeadline);
    }
  };

  const columns: { key: DeadlineColumnKey; title: string; headerBg: string; tasks: Task[] }[] = [
    {
      key: 'overdue',
      title: 'Quá hạn',
      headerBg: 'bg-red-500',
      tasks: activeTasks.filter(t => t.due_date && toDateStr(t.due_date) < todayStr),
    },
    {
      key: 'today',
      title: 'Hôm nay',
      headerBg: 'bg-amber-500',
      tasks: activeTasks.filter(t => toDateStr(t.due_date) === todayStr),
    },
    {
      key: 'this_week',
      title: 'Tuần này',
      headerBg: 'bg-emerald-500',
      tasks: activeTasks.filter(t => t.due_date && toDateStr(t.due_date) > todayStr && toDateStr(t.due_date) <= endOfWeekStr),
    },
    {
      key: 'next_week',
      title: 'Tuần sau',
      headerBg: 'bg-blue-500',
      tasks: activeTasks.filter(t => t.due_date && toDateStr(t.due_date) > endOfWeekStr && toDateStr(t.due_date) <= endOfNextWeekStr),
    },
    {
      key: 'no_deadline',
      title: 'Không có deadline',
      headerBg: 'bg-slate-400',
      tasks: activeTasks.filter(t => !t.due_date),
    },
    {
      key: 'later',
      title: 'Hơn 2 tuần nữa',
      headerBg: 'bg-purple-500',
      tasks: activeTasks.filter(t => t.due_date && toDateStr(t.due_date) > endOfNextWeekStr),
    },
  ];

  return (
    <div className="flex gap-2 pb-4" style={{ minHeight: '60vh' }}>
      {columns.map(col => (
        <div
          key={col.key}
          className={`flex-1 min-w-0 transition-all duration-200 ${
            dragOverCol === col.key ? 'scale-[1.02]' : ''
          }`}
          onDragOver={(e) => handleDragOver(e, col.key)}
          onDragLeave={(e) => handleDragLeave(e, col.key)}
          onDrop={(e) => handleDrop(e, col.key)}
        >
          {/* Column header */}
          <div className={`${col.headerBg} text-white text-sm font-bold px-3 py-2 rounded-t-xl flex items-center justify-between`}>
            <span>{col.title}</span>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{col.tasks.length}</span>
          </div>

          {/* Cards + drop zone */}
          <div className={`bg-slate-50 dark:bg-slate-800 rounded-b-xl p-2 space-y-2 min-h-[200px] transition-all duration-200 ${
            dragOverCol === col.key
              ? 'ring-2 ring-indigo-400 dark:ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
              : ''
          }`}>
            {/* Quick add */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-1.5">
              <QuickTaskInput
                onCreateTask={(title, tags) => onQuickCreate(title, tags, getDeadlineForColumn(col.key) || undefined)}
                placeholder="+ Thêm nhanh"
              />
            </div>

            {col.tasks.map(task => {
              const assignee = task.assignees?.[0] ? employees[task.assignees[0]] : null;
              const isOverdue = task.due_date && task.due_date < todayStr;
              const isDragging = draggingTaskId === task.id;

              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelect(task.id)}
                  className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-grab hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all group active:cursor-grabbing ${
                    isDragging ? 'opacity-40 scale-95' : ''
                  }`}
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
                      <div className="relative mt-1.5" onClick={e => e.stopPropagation()}>
                        {editingDeadlineTaskId === task.id ? (
                          <div className="absolute top-0 left-0 z-50 min-w-[180px]">
                            <DeadlineInput
                              currentValue={task.due_date || ''}
                              onSave={(val) => { onUpdateDeadline(task.id, val || null); setEditingDeadlineTaskId(null); }}
                              onClose={() => setEditingDeadlineTaskId(null)}
                            />
                          </div>
                        ) : task.due_date ? (
                          <button
                            onClick={() => setEditingDeadlineTaskId(task.id)}
                            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${
                              isOverdue
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            }`}
                            title="Bấm để đổi deadline"
                          >
                            {formatDate(task.due_date)}
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingDeadlineTaskId(task.id)}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                            title="Bấm để đặt deadline"
                          >
                            <Calendar size={12} /> Đặt dl
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Footer: assignees — clickable to change */}
                  <div className="flex items-center gap-1 mt-2 -ml-1 relative" onClick={e => e.stopPropagation()}>
                    {task.assignees.length > 0 ? (
                      task.assignees.slice(0, 3).map(id => {
                        const emp = employees[id];
                        return emp ? (
                          <button
                            key={id}
                            onClick={() => setEditingAssigneeTaskId(editingAssigneeTaskId === task.id ? null : task.id)}
                            className="cursor-pointer hover:ring-2 hover:ring-indigo-400 rounded-full transition-all"
                            title="Bấm để đổi người phụ trách"
                          >
                            <PersonAvatar name={emp.name} avatar={emp.avatar} size={22} />
                          </button>
                        ) : null;
                      })
                    ) : (
                      <button
                        onClick={() => setEditingAssigneeTaskId(editingAssigneeTaskId === task.id ? null : task.id)}
                        className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer transition-colors flex items-center gap-0.5"
                      >
                        <Plus size={10} /> Giao việc
                      </button>
                    )}
                    {editingAssigneeTaskId === task.id && (
                      <PeoplePickerPopover
                        currentIds={task.assignees || []}
                        onChange={(newIds) => { onUpdateAssignee(task.id, newIds); setEditingAssigneeTaskId(null); }}
                        onClose={() => setEditingAssigneeTaskId(null)}
                        align="left"
                        minSelections={0}
                        singleSelect
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Drop placeholder when empty and dragging */}
            {col.tasks.length === 0 && !draggingTaskId && (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <Clock size={28} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">Chưa có công việc</p>
              </div>
            )}
            {draggingTaskId && col.tasks.length === 0 && (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 border-2 border-dashed border-indigo-300 dark:border-indigo-600 rounded-lg">
                <p className="text-xs font-medium text-indigo-500 dark:text-indigo-400">Thả vào đây</p>
              </div>
            )}
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

  const [editingDeadlineTaskId, setEditingDeadlineTaskId] = useState<string | null>(null);

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
  onDelete: () => void;
  onClearSelection: () => void;
}> = ({ selectedCount, totalCount, onComplete, onSetDeadline, onDelete, onClearSelection }) => {
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
          <button
            onClick={onDelete}
            className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 size={14} /> Xóa
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
// SEARCH WITH TAG AUTOCOMPLETE
// ═══════════════════════════════════════
const SearchWithTagAutocomplete: React.FC<{
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
  availableTags: string[];
}> = ({ value, onChange, onClear, availableTags }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Detect if user is typing a #tag pattern at cursor position
  const getTagFragment = (): string | null => {
    const input = inputRef.current;
    if (!input) return null;
    const pos = input.selectionStart ?? value.length;
    const textBefore = value.substring(0, pos);
    const match = textBefore.match(/#(\S*)$/);
    return match ? match[1] : null;
  };

  const tagFragment = getTagFragment();
  const suggestions = tagFragment !== null
    ? availableTags.filter(t =>
        t.toLowerCase().includes(tagFragment.toLowerCase()) &&
        !value.includes(`#${t}`)
      ).slice(0, 20)
    : [];

  const handleSelectTag = (tag: string) => {
    const input = inputRef.current;
    if (!input) return;
    const pos = input.selectionStart ?? value.length;
    const textBefore = value.substring(0, pos);
    const textAfter = value.substring(pos);
    // Replace the #fragment with #tag
    const newBefore = textBefore.replace(/#\S*$/, `#${tag}`);
    const newValue = newBefore + (textAfter.startsWith(' ') ? textAfter : ' ' + textAfter);
    onChange(newValue.trimEnd());
    setShowSuggestions(false);
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = newBefore.length + 1;
        inputRef.current.setSelectionRange(newPos, newPos);
        inputRef.current.focus();
      }
    }, 0);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => { setShowSuggestions(true); }}
        placeholder="Tìm kiếm... (gõ #tag để lọc)"
        className="pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-72 sm:w-96 transition-all"
      />
      {value && (
        <button onClick={onClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
          <X size={14} />
        </button>
      )}

      {/* Tag suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
            Tags gợi ý
          </div>
          {suggestions.map(tag => (
            <button
              key={tag}
              onClick={() => handleSelectTag(tag)}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer flex items-center gap-2"
            >
              <Tag size={12} className="text-indigo-400 dark:text-indigo-500 flex-shrink-0" />
              <span className="font-medium">#{tag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// TASKS PAGE (main)
// ═══════════════════════════════════════
interface TasksPageProps {
  onSelectTask?: (taskId: string) => void;
  isEmbedded?: boolean;
  sourceModule?: string;
  sourceEntityId?: string;
}

const TasksPage: React.FC<TasksPageProps> = ({ onSelectTask, isEmbedded, sourceModule, sourceEntityId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilterState] = useState<TaskRoleFilter>(() => {
    return (localStorage.getItem('cic-erp-task-role') as TaskRoleFilter) || 'all';
  });
  const setRoleFilter = (role: TaskRoleFilter) => {
    setRoleFilterState(role);
    localStorage.setItem('cic-erp-task-role', role);
  };
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('cic_task_view_mode') as ViewMode) || 'list';
    } catch {
      return 'list';
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [projects, setProjects] = useState<{id: string; name: string}[]>([]);
  const [employees, setEmployees] = useState<Record<string, { name: string; avatar?: string }>>({});
  const [personalUserTags, setPersonalUserTags] = useState<string[]>([]);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem('cic_task_view_mode', viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  const { getVisibleTasks, getMyTasks, isAdmin, isManager, visibilityContext } = useTaskVisibility();

  // Build role tabs — conditionally include "Giám sát" for managers
  const roleTabs = useMemo(() => {
    const base = [...ROLE_TABS];
    if (isManager) {
      base.push({ key: 'supervising', label: 'Giám sát', icon: <Briefcase size={15} /> });
    }
    return base;
  }, [isManager]);
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

    // Load user's personal tags
    if (visibilityContext.userId) {
      import('../../services/taskPersonalTagService').then(m => {
        m.TaskPersonalTagService.getAllUserTags(visibilityContext.userId).then(tags => {
          setPersonalUserTags(tags);
        });
      });
    }
  }, [visibilityContext.userId]);

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
          source_modules: isEmbedded && sourceModule ? [sourceModule] : undefined,
          source_entity_id: isEmbedded && sourceEntityId ? sourceEntityId : undefined,
        }, visibilityContext),
        TaskService.getRoleCounts(visibilityContext.userId, visibilityContext.role),
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

      // If searching by #tag, also include tasks matched by personal tags
      if (searchTags.length > 0) {
        try {
          const personalMatchPromises = searchTags.map(tag => TaskPersonalTagService.getTaskIdsByTag(visibilityContext.userId, tag));
          const personalMatchArrays = await Promise.all(personalMatchPromises);
          const personalTaskIds = new Set(personalMatchArrays.flat());
          // Remove IDs that are already in the result
          const existingIds = new Set(enriched.map(t => t.id));
          const missingIds = [...personalTaskIds].filter(id => !existingIds.has(id));
          if (missingIds.length > 0) {
            // Fetch those missing tasks
            const { data: extraTasks } = await dataClient.from('tasks').select('*').in('id', missingIds);
            if (extraTasks) {
              for (const t of extraTasks) {
                enriched.push({
                  ...t,
                  _projectName: t.project_id ? projectMap[t.project_id] : undefined,
                } as any);
              }
            }
          }
        } catch { /* silent */ }
      }

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
  }, [roleFilter, searchQuery, filterProjectId, visibilityContext.userId, isEmbedded, sourceModule, sourceEntityId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Tasks are primarily governed by visibilityContext and personal filters
  // Therefore, we do not filter personal tasks out by the global selectedUnit.
  const filteredTasks = tasks;

  const [tabTags, setTabTags] = useState<string[]>([]);

  useEffect(() => {
    // Only update the pool of available tags when no search is active,
    // so suggestions don't instantly disappear when typing partial tags filters the task list.
    if (!searchQuery) {
      const tagSet = new Set<string>();
      tasks.forEach(t => {
        t.tags?.forEach(tag => tagSet.add(tag));
      });
      setTabTags(Array.from(tagSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
    }
  }, [tasks, searchQuery]);

  // Derive actual unique tags from unfiltered tab tags + personal tags
  // This ensures that any suggested tag WILL yield result(s) in the current view
  const actualTags = useMemo(() => {
    return Array.from(new Set([...tabTags, ...personalUserTags]))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [tabTags, personalUserTags]);

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

  const handleSelectTask = useCallback((taskId: string, initialTab?: 'detail' | 'comments' | 'history' | 'links' | 'time') => {
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
            initialTab={initialTab}
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
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_pinned: pinned } : t));
      toast.success(pinned ? 'Đã ghim công việc' : 'Đã bỏ ghim');
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  }, []);

  const handleStartTask = useCallback(async (task: Task) => {
    try {
      const inProgressStatus = statuses.find(s => s.name?.includes('Đang') || s.name?.includes('In Progress'));
      if (inProgressStatus) {
        await TaskService.update(task.id, { status_id: inProgressStatus.id });
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status_id: inProgressStatus.id, status: inProgressStatus } : t));
        toast.success('Đã bắt đầu công việc');
      } else {
        toast.error('Không tìm thấy trạng thái "Đang thực hiện"');
      }
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  }, [statuses]);

  const handleTagClick = useCallback((tag: string) => {
    setSearchQuery(`#${tag}`);
  }, []);

  const handleQuickCreate = useCallback(async (title: string, tags: string[], dueDate?: string) => {
    try {
      await TaskService.create({
        title,
        tags,
        due_date: dueDate,
        assignees: [visibilityContext.userId],
        created_by: visibilityContext.userId,
        source_module: isEmbedded ? sourceModule : undefined,
        source_entity_id: isEmbedded ? sourceEntityId : undefined,
      });
      toast.success('Đã tạo công việc');
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  }, [visibilityContext.userId, loadData, isEmbedded, sourceModule, sourceEntityId]);

  // Inline update handlers — optimistic: update local state immediately, no full reload
  const handleUpdateStatus = useCallback(async (taskId: string, statusId: string) => {
    const status = statuses.find(s => s.id === statusId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status_id: statusId, status: status || t.status } : t));
    try {
      await TaskService.update(taskId, { status_id: statusId });
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
      loadData(); // rollback on error
    }
  }, [statuses, loadData]);

  const handleUpdateDeadline = useCallback(async (taskId: string, deadline: string | null) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: deadline || undefined } : t));
    try {
      await TaskService.update(taskId, { due_date: deadline ?? null } as any);
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
      loadData();
    }
  }, [loadData]);

  const handleUpdateAssignee = useCallback(async (taskId: string, assigneeIds: string[]) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assignees: assigneeIds } : t));
    // Ensure new assignee info is in the employees map
    const missingIds = assigneeIds.filter(id => !employees[id]);
    if (missingIds.length > 0) {
      try {
        const { data: empData } = await dataClient.from('employees').select('id, name, avatar').in('id', missingIds);
        if (empData) {
          setEmployees(prev => {
            const next = { ...prev };
            empData.forEach((e: any) => { next[e.id] = { name: e.name || e.id.substring(0, 8), avatar: e.avatar }; });
            return next;
          });
        }
      } catch { /* ignore */ }
    }
    try {
      await TaskService.update(taskId, { assignees: assigneeIds });
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
      loadData();
    }
  }, [employees, loadData]);

  const handleUpdateProject = useCallback(async (taskId: string, projectId: string | null) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, project_id: projectId || undefined } : t));
    try {
      await TaskService.update(taskId, { project_id: projectId || undefined });
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
      loadData();
    }
  }, [loadData]);

  const handleQuickComment = useCallback(async (taskId: string, content: string) => {
    if (!visibilityContext.userId) return;
    try {
      await DiscussionService.add({
        entity_type: 'task',
        entity_id: taskId,
        user_id: visibilityContext.userId,
        content,
        comment_type: 'user'
      });
      toast.success('Đã gửi bình luận!');
    } catch (err: any) {
      toast.error('Lỗi khi gửi bình luận: ' + (err.message || err));
    }
  }, [visibilityContext.userId]);

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

  const handleBulkDelete = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} công việc đã chọn? \nLưu ý: Hành động này không thể hoàn tác.`)) {
      return;
    }
    try {
      await TaskService.bulkDelete(Array.from(selectedIds));
      toast.success(`Đã xóa ${selectedIds.size} công việc`);
      setSelectedIds(new Set());
      loadData();
    } catch (err: any) {
      toast.error('Lỗi khi xóa: ' + (err.message || err));
    }
  };

  // Stats
  const today = new Date().toISOString().split('T')[0];
  const doneStatusIds = statuses.filter(s => s.is_done).map(s => s.id);
  const overdueCount = tasks.filter(t => t.due_date && t.due_date < today && !doneStatusIds.includes(t.status_id || '')).length;
  const commentsCount = 0;

  return (
    <div className={`space-y-0 ${isEmbedded ? 'flex flex-col h-full min-h-0' : ''}`}>
      {/* ═══ TOP ROLE TABS (Bitrix24-style) ═══ */}
      {!isEmbedded && (
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 -mx-6 -mt-6 px-6">
        <div className="flex items-center gap-0 overflow-x-auto">
          {roleTabs.map(tab => (
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
      )}

      {/* ═══ SUB-HEADER ═══ */}
      {!isEmbedded && (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-5 pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* NEW TASK button */}
          <button
            onClick={() => {
              openPanel({
                component: <CreateTaskPanel 
                   onTaskCreated={loadData} 
                   onClose={() => closePanel()} 
                   currentUserId={visibilityContext.userId} 
                   initialData={isEmbedded && sourceModule && sourceEntityId ? { source_module: sourceModule, source_entity_id: sourceEntityId } : undefined}
                />,
                title: 'Thêm công việc',
              });
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} /> CÔNG VIỆC MỚI
          </button>



          {/* Search Bar - Always Visible */}
          <SearchWithTagAutocomplete
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => { setSearchQuery(''); }}
            availableTags={actualTags}
          />
        </div>

        <div className="flex items-center gap-2">
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
      )}

      {/* ═══ VIEW MODE TABS + COUNTERS ═══ */}
      <div className={`flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-0 ${isEmbedded ? 'mb-0 px-2' : 'mb-4'}`}>
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

      {/* ═══ TEAM DASHBOARD (supervising mode) ═══ */}
      {roleFilter === 'supervising' && isManager && !loading && (
        <TeamDashboard
          visibilityContext={visibilityContext}
          onSelectEmployee={(empId) => {
            setSearchQuery('');
            setFilterProjectId('all');
            // Navigate to filtered view for this employee
            setRoleFilter('supervising');
            // The TeamDashboard handles its own filtering internally
          }}
          onViewTask={handleSelectTask}
        />
      )}

      {/* ═══ CONTENT ═══ */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-20 min-h-[300px]">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className={`${isEmbedded ? 'flex-1 min-h-0 overflow-y-auto' : ''}`}>
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
              onUpdateStatus={handleUpdateStatus}
              onUpdateDeadline={handleUpdateDeadline}
              onUpdateAssignee={handleUpdateAssignee}
              onUpdateProject={handleUpdateProject}
              onQuickComment={handleQuickComment}
              projects={projects}
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
              onUpdateDeadline={handleUpdateDeadline}
              onUpdateAssignee={handleUpdateAssignee}
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
        </div>
      )}

      {/* ═══ BULK ACTIONS BAR ═══ */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        totalCount={filteredTasks.length}
        onComplete={handleBulkComplete}
        onSetDeadline={handleBulkSetDeadline}
        onDelete={handleBulkDelete}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </div>
  );
};

export default TasksPage;
