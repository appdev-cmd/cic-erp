import React, { useState, useEffect } from 'react';
import { Calendar, AlignLeft, Tag, CheckSquare, X, ShieldCheck, Edit3, Plus, Trash2, Users, Eye, User } from 'lucide-react';
import { toast } from 'sonner';
import { TaskService } from '../../services/taskService';
import type { CreateTaskInput, TaskPriority } from '../../types/taskTypes';
import DateInput from '../ui/DateInput';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import { SlidePanelHeader } from '../ui/SlidePanelHeader';
import MentionPeopleInput from './MentionPeopleInput';
import MentionLinksInput, { type LinkedEntity } from './MentionLinksInput';
import { dataClient } from '../../lib/dataClient';

interface ChecklistItem { id: string; text: string; done: boolean; }

interface CreateTaskPanelProps {
  onTaskCreated: () => void;
  onClose?: () => void;
  currentUserId: string;
  initialData?: Partial<CreateTaskInput>;
  profile?: any;
}

const PRIORITIES: { label: string; value: TaskPriority }[] = [
  { label: '🔴 Khẩn cấp', value: 'urgent' },
  { label: '🟠 Cao',       value: 'high' },
  { label: '🔵 Trung bình', value: 'medium' },
  { label: '⚪ Thấp',      value: 'low' },
];

