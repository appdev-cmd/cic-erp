import React, { useState } from 'react';
import { CrmDeal, CrmStageTemplate } from '../../../types';
import { CrmDealService } from '../../../services';
import { formatCurrency } from '../../../utils/formatters';
import { User, MoreHorizontal, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import LostReasonModal from './LostReasonModal';

interface Props {
  deals: CrmDeal[];
  stages: CrmStageTemplate[];
  onDealUpdated: () => void;
  onDealClick: (deal: CrmDeal) => void;
}

const DealsKanbanView: React.FC<Props> = ({ deals, stages, onDealUpdated, onDealClick }) => {
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [pendingLostDealId, setPendingLostDealId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      setDraggedDealId(dealId);
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggedDealId(null);
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
    const droppedDealId = draggedDealId;
    setDraggedDealId(null);
    if (!droppedDealId || updating) return;

    const deal = deals.find(d => d.id === droppedDealId);
    if (!deal || deal.stage_id === stageId) return;

    // Check if dropping to a "lost" stage → show LostReasonModal
    const targetStage = stages.find(s => s.id === stageId);
    if (targetStage?.is_lose) {
      setPendingLostDealId(droppedDealId);
      setShowLostModal(true);
      return;
    }

    try {
      setUpdating(true);
      await CrmDealService.update(droppedDealId, { stage_id: stageId });
      onDealUpdated();
      toast.success('Đã cập nhật trạng thái Deal');
    } catch (error: any) {
      toast.error('Lỗi cập nhật: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleLostConfirm = async (lostReason: string) => {
    if (!pendingLostDealId) return;
    const lostStage = stages.find(s => s.is_lose);
    if (!lostStage) return;

    try {
      setUpdating(true);
      await CrmDealService.update(pendingLostDealId, {
        stage_id: lostStage.id,
        lost_reason: lostReason
      });
      onDealUpdated();
      toast.success('Đã cập nhật deal là Thua');
    } catch (error: any) {
      toast.error('Lỗi cập nhật: ' + error.message);
    } finally {
      setUpdating(false);
      setShowLostModal(false);
      setPendingLostDealId(null);
    }
  };

  // Probability color helper
  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
    if (probability >= 50) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
  };

  return (
    <>
      <div className="flex h-full overflow-x-auto gap-4 pb-4">
        {stages.map(stage => {
          const stageDeals = deals.filter(d => d.stage_id === stage.id);
          const totalValue = stageDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

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
                  <h3 className="font-bold text-white uppercase text-sm truncate drop-shadow-sm" title={stage.name}>
                    {stage.name}
                  </h3>
                  <span className="text-xs font-medium text-white bg-white/20 px-2 py-0.5 rounded-full shadow-sm">
                    {stageDeals.length}
                  </span>
                </div>
                <div className="text-sm font-bold text-white/90 drop-shadow-sm">
                  {formatCurrency(totalValue)}
                </div>
              </div>

              {/* Cards Area */}
              <div className={`flex-1 p-2 overflow-y-auto space-y-2 transition-all duration-200 ${
                dragOverStageId === stage.id
                  ? 'ring-2 ring-indigo-400 dark:ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
                  : ''
              }`}>
                {stageDeals.map(deal => {
                  const isDragging = draggedDealId === deal.id;

                  return (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onDealClick(deal)}
                      className={`bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm 
                        border border-slate-200 dark:border-slate-700
                        hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500 
                        cursor-pointer cursor-grab active:cursor-grabbing group ${
                        isDragging
                          ? 'opacity-30 scale-95 transition-none'
                          : 'transition-[border-color,box-shadow,background-color] duration-200'
                      }`}
                    >
                      {/* Title */}
                      <h4 className="font-medium text-slate-900 dark:text-slate-100 text-sm line-clamp-2 mb-2">
                        {deal.title}
                      </h4>

                      {/* Company */}
                      {deal.customer?.name && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mb-1">
                          {deal.customer.name}
                        </div>
                      )}

                      {/* Amount */}
                      <div className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
                        {formatCurrency(deal.amount || 0)}
                      </div>

                      {/* Probability badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getProbabilityColor(deal.probability)}`}>
                          {deal.probability}%
                        </span>
                        {deal.expected_close_date && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                            <Calendar size={10} />
                            {new Date(deal.expected_close_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {/* Footer: Avatar */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          {deal.assignee ? (
                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden" title={deal.assignee.name}>
                              {deal.assignee.avatar ? (
                                <img src={deal.assignee.avatar} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                                  {deal.assignee.name?.charAt(0)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                              <User className="w-3 h-3 text-slate-400" />
                            </div>
                          )}
                        </div>

                        {deal.tags && deal.tags.length > 0 && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[80px]">
                            {deal.tags[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {stageDeals.length === 0 && !draggedDealId && (
                  <div className="flex-1 min-h-[150px] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                    <span className="text-sm text-slate-400 dark:text-slate-500">Kéo thả vào đây</span>
                  </div>
                )}

                {draggedDealId && stageDeals.length === 0 && (
                  <div className="flex-1 min-h-[150px] flex items-center justify-center border-2 border-dashed border-indigo-400 dark:border-indigo-500 rounded-lg bg-indigo-50/30 dark:bg-indigo-900/10 transition-colors duration-200">
                    <span className="text-sm font-medium text-indigo-500 dark:text-indigo-400">Thả vào đây</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lost Reason Modal */}
      <LostReasonModal
        isOpen={showLostModal}
        onClose={() => {
          setShowLostModal(false);
          setPendingLostDealId(null);
        }}
        onConfirm={handleLostConfirm}
      />
    </>
  );
};

export default DealsKanbanView;
