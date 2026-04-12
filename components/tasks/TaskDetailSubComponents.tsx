/**
 * TaskDetailPanel — Extracted Sub-Components
 * 
 * Small, self-contained UI primitives used inside TaskDetailPanel.
 * Extracted to reduce file size without changing any logic.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckSquare, Calendar, Tag, Link2, X, Trash2, History, Lock,
  FileText, Briefcase, Users, Building
} from 'lucide-react';
import { EntityRegistryService } from '../../services/entityRegistryService';
import { formatDateTime } from '../../utils/formatters';
import { DiscussionService, type Discussion } from '../../services/discussionService';
import type { TaskLink } from '../../types/taskTypes';
import { useOpenEntityPanel } from '../LazyPages';

// ═══════════════════════════════════════
// DATE PICKER FIELD
// ═══════════════════════════════════════
export const DatePickerField: React.FC<{
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
export const LinkItem: React.FC<{ link: TaskLink; registryOptions?: { id: string; name: string; }[] }> = ({ link, registryOptions }) => {
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
export interface PersonInfo { id: string; name: string; position?: string; avatar?: string; }

export const PersonBadge: React.FC<{ person: PersonInfo; onRemove?: () => void }> = ({ person, onRemove }) => (
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
export const TagInputWithAutocomplete: React.FC<{
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
export const PersonalTagInput: React.FC<{
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
export interface ChecklistItem { id: string; text: string; done: boolean; }

export const ChecklistRow: React.FC<{
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
export const HistoryTab: React.FC<{
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
// PRIORITY CONFIG (shared constant)
// ═══════════════════════════════════════
export type { TaskLink };
export const PRIORITIES: { value: string; label: string; color: string; darkColor: string; bg: string; darkBg: string }[] = [
  { value: 'urgent', label: 'Khẩn cấp', color: 'text-red-600', darkColor: 'dark:text-red-400', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/20' },
  { value: 'high', label: 'Cao', color: 'text-orange-600', darkColor: 'dark:text-orange-400', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-900/20' },
  { value: 'medium', label: 'Trung bình', color: 'text-blue-600', darkColor: 'dark:text-blue-400', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20' },
  { value: 'low', label: 'Thấp', color: 'text-slate-500', darkColor: 'dark:text-slate-400', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-800' },
  { value: 'none', label: 'Không', color: 'text-slate-400', darkColor: 'dark:text-slate-500', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-800' },
];
