import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle2, AlertTriangle, ArrowRight, PackageX } from 'lucide-react';
import { CrmLead, CrmStageTemplate } from '../../../types';
import {
  getRequiredFieldsForStage,
  isLoseStage,
  requiresNote,
  requiresProducts,
  hasProducts,
  type StageFieldConfig,
} from '../../../lib/crm/stageWorkflow';
import SourceSelect from '../shared/SourceSelect';

interface StageTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Trả về field đã điền + ghi chú (bắt buộc với forward/lose/đổi mức). */
  onConfirm: (updatedData: Partial<CrmLead>, note: string) => void;
  targetStage: CrmStageTemplate;
  lead: CrmLead;
  /** Tuỳ biến cho chế độ "đổi mức tiềm năng" (không đổi stage). */
  title?: string;
  noteLabel?: string;
  confirmLabel?: string;
  /** Ghi chú cũ điền sẵn (khi quay lại trạng thái/mức đã từng qua). */
  initialNote?: string;
}

const StageTransitionModal: React.FC<StageTransitionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  targetStage,
  lead,
  title,
  noteLabel,
  confirmLabel,
  initialNote,
}) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  const requiredFields = useMemo<StageFieldConfig[]>(
    () => getRequiredFieldsForStage(targetStage.name),
    [targetStage.name]
  );

  const losing = isLoseStage(targetStage.name);
  const needNote = requiresNote(targetStage.name);
  const needProducts = requiresProducts(targetStage.name);
  const productsOk = hasProducts(lead);

  // Pre-fill form data from lead when modal opens
  useEffect(() => {
    if (isOpen && lead) {
      const initial: Record<string, string> = {};
      requiredFields.forEach((field) => {
        const value = lead[field.key];
        if (value === undefined || value === null) {
          initial[field.key] = '';
        } else if (typeof value === 'number') {
          initial[field.key] = value > 0 ? String(value) : '';
        } else if (typeof value === 'string') {
          initial[field.key] = value;
        } else {
          initial[field.key] = '';
        }
      });
      setFormData(initial);
      setNote(initialNote || '');
    }
  }, [isOpen, lead, requiredFields, initialNote]);

  const allFieldsFilled = useMemo(() => {
    return requiredFields.every((field) => {
      const value = formData[field.key];
      return value && value.trim().length > 0;
    });
  }, [formData, requiredFields]);

  const canConfirm =
    allFieldsFilled &&
    (!needNote || note.trim().length > 0) &&
    (!needProducts || productsOk);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const buildUpdatedData = (): Partial<CrmLead> => {
    const updatedData: Partial<CrmLead> = {};
    requiredFields.forEach((field) => {
      const value = (formData[field.key] || '').trim();
      if (!value) return;
      if (field.type === 'number') {
        (updatedData as any)[field.key] = Number(value.replace(/\D/g, '')) || 0;
      } else {
        (updatedData as any)[field.key] = value;
      }
    });
    return updatedData;
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(buildUpdatedData(), note.trim());
  };

  if (!isOpen) return null;

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-colors';
  const selectCls = inputCls + ' cursor-pointer';

  const headerTitle =
    title || (losing ? 'Đóng lead' : 'Hoàn thành thông tin để chuyển trạng thái');
  const noteFieldLabel =
    noteLabel || (losing ? 'Lý do không tiềm năng' : 'Ghi chú đánh giá');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {headerTitle}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {losing ? 'Nhập lý do để chuyển sang' : 'Cập nhật để chuyển sang'}{' '}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                "{targetStage.name}"
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Cảnh báo sản phẩm bắt buộc (Tiềm năng cao) */}
          {needProducts && !productsOk && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <PackageX size={16} className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Lead chưa có <b>sản phẩm/dịch vụ quan tâm</b>. Hãy thêm ở tab "Sản phẩm" trước khi chuyển sang Tiềm năng cao.
              </p>
            </div>
          )}

          {/* Required structured fields */}
          {requiredFields.map((field) => {
            const value = formData[field.key] || '';
            const isFilled = value.trim().length > 0;

            return (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {isFilled ? (
                    <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle size={16} className="text-amber-500 dark:text-amber-400 shrink-0" />
                  )}
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {field.label}
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                </div>

                {field.type === 'select' ? (
                  field.key === 'source' ? (
                    <SourceSelect
                      value={value}
                      onChange={(val) => handleChange(field.key, val)}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <select
                      value={value}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className={selectCls}
                    >
                      <option value="">{field.placeholder}</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )
                ) : field.type === 'textarea' ? (
                  <textarea
                    value={value}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    className={inputCls + ' resize-none'}
                  />
                ) : field.type === 'number' ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={value ? new Intl.NumberFormat('vi-VN').format(Number(value.replace(/\D/g, '')) || 0) : ''}
                    onChange={(e) => handleChange(field.key, e.target.value.replace(/\D/g, ''))}
                    placeholder={field.placeholder}
                    className={inputCls}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={value}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className={inputCls}
                  />
                )}
              </div>
            );
          })}

          {/* Ghi chú bắt buộc */}
          {needNote && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {note.trim().length > 0 ? (
                  <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-500 dark:text-amber-400 shrink-0" />
                )}
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {noteFieldLabel}
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  losing
                    ? 'Nhập lý do đánh giá không tiềm năng (bắt buộc)...'
                    : 'Nhập nhận định/lý do chuyển trạng thái (bắt buộc)...'
                }
                rows={3}
                className={inputCls + ' resize-none'}
              />
              {initialNote && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Đã điền sẵn lý do từ lần trước — giữ nguyên hoặc chỉnh sửa nếu cần.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-b-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {requiredFields.filter((f) => (formData[f.key] || '').trim()).length}
            /{requiredFields.length} trường đã hoàn thành
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={
                'px-4 py-2 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ' +
                (losing
                  ? 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
                  : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600')
              }
            >
              {confirmLabel || (losing ? 'Đóng lead' : 'Xác nhận chuyển trạng thái')}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StageTransitionModal;
