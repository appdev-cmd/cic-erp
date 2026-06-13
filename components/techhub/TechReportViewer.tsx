import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, FileText, Calendar, BarChart3, Sparkles, Clock,
  Send, Building2, Cpu, TrendingUp, Loader2, BookOpen,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { TechIntelService } from '../../services/techIntelService';
import type { TechReport, ReportType } from '../../types/techIntel';
import type { ReportStatistics } from '../../types/techIntel';
import {
  REPORT_TYPE_LABELS, IMPACT_LEVEL_LABELS,
  TECH_CATEGORY_LABELS,
} from '../../types/techIntel';
import { formatDate } from '../../utils/formatters';
import Breadcrumb from '../ui/Breadcrumb';
import Button from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';

// Bar colors for impact distribution
const IMPACT_COLORS: Record<string, string> = {
  low: 'bg-slate-400 dark:bg-slate-500',
  medium: 'bg-blue-500 dark:bg-blue-400',
  high: 'bg-amber-500 dark:bg-amber-400',
  breakthrough: 'bg-red-500 dark:bg-red-400',
};

// Report type badge
function ReportTypeBadge({ type }: { type: ReportType }) {
  const colorMap: Record<ReportType, string> = {
    weekly: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    monthly: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    quarterly: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    custom: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorMap[type]}`}>
      <BookOpen size={12} className="mr-1" />
      {REPORT_TYPE_LABELS[type]}
    </span>
  );
}

// Status badge
function StatusBadge({ status }: { status: 'draft' | 'published' }) {
  const cls = status === 'published'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status === 'published' ? <Sparkles size={12} /> : <Clock size={12} />}
      {status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}
    </span>
  );
}

// Impact distribution horizontal bar
function ImpactDistribution({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (!total) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
        Phân bố tác động
      </h4>
      <div className="space-y-1.5">
        {Object.entries(data).map(([key, count]) => {
          const pct = Math.round((count / total) * 100);
          const label = (IMPACT_LEVEL_LABELS as Record<string, string>)[key] || key;
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-slate-600 dark:text-slate-400 font-medium">{label}</span>
                <span className="text-slate-500 dark:text-slate-500">{count} ({pct}%)</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${IMPACT_COLORS[key] || 'bg-slate-400'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Top items list (technologies / companies)
function TopItemsList({ title, icon, items }: {
  title: string;
  icon: React.ReactNode;
  items: { name: string; count: number }[];
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {title}
      </h4>
      <ul className="space-y-1">
        {items.slice(0, 8).map((item, i) => (
          <li key={i} className="flex items-center justify-between text-xs">
            <span className="text-slate-700 dark:text-slate-300 truncate">{item.name}</span>
            <span className="text-slate-400 dark:text-slate-500 ml-2 tabular-nums">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface TechReportViewerProps {
  reportId?: string;
  onBack?: () => void;
}

export default function TechReportViewer({ reportId: propId, onBack }: TechReportViewerProps) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId;

  const [report, setReport] = useState<TechReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // Fetch report
  const loadReport = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await TechIntelService.getReportById(id);
      setReport(data);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải báo cáo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Publish handler
  const handlePublish = async () => {
    if (!report) return;
    setPublishing(true);
    try {
      const updated = await TechIntelService.publishReport(report.id);
      setReport(updated);
      toast.success('Đã xuất bản báo cáo');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xuất bản báo cáo');
    } finally {
      setPublishing(false);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-8 w-96" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-5 w-full" />)}
            <Skeleton className="h-5 w-3/4" />
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-5 w-full" />)}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!report) {
    return (
      <EmptyState
        type="no-data"
        icon={<FileText size={48} />}
        title="Không tìm thấy báo cáo"
        message="Báo cáo không tồn tại hoặc đã bị xóa"
        action={{ label: 'Quay lại', onClick: () => onBack?.() }}
      />
    );
  }

  const stats: ReportStatistics | undefined = report.statistics;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Giám sát Công nghệ', onClick: () => onBack?.() },
          { label: 'Báo cáo', onClick: () => onBack?.() },
          { label: report.title },
        ]}
        onHomeClick={() => onBack?.()}
      />

      {/* Report Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-3"
      >
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
          {report.title}
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          <ReportTypeBadge type={report.type} />
          <StatusBadge status={report.status} />

          <span className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <Calendar size={14} />
            {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
          </span>

          <span className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <BarChart3 size={14} />
            {report.articleCount} bài viết
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onBack?.()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            Quay lại
          </button>

          {report.status === 'draft' && (
            <Button
              variant="primary"
              onClick={handlePublish}
              disabled={publishing}
              className="gap-1.5"
            >
              {publishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {publishing ? 'Đang xuất bản...' : 'Xuất bản'}
            </Button>
          )}
        </div>
      </motion.div>

      {/* Content + Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="lg:col-span-3"
        >
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 md:p-8">
            {report.contentMarkdown ? (
              <article className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-black prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-sm prose-li:text-sm prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline prose-table:text-sm prose-img:rounded-lg">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {report.contentMarkdown}
                </ReactMarkdown>
              </article>
            ) : (
              <div className="text-center py-12">
                <FileText size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Chưa có nội dung báo cáo
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Statistics Sidebar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="space-y-4"
        >
          {/* Total articles card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <BarChart3 size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {stats?.totalArticles || report.articleCount}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tổng bài viết</p>
              </div>
            </div>
          </div>

          {/* Impact distribution */}
          {stats?.byImpact && Object.keys(stats.byImpact).length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <ImpactDistribution data={stats.byImpact} />
            </div>
          )}

          {/* Top technologies */}
          {stats?.topTechnologies && stats.topTechnologies.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <TopItemsList
                title="Công nghệ hàng đầu"
                icon={<Cpu size={12} />}
                items={stats.topTechnologies}
              />
            </div>
          )}

          {/* Top companies */}
          {stats?.topCompanies && stats.topCompanies.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <TopItemsList
                title="Công ty nổi bật"
                icon={<Building2 size={12} />}
                items={stats.topCompanies}
              />
            </div>
          )}

          {/* Category distribution */}
          {stats?.byCategory && Object.keys(stats.byCategory).length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <TrendingUp size={12} />
                Phân bố danh mục
              </h4>
              <ul className="space-y-1">
                {Object.entries(stats.byCategory).slice(0, 8).map(([key, count]) => {
                  const label = (TECH_CATEGORY_LABELS as Record<string, string>)[key] || key;
                  return (
                    <li key={key} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 dark:text-slate-300 truncate">{label}</span>
                      <span className="text-slate-400 dark:text-slate-500 ml-2 tabular-nums">{count}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Highlights */}
          {report.highlights && report.highlights.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Sparkles size={12} />
                Điểm nổi bật
              </h4>
              <ul className="space-y-1.5">
                {report.highlights.map((hl, i) => (
                  <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                    <span className="text-indigo-500 dark:text-indigo-400 mt-0.5 shrink-0">•</span>
                    {hl}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
