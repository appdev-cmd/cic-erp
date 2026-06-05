import React, { useState } from 'react';
import { CrmLead, CrmStageTemplate } from '../../../types';
import { CrmLeadService, CrmActivityService } from '../../../services';
import { formatDateShort, formatCurrencyCompact } from '../../../utils/formatters';
import { Phone, Mail, MoreHorizontal, User, Hand, Briefcase, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import LeadScoreBadge from '../shared/LeadScoreBadge';
import SourceBadge from '../shared/SourceBadge';
import { REGION_LABELS } from '../../../types/crm';
import type { RegionType } from '../../../types/crm';
import { resolveStageAction, isLoseStage } from '../../../lib/crm/stageWorkflow';
import StageTransitionModal from './StageTransitionModal';
import { calcLeadScore } from '../../../lib/crm/leadScoring';

interface Props {
  leads: CrmLead[];
  stages: CrmStageTemplate[];
  onLeadUpdated: () => void;
  onLeadClick: (lead: CrmLead) => void;
  /** Unit hiện đang xem (để "Nhận lại" lead từ ao kéo về unit người nhận). */
  currentUnitId?: string;
}

const LeadsKanbanView: React.FC<Props> = ({ leads, stages, onLeadUpdated, onLeadClick, currentUnitId }) => {
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  // Stage workflow modal (triggered by drag-drop into gated stages)
  const [pendingTransition, setPendingTransition] = useState<{ lead: CrmLead; stage: CrmStageTemplate } | null>(null);

  const stageById = (id?: string) => stages.find((s) => s.id === id);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
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
    const targetStage = stages.find(s => s.id === stageId);
    if (!lead || !targetStage || lead.stage_id === stageId) {
      return;
    }

    // Route through the shared stage workflow instead of blindly setting stage_id.
    // (Chuyển đổi tạo deal là nút riêng trong panel chi tiết — không xử lý ở Kanban.)
    const action = resolveStageAction(lead, targetStage);
    if (action === 'transition') {
      setPendingTransition({ lead, stage: targetStage });
      return;
    }

    // 'direct' — vd lùi về "Mới". Nếu rời ao Không tiềm năng thì xoá dấu hoàn tất.
    try {
      setUpdating(true);
      const leavingPool = isLoseStage(stageById(lead.stage_id)?.name || '') && !isLoseStage(targetStage.name);
      const exitPool: Partial<CrmLead> = leavingPool
        ? { completed_at: null as any, is_opportunity: null as any, completion_result: null as any }
        : {};
      await CrmLeadService.update(draggedLeadId, { ...exitPool, stage_id: stageId });
      onLeadUpdated();
      toast.success('Đã cập nhật trạng thái Lead');
    } catch (error: any) {
      toast.error('Lỗi cập nhật: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  // Confirm callback from StageTransitionModal (gated forward moves & lose stages)
  const handleTransitionConfirm = async (updatedData: Partial<CrmLead>, note: string) => {
    if (!pendingTransition) return;
    const { lead, stage } = pendingTransition;
    try {
      setUpdating(true);
      const losing = isLoseStage(stage.name);
      const leavingPool = isLoseStage(stageById(lead.stage_id)?.name || '') && !losing;
      const losePayload: Partial<CrmLead> = losing
        ? {
            is_opportunity: false,
            completed_at: new Date().toISOString(),
            completion_result: stage.name.toLowerCase().includes('mất') ? 'lost' : 'unqualified',
            completion_note: note,
          }
        : leavingPool
          ? { completed_at: null as any, is_opportunity: null as any, completion_result: null as any }
          : {};
      const notesPayload: Partial<CrmLead> = note
        ? { transition_notes: { ...(lead.transition_notes || {}), [stage.name]: note } }
        : {};
      await CrmLeadService.update(lead.id, { ...updatedData, ...losePayload, ...notesPayload, stage_id: stage.id });

      // Ghi nhận ghi chú vào lịch sử
      if (note) {
        try {
          await CrmActivityService.create({
            lead_id: lead.id,
            activity_type: 'Note',
            description: `Chuyển sang "${stage.name}": ${note}`,
          });
        } catch (_) { /* không chặn luồng chính */ }
      }
      onLeadUpdated();
      toast.success(`Đã chuyển sang "${stage.name}"`);
    } catch (error: any) {
      toast.error('Lỗi cập nhật: ' + error.message);
    } finally {
      setUpdating(false);
      setPendingTransition(null);
    }
  };

  const handleClaimLead = async (e: React.MouseEvent, lead: CrmLead) => {
    e.stopPropagation();
    try {
      setClaiming(lead.id);
      const fromPool = isLoseStage(stageById(lead.stage_id)?.name || '');
      if (fromPool) {
        await CrmLeadService.reclaimFromPool(lead.id, currentUnitId);
        toast.success('Đã nhận lại lead từ ao Không tiềm năng!');
      } else {
        await CrmLeadService.claimLead(lead.id);
        toast.success('Đã nhận lead thành công!');
      }
      onLeadUpdated();
    } catch (error: any) {
      toast.error(error.message || 'Không thể nhận lead');
    } finally {
      setClaiming(null);
    }
  };

  return (
    <>
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
                <h3 className="font-bold text-white uppercase text-sm truncate drop-shadow-sm" title={stage.name}>
                  {stage.name}
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
                const isUnclaimed = !lead.assigned_to;
                const region = lead.region as RegionType | undefined;
                const score = calcLeadScore(lead);

                const productNames = (lead.products || [])
                  .map((p: any) => p.product_name || p.product?.name || p.product_id || '')
                  .filter(Boolean)
                  .join(', ');

                const getRegionText = (r?: string) => {
                  if (r === 'north') return 'Phía Bắc';
                  if (r === 'central') return 'Phía Trung';
                  if (r === 'south') return 'Phía Nam';
                  return 'Chưa xác định';
                };

                return (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onLeadClick(lead)}
                    className={`bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm 
                      ${isUnclaimed 
                        ? 'border border-amber-200 dark:border-amber-900/40 bg-gradient-to-br from-white to-amber-50/10 dark:from-slate-900 dark:to-amber-950/5' 
                        : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                      }
                      hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 
                      cursor-pointer cursor-grab active:cursor-grabbing group transition-all duration-200 ${
                      isDragging 
                        ? 'opacity-30 scale-95 transition-none' 
                        : ''
                    }`}
                  >
                    {/* Hàng 1: Trạng thái nhận */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800/60">
                      {isUnclaimed ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 dark:bg-rose-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 dark:bg-rose-400"></span>
                          </span>
                          Chưa có người nhận
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[120px]">{lead.assignee?.name || 'Thành viên'}</span> đang khai thác
                        </div>
                      )}
                    </div>

                    {/* Hàng 2: Tên công ty / Khách hàng + Badge Score */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1 flex-1" title={lead.company_name || lead.title}>
                        {lead.company_name || lead.title || 'Chưa có thông tin'}
                      </h4>
                      
                      {/* Badge Hot/Score */}
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          score >= 61 ? 'bg-emerald-500' : score >= 31 ? 'bg-amber-500' : 'bg-slate-400'
                        }`} />
                        <span>{score >= 61 ? 'Hot' : score >= 31 ? 'Warm' : 'Cold'}</span>
                        <span className="text-slate-300 dark:text-slate-600 mx-0.5">|</span>
                        <span>Score: {score}</span>
                      </div>
                    </div>

                    {/* Hàng 3: SĐT • Vùng miền */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mb-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="truncate">
                        {lead.phone || 'Chưa có SĐT'}
                        <span className="text-slate-300 dark:text-slate-750 mx-1.5">•</span>
                        {getRegionText(lead.region)}
                      </span>
                    </div>

                    {/* Hàng 4: Sản phẩm • Giá trị */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mb-4">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="truncate" title={productNames}>
                        {productNames || 'Chưa chọn sản phẩm'}
                        <span className="text-slate-300 dark:text-slate-750 mx-1.5">•</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {formatCurrencyCompact(lead.expected_value)}
                        </span>
                      </span>
                    </div>

                    {/* Hàng 5: Nút hành động */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLeadClick(lead);
                        }}
                        className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold text-xs px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        Xem chi tiết
                      </button>
                      
                      {(isUnclaimed || stage.is_lose) && (
                        <button
                          type="button"
                          onClick={(e) => handleClaimLead(e, lead)}
                          disabled={claiming === lead.id}
                          className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg shadow-sm shadow-amber-100 dark:shadow-none transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {claiming === lead.id ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <span>✋</span>
                              <span>{stage.is_lose ? 'Nhận lại' : 'Nhận lead'}</span>
                            </>
                          )}
                        </button>
                      )}
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

    {/* Gated forward move / lose stage → required-field + note modal */}
    {pendingTransition && (
      <StageTransitionModal
        isOpen={!!pendingTransition}
        onClose={() => setPendingTransition(null)}
        onConfirm={handleTransitionConfirm}
        targetStage={pendingTransition.stage}
        lead={pendingTransition.lead}
        initialNote={(pendingTransition.lead.transition_notes as any)?.[pendingTransition.stage.name] || ''}
      />
    )}
    </>
  );
};

export default LeadsKanbanView;
