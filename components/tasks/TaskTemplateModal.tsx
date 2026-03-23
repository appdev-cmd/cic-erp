import React, { useState, useEffect } from 'react';
import { X, Copy, Plus, Trash2, CheckCircle2, Loader2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { TaskTemplateService, TaskTemplate } from '../../services/taskTemplateService';

interface TaskTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  onApplied: (count: number) => void;
}

export const TaskTemplateModal: React.FC<TaskTemplateModalProps> = ({ isOpen, onClose, entityType, entityId, onApplied }) => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await TaskTemplateService.getAll();
      setTemplates(data);
    } catch (err: any) {
      toast.error('Lỗi tải danh sách template: ' + (err.message || 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (templateId: string) => {
    setApplyingId(templateId);
    try {
      const count = await TaskTemplateService.applyTemplate(templateId, entityType, entityId);
      toast.success(`Đã tạo thành công ${count} công việc từ mẫu!`);
      onApplied(count);
      onClose();
    } catch (err: any) {
      toast.error('Lỗi áp dụng mẫu: ' + (err.message || 'Unknown'));
    } finally {
      setApplyingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-full flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 md:px-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <Copy size={24} className="text-indigo-600 dark:text-indigo-400" />
            Mẫu công việc
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 bg-slate-50/50 dark:bg-slate-800">
           {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={32} className="animate-spin text-slate-400" />
              </div>
           ) : templates.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                 <Copy size={32} className="mx-auto text-slate-300 dark:text-slate-500 mb-3" />
                 <p className="font-semibold text-slate-700 dark:text-slate-300">Chưa có mẫu nào được lưu</p>
                 <p className="text-sm text-slate-500 mt-1">Sử dụng tính năng lưu Mẫu ở trang quản lý Công việc để tạo các quy trình mẫu.</p>
              </div>
           ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {templates.map(tpl => (
                    <div key={tpl.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors shadow-sm cursor-default group flex flex-col">
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{tpl.name}</h3>
                            {tpl.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{tpl.description}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                                <span className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800/50 flex items-center gap-1">
                                    <CheckCircle2 size={10} /> {tpl.tasks_json?.length || 0} công việc
                                </span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-end">
                            <button
                                onClick={() => handleApply(tpl.id)}
                                disabled={applyingId === tpl.id}
                                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors ${
                                    applyingId === tpl.id
                                      ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20'
                                }`}
                            >
                                {applyingId === tpl.id ? (
                                    <><Loader2 size={14} className="animate-spin" /> Đang áp dụng...</>
                                ) : (
                                    <><Play size={14} /> Áp dụng mẫu</>
                                )}
                            </button>
                        </div>
                    </div>
                 ))}
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default TaskTemplateModal;
