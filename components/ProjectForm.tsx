import React, { useState, useEffect } from 'react';
import { Save, X, MapPin, Building2, Calendar, TrendingUp, FileText, Loader2, FileSignature } from 'lucide-react';
import { ProjectService, ContractService } from '../services';
import { BIMProject, BIMProjectStatus, BIM_PROJECT_STATUS_LABELS } from '../types';
import { toast } from 'sonner';

interface ProjectFormProps {
  project?: BIMProject | null;
  onSave: (project: BIMProject) => void;
  onCancel: () => void;
}

const ALL_STATUSES: BIMProjectStatus[] = ['10_XUCTIEN', '20_BAOGIA', '30_CHUANBI', '40_TRINHTHAMDINH', '50_HOTROQLDA', '60_THANHQUYETTOAN', '70_LUUTRU'];

const STATUS_COLORS: Record<BIMProjectStatus, string> = {
  '10_XUCTIEN': 'bg-amber-500',
  '20_BAOGIA': 'bg-cyan-500',
  '30_CHUANBI': 'bg-orange-500',
  '40_TRINHTHAMDINH': 'bg-blue-500',
  '50_HOTROQLDA': 'bg-purple-500',
  '60_THANHQUYETTOAN': 'bg-emerald-500',
  '70_LUUTRU': 'bg-teal-500',
};

const ProjectForm: React.FC<ProjectFormProps> = ({ project, onSave, onCancel }) => {
  const isEditing = !!project;
  const [saving, setSaving] = useState(false);

  // Form state
  const [code, setCode] = useState(project?.code || '');
  const [name, setName] = useState(project?.name || '');
  const [status, setStatus] = useState<BIMProjectStatus>(project?.status || '10_XUCTIEN');
  const [location, setLocation] = useState(project?.location || '');
  const [clientName, setClientName] = useState(project?.clientName || '');
  const [progress, setProgress] = useState(project?.progress || 0);
  const [contractValue, setContractValue] = useState(project?.contractValue || 0);
  const [startDate, setStartDate] = useState(project?.startDate || '');
  const [endDate, setEndDate] = useState(project?.endDate || '');
  const [description, setDescription] = useState(project?.description || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(project?.thumbnailUrl || '');
  const [notes, setNotes] = useState(project?.notes || '');
  const [contractId, setContractId] = useState(project?.contractId || '');
  const [contracts, setContracts] = useState<{ id: string; code: string; title: string }[]>([]);

  // Fetch contracts for dropdown
  useEffect(() => {
    ContractService.getAll()
      .then((list: any[]) => {
        setContracts(list.map(c => ({
          id: c.id,
          code: c.contractCode || c.contract_code || '',
          title: c.title || c.tenCongTrinh || c.name || '',
        })));
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) { toast.error('Vui lòng nhập mã dự án'); return; }
    if (!name.trim()) { toast.error('Vui lòng nhập tên dự án'); return; }

    setSaving(true);
    try {
      const payload: Partial<BIMProject> = {
        code: code.trim(),
        name: name.trim(),
        status,
        location: location.trim() || undefined,
        clientName: clientName.trim() || undefined,
        progress,
        contractValue,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        description: description.trim() || undefined,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        contractId: contractId || undefined,
      };

      let result: BIMProject;
      if (isEditing && project) {
        result = await ProjectService.update(project.id, payload);
        toast.success('Đã cập nhật dự án thành công!');
      } else {
        result = await ProjectService.create(payload);
        toast.success('Đã tạo dự án mới thành công!');
      }
      onSave(result);
    } catch (err: any) {
      toast.error('Lỗi lưu dự án: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // ── Input classes ─────────────────────────────────────────────────────
  const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent outline-none transition-all';
  const labelCls = 'block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
            {isEditing ? 'Chỉnh sửa dự án' : 'Tạo dự án mới'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isEditing ? `Cập nhật thông tin cho ${project?.code}` : 'Nhập thông tin dự án tư vấn BIM'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
        >
          <X size={20} />
        </button>
      </div>

      {/* Section 1: Thông tin cơ bản */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <FileText size={16} className="text-indigo-500" />
          Thông tin cơ bản
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Mã dự án <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="VD: CIC-BIM-008"
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Trạng thái</label>
            <div className="relative">
              <select
                value={status}
                onChange={e => setStatus(e.target.value as BIMProjectStatus)}
                className={inputCls + ' appearance-none cursor-pointer'}
              >
                {ALL_STATUSES.map(s => (
                  <option key={s} value={s}>{BIM_PROJECT_STATUS_LABELS[s]}</option>
                ))}
              </select>
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Tên dự án <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="VD: Xây dựng mới Bệnh viện Đa khoa khu vực..."
              className={inputCls}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Mô tả</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Mô tả chi tiết dự án..."
              rows={3}
              className={inputCls + ' resize-none'}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Vị trí & Chủ đầu tư */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-indigo-500" />
          Vị trí & Chủ đầu tư
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Địa điểm</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="VD: Phường Điện Biên Phủ, TP. Hồ Chí Minh"
              className={inputCls}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Chủ đầu tư</label>
            <input
              type="text"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="VD: Sở Y tế TP.HCM"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Tài chính & Tiến độ */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-500" />
          Tài chính & Tiến độ
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Giá trị hợp đồng (triệu đồng)</label>
            <input
              type="number"
              value={contractValue || ''}
              onChange={e => setContractValue(Number(e.target.value) || 0)}
              placeholder="VD: 319900"
              className={inputCls}
              min={0}
            />
            {contractValue > 0 && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                = {(contractValue / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} Tỷ
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Tiến độ (%)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                value={progress}
                onChange={e => setProgress(Number(e.target.value))}
                min={0}
                max={100}
                step={1}
                className="flex-1 accent-indigo-600"
              />
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 w-12 text-right">{progress}%</span>
            </div>
            <div className="h-2 mt-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Thời gian */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-indigo-500" />
          Thời gian
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Ngày bắt đầu</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Ngày kết thúc</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Section 5: Bổ sung */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-indigo-500" />
          Thông tin bổ sung
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>
              <FileSignature size={12} className="inline mr-1" />
              Hợp đồng liên kết
            </label>
            <select
              value={contractId}
              onChange={e => setContractId(e.target.value)}
              className={inputCls + ' appearance-none cursor-pointer'}
            >
              <option value="">— Chưa gắn hợp đồng —</option>
              {contracts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>URL ảnh thumbnail</label>
            <input
              type="url"
              value={thumbnailUrl}
              onChange={e => setThumbnailUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className={inputCls}
            />
            {thumbnailUrl && (
              <div className="mt-2 h-32 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                <img src={thumbnailUrl} alt="Preview" className="w-full h-full object-cover" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Ghi chú</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ghi chú thêm..."
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-2.5 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <><Loader2 size={16} className="animate-spin" /> Đang lưu...</>
          ) : (
            <><Save size={16} /> {isEditing ? 'Cập nhật' : 'Tạo dự án'}</>
          )}
        </button>
      </div>
    </form>
  );
};

export default ProjectForm;
