import React, { useState } from 'react';
import { CrmLead, CrmStageTemplate } from '../../../types';
import { CrmLeadService } from '../../../services';
import { formatDateShort } from '../../../utils/formatters';
import { Phone, Mail, MoreHorizontal, User } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  leads: CrmLead[];
  stages: CrmStageTemplate[];
  onLeadUpdated: () => void;
  onLeadClick: (lead: CrmLead) => void;
}

const LeadsKanbanView: React.FC<Props> = ({ leads, stages, onLeadUpdated, onLeadClick }) => {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    // Đặt dataTransfer trước
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';

    // Dùng setTimeout với 0ms để đẩy việc cập nhật state vào macrotask queue tiếp theo.
    // Điều này đảm bảo trình duyệt hoàn thành việc chụp ảnh drag preview từ card gốc ở trạng thái 100% rõ nét 
    // trước khi React cập nhật state và áp dụng class opacity thấp làm mờ card gốc.
    setTimeout(() => {
      setDraggedLeadId(leadId);
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverStageId(null);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, stageId: string) => {
    const relatedTarget = e.relatedTarget as Node | null;
    const currentTarget = e.currentTarget as Node;
    if (!currentTarget.contains(relatedTarget)) {
      if (dragOverStageId === stageId) {
        setDragOverStageId(null);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStageId(null);
    setDraggedLeadId(null);
    if (!draggedLeadId || updating) return;

    const lead = leads.find(l => l.id === draggedLeadId);
    if (!lead || lead.stage_id === stageId) {
      return;
    }

    try {
      setUpdating(true);
      await CrmLeadService.update(draggedLeadId, { stage_id: stageId });
      onLeadUpdated();
      toast.success('Đã cập nhật trạng thái Lead');
    } catch (error: any) {
      toast.error('Lỗi cập nhật: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex h-full overflow-x-auto gap-4 pb-4">
      {stages.map(stage => {
        const stageLeads = leads.filter(l => l.stage_id === stage.id);
        const totalValue = stageLeads.reduce((sum, l) => sum + (Number(l.expected_value) || 0), 0);

        return (
          <div 
            key={stage.id}
            className={`flex flex-col flex-1 min-w-0 bg-slate-100 dark:bg-slate-800 rounded-xl h-full transition-all duration-200 ${
              dragOverStageId === stage.id ? 'scale-[1.02]' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={(e) => handleDragLeave(e, stage.id)}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            {/* Column Header */}
            <div className="p-3 rounded-t-xl" style={{ backgroundColor: stage.color || '#3B82F6' }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-white uppercase text-sm truncate drop-shadow-sm" title={stage.name === 'Thất bại' ? 'Không tiềm năng' : stage.name}>
                  {stage.name === 'Thất bại' ? 'Không tiềm năng' : stage.name}
                </h3>
                <span className="text-xs font-medium text-white bg-white/20 px-2 py-0.5 rounded-full shadow-sm">
                  {stageLeads.length}
                </span>
              </div>
              <div className="text-sm font-bold text-white/90 drop-shadow-sm">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalValue)}
              </div>
            </div>

            {/* Cards Area */}
            <div className={`flex-1 p-2 overflow-y-auto space-y-2 transition-all duration-200 ${
              dragOverStageId === stage.id
                ? 'ring-2 ring-indigo-400 dark:ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
                : ''
            }`}>
              {stageLeads.map(lead => {
                const isDragging = draggedLeadId === lead.id;
                return (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onLeadClick(lead)}
                    className={`bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer cursor-grab active:cursor-grabbing group ${
                      isDragging 
                        ? 'opacity-30 scale-95 transition-none' 
                        : 'transition-[border-color,box-shadow,background-color] duration-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm line-clamp-2">
                        {lead.title}
                      </h4>
                      <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
                      {lead.expected_value 
                        ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(lead.expected_value)
                        : '0 ₫'}
                    </div>

                    {lead.company_name && (
                      <div className="text-xs text-slate-600 dark:text-slate-400 mb-1 truncate">
                        {lead.company_name}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1">
                        {lead.assignee ? (
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden" title={lead.assignee.name}>
                            {lead.assignee.avatar ? (
                              <img src={lead.assignee.avatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                                {lead.assignee.name?.charAt(0)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                            <User className="w-3 h-3 text-slate-400" />
                          </div>
                        )}
                        
                        <div className="flex gap-1 ml-1">
                          {lead.phone && <Phone className="w-3.5 h-3.5 text-slate-400" />}
                          {lead.email && <Mail className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                      </div>
                      
                      <span className="text-[10px] text-slate-500 dark:text-slate-500 font-medium">
                        {formatDateShort(lead.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {stageLeads.length === 0 && !draggedLeadId && (
                <div className="flex-1 min-h-[150px] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                  <span className="text-sm text-slate-400 dark:text-slate-500">Kéo thả vào đây</span>
                </div>
              )}

              {draggedLeadId && stageLeads.length === 0 && (
                <div className="flex-1 min-h-[150px] flex items-center justify-center border-2 border-dashed border-indigo-400 dark:border-indigo-500 rounded-lg bg-indigo-50/30 dark:bg-indigo-900/10 transition-colors duration-200">
                  <span className="text-sm font-medium text-indigo-500 dark:text-indigo-400">Thả vào đây</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LeadsKanbanView;
