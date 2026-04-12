import React, { useState } from 'react';
import { Bookmark, CheckSquare, Plus, Tag, X, Lock } from 'lucide-react';
import { TagInputWithAutocomplete, PersonalTagInput, ChecklistRow, type ChecklistItem } from '../TaskDetailSubComponents';
import type { Task } from '../../../types/taskTypes';
import { TaskPersonalTagService } from '../../../services/taskPersonalTagService';

interface TaskInfoTabProps {
  task: Task;
  taskId: string;
  currentUserId?: string;
  editDescription: string;
  setEditDescription: (val: string) => void;
  editProgressNote: string;
  setEditProgressNote: (val: string) => void;
  bufferChange: (field: string, value: any) => void;
  checklist: ChecklistItem[];
  saveChecklist: (items: ChecklistItem[]) => void;
  personalTags: string[];
  setPersonalTags: React.Dispatch<React.SetStateAction<string[]>>;
}

export const TaskInfoTab: React.FC<TaskInfoTabProps> = ({
  task,
  taskId,
  currentUserId,
  editDescription,
  setEditDescription,
  editProgressNote,
  setEditProgressNote,
  bufferChange,
  checklist,
  saveChecklist,
  personalTags,
  setPersonalTags,
}) => {
  const [showAddCheck, setShowAddCheck] = useState(false);
  const [newCheckItem, setNewCheckItem] = useState('');

  const checkDone = checklist.filter(i => i.done).length;
  const checkTotal = checklist.length;

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    saveChecklist([...checklist, { id: Date.now().toString(), text: newCheckItem.trim(), done: false }]);
    setNewCheckItem('');
  };

  return (
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
          
          <div className="ml-1">
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
  );
};
