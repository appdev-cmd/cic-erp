import React, { useState, useCallback, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, User, AlertTriangle, Check, X, MessageSquare, ChevronDown, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { Task, ApprovalStatus } from '../../../types/taskTypes';
import { formatDate, formatDateTime } from '../../../utils/formatters';
import { dataClient } from '../../../lib/dataClient';
import PeoplePickerPopover from '../PeoplePickerPopover';

interface TaskApprovalRecord {
  id: string;
  task_id: string;
  actor_id: string;
  action: 'submitted' | 'approved' | 'rejected' | 'recalled';
  comment?: string;
  created_at: string;
  actor_name?: string;
  actor_avatar?: string;
}

interface TaskApprovalTabProps {
  task: Task;
  currentUserId: string;
  onUpdate: () => void;
}

const statusConfig: Record<ApprovalStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: {
    label: 'Chờ phê duyệt',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
    icon: <Clock size={16} />,
  },
  approved: {
    label: 'Đã phê duyệt',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700',
    icon: <CheckCircle2 size={16} />,
  },
  rejected: {
    label: 'Đã từ chối',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700',
    icon: <XCircle size={16} />,
  },
};

const TaskApprovalTab: React.FC<TaskApprovalTabProps> = ({ task, currentUserId, onUpdate }) => {
  const [history, setHistory] = useState<TaskApprovalRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showApproverPicker, setShowApproverPicker] = useState(false);
  const [approverIds, setApproverIds] = useState<string[]>(task.approvers ?? []);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const approvalStatus = task.approval_status;
  const isApprover = task.approvers?.includes(currentUserId);
  const isPending = approvalStatus === 'pending';

  // ─── Load history ───────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!task.id) return;
    setLoadingHistory(true);
    try {
      const { data } = await dataClient
        .from('task_approval_logs')
        .select('*, actor:actor_id (name, avatar)')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false });

      if (data) {
        setHistory(
          data.map((r: any) => ({
            ...r,
            actor_name: r.actor?.name || r.actor_id?.substring(0, 8),
            actor_avatar: r.actor?.avatar,
          }))
        );
      }
    } catch {
      // table may not exist yet — silent
    } finally {
      setLoadingHistory(false);
    }
  }, [task.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ─── Submit approval action ──────────────────────────────────────────────────
  const handleAction = async (action: 'approved' | 'rejected') => {
    if (!comment && action === 'rejected') {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }
    setSubmitting(true);
    try {
      const newStatus: ApprovalStatus = action === 'approved' ? 'approved' : 'rejected';

      // Update task approval_status
      await dataClient
        .from('tasks')
        .update({ approval_status: newStatus, approval_comment: comment || null })
        .eq('id', task.id);

      // Log to audit table
      try {
        await dataClient.from('task_approval_logs').insert({
          task_id: task.id,
          actor_id: currentUserId,
          action,
          comment: comment || null,
        });
      } catch { /* ignore */ }

      toast.success(action === 'approved' ? 'Đã phê duyệt' : 'Đã từ chối');
      setComment('');
      onUpdate();
      loadHistory();
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Save approver list ───────────────────────────────────────────────────────
  const handleSaveApprovers = async (ids: string[]) => {
    try {
      await dataClient.from('tasks').update({ approvers: ids }).eq('id', task.id);
      setApproverIds(ids);
      toast.success('Đã cập nhật người phê duyệt');
      onUpdate();
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    }
  };

  // ─── Trigger approval ────────────────────────────────────────────────────────
  const handleSubmitForApproval = async () => {
    if (approverIds.length === 0) {
      toast.error('Cần chọn ít nhất 1 người phê duyệt');
      return;
    }
    setSubmitting(true);
    try {
      await dataClient.from('tasks').update({ approval_status: 'pending', approvers: approverIds }).eq('id', task.id);
      // Log submission to audit trail
      try {
        await dataClient.from('task_approval_logs').insert({
          task_id: task.id,
          actor_id: currentUserId,
          action: 'submitted',
          comment: null,
        });
      } catch { /* ignore */ }
      toast.success('Đã gửi yêu cầu phê duyệt');
      onUpdate();
      loadHistory();
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const cfg = approvalStatus ? statusConfig[approvalStatus] : null;

  return (
    <div className="space-y-5 p-2">

      {/* ── Current status banner ── */}
      {cfg && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg}`}>
          <span className={cfg.color}>{cfg.icon}</span>
          <div>
            <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
            {task.approval_comment && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">"{task.approval_comment}"</p>
            )}
          </div>
        </div>
      )}

      {/* ── Approvers section ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Người phê duyệt</p>
          {!approvalStatus && (
            <button
              onClick={() => setShowApproverPicker(v => !v)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {approverIds.length > 0 ? 'Chỉnh sửa' : '+ Thêm'}
            </button>
          )}
        </div>

        {approverIds.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">Chưa chọn người phê duyệt</p>
        ) : (
          <div className="space-y-1">
            {approverIds.map(id => (
              <div key={id} className="flex items-center gap-2 py-1">
                <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                  <User size={14} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300">{id.substring(0, 8)}…</span>
                {approvalStatus === 'approved' && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <Check size={12} /> Đã duyệt
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {showApproverPicker && (
          <div className="mt-2 relative z-20">
            <PeoplePickerPopover
              currentIds={approverIds}
              onChange={ids => {
                setApproverIds(ids);
                handleSaveApprovers(ids);
                setShowApproverPicker(false);
              }}
              onClose={() => setShowApproverPicker(false)}
              align="left"
              minSelections={0}
            />
          </div>
        )}
      </div>

      {/* ── Actions — submit for approval ── */}
      {!approvalStatus && (
        <div className="border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-indigo-500" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Yêu cầu phê duyệt</p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Gửi công việc này để người phê duyệt xem xét
          </p>
          <button
            onClick={handleSubmitForApproval}
            disabled={submitting || approverIds.length === 0}
            className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {submitting ? 'Đang gửi…' : 'Gửi yêu cầu phê duyệt'}
          </button>
          {approverIds.length === 0 && (
            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle size={11} /> Cần chọn người phê duyệt trước
            </p>
          )}
        </div>
      )}

      {/* ── Approve / Reject form (for approvers) ── */}
      {isPending && isApprover && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Hành động phê duyệt</p>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Ghi chú (bắt buộc khi từ chối)"
            rows={3}
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => handleAction('approved')}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <CheckCircle2 size={15} /> Phê duyệt
            </button>
            <button
              onClick={() => handleAction('rejected')}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <XCircle size={15} /> Từ chối
            </button>
          </div>
        </div>
      )}

      {/* ── History / Audit Log ── */}
      <div>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <MessageSquare size={12} /> Lịch sử phê duyệt
        </p>
        {loadingHistory ? (
          <div className="space-y-2">
            {[1,2].map(i => <div key={i} className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">Chưa có lịch sử phê duyệt</p>
        ) : (
          <div className="space-y-2">
            {history.map(log => {
              const isApprove = log.action === 'approved';
              return (
                <div key={log.id} className={`flex gap-3 p-3 rounded-lg border ${isApprove ? 'border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-900/10'}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isApprove ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-rose-100 dark:bg-rose-900/40'}`}>
                    {isApprove ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <X size={14} className="text-rose-600 dark:text-rose-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{log.actor_name}</span>
                      <span className={`text-xs font-semibold ${isApprove ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isApprove ? 'Đã phê duyệt' : 'Đã từ chối'}
                      </span>
                    </div>
                    {log.comment && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">"{log.comment}"</p>}
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{formatDateTime(log.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskApprovalTab;
