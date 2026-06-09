// ============================================================
// Leave Request Form — Modal for creating/editing leave requests
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { X, Upload, AlertCircle, CalendarDays, Info } from 'lucide-react';
import DateInput from '../ui/DateInput';
import { formatDate } from '../../utils/formatters';
import { LeaveService, calculateWorkDays } from '../../services/leaveService';
import type { LeavePolicy, LeaveBalanceSummary, CreateLeaveRequestInput, LeaveRequest, LeaveHalf } from '../../types/hrmTypes';

interface LeaveRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeId: string;
  unitId?: string;
  editRequest?: LeaveRequest | null;
}

const HALF_OPTIONS = [
  { value: '', label: 'Cả ngày' },
  { value: 'morning', label: 'Buổi sáng' },
  { value: 'afternoon', label: 'Buổi chiều' },
];

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({
  isOpen,
  onClose,
  onSaved,
  employeeId,
  unitId,
  editRequest,
}) => {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [leaveType, setLeaveType] = useState(editRequest?.leave_type || 'annual');
  const [startDate, setStartDate] = useState(editRequest?.start_date || '');
  const [endDate, setEndDate] = useState(editRequest?.end_date || '');
  const [startHalf, setStartHalf] = useState<string>(editRequest?.start_half || '');
  const [endHalf, setEndHalf] = useState<string>(editRequest?.end_half || '');
  const [reason, setReason] = useState(editRequest?.reason || '');

  // Load policies & balances
  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        const [pols, bals] = await Promise.all([
          LeaveService.getPolicies(),
          LeaveService.getBalanceSummary(employeeId, new Date().getFullYear()),
        ]);
        setPolicies(pols);
        setBalances(bals);
      } catch (e) {
        console.error('Failed to load leave policies:', e);
      }
    };
    load();
  }, [isOpen, employeeId]);

  // Calculate total days
  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return calculateWorkDays(startDate, endDate, startHalf || null, endHalf || null);
  }, [startDate, endDate, startHalf, endHalf]);

  // Get current balance for selected leave type
  const currentBalance = useMemo(() => {
    return balances.find(b => b.leave_type === leaveType);
  }, [balances, leaveType]);

  // Selected policy
  const selectedPolicy = useMemo(() => {
    return policies.find(p => p.leave_type === leaveType);
  }, [policies, leaveType]);

  // Validation
  const isOverBalance = currentBalance ? totalDays > currentBalance.remaining : false;

  const handleSubmit = async (asDraft: boolean) => {
    if (!startDate || !endDate) {
      setError('Vui lòng chọn ngày bắt đầu và kết thúc');
      return;
    }
    if (totalDays <= 0) {
      setError('Số ngày nghỉ phải lớn hơn 0');
      return;
    }
    if (!asDraft && isOverBalance && selectedPolicy?.leave_type !== 'unpaid') {
      setError('Không đủ số phép còn lại');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const input: CreateLeaveRequestInput = {
        employee_id: employeeId,
        leave_type: leaveType as any,
        start_date: startDate,
        end_date: endDate,
        start_half: startHalf ? (startHalf as LeaveHalf) : null,
        end_half: endHalf ? (endHalf as LeaveHalf) : null,
        total_days: totalDays,
        reason: reason || undefined,
        unit_id: unitId,
      };

      if (editRequest) {
        await LeaveService.updateRequest(editRequest.id, input);
      } else {
        const created = await LeaveService.createRequest(input);
        if (!asDraft) {
          await LeaveService.submitRequest(created.id);
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent outline-none transition-all';
  const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl dark:shadow-slate-950/50 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <CalendarDays className="text-blue-600 dark:text-blue-400" size={18} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {editRequest ? 'Sửa đơn nghỉ phép' : 'Tạo đơn nghỉ phép'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label className={labelCls}>Loại nghỉ phép</label>
            <select
              value={leaveType}
              onChange={e => setLeaveType(e.target.value as any)}
              className={inputCls}
            >
              {policies.map(p => (
                <option key={p.leave_type} value={p.leave_type}>
                  {p.label} {p.paid ? '' : '(Không lương)'}
                </option>
              ))}
            </select>

            {/* Balance info */}
            {currentBalance && (
              <div className="mt-2 flex items-center gap-4 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Tổng: <span className="font-semibold text-slate-700 dark:text-slate-300">{currentBalance.total_days}</span> ngày
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Đã dùng: <span className="font-semibold text-blue-600 dark:text-blue-400">{currentBalance.used_days}</span>
                </span>
                <span className={`font-semibold ${currentBalance.remaining <= 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  Còn lại: {currentBalance.remaining} ngày
                </span>
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Từ ngày</label>
              <DateInput value={startDate} onChange={setStartDate} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Đến ngày</label>
              <DateInput value={endDate} onChange={setEndDate} className={inputCls} />
            </div>
          </div>

          {/* Half-day options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nửa ngày đầu</label>
              <select value={startHalf} onChange={e => setStartHalf(e.target.value)} className={inputCls}>
                {HALF_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nửa ngày cuối</label>
              <select value={endHalf} onChange={e => setEndHalf(e.target.value)} className={inputCls}>
                {HALF_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Total Days Display */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Info size={16} className="text-slate-400" />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Tổng số ngày nghỉ: <strong className={`text-lg ${isOverBalance ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>{totalDays}</strong> ngày (không tính T7/CN)
            </span>
          </div>

          {/* Over-balance warning */}
          {isOverBalance && selectedPolicy?.leave_type !== 'unpaid' && (
            <div className="flex items-center gap-2 p-3 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertCircle size={16} />
              Số ngày nghỉ vượt quá số phép còn lại ({currentBalance?.remaining || 0} ngày)
            </div>
          )}

          {/* Document required notice */}
          {selectedPolicy?.requires_document && (
            <div className="flex items-center gap-2 p-3 text-sm text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Upload size={16} />
              Loại nghỉ phép này yêu cầu giấy tờ đính kèm
            </div>
          )}

          {/* Reason */}
          <div>
            <label className={labelCls}>Lý do nghỉ</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Nhập lý do nghỉ phép..."
              className={inputCls + ' resize-none'}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Lưu nháp
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={loading || (isOverBalance && selectedPolicy?.leave_type !== 'unpaid')}
            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Đang gửi...' : 'Gửi duyệt'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestForm;
