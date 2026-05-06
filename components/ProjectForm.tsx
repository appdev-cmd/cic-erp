import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save, X, MapPin, Building2, Calendar, TrendingUp, FileText, Loader2,
  FileSignature, Image, Clipboard, Upload, Plus, Trash2, Layers, Globe, FolderOpen,
} from 'lucide-react';
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

const ALL_STATUSES: BIMProjectStatus[] = ['new', 'active', 'paused', 'done', 'cancelled'];

const STATUS_COLORS: Record<BIMProjectStatus, { bg: string; text: string; border: string; dot: string }> = {
  'new':       { bg: 'bg-slate-50 dark:bg-slate-800',     text: 'text-slate-700 dark:text-slate-300',    border: 'border-slate-300 dark:border-slate-600',   dot: 'bg-slate-400' },
  'active':    { bg: 'bg-indigo-50 dark:bg-indigo-900/20',text: 'text-indigo-700 dark:text-indigo-400',  border: 'border-indigo-300 dark:border-indigo-700', dot: 'bg-indigo-500' },
  'paused':    { bg: 'bg-amber-50 dark:bg-amber-900/20',  text: 'text-amber-700 dark:text-amber-400',    border: 'border-amber-300 dark:border-amber-700',   dot: 'bg-amber-500' },
  'done':      { bg: 'bg-emerald-50 dark:bg-emerald-900/20',text:'text-emerald-700 dark:text-emerald-400',border:'border-emerald-300 dark:border-emerald-700',dot: 'bg-emerald-500' },
  'cancelled': { bg: 'bg-rose-50 dark:bg-rose-900/20',   text: 'text-rose-700 dark:text-rose-400',      border: 'border-rose-300 dark:border-rose-700',     dot: 'bg-rose-500' },
};

const PREDEFINED_SERVICE_TYPES = ['Tư vấn BIM', 'Tư vấn Thẩm tra BIM', 'Tư vấn Đào tạo BIM'];

type TabKey = 'general' | 'finance' | 'documents' | 'website';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'general',   label: 'Thông tin chung', icon: <MapPin size={14} /> },
  { key: 'finance',   label: 'Tài chính',        icon: <TrendingUp size={14} /> },
  { key: 'documents', label: 'Tài liệu',         icon: <FolderOpen size={14} /> },
  { key: 'website',   label: 'Website',          icon: <Globe size={14} /> },
];

