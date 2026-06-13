import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSlidePanel } from '../../contexts/SlidePanelContext';

// Lazy-loaded panel components
const TechNewsFeed = React.lazy(() => import('./TechNewsFeed'));
const TechReportLibrary = React.lazy(() => import('./TechReportLibrary'));
const TechArticleDetail = React.lazy(() => import('./TechArticleDetail'));
const TechSourceManager = React.lazy(() => import('./TechSourceManager'));
import { toast } from 'sonner';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Area,
  ComposedChart,
  Legend,
} from 'recharts';
import {
  Newspaper,
  TrendingUp,
  Zap,
  Globe,
  RefreshCw,
  Rss,
  FileBarChart,
  ArrowRight,
  ExternalLink,
  Loader2,
  Sparkles,
  Clock,
  Settings,
} from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';
import { TechIntelService } from '../../services/techIntelService';
import {
  TECH_CATEGORY_LABELS,
  INDUSTRY_SECTOR_LABELS,
  IMPACT_LEVEL_LABELS,
  IMPACT_LEVEL_COLORS,
} from '../../types/techIntel';
import type { TechDashboardStats, TechArticle, TechCategory, IndustrySector } from '../../types/techIntel';
import { formatDate } from '../../utils/formatters';
import {
  getChartColors,
  getAccentColor,
  getTooltipStyle,
  getGridStroke,
  getCursorFill,
  isDarkTheme,
} from '../../lib/themeColors';

// ─── Chart color palette ──────────────────────────────
const PIE_COLORS = ['#f97316', '#10b981', '#6366f1', '#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b', '#14b8a6', '#e11d48'];

