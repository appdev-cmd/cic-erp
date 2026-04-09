import React, { useState, useEffect } from 'react';
import { X, Users, Briefcase } from 'lucide-react';
import { JobOpening, CandidateApplication, ApplicationStage } from '../../types/hrmTypes';
import { recruitmentService } from '../../services/recruitmentService';
import { formatDate } from '../../utils/formatters';

interface Props {
  jobOpening: JobOpening;
  onClose: () => void;
  onSelectApplication: (app: CandidateApplication) => void;
}

const STAGES: { id: ApplicationStage; label: string; color: string }[] = [
  { id: 'applied', label: 'Ứng tuyển mới', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
  { id: 'screening', label: 'Sàng lọc CV', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' },
  { id: 'interview_1', label: 'Phỏng vấn vòng 1', color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50' },
  { id: 'interview_2', label: 'Phỏng vấn vòng 2', color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/50' },
  { id: 'technical_test', label: 'Bài Test', color: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/50' },
  { id: 'offer', label: 'Gửi Offer', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' },
  { id: 'hired', label: 'Đã Tuyển', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' },
  { id: 'rejected', label: 'Từ chối', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50' },
  { id: 'withdrawn', label: 'Rút lui', color: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
];

const JobApplicationsPanel: React.FC<Props> = ({ jobOpening, onClose, onSelectApplication }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'applications'>('info');
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadApplications();
  }, [jobOpening.id]);

  const loadApplications = async () => {
    setIsLoading(true);
    try {
      const data = await recruitmentService.getApplicationsByJob(jobOpening.id);
      setApplications(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[700px] lg:w-[850px] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 z-50 transform transition-transform duration-300 ease-in-out flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800/50">
            <Briefcase size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-1" title={jobOpening.title}>{jobOpening.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Danh sách ứng viên ({applications.length} CV)</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 gap-6 shrink-0">
        <button 
          onClick={() => setActiveTab('info')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'info' ? 'border-indigo-600 font-bold text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
        >
          Thông tin vị trí
        </button>
        <button 
          onClick={() => setActiveTab('applications')}
          className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'applications' ? 'border-indigo-600 font-bold text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
        >
          Danh sách ứng viên <span className="ml-1 bg-slate-100 dark:bg-slate-800 text-xs px-2 py-0.5 rounded-full">{applications.length}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-0 bg-slate-50/50 dark:bg-slate-950 min-h-0 custom-scrollbar">
        
        {activeTab === 'info' && (
          <div className="p-5 md:p-6 space-y-8 animate-fade-in">
            {/* General Attributes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">Mức lương</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {jobOpening.salary_range_min && jobOpening.salary_range_max 
                    ? `${jobOpening.salary_range_min.toLocaleString()} - ${jobOpening.salary_range_max.toLocaleString()} VND`
                    : 'Thỏa thuận'}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">Hình thức</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize">{jobOpening.job_type}</p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">Cấp bậc</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize">{jobOpening.experience_level}</p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">Hạn nộp</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {jobOpening.deadline ? formatDate(jobOpening.deadline) : 'Không có'}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {jobOpening.description && (
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 text-sm md:text-base border-b border-slate-200 dark:border-slate-800 pb-2">Mô tả công việc</h3>
                  <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {jobOpening.description}
                  </div>
                </div>
              )}
              {jobOpening.requirements && (
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 text-sm md:text-base border-b border-slate-200 dark:border-slate-800 pb-2">Yêu cầu ứng viên</h3>
                  <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {jobOpening.requirements}
                  </div>
                </div>
              )}
              {jobOpening.benefits && (
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 text-sm md:text-base border-b border-slate-200 dark:border-slate-800 pb-2">Quyền lợi</h3>
                  <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {jobOpening.benefits}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'applications' && (
          <div className="p-4 md:p-5 h-full animate-fade-in">
            {isLoading ? (
              <div className="flex justify-center flex-col items-center py-16 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="text-sm text-slate-500">Đang tải danh sách...</p>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <Users size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Chưa có ứng viên nào</p>
                <p className="text-xs text-slate-400 mt-1">Các ứng viên nộp hồ sơ sẽ xuất hiện tại đây.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {applications.map(app => {
                   const stageInfo = STAGES.find(s => s.id === app.stage);
                   return (
                     <div
                       key={app.id} 
                       onClick={() => onSelectApplication(app)}
                       className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transform transition-all duration-200 shadow-sm hover:shadow group"
                     >
                       <div className="flex justify-between items-start mb-2 gap-3">
                         <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-1">{app.candidate?.full_name}</h3>
                         <span className={`px-2 py-0.5 border rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 ${stageInfo?.color || 'bg-slate-100 dark:bg-slate-800 text-slate-600 border-slate-200 dark:border-slate-700'}`}>
                           {stageInfo?.label || app.stage}
                         </span>
                       </div>
                       
                       <div className="flex items-center gap-2 text-[11px] lg:text-xs text-slate-500 dark:text-slate-400">
                         <span>{app.candidate?.phone || 'Chưa cập nhật SĐT'}</span>
                         <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                         <span>{app.candidate?.experience_years} năm KN</span>
                       </div>
                       
                       <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                         <span className="text-[10px] lg:text-[11px] text-slate-400">Nộp: {formatDate(app.created_at)}</span>
                         <button className="text-indigo-600 dark:text-indigo-400 text-[11px] lg:text-xs font-semibold group-hover:underline">Chi tiết CV</button>
                       </div>
                     </div>
                   );
                 })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobApplicationsPanel;
