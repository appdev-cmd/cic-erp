import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

interface TaskApprovalDialogsProps {
  showApproveDialog: boolean;
  setShowApproveDialog: (show: boolean) => void;
  approvalComment: string;
  setApprovalComment: (comment: string) => void;
  handleApproveTask: () => void;
  approvalLoading: boolean;

  showRejectDialog: boolean;
  setShowRejectDialog: (show: boolean) => void;
  rejectReason: string;
  setRejectReason: (reason: string) => void;
  handleRejectApproval: () => void;
}

export const TaskApprovalDialogs: React.FC<TaskApprovalDialogsProps> = ({
  showApproveDialog,
  setShowApproveDialog,
  approvalComment,
  setApprovalComment,
  handleApproveTask,
  approvalLoading,
  showRejectDialog,
  setShowRejectDialog,
  rejectReason,
  setRejectReason,
  handleRejectApproval
}) => {
  return (
    <>
      {/* ─── Approve Dialog ─── */}
      {showApproveDialog && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40" onClick={() => setShowApproveDialog(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-500" /> Phê duyệt công việc
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Bạn xác nhận phê duyệt công việc này?</p>
            <textarea
              value={approvalComment}
              onChange={e => setApprovalComment(e.target.value)}
              placeholder="Ghi chú (không bắt buộc)..."
              rows={3}
              className="w-full text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowApproveDialog(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
                Hủy
              </button>
              <button
                onClick={handleApproveTask}
                disabled={approvalLoading}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 size={14} /> {approvalLoading ? 'Đang xử lý...' : 'Xác nhận phê duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reject Dialog ─── */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40" onClick={() => setShowRejectDialog(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <XCircle size={20} className="text-red-500" /> Từ chối phê duyệt
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Vui lòng nhập lý do từ chối.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Lý do từ chối (bắt buộc)..."
              rows={3}
              autoFocus
              className="w-full text-sm p-3 rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRejectDialog(false)} className="px-4 py-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
                Hủy
              </button>
              <button
                onClick={handleRejectApproval}
                disabled={approvalLoading || !rejectReason.trim()}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <XCircle size={14} /> {approvalLoading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
