import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { ArrowLeft, MapPin, Building2, Calendar, FileText, TrendingUp, Clock, Edit, Trash2, CheckSquare, Loader2, FileSignature, ExternalLink, Folder, LayoutDashboard, Users, Globe, Layers, Ruler, Phone, Mail, Tag, Briefcase } from 'lucide-react';
import { ProjectService, ContractService } from '../services';
import { CustomerService } from '../services/customerService';
import { CustomerContact } from '../types';
import { BIMProject, BIM_PROJECT_STATUS_LABELS, BIMProjectStatus } from '../types';
import { toast } from 'sonner';
import { formatDate } from '../utils/formatters';
import { useSlidePanel } from '../contexts/SlidePanelContext';
import ConfirmDialog from './ui/ConfirmDialog';

const ProjectTasksTab = lazy(() => import('./ProjectTasksTab'));
const ProjectDashboardTab = lazy(() => import('./projects/ProjectDashboardTab'));
const ProjectTeamTab = lazy(() => import('./projects/ProjectTeamTab'));
const ProjectWebTab = lazy(() => import('./projects/ProjectWebTab'));

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onEdit?: (project: BIMProject) => void;
  onDelete?: (projectId: string) => void;
}

// ── Status Colors ───────────────────────────────────────────────────────
const STATUS_COLORS: Record<BIMProjectStatus, { bg: string; text: string; dot: string; border: string }> = {
  'new':       { bg: 'bg-slate-50 dark:bg-slate-800',      text: 'text-slate-700 dark:text-slate-300',     dot: 'bg-slate-400',    border: 'border-slate-300 dark:border-slate-600' },
  'active':    { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-400',   dot: 'bg-indigo-500',   border: 'border-indigo-300 dark:border-indigo-700' },
  'paused':    { bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-700 dark:text-amber-400',     dot: 'bg-amber-500',    border: 'border-amber-300 dark:border-amber-700' },
  'done':      { bg: 'bg-emerald-50 dark:bg-emerald-900/20',text:'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500',  border: 'border-emerald-300 dark:border-emerald-700' },
  'cancelled': { bg: 'bg-rose-50 dark:bg-rose-900/20',     text: 'text-rose-700 dark:text-rose-400',       dot: 'bg-rose-500',     border: 'border-rose-300 dark:border-rose-700' },
};

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=500&fit=crop',
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1200&h=500&fit=crop',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&h=500&fit=crop',
];

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projectId, onBack, onEdit, onDelete }) => {
  const [project, setProject] = useState<BIMProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTabState] = useState<'dashboard' | 'info' | 'tasks' | 'team' | 'web'>(() => {
    return (localStorage.getItem('cic-erp-project-tab') as any) || 'info';
  });


  const setActiveTab = (tab: 'dashboard' | 'info' | 'tasks' | 'team' | 'web') => {
    setActiveTabState(tab);
    localStorage.setItem('cic-erp-project-tab', tab);
  };
  const [contractInfo, setContractInfo] = useState<{ id: string; contractCode: string; name?: string } | null>(null);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const { openPanel, closePanel } = useSlidePanel();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<BIMProjectStatus | null>(null);

  // ── Handle delete ────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!project) return;
    setDeleting(true);
    try {
      await ProjectService.delete(project.id);
      toast.success('Đã xóa dự án thành công!');
      if (onDelete) onDelete(project.id);
      onBack();
    } catch (err: any) {
      toast.error('Lỗi xóa dự án: ' + (err.message || err));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [project, onDelete, onBack]);

  // ── Handle status change ─────────────────────────────────────────────
  const handleStatusChange = useCallback((newStatus: BIMProjectStatus) => {
    if (!project || newStatus === project.status || updatingStatus) return;
    setPendingStatus(newStatus);
  }, [project, updatingStatus]);

  const confirmStatusChange = useCallback(async () => {
    if (!project || !pendingStatus) return;
    const label = BIM_PROJECT_STATUS_LABELS[pendingStatus];
    setUpdatingStatus(true);
    setPendingStatus(null);
    try {
      const updated = await ProjectService.update(project.id, { status: pendingStatus });
      setProject(updated);
      toast.success(`Đã chuyển sang: ${label}`);
    } catch (err: any) {
      toast.error('Lỗi cập nhật trạng thái: ' + (err.message || err));
    } finally {
      setUpdatingStatus(false);
    }
  }, [project, pendingStatus]);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);
        const data = await ProjectService.getById(projectId);
        setProject(data);
      } catch (err: any) {
        toast.error('Lỗi tải dự án: ' + (err.message || err));
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  // Fetch contract info when project has a linked contract
  useEffect(() => {
    if (!project?.contractId) { setContractInfo(null); return; }
    ContractService.getById(project.contractId)
      .then((c: any) => {
        if (c) setContractInfo({ id: c.id, contractCode: c.contractCode || c.contract_code, name: c.name || c.tenCongTrinh });
      })
      .catch(() => setContractInfo(null));
  }, [project?.contractId]);

  // Fetch contacts of linked customer
  useEffect(() => {
    if (!project?.customerId) { setContacts([]); return; }
    CustomerService.getContacts(project.customerId)
      .then(setContacts)
      .catch(() => setContacts([]));
  }, [project?.customerId]);

  // Open contract detail in slide panel
  const handleOpenContract = useCallback(() => {
    if (!contractInfo) return;
    import('./ContractDetail').then(({ default: ContractDetailComponent }) => {
      openPanel({
        title: `Hợp đồng ${contractInfo.contractCode}`,
        component: (
          <div className="p-4 md:p-6 lg:p-8">
            <ContractDetailComponent
              contractId={contractInfo.id}
              onBack={() => closePanel()}
              onEdit={() => {}}
              onDelete={async () => { closePanel(); }}
            />
          </div>
        ),
      });
    });
  }, [contractInfo, openPanel, closePanel]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-48" />
        <div className="h-56 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="space-y-3">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/3" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 dark:text-slate-400 text-lg">Không tìm thấy dự án</p>
        <button onClick={onBack} className="mt-4 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
          ← Quay lại
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_COLORS[project.status] || STATUS_COLORS['new'];
  const thumbnail = project.thumbnailUrl || PLACEHOLDER_IMAGES[0];

  // Progress bar status mapping — show which stages are completed
  const allStatuses: BIMProjectStatus[] = ['new', 'active', 'paused', 'done', 'cancelled'];
  const currentIdx = allStatuses.indexOf(project.status);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-400">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        <ArrowLeft size={16} />
        Quay lại danh sách
      </button>

      {/* Hero Image */}
      <div className="relative h-56 md:h-72 rounded-xl overflow-hidden shadow-lg">
        <img
          src={thumbnail}
          alt={project.name}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGES[0]; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
          <div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3 ${statusCfg.bg} ${statusCfg.text} backdrop-blur-sm`}>
              <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
              {BIM_PROJECT_STATUS_LABELS[project.status]}
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">{project.name}</h1>
            <p className="text-white/70 text-sm font-mono mt-1">{project.code}</p>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(project)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white text-xs font-bold rounded-lg transition-all"
              >
                <Edit size={14} />
                Sửa
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/80 backdrop-blur-sm hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-all"
              >
                <Trash2 size={14} />
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto overflow-y-hidden touch-pan-x hide-scrollbar">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-5 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <LayoutDashboard size={15} className="inline mr-1.5 -mt-0.5" />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`px-5 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'info'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <FileText size={15} className="inline mr-1.5 -mt-0.5" />
          Thông tin chung
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-5 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'tasks'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <CheckSquare size={15} className="inline mr-1.5 -mt-0.5" />
          Quản lý công việc
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`px-5 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'team'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users size={15} className="inline mr-1.5 -mt-0.5" />
          Thành viên
        </button>
        <button
          onClick={() => setActiveTab('web')}
          className={`px-5 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'web'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Globe size={15} className="inline mr-1.5 -mt-0.5" />
          Hồ sơ & Web
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'info' && (
      <>
      {/* Workflow Progress */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Tiến trình dự án</h2>
          {updatingStatus && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-400 font-semibold">
              <Loader2 size={14} className="animate-spin" /> Đang cập nhật...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {allStatuses.map((s, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const cfg = STATUS_COLORS[s];
            return (
              <React.Fragment key={s}>
                <div
                  className={`flex flex-col items-center min-w-[80px] transition-all ${isCurrent ? 'scale-105' : 'cursor-pointer group'}`}
                  onClick={() => !isCurrent && handleStatusChange(s)}
                  title={isCurrent ? 'Trạng thái hiện tại' : `Chuyển sang: ${BIM_PROJECT_STATUS_LABELS[s]}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted 
                      ? 'bg-emerald-500 text-white group-hover:bg-emerald-600 group-hover:scale-110' 
                      : isCurrent 
                        ? `${cfg.bg} ${cfg.text} ring-2 ring-current`
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:scale-110'
                  }`}>
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                  <span className={`text-[10px] font-semibold mt-1 text-center leading-tight transition-colors ${
                    isCurrent ? cfg.text : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                  }`}>
                    {BIM_PROJECT_STATUS_LABELS[s]}
                  </span>
                </div>
                {idx < allStatuses.length - 1 && (
                  <div className={`flex-1 h-0.5 min-w-[16px] rounded-full ${
                    idx < currentIdx ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        {/* Confirm banner */}
        {pendingStatus && (
          <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
            <p className="text-sm text-indigo-700 dark:text-indigo-300 font-semibold">
              Chuyển sang <span className="font-black">"{BIM_PROJECT_STATUS_LABELS[pendingStatus]}"</span>?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPendingStatus(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
              >
                Hủy
              </button>
              <button
                onClick={confirmStatusChange}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-sm"
              >
                Xác nhận
              </button>
            </div>
          </div>
        )}
        {/* Action buttons */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            disabled={currentIdx <= 0 || updatingStatus}
            onClick={() => handleStatusChange(allStatuses[currentIdx - 1])}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft size={14} />
            {currentIdx > 0 ? BIM_PROJECT_STATUS_LABELS[allStatuses[currentIdx - 1]] : 'Bước trước'}
          </button>
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
            Bước {currentIdx + 1} / {allStatuses.length}
          </span>
          <button
            disabled={currentIdx >= allStatuses.length - 1 || updatingStatus}
            onClick={() => handleStatusChange(allStatuses[currentIdx + 1])}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
          >
            {currentIdx < allStatuses.length - 1 ? BIM_PROJECT_STATUS_LABELS[allStatuses[currentIdx + 1]] : 'Bước tiếp'}
            <TrendingUp size={14} />
          </button>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* General Info */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Thông tin chung</h2>
          
          {project.location && (
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Địa điểm</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{project.location}</p>
              </div>
            </div>
          )}

          {project.clientName && (
            <div className="flex items-start gap-3">
              <Building2 size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Chủ đầu tư</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{project.clientName}</p>
              </div>
            </div>
          )}

          {/* Linked Contract */}
          {contractInfo ? (
            <div className="flex items-start gap-3">
              <FileSignature size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Hợp đồng</p>
                <button
                  onClick={handleOpenContract}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold flex items-center gap-1 hover:underline transition-colors"
                >
                  {contractInfo.contractCode}
                  {contractInfo.name && <span className="text-slate-500 dark:text-slate-400 font-normal">— {contractInfo.name}</span>}
                  <ExternalLink size={12} className="shrink-0 opacity-60" />
                </button>
              </div>
            </div>
          ) : project.contractId ? (
            <div className="flex items-start gap-3">
              <FileSignature size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Hợp đồng</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 italic">Đang tải...</p>
              </div>
            </div>
          ) : null}

          {project.folderPotentialUrl && (
            <div className="flex items-start gap-3">
              <Folder size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Hồ sơ Tiền dự án</p>
                <a href={project.folderPotentialUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1">
                  Mở thư mục <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}

          {project.folderOngoingUrl && (
            <div className="flex items-start gap-3">
              <Folder size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Hồ sơ Triển khai</p>
                <a href={project.folderOngoingUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1">
                  Mở thư mục <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}

          {(project.startDate || project.endDate) && (
            <div className="flex items-start gap-3">
              <Calendar size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Thời gian</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {project.startDate ? formatDate(project.startDate) : '—'}
                  {' → '}
                  {project.endDate ? formatDate(project.endDate) : '—'}
                </p>
              </div>
            </div>
          )}

          {project.constructionType && (
            <div className="flex items-start gap-3">
              <Layers size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Loại công trình</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{project.constructionType}</p>
              </div>
            </div>
          )}

          {project.constructionGrade && (
            <div className="flex items-start gap-3">
              <Tag size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Cấp công trình</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{project.constructionGrade}</p>
              </div>
            </div>
          )}

          {project.projectPhase && (
            <div className="flex items-start gap-3">
              <FileText size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Giai đoạn thực hiện</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{project.projectPhase}</p>
              </div>
            </div>
          )}

          {project.serviceType && (
            <div className="flex items-start gap-3">
              <Briefcase size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Loại dịch vụ</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{project.serviceType}</p>
              </div>
            </div>
          )}
        </div>

        {/* KPI / Numbers */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Chỉ số</h2>
          
          {/* Progress */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tiến độ thực hiện</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{project.progress}%</span>
            </div>
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(project.progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Contract Value */}
          {project.contractValue > 0 && (
            <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
              <TrendingUp size={20} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase">Giá trị hợp đồng chính</p>
                <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">
                  {project.contractValue >= 1_000_000_000
                    ? <>{(project.contractValue / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} <span className="text-sm font-bold">Tỷ</span></>
                    : <>{(project.contractValue / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} <span className="text-sm font-bold">Triệu</span></>
                  }
                </p>
              </div>
            </div>
          )}

          {/* Diện tích */}
          {((project.area && project.area > 0) || (project.buildingArea && project.buildingArea > 0)) && (
            <div className="grid grid-cols-2 gap-3">
              {project.area && project.area > 0 && (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-lg">
                  <Ruler size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Diện tích sàn</p>
                    <p className="text-sm font-black text-slate-700 dark:text-slate-300">
                      {project.area.toLocaleString('vi-VN')} <span className="text-xs font-semibold">m²</span>
                    </p>
                  </div>
                </div>
              )}
              {project.buildingArea && project.buildingArea > 0 && (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 rounded-lg">
                  <Ruler size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Diện tích XD</p>
                    <p className="text-sm font-black text-slate-700 dark:text-slate-300">
                      {project.buildingArea.toLocaleString('vi-VN')} <span className="text-xs font-semibold">m²</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nhóm dự án */}
          {project.projectGroup && (
            <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nhóm dự án</span>
              <span className="text-xs font-black text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                Nhóm {project.projectGroup}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Description / Notes */}
      {(project.description || project.notes) && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Mô tả & Ghi chú</h2>
          {project.description && (
            <div
              className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3 prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: project.description }}
            />
          )}
          {project.notes && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-800 dark:text-amber-300">{project.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Liên hệ từ module Đối tác */}
      {contacts.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
            Đầu mối liên hệ
            <span className="ml-2 text-xs font-semibold text-slate-400 dark:text-slate-500 normal-case">({project.clientName})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {contacts.map(contact => (
              <div key={contact.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                  <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                    {contact.name.charAt(0)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{contact.name}</p>
                    {contact.isPrimary && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full">
                        Chính
                      </span>
                    )}
                  </div>
                  {contact.position && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{contact.position}</p>
                  )}
                  {contact.department && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{contact.department}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
                        <Phone size={11} /> {contact.phone}
                      </a>
                    )}
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
                        <Mail size={11} /> {contact.email}
                      </a>
                    )}
                  </div>
                  {contact.notes && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 italic truncate">{contact.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
        )}
        
        {activeTab === 'tasks' && (
          <Suspense fallback={<div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" size={24} /></div>}>
            <ProjectTasksTab projectId={project.id} projectName={project.name} />
          </Suspense>
        )}

        {activeTab === 'team' && (
          <Suspense fallback={<div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" size={24} /></div>}>
            <ProjectTeamTab projectId={project.id} />
          </Suspense>
        )}

        {activeTab === 'dashboard' && (
          <Suspense fallback={<div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" size={24} /></div>}>
            <ProjectDashboardTab project={project} />
          </Suspense>
        )}

        {activeTab === 'web' && (
          <Suspense fallback={<div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" size={24} /></div>}>
            <ProjectWebTab project={project} onUpdate={setProject} />
          </Suspense>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Xác nhận xóa dự án"
        message={`Bạn có chắc muốn xóa dự án "${project.name}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa dự án"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
};

export default ProjectDetail;
