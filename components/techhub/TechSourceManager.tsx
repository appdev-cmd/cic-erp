import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Globe, Plus, Pencil, Trash2, RefreshCw, Loader2, Radio, Search,
  ExternalLink, Clock, FileText, Rss, ToggleLeft, ToggleRight, Zap,
  AlertTriangle, X, Shield, ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TechIntelService } from '../../services/techIntelService';
import type { TechSource, SourceType, CrawlFrequency, DeepCrawlConfig } from '../../types/techIntel';
import {
  SOURCE_TYPE_LABELS, SUPPORTED_LANGUAGES, SUPPORTED_COUNTRIES,
} from '../../types/techIntel';
import { formatDate } from '../../utils/formatters';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 placeholder:text-slate-400 dark:placeholder:text-slate-500';

const CRAWL_FREQ_LABELS: Record<CrawlFrequency, string> = {
  hourly: 'Mỗi giờ',
  daily: 'Hàng ngày',
  weekly: 'Hàng tuần',
};

const emptyForm = {
  name: '',
  url: '',
  type: 'rss' as SourceType,
  language: 'en',
  country: 'US',
  category: 'general',
  crawlFrequency: 'daily' as CrawlFrequency,
  isActive: true,
  deepCrawlConfig: {
    maxDepth: 2,
    maxPages: 50,
    includePatterns: [] as string[],
    excludePatterns: [] as string[],
    jsEnabled: true as boolean,
    stealthMode: true as boolean,
    contentFilter: 'pruning' as 'pruning' | 'bm25' | 'none',
  },
};

interface TechSourceManagerProps {
  onBack?: () => void;
}