const ProjectForm: React.FC<ProjectFormProps> = ({ project, onSave, onCancel }) => {
  const isEditing = !!project;
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('general');

  // ── Core identity (always visible) ─────────────────────────
  const [code, setCode] = useState(project?.code || '');
  const [name, setName] = useState(project?.name || '');
  const [status, setStatus] = useState<BIMProjectStatus>(project?.status || 'new');

  // ── Tab: Thông tin chung ────────────────────────────────────
  const [location, setLocation] = useState(project?.location || '');
  const [customerId, setCustomerId] = useState(project?.customerId || '');
  const [clientName, setClientName] = useState(project?.clientName || '');
  const [endUserId, setEndUserId] = useState(project?.endUserId || '');
  const [endUserName, setEndUserName] = useState(project?.endUserName || '');
  const [startDate, setStartDate] = useState(project?.startDate || '');
  const [endDate, setEndDate] = useState(project?.endDate || '');
  const [contractId, setContractId] = useState(project?.contractId || '');

  // ── Tab: Công trình ─────────────────────────────────────────
  const [constructionType, setConstructionType] = useState(project?.constructionType || '');
  const [constructionGrade, setConstructionGrade] = useState(project?.constructionGrade || '');
  const [area, setArea] = useState(project?.area || 0);
  const [buildingArea, setBuildingArea] = useState(project?.buildingArea || 0);
  const [projectPhase, setProjectPhase] = useState(project?.projectPhase || '');
  // serviceType lưu dạng mảng trong UI, serialize thành chuỗi phân cách "|" khi lưu DB
  const [serviceTypes, setServiceTypes] = useState<string[]>(() => {
    const raw = project?.serviceType || '';
    return raw ? raw.split('|').map(s => s.trim()).filter(Boolean) : [];
  });
  const [customServiceInput, setCustomServiceInput] = useState('');
  const [showCustomServiceInput, setShowCustomServiceInput] = useState(false);
  const [projectGroup, setProjectGroup] = useState(project?.projectGroup || '');

  // ── Tab: Tài chính ──────────────────────────────────────────
  const [contractValue, setContractValue] = useState(project?.contractValue || 0);
  const [progress, setProgress] = useState(project?.progress || 0);

  // ── Tab: Tài liệu ───────────────────────────────────────────
  const [thumbnailUrl, setThumbnailUrl] = useState(project?.thumbnailUrl || '');
  const [folderPotentialUrl, setFolderPotentialUrl] = useState(project?.folderPotentialUrl || '');
  const [folderOngoingUrl, setFolderOngoingUrl] = useState(project?.folderOngoingUrl || '');
  const [notes, setNotes] = useState(project?.notes || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const thumbnailDropRef = useRef<HTMLDivElement>(null);

  // ── Tab: Website ────────────────────────────────────────────
  const [isPublishedWeb, setIsPublishedWeb] = useState(project?.isPublishedWeb ?? false);
  const [isFeaturedWeb, setIsFeaturedWeb] = useState(project?.isFeaturedWeb ?? false);
  const [slug, setSlug] = useState(project?.slug || '');
  const [summary, setSummary] = useState(project?.summary || '');
  const [seoTitle, setSeoTitle] = useState(project?.seoTitle || '');
  const [seoDescription, setSeoDescription] = useState(project?.seoDescription || '');
  const [webCategory, setWebCategory] = useState(project?.webCategory || '');
  const [webClientName, setWebClientName] = useState(project?.webClientName || '');
  const [description, setDescription] = useState(project?.description || '');
  const [webStats, setWebStats] = useState<{ label: string; value: string }[]>(() => {
    let stats: any = project?.webStats;
    if (typeof stats === 'string') { try { stats = JSON.parse(stats); } catch { stats = []; } }
    return Array.isArray(stats) && stats.length > 0
      ? stats
      : [{ label: 'Năm hoàn thành', value: '' }, { label: 'Quy mô', value: '' }];
  });

  // ── Data helpers ────────────────────────────────────────────
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerFormType, setCustomerFormType] = useState<'investor' | 'client'>('investor');
  const [contracts, setContracts] = useState<{ id: string; code: string; title: string; customerName?: string; value?: number; startDate?: string; endDate?: string }[]>([]);

  useEffect(() => {
    if (!project && name) setSlug(generateSlug(name));
  }, [name, project]);

  useEffect(() => {
    ContractService.getAll()
      .then((list: any[]) => setContracts(list.map(c => ({
        id: c.id,
        code: c.contractCode || c.contract_code || '',
        title: c.title || c.tenCongTrinh || c.name || '',
        customerName: c.partyA || '',
        value: c.value ? Number(c.value) : undefined,
        startDate: c.startDate || c.start_date || '',
        endDate: c.endDate || c.end_date || '',
      }))))
      .catch(() => {});
  }, []);

  const handleSearchCustomers = useCallback(async (query: string) => {
    const results = await CustomerService.search(query, 20);
    return results.map(c => ({ id: c.id, name: c.name, subText: c.shortName || c.address || '' }));
  }, []);

  const getCustomerDisplay = useCallback((_id: string) => clientName || undefined, [clientName]);
  const getEndUserDisplay = useCallback((_id: string) => endUserName || undefined, [endUserName]);

  const handleSearchContracts = useCallback(async (query: string) => {
    const q = query.toLowerCase();
    return contracts
      .filter(c => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || (c.customerName && c.customerName.toLowerCase().includes(q)))
      .slice(0, 20)
      .map(c => ({ id: c.id, name: `${c.code} — ${c.title}`, subText: c.customerName || undefined }));
  }, [contracts]);

  const getContractDisplay = useCallback((id: string) => {
    const c = contracts.find(x => x.id === id);
    return c ? `${c.code} — ${c.title}` : undefined;
  }, [contracts]);

  // ── Image upload ────────────────────────────────────────────
  const uploadImageToStorage = useCallback(async (file: File | Blob, fileName?: string) => {
    setUploadingImage(true);
    try {
      const ext = file instanceof File ? file.name.split('.').pop() || 'png' : 'png';
      const path = `project-thumbnails/${Date.now()}_${fileName || 'clipboard'}.${ext}`;
      const { data, error } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type || 'image/png', upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
      if (urlData?.publicUrl) { setThumbnailUrl(urlData.publicUrl); toast.success('Đã upload ảnh thành công!'); }
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => { setThumbnailUrl(e.target?.result as string); toast.success('Đã dán ảnh (lưu dạng inline)'); };
      reader.readAsDataURL(file as Blob);
    } finally { setUploadingImage(false); }
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent | ClipboardEvent) => {
    const items = (e as any).clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await uploadImageToStorage(file, 'screenshot');
        return;
      }
    }
  }, [uploadImageToStorage]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) uploadImageToStorage(file, file.name);
    e.target.value = '';
  }, [uploadImageToStorage]);

  useEffect(() => {
    const el = thumbnailDropRef.current;
    if (!el) return;
    const handler = (e: Event) => handlePaste(e as ClipboardEvent);
    el.addEventListener('paste', handler);
    return () => el.removeEventListener('paste', handler);
  }, [handlePaste]);

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { toast.error('Vui lòng nhập mã dự án'); setActiveTab('general'); return; }
    if (!name.trim()) { toast.error('Vui lòng nhập tên dự án'); setActiveTab('general'); return; }

    setSaving(true);
    try {
      const payload: Partial<BIMProject> = {
        code: code.trim(), name: name.trim(), status,
        location: location.trim() || undefined,
        customerId: customerId || undefined, clientName: clientName.trim() || undefined,
        endUserId: endUserId || undefined, endUserName: endUserName.trim() || undefined,
        startDate: startDate || undefined, endDate: endDate || undefined,
        contractId: contractId || undefined,
        constructionType: constructionType.trim() || undefined,
        constructionGrade: constructionGrade.trim() || undefined,
        area: area || undefined, buildingArea: buildingArea || undefined,
        projectPhase: projectPhase.trim() || undefined,
        serviceType: serviceTypes.length > 0 ? serviceTypes.join(' | ') : undefined,
        projectGroup: projectGroup.trim() || undefined,
        contractValue, progress,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        folderPotentialUrl: folderPotentialUrl.trim() || undefined,
        folderOngoingUrl: folderOngoingUrl.trim() || undefined,
        notes: notes.trim() || undefined,
        isPublishedWeb, isFeaturedWeb,
        slug: slug.trim() || undefined, summary: summary.trim() || undefined,
        seoTitle: seoTitle.trim() || undefined, seoDescription: seoDescription.trim() || undefined,
        webCategory: webCategory.trim() || undefined, webClientName: webClientName.trim() || undefined,
        webStats: JSON.stringify(webStats.filter(s => s.label.trim() || s.value.trim())),
        description: description.trim() || undefined,
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
    } finally { setSaving(false); }
  };

  // ── Styles ──────────────────────────────────────────────────
  const inputCls = 'w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent outline-none transition-all';
  const labelCls = 'block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5';

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col h-full animate-in slide-in-from-bottom-4 duration-300">

        {/* ── Fixed Header ─────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-start justify-between gap-4 mb-4">
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
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          {/* Core identity fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Mã dự án <span className="text-rose-500">*</span></label>
              <input type="text" value={code} onChange={e => setCode(e.target.value)}
                placeholder="VD: CIC-BIM-008" className={inputCls} required />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Tên dự án <span className="text-rose-500">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="VD: Xây dựng mới Bệnh viện Đa khoa khu vực..." className={inputCls} required />
            </div>
          </div>

          {/* Status + Service Type row */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Trạng thái — bên trái */}
            <div>
              <label className={labelCls}>Trạng thái</label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_STATUSES.map(s => {
                  const c = STATUS_COLORS[s];
                  const isActive = status === s;
                  return (
                    <button key={s} type="button" onClick={() => setStatus(s)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                        isActive
                          ? `${c.bg} ${c.text} ${c.border} ring-2 ring-current/20`
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? c.dot : 'bg-slate-300 dark:bg-slate-600'}`} />
                      {BIM_PROJECT_STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Loại dịch vụ — bên phải */}
            <div>
              <label className={labelCls}>Loại dịch vụ</label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {PREDEFINED_SERVICE_TYPES.map(svc => {
                  const isSelected = serviceTypes.includes(svc);
                  return (
                    <button key={svc} type="button"
                      onClick={() => setServiceTypes(prev =>
                        isSelected ? prev.filter(s => s !== svc) : [...prev, svc]
                      )}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400'
                      }`}
                    >
                      {isSelected && <X size={9} />}
                      {svc}
                    </button>
                  );
                })}
                {/* Tags tùy chỉnh đã thêm */}
                {serviceTypes.filter(s => !PREDEFINED_SERVICE_TYPES.includes(s)).map(svc => (
                  <span key={svc}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border bg-violet-600 text-white border-violet-600">
                    {svc}
                    <button type="button" onClick={() => setServiceTypes(prev => prev.filter(s => s !== svc))}>
                      <X size={9} />
                    </button>
                  </span>
                ))}
                {/* Nút thêm mới */}
                {showCustomServiceInput ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={customServiceInput}
                      onChange={e => setCustomServiceInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = customServiceInput.trim();
                          if (val && !serviceTypes.includes(val)) setServiceTypes(prev => [...prev, val]);
                          setCustomServiceInput('');
                          setShowCustomServiceInput(false);
                        }
                        if (e.key === 'Escape') { setCustomServiceInput(''); setShowCustomServiceInput(false); }
                      }}
                      placeholder="Tên dịch vụ..."
                      autoFocus
                      className="w-36 px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-indigo-400 dark:border-indigo-600 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button type="button"
                      onClick={() => {
                        const val = customServiceInput.trim();
                        if (val && !serviceTypes.includes(val)) setServiceTypes(prev => [...prev, val]);
                        setCustomServiceInput('');
                        setShowCustomServiceInput(false);
                      }}
                      className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded">
                      <Save size={12} />
                    </button>
                    <button type="button" onClick={() => { setCustomServiceInput(''); setShowCustomServiceInput(false); }}
                      className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowCustomServiceInput(true)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all">
                    <Plus size={10} /> Thêm khác
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab Bar ──────────────────────────────────────────── */}
        <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6">
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {TABS.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                    isActive
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className={isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab Content ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
          <div className="p-6 space-y-4 max-w-4xl">

            {/* TAB 1: Thông tin chung */}
            {activeTab === 'general' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Địa điểm & Đối tác */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <MapPin size={13} className="text-indigo-500" /> Địa điểm & Đối tác
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className={labelCls}>Địa điểm</label>
                      <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                        placeholder="VD: Phường Điện Biên Phủ, TP. Hồ Chí Minh" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>
                        <Building2 size={11} className="inline mr-1" />Chủ đầu tư
                      </label>
                      <SearchableSelect
                        value={customerId || null}
                        onChange={(id, option) => { setCustomerId(id || ''); setClientName(option?.name || ''); }}
                        onSearch={handleSearchCustomers}
                        placeholder="Gõ tên để tìm..."
                        getDisplayValue={getCustomerDisplay}
                        onAddNew={() => { setCustomerFormType('investor'); setShowCustomerForm(true); }}
                        addNewLabel="Thêm Đối tác"
                        size="md"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>
                        <Building2 size={11} className="inline mr-1" />Khách hàng
                      </label>
                      <SearchableSelect
                        value={endUserId || null}
                        onChange={(id, option) => { setEndUserId(id || ''); setEndUserName(option?.name || ''); }}
                        onSearch={handleSearchCustomers}
                        placeholder="Gõ tên để tìm..."
                        getDisplayValue={getEndUserDisplay}
                        onAddNew={() => { setCustomerFormType('client'); setShowCustomerForm(true); }}
                        addNewLabel="Thêm Đối tác"
                        size="md"
                      />
                    </div>
                  </div>
                </div>

                {/* Quy mô dự án */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Layers size={13} className="text-indigo-500" /> Quy mô dự án
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Loại công trình</label>
                      <select value={constructionType} onChange={e => setConstructionType(e.target.value)} className={inputCls}>
                        <option value="">-- Chọn loại --</option>
                        <option value="Dân dụng">Dân dụng</option>
                        <option value="Công nghiệp">Công nghiệp</option>
                        <option value="Hạ tầng">Hạ tầng</option>
                        <option value="Nông nghiệp">Nông nghiệp</option>
                        <option value="Quốc phòng">Quốc phòng</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Cấp công trình</label>
                      <select value={constructionGrade} onChange={e => setConstructionGrade(e.target.value)} className={inputCls}>
                        <option value="">-- Chọn cấp --</option>
                        <option value="Cấp đặc biệt">Cấp đặc biệt</option>
                        <option value="Cấp I">Cấp I</option>
                        <option value="Cấp II">Cấp II</option>
                        <option value="Cấp III">Cấp III</option>
                        <option value="Cấp IV">Cấp IV</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Diện tích sàn (m²)</label>
                      <input type="number" value={area || ''} onChange={e => setArea(Number(e.target.value) || 0)}
                        placeholder="VD: 38500" min={0} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Diện tích xây dựng (m²)</label>
                      <input type="number" value={buildingArea || ''} onChange={e => setBuildingArea(Number(e.target.value) || 0)}
                        placeholder="VD: 12000" min={0} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Giai đoạn thực hiện</label>
                      <input type="text" value={projectPhase} onChange={e => setProjectPhase(e.target.value)}
                        placeholder="VD: Thiết kế cơ sở, Thiết kế kỹ thuật..." className={inputCls} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Nhóm dự án</label>
                      <div className="flex gap-3">
                        {['A', 'B'].map(group => (
                          <button key={group} type="button"
                            onClick={() => setProjectGroup(projectGroup === group ? '' : group)}
                            className={`flex-1 py-2.5 text-sm font-black rounded-lg border transition-all ${
                              projectGroup === group
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                            }`}
                          >
                            Nhóm {group}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Tài chính */}
            {activeTab === 'finance' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Hợp đồng liên kết */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FileSignature size={13} className="text-indigo-500" /> Hợp đồng liên kết
                  </h3>
                  <SearchableSelect
                    value={contractId || null}
                    onChange={(id) => {
                      setContractId(id || '');
                      if (id) {
                        const selected = contracts.find(c => c.id === id);
                        if (selected) {
                          if (selected.value && selected.value > 0) setContractValue(Math.round(selected.value));
                          if (selected.startDate) setStartDate(selected.startDate);
                          if (selected.endDate) setEndDate(selected.endDate);
                          toast.success('Đã tự động nhận giá trị và thời gian từ hợp đồng');
                        }
                      }
                    }}
                    onSearch={handleSearchContracts}
                    placeholder="Gõ mã, tên HĐ hoặc tên khách hàng..."
                    getDisplayValue={getContractDisplay}
                    size="md"
                    initialOptions={contracts.slice(0, 10).map(c => ({
                      id: c.id, name: `${c.code} — ${c.title}`, subText: c.customerName || undefined,
                    }))}
                  />
                </div>

                {/* Thời gian thực hiện */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Calendar size={13} className="text-indigo-500" /> Thời gian thực hiện
                    </h3>
                    {contractId && (startDate || endDate) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-md text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                        <FileSignature size={10} /> Liên kết từ hợp đồng
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Ngày bắt đầu</label>
                      <DateInput value={startDate} onChange={setStartDate} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Ngày kết thúc</label>
                      <DateInput value={endDate} onChange={setEndDate} className={inputCls} />
                    </div>
                  </div>
                </div>

                {/* Giá trị & Tiến độ */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <TrendingUp size={13} className="text-indigo-500" /> Giá trị & Tiến độ
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1.5">
                          ≈ {(contractValue / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} Tỷ đồng
                        </p>
                      )}
                      {contractValue >= 1_000_000 && contractValue < 1_000_000_000 && (
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-1.5">
                          ≈ {(contractValue / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} Triệu đồng
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>Tiến độ thực hiện</label>
                      <div className="flex items-center gap-3 mt-1">
                        <input type="range" value={progress} onChange={e => setProgress(Number(e.target.value))}
                          min={0} max={100} step={1} className="flex-1 accent-indigo-600" />
                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 w-14 text-right tabular-nums">{progress}%</span>
                      </div>
                      <div className="h-2.5 mt-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${progress}%`,
                            background: progress === 100
                              ? 'linear-gradient(to right, #10b981, #059669)'
                              : 'linear-gradient(to right, #6366f1, #8b5cf6)',
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Value display card */}
                {contractValue > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Giá trị HĐ', value: (contractValue / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' Tr', color: 'text-indigo-600 dark:text-indigo-400' },
                      { label: 'Đã thực hiện', value: ((contractValue * progress / 100) / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' Tr', color: 'text-emerald-600 dark:text-emerald-400' },
                      { label: 'Còn lại', value: ((contractValue * (100 - progress) / 100) / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' Tr', color: 'text-amber-600 dark:text-amber-400' },
                    ].map(item => (
                      <div key={item.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{item.label}</p>
                        <p className={`text-base font-black ${item.color} tabular-nums`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Tài liệu */}
            {activeTab === 'documents' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Thumbnail */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Image size={13} className="text-indigo-500" /> Ảnh đại diện
                  </h3>
                  <div ref={thumbnailDropRef} tabIndex={0} onPaste={handlePaste} className="relative group">
                    {thumbnailUrl ? (
                      <div className="relative h-48 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img src={thumbnailUrl} alt="Preview" className="w-full h-full object-cover"
                          onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <button type="button" onClick={() => setThumbnailUrl('')}
                            className="px-3 py-1.5 bg-white/90 rounded-lg text-xs font-bold text-rose-600 hover:bg-white transition-colors">
                            <X size={14} className="inline mr-1" />Xóa ảnh
                          </button>
                          <label className="px-3 py-1.5 bg-white/90 rounded-lg text-xs font-bold text-indigo-600 hover:bg-white transition-colors cursor-pointer">
                            <Upload size={14} className="inline mr-1" />Đổi ảnh
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
                      <div className="h-36 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer">
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
                                <Upload size={14} className="inline mr-1" />Chọn file
                                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                              </label>
                              <span className="text-xs text-slate-400 dark:text-slate-500">hoặc</span>
                              <input type="url" value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)}
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

                {/* Folder links */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FolderOpen size={13} className="text-indigo-500" /> Link lưu trữ hồ sơ
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>Folder tiền dự án (Potential)</label>
                      <input type="url" value={folderPotentialUrl} onChange={e => setFolderPotentialUrl(e.target.value)}
                        placeholder="https://drive.google.com/..." className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Folder triển khai (Ongoing)</label>
                      <input type="url" value={folderOngoingUrl} onChange={e => setFolderOngoingUrl(e.target.value)}
                        placeholder="https://drive.google.com/..." className={inputCls} />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FileText size={13} className="text-indigo-500" /> Ghi chú
                  </h3>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Ghi chú thêm về dự án..." rows={4}
                    className={inputCls + ' resize-none'} />
                </div>
              </div>
            )}

            {/* TAB 4: Website */}
            {activeTab === 'website' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Publish settings */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Globe size={13} className="text-indigo-500" /> Cài đặt xuất bản
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Đường dẫn tĩnh (Slug)</label>
                      <input type="text" value={slug} onChange={e => setSlug(e.target.value)}
                        placeholder="VD: chung-cu-cao-cap-abc" className={inputCls} />
                    </div>
                    <div className="flex items-end gap-6 pb-1">
                      <label className="flex items-center gap-2.5 cursor-pointer group">
                        <div className={`relative w-10 h-5.5 rounded-full transition-colors ${isPublishedWeb ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                          onClick={() => setIsPublishedWeb(!isPublishedWeb)}>
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublishedWeb ? 'translate-x-4.5' : ''}`} />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Hiển thị Web</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer group">
                        <div className={`relative w-10 h-5.5 rounded-full transition-colors ${isFeaturedWeb ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                          onClick={() => setIsFeaturedWeb(!isFeaturedWeb)}>
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isFeaturedWeb ? 'translate-x-4.5' : ''}`} />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tiêu biểu</span>
                      </label>
                    </div>
                    <div>
                      <label className={labelCls}>Lĩnh vực (Web Category)</label>
                      <input type="text" value={webCategory} onChange={e => setWebCategory(e.target.value)}
                        placeholder="VD: Cầu đường, Toà nhà thương mại..." className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Khách hàng hiển thị Web</label>
                      <input type="text" value={webClientName} onChange={e => setWebClientName(e.target.value)}
                        placeholder="VD: Tập đoàn Vingroup" className={inputCls} />
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <TrendingUp size={13} className="text-indigo-500" /> Chỉ số dự án (Project Stats)
                  </h3>
                  <div className="space-y-2">
                    {webStats.map((stat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-5 text-center">{idx + 1}</span>
                        <input type="text" value={stat.label}
                          onChange={e => { const s = [...webStats]; s[idx].label = e.target.value; setWebStats(s); }}
                          placeholder="Nhãn (VD: Diện tích)" className={inputCls} />
                        <input type="text" value={stat.value}
                          onChange={e => { const s = [...webStats]; s[idx].value = e.target.value; setWebStats(s); }}
                          placeholder="Giá trị (VD: 15,000 m²)" className={inputCls} />
                        <button type="button" onClick={() => setWebStats(webStats.filter((_, i) => i !== idx))}
                          className="p-2 text-rose-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all shrink-0">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setWebStats([...webStats, { label: '', value: '' }])}
                      className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-1 transition-colors">
                      <Plus size={13} /> Thêm chỉ số
                    </button>
                  </div>
                </div>

                {/* SEO & Description */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <FileText size={13} className="text-indigo-500" /> Nội dung & SEO
                  </h3>
                  <div>
                    <label className={labelCls}>Tóm tắt ngắn (Summary)</label>
                    <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2}
                      placeholder="Mô tả tóm tắt hiển thị trên danh sách..." className={inputCls + ' resize-none'} />
                  </div>
                  <div>
                    <RichTextEditor label="Mô tả chi tiết" value={description} onChange={setDescription} minHeight="200px" />
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Sticky Footer ─────────────────────────────────────── */}
        <div className="shrink-0 px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          {/* Tab navigation hints */}
          <div className="flex items-center gap-1">
            {TABS.map((tab, i) => {
              const isActive = activeTab === tab.key;
              const isDone = TABS.findIndex(t => t.key === activeTab) > i;
              return (
                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    isActive ? 'bg-indigo-500 w-6' : isDone ? 'bg-indigo-300 dark:bg-indigo-700' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                  title={tab.label}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            {/* Prev / Next tab */}
            <div className="flex gap-1">
              {TABS.findIndex(t => t.key === activeTab) > 0 && (
                <button type="button"
                  onClick={() => setActiveTab(TABS[TABS.findIndex(t => t.key === activeTab) - 1].key)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all">
                  ← Trước
                </button>
              )}
              {TABS.findIndex(t => t.key === activeTab) < TABS.length - 1 && (
                <button type="button"
                  onClick={() => setActiveTab(TABS[TABS.findIndex(t => t.key === activeTab) + 1].key)}
                  className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all">
                  Tiếp →
                </button>
              )}
            </div>
            <button type="button" onClick={onCancel}
              className="px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all">
              Hủy
            </button>
            <button type="submit" disabled={saving}
              className="px-7 py-2.5 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {saving ? <><Loader2 size={16} className="animate-spin" /> Đang lưu...</>
                : <><Save size={16} /> {isEditing ? 'Cập nhật' : 'Tạo dự án'}</>}
            </button>
          </div>
        </div>
      </form>

      {showCustomerForm && (
        <CustomerForm isOpen={showCustomerForm} onClose={() => setShowCustomerForm(false)} defaultType="Customer"
          onSave={async (data) => {
            try {
              let savedCustomer;
              if ('id' in data && data.id) {
                savedCustomer = await CustomerService.update(data.id, data);
              } else {
                savedCustomer = await CustomerService.create(data as any);
              }
              if (customerFormType === 'investor') { setCustomerId(savedCustomer.id); setClientName(savedCustomer.name); }
              else { setEndUserId(savedCustomer.id); setEndUserName(savedCustomer.name); }
              toast.success('Đã chọn đối tác mới');
              setShowCustomerForm(false);
            } catch (err: any) { toast.error('Lỗi khi lưu đối tác: ' + (err.message || err)); }
          }}
        />
      )}
    </>
  );
};

export default ProjectForm;
