import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, FileText, CheckCircle2, Loader2, GripVertical, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { TaskTemplateService, TaskTemplate, TemplateTaskItem } from '../../services/taskTemplateService';
import type { TaskPriority } from '../../types/taskTypes';
import { formatDate } from '../../utils/formatters';

interface TaskTemplateManagerPanelProps {
  onClose: () => void;
}

const emptyTask: TemplateTaskItem = {
    id: '', 
    title: '', 
    description: '', 
    duration_days: 1, 
    priority: 'medium', 
    status_type: 'todo' 
};

import { SlidePanelHeader } from '../ui/SlidePanelHeader';

export const TaskTemplateManagerPanel: React.FC<TaskTemplateManagerPanelProps> = ({ onClose }) => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTasks, setEditTasks] = useState<TemplateTaskItem[]>([]);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await TaskTemplateService.getAll();
      setTemplates(data);
    } catch (err: any) {
      toast.error('Lỗi tải danh sách mẫu: ' + (err.message || 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  const handleStartCreate = () => {
      setEditName('');
      setEditDesc('');
      setEditTasks([{ ...emptyTask, id: Date.now().toString() }]);
      setIsEditing(true);
  };

  const handleSave = async () => {
      if (!editName.trim()) return toast.error('Vui lòng nhập tên mẫu');
      if (editTasks.length === 0) return toast.error('Vui lòng thêm ít nhất 1 công việc');
      
      for (const t of editTasks) {
          if (!t.title.trim()) return toast.error('Tên công việc không được để trống');
      }

      try {
          await TaskTemplateService.create({
              name: editName.trim(),
              description: editDesc.trim(),
              tasks_json: editTasks
          });
          toast.success('Lưu mẫu thành công');
          setIsEditing(false);
          loadTemplates();
      } catch (err: any) {
          toast.error('Lỗi lưu mẫu: ' + (err.message || 'Unknown'));
      }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('Bạn có chắc chắn muốn xoá mẫu này?')) return;
      try {
          await TaskTemplateService.delete(id);
          toast.success('Xoá mẫu thành công');
          loadTemplates();
      } catch (err: any) {
          toast.error('Lỗi xoá mẫu: ' + (err.message || 'Unknown'));
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <SlidePanelHeader>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
            Quản lý Template
          </h2>
          <p className="text-xs text-slate-500 mt-1">Quản lý các mẫu công việc tái sử dụng</p>
        </div>
        {!isEditing && (
            <button
                onClick={handleStartCreate}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5"
            >
                <Plus size={16} /> Tạo mẫu mới
            </button>
        )}
      </SlidePanelHeader>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
         {isEditing ? (
             <div className="max-w-3xl mx-auto space-y-6">
                 {/* Template Info */}
                 <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                     <div>
                         <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tên mẫu <span className="text-red-500">*</span></label>
                         <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="VD: Quy trình Onboarding nhân sự mới" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors" />
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mô tả (tuỳ chọn)</label>
                         <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Mô tả ngắn gọn mục đích sử dụng mẫu này..." className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors resize-none h-16" />
                     </div>
                 </div>

                 {/* Task List */}
                 <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200">Danh sách công việc mẫu ({editTasks.length})</h3>
                        <button onClick={() => setEditTasks([...editTasks, { ...emptyTask, id: Date.now().toString() }])} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded transition-colors flex items-center gap-1">
                            <Plus size={14} /> Thêm việc
                        </button>
                     </div>

                     <div className="space-y-3">
                         {editTasks.map((task, index) => (
                             <div key={task.id} className="group flex gap-3 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-lg relative">
                                 <div className="pt-2 text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing"><GripVertical size={16} /></div>
                                 <div className="flex-1 space-y-3">
                                     <input type="text" value={task.title} onChange={e => { const newTasks = [...editTasks]; newTasks[index].title = e.target.value; setEditTasks(newTasks); }} placeholder="Tên công việc..." className="w-full bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none text-sm font-semibold pb-1" />
                                     
                                     <div className="flex flex-wrap gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-slate-500">Mặc định:</span>
                                            <select value={task.status_type} onChange={e => { const newTasks = [...editTasks]; newTasks[index].status_type = e.target.value as any; setEditTasks(newTasks); }} className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 outline-none font-semibold">
                                                <option value="todo">Cần làm</option>
                                                <option value="in_progress">Đang thực hiện</option>
                                                <option value="done">Hoàn thành</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-slate-500">Ưu tiên:</span>
                                            <select value={task.priority} onChange={e => { const newTasks = [...editTasks]; newTasks[index].priority = e.target.value as TaskPriority; setEditTasks(newTasks); }} className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 outline-none font-semibold">
                                                <option value="urgent">Khẩn cấp</option>
                                                <option value="high">Cao</option>
                                                <option value="medium">TB</option>
                                                <option value="low">Thấp</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] text-slate-500">Thời gian:</span>
                                            <div className="flex items-center">
                                                <input type="number" min="0" value={task.duration_days} onChange={e => { const newTasks = [...editTasks]; newTasks[index].duration_days = parseInt(e.target.value) || 0; setEditTasks(newTasks); }} className="w-12 text-center text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 outline-none font-semibold" />
                                                <span className="text-[11px] ml-1 text-slate-500">ngày</span>
                                            </div>
                                        </div>
                                     </div>
                                 </div>
                                 <button onClick={() => setEditTasks(editTasks.filter((_, i) => i !== index))} className="absolute right-2 top-2 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all">
                                     <Trash2 size={14} />
                                 </button>
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
         ) : loading ? (
             <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-slate-400" /></div>
         ) : templates.length === 0 ? (
             <div className="max-w-md mx-auto mt-20 text-center">
                 <div className="w-16 h-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                     <FileText size={24} className="text-slate-400" />
                 </div>
                 <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Chưa có Template nào</h3>
                 <p className="text-sm text-slate-500">Tạo mẫu công việc để tiết kiệm thời gian thiết lập cho các quy trình lặp lại, ví dụ như Onboarding, Triển khai hợp đồng chuẩn...</p>
                 <button onClick={handleStartCreate} className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition mx-auto flex items-center gap-2 shadow-sm shadow-indigo-600/20">
                    <Plus size={16} /> Bắt đầu tạo mẫu
                 </button>
             </div>
         ) : (
             <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
                 {templates.map(tpl => (
                     <div key={tpl.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative group">
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => handleDelete(tpl.id, e)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Xoá mẫu">
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 pr-16">{tpl.name}</h3>
                        {tpl.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{tpl.description}</p>}
                        
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap gap-2">
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle2 size={12} className="text-emerald-500" />
                                {tpl.tasks_json?.length || 0} tasks
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400 px-2 py-1 flex items-center gap-1">
                                <AlertCircle size={12} />
                                Ngày tạo: {formatDate(tpl.created_at)}
                            </span>
                        </div>
                     </div>
                 ))}
             </div>
         )}
      </div>

      {/* Footer (if editing) */}
      {isEditing && (
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
              <button disabled={loading} onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition border border-transparent">
                  Hủy
              </button>
              <button disabled={loading} onClick={handleSave} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 flex items-center gap-2 transition disabled:opacity-70">
                 {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                 Lưu Mẫu
              </button>
          </div>
      )}
    </div>
  );
};

export default TaskTemplateManagerPanel;

