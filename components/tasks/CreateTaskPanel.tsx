import React, { useState, useEffect } from 'react';
import { Calendar, AlignLeft, User, Tag, CheckSquare, X, Users, Eye, ShieldCheck, Edit3, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { TaskService } from '../../services/taskService';
import { dataClient } from '../../lib/dataClient';
import type { CreateTaskInput, TaskStatus, TaskPriority } from '../../types/taskTypes';
import PeoplePickerPopover from './PeoplePickerPopover';
import DateInput from '../ui/DateInput';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import { SlidePanelHeader } from '../ui/SlidePanelHeader';

interface CreateTaskPanelProps {
  onTaskCreated: () => void;
  onClose?: () => void;
  currentUserId: string;
  initialData?: Partial<CreateTaskInput>;
}

const PRIORITIES: { label: string; value: TaskPriority; color: string; bg: string }[] = [
  { label: '🔴 Khẩn cấp', value: 'urgent', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  { label: '🟠 Cao', value: 'high', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { label: '🔵 Trung bình', value: 'medium', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { label: '⚪ Thấp', value: 'low', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' },
];

const CreateTaskPanel: React.FC<CreateTaskPanelProps> = ({ onTaskCreated, onClose, currentUserId, initialData }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignees, setAssignees] = useState<string[]>([currentUserId]);
  const [assigneeProfiles, setAssigneeProfiles] = useState<{id: string, name: string, avatar: string}[]>([]);
  const [supporters, setSupporters] = useState<string[]>([]);
  const [supporterProfiles, setSupporterProfiles] = useState<{id: string, name: string, avatar: string}[]>([]);
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState<string>(initialData?.project_id || '');
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);
  
  const [openPicker, setOpenPicker] = useState<'assignees' | 'supporters' | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  
  const { lockPanel, unlockPanel, setOnCloseBlocked, forceClosePanel } = useSlidePanel();

  const hasUnsavedChanges = title.trim() !== '' || description.trim() !== '' || dueDate !== '' || assignees[0] !== currentUserId || supporters.length > 0;

  // Load projects list
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { data } = await dataClient.from('projects').select('id, name').order('name');
        if (data) setProjects(data.map((p: any) => ({ id: p.id, name: p.name })));
      } catch { /* ignore */ }
    };
    loadProjects();
  }, []);

  useEffect(() => {
    if (hasUnsavedChanges && !saving) {
      lockPanel();
      setOnCloseBlocked(undefined, () => setShowCloseConfirm(true));
    } else {
      unlockPanel();
      setOnCloseBlocked(undefined, null);
    }
  }, [hasUnsavedChanges, saving, lockPanel, unlockPanel, setOnCloseBlocked]);

  useEffect(() => {
    const allIds = Array.from(new Set([...assignees, ...supporters]));
    if (allIds.length === 0) {
      setAssigneeProfiles([]);
      setSupporterProfiles([]);
      return;
    }
    const loadProfiles = async () => {
      const { data } = await dataClient.from('profiles').select('id, full_name, avatar_url').in('id', allIds);
      if (data) {
        const mapped = data.map(p => ({ id: p.id, name: p.full_name || '...', avatar: p.avatar_url }));
        setAssigneeProfiles(mapped.filter(p => assignees.includes(p.id)));
        setSupporterProfiles(mapped.filter(p => supporters.includes(p.id)));
      }
    };
    loadProfiles();
  }, [assignees, supporters]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề công việc');
      return;
    }

    setSaving(true);
    try {
      await TaskService.create({
        ...initialData,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date: dueDate || undefined,
        assignees,
        supporters,
        created_by: currentUserId,
        project_id: projectId || undefined,
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
            placeholder="Nhập tiêu đề công việc..."
            className="w-full text-2xl font-black bg-transparent border-0 border-b-2 border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-500 focus:ring-0 px-0 py-1 outline-none transition-colors text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600"
          />
        </div>
      </SlidePanelHeader>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Thông tin cơ bản */}
        <div className="grid grid-cols-2 gap-6 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">Ưu tiên</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">Deadline</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
              <DateInput
                value={dueDate}
                onChange={setDueDate}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>
          
          {/* Dự án */}
          <div className="col-span-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">Dự án BIM</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              disabled={!!initialData?.project_id}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
            >
              <option value="">— Không gắn dự án —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <div className="col-span-2 grid grid-cols-2 gap-6 relative">
            {/* Người thực hiện (Assignee) */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Người thực hiện</span>
                  <button
                    onClick={() => setOpenPicker(openPicker === 'assignees' ? null : 'assignees')}
                    className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer transition-colors"
                    title="Thay đổi người"
                  >
                    <Edit3 size={12} />
                  </button>
                </label>

                {/* Display selected assignees */}
                {assignees.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {assignees.map(id => {
                      const p = assigneeProfiles.find(x => x.id === id);
                      if (!p) return null;
                      return (
                        <div key={p.id} className="flex items-center gap-1.5 pl-1 pr-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden flex-shrink-0">
                            {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : p.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{p.name}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic mt-1">Chưa chọn...</div>
                )}

                {openPicker === 'assignees' && (
                  <div className="absolute top-1/2 left-0 mt-4 z-50 w-full min-w-[280px]">
                    <PeoplePickerPopover
                      currentIds={assignees}
                      onChange={ids => {
                        // Only allow 1 assignee
                        const selected = ids.length > 0 ? [ids[ids.length - 1]] : [];
                        setAssignees(selected);
                        // Remove from supporters if present
                        if (selected[0] && supporters.includes(selected[0])) {
                           setSupporters(prev => prev.filter(id => id !== selected[0]));
                        }
                      }}
                      onClose={() => setOpenPicker(null)}
                      align="left"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Người phối hợp (Supporters) */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Người phối hợp</span>
                  <button
                    onClick={() => setOpenPicker(openPicker === 'supporters' ? null : 'supporters')}
                    className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer transition-colors"
                    title="Thêm người phối hợp"
                  >
                    <Plus size={12} />
                  </button>
                </label>

                {/* Display selected supporters */}
                {supporterProfiles.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {supporterProfiles.map(p => (
                      <div key={p.id} className="flex items-center gap-1.5 pl-1 pr-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden flex-shrink-0">
                          {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : p.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{p.name}</span>
                        <button onClick={() => setSupporters(prev => prev.filter(x => x !== p.id))} className="text-slate-400 hover:text-red-500 cursor-pointer ml-0.5 p-0.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors flex-shrink-0">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic mt-1">Không có</div>
                )}

                {openPicker === 'supporters' && (
                  <div className="absolute top-1/2 right-0 lg:left-0 lg:right-auto mt-4 z-50 w-full min-w-[280px]">
                    <PeoplePickerPopover
                      currentIds={supporters}
                      onChange={ids => {
                        // Prevent assignee from being added to supporters
                        setSupporters(ids.filter(id => !assignees.includes(id)));
                      }}
                      onClose={() => setOpenPicker(null)}
                      align="left"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mô tả chi tiết */}
        <div>
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><AlignLeft size={12} /> Mô tả công việc</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Nhập chi tiết về yêu cầu công việc..."
            className="w-full h-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 leading-relaxed shadow-sm"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
        <button
          onClick={() => {
            if (hasUnsavedChanges) setShowCloseConfirm(true);
            else { forceClosePanel(); if (onClose) onClose(); }
          }}
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
         onConfirm={() => {
            forceClosePanel();
            if (onClose) onClose();
         }}
         onClose={() => setShowCloseConfirm(false)}
       />
    </div>
  );
};

export default CreateTaskPanel;
