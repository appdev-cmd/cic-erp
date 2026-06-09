import React from 'react';
import { Send, Check, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
    isEditing: boolean;
    setIsEditing: (val: boolean) => void;
    onSave: () => void;
    onAction: (action: 'Submit' | 'Approve' | 'Reject') => void;

    // Permissions
    canEditPlan: boolean;
    showSubmit: boolean;
    showApproveUnit: boolean;
    showApproveFinance: boolean;
    showApproveBoard: boolean;
    canAdjustCost: boolean;

    planExists: boolean;
}

export const ActionPanel: React.FC<Props> = ({
    isEditing, setIsEditing, onSave, onAction,
    canEditPlan, showSubmit, showApproveUnit, showApproveFinance, showApproveBoard, canAdjustCost,
    planExists
}) => {
    return (
        <div className="flex gap-2">
            {/* EDIT ACTION */}
            {canEditPlan && !isEditing && (
                <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 font-medium text-sm transition-colors"
                >
                    Chỉnh sửa
                </button>
            )}

            {/* EDIT MODE ACTIONS */}
            {isEditing && (
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors">Hủy</button>
                    <button onClick={onSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-lg shadow-indigo-200 transition-colors">Lưu nháp</button>
                </div>
            )}

            {/* SUBMIT ACTION (Draft -> Pending_Unit) */}
            {!isEditing && showSubmit && (
                <button onClick={() => onAction('Submit')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2 transition-colors">
                    <Send size={16} /> Gửi duyệt
                </button>
            )}

            {/* UNIT APPROVAL (Pending_Unit -> Pending_Finance) */}
            {showApproveUnit && (
                <div className="flex gap-2 items-center bg-amber-50 dark:bg-amber-500/10 rounded-lg p-1 pr-2 border border-amber-100 dark:border-amber-500/20">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase ml-2 mr-2">Duyệt Đơn vị</span>
                    <button onClick={() => onAction('Reject')} className="px-3 py-1.5 bg-white text-rose-600 rounded-lg hover:bg-rose-50 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-slate-700 font-bold text-xs shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">Từ chối</button>
                    <button onClick={() => onAction('Approve')} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold text-xs shadow-sm flex items-center gap-1 transition-colors">
                        <Check size={12} /> Duyệt
                    </button>
                </div>
            )}

            {/* FINANCE APPROVAL (Pending_Finance -> Pending_Board/Approved) */}
            {showApproveFinance && (
                <div className="flex gap-2 items-center bg-indigo-50 dark:bg-indigo-500/10 rounded-lg p-1 pr-2 border border-indigo-100 dark:border-indigo-500/20">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase ml-2 mr-2">Duyệt Tài chính</span>
                    <button onClick={() => onAction('Reject')} className="px-3 py-1.5 bg-white text-rose-600 rounded-lg hover:bg-rose-50 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-slate-700 font-bold text-xs shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">Từ chối</button>
                    <button onClick={() => onAction('Approve')} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold text-xs shadow-sm flex items-center gap-1 transition-colors">
                        <Check size={12} /> Duyệt
                    </button>
                </div>
            )}

            {/* BOARD APPROVAL (Pending_Board -> Approved) */}
            {showApproveBoard && (
                <div className="flex gap-2 items-center bg-purple-50 dark:bg-purple-500/10 rounded-lg p-1 pr-2 border border-purple-100 dark:border-purple-500/20">
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase ml-2 mr-2">Duyệt Lãnh đạo</span>
                    <button onClick={() => onAction('Reject')} className="px-3 py-1.5 bg-white text-rose-600 rounded-lg hover:bg-rose-50 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-slate-700 font-bold text-xs shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">Từ chối</button>
                    <button onClick={() => onAction('Approve')} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold text-xs shadow-sm flex items-center gap-1 transition-colors">
                        <Check size={12} /> Phê duyệt
                    </button>
                </div>
            )}

            {/* 4. ADJUST ACTUAL COSTS */}
            {canAdjustCost && (
                <div className="ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => toast.info("Tính năng đang phát triển: Mở dialog nhập chi phí thực tế (Cost Adjustments)")}
                        className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 font-medium text-xs flex items-center gap-1 border border-emerald-200 dark:border-emerald-500/20 transition-colors"
                    >
                        <FileText size={14} /> Cập nhật Chi phí
                    </button>
                </div>
            )}
        </div>
    );
};
