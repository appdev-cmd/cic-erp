import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { toast } from 'sonner';
import {
  FileText, Plus, Download, Eye, Calendar, Filter, Loader2,
  BarChart3, ChevronRight, Sparkles, X, Clock, ArrowLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TechIntelService } from '../../services/techIntelService';
import type { TechReport, ReportType } from '../../types/techIntel';
import { REPORT_TYPE_LABELS } from '../../types/techIntel';
import { formatDate } from '../../utils/formatters';
import Modal from '../ui/Modal';
import DateInput from '../ui/DateInput';
import EmptyState from '../ui/EmptyState';
import Button from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { useSlidePanel } from '../../contexts/SlidePanelContext';

const TechReportViewer = lazy(() => import('./TechReportViewer'));

// Tab definitions using REPORT_TYPE_LABELS
const REPORT_TABS: { key: ReportType | 'all'; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'weekly', label: REPORT_TYPE_LABELS.weekly },
  { key: 'monthly', label: REPORT_TYPE_LABELS.monthly },
  { key: 'quarterly', label: REPORT_TYPE_LABELS.quarterly },
  { key: 'custom', label: REPORT_TYPE_LABELS.custom },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'published', label: 'Đã xuất bản' },
];

const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 placeholder:text-slate-400 dark:placeholder:text-slate-500';

interface TechReportLibraryProps {
  onBack?: () => void;
}

