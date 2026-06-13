import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Globe,
  Calendar,
  Eye,
  Zap,
  Cpu,
  Layers,
  Factory,
  Tag,
  Building2,
  Rocket,
  Sparkles,
  FileText,
  AlertTriangle,
  Clock,
  Hash,
  Loader2,
  Newspaper,
} from 'lucide-react';
import { toast } from 'sonner';

import Breadcrumb from '../ui/Breadcrumb';
import { Skeleton } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { TechIntelService } from '../../services/techIntelService';
import { TechIntelAIService } from '../../services/techIntelAIService';
import { formatDate, formatDateTime } from '../../utils/formatters';
import type { TechArticle } from '../../types/techIntel';
import {
  IMPACT_LEVEL_LABELS,
  IMPACT_LEVEL_COLORS,
  TECH_CATEGORY_LABELS,
  TECH_CATEGORY_COLORS,
  PROJECT_PHASE_LABELS,
  INDUSTRY_SECTOR_LABELS,
  EVENT_TYPE_LABELS,
} from '../../types/techIntel';
import type {
  TechCategory,
  ProjectPhase,
  IndustrySector,
  TechEventType,
  ImpactLevel,
} from '../../types/techIntel';

// ─── Helpers ──────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const },
  }),
};

const IMPACT_ICONS: Record<ImpactLevel, React.ReactNode> = {
  low: <Zap size={18} />,
  medium: <Zap size={18} />,
  high: <AlertTriangle size={18} />,
  breakthrough: <Sparkles size={18} />,
};

// ─── Analysis Card Sub-component ──────────────────────

interface AnalysisCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  index: number;
}

function AnalysisCard({ icon, title, children, index }: AnalysisCardProps) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-5"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div>{children}</div>
    </motion.div>
  );
}

// ─── Badge list helper ────────────────────────────────