export default function TechSourceManager({ onBack }: TechSourceManagerProps) {
  // Data
  const [sources, setSources] = useState<TechSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Crawl state
  const [crawlingIds, setCrawlingIds] = useState<Set<string>>(new Set());
  const [bulkCrawling, setBulkCrawling] = useState(false);
  const [analyzingCount, setAnalyzingCount] = useState<number | null>(null);

  // Load sources
  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const data = await TechIntelService.getSources();
      setSources(data);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải danh sách nguồn tin');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // Filtered sources
  const filteredSources = useMemo(() => {
    if (!search.trim()) return sources;
    const q = search.toLowerCase();
    return sources.filter(
      s => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q)
    );
  }, [sources, search]);

  // Stats
  const activeCount = useMemo(() => sources.filter(s => s.isActive).length, [sources]);
  const totalArticles = useMemo(() => sources.reduce((s, src) => s + (src.articleCount || 0), 0), [sources]);

  // Open create modal
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (source: TechSource) => {
    setEditingId(source.id);
    const cfg = (source.config || {}) as Partial<DeepCrawlConfig>;
    setForm({
      name: source.name,
      url: source.url,
      type: source.type,
      language: source.language,
      country: source.country,
      category: source.category,
      crawlFrequency: source.crawlFrequency,
      isActive: source.isActive,
      deepCrawlConfig: {
        maxDepth: cfg.maxDepth ?? 2,
        maxPages: cfg.maxPages ?? 50,
        includePatterns: cfg.includePatterns ?? [],
        excludePatterns: cfg.excludePatterns ?? [],
        jsEnabled: cfg.jsEnabled ?? true,
        stealthMode: cfg.stealthMode ?? true,
        contentFilter: cfg.contentFilter ?? 'pruning',
      },
    });
    setShowModal(true);
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error('Vui lòng nhập tên và URL nguồn tin');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await TechIntelService.updateSource(editingId, {
          name: form.name,
          url: form.url,
          type: form.type,
          language: form.language,
          country: form.country,
          category: form.category,
          crawlFrequency: form.crawlFrequency,
          isActive: form.isActive,
          config: form.type === 'deep_crawl' ? form.deepCrawlConfig : {},
        });
        setSources(prev => prev.map(s => s.id === editingId ? updated : s));
        toast.success('Đã cập nhật nguồn tin');
      } else {
        const created = await TechIntelService.createSource({
          name: form.name,
          url: form.url,
          type: form.type,
          language: form.language,
          country: form.country,
          category: form.category,
          crawlFrequency: form.crawlFrequency,
          isActive: form.isActive,
          config: form.type === 'deep_crawl' ? form.deepCrawlConfig : {},
        });
        setSources(prev => [...prev, created]);
        toast.success('Đã thêm nguồn tin mới');
      }
      setShowModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu nguồn tin');
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await TechIntelService.deleteSource(deleteId);
      setSources(prev => prev.filter(s => s.id !== deleteId));
      toast.success('Đã xóa nguồn tin');
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xóa nguồn tin');
    } finally {
      setDeleting(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (source: TechSource) => {
    try {
      const updated = await TechIntelService.updateSource(source.id, { isActive: !source.isActive });
      setSources(prev => prev.map(s => s.id === source.id ? updated : s));
      toast.success(updated.isActive ? 'Đã kích hoạt nguồn tin' : 'Đã tạm dừng nguồn tin');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật trạng thái');
    }
  };

  // Auto-analyze pending articles after crawl — CHẠY TRÊN SERVER (/api/tech-intel/analyze).
  // Không còn phụ thuộc tab admin còn mở: server tự cào nội dung + giải mã URL + gọi AI.
  // Gọi lặp lại endpoint cho tới khi hết bài pending (mỗi lần xử lý theo time-budget).
  const autoAnalyzePending = async () => {
    try {
      let pending = await TechIntelService.getPendingArticleIds(50);
      if (pending.length === 0) return;
      setAnalyzingCount(pending.length);
      toast.info(`🤖 AI đang phân tích ${pending.length} bài mới (chạy trên server)...`, { duration: 5000 });

      let totalAnalyzed = 0;
      for (let guard = 0; guard < 20; guard++) {
        const res = await fetch('/api/tech-intel/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 20 }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || res.statusText);
        }
        const data = await res.json();
        totalAnalyzed += data.analyzed || 0;

        pending = await TechIntelService.getPendingArticleIds(50);
        setAnalyzingCount(pending.length);
        if ((data.processed || 0) === 0 || pending.length === 0) break;
      }

      setAnalyzingCount(null);
      toast.success(`✅ AI phân tích xong ${totalAnalyzed} bài`);
    } catch (err: any) {
      setAnalyzingCount(null);
      toast.error(`Lỗi phân tích AI: ${err.message || 'Unknown'}`);
    }
  };

  // Crawl single source
  const handleCrawl = async (sourceId: string) => {
    setCrawlingIds(prev => new Set(prev).add(sourceId));
    try {
      const response = await fetch('/api/tech-intel/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Crawl thất bại: ${errData.error || response.statusText}`);
        return;
      }

      const data = await response.json();
      const result = data.results?.[0];
      if (result?.error) {
        toast.error(`❌ ${result.source}: ${result.error}`);
      } else if (result) {
        toast.success(`✅ ${result.source}: ${result.newArticles} bài mới`);
      } else {
        toast.success(`Crawl xong — ${data.totalNew || 0} bài mới`);
      }

      // Refresh sources list to update lastCrawledAt, articleCount
      loadSources();

      // Auto-analyze if new articles found
      if (data.totalNew > 0) {
        autoAnalyzePending();
      }
    } catch {
      toast.error('Lỗi kết nối đến crawler');
    } finally {
      setCrawlingIds(prev => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  };

  // Trigger deep crawl via Vercel API
  const handleDeepCrawl = async (sourceId: string) => {
    setCrawlingIds(prev => new Set(prev).add(sourceId));
    try {
      const response = await fetch('/api/tech-intel/deep-crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(`Deep crawl thất bại: ${data.error || response.statusText}`);
        return;
      }

      toast.success(`✅ Deep crawl hoàn tất: ${data.totalNew || 0} bài mới, ${data.totalPagesChecked || 0} trang đã quét`);
    } catch {
      toast.error('Lỗi kết nối đến server');
    } finally {
      setCrawlingIds(prev => {
        const next = new Set(prev);
        next.delete(sourceId);
        return next;
      });
    }
  };

  // Bulk crawl all active sources
  const handleBulkCrawl = async () => {
    const activeSources = sources.filter(s => s.isActive);
    if (activeSources.length === 0) {
      toast.warning('Không có nguồn tin nào đang hoạt động');
      return;
    }
    setBulkCrawling(true);
    try {
      const response = await fetch('/api/tech-intel/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: null, crawlAll: true }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        toast.error(`Crawl thất bại: ${errData.error || response.statusText}`);
        return;
      }

      const data = await response.json();
      const errors = (data.results || []).filter((r: any) => r.error);
      const successSources = (data.results || []).filter((r: any) => !r.error);

      if (errors.length > 0) {
        toast.warning(
          `Crawl xong: ${data.totalNew} bài mới, ${errors.length} nguồn lỗi: ${errors.map((e: any) => e.source).join(', ')}`,
          { duration: 8000 }
        );
      } else {
        toast.success(`✅ Crawl ${successSources.length} nguồn — ${data.totalNew} bài mới`);
      }

      // Refresh sources list
      loadSources();

      // Auto-analyze if new articles found
      if (data.totalNew > 0) {
        autoAnalyzePending();
      }
    } catch {
      toast.error('Lỗi kết nối đến crawler');
    } finally {
      setBulkCrawling(false);
    }
  };

  // Status dot
  const StatusDot = ({ source }: { source: TechSource }) => {
    const color = source.isActive
      ? 'bg-emerald-500'
      : 'bg-slate-400 dark:bg-slate-600';
    const label = source.isActive ? 'Hoạt động' : 'Tạm dừng';
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      </span>
    );
  };

  // Source type badge
  const TypeBadge = ({ type }: { type: SourceType }) => {
    const colorMap: Record<SourceType, string> = {
      rss: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      google_news: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      web: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      deep_crawl: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      api: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
      manual: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colorMap[type]}`}>
        {SOURCE_TYPE_LABELS[type]}
      </span>
    );
  };

  // Truncate URL
  const truncateUrl = (url: string, maxLen = 40) => {
    try {
      const u = new URL(url);
      const short = u.hostname + u.pathname;
      return short.length > maxLen ? short.slice(0, maxLen) + '…' : short;
    } catch {
      return url.length > maxLen ? url.slice(0, maxLen) + '…' : url;
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-100 dark:border-slate-800">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Quay lại"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Globe size={28} className="text-indigo-600 dark:text-indigo-400" />
              Quản lý Nguồn tin
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <Shield size={14} />
              Trang quản trị — Chỉ dành cho Admin
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkCrawl}
            disabled={bulkCrawling}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {bulkCrawling ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            Crawl tất cả
          </button>

          <Button variant="primary" onClick={openCreate} className="gap-1.5">
            <Plus size={16} />
            Thêm nguồn
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <Rss size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{sources.length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tổng nguồn tin</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Radio size={20} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{activeCount}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Đang hoạt động</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <FileText size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{totalArticles.toLocaleString()}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tổng bài viết</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm kiếm nguồn tin..."
          className={`${inputCls} pl-9`}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Sources List */}
      {filteredSources.length === 0 ? (
        <EmptyState
          type="no-data"
          icon={<Globe size={48} />}
          title={search ? 'Không tìm thấy nguồn tin' : 'Chưa có nguồn tin nào'}
          message={search ? 'Thử thay đổi từ khóa tìm kiếm' : 'Thêm nguồn tin RSS hoặc Google News để bắt đầu'}
          action={search ? { label: 'Xóa tìm kiếm', onClick: () => setSearch('') } : { label: 'Thêm nguồn tin', onClick: openCreate }}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trạng thái</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tên nguồn</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">URL</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Loại</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ngôn ngữ</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tần suất</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bài viết</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Crawl gần nhất</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSources.map((source, index) => (
                  <motion.tr
                    key={source.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <StatusDot source={source} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{source.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title={source.url}
                      >
                        {truncateUrl(source.url)}
                        <ExternalLink size={10} />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={source.type} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600 dark:text-slate-400 uppercase">
                        {source.language} / {source.country}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {CRAWL_FREQ_LABELS[source.crawlFrequency]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                        {source.articleCount || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {source.lastCrawledAt ? formatDate(source.lastCrawledAt) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Toggle active */}
                        <button
                          onClick={() => handleToggleActive(source)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title={source.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                        >
                          {source.isActive
                            ? <ToggleRight size={18} className="text-emerald-600 dark:text-emerald-400" />
                            : <ToggleLeft size={18} className="text-slate-400 dark:text-slate-500" />
                          }
                        </button>

                        {/* Crawl */}
                        <button
                          onClick={() => handleCrawl(source.id)}
                          disabled={crawlingIds.has(source.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                          title="Crawl ngay"
                        >
                          {crawlingIds.has(source.id)
                            ? <Loader2 size={16} className="animate-spin text-indigo-500" />
                            : <RefreshCw size={16} className="text-slate-500 dark:text-slate-400" />
                          }
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => openEdit(source)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title="Chỉnh sửa"
                        >
                          <Pencil size={16} className="text-slate-500 dark:text-slate-400" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteId(source.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                          title="Xóa"
                        >
                          <Trash2 size={16} className="text-red-500 dark:text-red-400" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filteredSources.map((source, index) => (
              <motion.div
                key={source.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
              >
                {/* Top row: name + status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{source.name}</h3>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mt-0.5"
                    >
                      {truncateUrl(source.url, 30)}
                      <ExternalLink size={10} />
                    </a>
                  </div>
                  <StatusDot source={source} />
                </div>

                {/* Info row */}
                <div className="flex flex-wrap items-center gap-2">
                  <TypeBadge type={source.type} />
                  <span className="text-xs text-slate-500 dark:text-slate-400 uppercase">{source.language} / {source.country}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{CRAWL_FREQ_LABELS[source.crawlFrequency]}</span>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <FileText size={12} /> {source.articleCount || 0} bài viết
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} /> {source.lastCrawledAt ? formatDate(source.lastCrawledAt) : '—'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleToggleActive(source)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {source.isActive
                      ? <><ToggleRight size={14} className="text-emerald-600 dark:text-emerald-400" /> Tạm dừng</>
                      : <><ToggleLeft size={14} className="text-slate-400" /> Kích hoạt</>
                    }
                  </button>
                  <button
                    onClick={() => handleCrawl(source.id)}
                    disabled={crawlingIds.has(source.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {crawlingIds.has(source.id)
                      ? <Loader2 size={14} className="animate-spin" />
                      : <RefreshCw size={14} />
                    }
                    Crawl
                  </button>
                  <button
                    onClick={() => openEdit(source)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Pencil size={14} /> Sửa
                  </button>
                  <button
                    onClick={() => setDeleteId(source.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer ml-auto"
                  >
                    <Trash2 size={14} /> Xóa
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Chỉnh sửa nguồn tin' : 'Thêm nguồn tin mới'}
        size="lg"
      >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tên nguồn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="VD: Construction Dive"
              className={inputCls}
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={form.url}
              onChange={e => setForm(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://www.constructiondive.com/feeds/news/"
              className={inputCls}
            />
          </div>

          {/* Type + Frequency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Loại nguồn
              </label>
              <select
                value={form.type}
                onChange={e => setForm(prev => ({ ...prev, type: e.target.value as SourceType }))}
                className={inputCls + ' cursor-pointer'}
              >
                {(Object.entries(SOURCE_TYPE_LABELS) as [SourceType, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tần suất crawl
              </label>
              <select
                value={form.crawlFrequency}
                onChange={e => setForm(prev => ({ ...prev, crawlFrequency: e.target.value as CrawlFrequency }))}
                className={inputCls + ' cursor-pointer'}
              >
                {(Object.entries(CRAWL_FREQ_LABELS) as [CrawlFrequency, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Language + Country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ngôn ngữ
              </label>
              <select
                value={form.language}
                onChange={e => setForm(prev => ({ ...prev, language: e.target.value }))}
                className={inputCls + ' cursor-pointer'}
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quốc gia
              </label>
              <select
                value={form.country}
                onChange={e => setForm(prev => ({ ...prev, country: e.target.value }))}
                className={inputCls + ' cursor-pointer'}
              >
                {SUPPORTED_COUNTRIES.map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Kích hoạt nguồn tin</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Nguồn tin hoạt động sẽ được crawl tự động</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
              className="cursor-pointer"
            >
              {form.isActive
                ? <ToggleRight size={28} className="text-emerald-600 dark:text-emerald-400" />
                : <ToggleLeft size={28} className="text-slate-400 dark:text-slate-500" />
              }
            </button>
          </div>

          {/* Deep Crawl Config (only for deep_crawl type) */}
          {form.type === 'deep_crawl' && (
            <div className="space-y-3 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20">
              <h4 className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                <Zap size={14} />
                Cấu hình Deep Crawl (Crawl4AI)
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Độ sâu BFS (1-3)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={form.deepCrawlConfig.maxDepth}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      deepCrawlConfig: { ...prev.deepCrawlConfig, maxDepth: Math.min(3, Math.max(1, parseInt(e.target.value) || 1)) },
                    }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Số trang tối \u0111a
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={form.deepCrawlConfig.maxPages}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      deepCrawlConfig: { ...prev.deepCrawlConfig, maxPages: Math.min(200, Math.max(5, parseInt(e.target.value) || 50)) },
                    }))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  URL patterns cho ph\u00e9p (m\u1ed7i d\u00f2ng 1 regex)
                </label>
                <textarea
                  value={(form.deepCrawlConfig.includePatterns || []).join('\n')}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    deepCrawlConfig: {
                      ...prev.deepCrawlConfig,
                      includePatterns: e.target.value.split('\n').filter(Boolean),
                    },
                  }))}
                  placeholder="/blog/\n/news/"
                  rows={2}
                  className={inputCls + ' text-xs font-mono'}
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.deepCrawlConfig.jsEnabled}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      deepCrawlConfig: { ...prev.deepCrawlConfig, jsEnabled: e.target.checked },
                    }))}
                    className="rounded"
                  />
                  JS Rendering
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.deepCrawlConfig.stealthMode}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      deepCrawlConfig: { ...prev.deepCrawlConfig, stealthMode: e.target.checked },
                    }))}
                    className="rounded"
                  />
                  Anti-bot Stealth
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? 'Đang lưu...' : editingId ? 'Cập nhật' : 'Thêm nguồn'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Xác nhận xóa nguồn tin"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Bạn có chắc muốn xóa nguồn tin này? Hành động này không thể hoàn tác.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Lưu ý: Các bài viết đã crawl từ nguồn này sẽ không bị xóa.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setDeleteId(null)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {deleting ? 'Đang xóa...' : 'Xóa nguồn tin'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
