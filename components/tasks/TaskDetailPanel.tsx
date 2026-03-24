import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckSquare, X, Calendar, Clock, Tag, Link2, MessageSquare,
  AlertTriangle, Pin, User, Edit3, Save, ExternalLink,
  Play, CheckCircle2, Plus, Trash2, History,
  Eye, Crown, Users, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { TaskService } from '../../services/taskService';
import { EntityRegistryService } from '../../services/entityRegistryService';
import { formatDate, formatDateTime } from '../../utils/formatters';
import DiscussionBox from '../ui/DiscussionBox';
import SearchableSelect from '../ui/SearchableSelect';
import ConfirmDialog from '../ui/ConfirmDialog';
import { DiscussionService, type Discussion } from '../../services/discussionService';
import PeoplePickerPopover from './PeoplePickerPopover';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import type { Task, TaskStatus, TaskLink, TaskPriority } from '../../types/taskTypes';
import { SlidePanelHeader } from '../ui/SlidePanelHeader';

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
const LinkItem: React.FC<{ link: TaskLink }> = ({ link }) => {
  const [resolvedUrl, setResolvedUrl] = React.useState<string | null>(link.url || null);
  React.useEffect(() => {
    if (!link.url) EntityRegistryService.resolveUrl(link.entity_type, link.entity_id).then(u => setResolvedUrl(u));
  }, [link]);

  return (
    <a
      href={resolvedUrl || '#'}
      onClick={e => { if (resolvedUrl) { e.preventDefault(); window.location.href = resolvedUrl; } }}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group cursor-pointer"
    >
      <Link2 size={14} className="text-indigo-500 dark:text-indigo-400" />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate block">
          {link.entity_label || `${link.entity_type}/${link.entity_id}`}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500 capitalize">{link.entity_type}</span>
      </div>
      <ExternalLink size={12} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
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
}

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  taskId,
  onClose,
  onUpdate,
  currentUserId,
}) => {
  const [task, setTask] = useState<Task | null>(null);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [links, setLinks] = useState<TaskLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [bottomTab, setBottomTab] = useState<'detail' | 'comments' | 'history' | 'links' | 'time'>('detail');

  // People picker popover state
  const [openPicker, setOpenPicker] = useState<'assignees' | 'supporters' | 'watchers' | 'approvers' | null>(null);

  // Add Link state
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [selectedLinkType, setSelectedLinkType] = useState<string>('');
  const [registryOptions, setRegistryOptions] = useState<{id: string; name: string}[]>([]);

  useEffect(() => {
    if (bottomTab === 'links' && isAddingLink && registryOptions.length === 0) {
      import('../../services/entityRegistryService').then(m => {
        m.EntityRegistryService.getAll().then(all => setRegistryOptions(all.map(x => ({ id: x.entity_type, name: x.label }))));
      });
    }
  }, [bottomTab, isAddingLink, registryOptions.length]);

  const searchEntity = useCallback(async (query: string) => {
    if (!selectedLinkType || query.length < 2) return [];
    try {
      const { dataClient } = await import('../../lib/dataClient');
      const { data } = await dataClient.from(selectedLinkType).select().limit(50);
      if (!data) return [];
      
      return data.filter((item: any) => {
        const text = (item.name || item.title || item.contract_name || item.full_name || item.id).toLowerCase();
        return text.includes(query.toLowerCase());
      }).map((item: any) => ({
        id: item.id,
        name: item.name || item.title || item.contract_name || item.full_name || item.id,
      }));
    } catch {
      return [];
    }
  }, [selectedLinkType]);

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

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [showAddCheck, setShowAddCheck] = useState(false);

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
      setPendingChanges({}); // reset dirty on load

      // Load checklist from custom_fields
      if (taskData?.custom_fields?.checklist) {
        setChecklist(taskData.custom_fields.checklist);
      }

      // Resolve people from employees table (full company directory)
      const ids = new Set<string>();
      if (taskData?.created_by) ids.add(taskData.created_by);
      taskData?.assignees?.forEach((id: string) => ids.add(id));
      taskData?.watchers?.forEach((id: string) => ids.add(id));
      taskData?.supporters?.forEach((id: string) => ids.add(id));
      taskData?.approvers?.forEach((id: string) => ids.add(id));

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
    if (task.approvers?.length > 0 && currentUserId && !task.approvers.includes(currentUserId) && !task.status?.is_done) {
      toast.error('Chỉ người phê duyệt mới có quyền xác nhận hoàn thành');
      return;
    }
    try {
      if (task.status?.is_done) {
        const defaultId = await TaskService.getDefaultStatusId();
        if (defaultId) {
          await TaskService.update(task.id, { status_id: defaultId, completed_at: undefined, completed_by: undefined });
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

  const handleStartTask = async () => {
    if (!task) return;
    const inProgressStatus = statuses.find(s => s.name === 'Đang tiến hành');
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
  const isInProgress = currentStatus?.name === 'Đang tiến hành';
  const overdueDays = isOverdue ? Math.ceil((Date.now() - new Date(task.due_date!).getTime()) / 86400000) : 0;
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
          {!isDone && !isInProgress && (
            <button onClick={handleStartTask} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors cursor-pointer shadow-sm">
              <Play size={14} /> BẮT ĐẦU
            </button>
          )}
          {!isDone && (
            <button onClick={handleToggleComplete} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm">
              <CheckCircle2 size={14} /> HOÀN THÀNH
            </button>
          )}
          {isDone && (
            <button onClick={handleToggleComplete} className="flex items-center gap-1.5 px-4 py-2 bg-slate-500 text-white text-sm font-bold rounded-lg hover:bg-slate-600 transition-colors cursor-pointer shadow-sm">
              <Play size={14} /> MỞ LẠI
            </button>
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
          
          {task.action_type && task.action_label && (
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
                    rows={4}
                    className="w-full text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y transition-colors"
                    placeholder="Nhấn để thêm mô tả..."
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
                  <div className="flex flex-wrap gap-2">
                    {task.tags.map(tag => (
                      <span key={tag} className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Tag size={10} /> {tag}
                        <button onClick={() => bufferChange('tags', task.tags.filter(t => t !== tag))} className="ml-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    {task.tags.length === 0 && <span className="text-xs text-slate-400 dark:text-slate-500 italic">Chưa có tags</span>}
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
                {/* Auto-generated source link */}
                {task.source_module && task.source_entity_id && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      Tự tạo từ
                    </label>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                      <Link2 size={14} className="text-indigo-500 dark:text-indigo-400" />
                      <span className="text-sm text-indigo-700 dark:text-indigo-300 font-semibold">{task.source_module}</span>
                    </div>
                  </div>
                )}

                {/* Manual links */}
                {links.length > 0 && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">Liên kết ({links.length})</label>
                    <div className="space-y-0.5 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      {links.map(link => <LinkItem key={link.id} link={link} />)}
                    </div>
                  </div>
                )}

                {links.length === 0 && !task.source_module && (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                    <Link2 size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Chưa có liên kết nào</p>
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
              {/* Người tạo */}
              {task.created_by && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Crown size={10} /> Người tạo
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
                    inline
                    currentIds={task.assignees || []}
                    onChange={ids => {
                      const newId = ids[ids.length - 1];
                      if (newId) {
                        bufferChange('assignees', [newId]);
                        // Remove from supporters if they swap identities
                        if (task.supporters?.includes(newId)) {
                          bufferChange('supporters', task.supporters.filter(id => id !== newId));
                        }
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
                    inline
                    currentIds={task.supporters || []}
                    onChange={ids => bufferChange('supporters', ids)}
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
                    onChange={ids => bufferChange('watchers', ids)}
                    onClose={() => setOpenPicker(null)}
                  />
                )}
              </div>

              {/* Người phê duyệt (approvers) */}
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1 justify-between">
                  <span className="flex items-center gap-1"><ShieldCheck size={10} /> Người phê duyệt</span>
                  <button onClick={() => setOpenPicker(openPicker === 'approvers' ? null : 'approvers')} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer"><Plus size={12} /></button>
                </label>
                {task.approvers?.length > 0 ? (
                  <>
                    {task.approvers.map(id => <PersonBadge key={id} person={getPersonInfo(id)} onRemove={() => bufferChange('approvers', task.approvers.filter(x => x !== id))} />)}
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 italic">Chỉ người phê duyệt mới xác nhận hoàn thành</p>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">Không có</span>
                )}
                {openPicker === 'approvers' && (
                  <PeoplePickerPopover
                    currentIds={task.approvers || []}
                    onChange={ids => bufferChange('approvers', ids)}
                    onClose={() => setOpenPicker(null)}
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
    </div>
  );
};

export default TaskDetailPanel;
