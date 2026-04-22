import React from 'react';
import { CheckCircle2, Calendar, Trash2 } from 'lucide-react';

export const BulkActionsBar: React.FC<{
  selectedCount: number;
  totalCount: number;
  onComplete: () => void;
  onSetDeadline: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}> = ({ selectedCount, totalCount, onComplete, onSetDeadline, onDelete, onClearSelection }) => {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-lg px-6 py-3 flex items-center justify-between -mx-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onComplete}
            className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 size={14} /> Hoàn thành
          </button>
          <button
            onClick={onSetDeadline}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Calendar size={14} /> Đặt deadline
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Trash2 size={14} /> Xóa
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Đã chọn: <strong className="text-slate-900 dark:text-slate-100">{selectedCount} / {totalCount}</strong>
        </span>
        <button
          onClick={onClearSelection}
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer underline"
        >
          Bỏ chọn
        </button>
      </div>
    </div>
  );
};
