import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSlidePanel } from '../../contexts/SlidePanelContext';

// Lazy-loaded panel component
const TechArticleDetail = React.lazy(() => import('./TechArticleDetail'));
import { toast } from 'sonner';
import {
  Search, LayoutGrid, List, ChevronDown, ChevronUp, RotateCcw,
  Heart, Eye, Calendar, Globe, ExternalLink, Newspaper,
  SlidersHorizontal, ChevronLeft, ChevronRight, Zap,
  Filter, X, ArrowLeft, Clock, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TechIntelService } from '../../services/techIntelService';
import type {
  TechArticle, TechArticleFilter, TechCategory, ImpactLevel,
  IndustrySector, ProjectPhase, TechEventType,
} from '../../types/techIntel';
import {
  TECH_CATEGORY_LABELS, TECH_CATEGORY_COLORS,
  IMPACT_LEVEL_LABELS, IMPACT_LEVEL_COLORS,
  INDUSTRY_SECTOR_LABELS, PROJECT_PHASE_LABELS,
  EVENT_TYPE_LABELS, SUPPORTED_LANGUAGES,
} from '../../types/techIntel';
import { formatDate } from '../../utils/formatters';
import EmptyState from '../ui/EmptyState';
import DateInput from '../ui/DateInput';
import { Skeleton } from '../ui/Skeleton';

// ─── Constants ────────────────────────────────────────
const PAGE_SIZE = 12;

const SORT_OPTIONS: { value: TechArticleFilter['sortBy']; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'impact', label: 'Impact cao nhất' },
  { value: 'views', label: 'Nhiều views nhất' },
];

// Country flag emoji lookup
const COUNTRY_FLAGS: Record<string, string> = {
  US: '\u{1F1FA}\u{1F1F8}', CA: '\u{1F1E8}\u{1F1E6}', GB: '\u{1F1EC}\u{1F1E7}',
  CN: '\u{1F1E8}\u{1F1F3}', KR: '\u{1F1F0}\u{1F1F7}', JP: '\u{1F1EF}\u{1F1F5}',
  DE: '\u{1F1E9}\u{1F1EA}', FR: '\u{1F1EB}\u{1F1F7}', NL: '\u{1F1F3}\u{1F1F1}',
  SE: '\u{1F1F8}\u{1F1EA}', NO: '\u{1F1F3}\u{1F1F4}', FI: '\u{1F1EB}\u{1F1EE}',
  IL: '\u{1F1EE}\u{1F1F1}', IN: '\u{1F1EE}\u{1F1F3}', SG: '\u{1F1F8}\u{1F1EC}',
  AU: '\u{1F1E6}\u{1F1FA}', VN: '\u{1F1FB}\u{1F1F3}', AE: '\u{1F1E6}\u{1F1EA}',
  SA: '\u{1F1F8}\u{1F1E6}', IT: '\u{1F1EE}\u{1F1F9}', ES: '\u{1F1EA}\u{1F1F8}',
  CH: '\u{1F1E8}\u{1F1ED}', AT: '\u{1F1E6}\u{1F1F9}',
};

const INITIAL_FILTER: TechArticleFilter = {
  search: '',
  technologyCategory: undefined,
  impactLevel: undefined,
  industries: undefined,
  projectPhases: undefined,
  eventType: undefined,
  language: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  sortBy: 'newest',
  page: 1,
  pageSize: PAGE_SIZE,
};

// ─── Shared Tailwind Class Tokens ────────────────────
const inputCls = [
  'w-full px-3 py-2 rounded-lg border text-sm',
  'bg-white dark:bg-slate-800',
  'border-slate-200 dark:border-slate-700',
  'text-slate-900 dark:text-slate-100',
  'placeholder:text-slate-400 dark:placeholder:text-slate-500',
  'focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500',
  'transition-colors',
].join(' ');

const selectCls = `${inputCls} cursor-pointer appearance-none pr-8`;

