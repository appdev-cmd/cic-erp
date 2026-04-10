import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { JobOpening, CandidateApplication, ApplicationStage } from '../../types/hrmTypes';
import { recruitmentService } from '../../services/recruitmentService';
import { formatDateShort } from '../../utils/formatters';
import { Briefcase, ChevronRight, User, MousePointerClick } from 'lucide-react';
import CandidateDetailPanel from './CandidateDetailPanel';

interface Props {
  jobOpenings: JobOpening[];
  initialJobId?: string;
  refreshTrigger?: number;
}

const STAGES: { id: ApplicationStage; label: string; color: string }[] = [
  { id: 'applied', label: 'Ứng tuyển mới', color: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
  { id: 'screening', label: 'Sàng lọc CV', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  { id: 'interview_1', label: 'Phỏng vấn vòng 1', color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' },
  { id: 'interview_2', label: 'Phỏng vấn vòng 2', color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
  { id: 'technical_test', label: 'Bài Test', color: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800' },
  { id: 'offer', label: 'Gửi Offer', color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  { id: 'hired', label: 'Đã Tuyển', color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
  { id: 'rejected', label: 'Từ chối', color: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' },
  { id: 'withdrawn', label: 'Rút lui', color: 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600' },
];

const RecruitmentKanban: React.FC<Props> = ({ jobOpenings, initialJobId, refreshTrigger }) => {
  const [selectedJobId, setSelectedJobId] = useState<string>(initialJobId || 'all');
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Drag state
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);

  // Detail panel
  const [selectedApp, setSelectedApp] = useState<CandidateApplication | null>(null);

  useEffect(() => {
    if (initialJobId) {
      setSelectedJobId(initialJobId);
    }
  }, [initialJobId]);

  useEffect(() => {
    if (selectedJobId) {
      loadApplications();
    }
  }, [selectedJobId, refreshTrigger]);

  const loadApplications = async () => {
    setIsLoading(true);
    try {
      const data = await recruitmentService.getApplicationsByJob(selectedJobId);
      setApplications(data);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, appId: string) => {
    setDraggedAppId(appId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStage: ApplicationStage) => {
    e.preventDefault();
    if (!draggedAppId) return;

    const appToMove = applications.find(a => a.id === draggedAppId);
    if (!appToMove || appToMove.stage === newStage) {
      setDraggedAppId(null);
      return;
    }

    // Optimistic update
    const previousApps = [...applications];
    setApplications(apps => apps.map(app => 
      app.id === draggedAppId ? { ...app, stage: newStage } : app
    ));

    try {
      await recruitmentService.moveStage(draggedAppId, newStage);
    } catch (error) {
      console.error('Error moving stage:', error);
      // Revert on error
      setApplications(previousApps);
    } finally {
      setDraggedAppId(null);
    }
  };

  if (jobOpenings.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
        <Briefcase size={32} className="mx-auto text-slate-400 mb-3" />
        <p className="text-slate-500 dark:text-slate-400">Vui lòng tạo vị trí tuyển dụng trước khi sử dụng Kanban Board.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-250px)] min-h-[500px] max-h-[800px] bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm animate-fade-in">
      {/* Kanban Header */}
      <div className="bg-white dark:bg-slate-900 px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bộ lọc vị trí:</label>
          <select 
            value={selectedJobId} 
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-indigo-700 dark:text-indigo-300 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="all">Tất cả vị trí (Tập trung)</option>
            {jobOpenings.map(job => (
              <option key={job.id} value={job.id}>{job.title} {job.status === 'closed' ? '(Đã đóng)' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
            <MousePointerClick size={14} className="text-slate-400" /> Kéo thả thẻ để chuyển vòng
          </span>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 md:p-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
          </div>
        ) : (
          <div className="flex gap-3 h-full">
            {STAGES.map(stage => {
              const stageApps = applications.filter(app => app.stage === stage.id);
              return (
                <div 
                  key={stage.id} 
                  className={`flex flex-col h-full flex-1 min-w-[110px] xl:min-w-0 rounded-xl border-t-[3px] border-x border-b ${stage.color} overflow-hidden transition-all bg-slate-50 dark:bg-slate-800 ${draggedAppId ? 'hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md' : ''}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  <div className="p-2 lg:p-2.5 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0 border-b border-inherit gap-1">
                    <h3 className="font-semibold text-[10px] lg:text-[11px] text-slate-800 dark:text-slate-200 truncate cursor-help" title={stage.label}>
                      {stage.label}
                    </h3>
                    <span className="bg-white dark:bg-slate-800 text-xs font-bold px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 shadow-sm">
                      {stageApps.length}
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-2 space-y-2.5 pb-8 custom-scrollbar">
                    {stageApps.map(app => (
                      <div
                        key={app.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, app.id)}
                        onClick={() => setSelectedApp(app)}
                        className={`bg-white dark:bg-slate-800 p-2.5 lg:p-3 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing hover:shadow transition-all group relative ${draggedAppId === app.id ? 'opacity-40 border-dashed border-indigo-400 dark:border-indigo-500 shadow-none' : ''}`}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 dark:bg-indigo-400 rounded-l-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        
                        <div className="flex justify-between items-start mb-1.5">
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-[10px] uppercase tracking-wider leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {app.candidate?.full_name}
                          </h4>
                        </div>
                        
                        <div className="text-[11px] lg:text-xs text-slate-500 dark:text-slate-400 space-y-1.5 mt-2">
                          <p className="flex items-center gap-1.5"><User size={12} className="text-slate-400 shrink-0" /> {app.candidate?.experience_years} năm KN</p>
                          <p className="flex items-center gap-1.5 truncate" title={app.candidate?.university || ''}>
                            <Briefcase size={12} className="text-slate-400 shrink-0" /> 
                            <span className="truncate">{app.candidate?.university || 'Chưa cập nhật'}</span>
                          </p>
                          {selectedJobId === 'all' && app.job_opening && (
                            <p className="flex items-center gap-1.5 truncate text-indigo-600 dark:text-indigo-400" title={app.job_opening.title}>
                               <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                               <span className="truncate">{app.job_opening.title}</span>
                            </p>
                          )}
                        </div>
                        
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500">
                          <span>{formatDateShort(app.created_at)}</span>
                          <span className="group-hover:text-indigo-500 dark:group-hover:text-indigo-400 flex items-center font-medium transition-colors">
                            Chi tiết <ChevronRight size={12} className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {stageApps.length === 0 && (
                      <div className="h-full flex items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Thả ứng viên vào đây</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedApp && (
        <CandidateDetailPanel 
          application={selectedApp} 
          onClose={() => setSelectedApp(null)} 
          onUpdate={() => { loadApplications(); }}
        />
      )}
    </div>
  );
};

export default RecruitmentKanban;
