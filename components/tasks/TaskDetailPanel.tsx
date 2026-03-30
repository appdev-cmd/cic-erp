import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckSquare, X, Calendar, Clock, Tag, Link2, MessageSquare,
  AlertTriangle, Pin, User, Edit3, Save, ExternalLink,
  Play, CheckCircle2, Plus, Trash2, History, Lock,
  Eye, Crown, Users, ShieldCheck, Send, XCircle, RotateCcw,
  FileText, Briefcase, Building, Bookmark
} from 'lucide-react';
import { toast } from 'sonner';
import { TaskService } from '../../services/taskService';
import { TaskPersonalTagService } from '../../services/taskPersonalTagService';
import { EntityRegistryService } from '../../services/entityRegistryService';
import { formatDate, formatDateTime } from '../../utils/formatters';
import DiscussionBox from '../ui/DiscussionBox';
import SearchableSelect from '../ui/SearchableSelect';
import ConfirmDialog from '../ui/ConfirmDialog';
import { DiscussionService, type Discussion } from '../../services/discussionService';
import PeoplePickerPopover from './PeoplePickerPopover';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import type { Task, TaskStatus, TaskLink, TaskPriority, ApprovalMode, ApprovalStep } from '../../types/taskTypes';
import { SlidePanelHeader } from '../ui/SlidePanelHeader';
import { EntitySearchService } from '../../services/entitySearchService';
import { useAuth } from '../../contexts/AuthContext';
import { useOpenEntityPanel } from '../LazyPages';

// ═══════════════════════════════════════
// PRIORITY CONFIG
// ═══════════════════════════════════════
const PRIORITIES: { value: TaskPriority; label: string; color: string; darkColor: string; bg: string; darkBg: string }[] = [
  { value: 'urgent', label: 'Khẩn cấp', color: 'text-red-600', darkColor: 'dark:text-red-400', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/20' },
  { value: 'high', label: 'Cao', color: 'text-orange-600', darkColor: 'dark:text-orange-400', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-900/20' },
  { value: 'medium', label: 'Trung bình', color: 'text-blue-600', darkColor: 'dark:text-blue-400', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20' },
  { value: 'low', label: 'Thấp', color: 'text-slate-500', darkColor: 'dark:text-slate-400', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-800' },
  { value: 'none', label: 'Không', color: 'text-slate-400', darkColor: 'dark:text-slate-500', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-800' },
];

// ═══════════════════════════════════════
// DATE PICKER FIELD
// ═══════════════════════════════════════
const DatePickerField: React.FC<{
  value: string | null | undefined;
  onChange: (val: string | null) => void;
  placeholder?: string;
  className?: string;
  textClassName?: string;
}> = ({ value, onChange, placeholder = 'dd/mm/yyyy', className = '', textClassName = '' }) => {
  const hiddenRef = React.useRef<HTMLInputElement>(null);
  const [text, setText] = React.useState('');

  React.useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) setText(`${parts[2]}/${parts[1]}/${parts[0]}`);
    } else {
      setText('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^\d]/g, '');
    let formatted = '';
    for (let i = 0; i < digits.length && i < 8; i++) {
      if (i === 2 || i === 4) formatted += '/';
      formatted += digits[i];
    }
    setText(formatted);
  };

  const handleBlur = () => {
    if (!text.trim()) { onChange(null); return; }
    const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) onChange(`${match[3]}-${match[2]}-${match[1]}`);
  };

  return (
    <div className={`flex items-center ${className}`}>
      <input
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === 'Enter') handleBlur(); }}
        placeholder={placeholder}
        maxLength={10}
        className={`bg-transparent border-none outline-none flex-1 min-w-0 ${textClassName}`}
      />
      <button
        type="button"
        onClick={() => { try { hiddenRef.current?.showPicker(); } catch { hiddenRef.current?.focus(); } }}
        className="text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer p-0.5 ml-auto flex-shrink-0"
      >
        <Calendar size={14} />
      </button>
      <input ref={hiddenRef} type="date" value={value || ''} onChange={e => onChange(e.target.value || null)} className="sr-only" tabIndex={-1} />
    </div>
  );
};