// Helper to clean HTML from description
const cleanSummary = (text: string) => {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/&[a-zA-Z0-9#]+;/g, ' ') // remove HTML entities
    .replace(/\s+/g, ' ')
    .trim();
};

// ─── Impact Level Dot ─────────────────────────────────
function ImpactDot({ level, status }: { level: ImpactLevel; status?: string }) {
  if (status === 'pending' || status === 'analyzing') {
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-sm" title="Chờ phân tích (Pending)" />;
  }
  const dotColor: Record<ImpactLevel, string> = {
    low: 'bg-slate-400',
    medium: 'bg-blue-500',
    high: 'bg-amber-500',
    breakthrough: 'bg-red-500',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor[level]}`} />;
}

// ─── Gradient Placeholder for Missing Thumbnails ─────
const CATEGORY_GRADIENTS: Record<string, string> = {
  software_platform: 'from-blue-500 to-indigo-600',
  ai_solution: 'from-purple-500 to-fuchsia-600',
  robotics_automation: 'from-amber-500 to-orange-600',
  consulting: 'from-teal-500 to-cyan-600',
  green_certification: 'from-emerald-500 to-green-600',
  energy_emission: 'from-orange-500 to-red-500',
  default: 'from-slate-500 to-slate-700',
};

// ─── Props ────────────────────────────────────────────
interface TechNewsFeedProps {
  onBack?: () => void;
}

// ─── Component ────────────────────────────────────────
export default function TechNewsFeed({ onBack }: TechNewsFeedProps) {
  const { openPanel, closePanel } = useSlidePanel();

  // State
  const [articles, setArticles] = useState<TechArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TechArticleFilter>(INITIAL_FILTER);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [togglingBookmark, setTogglingBookmark] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  // Active filter count for badge
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filter.search) c++;
    if (filter.technologyCategory) c++;
    if (filter.impactLevel) c++;
    if (filter.industries && filter.industries.length > 0) c++;
    if (filter.projectPhases && filter.projectPhases.length > 0) c++;
    if (filter.eventType) c++;
    if (filter.language) c++;
    if (filter.dateFrom) c++;
    if (filter.dateTo) c++;
    return c;
  }, [filter]);

  // Fetch articles
  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await TechIntelService.getArticles(filter);
      setArticles(result.articles);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải tin tức');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Fetch bookmarks
  const fetchBookmarks = useCallback(async () => {
    try {
      const ids = await TechIntelService.getBookmarkedArticleIds();
      setBookmarkedIds(ids);
    } catch {
      // Silently fail — user might not be logged in
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  // Filter helpers
  const updateFilter = (patch: Partial<TechArticleFilter>) => {
    setFilter(prev => ({ ...prev, ...patch, page: 1 }));
  };

  const resetFilters = () => {
    setFilter(INITIAL_FILTER);
  };

  const setPage = (page: number) => {
    setFilter(prev => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle bookmark
  const handleToggleBookmark = async (e: React.MouseEvent, articleId: string) => {
    e.stopPropagation();
    if (togglingBookmark) return;
    setTogglingBookmark(articleId);
    try {
      const isNowBookmarked = await TechIntelService.toggleBookmark(articleId);
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        if (isNowBookmarked) next.add(articleId);
        else next.delete(articleId);
        return next;
      });
      toast.success(isNowBookmarked ? 'Đã lưu bài viết' : 'Đã bỏ lưu bài viết');
    } catch {
      toast.error('Không thể lưu bài viết');
    } finally {
      setTogglingBookmark(null);
    }
  };

  // Delete all articles (for testing)
  const handleDeleteAll = async () => {
    const confirmDelete = window.confirm(
      'Bạn có chắc chắn muốn xóa toàn bộ bài viết tin tức công nghệ? Hành động này không thể hoàn tác!'
    );
    if (!confirmDelete) return;

    setDeletingAll(true);
    try {
      await TechIntelService.deleteAllArticles();
      toast.success('Đã xóa toàn bộ bài viết thành công!');
      setArticles([]);
      setTotal(0);
      // Reset filter về trang 1
      setFilter(prev => ({ ...prev, page: 1 }));
    } catch (err: any) {
      toast.error(err.message || 'Không thể xóa bài viết');
    } finally {
      setDeletingAll(false);
    }
  };

  // Pagination
  const totalPages = Math.ceil(total / (filter.pageSize || PAGE_SIZE));
  const currentPage = filter.page || 1;

  const paginationRange = useMemo(() => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Quay lại"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Newspaper className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Tin tức Công nghệ
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {loading ? 'Đang tải...' : `${total.toLocaleString('vi-VN')} bài viết`}
            </p>
          </div>
        </div>

        {/* View Toggle + Filter Toggle */}
        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          <button
            onClick={() => setFiltersOpen(prev => !prev)}
            className={`
              relative inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer
              ${filtersOpen
                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }
            `}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Bộ lọc</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Delete All Articles Button (Testing tool) */}
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll || loading || articles.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-sm font-medium bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-200"
            title="Xóa toàn bộ bài viết để test"
          >
            <Trash2 className={`w-4 h-4 ${deletingAll ? 'animate-pulse' : ''}`} />
            <span className="hidden md:inline">
              {deletingAll ? 'Đang xóa...' : 'Xóa toàn bộ tin'}
            </span>
          </button>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 transition-colors cursor-pointer ${
                viewMode === 'card'
                  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Dạng thẻ"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Dạng danh sách"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Filter Bar (Collapsible) ───────────────── */}
      <AnimatePresence>
        {filtersOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4 shadow-sm">
              {/* Row 1: Search + Category + Impact + Industry */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm bài viết..."
                    value={filter.search || ''}
                    onChange={e => updateFilter({ search: e.target.value })}
                    className={`${inputCls} pl-9`}
                  />
                  {filter.search && (
                    <button
                      onClick={() => updateFilter({ search: '' })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Technology Category */}
                <div className="relative">
                  <select
                    value={filter.technologyCategory || ''}
                    onChange={e => updateFilter({ technologyCategory: (e.target.value || undefined) as TechCategory | undefined })}
                    className={selectCls}
                  >
                    <option value="">Tất cả nhóm CN</option>
                    {Object.entries(TECH_CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Impact Level */}
                <div className="relative">
                  <select
                    value={filter.impactLevel || ''}
                    onChange={e => updateFilter({ impactLevel: (e.target.value || undefined) as ImpactLevel | undefined })}
                    className={selectCls}
                  >
                    <option value="">Tất cả mức tác động</option>
                    {Object.entries(IMPACT_LEVEL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Industry */}
                <div className="relative">
                  <select
                    value={filter.industries?.[0] || ''}
                    onChange={e => updateFilter({ industries: e.target.value ? [e.target.value as IndustrySector] : undefined })}
                    className={selectCls}
                  >
                    <option value="">Tất cả ngành</option>
                    {Object.entries(INDUSTRY_SECTOR_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Row 2: Phase + Event + Language + Sort */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Project Phase */}
                <div className="relative">
                  <select
                    value={filter.projectPhases?.[0] || ''}
                    onChange={e => updateFilter({ projectPhases: e.target.value ? [e.target.value as ProjectPhase] : undefined })}
                    className={selectCls}
                  >
                    <option value="">Tất cả giai đoạn</option>
                    {Object.entries(PROJECT_PHASE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Event Type */}
                <div className="relative">
                  <select
                    value={filter.eventType || ''}
                    onChange={e => updateFilter({ eventType: (e.target.value || undefined) as TechEventType | undefined })}
                    className={selectCls}
                  >
                    <option value="">Tất cả loại sự kiện</option>
                    {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Language */}
                <div className="relative">
                  <select
                    value={filter.language || ''}
                    onChange={e => updateFilter({ language: e.target.value || undefined })}
                    className={selectCls}
                  >
                    <option value="">Tất cả ngôn ngữ</option>
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Sort */}
                <div className="relative">
                  <select
                    value={filter.sortBy || 'newest'}
                    onChange={e => updateFilter({ sortBy: e.target.value as TechArticleFilter['sortBy'] })}
                    className={selectCls}
                  >
                    {SORT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Row 3: Date range + Reset */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">Từ</span>
                  <DateInput
                    value={filter.dateFrom || ''}
                    onChange={v => updateFilter({ dateFrom: v || undefined })}
                    placeholder="dd/mm/yyyy"
                    className={inputCls}
                  />
                  <span className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">đến</span>
                  <DateInput
                    value={filter.dateTo || ''}
                    onChange={v => updateFilter({ dateTo: v || undefined })}
                    placeholder="dd/mm/yyyy"
                    className={inputCls}
                  />
                </div>

                {/* Reset */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Content ────────────────────────────────── */}
      {loading ? (
        // Loading skeletons
        viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <Skeleton className="h-44 w-full rounded-none" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="w-2.5 h-2.5 rounded-full flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-24 hidden sm:block" />
                <Skeleton className="h-3 w-20 hidden md:block" />
              </div>
            ))}
          </div>
        )
      ) : articles.length === 0 ? (
        // Empty state
        <EmptyState
          type="no-results"
          title="Không tìm thấy bài viết"
          message="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm để xem thêm kết quả."
          action={activeFilterCount > 0 ? { label: 'Xóa bộ lọc', onClick: resetFilters } : undefined}
        />
      ) : viewMode === 'card' ? (
        // ─── Card View ─────────────────────────────
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {articles.map((article, idx) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
              onClick={() => openPanel({
                title: article.titleVi || article.title || 'Chi tiết bài viết',
                url: `/tech-intel/articles/${article.id}`,
                component: (
                  <Suspense fallback={<div className="p-8 text-center text-slate-400">Đang tải...</div>}>
                    <div className="p-4 md:p-6 lg:p-8">
                      <TechArticleDetail 
                        articleId={article.id} 
                        onBack={() => closePanel()} 
                        onUpdated={(updatedArticle) => {
                          setArticles(prev => prev.map(a => a.id === updatedArticle.id ? updatedArticle : a));
                        }}
                      />
                    </div>
                  </Suspense>
                ),
              })}
              className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-300"
            >
              {/* Thumbnail */}
              <div className="relative h-44 overflow-hidden">
                {article.thumbnailUrl ? (
                  <img
                    src={article.thumbnailUrl}
                    alt={article.titleVi || article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${CATEGORY_GRADIENTS[article.technologyCategory || 'default'] || CATEGORY_GRADIENTS.default} flex items-center justify-center`}>
                    <Newspaper className="w-12 h-12 text-white/30" />
                  </div>
                )}

                {/* Bookmark button */}
                <button
                  onClick={e => handleToggleBookmark(e, article.id)}
                  disabled={togglingBookmark === article.id}
                  className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    bookmarkedIds.has(article.id)
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-black/30 backdrop-blur-sm text-white/80 hover:bg-black/50 hover:text-white'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${bookmarkedIds.has(article.id) ? 'fill-current' : ''}`} />
                </button>

                {/* Impact badge on image */}
                <div className="absolute top-3 left-3">
                  {article.status === 'pending' || article.status === 'analyzing' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/25 shadow-sm">
                      <Clock className="w-3 h-3 animate-pulse text-amber-500" />
                      Pending
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${IMPACT_LEVEL_COLORS[article.impactLevel]}`}>
                      {article.impactLevel === 'breakthrough' && <Zap className="w-3 h-3" />}
                      {IMPACT_LEVEL_LABELS[article.impactLevel]}
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3">
                {/* Title */}
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {article.titleVi || article.title}
                </h3>

                {/* Summary */}
                {(article.summaryVi || article.summary) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {cleanSummary(article.summaryVi || article.summary || '')}
                  </p>
                )}

                {/* Tags row */}
                <div className="flex flex-wrap gap-1.5">
                  {article.technologyCategory && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${TECH_CATEGORY_COLORS[article.technologyCategory]}`}>
                      {TECH_CATEGORY_LABELS[article.technologyCategory]}
                    </span>
                  )}
                  {article.eventType && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {EVENT_TYPE_LABELS[article.eventType]}
                    </span>
                  )}
                </div>

                {/* Footer: source + date */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
                    {article.sourceCountry && (
                      <span className="text-sm flex-shrink-0">{COUNTRY_FLAGS[article.sourceCountry] || ''}</span>
                    )}
                    <span className="truncate max-w-[120px]">{article.sourceName || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(article.publishedAt || article.crawledAt)}
                    </span>
                    {article.viewCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {article.viewCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        // ─── List View ─────────────────────────────
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* List header */}
          <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <div className="col-span-1 text-center">Impact</div>
            <div className="col-span-5">Tiêu đề</div>
            <div className="col-span-2">Nhóm CN</div>
            <div className="col-span-2">Nguồn</div>
            <div className="col-span-1">Ngày</div>
            <div className="col-span-1 text-center">Lưu</div>
          </div>

          {/* List rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {articles.map((article, idx) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => openPanel({
                  title: article.titleVi || article.title || 'Chi tiết bài viết',
                  url: `/tech-intel/articles/${article.id}`,
                  component: (
                    <Suspense fallback={<div className="p-8 text-center text-slate-400">Đang tải...</div>}>
                      <div className="p-4 md:p-6 lg:p-8">
                        <TechArticleDetail 
                          articleId={article.id} 
                          onBack={() => closePanel()} 
                          onUpdated={(updatedArticle) => {
                            setArticles(prev => prev.map(a => a.id === updatedArticle.id ? updatedArticle : a));
                          }}
                        />
                      </div>
                    </Suspense>
                  ),
                })}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
              >
                {/* Impact */}
                <div className="hidden sm:flex col-span-1 justify-center">
                  <ImpactDot level={article.impactLevel} status={article.status} />
                </div>

                {/* Title */}
                <div className="col-span-1 sm:col-span-5">
                  <div className="flex items-center gap-2">
                    <span className="sm:hidden"><ImpactDot level={article.impactLevel} status={article.status} /></span>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      {article.titleVi || article.title}
                    </p>
                  </div>
                </div>

                {/* Category */}
                <div className="hidden sm:block col-span-2">
                  {article.technologyCategory ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${TECH_CATEGORY_COLORS[article.technologyCategory]}`}>
                      {TECH_CATEGORY_LABELS[article.technologyCategory]}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                  )}
                </div>

                {/* Source */}
                <div className="hidden sm:flex col-span-2 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {article.sourceCountry && (
                    <span className="text-sm">{COUNTRY_FLAGS[article.sourceCountry] || ''}</span>
                  )}
                  <span className="truncate">{article.sourceName || '—'}</span>
                </div>

                {/* Date */}
                <div className="hidden sm:block col-span-1 text-xs text-slate-400 dark:text-slate-500">
                  {formatDate(article.publishedAt || article.crawledAt)}
                </div>

                {/* Bookmark */}
                <div className="hidden sm:flex col-span-1 justify-center">
                  <button
                    onClick={e => handleToggleBookmark(e, article.id)}
                    disabled={togglingBookmark === article.id}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      bookmarkedIds.has(article.id)
                        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${bookmarkedIds.has(article.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>

                {/* Mobile secondary info */}
                <div className="flex sm:hidden items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                  {article.technologyCategory && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${TECH_CATEGORY_COLORS[article.technologyCategory]}`}>
                      {TECH_CATEGORY_LABELS[article.technologyCategory]}
                    </span>
                  )}
                  <span>{article.sourceName || '—'}</span>
                  <span>{formatDate(article.publishedAt || article.crawledAt)}</span>
                  <button
                    onClick={e => handleToggleBookmark(e, article.id)}
                    className={`ml-auto p-1 ${bookmarkedIds.has(article.id) ? 'text-red-500' : 'text-slate-300 dark:text-slate-600'} cursor-pointer`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${bookmarkedIds.has(article.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Pagination ─────────────────────────────── */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          {/* Info */}
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Trang {currentPage}/{totalPages} — {total.toLocaleString('vi-VN')} kết quả
          </p>

          {/* Page buttons */}
          <div className="flex items-center gap-1">
            {/* Prev */}
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {paginationRange.map((p, i) =>
              p === '...' ? (
                <span key={`dots-${i}`} className="px-2 text-slate-400 dark:text-slate-500 text-sm">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    p === currentPage
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {p}
                </button>
              )
            )}

            {/* Next */}
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