const CreateTaskPanel: React.FC<CreateTaskPanelProps> = ({
  onTaskCreated, onClose, currentUserId, initialData, profile
}) => {
  const [title, setTitle]         = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority]   = useState<TaskPriority>('medium');
  const [dueDate, setDueDate]     = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');

  // People
  const [assignees,  setAssignees]  = useState<string[]>([currentUserId]);
  const [supporters, setSupporters] = useState<string[]>([]);
  const [watchers,   setWatchers]   = useState<string[]>([]);
  const [approvers,  setApprovers]  = useState<string[]>([]);

  // Tags
  const [tags, setTags]       = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  // Links (multi)
  const buildPrimaryLink = (): LinkedEntity | null => {
    if (initialData?.source_entity_id && initialData?.source_module) {
      return {
        entityType: initialData.source_module,
        entityId: initialData.source_entity_id,
        label: '',
        typeLabel: initialData.source_module,
      };
    }
    if (initialData?.project_id) {
      return {
        entityType: 'project',
        entityId: initialData.project_id,
        label: '',
        typeLabel: 'Dự án',
      };
    }
    return null;
  };
  const primaryLink = buildPrimaryLink();
  const [links, setLinks] = useState<LinkedEntity[]>([]);

  const [saving, setSaving] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const { lockPanel, unlockPanel, setOnCloseBlocked, forceClosePanel } = useSlidePanel();

  const hasUnsavedChanges =
    title.trim() !== '' || description.trim() !== '' || dueDate !== '' ||
    assignees[0] !== currentUserId || supporters.length > 0 ||
    checklist.length > 0 || newCheckItem.trim() !== '' || tags.length > 0 ||
    links.length > 0;

  useEffect(() => {
    if (hasUnsavedChanges && !saving) {
      lockPanel();
      setOnCloseBlocked(undefined, () => setShowCloseConfirm(true));
    } else {
      unlockPanel();
      setOnCloseBlocked(undefined, null);
    }
  }, [hasUnsavedChanges, saving]);

  // Tag autocomplete
  useEffect(() => {
    if (!tagInput.trim()) { setTagSuggestions([]); return; }
    const load = async () => {
      const { data } = await dataClient.from('tasks').select('tags').not('tags', 'is', null).limit(200);
      if (data) {
        const allTags = new Set<string>();
        data.forEach((row: any) => { if (Array.isArray(row.tags)) row.tags.forEach((t: string) => allTags.add(t)); });
        setTagSuggestions(
          Array.from(allTags)
            .filter(t => t.toLowerCase().includes(tagInput.toLowerCase()) && !tags.includes(t))
            .slice(0, 8)
        );
      }
    };
    load();
  }, [tagInput]);

  const addTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (cleaned && !tags.includes(cleaned)) setTags(prev => [...prev, cleaned]);
    setTagInput('');
    setShowTagSuggestions(false);
  };
  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Vui lòng nhập tiêu đề công việc'); return; }
    setSaving(true);
    try {
      // Primary link: use first link if no initialData primary
      const firstLink = links[0];
      const projectId = primaryLink?.entityType === 'project'
        ? primaryLink.entityId
        : firstLink?.entityType === 'project' ? firstLink.entityId : undefined;
      const sourceModule = primaryLink?.entityType && primaryLink.entityType !== 'project'
        ? primaryLink.entityType
        : firstLink && firstLink.entityType !== 'project' ? firstLink.entityType : undefined;
      const sourceEntityId = primaryLink?.entityType && primaryLink.entityType !== 'project'
        ? primaryLink.entityId
        : firstLink && firstLink.entityType !== 'project' ? firstLink.entityId : undefined;

      await TaskService.create({
        ...initialData,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate || undefined,
        assignees,
        supporters,
        watchers,
        approvers,
        tags,
        created_by: currentUserId,
        project_id: projectId,
        source_module: sourceModule,
        source_entity_id: sourceEntityId,
        custom_fields: checklist.length > 0
          ? { ...initialData?.custom_fields, checklist }
          : initialData?.custom_fields,
      });

      toast.success('Đã tạo công việc thành công');
      onTaskCreated();
      forceClosePanel();
      if (onClose) onClose();
    } catch (err: any) {
      toast.error('Lỗi khi tạo công việc: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <SlidePanelHeader>
        <div className="flex-1 min-w-0 pr-4">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !saving && title.trim() && handleSubmit()}
            placeholder="Nhập tiêu đề công việc..."
            className="w-full text-2xl font-black bg-transparent border-0 border-b-2 border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-0 px-0 py-1 outline-none transition-colors text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600"
          />
        </div>
      </SlidePanelHeader>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 flex flex-col">

        {/* ── Row 1: Priority + Deadline */}
        <div className="grid grid-cols-2 gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">Ưu tiên</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">Deadline</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
              <DateInput
                value={dueDate}
                onChange={setDueDate}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>
        </div>

        {/* ── Row 2: People (4 roles) — @mention inline */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <MentionPeopleInput
              label="Người thực hiện"
              icon={<User size={9} className="mr-0.5" />}
              selectedIds={assignees}
              onChange={ids => {
                const selected = ids.length > 0 ? [ids[ids.length - 1]] : [];
                setAssignees(selected);
                if (selected[0] && supporters.includes(selected[0])) setSupporters(prev => prev.filter(x => x !== selected[0]));
              }}
              singleSelect
              placeholder="Tìm người thực hiện..."
            />
            <MentionPeopleInput
              label="Người phối hợp"
              icon={<Users size={9} className="mr-0.5" />}
              selectedIds={supporters}
              onChange={ids => setSupporters(ids.filter(id => !assignees.includes(id)))}
              excludeIds={assignees}
              placeholder="Thêm người phối hợp..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MentionPeopleInput
              label="Người theo dõi"
              icon={<Eye size={9} className="mr-0.5" />}
              selectedIds={watchers}
              onChange={setWatchers}
              placeholder="Thêm người theo dõi..."
            />
            <MentionPeopleInput
              label="Người phê duyệt"
              icon={<ShieldCheck size={9} className="mr-0.5" />}
              selectedIds={approvers}
              onChange={setApprovers}
              placeholder="Không cần phê duyệt..."
            />
          </div>
        </div>

        {/* ── Row 3: Links + Tags */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          {/* Multi-link @mention */}
          <MentionLinksInput
            links={links}
            onChange={setLinks}
            disabled={!!(initialData?.source_entity_id || initialData?.project_id)}
            primaryLink={primaryLink}
            profile={profile}
          />

          {/* Tags */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Tag size={10} /> Tags
            </label>
            <div className="relative">
              <div className="flex flex-wrap gap-1.5 min-h-[38px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 transition-all">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-semibold">
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-500 cursor-pointer transition-colors"><X size={10} /></button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                  onFocus={() => setShowTagSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ',' || e.key === ' ') && tagInput.trim()) { e.preventDefault(); addTag(tagInput); }
                    if (e.key === 'Backspace' && !tagInput && tags.length > 0) removeTag(tags[tags.length - 1]);
                  }}
                  placeholder={tags.length === 0 ? 'Nhập tag rồi Enter...' : ''}
                  className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>
              {showTagSuggestions && tagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                  {tagSuggestions.map(s => (
                    <button key={s} onMouseDown={() => addTag(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer transition-colors">
                      <Tag size={12} className="text-indigo-400" /> #{s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Description */}
        <div className="flex-1 flex flex-col min-h-[180px]">
          <label className="flex-shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlignLeft size={12} /> Mô tả công việc
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Nhập chi tiết về yêu cầu công việc..."
            className="w-full flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 leading-relaxed shadow-sm"
          />
        </div>

        {/* ── Checklist */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <CheckSquare size={12} /> Checklist
          </label>
          {checklist.length > 0 && (
            <div className="space-y-2 mb-3">
              {checklist.map(item => (
                <div key={item.id} className="flex items-center gap-2 group py-1">
                  <button
                    type="button"
                    onClick={() => setChecklist(prev => prev.map(x => x.id === item.id ? { ...x, done: !x.done } : x))}
                    className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer ${item.done ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'}`}
                  >
                    {item.done && <CheckSquare size={12} className="text-white" />}
                  </button>
                  <input
                    value={item.text}
                    onChange={e => setChecklist(prev => prev.map(x => x.id === item.id ? { ...x, text: e.target.value } : x))}
                    className={`flex-1 text-sm bg-transparent border-none outline-none px-0 py-0.5 ${item.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}
                  />
                  <button type="button" onClick={() => setChecklist(prev => prev.filter(x => x.id !== item.id))} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all cursor-pointer p-1">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center text-slate-300 dark:text-slate-600"><Plus size={14} /></div>
            <input
              type="text"
              value={newCheckItem}
              onChange={e => setNewCheckItem(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newCheckItem.trim()) {
                  e.preventDefault();
                  setChecklist(prev => [...prev, { id: Date.now().toString(), text: newCheckItem.trim(), done: false }]);
                  setNewCheckItem('');
                }
              }}
              placeholder="Thêm mục con... (nhấn Enter để thêm)"
              className="flex-1 text-sm bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500"
            />
            {newCheckItem.trim() && (
              <button type="button" onClick={() => { setChecklist(prev => [...prev, { id: Date.now().toString(), text: newCheckItem.trim(), done: false }]); setNewCheckItem(''); }} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer">Thêm</button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
        <button
          onClick={() => { if (hasUnsavedChanges) setShowCloseConfirm(true); else { forceClosePanel(); if (onClose) onClose(); } }}
          className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          Hủy bỏ
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
          className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-900/20 active:scale-95 flex items-center gap-2 cursor-pointer"
        >
          {saving ? 'Đang tạo...' : 'Tạo công việc'}
        </button>
      </div>

      <ConfirmDialog
        isOpen={showCloseConfirm}
        title="Hủy tạo công việc?"
        message="Các thông tin bạn vừa nhập sẽ bị mất và không thể khôi phục."
        confirmText="Đồng ý hủy"
        cancelText="Tiếp tục nhập"
        variant="danger"
        onConfirm={() => { forceClosePanel(); if (onClose) onClose(); }}
        onClose={() => setShowCloseConfirm(false)}
      />
    </div>
  );
};

export default CreateTaskPanel;