// ═══════════════════════════════════════
// ENTITY LINK ITEM
// ═══════════════════════════════════════
const LinkItem: React.FC<{ link: TaskLink; registryOptions?: { id: string; name: string; }[] }> = ({ link, registryOptions }) => {
  const [resolvedUrl, setResolvedUrl] = React.useState<string | null>(link.url || null);
  const openEntityPanel = useOpenEntityPanel();
  const [iconName, setIconName] = React.useState<string>('');

  React.useEffect(() => {
    EntityRegistryService.getByType(link.entity_type).then(reg => {
      if (reg?.icon) setIconName(reg.icon);
    });
    if (!link.url) EntityRegistryService.resolveUrl(link.entity_type, link.entity_id).then(u => setResolvedUrl(u));
  }, [link]);

  const moduleName = registryOptions?.find(o => o.id === link.entity_type)?.name || link.entity_type;

  return (
    <a
      href={resolvedUrl || '#'}
      onClick={e => { 
        e.preventDefault();
        openEntityPanel(link.entity_type, link.entity_id);
      }}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
    >
      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
        {iconName === 'file-text' && <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />}
        {iconName === 'briefcase' && <Briefcase size={16} className="text-indigo-600 dark:text-indigo-400" />}
        {iconName === 'users' && <Users size={16} className="text-indigo-600 dark:text-indigo-400" />}
        {iconName === 'building' && <Building size={16} className="text-indigo-600 dark:text-indigo-400" />}
        {!['file-text', 'briefcase', 'users', 'building'].includes(iconName) && <Link2 size={16} className="text-indigo-600 dark:text-indigo-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{link.entity_label || `${link.entity_type}/${link.entity_id}`}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate tracking-wide">
          {moduleName.toUpperCase()} • ID: {link.entity_id}
        </p>
      </div>
    </a>
  );
};

// ═══════════════════════════════════════
// PERSON BADGE (sidebar)
// ═══════════════════════════════════════
interface PersonInfo { id: string; name: string; position?: string; avatar?: string; }

const PersonBadge: React.FC<{ person: PersonInfo; onRemove?: () => void }> = ({ person, onRemove }) => (
  <div className="flex items-center gap-2.5 py-1.5 group">
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
      {person.avatar ? (
        <img src={person.avatar} alt="" className="w-full h-full rounded-full object-cover" />
      ) : person.name.charAt(0).toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{person.name}</div>
      {person.position && <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{person.position}</div>}
    </div>
    {onRemove && (
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all cursor-pointer p-0.5"
        title="Gỡ bỏ"
      >
        <X size={12} />
      </button>
    )}
  </div>
);

// ═══════════════════════════════════════
// TAG INPUT WITH AUTOCOMPLETE
// ═══════════════════════════════════════
const TagInputWithAutocomplete: React.FC<{
  currentTags: string[];
  onAdd: (tag: string) => void;
}> = ({ currentTags, onAdd }) => {
  const [input, setInput] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load all tags on first focus
  const loadTags = useCallback(async () => {
    if (loadedOnce) return;
    try {
      const tags = await import('../../services/taskService').then(m => m.TaskService.getAllTags());
      setAllTags(tags);
      setLoadedOnce(true);
    } catch { /* ignore */ }
  }, [loadedOnce]);

  // Filter suggestions: match input, exclude already-added tags
  const suggestions = input.trim()
    ? allTags.filter(t =>
        t.toLowerCase().includes(input.trim().toLowerCase()) &&
        !currentTags.includes(t)
      ).slice(0, 8)
    : [];

  const handleAdd = (tag: string) => {
    const cleaned = tag.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '_');
    if (cleaned && !currentTags.includes(cleaned)) {
      onAdd(cleaned);
    }
    setInput('');
    inputRef.current?.focus();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center gap-1.5">
        <Tag size={12} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={() => { setFocused(true); loadTags(); }}
          onKeyDown={e => {
            if (e.key === 'Enter' && input.trim()) {
              e.preventDefault();
              handleAdd(input);
            }
            if (e.key === 'Escape') {
              setFocused(false);
              setInput('');
            }
          }}
          placeholder="Thêm tag... (gõ rồi nhấn Enter)"
          className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Autocomplete dropdown */}
      {focused && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          {suggestions.map(tag => (
            <button
              key={tag}
              onClick={() => handleAdd(tag)}
              className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer flex items-center gap-2"
            >
              <Tag size={10} className="text-slate-400 dark:text-slate-500" />
              <span className="font-medium">{tag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// PERSONAL TAG INPUT (inline, compact)
// ═══════════════════════════════════════
const PersonalTagInput: React.FC<{
  currentTags: string[];
  onAdd: (tag: string) => void;
}> = ({ currentTags, onAdd }) => {
  const [input, setInput] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const loadTags = useCallback(async () => {
    if (loadedOnce) return;
    try {
      const { TaskPersonalTagService } = await import('../../services/taskPersonalTagService');
      const { dataClient } = await import('../../lib/dataClient');
      const { data: { user } } = await dataClient.auth.getUser();
      if (user) {
        const tags = await TaskPersonalTagService.getAllUserTags(user.id);
        setAllTags(tags);
      }
      setLoadedOnce(true);
    } catch { /* ignore */ }
  }, [loadedOnce]);

  const suggestions = input.trim()
    ? allTags.filter(t =>
        t.toLowerCase().includes(input.trim().toLowerCase()) &&
        !currentTags.includes(t)
      ).slice(0, 6)
    : [];

  const handleAdd = (tag: string) => {
    const cleaned = tag.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '_');
    if (cleaned && !currentTags.includes(cleaned)) {
      onAdd(cleaned);
    }
    setInput('');
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onFocus={() => { setFocused(true); loadTags(); }}
        onKeyDown={e => {
          if (e.key === 'Enter' && input.trim()) {
            e.preventDefault();
            handleAdd(input);
          }
          if (e.key === 'Escape') {
            setFocused(false);
            setInput('');
          }
        }}
        placeholder="#tag..."
        className="text-[11px] w-20 px-1.5 py-0.5 rounded border border-dashed border-amber-300 dark:border-amber-600 bg-transparent text-amber-700 dark:text-amber-400 placeholder-amber-300 dark:placeholder-amber-600 focus:outline-none focus:border-amber-400 dark:focus:border-amber-500 transition-colors"
      />

      {focused && suggestions.length > 0 && (
        <div className="absolute left-0 mt-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-32 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          {suggestions.map(tag => (
            <button
              key={tag}
              onClick={() => handleAdd(tag)}
              className="w-full text-left px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Lock size={8} className="text-amber-400 dark:text-amber-500" />
              <span className="font-medium">{tag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// CHECKLIST
// ═══════════════════════════════════════
interface ChecklistItem { id: string; text: string; done: boolean; }

const ChecklistRow: React.FC<{
  item: ChecklistItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
}> = ({ item, onToggle, onDelete, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  return (
    <div className="flex items-center gap-2 group py-1">
      <button
        onClick={() => onToggle(item.id)}
        className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer
          ${item.done
            ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600'
            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500'
          }`}
      >
        {item.done && <CheckSquare size={12} className="text-white" />}
      </button>
      {editing ? (
        <input
          autoFocus value={text}
          onChange={e => setText(e.target.value)}
          onBlur={() => { onEdit(item.id, text); setEditing(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { onEdit(item.id, text); setEditing(false); } if (e.key === 'Escape') { setText(item.text); setEditing(false); } }}
          className="flex-1 text-sm px-2 py-1 rounded-lg border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={`flex-1 text-sm cursor-text ${item.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}
        >
          {item.text}
        </span>
      )}
      <button onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all cursor-pointer p-1">
        <Trash2 size={12} />
      </button>
    </div>
  );
};

// ═══════════════════════════════════════
// HISTORY TAB (system log timeline)
// ═══════════════════════════════════════
const HistoryTab: React.FC<{
  taskId: string;
  logs: Discussion[];
  setLogs: React.Dispatch<React.SetStateAction<Discussion[]>>;
}> = ({ taskId, logs, setLogs }) => {
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const result = await DiscussionService.getByEntity('task', taskId);
      // Filter system comments only, newest first
      const systemLogs = result.filter(d => d.comment_type === 'system').reverse();
      setLogs(systemLogs);
    } catch { /* ignore */ }
  }, [taskId, setLogs]);

  useEffect(() => {
    setLoading(true);
    fetchLogs().finally(() => setLoading(false));
  }, [fetchLogs]);

  useEffect(() => {
    const handleDiscussionChange = (e: any) => {
      const record = e.detail?.record;
      if (!record || (record.entity_type === 'task' && record.entity_id === taskId)) {
        fetchLogs();
      }
    };
    window.addEventListener('discussion-changed', handleDiscussionChange);
    return () => window.removeEventListener('discussion-changed', handleDiscussionChange);
  }, [fetchLogs, taskId]);

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (logs.length === 0) return (
    <div className="text-center py-10 text-slate-400 dark:text-slate-500">
      <History size={32} className="mx-auto mb-2 opacity-50" />
      <p className="text-sm">Chưa có lịch sử thay đổi</p>
      <p className="text-xs mt-1">Mọi thay đổi sẽ được ghi lại ở đây</p>
    </div>
  );

  return (
    <div className="p-5">
      <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 space-y-4">
        {logs.map(log => (
          <div key={log.id} className="flex gap-3 -ml-[9px]">
            {/* Dot */}
            <div className="w-4 h-4 rounded-full bg-indigo-500 dark:bg-indigo-400 border-2 border-white dark:border-slate-900 flex-shrink-0 mt-0.5" />
            {/* Content */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{log.user_name || 'Hệ thống'}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatDateTime(log.created_at)}</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{log.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// MAIN TASK DETAIL PANEL (Bitrix24-style)
// ═══════════════════════════════════════
interface TaskDetailPanelProps {
  taskId: string;
  onClose?: () => void;
  onUpdate?: () => void;
  currentUserId?: string;
  initialTab?: 'detail' | 'comments' | 'history' | 'links' | 'time';
}

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  taskId,
  onClose,
  onUpdate,
  currentUserId,
  initialTab,
}) => {
  const { profile } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editProgressNote, setEditProgressNote] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [bottomTab, setBottomTabState] = useState<'detail' | 'comments' | 'history' | 'links' | 'time'>(() => {
    return (localStorage.getItem('cic-erp-task-bottom-tab') as any) || initialTab || 'detail';
  });

  const setBottomTab = (tab: 'detail' | 'comments' | 'history' | 'links' | 'time') => {
    setBottomTabState(tab);
    localStorage.setItem('cic-erp-task-bottom-tab', tab);
  };

  // People picker popover state
  const [openPicker, setOpenPicker] = useState<'assignees' | 'supporters' | 'watchers' | 'approvers' | null>(null);

  // Approval workflow state
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalComment, setApprovalComment] = useState('');
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [editingStepLevel, setEditingStepLevel] = useState<number | null>(null);

  // Add Link state
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [selectedLinkType, setSelectedLinkType] = useState<string>('');
  const [registryOptions, setRegistryOptions] = useState<{id: string; name: string}[]>([]);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  useEffect(() => {
    if (bottomTab === 'links' && registryOptions.length === 0) {
      import('../../services/entityRegistryService').then(m => {
        m.EntityRegistryService.getAll().then(all => setRegistryOptions(all.map(x => ({ id: x.entity_type, name: x.label }))));
      });
    }
  }, [bottomTab, registryOptions.length]);

  const searchEntity = useCallback(async (query: string) => {
    if (!selectedLinkType || query.length < 2) return [];
    try {
      return await EntitySearchService.search(selectedLinkType, query, profile);
    } catch (err) {
      console.error('searchEntity error:', err);
      return [];
    }
  }, [selectedLinkType, profile]);

  const handleCreateLink = async (entityId: string | null, option?: {id: string; name: string}) => {
    if (!task || !selectedLinkType || !entityId) return;
    try {
      const newLink = await TaskService.addLink({
        task_id: task.id,
        entity_type: selectedLinkType,
        entity_id: entityId,
        entity_label: option?.name
      });
      setLinks(prev => [...prev, Object.assign({}, newLink, { entity_type: selectedLinkType })]);
      setIsAddingLink(false);
      setSelectedLinkType('');
      toast.success('Đã thêm liên kết');
    } catch (e: any) {
      toast.error('Lỗi thêm liên kết: ' + e.message);
    }
  };

  // History logs
  const [historyLogs, setHistoryLogs] = useState<Discussion[]>([]);

  // Sidebar: people info
  const [people, setPeople] = useState<Record<string, PersonInfo>>({});

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // Added state

  const originalTaskRef = useRef<Task | null>(null);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [showAddCheck, setShowAddCheck] = useState(false);

  // Personal tags
  const [personalTags, setPersonalTags] = useState<string[]>([]);

  // Primary Link
  const [isEditingPrimary, setIsEditingPrimary] = useState<boolean>(false);
  const [primaryLinkType, setPrimaryLinkType] = useState<string>('');
  
  // ─── Pending changes (buffered save) ───
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const isDirty = Object.keys(pendingChanges).length > 0;

  // SlidePanel lock when dirty
  const { lockPanel, unlockPanel, setOnCloseBlocked, panels } = useSlidePanel();
  const topPanelId = panels.length > 0 ? panels[panels.length - 1].id : undefined;

  useEffect(() => {
    if (!topPanelId) return;
    if (isDirty) {
      lockPanel(topPanelId);
      setOnCloseBlocked(topPanelId, () => {
        const ok = window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng?');
        if (ok) {
          unlockPanel(topPanelId);
          setPendingChanges({});
        }
      });
    } else {
      unlockPanel(topPanelId);
      setOnCloseBlocked(topPanelId, null);
    }
    return () => {
      if (topPanelId) {
        unlockPanel(topPanelId);
        setOnCloseBlocked(topPanelId, null);
      }
    };
  }, [isDirty, topPanelId, lockPanel, unlockPanel, setOnCloseBlocked]);

  // Browser beforeunload warning
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Load task data
  const loadTask = useCallback(async () => {
    try {
      const [taskData, statusList, linkList] = await Promise.all([
        TaskService.getById(taskId),
        TaskService.getStatuses(),
        TaskService.getLinks(taskId),
      ]);
      setTask(taskData);
      originalTaskRef.current = JSON.parse(JSON.stringify(taskData)); // deep copy to ensure it doesn't get mutated by accident if there are arrays
      setStatuses(statusList);
      setLinks(linkList);
      setEditTitle(taskData?.title || '');
      setEditDescription(taskData?.description || '');
      setEditProgressNote(taskData?.custom_fields?.progress_note || '');
      setPendingChanges({}); // reset dirty on load

      // Load checklist from custom_fields
      if (taskData?.custom_fields?.checklist) {
        setChecklist(taskData.custom_fields.checklist);
      }

      // Load personal tags
      if (currentUserId) {
        try {
          const pTags = await TaskPersonalTagService.getTagsForTask(currentUserId, taskId);
          setPersonalTags(pTags);
        } catch { /* silent */ }
      }

      // Resolve people from employees table (full company directory)
      const ids = new Set<string>();
      if (taskData?.created_by) ids.add(taskData.created_by);
      taskData?.assignees?.forEach((id: string) => ids.add(id));
      taskData?.watchers?.forEach((id: string) => ids.add(id));
      taskData?.supporters?.forEach((id: string) => ids.add(id));
      taskData?.approvers?.forEach((id: string) => ids.add(id));
      // Also collect approver IDs from multi-level approval_steps
      if (taskData?.custom_fields?.approval_steps) {
        for (const step of taskData.custom_fields.approval_steps) {
          step.approver_ids?.forEach((id: string) => ids.add(id));
        }
      }

      if (ids.size > 0) {
        try {
          const { dataClient } = await import('../../lib/dataClient');
          const { data: employees } = await dataClient
            .from('employees')
            .select('id, name, avatar, position')
            .in('id', Array.from(ids));

          const map: Record<string, PersonInfo> = {};
          if (employees) {
            for (const e of employees) {
              map[e.id] = {
                id: e.id,
                name: e.name || e.id.substring(0, 8) + '...',
                avatar: e.avatar || undefined,
                position: e.position || undefined,
              };
            }
          }
          setPeople(map);
        } catch { /* fallback: show IDs */ }
      }
    } catch (err: any) {
      toast.error('Lỗi tải chi tiết task: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { loadTask(); }, [loadTask]);

  // ─── Buffered field change (adds to pending, does NOT save immediately) ───
  const bufferChange = (field: string, value: any) => {
    setPendingChanges(prev => ({ ...prev, [field]: value }));
    // Also update the local task state optimistically for instant UI feedback
    setTask(prev => prev ? { ...prev, [field]: value } : prev);
  };

  // ─── Fetch & cache person info for IDs not yet in people map ───
  const ensurePeopleLoaded = useCallback(async (ids: string[]) => {
    const missing = ids.filter(id => !people[id] || people[id].name.includes('...'));
    if (missing.length === 0) return;
    try {
      const { dataClient } = await import('../../lib/dataClient');
      const { data: employees } = await dataClient
        .from('employees')
        .select('id, name, avatar, position')
        .in('id', missing);
      if (employees && employees.length > 0) {
        setPeople(prev => {
          const updated = { ...prev };
          for (const e of employees) {
            updated[e.id] = { id: e.id, name: e.name || e.id.substring(0, 8) + '...', avatar: e.avatar || undefined, position: e.position || undefined };
          }
          return updated;
        });
      }
    } catch { /* fallback: will show ID */ }
  }, [people]);

  // ─── Generate descriptive history log for a field change ───
  const generateLogDetail = async (field: string, oldVal: any, newVal: any): Promise<string | null> => {
    const fieldLabels: Record<string, string> = {
      title: 'Tiêu đề', description: 'Mô tả', status_id: 'Trạng thái',
      priority: 'Ưu tiên', start_date: 'Ngày bắt đầu', due_date: 'Deadline',
      assignees: 'Người thực hiện', supporters: 'Người phối hợp',
      watchers: 'Người theo dõi', approvers: 'Người phê duyệt', tags: 'Tags',
    };
    const label = fieldLabels[field] || field;

    let detail = '';

    if (['assignees', 'supporters', 'watchers', 'approvers'].includes(field)) {
       const oldArr = Array.isArray(oldVal) ? oldVal : (oldVal ? [oldVal] : []);
       const newArr = Array.isArray(newVal) ? newVal : (newVal ? [newVal] : []);
       const allIds = [...new Set([...oldArr, ...newArr])].filter(Boolean);
       
       // fetch missing profiles directly
       const missingIds = allIds.filter(id => !people[id] || people[id].name.includes('...'));
       if (missingIds.length > 0) {
         try {
           const { dataClient } = await import('../../lib/dataClient');
           const { data: emps } = await dataClient.from('employees').select('id, name').in('id', missingIds);
           if (emps) {
             emps.forEach((e: any) => {
               people[e.id] = { id: e.id, name: e.name || e.id.substring(0,8) + '...' };
             });
           }
         } catch { /* ignore */ }
       }

       const getNamesStr = (ids: any) => {
         const arr = Array.isArray(ids) ? ids : (ids ? [ids] : []);
         return arr.map(id => people[id]?.name || id.substring(0,8)).join(', ') || 'Không có';
       };

       const oldStr = getNamesStr(oldVal);
       const newStr = getNamesStr(newVal);
       if (oldStr === newStr) return null;
       detail = `từ "${oldStr}" sang "${newStr}"`;
    } 
    else if (field === 'status_id') {
       const oldName = statuses.find(s => s.id === oldVal)?.name || 'Trống';
       const newName = statuses.find(s => s.id === newVal)?.name || 'Trống';
       if (oldName === newName) return null;
       detail = `từ "${oldName}" sang "${newName}"`;
    } 
    else if (field === 'priority') {
       const clean = (s: string) => s?.replace(/[^a-zA-Z0-9\sÀ-ỹ]/g, '').trim() || '';
       const oldName = clean(PRIORITIES.find(p => p.value === oldVal)?.label || 'Trống');
       const newName = clean(PRIORITIES.find(p => p.value === newVal)?.label || 'Trống');
       if (oldName === newName) return null;
       detail = `từ "${oldName}" sang "${newName}"`;
    } 
    else if (field === 'start_date' || field === 'due_date') {
       const oldDate = oldVal ? formatDate(oldVal) : 'Trống';
       const newDate = newVal ? formatDate(newVal) : 'Trống';
       if (oldDate === newDate) return null;
       detail = `từ "${oldDate}" sang "${newDate}"`;
    } 
    else if (field === 'tags') {
       const oldTags = (Array.isArray(oldVal) ? oldVal : []).join(', ') || 'Không có';
       const newTags = (Array.isArray(newVal) ? newVal : []).join(', ') || 'Không có';
       if (oldTags === newTags) return null;
       detail = `từ "${oldTags}" sang "${newTags}"`;
    } 
    else if (['title', 'description'].includes(field)) {
       const truncate = (s: any) => {
         const str = typeof s === 'string' ? s : '';
         if (!str) return 'Trống';
         return str.length > 50 ? str.substring(0, 47) + '...' : str;
       };
       const oldStr = truncate(oldVal);
       const newStr = truncate(newVal);
       if (oldStr === newStr) return null;
       detail = `từ "${oldStr}" sang "${newStr}"`;
    }
    else {
      return null;
    }
    
    return `Đã thay đổi ${label} ${detail}`.trim();
  };

  // ─── Save all pending changes at once ───
  const handleSaveAll = async () => {
    if (!task || !isDirty) return;
    setSaving(true);
    try {
      // Create system log entries for each changed field
      const logParts: string[] = [];
      for (const [field, newVal] of Object.entries(pendingChanges)) {
        const oldVal = (originalTaskRef.current as any)?.[field];
        const logContent = await generateLogDetail(field, oldVal, newVal);
        if (logContent) logParts.push(logContent);
      }
      if (logParts.length > 0 && currentUserId) {
        try {
          await DiscussionService.add({
            entity_type: 'task',
            entity_id: task.id,
            user_id: currentUserId,
            content: logParts.join(' \u2022 '),
            comment_type: 'system',
          });
        } catch { /* fire-and-forget */ }
      }

      await TaskService.update(task.id, pendingChanges);
      setPendingChanges({});
      toast.success('Đã lưu thay đổi');
      loadTask();
      onUpdate?.();
    } catch (err: any) {
      toast.error('Lỗi lưu: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    setSaving(true);
    try {
      await TaskService.delete(task.id);
      toast.success('Đã xóa công việc');
      setIsDeleteDialogOpen(false);
      setSaving(false);
      onUpdate?.();
      onClose?.();
    } catch (err: any) {
      toast.error('Lỗi xóa công việc: ' + (err.message || err));
      setIsDeleteDialogOpen(false);
      setSaving(false);
    }
  };

  // ─── Discard all pending changes ───
  const handleDiscardChanges = () => {
    setPendingChanges({});
    loadTask(); // reload from DB
  };

  // ─── Immediate save (for actions that must take effect now) ───
  const handleImmediateUpdate = async (field: string, value: any) => {
    if (!task) return;
    try {
      await TaskService.update(task.id, { [field]: value });
      
      if (currentUserId) {
        try {
          const oldVal = (originalTaskRef.current as any)?.[field];
          const logContent = await generateLogDetail(field, oldVal, value);
          if (logContent) {
            await DiscussionService.add({
              entity_type: 'task',
              entity_id: task.id,
              user_id: currentUserId,
              content: logContent,
              comment_type: 'system',
            });
          }
        } catch { /* fire-and-forget */ }
      }
      
      loadTask();
      onUpdate?.();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle !== task?.title) bufferChange('title', editTitle.trim());
    setIsEditingTitle(false);
  };

  const handleSaveDescription = () => {
    if (editDescription !== task?.description) bufferChange('description', editDescription);
    setIsEditingDesc(false);
  };

  const handleToggleComplete = async () => {
    if (!task) return;
    // If task has approvers and user is NOT an approver → should use submitForApproval instead
    if (task.approvers?.length > 0 && currentUserId && !task.approvers.includes(currentUserId) && !task.status?.is_done) {
      toast.error('Task có người phê duyệt. Vui lòng bấm "Gửi phê duyệt" thay vì "Hoàn thành".');
      return;
    }
    try {
      if (task.status?.is_done) {
        const defaultId = await TaskService.getDefaultStatusId();
        if (defaultId) {
          await TaskService.update(task.id, { status_id: defaultId, completed_at: undefined, completed_by: undefined, approval_status: undefined } as any);
          if (currentUserId) {
            try {
              const oldVal = task.status_id;
              const logContent = await generateLogDetail('status_id', oldVal, defaultId);
              if (logContent) {
                await DiscussionService.add({
                  entity_type: 'task', entity_id: task.id, user_id: currentUserId,
                  content: logContent, comment_type: 'system'
                });
              }
            } catch { /* ignore */ }
          }
        }
      } else {
        await TaskService.complete(task.id, currentUserId || '');
        if (currentUserId) {
          try {
            const oldVal = task.status_id;
            const doneStatus = statuses.find(s => s.is_done)?.id;
            if (doneStatus) {
              const logContent = await generateLogDetail('status_id', oldVal, doneStatus);
              if (logContent) {
                await DiscussionService.add({
                  entity_type: 'task', entity_id: task.id, user_id: currentUserId,
                  content: logContent, comment_type: 'system'
                });
              }
            } else {
              await DiscussionService.add({
                entity_type: 'task', entity_id: task.id, user_id: currentUserId,
                content: 'Đã hoàn thành công việc', comment_type: 'system'
              });
            }
          } catch { /* ignore */ }
        }
      }
      setPendingChanges({});
      loadTask();
      onUpdate?.();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  // ─── Approval Workflow Handlers ───
  const handleSubmitForApproval = async () => {
    if (!task || !currentUserId) return;
    setApprovalLoading(true);
    try {
      await TaskService.submitForApproval(task.id, currentUserId);
      toast.success('Đã gửi yêu cầu phê duyệt');
      setPendingChanges({});
      loadTask();
      onUpdate?.();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleApproveTask = async () => {
    if (!task || !currentUserId) return;
    setApprovalLoading(true);
    try {
      await TaskService.approveTask(task.id, currentUserId, approvalComment || undefined);
      toast.success('✅ Đã phê duyệt thành công');
      setShowApproveDialog(false);
      setApprovalComment('');
      setPendingChanges({});
      loadTask();
      onUpdate?.();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleRejectApproval = async () => {
    if (!task || !currentUserId || !rejectReason.trim()) return;
    setApprovalLoading(true);
    try {
      await TaskService.rejectApproval(task.id, currentUserId, rejectReason.trim());
      toast.success('Đã từ chối phê duyệt');
      setShowRejectDialog(false);
      setRejectReason('');
      setPendingChanges({});
      loadTask();
      onUpdate?.();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleStartTask = async () => {
    if (!task) return;
    const inProgressStatus = statuses.find(s => s.name === 'Đang tiến hành' || s.name === 'Đang thực hiện');
    if (inProgressStatus) {
      await handleImmediateUpdate('status_id', inProgressStatus.id);
      if (!task.start_date) await handleImmediateUpdate('start_date', new Date().toISOString().split('T')[0]);
    }
  };

  // Checklist handlers (save immediately — checklist is separate UX)
  const saveChecklist = async (items: ChecklistItem[]) => {
    setChecklist(items);
    if (!task) return;
    try {
      await TaskService.update(task.id, { custom_fields: { ...task.custom_fields, checklist: items } });
    } catch (err: any) {
      toast.error('Lỗi lưu checklist: ' + (err.message || err));
    }
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    saveChecklist([...checklist, { id: Date.now().toString(), text: newCheckItem.trim(), done: false }]);
    setNewCheckItem('');
  };

  const getPersonInfo = (id: string): PersonInfo => people[id] || { id, name: id.substring(0, 8) + '...' };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!task) {
    return <div className="text-center py-16 text-slate-400 dark:text-slate-500">Không tìm thấy công việc</div>;
  }

  const isDone = task.status?.is_done || statuses.find(s => s.id === task.status_id)?.is_done;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isDone;
  const currentStatus = statuses.find(s => s.id === task.status_id);
  const currentPriority = PRIORITIES.find(p => p.value === task.priority) || PRIORITIES[2];
  const isInProgress = currentStatus?.name === 'Đang tiến hành' || currentStatus?.name === 'Đang thực hiện';
  const hasPastStartDate = !!(task.start_date && task.start_date <= new Date().toISOString().split('T')[0]);
  const overdueDays = isOverdue ? Math.ceil((Date.now() - new Date(task.due_date!).getTime()) / 86400000) : 0;

  // Approval state derivations
  const hasApprovalSteps = ((task.custom_fields?.approval_steps as ApprovalStep[] | undefined)?.length ?? 0) > 0;
  const hasApprovers = task.approvers?.length > 0 || hasApprovalSteps;
  const isApprovalSubtask = !!task.approval_parent_id;
  const isPendingApproval = task.approval_status === 'pending';
  const isCurrentUserApprover = currentUserId ? task.approvers?.includes(currentUserId) : false;
  const isCurrentUserAssignee = currentUserId ? task.assignees?.includes(currentUserId) : false;
  const canSubmitForApproval = hasApprovers && !isDone && !isPendingApproval && !isApprovalSubtask;
  const canApproveOrReject = isApprovalSubtask && isPendingApproval && currentUserId && task.assignees?.includes(currentUserId);
  const checkDone = checklist.filter(i => i.done).length;
  const checkTotal = checklist.length;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* ─── Header ─── */}
      <SlidePanelHeader>
        <div className="flex items-center gap-3 w-full">
          {/* Checkbox */}
          <button
            onClick={handleToggleComplete}
            className={`w-7 h-7 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer
              ${isDone
                ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600'
                : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500'
              }`}
          >
            {isDone && <CheckSquare size={16} className="text-white" />}
          </button>

          {/* Title (editable) */}
          <div className="flex-1 min-w-0 pr-4">
            {isEditingTitle ? (
              <input
                autoFocus value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') { setEditTitle(task.title); setIsEditingTitle(false); } }}
              className="w-full text-xl font-black bg-transparent border-b-2 border-indigo-500 outline-none text-slate-900 dark:text-slate-100 pb-1"
            />
          ) : (
            <h2
              onClick={() => setIsEditingTitle(true)}
              className={`text-xl font-black cursor-text hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}
            >
              {task.title}
            </h2>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Approval subtask buttons */}
          {canApproveOrReject && (
            <>
              <button
                onClick={() => setShowApproveDialog(true)}
                disabled={approvalLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              >
                <CheckCircle2 size={14} /> PHÊ DUYỆT
              </button>
              <button
                onClick={() => setShowRejectDialog(true)}
                disabled={approvalLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              >
                <XCircle size={14} /> TỪ CHỐI
              </button>
            </>
          )}

          {/* Normal task buttons (non-approval subtask) */}
          {!isApprovalSubtask && (
            <>
              {!isDone && !isInProgress && !hasPastStartDate && !isPendingApproval && (
                <button onClick={handleStartTask} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors cursor-pointer shadow-sm">
                  <Play size={14} /> BẮT ĐẦU
                </button>
              )}

              {/* Task has approvers → show "Gửi phê duyệt" instead of "Hoàn thành" */}
              {canSubmitForApproval && (
                <button
                  onClick={handleSubmitForApproval}
                  disabled={approvalLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Send size={14} /> {approvalLoading ? 'ĐANG GỬI...' : 'GỬI PHÊ DUYỆT'}
                </button>
              )}

              {/* Task without approvers → normal complete */}
              {!hasApprovers && !isDone && (
                <button onClick={handleToggleComplete} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm">
                  <CheckCircle2 size={14} /> HOÀN THÀNH
                </button>
              )}

              {/* Pending approval badge */}
              {isPendingApproval && !isDone && (
                <span className="flex items-center gap-1.5 px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-bold rounded-lg border border-amber-200 dark:border-amber-800">
                  <Clock size={14} /> CHỜ PHÊ DUYỆT
                </span>
              )}

              {isDone && (
                <button onClick={handleToggleComplete} className="flex items-center gap-1.5 px-4 py-2 bg-slate-500 text-white text-sm font-bold rounded-lg hover:bg-slate-600 transition-colors cursor-pointer shadow-sm">
                  <RotateCcw size={14} /> MỞ LẠI
                </button>
              )}
            </>
          )}
          
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDeleteDialogOpen(true);
            }}
            className="flex items-center justify-center w-9 h-9 ml-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
            title="Xóa công việc"
          >
            <Trash2 size={16} />
          </button>
          
          {task.action_type && task.action_label && !isApprovalSubtask && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (task.action_config && typeof task.action_config === 'object' && 'url' in task.action_config) {
                  window.location.href = task.action_config.url as string;
                } else {
                  window.dispatchEvent(new CustomEvent('task-action', { 
                    detail: { 
                      task,
                      actionType: task.action_type,
                      entityId: task.source_entity_id,
                      entityType: task.source_module
                    }
                  }));
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm ml-2"
            >
              <ExternalLink size={14} /> {task.action_label}
            </button>
          )}
        </div>
        </div>
      </SlidePanelHeader>

      {/* ─── Floating save bar (when dirty) ─── */}
      {isDirty && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-emerald-50 dark:bg-emerald-900/30 border-b border-emerald-200 dark:border-emerald-800 animate-in slide-in-from-top-2 duration-200">
          <span className="text-sm text-emerald-700 dark:text-emerald-400 font-semibold">
            Bạn có thay đổi chưa lưu
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscardChanges}
              className="px-4 py-1.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      )}

      {/* ─── 2-Column Body ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ═══ LEFT COLUMN (Main Content) ═══ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Source badge */}
          {(task.source_module || task.auto_generated) && (
            <div className="flex items-center gap-2 px-5 pt-4">
              {task.source_module && (
                <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-full font-semibold">
                  {task.source_module}
                </span>
              )}
              {task.auto_generated && (
                <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full font-semibold">
                  Tự tạo
                </span>
              )}
            </div>
          )}

          {/* ─── Tab bar ─── */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 flex-shrink-0">
            {[
              { id: 'detail' as const, label: 'Chi tiết', icon: <Edit3 size={14} /> },
              { id: 'comments' as const, label: 'Trao đổi', icon: <MessageSquare size={14} /> },
              { id: 'history' as const, label: 'Lịch sử', icon: <History size={14} /> },
              { id: 'links' as const, label: 'Liên kết', icon: <Link2 size={14} /> },
              { id: 'time' as const, label: 'Thời gian', icon: <Clock size={14} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setBottomTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px cursor-pointer
                  ${bottomTab === tab.id
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Tab content (scrollable) ─── */}
          <div className="flex-1 overflow-y-auto">
            {/* CHI TIẾT */}
            {bottomTab === 'detail' && (
              <div className="p-5 space-y-5">
                {/* MÔ TẢ */}
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Mô tả</label>
                  <textarea
                    value={editDescription}
                    onChange={e => {
                      setEditDescription(e.target.value);
                      bufferChange('description', e.target.value);
                    }}
                    rows={8}
                    className="w-full text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y transition-colors min-h-[160px]"
                    placeholder="Nhấn để thêm mô tả..."
                  />
                </div>

                {/* GHI CHÚ TIẾN ĐỘ */}
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Bookmark size={12} className="text-indigo-500 dark:text-indigo-400" />
                    Ghi chú tiến độ
                  </label>
                  <textarea
                    value={editProgressNote}
                    onChange={e => {
                      setEditProgressNote(e.target.value);
                      bufferChange('custom_fields', { ...task?.custom_fields, progress_note: e.target.value });
                    }}
                    rows={2}
                    className="w-full text-sm p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/20 text-slate-900 dark:text-slate-100 placeholder-indigo-300 dark:placeholder-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y transition-colors min-h-[80px]"
                    placeholder="Ghi chú nhanh tiến độ hiện tại (VD: đã tạo file nháp, đang đợi KH xác nhận...)"
                  />
                </div>

                {/* CHECKLIST */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare size={12} />
                      Checklist {checkTotal > 0 && <span className="text-indigo-500 dark:text-indigo-400">({checkDone}/{checkTotal})</span>}
                    </label>
                    <button
                      onClick={() => setShowAddCheck(!showAddCheck)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={12} /> Thêm mục
                    </button>
                  </div>

                  {checkTotal > 0 && (
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-3 overflow-hidden">
                      <div className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-300" style={{ width: `${checkTotal > 0 ? (checkDone / checkTotal) * 100 : 0}%` }} />
                    </div>
                  )}

                  {checklist.map(item => (
                    <ChecklistRow
                      key={item.id} item={item}
                      onToggle={id => saveChecklist(checklist.map(i => i.id === id ? { ...i, done: !i.done } : i))}
                      onDelete={id => saveChecklist(checklist.filter(i => i.id !== id))}
                      onEdit={(id, text) => saveChecklist(checklist.map(i => i.id === id ? { ...i, text } : i))}
                    />
                  ))}

                  {(showAddCheck || checklist.length === 0) && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        autoFocus={showAddCheck} value={newCheckItem}
                        onChange={e => setNewCheckItem(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addCheckItem(); }}
                        placeholder="Thêm mục mới..."
                        className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button onClick={addCheckItem} disabled={!newCheckItem.trim()} className="px-3 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 cursor-pointer">
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* TAGS */}
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Tags</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {task.tags.map(tag => (
                      <span key={tag} className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Tag size={9} /> {tag}
                        <button onClick={() => bufferChange('tags', task.tags.filter(t => t !== tag))} className="ml-0.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer">
                          <X size={9} />
                        </button>
                      </span>
                    ))}
                    {task.tags.length === 0 && <span className="text-xs text-slate-400 dark:text-slate-500 italic">Chưa có tags</span>}
                    <TagInputWithAutocomplete
                      currentTags={task.tags}
                      onAdd={(newTag) => {
                        if (!task.tags.includes(newTag)) {
                          bufferChange('tags', [...task.tags, newTag]);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* TAGS CÁ NHÂN */}
                <div>
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Lock size={10} className="text-amber-500 dark:text-amber-400" />
                    Tags cá nhân
                    <span className="text-[9px] font-normal normal-case text-slate-400 dark:text-slate-500">(chỉ bạn thấy)</span>
                  </label>
                  <div className="border border-dashed border-amber-300 dark:border-amber-700 rounded-lg p-2.5 bg-amber-50/30 dark:bg-amber-900/10">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {personalTags.map(tag => (
                        <span key={tag} className="text-xs text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Lock size={8} /> {tag}
                          <button
                            onClick={async () => {
                              if (!currentUserId) return;
                              const ok = await TaskPersonalTagService.removeTag(currentUserId, taskId, tag);
                              if (ok) setPersonalTags(prev => prev.filter(t => t !== tag));
                            }}
                            className="ml-0.5 text-amber-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
                          >
                            <X size={9} />
                          </button>
                        </span>
                      ))}
                      {personalTags.length === 0 && <span className="text-[10px] text-amber-400 dark:text-amber-500 italic">Thêm tag riêng của bạn...</span>}
                      {/* Inline personal tag input */}
                      <PersonalTagInput
                        currentTags={personalTags}
                        onAdd={async (newTag) => {
                          if (!currentUserId) return;
                          const ok = await TaskPersonalTagService.addTag(currentUserId, taskId, newTag);
                          if (ok && !personalTags.includes(newTag)) {
                            setPersonalTags(prev => [...prev, newTag]);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TRAO ĐỔI */}
            {bottomTab === 'comments' && (
              <DiscussionBox
                entityType="task"
                entityId={taskId}
                className="border-0 rounded-none h-full"
                maxHeight="100%"
                showHeader={false}
              />
            )}

            {/* LỊCH SỬ */}
            {bottomTab === 'history' && (
              <HistoryTab taskId={taskId} logs={historyLogs} setLogs={setHistoryLogs} />
            )}

            {/* LIÊN KẾT */}
            {bottomTab === 'links' && (
              <div className="p-5 space-y-4">
                {/* Primary Entity Link */}
                <div className="mb-6">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Crown size={12} className="text-amber-500" />
                    Liên kết chính
                  </label>
                  {(task.source_module || task.project_id) && !isEditingPrimary ? (
                    <div className="group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all overflow-hidden shadow-sm">
                      <LinkItem 
                        link={{
                          id: 'primary',
                          task_id: task.id,
                          entity_type: task.source_module || (task.project_id ? 'project' : 'none'),
                          entity_id: task.source_entity_id || task.project_id || '',
                          entity_label: '', // will be resolved inside LinkItem
                        } as TaskLink} 
                        registryOptions={registryOptions} 
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 pl-2 rounded-l-xl">
                        <button
                          onClick={() => { 
                            setPrimaryLinkType(task.source_module || (task.project_id ? 'project' : 'none')); 
                            setIsEditingPrimary(true); 
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-md transition-colors"
                          title="Sửa liên kết"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => {
                            bufferChange('project_id', null);
                            bufferChange('source_module', null);
                            bufferChange('source_entity_id', null);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-md transition-colors"
                          title="Xóa liên kết"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ) : isEditingPrimary ? (
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cập nhật liên kết chính</label>
                        <button onClick={() => { setIsEditingPrimary(false); setPrimaryLinkType(''); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Loại liên kết</label>
                          <select
                            value={primaryLinkType}
                            onChange={e => setPrimaryLinkType(e.target.value)}
                            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-indigo-500"
                          >
                            <option value="">-- Chọn loại --</option>
                            {registryOptions.map(opt => (
                              <option key={opt.id} value={opt.id}>{opt.name}</option>
                            ))}
                          </select>
                        </div>
                        {primaryLinkType && (
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Tìm kiếm</label>
                            <SearchableSelect
                              value={null}
                              onChange={(id, opt) => {
                                if (primaryLinkType === 'project') {
                                  bufferChange('project_id', id);
                                  bufferChange('source_module', null);
                                  bufferChange('source_entity_id', null);
                                } else {
                                  bufferChange('project_id', null);
                                  bufferChange('source_module', primaryLinkType);
                                  bufferChange('source_entity_id', id);
                                }
                                setIsEditingPrimary(false);
                              }}
                              onSearch={q => EntitySearchService.search(primaryLinkType, q, profile)}
                              placeholder="Gõ để tìm thẻ thay thế..."
                              size="sm"
                              initialOptions={task.source_entity_id || task.project_id ? [{ id: task.source_entity_id || task.project_id || '', name: 'Đang chọn' }] : []}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setIsEditingPrimary(true)} className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer text-sm font-medium">
                      <Plus size={16} /> Thêm liên kết chính
                    </button>
                  )}
                </div>

                {/* Manual links */}
                {links.length > 0 && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">Liên kết khác ({links.length})</label>
                    <div className="space-y-2">
                      {links.map(link => 
                        editingLinkId === link.id ? (
                          <div key={link.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-4">
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Đổi liên kết phụ</label>
                              <button onClick={() => setEditingLinkId(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
                                <X size={14} />
                              </button>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">Bạn đang sửa liên kết trong module: <span className="font-bold uppercase text-indigo-500 dark:text-indigo-400">{registryOptions.find(o => o.id === link.entity_type)?.name || link.entity_type}</span></label>
                              </div>
                              <SearchableSelect
                                value={null}
                                onChange={async (id, opt) => {
                                  if (!id) return;
                                  try {
                                    const updated = await TaskService.updateLink(link.id, { entity_id: id, entity_label: opt?.name });
                                    setLinks(prev => prev.map(l => l.id === link.id ? { ...updated, entity_type: link.entity_type } : l));
                                    setEditingLinkId(null);
                                  } catch (err: any) {
                                    toast.error('Lỗi khi sửa liên kết: ' + err.message);
                                  }
                                }}
                                onSearch={(q) => EntitySearchService.search(link.entity_type, q, profile)}
                                placeholder={`Gõ để tìm thẻ thay thế...`}
                                size="sm"
                                initialOptions={[{ id: link.entity_id, name: link.entity_label || 'Đang chọn' }]}
                              />
                            </div>
                          </div>
                        ) : (
                          <div key={link.id} className="group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all overflow-hidden">
                            <LinkItem link={link} registryOptions={registryOptions} />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 pl-2 rounded-l-xl">
                              <button
                                onClick={() => setEditingLinkId(link.id)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-md transition-colors"
                                title="Sửa liên kết"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => TaskService.removeLink(link.id).then(() => setLinks(prev => prev.filter(l => l.id !== link.id)))}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-md transition-colors"
                                title="Xóa liên kết"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {links.length === 0 && !task.source_module && !task.project_id && (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-8 mt-4">
                    <Link2 size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Chưa có liên kết phụ nào</p>
                  </div>
                )}
                {/* Add link section */}
                {isAddingLink ? (
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Thêm liên kết mới</label>
                      <button onClick={() => { setIsAddingLink(false); setSelectedLinkType(''); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <X size={14} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Loại liên kết</label>
                        <select
                          value={selectedLinkType}
                          onChange={e => setSelectedLinkType(e.target.value)}
                          className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-indigo-500"
                        >
                          <option value="">-- Chọn loại --</option>
                          {registryOptions.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                          ))}
                        </select>
                      </div>

                      {selectedLinkType && (
                        <div>
                          <label className="text-xs text-slate-500 mb-1 block">Tìm kiếm</label>
                          <SearchableSelect
                            value={null}
                            onChange={handleCreateLink}
                            onSearch={searchEntity}
                            placeholder="Gõ để tìm..."
                            size="sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setIsAddingLink(true)} className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer text-sm font-medium">
                    <Plus size={16} /> Thêm liên kết
                  </button>
                )}
              </div>
            )}

            {/* THỜI GIAN */}
            {bottomTab === 'time' && (
              <div className="p-5">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">Dự kiến</span>
                    <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                      {task.time_estimate ? `${Math.floor(task.time_estimate / 60)}h${task.time_estimate % 60 > 0 ? ` ${task.time_estimate % 60}m` : ''}` : '—'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">Đã dùng</span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {task.time_spent > 0 ? `${Math.floor(task.time_spent / 60)}h${task.time_spent % 60 > 0 ? ` ${task.time_spent % 60}m` : ''}` : '0h'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                    <span className="text-xs text-slate-400 dark:text-slate-500 block">Số ngày</span>
                    <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                      {task.start_date && task.due_date
                        ? Math.max(0, Math.round((new Date(task.due_date).getTime() - new Date(task.start_date).getTime()) / 86400000))
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT COLUMN (Sidebar) ═══ */}
        <div className="w-72 flex-shrink-0 overflow-y-auto border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div className="p-4 space-y-4">
            {/* Overdue banner */}
            {isOverdue && (
              <div className="rounded-xl bg-red-500 dark:bg-red-600 p-3 text-white shadow-lg shadow-red-500/20">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <AlertTriangle size={16} />
                  Quá hạn {overdueDays} ngày!
                </div>
                <div className="text-xs opacity-80 mt-0.5">Deadline: {formatDate(task.due_date!)}</div>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Trạng thái</label>
              <select
                value={task.status_id || ''}
                onChange={e => bufferChange('status_id', e.target.value)}
                className="w-full text-sm font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                style={currentStatus ? { borderColor: currentStatus.color, color: currentStatus.color } : {}}
              >
                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Ưu tiên</label>
              <select
                value={task.priority}
                onChange={e => bufferChange('priority', e.target.value)}
                className={`w-full text-sm font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 ${currentPriority.bg} ${currentPriority.darkBg} ${currentPriority.color} ${currentPriority.darkColor} cursor-pointer`}
              >
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {/* Dates */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Ngày bắt đầu</label>
                <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                  <DatePickerField value={task.start_date} onChange={val => bufferChange('start_date', val)} textClassName="text-sm font-semibold text-slate-700 dark:text-slate-200" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Deadline</label>
                <div className={`px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border ${isOverdue ? 'border-red-400 dark:border-red-600' : 'border-slate-200 dark:border-slate-600'}`}>
                  <DatePickerField
                    value={task.due_date}
                    onChange={val => bufferChange('due_date', val)}
                    textClassName={`text-sm font-semibold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Số ngày dự kiến</label>
                <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center gap-1">
                  <input
                    type="number" min={0}
                    defaultValue={(() => {
                      if (task.start_date && task.due_date) {
                        const diff = Math.round((new Date(task.due_date).getTime() - new Date(task.start_date).getTime()) / 86400000);
                        return diff >= 0 ? diff : '';
                      }
                      return '';
                    })()}
                    key={`${task.start_date}-${task.due_date}`}
                    onBlur={e => {
                      const days = parseInt(e.target.value);
                      if (!isNaN(days) && days >= 0 && task.start_date) {
                        const start = new Date(task.start_date);
                        start.setDate(start.getDate() + days);
                        bufferChange('due_date', start.toISOString().split('T')[0]);
                      }
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    placeholder="—"
                    className="text-sm font-semibold text-slate-700 dark:text-slate-200 bg-transparent border-none outline-none w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">ngày</span>
                </div>
              </div>
            </div>

            {/* People */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              {/* Người giao việc */}
              {task.created_by && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Crown size={10} /> Người giao việc
                  </label>
                  <PersonBadge person={getPersonInfo(task.created_by)} />
                </div>
              )}

              {/* Người thực hiện chính (assignees) */}
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1"><User size={10} /> Người thực hiện</span>
                  <button onClick={() => setOpenPicker(openPicker === 'assignees' ? null : 'assignees')} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer" title="Thay đổi người">
                    <Edit3 size={12} />
                  </button>
                </label>
                {task.assignees?.length > 0 ? (
                  task.assignees.map(id => <PersonBadge key={id} person={getPersonInfo(id)} />)
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">Chưa phân công</span>
                )}
                {openPicker === 'assignees' && (
                  <PeoplePickerPopover
                    align="left"
                    currentIds={task.assignees || []}
                    onChange={ids => {
                      const newId = ids[ids.length - 1];
                      if (newId) {
                        // Move current assignee to supporters if being replaced
                        const oldAssignee = task.assignees?.[0];
                        const currentSupporters = (task.supporters || []).filter(id => id !== newId);
                        if (oldAssignee && oldAssignee !== newId && !currentSupporters.includes(oldAssignee)) {
                          bufferChange('supporters', [...currentSupporters, oldAssignee]);
                        } else if (currentSupporters.length !== (task.supporters || []).length) {
                          bufferChange('supporters', currentSupporters);
                        }
                        bufferChange('assignees', [newId]);
                        ensurePeopleLoaded([newId]);
                        setOpenPicker(null);
                      }
                    }}
                    onClose={() => setOpenPicker(null)}
                  />
                )}
              </div>

              {/* Người phối hợp (supporters) */}
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1 justify-between">
                  <span className="flex items-center gap-1"><Users size={10} /> Người phối hợp</span>
                  <button onClick={() => setOpenPicker(openPicker === 'supporters' ? null : 'supporters')} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer"><Plus size={12} /></button>
                </label>
                {task.supporters?.length > 0 ? (
                  task.supporters.map(id => <PersonBadge key={id} person={getPersonInfo(id)} onRemove={() => bufferChange('supporters', task.supporters.filter(x => x !== id))} />)
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">Không có</span>
                )}
                {openPicker === 'supporters' && (
                  <PeoplePickerPopover
                    align="left"
                    currentIds={task.supporters || []}
                    onChange={ids => { bufferChange('supporters', ids); ensurePeopleLoaded(ids); }}
                    onClose={() => setOpenPicker(null)}
                  />
                )}
              </div>

              {/* Người theo dõi (watchers) */}
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1 justify-between">
                  <span className="flex items-center gap-1"><Eye size={10} /> Người theo dõi</span>
                  <button onClick={() => setOpenPicker(openPicker === 'watchers' ? null : 'watchers')} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer"><Plus size={12} /></button>
                </label>
                {task.watchers?.length > 0 ? (
                  task.watchers.map(id => <PersonBadge key={id} person={getPersonInfo(id)} onRemove={() => bufferChange('watchers', task.watchers.filter(x => x !== id))} />)
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">Không có</span>
                )}
                {openPicker === 'watchers' && (
                  <PeoplePickerPopover
                    inline
                    currentIds={task.watchers || []}
                    onChange={ids => { bufferChange('watchers', ids); ensurePeopleLoaded(ids); }}
                    onClose={() => setOpenPicker(null)}
                  />
                )}
              </div>

              {/* Phê duyệt (approvers / multi-level) */}
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1 justify-between">
                  <span className="flex items-center gap-1"><ShieldCheck size={10} /> Phê duyệt</span>
                </label>

                {(() => {
                  const steps: ApprovalStep[] = task.custom_fields?.approval_steps || [];
                  const currentLevel: number | undefined = task.custom_fields?.current_approval_level;
                  const hasMultiLevel = steps.length > 0;

                  // ─── Multi-level stepper ───
                  if (hasMultiLevel) {
                    const sortedSteps = [...steps].sort((a, b) => a.level - b.level);
                    return (
                      <div className="space-y-2">
                        {sortedSteps.map((step, idx) => {
                          // Determine status of this level
                          const isActive = currentLevel === step.level;
                          const isDoneLvl = currentLevel !== undefined && step.level < currentLevel;
                          const isFuture = currentLevel !== undefined && step.level > currentLevel;
                          const isFullyDone = task.approval_status === 'approved';
                          const isRejected = task.approval_status === 'rejected';

                          let dotClass = 'bg-slate-300 dark:bg-slate-600';
                          let lineClass = 'bg-slate-200 dark:bg-slate-700';
                          if (isDoneLvl || isFullyDone) { dotClass = 'bg-emerald-500'; lineClass = 'bg-emerald-300 dark:bg-emerald-700'; }
                          else if (isActive && !isRejected) { dotClass = 'bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-800'; }
                          else if (isRejected && isActive) { dotClass = 'bg-red-500'; }

                          return (
                            <div key={step.level} className="flex gap-2">
                              {/* Stepper dot + line */}
                              <div className="flex flex-col items-center flex-shrink-0 w-4">
                                <div className={`w-3 h-3 rounded-full ${dotClass} flex items-center justify-center`}>
                                  {(isDoneLvl || isFullyDone) && <CheckCircle2 size={8} className="text-white" />}
                                </div>
                                {idx < sortedSteps.length - 1 && <div className={`w-0.5 flex-1 mt-0.5 min-h-[16px] ${lineClass}`} />}
                              </div>
                              {/* Content */}
                              <div className="flex-1 min-w-0 pb-1">
                                <div className="flex items-center gap-1">
                                  <span className={`text-[11px] font-semibold ${
                                    isDoneLvl || isFullyDone ? 'text-emerald-600 dark:text-emerald-400' :
                                    isActive && !isRejected ? 'text-amber-600 dark:text-amber-400' :
                                    isRejected && isActive ? 'text-red-600 dark:text-red-400' :
                                    'text-slate-400 dark:text-slate-500'
                                  }`}>{step.label || `Cấp ${step.level}`}</span>
                                  <span className="text-[9px] text-slate-400 dark:text-slate-500">({step.mode === 'any' ? '1 duyệt' : 'tất cả'})</span>
                                  {!isPendingApproval && (
                                    <button
                                      onClick={() => {
                                        const newSteps = steps
                                          .filter(s => s.level !== step.level)
                                          .sort((a, b) => a.level - b.level)
                                          .map((s, i) => ({ ...s, level: i + 1, label: `Cấp ${i + 1}` }));
                                        bufferChange('custom_fields', { ...task.custom_fields, approval_steps: newSteps });
                                      }}
                                      className="text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-400 cursor-pointer ml-auto"
                                    >
                                      <X size={10} />
                                    </button>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {step.approver_ids.map(id => (
                                    <span key={id} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                      {getPersonInfo(id)?.name || id.slice(0, 6)}
                                    </span>
                                  ))}
                                  {!isPendingApproval && (
                                    <button
                                      onClick={() => {
                                        setEditingStepLevel(step.level);
                                        setOpenPicker('approvers');
                                      }}
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer flex items-center gap-0.5"
                                    >
                                      <Edit3 size={8} /> sửa
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Add new level button */}
                        {!isPendingApproval && (
                          <button
                            onClick={() => {
                              const maxLevel = Math.max(0, ...steps.map(s => s.level));
                              const newStep: ApprovalStep = {
                                level: maxLevel + 1,
                                label: `Cấp ${maxLevel + 1}`,
                                approver_ids: [],
                                mode: 'all',
                              };
                              bufferChange('custom_fields', {
                                ...task.custom_fields,
                                approval_steps: [...steps, newStep],
                              });
                              setEditingStepLevel(maxLevel + 1);
                              setOpenPicker('approvers');
                            }}
                            className="flex items-center gap-1 text-[10px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer ml-6"
                          >
                            <Plus size={10} /> Thêm cấp phê duyệt
                          </button>
                        )}

                        {/* Approval status */}
                        {task.approval_status && (
                          <div className={`mt-1 text-[10px] font-semibold px-2 py-1 rounded-md inline-flex items-center gap-1 ${
                            task.approval_status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                            task.approval_status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          }`}>
                            {task.approval_status === 'pending' && <><Clock size={10} /> Đang chờ — {steps.find(s => s.level === currentLevel)?.label || `Cấp ${currentLevel}`}</>}
                            {task.approval_status === 'approved' && <><CheckCircle2 size={10} /> Đã phê duyệt</>}
                            {task.approval_status === 'rejected' && <><XCircle size={10} /> Bị từ chối</>}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // ─── Simple mode (flat approvers[]) ───
                  return (
                    <>
                      <div className="flex items-center gap-1 mb-1">
                        <button onClick={() => setOpenPicker(openPicker === 'approvers' ? null : 'approvers')} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer text-[10px] flex items-center gap-0.5">
                          <Plus size={10} /> Thêm người
                        </button>
                        <button
                          onClick={() => {
                            const newStep: ApprovalStep = {
                              level: 1,
                              label: 'Cấp 1',
                              approver_ids: task.approvers || [],
                              mode: (task.approval_mode || 'all') as ApprovalMode,
                            };
                            bufferChange('custom_fields', {
                              ...task.custom_fields,
                              approval_steps: [newStep],
                            });
                          }}
                          className="text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 cursor-pointer text-[10px] flex items-center gap-0.5 ml-2"
                          title="Chuyển sang phê duyệt nhiều cấp"
                        >
                          <ShieldCheck size={10} /> Nhiều cấp
                        </button>
                      </div>
                      {task.approvers?.length > 0 ? (
                        <>
                          {task.approvers.map(id => <PersonBadge key={id} person={getPersonInfo(id)} onRemove={() => bufferChange('approvers', task.approvers.filter(x => x !== id))} />)}
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Chế độ:</span>
                            <select
                              value={task.approval_mode || 'all'}
                              onChange={e => bufferChange('approval_mode', e.target.value as ApprovalMode)}
                              className="text-[11px] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                            >
                              <option value="all">Tất cả phải duyệt</option>
                              <option value="any">Chỉ cần 1 duyệt</option>
                            </select>
                          </div>
                          {task.approval_status && (
                            <div className={`mt-1.5 text-[10px] font-semibold px-2 py-1 rounded-md inline-flex items-center gap-1 ${
                              task.approval_status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                              task.approval_status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                              'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>
                              {task.approval_status === 'pending' && <><Clock size={10} /> Đang chờ phê duyệt</>}
                              {task.approval_status === 'approved' && <><CheckCircle2 size={10} /> Đã phê duyệt</>}
                              {task.approval_status === 'rejected' && <><XCircle size={10} /> Bị từ chối</>}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 italic">Không có</span>
                      )}
                    </>
                  );
                })()}

                {openPicker === 'approvers' && (
                  <PeoplePickerPopover
                    currentIds={(() => {
                      const steps: ApprovalStep[] = task.custom_fields?.approval_steps || [];
                      if (steps.length > 0 && editingStepLevel !== null) {
                        const targetStep = steps.find(s => s.level === editingStepLevel);
                        return targetStep?.approver_ids || [];
                      }
                      return task.approvers || [];
                    })()}
                    onChange={ids => {
                      const steps: ApprovalStep[] = task.custom_fields?.approval_steps || [];
                      if (steps.length > 0 && editingStepLevel !== null) {
                        const updated = steps.map(s =>
                          s.level === editingStepLevel ? { ...s, approver_ids: ids } : s
                        );
                        bufferChange('custom_fields', { ...task.custom_fields, approval_steps: updated });
                      } else {
                        bufferChange('approvers', ids);
                      }
                      ensurePeopleLoaded(ids);
                    }}
                    onClose={() => { setOpenPicker(null); setEditingStepLevel(null); }}
                  />
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 dark:text-slate-500">Tạo lúc</span>
                <span className="text-slate-600 dark:text-slate-400 font-semibold">{formatDateTime(task.created_at)}</span>
              </div>
              {task.completed_at && (
                <div className="flex justify-between">
                  <span className="text-emerald-500 dark:text-emerald-400">Hoàn thành</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatDateTime(task.completed_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteTask}
        title="Xóa công việc"
        message="Bạn có chắc chắn muốn xóa công việc này không? Mọi dữ liệu liên quan sẽ bị xóa vĩnh viễn."
        variant="danger"
        confirmText="Xóa"
        isLoading={saving}
      />

      {/* ─── Approve Dialog ─── */}
      {showApproveDialog && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40" onClick={() => setShowApproveDialog(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-500" /> Phê duyệt công việc
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Bạn xác nhận phê duyệt công việc này?</p>
            <textarea
              value={approvalComment}
              onChange={e => setApprovalComment(e.target.value)}
              placeholder="Ghi chú (không bắt buộc)..."
              rows={3}
              className="w-full text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowApproveDialog(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
                Hủy
              </button>
              <button
                onClick={handleApproveTask}
                disabled={approvalLoading}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={14} /> {approvalLoading ? 'Đang xử lý...' : 'Xác nhận phê duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reject Dialog ─── */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40" onClick={() => setShowRejectDialog(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <XCircle size={20} className="text-red-500" /> Từ chối phê duyệt
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Vui lòng nhập lý do từ chối.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Lý do từ chối (bắt buộc)..."
              rows={3}
              autoFocus
              className="w-full text-sm p-3 rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRejectDialog(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
                Hủy
              </button>
              <button
                onClick={handleRejectApproval}
                disabled={approvalLoading || !rejectReason.trim()}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <XCircle size={14} /> {approvalLoading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskDetailPanel;
