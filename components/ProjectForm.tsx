import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, X, MapPin, Building2, Calendar, TrendingUp, FileText, Loader2, FileSignature, Image, Clipboard, Upload } from 'lucide-react';
import DateInput from './ui/DateInput';
import { ProjectService, ContractService, CustomerService } from '../services';
import { BIMProject, BIMProjectStatus, BIM_PROJECT_STATUS_LABELS } from '../types';
import { toast } from 'sonner';
import SearchableSelect from './ui/SearchableSelect';
import { dataClient as supabase } from '../lib/dataClient';
import CustomerForm from './CustomerForm';
import { generateSlug } from '../utils/formatters';
import RichTextEditor from './ui/RichTextEditor';

interface ProjectFormProps {
  project?: BIMProject | null;
  onSave: (project: BIMProject) => void;
  onCancel: () => void;
}

const ALL_STATUSES: BIMProjectStatus[] = ['10_XUCTIEN', '20_BAOGIA', '30_CHUANBI', '40_TRINHTHAMDINH', '50_HOTROQLDA', '60_THANHQUYETTOAN', '70_LUUTRU'];

const STATUS_COLORS: Record<BIMProjectStatus, { bg: string; text: string; border: string; dot: string }> = {
  '10_XUCTIEN':       { bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-700 dark:text-amber-400',     border: 'border-amber-200 dark:border-amber-700',   dot: 'bg-amber-500' },
  '20_BAOGIA':        { bg: 'bg-cyan-50 dark:bg-cyan-900/20',     text: 'text-cyan-700 dark:text-cyan-400',       border: 'border-cyan-200 dark:border-cyan-700',     dot: 'bg-cyan-500' },
  '30_CHUANBI':       { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400',   border: 'border-orange-200 dark:border-orange-700', dot: 'bg-orange-500' },
  '40_TRINHTHAMDINH': { bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-700 dark:text-blue-400',       border: 'border-blue-200 dark:border-blue-700',     dot: 'bg-blue-500' },
  '50_HOTROQLDA':     { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-400',   border: 'border-purple-200 dark:border-purple-700', dot: 'bg-purple-500' },
  '60_THANHQUYETTOAN':{ bg: 'bg-emerald-50 dark:bg-emerald-900/20',text:'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-700',dot: 'bg-emerald-500' },
  '70_LUUTRU':        { bg: 'bg-teal-50 dark:bg-teal-900/20',     text: 'text-teal-700 dark:text-teal-400',       border: 'border-teal-200 dark:border-teal-700',     dot: 'bg-teal-500' },
};

const ProjectForm: React.FC<ProjectFormProps> = ({ project, onSave, onCancel }) => {
  const isEditing = !!project;
  const [saving, setSaving] = useState(false);

  // Form state
  const [code, setCode] = useState(project?.code || '');
  const [name, setName] = useState(project?.name || '');
  const [status, setStatus] = useState<BIMProjectStatus>(project?.status || '10_XUCTIEN');
  const [location, setLocation] = useState(project?.location || '');
  const [customerId, setCustomerId] = useState(project?.customerId || '');
  const [clientName, setClientName] = useState(project?.clientName || '');
  const [progress, setProgress] = useState(project?.progress || 0);
  const [contractValue, setContractValue] = useState(project?.contractValue || 0);
  const [startDate, setStartDate] = useState(project?.startDate || '');
  const [endDate, setEndDate] = useState(project?.endDate || '');
  const [description, setDescription] = useState(project?.description || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(project?.thumbnailUrl || '');
  const [notes, setNotes] = useState(project?.notes || '');
  const [folderPotentialUrl, setFolderPotentialUrl] = useState(project?.folderPotentialUrl || '');
  const [folderOngoingUrl, setFolderOngoingUrl] = useState(project?.folderOngoingUrl || '');
  const [contractId, setContractId] = useState(project?.contractId || '');
  const [endUserId, setEndUserId] = useState(project?.endUserId || '');
  const [endUserName, setEndUserName] = useState(project?.endUserName || '');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerFormType, setCustomerFormType] = useState<'investor' | 'client'>('investor');
  const [contracts, setContracts] = useState<{ id: string; code: string; title: string; customerName?: string; value?: number; startDate?: string; endDate?: string }[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const thumbnailDropRef = useRef<HTMLDivElement>(null);

  // Web CMS & SEO
  const [isPublishedWeb, setIsPublishedWeb] = useState(project?.isPublishedWeb ?? false);
  const [isFeaturedWeb, setIsFeaturedWeb] = useState(project?.isFeaturedWeb ?? false);
  const [slug, setSlug] = useState(project?.slug || '');
  const [summary, setSummary] = useState(project?.summary || '');
  const [seoTitle, setSeoTitle] = useState(project?.seoTitle || '');
  const [seoDescription, setSeoDescription] = useState(project?.seoDescription || '');

  // Auto-generate slug when name changes
  useEffect(() => {
    if (!project && name) {
      setSlug(generateSlug(name));
    }
  }, [name, project]);

  // Fetch contracts for search
  useEffect(() => {
    ContractService.getAll()
      .then((list: any[]) => {
        setContracts(list.map(c => ({
          id: c.id,
          code: c.contractCode || c.contract_code || '',
          title: c.title || c.tenCongTrinh || c.name || '',
          customerName: c.partyA || '',
          value: c.value ? Number(c.value) : undefined,
          startDate: c.startDate || c.start_date || '',
          endDate: c.endDate || c.end_date || '',
        })));
      })
      .catch(() => {});
  }, []);

  // ── Search customers ────────────────────────────────────────────────
  const handleSearchCustomers = useCallback(async (query: string) => {
    const results = await CustomerService.search(query, 20);
    return results.map(c => ({
      id: c.id,
      name: c.name,
      subText: c.shortName || c.address || '',
    }));
  }, []);

  // Get display value for customer
  const getCustomerDisplay = useCallback((id: string) => {
    return clientName || undefined;
  }, [clientName]);

  const getEndUserDisplay = useCallback((id: string) => {
    return endUserName || undefined;
  }, [endUserName]);

  // ── Search contracts ────────────────────────────────────────────────
  const handleSearchContracts = useCallback(async (query: string) => {
    const q = query.toLowerCase();
    return contracts
      .filter(c =>
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.customerName && c.customerName.toLowerCase().includes(q))
      )
      .slice(0, 20)
      .map(c => ({
        id: c.id,
        name: `${c.code} — ${c.title}`,
        subText: c.customerName || undefined,
      }));
  }, [contracts]);

  // Get display value for contract
  const getContractDisplay = useCallback((id: string) => {
    const c = contracts.find(x => x.id === id);
    return c ? `${c.code} — ${c.title}` : undefined;
  }, [contracts]);

  // ── Upload image to Supabase Storage ─────────────────────────────────
  const uploadImageToStorage = useCallback(async (file: File | Blob, fileName?: string) => {
    setUploadingImage(true);
    try {
      const ext = file instanceof File ? file.name.split('.').pop() || 'png' : 'png';
      const path = `project-thumbnails/${Date.now()}_${fileName || 'clipboard'}.${ext}`;

      const { data, error } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type || 'image/png', upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
      if (urlData?.publicUrl) {
        setThumbnailUrl(urlData.publicUrl);
        toast.success('Đã upload ảnh thành công!');
      }
    } catch (err: any) {
      // Fallback: convert to data URL if storage fails
      const reader = new FileReader();
      reader.onload = (e) => {
        setThumbnailUrl(e.target?.result as string);
        toast.success('Đã dán ảnh (lưu dạng inline)');
      };
      reader.readAsDataURL(file as Blob);
    } finally {
      setUploadingImage(false);
    }
  }, []);

  // ── Handle clipboard paste ──────────────────────────────────────────
  const handlePaste = useCallback(async (e: React.ClipboardEvent | ClipboardEvent) => {
    const items = (e as any).clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await uploadImageToStorage(file, 'screenshot');
        }
        return;
      }
    }
  }, [uploadImageToStorage]);

  // ── Handle file input change ──────────────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      uploadImageToStorage(file, file.name);
    }
    e.target.value = '';
  }, [uploadImageToStorage]);

  // Listen for paste on the thumbnail area
  useEffect(() => {
    const el = thumbnailDropRef.current;
    if (!el) return;
    const handler = (e: Event) => handlePaste(e as ClipboardEvent);
    el.addEventListener('paste', handler);
    return () => el.removeEventListener('paste', handler);
  }, [handlePaste]);

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
        customerId: customerId || undefined,
        clientName: clientName.trim() || undefined,
        endUserId: endUserId || undefined,
        endUserName: endUserName.trim() || undefined,
        progress,
        contractValue,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        description: description.trim() || undefined,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        folderPotentialUrl: folderPotentialUrl.trim() || undefined,
        folderOngoingUrl: folderOngoingUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        contractId: contractId || undefined,
        isPublishedWeb,
        isFeaturedWeb,
        slug: slug.trim() || undefined,
        summary: summary.trim() || undefined,
        seoTitle: seoTitle.trim() || undefined,
        seoDescription: seoDescription.trim() || undefined,
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
    <>
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
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(s => {
                const c = STATUS_COLORS[s];
                const isActive = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                      isActive
                        ? `${c.bg} ${c.text} ${c.border} ring-2 ring-current/20`
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? c.dot : 'bg-slate-300 dark:bg-slate-600'}`} />
                    {BIM_PROJECT_STATUS_LABELS[s]}
                  </button>
                );
              })}
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
          <div className="md:col-span-1">
            <label className={labelCls}>
              <Building2 size={12} className="inline mr-1" />
              Chủ đầu tư
            </label>
            <SearchableSelect
              value={customerId || null}
              onChange={(id, option) => {
                setCustomerId(id || '');
                setClientName(option?.name || '');
              }}
              onSearch={handleSearchCustomers}
              placeholder="Gõ tên để tìm..."
              getDisplayValue={getCustomerDisplay}
              onAddNew={() => {
                setCustomerFormType('investor');
                setShowCustomerForm(true);
              }}
              addNewLabel="Thêm Đối tác"
              size="md"
            />
          </div>
          <div className="md:col-span-1">
            <label className={labelCls}>
              <Building2 size={12} className="inline mr-1" />
              Khách hàng
            </label>
            <SearchableSelect
              value={endUserId || null}
              onChange={(id, option) => {
                setEndUserId(id || '');
                setEndUserName(option?.name || '');
              }}
              onSearch={handleSearchCustomers}
              placeholder="Gõ tên để tìm..."
              getDisplayValue={getEndUserDisplay}
              onAddNew={() => {
                setCustomerFormType('client');
                setShowCustomerForm(true);
              }}
              addNewLabel="Thêm Đối tác"
              size="md"
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
            <label className={labelCls}>Giá trị hợp đồng (VNĐ)</label>
            <input
              type="text"
              value={contractValue ? contractValue.toLocaleString('vi-VN') : ''}
              onChange={e => {
                const raw = e.target.value.replace(/\./g, '').replace(/,/g, '');
                setContractValue(Number(raw) || 0);
              }}
              placeholder="VD: 734.191.500"
              className={inputCls}
            />
            {contractValue >= 1_000_000_000 && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                = {(contractValue / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} Tỷ
              </p>
            )}
            {contractValue >= 1_000_000 && contractValue < 1_000_000_000 && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                = {(contractValue / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} Triệu
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
            <DateInput
              value={startDate}
              onChange={setStartDate}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Ngày kết thúc</label>
            <DateInput
              value={endDate}
              onChange={setEndDate}
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
          {/* Contract SearchableSelect */}
          <div className="md:col-span-2">
            <label className={labelCls}>
              <FileSignature size={12} className="inline mr-1" />
              Hợp đồng liên kết
            </label>
            <SearchableSelect
              value={contractId || null}
              onChange={(id) => {
                setContractId(id || '');
                // Auto-fill giá trị và ngày từ hợp đồng
                if (id) {
                  const selected = contracts.find(c => c.id === id);
                  if (selected) {
                    if (selected.value && selected.value > 0) {
                      setContractValue(Math.round(selected.value));
                    }
                    if (selected.startDate) {
                      setStartDate(selected.startDate);
                    }
                    if (selected.endDate) {
                      setEndDate(selected.endDate);
                    }
                    toast.success('Đã tự động nhận giá trị và thời gian từ hợp đồng');
                  }
                }
              }}
              onSearch={handleSearchContracts}
              placeholder="Gõ mã, tên HĐ hoặc tên khách hàng..."
              getDisplayValue={getContractDisplay}
              size="md"
              initialOptions={contracts.slice(0, 10).map(c => ({
                id: c.id,
                name: `${c.code} — ${c.title}`,
                subText: c.customerName || undefined,
              }))}
            />
          </div>

          {/* Thumbnail with clipboard paste */}
          <div className="md:col-span-2">
            <label className={labelCls}>
              <Image size={12} className="inline mr-1" />
              Ảnh thumbnail
            </label>
            <div
              ref={thumbnailDropRef}
              tabIndex={0}
              onPaste={handlePaste}
              className="relative group"
            >
              {thumbnailUrl ? (
                <div className="relative h-40 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img src={thumbnailUrl} alt="Preview" className="w-full h-full object-cover" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setThumbnailUrl('')}
                      className="px-3 py-1.5 bg-white/90 rounded-lg text-xs font-bold text-rose-600 hover:bg-white transition-colors"
                    >
                      <X size={14} className="inline mr-1" />
                      Xóa ảnh
                    </button>
                    <label className="px-3 py-1.5 bg-white/90 rounded-lg text-xs font-bold text-indigo-600 hover:bg-white transition-colors cursor-pointer">
                      <Upload size={14} className="inline mr-1" />
                      Đổi ảnh
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 size={24} className="animate-spin text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-36 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500">
                  {uploadingImage ? (
                    <Loader2 size={24} className="animate-spin text-indigo-500" />
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                        <Clipboard size={20} />
                        <span className="text-sm font-semibold">Ctrl+V để dán ảnh</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer">
                          <Upload size={14} className="inline mr-1" />
                          Chọn file
                          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </label>
                        <span className="text-xs text-slate-400 dark:text-slate-500">hoặc</span>
                        <input
                          type="url"
                          value={thumbnailUrl}
                          onChange={e => setThumbnailUrl(e.target.value)}
                          placeholder="Dán URL ảnh..."
                          className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Link folder lưu trữ tiền dự án (Potential)</label>
            <input
              type="url"
              value={folderPotentialUrl}
              onChange={e => setFolderPotentialUrl(e.target.value)}
              placeholder="VD: https://drive.google.com/..."
              className={inputCls}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelCls}>Link folder lưu trữ triển khai (Ongoing)</label>
            <input
              type="url"
              value={folderOngoingUrl}
              onChange={e => setFolderOngoingUrl(e.target.value)}
              placeholder="VD: https://drive.google.com/..."
              className={inputCls}
            />
          </div>

          <div className="md:col-span-2">
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

      {/* Section 6: Web Content & Description */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <FileText size={16} className="text-indigo-500" />
          Thông tin xuất bản Website
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Đường dẫn tĩnh (Slug)</label>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder="VD: chung-cu-cao-cap-abc"
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-4 mt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublishedWeb}
                onChange={e => setIsPublishedWeb(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Hiển thị trên Web</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFeaturedWeb}
                onChange={e => setIsFeaturedWeb(e.target.checked)}
                className="w-4 h-4 text-orange-500 rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Dự án tiêu biểu</span>
            </label>
          </div>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Tóm tắt ngắn (Summary)</label>
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={2}
            placeholder="Mô tả tóm tắt..."
            className={inputCls + ' resize-none'}
          />
        </div>

        <div className="mt-4">
          <RichTextEditor
            label="Mô tả chi tiết"
            value={description}
            onChange={setDescription}
            minHeight="200px"
          />
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

      {showCustomerForm && (
        <CustomerForm
          isOpen={showCustomerForm}
          onClose={() => setShowCustomerForm(false)}
          defaultType="Customer"
          onSave={async (data) => {
            try {
              let savedCustomer;
              if ('id' in data && data.id) {
                savedCustomer = await CustomerService.update(data.id, data);
              } else {
                savedCustomer = await CustomerService.create(data as any);
              }
              
              if (customerFormType === 'investor') {
                setCustomerId(savedCustomer.id);
                setClientName(savedCustomer.name);
              } else {
                setEndUserId(savedCustomer.id);
                setEndUserName(savedCustomer.name);
              }
              toast.success('Đã chọn đối tác mới');
              setShowCustomerForm(false);
            } catch (err: any) {
              toast.error('Lỗi khi lưu đối tác: ' + (err.message || err));
            }
          }}
        />
      )}
    </>
  );
};

export default ProjectForm;
