import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, MapPin, TrendingUp, Calendar, Building2, Filter, X } from 'lucide-react';
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
const ProjectCard: React.FC<{ project: BIMProject; index: number; onClick: () => void }> = ({ project, index, onClick }) => {
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
        </div>

        {/* Footer: Contract value + dates */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          {project.contractValue > 0 ? (
            <div>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Giá trị HĐ</p>
              <p className="text-base font-black text-indigo-600 dark:text-indigo-400">
                {(project.contractValue / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} <span className="text-[11px] font-bold">Tỷ</span>
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
    return result;
  }, [projects, statusFilter, searchTerm]);

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
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Dự án BIM</h1>
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
        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
            showFilters || statusFilter !== 'All'
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
      </div>

      {/* Status filter pills */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => setStatusFilter('All')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              statusFilter === 'All'
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  statusFilter === status
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

      {/* Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Building2 size={32} className="text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">Chưa có dự án nào</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {searchTerm || statusFilter !== 'All' 
              ? 'Không tìm thấy dự án phù hợp. Thử thay đổi bộ lọc.'
              : 'Dự án BIM sẽ hiển thị ở đây khi được tạo.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project, idx) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={idx}
              onClick={() => onSelectProject(project.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectList;
