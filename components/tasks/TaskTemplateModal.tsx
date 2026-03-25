import React, { useState, useEffect } from 'react';
import { X, Copy, Loader2, Play, CheckCircle2, ArrowRight, User, Crown, Users } from 'lucide-react';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, entityType]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      // Lọc template theo entity type
      const data = entityType
        ? await TaskTemplateService.getByEntityType(entityType)
        : await TaskTemplateService.getAll();
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

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'creator': return { label: 'Người giao việc', icon: <User size={10} className="text-blue-500 dark:text-blue-400" /> };
      case 'unit_leader': return { label: 'Trưởng ĐV', icon: <Crown size={10} className="text-amber-500 dark:text-amber-400" /> };
      case 'specific': return { label: 'Chỉ định', icon: <Users size={10} className="text-purple-500 dark:text-purple-400" /> };
      default: return null;
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
            className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
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
                 <p className="font-semibold text-slate-700 dark:text-slate-300">Chưa có mẫu phù hợp</p>
                 <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sử dụng tính năng quản lý Template ở trang Công việc để tạo các quy trình mẫu.</p>
              </div>
           ) : (
              <div className="space-y-3">
                 {templates.map(tpl => {
                   const isExpanded = expandedId === tpl.id;
                   const hasDependencies = tpl.tasks_json?.some(t => t.depends_on);
                   
                   return (
                     <div key={tpl.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors shadow-sm overflow-hidden">
                       <div className="p-4">
                         <div className="flex items-start justify-between gap-3">
                           <div className="flex-1 min-w-0">
                             <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{tpl.name}</h3>
                             {tpl.description && (
                               <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{tpl.description}</p>
                             )}
                             <div className="flex flex-wrap gap-1.5">
                               <span className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800/50 flex items-center gap-1">
                                 <CheckCircle2 size={10} /> {tpl.tasks_json?.length || 0} công việc
                               </span>
                               {hasDependencies && (
                                 <span className="text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-800/50 flex items-center gap-1">
                                   <ArrowRight size={10} /> Có phụ thuộc
                                 </span>
                               )}
                               {tpl.applicable_entity_types.length > 0 && (
                                 tpl.applicable_entity_types.map(et => (
                                   <span key={et} className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                     {et}
                                   </span>
                                 ))
                               )}
                             </div>
                           </div>

                           <button
                             onClick={() => handleApply(tpl.id)}
                             disabled={applyingId === tpl.id}
                             className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors flex-shrink-0 cursor-pointer ${
                               applyingId === tpl.id
                                 ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                 : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20'
                             }`}
                           >
                             {applyingId === tpl.id ? (
                               <><Loader2 size={14} className="animate-spin" /> Đang áp dụng...</>
                             ) : (
                               <><Play size={14} /> Áp dụng</>
                             )}
                           </button>
                         </div>

                         {/* Expand/collapse task preview */}
                         {tpl.tasks_json?.length > 0 && (
                           <button
                             onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                             className="mt-3 text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer hover:underline"
                           >
                             {isExpanded ? '▲ Ẩn chi tiết' : '▼ Xem danh sách công việc'}
                           </button>
                         )}
                       </div>

                       {/* Expanded task list preview */}
                       {isExpanded && tpl.tasks_json?.length > 0 && (
                         <div className="border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50 px-4 py-3">
                           <div className="space-y-1.5">
                             {[...tpl.tasks_json].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((t, i) => {
                               const roleInfo = getRoleLabel(t.assignee_role);
                               const depTask = t.depends_on ? tpl.tasks_json.find(x => x.id === t.depends_on) : null;
                               return (
                                 <div key={t.id} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg hover:bg-white dark:hover:bg-slate-700/50 transition-colors">
                                   <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 w-5 text-center">{i + 1}</span>
                                   <span className="font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{t.title}</span>
                                   {roleInfo && (
                                     <span className="flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                       {roleInfo.icon} {roleInfo.label}
                                     </span>
                                   )}
                                   <span className="text-[10px] text-slate-400 dark:text-slate-500">{t.duration_days}d</span>
                                   {depTask && (
                                     <span className="text-[10px] text-amber-500 dark:text-amber-400 flex items-center gap-0.5">
                                       <ArrowRight size={8} /> {depTask.title ? depTask.title.substring(0, 15) + (depTask.title.length > 15 ? '...' : '') : `#${tpl.tasks_json.indexOf(depTask) + 1}`}
                                     </span>
                                   )}
                                 </div>
                               );
                             })}
                           </div>
                         </div>
                       )}
                     </div>
                   );
                 })}
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default TaskTemplateModal;
