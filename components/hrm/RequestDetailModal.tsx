import React from 'react';
import { X, FileEdit, Clock, CheckCircle2, XCircle, Ban, Building2, User, Calendar, Package, Car, MapPin } from 'lucide-react';
import { InternalRequest, InternalRequestStatus, InternalRequestType } from '../../types/hrmTypes';
import { formatDateShort } from '../../utils/formatters';

interface Props {
  request: InternalRequest | null;
  onClose: () => void;
  onApprove?: (req: InternalRequest) => void;
  onReject?: (req: InternalRequest) => void;
  onSubmitDraft?: (id: string) => void;
  onCancel?: (id: string) => void;
  onEdit?: (req: InternalRequest) => void;
  canApprove?: boolean;
  actionLoading?: string | null;
}

const TYPE_LABELS: Record<InternalRequestType, string> = {
  meeting_room: 'Đặt phòng họp',
  vehicle: 'Điều xe công tác',
  stationery: 'Mua sắm VPP / Thiết bị',
  other: 'Đề xuất khác',
};

const STATUS_CONFIG: Record<InternalRequestStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  draft:         { label: 'Bản nháp',          icon: <FileEdit size={15} />,     cls: 'text-slate-400 bg-slate-800' },
  pending_unit:  { label: 'Chờ Leader duyệt',  icon: <Clock size={15} />,        cls: 'text-amber-400 bg-amber-900/30' },
  pending_admin: { label: 'Chờ HCNS duyệt',    icon: <Clock size={15} />,        cls: 'text-blue-400 bg-blue-900/30' },
  approved:      { label: 'Đã duyệt',           icon: <CheckCircle2 size={15} />, cls: 'text-emerald-400 bg-emerald-900/30' },
  rejected:      { label: 'Từ chối',            icon: <XCircle size={15} />,      cls: 'text-red-400 bg-red-900/30' },
  cancelled:     { label: 'Đã hủy',             icon: <Ban size={15} />,          cls: 'text-slate-500 bg-slate-800' },
};

const Row: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="flex gap-3 py-3 border-b border-slate-800 last:border-0">
    <div className="mt-0.5 text-slate-500 shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-slate-200 break-words">{value}</p>
    </div>
  </div>
);

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

const RequestDetailModal: React.FC<Props> = ({
  request, onClose, onApprove, onReject, onSubmitDraft, onCancel, onEdit,
  canApprove, actionLoading,
}) => {
  if (!request) return null;

  const req = request;
  const sc = STATUS_CONFIG[req.status];
  const isActioning = actionLoading === req.id;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-start">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500 bg-amber-900/20 px-2 py-0.5 rounded">
                {TYPE_LABELS[req.type]}
              </span>
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sc.cls}`}>
                {sc.icon} {sc.label}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 leading-snug">{req.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-0">

          {/* Người đề xuất & đơn vị */}
          {req.employee_name && (
            <Row icon={<User size={16} />} label="Người đề xuất" value={req.employee_name} />
          )}
          {req.unit_name && (
            <Row icon={<Building2 size={16} />} label="Đơn vị" value={req.unit_name} />
          )}

          {/* Fields theo loại */}
          {(req.type === 'meeting_room' || req.type === 'vehicle') && req.details?.start_time && (
            <Row
              icon={<Calendar size={16} />}
              label="Thời gian"
              value={`${formatDateShort(req.details.start_time)} → ${formatDateShort(req.details.end_time)}`}
            />
          )}

          {req.type === 'meeting_room' && req.details?.room_name && (
            <Row icon={<Building2 size={16} />} label="Phòng họp" value={req.details.room_name} />
          )}

          {req.type === 'vehicle' && req.details?.destination && (
            <Row icon={<MapPin size={16} />} label="Điểm đến / Lộ trình" value={req.details.destination} />
          )}

          {req.type === 'stationery' && req.details?.item_name && (
            <Row icon={<Package size={16} />} label="Vật tư / Thiết bị" value={req.details.item_name} />
          )}
          {req.type === 'stationery' && req.details?.quantity && (
            <Row icon={<Package size={16} />} label="Số lượng" value={`${req.details.quantity}`} />
          )}
          {req.type === 'stationery' && req.details?.estimated_cost && (
            <Row icon={<Package size={16} />} label="Đơn giá dự kiến" value={formatCurrency(req.details.estimated_cost)} />
          )}

          {req.description && (
            <Row icon={<FileEdit size={16} />} label="Chi tiết đề xuất" value={req.description} />
          )}

          <Row icon={<Calendar size={16} />} label="Ngày tạo" value={formatDateShort(req.created_at)} />

          {/* Lịch sử duyệt */}
          {(req.approver_unit_id || req.approver_admin_id) && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Lịch sử phê duyệt</p>
              <div className="space-y-2">
                {req.approver_unit_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span className="text-slate-400">Duyệt cấp Leader</span>
                  </div>
                )}
                {req.approver_admin_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span className="text-slate-400">Duyệt cấp HCNS</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lý do từ chối */}
          {req.status === 'rejected' && req.rejection_reason && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
              <p className="text-xs font-semibold text-red-400 mb-1">Lý do từ chối</p>
              <p className="text-sm text-red-300">{req.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/50 rounded-b-2xl flex justify-end gap-2 flex-wrap">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors">
            Đóng
          </button>

          {/* Thao tác chủ sở hữu (draft / pending_unit) */}
          {req.status === 'draft' && onEdit && (
            <button onClick={() => { onClose(); onEdit(req); }} className="px-4 py-2 text-sm font-medium text-amber-400 bg-amber-900/20 border border-amber-800/50 hover:bg-amber-900/40 rounded-lg transition-colors">
              Sửa
            </button>
          )}
          {(req.status === 'draft' || req.status === 'pending_unit') && onCancel && !canApprove && (
            <button
              onClick={() => { onClose(); onCancel(req.id); }}
              disabled={isActioning}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Hủy đề xuất
            </button>
          )}
          {req.status === 'draft' && onSubmitDraft && (
            <button
              onClick={() => { onClose(); onSubmitDraft(req.id); }}
              disabled={isActioning}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isActioning ? 'Đang xử lý...' : 'Gửi duyệt'}
            </button>
          )}

          {/* Nút phê duyệt — hiện khi user có quyền duyệt đề xuất này */}
          {canApprove && (req.status === 'pending_unit' || req.status === 'pending_admin') && onReject && onApprove && (
            <>
              <button
                onClick={() => { onClose(); onReject(req); }}
                disabled={isActioning}
                className="px-4 py-2 text-sm font-medium text-red-400 bg-red-900/20 border border-red-800/50 hover:bg-red-900/40 rounded-lg transition-colors disabled:opacity-50"
              >
                Không duyệt
              </button>
              <button
                onClick={() => { onClose(); onApprove(req); }}
                disabled={isActioning}
                className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isActioning ? 'Đang duyệt...' : '✓ Phê duyệt'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequestDetailModal;
