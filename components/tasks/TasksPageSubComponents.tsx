/**
 * TasksPage — Extracted Sub-Components & Configs
 * 
 * Contains small UI primitives and configuration constants used by TasksPage.
 * Extracted to reduce the main file size without changing any logic.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckSquare, Filter, Search, Calendar, ChevronDown, X,
  MessageSquare, Link2, MoreHorizontal, Tag, FolderKanban,
  Pin, Play, CheckCircle2, Users, Eye, UserCheck,
  ArrowUpDown, Plus
} from 'lucide-react';
import type { TaskStatus, TaskPriority, TaskRoleFilter } from '../../types/taskTypes';

// ═══════════════════════════════════════
// PRIORITY CONFIG
// ═══════════════════════════════════════
export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; darkColor: string; bg: string; darkBg: string }> = {
  urgent: { label: 'Khẩn cấp', color: 'text-red-600', darkColor: 'dark:text-red-400', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/20' },
  high: { label: 'Cao', color: 'text-orange-600', darkColor: 'dark:text-orange-400', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-900/20' },
  medium: { label: 'Trung bình', color: 'text-blue-600', darkColor: 'dark:text-blue-400', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20' },
  low: { label: 'Thấp', color: 'text-slate-500', darkColor: 'dark:text-slate-400', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-800' },
  none: { label: 'Không', color: 'text-slate-400', darkColor: 'dark:text-slate-500', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-800' },
};

// ═══════════════════════════════════════
// TOP ROLE TABS CONFIG (Bitrix24-style)
// ═══════════════════════════════════════
export const ROLE_TABS: { key: TaskRoleFilter; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'Công việc', icon: <CheckSquare size={15} /> },
  { key: 'ongoing', label: 'Đang làm', icon: <Play size={15} /> },
  { key: 'assisting', label: 'Phối hợp', icon: <Users size={15} /> },
  { key: 'set_by_me', label: 'Tôi giao', icon: <UserCheck size={15} /> },
  { key: 'following', label: 'Theo dõi', icon: <Eye size={15} /> },
];

// ═══════════════════════════════════════
// VIEW MODE TABS
// ═══════════════════════════════════════
export type ViewMode = 'list' | 'deadline' | 'planner' | 'calendar' | 'gantt';

export const VIEW_TABS: { mode: ViewMode; label: string }[] = [
  { mode: 'list', label: 'Danh sách' },
  { mode: 'deadline', label: 'Deadline' },
  { mode: 'planner', label: 'Planner' },
  { mode: 'calendar', label: 'Lịch' },
  { mode: 'gantt', label: 'Gantt' },
];

// ═══════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════
export const PersonAvatar: React.FC<{ name: string; avatar?: string; size?: number }> = ({ name, avatar, size = 28 }) => (
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
export const QuickTaskInput: React.FC<{
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
      if (!title) { const { toast } = await import('sonner'); toast.error('Nhập tên công việc'); setCreating(false); return; }
      await onCreateTask(title, tags);
      setValue('');
    } catch (err: any) {
      const { toast } = await import('sonner');
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
export const StatusDropdown: React.FC<{
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
export const DeadlineInput: React.FC<{
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
export const ProjectPickerDropdown: React.FC<{
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
export const InlineTagInput: React.FC<{
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
export const InlineCommentInput: React.FC<{
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
export const COLUMN_KEYS = ['status', 'deadline', 'created_at', 'assigner', 'assignee', 'comments'] as const;
export type ColumnKey = typeof COLUMN_KEYS[number];

export const DEFAULT_COL_WIDTHS: Record<ColumnKey, number> = {
  status: 110,
  deadline: 150,
  created_at: 150,
  assigner: 140,
  assignee: 140,
  comments: 90,
};

export const COL_LABELS: Record<ColumnKey, string> = {
  status: 'Trạng thái',
  deadline: 'Deadline',
  created_at: 'Ngày tạo',
  assigner: 'Người giao',
  assignee: 'Người thực hiện',
  comments: 'Bình luận',
};

export const COL_RESPONSIVE: Partial<Record<ColumnKey, string>> = {
  created_at: 'hidden xl:table-cell',
  comments: 'hidden lg:table-cell',
};

export const STORAGE_KEY_COL_WIDTHS = 'cic_task_col_widths';

export function loadColWidths(): Record<ColumnKey, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COL_WIDTHS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_COL_WIDTHS, ...parsed };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_COL_WIDTHS };
}

export function saveColWidths(widths: Record<ColumnKey, number>) {
  try { localStorage.setItem(STORAGE_KEY_COL_WIDTHS, JSON.stringify(widths)); } catch { /* ignore */ }
}

// Drag handle component for column resizing
export const ResizeHandle: React.FC<{ columnKey: ColumnKey; getWidth: () => number; onWidthChange: (col: ColumnKey, width: number) => void }> = ({ columnKey, getWidth, onWidthChange }) => {
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