export default function TechReportLibrary({ onBack }: TechReportLibraryProps) {
  const { openPanel, closePanel } = useSlidePanel();

  // Data state
  const [reports, setReports] = useState<TechReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportType | 'all'>('all');

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newReport, setNewReport] = useState({
    title: '',
    type: 'weekly' as ReportType,
    periodStart: '',
    periodEnd: '',
  });

  // Fetch reports
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const typeFilter = activeTab === 'all' ? undefined : activeTab;
      const data = await TechIntelService.getReports(typeFilter);
      setReports(data);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải danh sách báo cáo');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    let result = reports;

    if (filterStatus) {
      result = result.filter(r => r.status === filterStatus);
    }
    if (filterDateFrom) {
      result = result.filter(r => r.periodStart >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter(r => r.periodEnd <= filterDateTo);
    }

    return result;
  }, [reports, filterStatus, filterDateFrom, filterDateTo]);

  // Create report handler
  const handleCreateReport = async () => {
    if (!newReport.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề báo cáo');
      return;
    }
    if (!newReport.periodStart || !newReport.periodEnd) {
      toast.error('Vui lòng chọn khoảng thời gian');
      return;
    }

    setCreating(true);
    try {
      const created = await TechIntelService.createReport({
        title: newReport.title,
        type: newReport.type,
        periodStart: newReport.periodStart,
        periodEnd: newReport.periodEnd,
        generatedBy: 'manual',
      });
      toast.success('Đã tạo báo cáo mới');
      setShowCreateModal(false);
      setNewReport({ title: '', type: 'weekly', periodStart: '', periodEnd: '' });
      openPanel({
        title: 'Xem Báo cáo',
        url: `/tech-intel/reports/${created.id}`,
        component: (
          <div className="p-4 md:p-6 lg:p-8">
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>}>
              <TechReportViewer reportId={created.id} onBack={() => closePanel()} />
            </Suspense>
          </div>
        ),
      });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tạo báo cáo');
    } finally {
      setCreating(false);
    }
  };

  // Reset filters
  const clearFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterStatus('');
  };

  const hasActiveFilters = filterDateFrom || filterDateTo || filterStatus;

  // Status badge renderer
  const renderStatusBadge = (status: 'draft' | 'published') => {
    const cls = status === 'published'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    const label = status === 'published' ? 'Đã xuất bản' : 'Bản nháp';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
        {status === 'published' ? <Sparkles size={12} /> : <Clock size={12} />}
        {label}
      </span>
    );
  };

  // Report type badge
  const renderTypeBadge = (type: ReportType) => {
    const colorMap: Record<ReportType, string> = {
      weekly: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      monthly: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      quarterly: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      custom: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colorMap[type]}`}>
        {REPORT_TYPE_LABELS[type]}
      </span>
    );
  };

  // Skeleton loader for report cards
  const renderSkeletons = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );

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
              <FileText size={28} className="text-indigo-600 dark:text-indigo-400" />
              Thư viện Báo cáo
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Quản lý và xem các bản tin công nghệ định kỳ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
              hasActiveFilters
                ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Filter size={16} />
            Bộ lọc
            {hasActiveFilters && (
              <span className="ml-1 w-2 h-2 bg-indigo-500 rounded-full" />
            )}
          </button>

          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            className="gap-1.5"
          >
            <Plus size={16} />
            Tạo báo cáo
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-none">
          {REPORT_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Bộ lọc nâng cao</h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Từ ngày</label>
                  <DateInput value={filterDateFrom} onChange={setFilterDateFrom} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Đến ngày</label>
                  <DateInput value={filterDateTo} onChange={setFilterDateTo} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Trạng thái</label>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className={inputCls + ' cursor-pointer'}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Grid */}
      {loading ? (
        renderSkeletons()
      ) : filteredReports.length === 0 ? (
        <EmptyState
          type="no-data"
          icon={<FileText size={48} />}
          title="Chưa có báo cáo nào"
          message={hasActiveFilters ? 'Không tìm thấy báo cáo phù hợp với bộ lọc' : 'Tạo báo cáo đầu tiên để bắt đầu'}
          action={
            hasActiveFilters
              ? { label: 'Xóa bộ lọc', onClick: clearFilters }
              : { label: 'Tạo báo cáo', onClick: () => setShowCreateModal(true) }
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredReports.map((report, index) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.25 }}
              className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-lg dark:hover:shadow-slate-950/40 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200 flex flex-col"
            >
              {/* Card Header */}
              <div className="p-5 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {report.title}
                  </h3>
                </div>

                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2">
                  {renderTypeBadge(report.type)}
                  {renderStatusBadge(report.status)}
                </div>

                {/* Period & article count */}
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={13} />
                    {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BarChart3 size={13} />
                    {report.articleCount} bài viết
                  </span>
                </div>

                {/* Highlights preview */}
                {report.highlights && report.highlights.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {report.highlights.slice(0, 2).map((hl, i) => (
                      <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                        <ChevronRight size={12} className="mt-0.5 shrink-0 text-indigo-500 dark:text-indigo-400" />
                        <span className="line-clamp-1">{hl}</span>
                      </li>
                    ))}
                    {report.highlights.length > 2 && (
                      <li className="text-xs text-slate-400 dark:text-slate-500 pl-5">
                        +{report.highlights.length - 2} điểm nổi bật khác
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* Card Actions */}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <button
                  onClick={() => openPanel({
                    title: 'Xem Báo cáo',
                    url: `/tech-intel/reports/${report.id}`,
                    component: (
                      <div className="p-4 md:p-6 lg:p-8">
                        <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>}>
                          <TechReportViewer reportId={report.id} onBack={() => closePanel()} />
                        </Suspense>
                      </div>
                    ),
                  })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
                >
                  <Eye size={14} />
                  Xem
                </button>
                <button
                  onClick={() => toast.info('Tính năng xuất PDF đang phát triển')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  Tải PDF
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Report Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Tạo báo cáo mới"
        size="md"
      >
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tiêu đề báo cáo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newReport.title}
              onChange={e => setNewReport(prev => ({ ...prev, title: e.target.value }))}
              placeholder="VD: Bản tin công nghệ xây dựng tuần 24/2026"
              className={inputCls}
            />
          </div>

          {/* Report type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Loại báo cáo <span className="text-red-500">*</span>
            </label>
            <select
              value={newReport.type}
              onChange={e => setNewReport(prev => ({ ...prev, type: e.target.value as ReportType }))}
              className={inputCls + ' cursor-pointer'}
            >
              {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Từ ngày <span className="text-red-500">*</span>
              </label>
              <DateInput
                value={newReport.periodStart}
                onChange={v => setNewReport(prev => ({ ...prev, periodStart: v }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Đến ngày <span className="text-red-500">*</span>
              </label>
              <DateInput
                value={newReport.periodEnd}
                onChange={v => setNewReport(prev => ({ ...prev, periodEnd: v }))}
                className={inputCls}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <Button
              variant="primary"
              onClick={handleCreateReport}
              disabled={creating}
              className="gap-1.5"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {creating ? 'Đang tạo...' : 'Tạo báo cáo'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
