import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, MapPin, TrendingUp, Calendar, Building2, Filter, X, Globe, EyeOff, Star, ArrowUpDown, LayoutGrid, List } from 'lucide-react';
import { ProjectService } from '../services';
import { BIMProject, BIMProjectStatus, BIM_PROJECT_STATUS_LABELS } from '../types';
import { toast } from 'sonner';
import { formatDate } from '../utils/formatters';

interface ProjectListProps {
  onSelectProject: (id: string) => void;
  onCreateProject?: () => void;
  refreshKey?: number;
}

// ── Status Colors & Config ──────────────────────────────────────────────
const STATUS_CONFIG: Record<BIMProjectStatus, { bg: string; text: string; dot: string }> = {
  '10_XUCTIEN': {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  '20_BAOGIA': {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-700 dark:text-cyan-400',
    dot: 'bg-cyan-500',
  },
  '30_CHUANBI': {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  '40_TRINHTHAMDINH': {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  '50_HOTROQLDA': {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
  '60_THANHQUYETTOAN': {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  '70_LUUTRU': {
    bg: 'bg-teal-100 dark:bg-teal-900/30',
    text: 'text-teal-700 dark:text-teal-400',
    dot: 'bg-teal-500',
  },
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
  const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG['30_CHUANBI'];
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
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-bold sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 rounded-tl-xl w-[250px] min-w-[250px]">Tên & Mã dự án</th>
                  <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 w-[200px] min-w-[200px]">Địa điểm / CĐT</th>
                  <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 w-[150px] min-w-[150px]">Giá trị</th>
                  <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 w-[180px] min-w-[180px]">Tiến độ</th>
                  <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Trạng thái</th>
                  <th className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 text-right rounded-tr-xl">Nổi bật</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white dark:bg-slate-900">
                {filteredProjects.map((p, idx) => {
                  const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG['30_CHUANBI'];
                  const tp = calcTimeProgress(p.startDate, p.endDate);
                  const isDelayed = tp !== null && tp > p.progress;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelectProject(p.id)}
                      className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors group"
                    >
                      {/* Name & Code */}
                      <td className="px-6 py-4 whitespace-normal min-w-[250px]">
                        <div className="flex items-start gap-4">
                          <img
                            src={p.thumbnailUrl || getPlaceholder(idx)}
                            alt={p.name}
                            className="w-12 h-12 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                            onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholder(idx); }}
                          />
                          <div>
                            <p className="font-bold text-[14px] text-slate-800 dark:text-slate-100 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                              {p.name}
                            </p>
                            <p className="text-[11px] font-mono text-slate-400 font-semibold mt-0.5 uppercase">
                              {p.code}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Location & Client */}
                      <td className="px-6 py-4">
                        <div className="space-y-1 w-[200px] whitespace-normal">
                          {p.clientName ? (
                            <div className="flex items-start gap-1.5" title={p.clientName}>
                              <Building2 size={13} className="text-slate-400 shrink-0 mt-0.5" />
                              <span className="text-[13px] text-slate-700 dark:text-slate-300 font-medium line-clamp-2 break-words">{p.clientName}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs italic">Chưa xác định CĐT</span>
                          )}
                          {p.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin size={12} className="text-slate-400 shrink-0" />
                              <span className="text-[12px] text-slate-500 dark:text-slate-400 truncate max-w-[170px]">{p.location}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Value and Dates */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {p.contractValue > 0 ? (
                            <p className="font-black text-indigo-600 dark:text-indigo-400">
                              {p.contractValue >= 1_000_000_000
                                ? <>{(p.contractValue / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} <span className="text-[11px] font-bold">Tỷ</span></>
                                : <>{(p.contractValue / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} <span className="text-[11px] font-bold">Tr</span></>
                              }
                            </p>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 text-xs italic">Chưa có HĐ</span>
                          )}
                          {p.startDate && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Calendar size={12} className="shrink-0" />
                              <span>{formatDate(p.startDate)}</span>
                              {p.endDate && <span>→ {formatDate(p.endDate)}</span>}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Progress */}
                      <td className="px-6 py-4 w-[180px]">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-slate-500 w-12">Thực tế</span>
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all" style={{ width: `${Math.min(p.progress, 100)}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 w-8 text-right">{p.progress}%</span>
                          </div>
                          {tp !== null && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-slate-500 w-12">Hợp đồng</span>
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${isDelayed ? 'bg-rose-400 dark:bg-rose-500' : 'bg-slate-400 dark:bg-slate-500'}`} style={{ width: `${Math.min(tp, 100)}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 w-8 text-right">{tp}%</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text} border border-white/20 dark:border-slate-700/50`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-2 ${cfg.dot}`} />
                          {BIM_PROJECT_STATUS_LABELS[p.status]}
                        </span>
                      </td>

                      {/* Actions (Pils) */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => toggleWeb(e, p)}
                            title={p.isPublishedWeb ? "Ẩn khỏi Web" : "Hiển thị trên Web"}
                            className={`p-1.5 rounded-md transition-all border ${p.isPublishedWeb
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400'
                              } hover:opacity-80`}
                          >
                            {p.isPublishedWeb ? <Globe size={15} /> : <EyeOff size={15} />}
                          </button>

                          <button
                            onClick={(e) => toggleFeatured(e, p)}
                            title={p.isFeaturedWeb ? "Bỏ nổi bật" : "Đánh dấu nổi bật"}
                            className={`p-1.5 rounded-md transition-all border ${p.isFeaturedWeb
                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-500 dark:text-amber-400'
                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400'
                              } hover:opacity-80`}
                          >
                            <Star size={15} className={p.isFeaturedWeb ? "fill-current" : ""} />
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
    </div>
  );
};

export default ProjectList;
