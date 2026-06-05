import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (lostReason: string) => void;
}

const LOST_REASONS = [
  'Giá không cạnh tranh',
  'Đối thủ thắng',
  'KH không có ngân sách',
  'KH chuyển nhu cầu',
  'Không phản hồi',
  'Khác',
];

const LostReasonModal: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    const reason = selectedReason === 'Khác' ? note || 'Khác' : selectedReason;
    if (!reason) return;
    onConfirm(reason);
    setSelectedReason('');
    setNote('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md mx-4 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} />
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Lý do thua Deal
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Chọn lý do tại sao deal này bị thua:
          </p>

          <div className="space-y-2">
            {LOST_REASONS.map(reason => (
              <label
                key={reason}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedReason === reason
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="lostReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={() => setSelectedReason(reason)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 dark:border-slate-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {reason}
                </span>
              </label>
            ))}
          </div>

          {/* Note textarea (always visible, required when "Khác" is selected) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
              Ghi chú thêm {selectedReason === 'Khác' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Nhập chi tiết lý do..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedReason || (selectedReason === 'Khác' && !note.trim())}
            className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white disabled:text-slate-500 dark:disabled:text-slate-400 rounded-lg transition-colors cursor-pointer shadow-sm"
          >
            Xác nhận Thua
          </button>
        </div>
      </div>
    </div>
  );
};

export default LostReasonModal;
