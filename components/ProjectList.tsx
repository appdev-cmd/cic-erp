import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, MapPin, Calendar, Building2, Filter, X, Globe, EyeOff, Star, LayoutGrid, List, Download, Upload, Copy, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { ProjectService } from '../services';
import { BIMProject, BIMProjectStatus, BIM_PROJECT_STATUS_LABELS } from '../types';
import { toast } from 'sonner';
import { formatDate } from '../utils/formatters';
import { exportProjectsToExcel } from '../services/projectExportService';
import ImportProjectModal from './ImportProjectModal';

interface ProjectListProps {
  onSelectProject: (id: string) => void;
  onCreateProject?: () => void;
  refreshKey?: number;
}

// ── Status Colors & Config ──────────────────────────────────────────────
const STATUS_CONFIG: Record<BIMProjectStatus, { bg: string; text: string; dot: string }> = {
  'new':       { bg: 'bg-slate-100 dark:bg-slate-800',       text: 'text-slate-700 dark:text-slate-300',    dot: 'bg-slate-400' },
  'active':    { bg: 'bg-indigo-100 dark:bg-indigo-900/30',  text: 'text-indigo-700 dark:text-indigo-400',  dot: 'bg-indigo-500' },
  'paused':    { bg: 'bg-amber-100 dark:bg-amber-900/30',    text: 'text-amber-700 dark:text-amber-400',    dot: 'bg-amber-500' },
  'done':      { bg: 'bg-emerald-100 dark:bg-emerald-900/30',text: 'text-emerald-700 dark:text-emerald-400',dot: 'bg-emerald-500' },
  'cancelled': { bg: 'bg-rose-100 dark:bg-rose-900/30',      text: 'text-rose-700 dark:text-rose-400',      dot: 'bg-rose-500' },
};

const ALL_STATUSES = Object.keys(BIM_PROJECT_STATUS_LABELS) as BIMProjectStatus[];

// ── Placeholder thumbnails ──────────────────────────────────────────────
const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=340&fit=crop',
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&h=340&fit=crop',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&h=340&fit=crop',
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&h=340&fit=crop',
  'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=600&h=340&fit=crop',
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=340&fit=crop',
];

function getPlaceholder(index: number) {
  return PLACEHOLDER_IMAGES[index % PLACEHOLDER_IMAGES.length];
}

// ── Sort Config ─────────────────────────────────────────────────────────
type SortKey = 'newest' | 'name_az' | 'progress_desc' | 'value_desc';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'name_az', label: 'Tên A→Z' },
  { value: 'progress_desc', label: 'Tiến độ cao' },
  { value: 'value_desc', label: 'Giá trị cao' },
];

function calcTimeProgress(startDate?: string, endDate?: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  if (end <= start) return null;
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

// ── Progress Bar Component ──────────────────────────────────────────────
const ProgressBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="flex items-center gap-2">
    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 w-14 shrink-0">{label}</span>
    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{value}%</span>
  </div>
);

