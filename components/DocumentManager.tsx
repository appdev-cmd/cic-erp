
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Database,
  FolderOpen,
  Search,
  Filter,
  Upload,
  X,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Bot,
  CheckCircle2,
  Clock,
  HardDrive,
  Tag,
  ExternalLink,
  MoreVertical,
  Grid,
  List,
  ChevronDown,
  Menu,
  Settings,
  Folder,
  Loader2,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  Sparkles,
  Link2
} from 'lucide-react';
import {
  DocumentRegistryService,
  DocumentRegistryItem,
  DocCategory,
  DOC_CATEGORY_LABELS,
  DOC_CATEGORY_COLORS,
  StorageStats,
  type DocumentRegistryFilter,
  type SourceType,
} from '../services/documentRegistryService';
import { formatDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';

// Sub-components
import DocumentSidebar from './document-manager/DocumentSidebar';
import DocumentExplorer from './document-manager/DocumentExplorer';
import DocumentPreview from './document-manager/DocumentPreview';
import { FolderMappingRow, DriveInitService } from '../services/driveInitService';
import { indexDocument, type IndexingProgress } from '../services/documentIndexingService';

// ============================================
// Tab types
// ============================================
type ViewTab = 'registry' | 'drive';

// ============================================
// Helpers
// ============================================

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const getFileIcon = (mimeType: string | null, fileName: string) => {
  const m = mimeType || '';
  if (m.includes('pdf') || fileName.endsWith('.pdf')) return <FileText size={18} className="text-rose-500" />;
  if (m.includes('sheet') || m.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.csv')) return <FileSpreadsheet size={18} className="text-emerald-500" />;
  if (m.includes('document') || m.includes('word') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) return <FileText size={18} className="text-indigo-500" />;
  if (m.includes('image')) return <ImageIcon size={18} className="text-purple-500" />;
  if (m.includes('presentation') || fileName.endsWith('.pptx')) return <FileText size={18} className="text-orange-500" />;
  return <File size={18} className="text-slate-400 dark:text-slate-500" />;
};

const getCategoryBadge = (cat: DocCategory) => {
  const color = DOC_CATEGORY_COLORS[cat] || 'slate';
  const label = DOC_CATEGORY_LABELS[cat] || cat;
  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
      bg-${color}-50 text-${color}-600 dark:bg-${color}-900/20 dark:text-${color}-400
      border border-${color}-100 dark:border-${color}-800/40
    `}>
      {label}
    </span>
  );
};

// ============================================
// Upload Dialog
// ============================================

interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId?: string;
}

const UploadDialog: React.FC<UploadDialogProps> = ({ isOpen, onClose, onSuccess, userId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [docCategory, setDocCategory] = useState<DocCategory>('general');
  const [tagsInput, setTagsInput] = useState('');
  const [sourceType, setSourceType] = useState<'pasted_text' | 'external_link'>('external_link');
  const [sourceUrl, setSourceUrl] = useState('');
  const [entityType, setEntityType] = useState<string>('');
  const [entityId, setEntityId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setDescription('');
    setDocCategory('general');
    setTagsInput('');
    setSourceUrl('');
    setEntityType('');
    setEntityId('');
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Vui lòng nhập tiêu đề'); return; }

    setSubmitting(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      
      await DocumentRegistryService.create({
        title: title.trim(),
        description: description.trim() || undefined,
        docCategory,
        tags,
        sourceType: sourceUrl ? 'external_link' : 'pasted_text',
        sourceUrl: sourceUrl || undefined,
        fileName: file ? file.name : title.trim(),
        mimeType: file?.type,
        fileSize: file?.size || 0,
        entityType: (entityType as any) || undefined,
        entityId: entityId || undefined,
        uploadedBy: userId,
      });
      
      toast.success('Đã thêm tài liệu vào hệ thống');
      resetForm();
      onClose();
      onSuccess();
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputCls = 'w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400';
  const labelCls = 'block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
              <Plus size={18} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Thêm tài liệu</h3>
              <p className="text-[10px] text-slate-400 font-bold">Đăng ký tài liệu vào hệ thống quản lý</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className={labelCls}>Tiêu đề *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputCls} placeholder="Tên tài liệu..." required />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Mô tả</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className={`${inputCls} h-20 resize-none`} placeholder="Mô tả ngắn về nội dung..." />
          </div>

          {/* Category + Tags */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Danh mục</label>
              <select value={docCategory} onChange={e => setDocCategory(e.target.value as DocCategory)} className={inputCls}>
                {Object.entries(DOC_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tags (phẩy phân cách)</label>
              <input type="text" value={tagsInput} onChange={e => setTagsInput(e.target.value)} className={inputCls} placeholder="hd, bim, 2026..." />
            </div>
          </div>

          {/* Source URL */}
          <div>
            <label className={labelCls}>Đường dẫn tài liệu (Google Drive / URL)</label>
            <div className="relative">
              <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} className={`${inputCls} pl-9`} placeholder="https://drive.google.com/..." />
            </div>
          </div>

          {/* Entity Link */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Liên kết với</label>
              <select value={entityType} onChange={e => setEntityType(e.target.value)} className={inputCls}>
                <option value="">— Không —</option>
                <option value="contract">Hợp đồng</option>
                <option value="employee">Nhân viên</option>
                <option value="project">Dự án</option>
                <option value="customer">Đối tác</option>
                <option value="unit">Đơn vị</option>
              </select>
            </div>
            {entityType && (
              <div>
                <label className={labelCls}>Mã / ID</label>
                <input type="text" value={entityId} onChange={e => setEntityId(e.target.value)} className={inputCls} placeholder="VD: HD-001..." />
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg shadow-lg shadow-indigo-200/50 dark:shadow-none transition-all disabled:opacity-50 flex items-center gap-2">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {submitting ? 'Đang lưu...' : 'Thêm tài liệu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// KPI Card
// ============================================

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, icon, color }) => (
  <div className={`
    bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800
    p-4 flex items-center gap-3 hover:shadow-lg hover:shadow-${color}-100/30 dark:hover:shadow-none transition-all
  `}>
    <div className={`p-2.5 rounded-xl bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-100 dark:border-${color}-800/40`}>
      {icon}
    </div>
    <div>
      <div className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">{value}</div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
    </div>
  </div>
);

// ============================================
// Main Component
// ============================================

const DocumentManager: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<ViewTab>('registry');

  // Registry state
  const [documents, setDocuments] = useState<DocumentRegistryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocCategory | ''>('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() =>
    (localStorage.getItem('cic-doc-viewmode') as any) || 'list'
  );
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [indexingDoc, setIndexingDoc] = useState<string | null>(null); // doc ID đang index
  const [indexProgress, setIndexProgress] = useState<IndexingProgress | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentRegistryItem | null>(null);

  // Drive state (old)
  const [mappings, setMappings] = useState<FolderMappingRow[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // ============================================
  // Load data
  // ============================================

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const filter: DocumentRegistryFilter = {
        search: searchTerm || undefined,
        docCategory: (categoryFilter as DocCategory) || undefined,
        limit: 100,
      };
      const result = await DocumentRegistryService.list(filter);
      setDocuments(result.data);
      setTotalCount(result.count);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter]);

  const loadStats = useCallback(async () => {
    try {
      const s = await DocumentRegistryService.getStorageStats();
      setStats(s);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, []);

  const loadMappings = useCallback(async () => {
    try {
      const data = await DriveInitService.getAllMappings();
      setMappings(data);
    } catch (err) {
      console.error('Error loading drive mappings:', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'registry') {
      loadDocuments();
      loadStats();
    } else {
      loadMappings();
    }
  }, [activeTab, loadDocuments, loadStats, loadMappings]);

  const handleSetViewMode = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    localStorage.setItem('cic-doc-viewmode', mode);
  };

  const handleDelete = async (doc: DocumentRegistryItem) => {
    if (!confirm(`Xóa "${doc.title}" khỏi hệ thống?`)) return;
    try {
      await DocumentRegistryService.delete(doc.id);
      toast.success('Đã xóa tài liệu');
      loadDocuments();
      loadStats();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleIndexAI = async (doc: DocumentRegistryItem) => {
    if (indexingDoc) { toast.warning('Đang xử lý tài liệu khác, vui lòng đợi'); return; }
    setIndexingDoc(doc.id);
    setIndexProgress(null);
    try {
      const result = await indexDocument(doc, undefined, (p) => {
        setIndexProgress(p);
      });
      if (result.success) {
        toast.success(`AI đã đọc "${doc.title}" — ${result.chunks} đoạn`);
        loadDocuments();
        loadStats();
      } else {
        toast.error(`Lỗi: ${result.error}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIndexingDoc(null);
      setIndexProgress(null);
    }
  };

  const handleBatchIndex = async () => {
    const unindexed = documents.filter(d => !d.isAiIndexed);
    if (unindexed.length === 0) { toast.info('Tất cả tài liệu đã được AI đọc!'); return; }
    if (!confirm(`AI sẽ đọc ${unindexed.length} tài liệu chưa được index. Tiếp tục?`)) return;

    let success = 0;
    let failed = 0;
    for (const doc of unindexed) {
      setIndexingDoc(doc.id);
      setIndexProgress({ progress: Math.round((success + failed) / unindexed.length * 100), message: `[${success + failed + 1}/${unindexed.length}] ${doc.title}` });
      try {
        const result = await indexDocument(doc, undefined, (p) => {
          setIndexProgress({ ...p, message: `[${success + failed + 1}/${unindexed.length}] ${p.message}` });
        });
        if (result.success) success++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setIndexingDoc(null);
    setIndexProgress(null);
    loadDocuments();
    loadStats();
    toast.success(`Hoàn tất: ${success} thành công, ${failed} lỗi`);
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* ========== Top Header ========== */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200/50 dark:shadow-none">
              <Database size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
                Kho Tài Liệu
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Digital Document System
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('registry')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === 'registry'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <FileText size={13} />
                Quản lý
              </span>
            </button>
            <button
              onClick={() => setActiveTab('drive')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === 'drive'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <FolderOpen size={13} />
                Google Drive
              </span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {activeTab === 'registry' && (
              <>
                {documents.filter(d => !d.isAiIndexed).length > 0 && !indexingDoc && (
                  <button
                    onClick={handleBatchIndex}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/40 rounded-lg transition-all"
                    title="AI đọc tất cả tài liệu chưa được index"
                  >
                    <Bot size={14} />
                    AI đọc tất cả ({documents.filter(d => !d.isAiIndexed).length})
                  </button>
                )}
                <button
                  onClick={() => setShowUploadDialog(true)}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg shadow-lg shadow-indigo-200/50 dark:shadow-none transition-all"
                >
                  <Plus size={14} />
                  Thêm tài liệu
                </button>
              </>
            )}
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
              title="Cài đặt"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ========== REGISTRY TAB ========== */}
      {activeTab === 'registry' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* KPI Cards */}
          <div className="px-6 py-4 grid grid-cols-4 gap-4">
            <KpiCard
              label="Tổng tài liệu"
              value={stats?.totalDocuments ?? '—'}
              icon={<FileText size={18} className="text-indigo-600 dark:text-indigo-400" />}
              color="indigo"
            />
            <KpiCard
              label="AI đã đọc"
              value={stats?.aiIndexedCount ?? '—'}
              icon={<Bot size={18} className="text-emerald-600 dark:text-emerald-400" />}
              color="emerald"
            />
            <KpiCard
              label="Dung lượng"
              value={stats ? formatFileSize(stats.totalSize) : '—'}
              icon={<HardDrive size={18} className="text-purple-600 dark:text-purple-400" />}
              color="purple"
            />
            <KpiCard
              label="Danh mục"
              value={stats ? Object.keys(stats.byCategory).length : '—'}
              icon={<Tag size={18} className="text-amber-600 dark:text-amber-400" />}
              color="amber"
            />
          </div>

          {/* AI Indexing Progress Bar */}
          {indexingDoc && indexProgress && (
            <div className="px-6 pb-2">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/40 p-3 flex items-center gap-3">
                <Loader2 size={16} className="animate-spin text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 truncate pr-2">
                      {indexProgress.message}
                    </span>
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0">
                      {indexProgress.progress}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                      style={{ width: `${indexProgress.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search + Filter Toolbar */}
          <div className="px-6 pb-3 flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-bold bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                  <X size={12} className="text-slate-400" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as DocCategory | '')}
              className="px-3 py-2 text-xs font-bold bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tất cả danh mục</option>
              {Object.entries(DOC_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            {/* View Mode Switcher */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => handleSetViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => handleSetViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                <Grid size={14} />
              </button>
            </div>

            {/* Result Count */}
            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
              {totalCount} tài liệu
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loader2 size={28} className="animate-spin text-indigo-500" />
                <span className="text-xs font-bold text-slate-400">Đang tải tài liệu...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                  <FolderOpen size={32} className="text-slate-300 dark:text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-500 dark:text-slate-400 text-sm">
                    {searchTerm || categoryFilter ? 'Không tìm thấy tài liệu' : 'Chưa có tài liệu nào'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {searchTerm || categoryFilter ? 'Thử thay đổi bộ lọc' : 'Nhấn "Thêm tài liệu" để bắt đầu'}
                  </p>
                </div>
                {!searchTerm && !categoryFilter && (
                  <button
                    onClick={() => setShowUploadDialog(true)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg shadow-indigo-200/50 dark:shadow-none transition-all"
                  >
                    <Plus size={14} />
                    Thêm tài liệu đầu tiên
                  </button>
                )}
              </div>
            ) : viewMode === 'list' ? (
              /* ===== LIST VIEW ===== */
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tài liệu</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Danh mục</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Liên kết</th>
                      <th className="text-right px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Dung lượng</th>
                      <th className="text-center px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">AI</th>
                      <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Ngày tạo</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {documents.map(doc => (
                      <tr
                        key={doc.id}
                        className="group hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer"
                        onClick={() => doc.sourceUrl && window.open(doc.sourceUrl, '_blank')}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {getFileIcon(doc.mimeType, doc.fileName)}
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={doc.title}>
                                {doc.title}
                              </div>
                              {doc.description && (
                                <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">{doc.description}</div>
                              )}
                              {doc.tags.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {doc.tags.slice(0, 3).map(tag => (
                                    <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                      {tag}
                                    </span>
                                  ))}
                                  {doc.tags.length > 3 && <span className="text-[9px] text-slate-400">+{doc.tags.length - 3}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getCategoryBadge(doc.docCategory)}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {doc.entityType ? (
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              {doc.entityType === 'contract' ? 'HĐ' : doc.entityType === 'employee' ? 'NV' : doc.entityType}
                              {doc.entityId ? `: ${doc.entityId}` : ''}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                            {formatFileSize(doc.fileSize)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {indexingDoc === doc.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <Loader2 size={13} className="animate-spin text-indigo-500" />
                              <span className="text-[9px] font-bold text-indigo-500 tabular-nums">{indexProgress?.progress || 0}%</span>
                            </div>
                          ) : doc.isAiIndexed ? (
                            <CheckCircle2 size={14} className="text-emerald-500 mx-auto" />
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleIndexAI(doc); }}
                              className="p-1 mx-auto hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all group/ai"
                              title="Cho AI đọc tài liệu này"
                            >
                              <Bot size={14} className="text-slate-300 dark:text-slate-600 group-hover/ai:text-indigo-500 transition-colors" />
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                            {formatDate(doc.createdAt)}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={(e) => { e.stopPropagation(); setPreviewDoc(doc); }}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                              title="Xem chi tiết"
                            >
                              <Eye size={13} className="text-slate-400" />
                            </button>
                            {!doc.isAiIndexed && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleIndexAI(doc); }}
                                className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                                title="AI đọc"
                                disabled={!!indexingDoc}
                              >
                                <Sparkles size={13} className="text-indigo-400" />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                              title="Xóa"
                            >
                              <Trash2 size={13} className="text-rose-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ===== GRID VIEW ===== */
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-100/50 dark:hover:shadow-none p-4 cursor-pointer transition-all relative"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    {/* AI Badge / Index Button */}
                    <div className="absolute top-2 right-2">
                      {indexingDoc === doc.id ? (
                        <Loader2 size={14} className="animate-spin text-indigo-500" />
                      ) : doc.isAiIndexed ? (
                        <Bot size={12} className="text-emerald-500" />
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleIndexAI(doc); }}
                          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                          title="AI đọc"
                          disabled={!!indexingDoc}
                        >
                          <Sparkles size={12} className="text-indigo-400" />
                        </button>
                      )}
                    </div>
                    {/* Delete on hover */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                      className="absolute top-2 left-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                      title="Xóa"
                    >
                      <Trash2 size={11} className="text-rose-400" />
                    </button>
                    {/* Icon */}
                    <div className="mb-3 group-hover:scale-110 transition-transform">
                      {getFileIcon(doc.mimeType, doc.fileName)}
                    </div>
                    {/* Title */}
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={doc.title}>
                      {doc.title}
                    </h3>
                    {/* Meta */}
                    <div className="flex items-center gap-2 mt-2">
                      {getCategoryBadge(doc.docCategory)}
                      <span className="text-[9px] text-slate-400 tabular-nums">{formatFileSize(doc.fileSize)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== DRIVE TAB ========== */}
      {activeTab === 'drive' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Mobile sidebar toggle */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="absolute top-20 left-4 z-50 p-2 bg-white dark:bg-slate-800 shadow-lg rounded-lg md:hidden border border-slate-200 dark:border-slate-700"
            >
              <Menu size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
          )}

          {/* Sidebar */}
          <div className={`
            fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0 shadow-xl md:shadow-none pt-16 md:pt-0
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}>
            <div className="flex flex-col h-full">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FolderOpen size={13} className="text-indigo-500" />
                  Duyệt Google Drive
                </span>
                <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded md:hidden">
                  <X size={14} className="text-slate-400" />
                </button>
              </div>
              <DocumentSidebar
                mappings={mappings}
                selectedFolderId={selectedFolderId}
                onSelectFolder={(id, name) => {
                  setSelectedFolderId(id);
                  setSelectedFolderName(name);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className="border-none"
              />
            </div>
          </div>

          {/* Overlay */}
          {isSidebarOpen && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
          )}

          {/* Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedFolderId ? (
              <DocumentExplorer
                folderId={selectedFolderId}
                folderName={selectedFolderName}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-950 dark:to-indigo-950/30">
                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Folder size={32} className="text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Chọn thư mục từ cây bên trái</p>
                  <p className="text-xs text-slate-400 mt-1">Duyệt trực tiếp Google Drive của CIC</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDialog
        isOpen={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onSuccess={() => { loadDocuments(); loadStats(); }}
        userId={user?.id}
      />

      {/* Document Preview Panel */}
      {previewDoc && (
        <DocumentPreview
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onIndexAI={handleIndexAI}
          isIndexing={indexingDoc === previewDoc.id}
        />
      )}
    </div>
  );
};

export default DocumentManager;
