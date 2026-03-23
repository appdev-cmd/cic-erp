import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { ArrowLeft, MapPin, Building2, Calendar, FileText, TrendingUp, Clock, Edit, Trash2, CheckSquare, Loader2, FileSignature, ExternalLink } from 'lucide-react';
import { ProjectService, ContractService } from '../services';
import { BIMProject, BIM_PROJECT_STATUS_LABELS, BIMProjectStatus } from '../types';
import { toast } from 'sonner';
import { formatDate } from '../utils/formatters';
import { useSlidePanel } from '../contexts/SlidePanelContext';

const ProjectTasksTab = lazy(() => import('./ProjectTasksTab'));

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onEdit?: (project: BIMProject) => void;
  onDelete?: (projectId: string) => void;
}

// ── Status Colors ───────────────────────────────────────────────────────
const STATUS_COLORS: Record<BIMProjectStatus, { bg: string; text: string; dot: string; border: string }> = {
  '10_XUCTIEN': { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', border: 'border-amber-200 dark:border-amber-800' },
  '20_BAOGIA': { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-700 dark:text-cyan-400', dot: 'bg-cyan-500', border: 'border-cyan-200 dark:border-cyan-800' },
  '30_CHUANBI': { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500', border: 'border-orange-200 dark:border-orange-800' },
  '40_TRINHTHAMDINH': { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500', border: 'border-blue-200 dark:border-blue-800' },
  '50_HOTROQLDA': { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500', border: 'border-purple-200 dark:border-purple-800' },
  '60_THANHQUYETTOAN': { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
  '70_LUUTRU': { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-700 dark:text-teal-400', dot: 'bg-teal-500', border: 'border-teal-200 dark:border-teal-800' },
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
  const [activeTab, setActiveTab] = useState<'info' | 'tasks'>('info');
  const [contractInfo, setContractInfo] = useState<{ id: string; contractCode: string; name?: string } | null>(null);
  const { openPanel, closePanel } = useSlidePanel();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<BIMProjectStatus | null>(null);

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

  const statusCfg = STATUS_COLORS[project.status] || STATUS_COLORS['30_CHUANBI'];
  const thumbnail = project.thumbnailUrl || PLACEHOLDER_IMAGES[0];

  // Progress bar status mapping — show which stages are completed
  const allStatuses: BIMProjectStatus[] = ['10_XUCTIEN', '20_BAOGIA', '30_CHUANBI', '40_TRINHTHAMDINH', '50_HOTROQLDA', '60_THANHQUYETTOAN', '70_LUUTRU'];
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
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('info')}
          className={`px-5 py-3 text-sm font-bold transition-all border-b-2 ${
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
          className={`px-5 py-3 text-sm font-bold transition-all border-b-2 ${
            activeTab === 'tasks'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <CheckSquare size={15} className="inline mr-1.5 -mt-0.5" />
          Quản lý công việc
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'info' ? (
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
                <p className="text-[11px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase">Giá trị hợp đồng</p>
                <p className="text-xl font-black text-indigo-700 dark:text-indigo-300">
                  {project.contractValue >= 1_000_000_000
                    ? <>{(project.contractValue / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} <span className="text-sm font-bold">Tỷ</span></>
                    : <>{(project.contractValue / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} <span className="text-sm font-bold">Triệu</span></>
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description / Notes */}
      {(project.description || project.notes) && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Mô tả & Ghi chú</h2>
          {project.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{project.description}</p>
          )}
          {project.notes && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-800 dark:text-amber-300">{project.notes}</p>
            </div>
          )}
        </div>
      )}
      </>
      ) : (
        <Suspense fallback={<div className="py-12 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" size={24} /></div>}>
          <ProjectTasksTab projectId={project.id} projectName={project.name} />
        </Suspense>
      )}

      {/* Delete Confirm Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-2">Xác nhận xóa dự án</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Bạn có chắc muốn xóa dự án này?</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">{project.name}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all"
              >
                Hủy
              </button>
              <button
                disabled={deleting}
                onClick={async () => {
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
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                {deleting ? 'Đang xóa...' : 'Xóa dự án'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