// ── Project Card Component ──────────────────────────────────────────────
const ProjectCard: React.FC<{ project: BIMProject; index: number; onClick: () => void; onToggleWeb: (e: React.MouseEvent, p: BIMProject) => void; onToggleFeatured: (e: React.MouseEvent, p: BIMProject) => void }> = ({ project, index, onClick, onToggleWeb, onToggleFeatured }) => {
  const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG['new'];
  const thumbnail = project.thumbnailUrl || getPlaceholder(index);

  return (
    <div
      onClick={onClick}
      className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl dark:hover:shadow-slate-800/40 transition-all duration-300 cursor-pointer overflow-hidden hover:-translate-y-1"
    >
      {/* Thumbnail */}
      <div className="relative h-44 overflow-hidden">
        <img
          src={thumbnail}
          alt={project.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholder(index); }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Web status toggles - top left */}
        <div className="absolute top-3 left-3 flex gap-1.5 z-10">
          <button
            onClick={(e) => onToggleWeb(e, project)}
            title={project.isPublishedWeb ? "Ẩn khỏi Web" : "Hiển thị trên Web"}
            className={`p-1.5 rounded-md backdrop-blur-sm transition-all border ${project.isPublishedWeb
                ? 'bg-emerald-500/80 hover:bg-emerald-600/90 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                : 'bg-black/40 hover:bg-black/60 border-white/20 text-slate-300'
              }`}
          >
            {project.isPublishedWeb ? <Globe size={14} /> : <EyeOff size={14} />}
          </button>

          <button
            onClick={(e) => onToggleFeatured(e, project)}
            title={project.isFeaturedWeb ? "Bỏ nổi bật" : "Đánh dấu nổi bật"}
            className={`p-1.5 rounded-md backdrop-blur-sm transition-all border ${project.isFeaturedWeb
                ? 'bg-amber-500/80 hover:bg-amber-600/90 border-amber-400 text-white shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                : 'bg-black/40 hover:bg-black/60 border-white/20 text-slate-300'
              }`}
          >
            <Star size={14} className={project.isFeaturedWeb ? "fill-white" : ""} />
          </button>
        </div>

        {/* Status badge — top right */}
        <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.text} backdrop-blur-sm border border-white/20 dark:border-slate-700/50`}>
          {BIM_PROJECT_STATUS_LABELS[project.status]}
        </div>

        {/* Code badge — bottom left on image */}
        <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded bg-black/40 backdrop-blur-sm text-white text-[11px] font-mono font-bold">
          {project.code}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Project name */}
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {project.name}
        </h3>

        {/* Location */}
        {project.location && (
          <div className="flex items-start gap-1.5">
            <MapPin size={13} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
            <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{project.location}</span>
          </div>
        )}

        {/* Client */}
        {project.clientName && (
          <div className="flex items-center gap-1.5">
            <Building2 size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
            <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{project.clientName}</span>
          </div>
        )}

        {/* Progress */}
        <div className="pt-1 space-y-1.5">
          <ProgressBar label="Tiến độ" value={project.progress} color="bg-indigo-500 dark:bg-indigo-400" />
          {(() => {
            const tp = calcTimeProgress(project.startDate, project.endDate);
            if (tp === null) return null;
            const isDelayed = tp > project.progress;
            return (
              <ProgressBar
                label="Thời gian"
                value={tp}
                color={isDelayed ? 'bg-rose-400 dark:bg-rose-500' : 'bg-slate-400 dark:bg-slate-500'}
              />
            );
          })()}
        </div>

        {/* Footer: Contract value + dates */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          {project.contractValue > 0 ? (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Giá trị HĐ</p>
              <p className="text-base font-black text-indigo-600 dark:text-indigo-400">
                {project.contractValue >= 1_000_000_000
                  ? <>{(project.contractValue / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} <span className="text-[11px] font-bold">Tỷ</span></>
                  : <>{(project.contractValue / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} <span className="text-[11px] font-bold">Triệu</span></>
                }
              </p>
            </div>
          ) : (
            <div />
          )}
          {project.startDate && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
              <Calendar size={12} />
              <span>{formatDate(project.startDate)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main ProjectList ────────────────────────────────────────────────────
const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject, onCreateProject, refreshKey = 0 }) => {
  const [projects, setProjects] = useState<BIMProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BIMProjectStatus | 'All'>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [showImport, setShowImport] = useState(false);

  type ViewMode = 'grid' | 'table';
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    return (localStorage.getItem('cic-erp-project-view-mode') as ViewMode) || 'grid';
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem('cic-erp-project-view-mode', mode);
  };

  // Fetch projects
  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const data = await ProjectService.getAll();
        setProjects(data);
      } catch (err: any) {
        toast.error('Lỗi tải danh sách dự án: ' + (err.message || err));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [refreshKey]);

  const toggleWeb = async (e: React.MouseEvent, project: BIMProject) => {
    e.stopPropagation();
    try {
      const updated = await ProjectService.update(project.id, { isPublishedWeb: !project.isPublishedWeb });
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
      toast.success(updated.isPublishedWeb ? 'Đã hiển thị trên Web' : 'Đã ẩn khỏi Web');
    } catch (error: any) {
      toast.error('Lỗi khi cập nhật Web: ' + error.message);
    }
  };

  const toggleFeatured = async (e: React.MouseEvent, project: BIMProject) => {
    e.stopPropagation();
    try {
      const updated = await ProjectService.update(project.id, { isFeaturedWeb: !project.isFeaturedWeb });
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
      toast.success(updated.isFeaturedWeb ? 'Đã ghim nổi bật' : 'Đã bỏ ghim nổi bật');
    } catch (error: any) {
      toast.error('Lỗi khi cập nhật nổi bật: ' + error.message);
    }
  };

  // Filter & search
  const filteredProjects = useMemo(() => {
    let result = projects;
    if (statusFilter !== 'All') {
      result = result.filter(p => p.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term) ||
        (p.location || '').toLowerCase().includes(term) ||
        (p.clientName || '').toLowerCase().includes(term)
      );
    }
    // Apply sort
    const sorted = [...result];
    switch (sortKey) {
      case 'name_az':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        break;
      case 'progress_desc':
        sorted.sort((a, b) => b.progress - a.progress);
        break;
      case 'value_desc':
        sorted.sort((a, b) => b.contractValue - a.contractValue);
        break;
      default: // newest — giữ thứ tự từ DB (created_at DESC)
        break;
    }
    return sorted;
  }, [projects, statusFilter, searchTerm, sortKey]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: projects.length };
    ALL_STATUSES.forEach(s => { counts[s] = 0; });
    projects.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [projects]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="h-44 bg-slate-200 dark:bg-slate-800" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-500 pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Dự án</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
            Quản lý dự án tư vấn BIM • <span className="font-bold text-indigo-600 dark:text-indigo-400">{projects.length}</span> dự án
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportProjectsToExcel(filteredProjects)}
            title="Xuất danh sách dự án ra Excel"
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-emerald-200 dark:shadow-none hover:scale-[1.02] active:scale-95"
          >
            <Download size={16} />
            Xuất Excel
          </button>
          <button
            onClick={() => setShowImport(true)}
            title="Nhập dự án từ file Excel"
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg transition-all hover:bg-slate-50 dark:hover:bg-slate-700 hover:scale-[1.02] active:scale-95"
          >
            <Upload size={16} />
            Nhập Excel
          </button>
          {onCreateProject && (
            <button
              onClick={onCreateProject}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-95"
            >
              <Plus size={18} />
              Thêm dự án
            </button>
          )}
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm tên dự án, mã, địa điểm..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent outline-none transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {/* Sort selector */}
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="px-3 py-2.5 rounded-lg text-sm font-semibold border bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all ${showFilters || statusFilter !== 'All'
              ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
        >
          <Filter size={16} />
          Lọc trạng thái
          {statusFilter !== 'All' && (
            <span className="ml-1 w-5 h-5 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white text-[10px] flex items-center justify-center font-bold">1</span>
          )}
        </button>
        {/* View Mode Toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            title="Dạng lưới"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'table'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            title="Dạng bảng"
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Status filter pills */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => setStatusFilter('All')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${statusFilter === 'All'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
          >
            Tất cả ({statusCounts.All})
          </button>
          {ALL_STATUSES.map(status => {
            const cfg = STATUS_CONFIG[status];
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? 'All' : status)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${statusFilter === status
                    ? `${cfg.bg} ${cfg.text} ring-2 ring-offset-1 ring-current dark:ring-offset-slate-900`
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {BIM_PROJECT_STATUS_LABELS[status]} ({statusCounts[status] || 0})
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Building2 size={32} className="text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">Chưa có dự án nào</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {searchTerm || statusFilter !== 'All'
              ? 'Không tìm thấy dự án phù hợp. Thử thay đổi bộ lọc.'
              : 'Dự án sẽ hiển thị ở đây khi được tạo.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr>
                  {/* STT */}
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-1.5 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-center w-9">
                    STT
                  </th>
                  {/* Mã dự án */}
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 min-w-[140px]">
                    Mã dự án
                  </th>
                  {/* Tên dự án */}
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 min-w-[320px]">
                    Tên dự án / Chủ đầu tư
                  </th>
                  {/* Địa điểm */}
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 min-w-[130px]">
                    Địa điểm
                  </th>
                  {/* Giá trị */}
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-right min-w-[120px]">
                    Giá trị HĐ
                  </th>
                  {/* Tiến độ */}
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-400 text-center min-w-[130px]">
                    Tiến độ
                  </th>
                  {/* Thời gian */}
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 min-w-[130px]">
                    Thời gian
                  </th>
                  {/* Trạng thái */}
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-center min-w-[130px]">
                    Trạng thái
                  </th>
                  {/* Web actions */}
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-center w-[72px]">
                    Web
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900">
                {filteredProjects.map((p, idx) => {
                  const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG['new'];
                  const tp = calcTimeProgress(p.startDate, p.endDate);
                  const isDelayed = tp !== null && tp > p.progress;

                  // Badge label from code prefix (e.g. "DA", "BIM", etc.)
                  const badgeLabel = p.code
                    ? p.code.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'DA'
                    : (p.serviceType ? p.serviceType.substring(0, 3).toUpperCase() : 'DA');

                  const badgeColor = p.status === 'active'
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                    : p.status === 'done'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    : p.status === 'paused'
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                    : p.status === 'cancelled'
                    ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelectProject(p.id)}
                      className={`group transition-all cursor-pointer hover:bg-orange-50/30 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${idx % 2 !== 0 ? 'bg-slate-50/60 dark:bg-slate-900' : 'bg-white dark:bg-slate-900'}`}
                    >
                      {/* STT */}
                      <td className="px-1.5 py-2 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        {(idx + 1).toString().padStart(2, '0')}
                      </td>

                      {/* Mã dự án */}
                      <td className="px-2 py-2 overflow-hidden">
                        <div className="flex items-start gap-1.5">
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0 border ${badgeColor}`}>
                            {badgeLabel}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-slate-100 leading-none flex items-center gap-1">
                              <span className="truncate max-w-[90px]">{p.code || '—'}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(p.code || p.id);
                                  toast.success(`Đã copy: ${p.code}`);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer flex-shrink-0"
                                title="Copy mã dự án"
                              >
                                <Copy size={10} />
                              </button>
                            </p>
                            {p.startDate && (
                              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-tighter">
                                {formatDate(p.startDate)}
                              </p>
                            )}
                            {p.contactName && (
                              <p className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 mt-0.5 truncate max-w-[100px]">
                                {p.contactName}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tên dự án + CĐT */}
                      <td className="px-3 py-2 overflow-hidden">
                        <div className="flex items-start gap-2.5">
                          <img
                            src={p.thumbnailUrl || getPlaceholder(idx)}
                            alt=""
                            className="w-8 h-8 rounded-md object-cover flex-shrink-0 border border-slate-200 dark:border-slate-700 mt-0.5"
                            onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholder(idx); }}
                          />
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {p.name}
                            </p>
                            {p.clientName ? (
                              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[260px]">
                                {p.clientName}
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5 italic">Chưa xác định CĐT</p>
                            )}
                            {p.endUserName && (
                              <p className="text-[9px] font-bold text-teal-600 dark:text-teal-400 mt-0.5 truncate max-w-[260px]">
                                👤 {p.endUserName}
                              </p>
                            )}
                            {(p.serviceType || p.constructionType) && (
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                {p.serviceType && (
                                  <span className="inline-flex px-1.5 py-0 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                    {p.serviceType}
                                  </span>
                                )}
                                {p.constructionType && (
                                  <span className="inline-flex px-1.5 py-0 rounded text-[8px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                    {p.constructionType}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Địa điểm */}
                      <td className="px-2 py-2 overflow-hidden">
                        {p.location ? (
                          <div className="flex items-start gap-1 text-[10px] text-slate-600 dark:text-slate-400">
                            <MapPin size={11} className="shrink-0 mt-0.5 text-slate-400" />
                            <span className="line-clamp-2 max-w-[120px]">{p.location}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">—</span>
                        )}
                      </td>

                      {/* Giá trị HĐ */}
                      <td className="px-2 py-2 text-right overflow-hidden">
                        {p.contractValue > 0 ? (
                          <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                            {p.contractValue >= 1_000_000_000
                              ? `${(p.contractValue / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`
                              : `${(p.contractValue / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tr`}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">Chưa có HĐ</span>
                        )}
                      </td>

                      {/* Tiến độ */}
                      <td className="px-2 py-2">
                        <div className="space-y-1.5 min-w-[120px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase w-10 shrink-0">Thực tế</span>
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all"
                                style={{ width: `${Math.min(p.progress, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 w-7 text-right shrink-0">
                              {p.progress}%
                            </span>
                          </div>
                          {tp !== null && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold text-slate-400 uppercase w-10 shrink-0">HĐ</span>
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${isDelayed ? 'bg-rose-400 dark:bg-rose-500' : 'bg-slate-300 dark:bg-slate-500'}`}
                                  style={{ width: `${Math.min(tp, 100)}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-black w-7 text-right shrink-0 ${isDelayed ? 'text-rose-500 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                {tp}%
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Thời gian */}
                      <td className="px-2 py-2 overflow-hidden">
                        {p.startDate || p.endDate ? (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
                            {p.startDate && (
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-slate-400 dark:text-slate-500 w-5 shrink-0">BĐ</span>
                                <span>{formatDate(p.startDate)}</span>
                              </div>
                            )}
                            {p.endDate && (
                              <div className="flex items-center gap-1">
                                <span className={`font-bold w-5 shrink-0 ${isDelayed ? 'text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>KT</span>
                                <span className={isDelayed ? 'text-rose-500 dark:text-rose-400 font-bold' : ''}>{formatDate(p.endDate)}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">—</span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-2 py-2 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                          {BIM_PROJECT_STATUS_LABELS[p.status]}
                        </span>
                      </td>

                      {/* Web toggles */}
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => toggleWeb(e, p)}
                            title={p.isPublishedWeb ? 'Ẩn khỏi Web' : 'Hiển thị trên Web'}
                            className={`p-1.5 rounded-md transition-all border ${p.isPublishedWeb
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-100'
                            }`}
                          >
                            {p.isPublishedWeb ? <Globe size={13} /> : <EyeOff size={13} />}
                          </button>
                          <button
                            onClick={(e) => toggleFeatured(e, p)}
                            title={p.isFeaturedWeb ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'}
                            className={`p-1.5 rounded-md transition-all border ${p.isFeaturedWeb
                              ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-500 dark:text-amber-400'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <Star size={13} className={p.isFeaturedWeb ? 'fill-current' : ''} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-300">
          {filteredProjects.map((project, idx) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={idx}
              onClick={() => onSelectProject(project.id)}
              onToggleWeb={toggleWeb}
              onToggleFeatured={toggleFeatured}
            />
          ))}
        </div>
      )}

      <ImportProjectModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => {
          setShowImport(false);
          ProjectService.getAll().then(setProjects).catch(() => {});
        }}
      />
    </div>
  );
};

export default ProjectList;