function BadgeList({
  items,
  colorClass,
}: {
  items: string[];
  colorClass?: string;
}) {
  if (!items.length) {
    return (
      <span className="text-sm text-slate-400 dark:text-slate-500 italic">
        Chưa xác định
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-lg ${
            colorClass ||
            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <Skeleton className="h-5 w-72" />

      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-full max-w-2xl" />
        <Skeleton className="h-5 w-full max-w-xl" />
        <div className="flex gap-3 items-center">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </div>

      {/* Analysis grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────

interface TechArticleDetailProps {
  articleId?: string;
  onBack?: () => void;
  onUpdated?: (article: TechArticle) => void;
}

export default function TechArticleDetail({ articleId: propId, onBack, onUpdated }: TechArticleDetailProps) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId;

  const [article, setArticle] = useState<TechArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Helper to update state and trigger parent callback
  const updateArticleState = useCallback((newArticle: TechArticle) => {
    setArticle(newArticle);
    onUpdated?.(newArticle);
  }, [onUpdated]);

  // Helper to show skeleton loader when analyzing
  const renderCardContent = (content: React.ReactNode) => {
    if (analyzing) {
      return (
        <div className="space-y-2 animate-pulse py-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-full" />
        </div>
      );
    }
    return content;
  };

  // Helper to clean HTML from description if legacy data has it
  const cleanSummary = (text: string) => {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '') // remove HTML tags
      .replace(/&[a-zA-Z0-9#]+;/g, ' ') // remove HTML entities
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Fetch article
  const fetchArticle = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      let data = await TechIntelService.getArticleById(id);
      if (!data) {
        setNotFound(true);
        return;
      }

      // Nếu là bài viết pending và chưa có content thô cào về,
      // tự động gọi API cào nội dung gốc và ảnh đại diện
      if (data.status === 'pending' && (!data.content || data.content.length < 50)) {
        try {
          const res = await fetch('/api/tech-intel/crawl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'extract', articleId: id })
          });
          if (res.ok) {
            const updatedData = await res.json();
            if (updatedData) {
              data = {
                ...data,
                content: updatedData.content || data.content,
                thumbnailUrl: updatedData.thumbnail_url || updatedData.thumbnailUrl || data.thumbnailUrl,
                summary: updatedData.summary || data.summary
              };
            }
          }
        } catch (err) {
          console.warn('[TechIntel] Failed to extract content during fetch:', err);
        }
      }

      updateArticleState(data);
      setBookmarked(!!data.isBookmarked);

      // Increment view count silently
      TechIntelService.incrementViewCount(id).catch(() => {});
    } catch (err) {
      console.error('Error loading article:', err);
      toast.error('Không thể tải bài viết');
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Check bookmark status
  const checkBookmark = useCallback(async () => {
    if (!id) return;
    try {
      const bookmarkedIds = await TechIntelService.getBookmarkedArticleIds();
      setBookmarked(bookmarkedIds.has(id));
    } catch {
      // Silent fail
    }
  }, [id]);

  useEffect(() => {
    fetchArticle();
    checkBookmark();
  }, [fetchArticle, checkBookmark]);

  // Handle manual AI analysis
  const handleRunAnalysis = async () => {
    if (!article || analyzing) return;
    try {
      setAnalyzing(true);
      toast.info('Đang phân tích bài viết bằng AI...');
      const updated = await TechIntelAIService.analyzeAndUpdateArticle(article.id);
      updateArticleState(updated);
      toast.success('Phân tích AI hoàn thành!');
    } catch (err: any) {
      console.error('[TechIntel] AI analysis failed:', err);
      toast.error(`Phân tích AI thất bại: ${err.message || String(err)}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // Toggle bookmark handler
  const handleToggleBookmark = async () => {
    if (!id || bookmarkLoading) return;
    try {
      setBookmarkLoading(true);
      const result = await TechIntelService.toggleBookmark(id);
      setBookmarked(result);
      toast.success(result ? 'Đã đánh dấu bài viết' : 'Đã bỏ đánh dấu');
    } catch (err) {
      toast.error('Không thể cập nhật đánh dấu');
    } finally {
      setBookmarkLoading(false);
    }
  };

  // ─── Loading state ────────────────────
  if (loading) return <DetailSkeleton />;

  // ─── Not found state ──────────────────
  if (notFound || !article) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <EmptyState
          type="no-results"
          title="Không tìm thấy bài viết"
          message="Bài viết này có thể đã bị xóa hoặc không tồn tại."
          action={{
            label: 'Quay lại danh sách',
            onClick: () => onBack?.(),
          }}
        />
      </div>
    );
  }

  // ─── Derived data ─────────────────────
  const isPending = article.status === 'pending' || article.status === 'analyzing';

  const impactColor = IMPACT_LEVEL_COLORS[article.impactLevel] || IMPACT_LEVEL_COLORS.medium;
  const impactLabel = IMPACT_LEVEL_LABELS[article.impactLevel] || 'Trung bình';
  const impactIcon = IMPACT_ICONS[article.impactLevel];

  const categoryLabel = article.technologyCategory
    ? TECH_CATEGORY_LABELS[article.technologyCategory as TechCategory]
    : null;
  const categoryColor = article.technologyCategory
    ? TECH_CATEGORY_COLORS[article.technologyCategory as TechCategory]
    : null;

  const eventLabel = article.eventType
    ? EVENT_TYPE_LABELS[article.eventType as TechEventType]
    : null;

  const phaseLabels = (article.projectPhases || []).map(
    (p) => PROJECT_PHASE_LABELS[p as ProjectPhase] || p
  );

  const industryLabels = (article.industries || []).map(
    (i) => INDUSTRY_SECTOR_LABELS[i as IndustrySector] || i
  );

  const showViTitle =
    article.titleVi && article.titleVi !== article.title;

  // Breadcrumb items
  const breadcrumbItems = [
    {
      label: 'Giám sát Công nghệ',
      onClick: () => onBack?.(),
    },
    {
      label: 'Tin tức',
      onClick: () => onBack?.(),
    },
    {
      label:
        (article.titleVi || article.title).length > 50
          ? (article.titleVi || article.title).substring(0, 50) + '...'
          : article.titleVi || article.title,
    },
  ];

  let cardIdx = 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ─── Breadcrumb ──────────────────── */}
      <Breadcrumb items={breadcrumbItems} showHome={false} />

      {/* ─── Thumbnail Banner (chỉ hiện cho bài đã phân tích, và chỉ khi có ảnh) ─── */}
      {!isPending && article.thumbnailUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative h-64 sm:h-80 md:h-96 w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md"
        >
          <img
            src={article.thumbnailUrl}
            alt={article.titleVi || article.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        </motion.div>
      )}

      {/* ─── Header Section ──────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-4"
      >
        {!isPending && article.titleVi ? (
          <>
            {/* Tiêu đề tiếng Việt là chính */}
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {article.titleVi}
            </h1>
            {/* Tiêu đề gốc — để đối chiếu */}
            {showViTitle && (
              <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed italic">
                <span className="not-italic font-medium text-slate-400 dark:text-slate-500">Bản gốc: </span>
                {article.title}
              </p>
            )}
          </>
        ) : (
          /* Chưa phân tích → chỉ có tiêu đề gốc */
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
            {article.title}
          </h1>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {/* Source */}
          {article.sourceName && (
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Globe size={14} className="text-slate-400 dark:text-slate-500" />
              {article.sourceName}
              {article.sourceCountry && (
                <span className="text-slate-400 dark:text-slate-500">
                  ({article.sourceCountry})
                </span>
              )}
            </span>
          )}

          {/* Published date */}
          {article.publishedAt && (
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
              {formatDate(article.publishedAt)}
            </span>
          )}

          {/* View count */}
          <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-500">
            <Eye size={14} />
            {article.viewCount} lượt xem
          </span>

          {/* Crawled time */}
          <span className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-xs">
            <Clock size={12} />
            Thu thập: {formatDateTime(article.crawledAt)}
          </span>
        </div>

        {/* Impact badge + action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status / Impact badge */}
          {isPending ? (
            <span
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/25 shadow-sm"
            >
              <Clock size={16} className="animate-pulse text-amber-500" />
              Trạng thái: Pending (Chờ phân tích)
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full ${impactColor}`}
            >
              {impactIcon}
              Mức ảnh hưởng: {impactLabel}
            </span>
          )}

          {/* Manual Run AI button */}
          {isPending && (
            <button
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm text-white ${
                analyzing 
                  ? 'bg-purple-400 dark:bg-purple-800 cursor-wait' 
                  : 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600'
              }`}
            >
              {analyzing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Đang phân tích...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Phân tích bằng AI
                </>
              )}
            </button>
          )}

          {/* Bookmark button */}
          <button
            onClick={handleToggleBookmark}
            disabled={bookmarkLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all cursor-pointer ${
              bookmarked
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            } ${bookmarkLoading ? 'opacity-60 cursor-wait' : ''}`}
          >
            {bookmarked ? (
              <BookmarkCheck size={16} />
            ) : (
              <Bookmark size={16} />
            )}
            {bookmarked ? 'Đã đánh dấu' : 'Đánh dấu'}
          </button>

          {/* Open original link */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <ExternalLink size={16} />
            Mở bài gốc
          </a>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* PENDING: Hiển thị dữ liệu thô gốc                     */}
      {/* ═══════════════════════════════════════════════════════ */}
      {isPending ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-5"
        >
          {/* Analyzing overlay */}
          {analyzing && (
            <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-6 space-y-3">
              <h2 className="text-base font-bold text-purple-800 dark:text-purple-300 mb-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                AI đang phân tích và dịch tóm tắt sang tiếng Việt...
              </h2>
              <div className="space-y-2 animate-pulse">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          )}

          {/* Raw data card */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-amber-200 dark:border-amber-800">
              <Newspaper size={18} className="text-amber-600 dark:text-amber-400" />
              <h2 className="text-base font-bold text-amber-800 dark:text-amber-300">
                Dữ liệu thô từ nguồn tin
              </h2>
              <span className="ml-auto text-[11px] uppercase font-semibold tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                Raw Data
              </span>
            </div>

            {/* Row: Thumbnail nhỏ + Thông tin cơ bản */}
            <div className="flex gap-5">
              {/* Thumbnail nhỏ gọn (nếu có) */}
              {article.thumbnailUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={article.thumbnailUrl}
                    alt="Thumbnail"
                    className="w-32 h-24 sm:w-40 sm:h-28 object-cover rounded-lg border border-amber-200 dark:border-amber-700"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Info grid */}
              <div className="flex-1 space-y-3 min-w-0">
                {/* URL */}
                <div>
                  <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                    URL nguồn
                  </span>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-indigo-600 dark:text-indigo-400 hover:underline truncate mt-0.5"
                    title={article.url}
                  >
                    {article.url}
                  </a>
                </div>

                {/* Source */}
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <div>
                    <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                      Nguồn tin
                    </span>
                    <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5">
                      {article.sourceName || '—'}
                      {article.sourceCountry && <span className="text-slate-400 dark:text-slate-500"> ({article.sourceCountry})</span>}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                      Ngôn ngữ
                    </span>
                    <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5">
                      {article.language?.toUpperCase() || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                      Ngày đăng
                    </span>
                    <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5">
                      {article.publishedAt ? formatDateTime(article.publishedAt) : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                      Thu thập lúc
                    </span>
                    <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5">
                      {formatDateTime(article.crawledAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Raw Summary */}
            <div>
              <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                Tóm tắt thô (RSS summary)
              </span>
              {article.summary && article.summary !== article.title ? (
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mt-1 bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                  {cleanSummary(article.summary)}
                </p>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500 italic mt-1">
                  Không có tóm tắt riêng biệt (trùng với tiêu đề hoặc không có)
                </p>
              )}
            </div>

            {/* Raw Content */}
            <div>
              <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                Nội dung thô (~3000 ký tự đầu)
              </span>
              {article.content ? (
                <div className="mt-1 bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-h-80 overflow-y-auto whitespace-pre-line pr-2">
                    {article.content}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    {article.content.length.toLocaleString('vi-VN')} ký tự
                  </p>
                </div>
              ) : (
                <div className="mt-1 bg-white dark:bg-slate-800 rounded-lg p-4 border border-dashed border-slate-300 dark:border-slate-600">
                  <p className="text-sm text-slate-400 dark:text-slate-500 italic flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    Chưa cào được nội dung thô. Bấm "Phân tích bằng AI" hoặc mở lại chi tiết để hệ thống tự động cào.
                  </p>
                </div>
              )}
            </div>


          </div>
        </motion.div>
      ) : (
        /* ═══════════════════════════════════════════════════════ */
        /* ANALYZED: Hiển thị kết quả phân tích AI đầy đủ         */
        /* ═══════════════════════════════════════════════════════ */
        <>
          {/* ─── AI Analysis Panel ───────────── */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-purple-500 dark:text-purple-400" />
              Phân tích AI
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. Impact Level + Reason */}
              <AnalysisCard
                icon={<Zap size={16} />}
                title="Mức ảnh hưởng"
                index={cardIdx++}
              >
                {renderCardContent(
                  <>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm font-semibold rounded-full mb-2 ${impactColor}`}
                    >
                      {impactIcon}
                      {impactLabel}
                    </span>
                    {article.impactReason && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                        {article.impactReason}
                      </p>
                    )}
                  </>
                )}
              </AnalysisCard>

              {/* 2. Technology Category + Technologies */}
              <AnalysisCard
                icon={<Cpu size={16} />}
                title="Nhóm công nghệ"
                index={cardIdx++}
              >
                {renderCardContent(
                  <div className="space-y-2">
                    {categoryLabel && categoryColor ? (
                      <span
                        className={`inline-flex items-center px-3 py-1 text-sm font-semibold rounded-lg ${categoryColor}`}
                      >
                        {categoryLabel}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400 dark:text-slate-500 italic">
                        Chưa phân loại
                      </span>
                    )}
                    {article.technologies.length > 0 && (
                      <div className="pt-1">
                        <BadgeList
                          items={article.technologies}
                          colorClass="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400"
                        />
                      </div>
                    )}
                  </div>
                )}
              </AnalysisCard>

              {/* 3. Project Phases */}
              <AnalysisCard
                icon={<Layers size={16} />}
                title="Giai đoạn dự án"
                index={cardIdx++}
              >
                {renderCardContent(
                  <BadgeList
                    items={phaseLabels}
                    colorClass="bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400"
                  />
                )}
              </AnalysisCard>

              {/* 4. Industries */}
              <AnalysisCard
                icon={<Factory size={16} />}
                title="Ngành công nghiệp"
                index={cardIdx++}
              >
                {renderCardContent(
                  <BadgeList
                    items={industryLabels}
                    colorClass="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                  />
                )}
              </AnalysisCard>

              {/* 5. Event Type */}
              <AnalysisCard
                icon={<Tag size={16} />}
                title="Loại sự kiện"
                index={cardIdx++}
              >
                {renderCardContent(
                  eventLabel ? (
                    <span className="inline-flex items-center px-3 py-1 text-sm font-semibold rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400">
                      {eventLabel}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500 italic">
                      Chưa xác định
                    </span>
                  )
                )}
              </AnalysisCard>

              {/* 6. Companies */}
              <AnalysisCard
                icon={<Building2 size={16} />}
                title="Doanh nghiệp"
                index={cardIdx++}
              >
                {renderCardContent(
                  <BadgeList
                    items={article.companies}
                    colorClass="bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                  />
                )}
              </AnalysisCard>

              {/* 7. Deployment Project */}
              <AnalysisCard
                icon={<Rocket size={16} />}
                title="Dự án triển khai"
                index={cardIdx++}
              >
                {renderCardContent(
                  article.deploymentProject ? (
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {article.deploymentProject}
                    </p>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500 italic">
                      Không có thông tin
                    </span>
                  )
                )}
              </AnalysisCard>

              {/* 8. Value Proposition */}
              <AnalysisCard
                icon={<Sparkles size={16} />}
                title="Giá trị mang lại"
                index={cardIdx++}
              >
                {renderCardContent(
                  article.valueProposition ? (
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {article.valueProposition}
                    </p>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500 italic">
                      Không có thông tin
                    </span>
                  )
                )}
              </AnalysisCard>
            </div>
          </div>

          {/* ─── Summary Section ─────────────── */}
          {analyzing ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-6 space-y-3"
            >
              <h2 className="text-base font-bold text-purple-800 dark:text-purple-300 mb-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                AI đang phân tích và dịch tóm tắt sang tiếng Việt...
              </h2>
              <div className="space-y-2 animate-pulse">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </motion.div>
          ) : article.summaryVi ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.35 }}
              className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-6"
            >
              <h2 className="text-base font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                <FileText size={18} />
                Tóm tắt nội dung
              </h2>
              <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed whitespace-pre-line">
                {article.summaryVi}
              </p>
            </motion.div>
          ) : article.summary ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.35 }}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-6"
            >
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                <FileText size={18} />
                Tóm tắt (Tiếng Anh)
              </h2>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {cleanSummary(article.summary)}
              </p>
            </motion.div>
          ) : null}

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="flex flex-wrap items-center gap-2"
            >
              <Hash size={14} className="text-slate-400 dark:text-slate-500" />
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          )}

          {/* Nội dung bài viết — tiếng Việt là chính, bản gốc để đối chiếu */}
          {(article.contentVi || article.content) && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.35 }}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3"
            >
              {article.contentVi ? (
                <>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <Newspaper size={18} />
                    Nội dung bài viết (tiếng Việt)
                  </h2>
                  <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line border-t border-slate-100 dark:border-slate-800 pt-3">
                    {article.contentVi}
                  </div>

                  {/* Bản gốc — thu gọn, chỉ để đối chiếu */}
                  {article.content && (
                    <details className="mt-4 group">
                      <summary className="cursor-pointer text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-2 select-none">
                        <Globe size={14} />
                        Xem nội dung gốc ({article.language?.toUpperCase() || 'gốc'}) — để đối chiếu
                      </summary>
                      <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-h-96 overflow-y-auto whitespace-pre-line pr-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {article.content}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                /* Chưa dịch được toàn văn → hiển thị bản gốc */
                <>
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                    <Newspaper size={18} />
                    Nội dung bài viết gốc
                  </h2>
                  <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-h-96 overflow-y-auto whitespace-pre-line pr-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    {article.content}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* ─── Bottom Action Bar ───────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.3 }}
        className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700"
      >
        <button
          onClick={() => onBack?.()}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          Quay lại
        </button>

        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors cursor-pointer"
        >
          <ExternalLink size={16} />
          Mở bài gốc
        </a>

        <button
          onClick={handleToggleBookmark}
          disabled={bookmarkLoading}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-all cursor-pointer ${
            bookmarked
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
          } ${bookmarkLoading ? 'opacity-60 cursor-wait' : ''}`}
        >
          {bookmarked ? (
            <BookmarkCheck size={16} />
          ) : (
            <Bookmark size={16} />
          )}
          {bookmarked ? 'Đã đánh dấu' : 'Đánh dấu'}
        </button>
      </motion.div>
    </div>
  );
}