// ─── Skeleton for loading state ───────────────────────
const DashboardSkeleton = () => (
  <div className="space-y-8 animate-pulse p-4 md:p-6">
    {/* Header skeleton */}
    <div className="space-y-3">
      <Skeleton className="h-9 w-80 rounded-lg" />
      <Skeleton className="h-5 w-64 rounded-lg" />
    </div>

    {/* KPI cards skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
    </div>

    {/* Charts skeleton */}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Skeleton className="h-[360px] rounded-xl" />
      <Skeleton className="h-[360px] rounded-xl" />
    </div>

    {/* Trend chart skeleton */}
    <Skeleton className="h-[320px] rounded-xl" />

    {/* News skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
    </div>
  </div>
);

// ─── KPI Card component ───────────────────────────────
interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accentClass: string;
  bgClass: string;
}

function KpiCard({ label, value, icon, accentClass, bgClass }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 group">
      {/* Decorative gradient corner */}
      <div className={`absolute -top-6 -right-6 h-20 w-20 rounded-full ${bgClass} opacity-60 transition-transform duration-300 group-hover:scale-125`} />

      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {value.toLocaleString('vi-VN')}
          </p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${bgClass}`}>
          <span className={accentClass}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Custom tooltip for charts ────────────────────────
function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={getTooltipStyle()} className="rounded-xl text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
          {p.value} bài viết
        </p>
      ))}
    </div>
  );
}

function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={getTooltipStyle()} className="rounded-xl text-sm">
      <p className="font-semibold">{payload[0].name}</p>
      <p className="text-slate-500 dark:text-slate-400">{payload[0].value} bài viết</p>
    </div>
  );
}

function CustomTrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={getTooltipStyle()} className="rounded-xl text-sm">
      <p className="font-semibold mb-1">{formatDate(label)}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-600 dark:text-slate-400">{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────
export default function TechHubDashboard() {
  const { openPanel, closePanel } = useSlidePanel();
  const [stats, setStats] = useState<TechDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const data = await TechIntelService.getDashboardStats();
      setStats(data);
      if (showToast) toast.success('Đã cập nhật dữ liệu giám sát');
    } catch (err: any) {
      console.error('Failed to load dashboard stats', err);
      toast.error('Không thể tải dữ liệu dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ─── Chart data transforms ─────────────────────────
  const categoryChartData = useMemo(() => {
    if (!stats) return [];
    return stats.categoryDistribution.map(d => ({
      name: TECH_CATEGORY_LABELS[d.category as TechCategory] || d.category,
      value: d.count,
    }));
  }, [stats]);

  const industryChartData = useMemo(() => {
    if (!stats) return [];
    return stats.industryDistribution.map(d => ({
      name: INDUSTRY_SECTOR_LABELS[d.industry as IndustrySector] || d.industry,
      value: d.count,
    }));
  }, [stats]);

  const trendChartData = useMemo(() => {
    if (!stats) return [];
    return stats.weeklyTrend.map(d => ({
      date: d.date,
      'Tổng tin': d.count,
      'Tin đột phá': d.breakthroughCount,
    }));
  }, [stats]);

  // ─── Loading state ─────────────────────────────────
  if (loading) return <DashboardSkeleton />;

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 dark:text-slate-400">
        <Newspaper className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">Không có dữ liệu</p>
        <p className="text-sm mt-1">Hệ thống chưa có dữ liệu giám sát công nghệ.</p>
      </div>
    );
  }

  const chartColors = getChartColors();
  const accentColor = getAccentColor();
  const gridStroke = getGridStroke();

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ═══════════════════════════════════════════════ */}
      {/* HEADER                                         */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/20">
              <Sparkles className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            Trung Tâm Giám Sát Công Nghệ
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            ConTech Intelligence Hub — Theo dõi xu hướng công nghệ ngành Xây dựng & Hạ tầng
          </p>
        </div>

        <button
          onClick={() => fetchStats(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Làm mới
        </button>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* KPI CARDS                                      */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Tổng tin tức"
          value={stats.totalArticles}
          icon={<Newspaper className="h-5 w-5" />}
          accentClass="text-blue-600 dark:text-blue-400"
          bgClass="bg-blue-100 dark:bg-blue-900/20"
        />
        <KpiCard
          label="Tin tức tuần"
          value={stats.weeklyArticles}
          icon={<TrendingUp className="h-5 w-5" />}
          accentClass="text-emerald-600 dark:text-emerald-400"
          bgClass="bg-emerald-100 dark:bg-emerald-900/20"
        />
        <KpiCard
          label="Tin đột phá"
          value={stats.breakthroughCount}
          icon={<Zap className="h-5 w-5" />}
          accentClass="text-amber-600 dark:text-amber-400"
          bgClass="bg-amber-100 dark:bg-amber-900/20"
        />
        <KpiCard
          label="Nguồn tin active"
          value={stats.activeSources}
          icon={<Globe className="h-5 w-5" />}
          accentClass="text-purple-600 dark:text-purple-400"
          bgClass="bg-purple-100 dark:bg-purple-900/20"
        />
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* CHARTS ROW — Category Bar + Industry Pie       */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Category Distribution — BarChart */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Phân bố theo nhóm công nghệ
          </h2>
          {categoryChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryChartData} margin={{ top: 8, right: 8, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: isDarkTheme() ? '#94a3b8' : '#64748b' }}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: isDarkTheme() ? '#94a3b8' : '#64748b' }}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: getCursorFill() }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {categoryChartData.map((_, idx) => (
                    <Cell key={idx} fill={chartColors[idx % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400 dark:text-slate-500 text-sm">
              Chưa có dữ liệu phân bố
            </div>
          )}
        </div>

        {/* Industry Distribution — PieChart */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Phân bố theo ngành
          </h2>
          {industryChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={industryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  stroke="none"
                >
                  {industryChartData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: isDarkTheme() ? '#94a3b8' : '#64748b' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-400 dark:text-slate-500 text-sm">
              Chưa có dữ liệu phân bố
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* WEEKLY TREND — Composed Area Chart             */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Xu hướng tin tức 30 ngày gần nhất
        </h2>
        {trendChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={trendChartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="breakthroughGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: isDarkTheme() ? '#94a3b8' : '#64748b' }}
                tickFormatter={(d: string) => {
                  const parts = d.split('-');
                  return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : d;
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: isDarkTheme() ? '#94a3b8' : '#64748b' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTrendTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8, color: isDarkTheme() ? '#94a3b8' : '#64748b' }}
              />
              <Area
                type="monotone"
                dataKey="Tổng tin"
                stroke={accentColor}
                strokeWidth={2}
                fill="url(#trendGradient)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
              />
              <Area
                type="monotone"
                dataKey="Tin đột phá"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#breakthroughGradient)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[280px] text-slate-400 dark:text-slate-500 text-sm">
            Chưa có dữ liệu xu hướng
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* BREAKING NEWS SECTION                          */}
      {/* ═══════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Zap className="h-4.5 w-4.5 text-amber-500 dark:text-amber-400" />
            Tin đột phá gần đây
          </h2>
          <button
            onClick={() => openPanel({
              title: 'Tin tức Công nghệ',
              url: '/tech-intel/feed',
              component: (
                <Suspense fallback={<div className="p-8 text-center text-slate-400">Đang tải...</div>}>
                  <div className="p-4 md:p-6 lg:p-8">
                    <TechNewsFeed onBack={() => closePanel()} />
                  </div>
                </Suspense>
              ),
            })}
            className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 flex items-center gap-1 cursor-pointer transition-colors"
          >
            Xem tất cả
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {stats.recentBreakthroughs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.recentBreakthroughs.map((article) => (
              <BreakthroughCard key={article.id} article={article} onClick={() => openPanel({
                title: article.titleVi || article.title || 'Chi tiết bài viết',
                url: `/tech-intel/articles/${article.id}`,
                component: (
                  <Suspense fallback={<div className="p-8 text-center text-slate-400">Đang tải...</div>}>
                    <div className="p-4 md:p-6 lg:p-8">
                      <TechArticleDetail articleId={article.id} onBack={() => closePanel()} />
                    </div>
                  </Suspense>
                ),
              })} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-10 text-center">
            <Zap className="h-8 w-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có tin đột phá nào.</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* QUICK ACTIONS BAR                              */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
        <button
          onClick={() => fetchStats(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-500 text-white px-5 py-2.5 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Cập nhật tin tức
        </button>

        <button
          onClick={() => openPanel({
            title: 'Tin tức Công nghệ',
            url: '/tech-intel/feed',
            component: (
              <Suspense fallback={<div className="p-8 text-center text-slate-400">Đang tải...</div>}>
                <div className="p-4 md:p-6 lg:p-8">
                  <TechNewsFeed onBack={() => closePanel()} />
                </div>
              </Suspense>
            ),
          })}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Rss className="h-4 w-4" />
          Xem tin tức
        </button>

        <button
          onClick={() => openPanel({
            title: 'Thư viện Báo cáo',
            url: '/tech-intel/reports',
            component: (
              <Suspense fallback={<div className="p-8 text-center text-slate-400">Đang tải...</div>}>
                <div className="p-4 md:p-6 lg:p-8">
                  <TechReportLibrary onBack={() => closePanel()} />
                </div>
              </Suspense>
            ),
          })}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <FileBarChart className="h-4 w-4" />
          Thư viện báo cáo
        </button>

        <button
          onClick={() => openPanel({
            title: 'Quản lý Nguồn tin',
            url: '/tech-intel/sources',
            component: (
              <Suspense fallback={<div className="p-8 text-center text-slate-400">Đang tải...</div>}>
                <div className="p-4 md:p-6 lg:p-8">
                  <TechSourceManager onBack={() => closePanel()} />
                </div>
              </Suspense>
            ),
          })}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Settings className="h-4 w-4" />
          Quản lý nguồn tin
        </button>
      </div>
    </div>
  );
}

// ─── Breakthrough Article Card ────────────────────────
interface BreakthroughCardProps {
  article: TechArticle;
  onClick: () => void;
}

function BreakthroughCard({ article, onClick }: BreakthroughCardProps) {
  const title = article.titleVi || article.title;
  const summary = article.summaryVi || article.summary;
  const impactLabel = IMPACT_LEVEL_LABELS[article.impactLevel] || article.impactLevel;
  const impactColor = IMPACT_LEVEL_COLORS[article.impactLevel] || IMPACT_LEVEL_COLORS.medium;

  return (
    <button
      onClick={onClick}
      className="group text-left w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 transition-all duration-200 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 hover:border-orange-300 dark:hover:border-orange-700 cursor-pointer"
    >
      {/* Top row: impact badge + external link icon */}
      <div className="flex items-center justify-between mb-2.5">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${impactColor}`}>
          <Zap className="h-3 w-3" />
          {impactLabel}
        </span>
        <ExternalLink className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors" />
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
        {title}
      </h3>

      {/* Summary */}
      {summary && (
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 mb-3 leading-relaxed">
          {summary}
        </p>
      )}

      {/* Footer: source + date */}
      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
        {article.sourceName && (
          <span className="flex items-center gap-1 truncate max-w-[140px]">
            <Globe className="h-3 w-3 flex-shrink-0" />
            {article.sourceName}
          </span>
        )}
        {article.publishedAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 flex-shrink-0" />
            {formatDate(article.publishedAt)}
          </span>
        )}
      </div>
    </button>
  );
}
