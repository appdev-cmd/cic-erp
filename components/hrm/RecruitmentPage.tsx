import React, { useState, useEffect } from 'react';
import { Briefcase, Users, LayoutDashboard, Plus, Search, Filter, Edit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { recruitmentService } from '../../services/recruitmentService';
import { JobOpening, Candidate, CandidateApplication } from '../../types/hrmTypes';
import { formatDateShort, formatDate } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import { useSlidePanel } from '../../contexts/SlidePanelContext';

import JobOpeningForm from './JobOpeningForm';
import RecruitmentKanban from './RecruitmentKanban';
import CandidateForm from './CandidateForm';
import CandidateDetailPanel from './CandidateDetailPanel';
import JobApplicationsPanel from './JobApplicationsPanel';

const APP_STAGES_MAP: Record<string, string> = {
  applied: 'Ứng tuyển',
  screening: 'Sàng lọc',
  interview_1: 'P.Vòng 1',
  interview_2: 'P.Vòng 2',
  technical_test: 'Bài Test',
  offer: 'Offer',
  hired: 'Đã Tuyển',
  rejected: 'Từ chối',
  withdrawn: 'Rút lui'
};

const RecruitmentPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'jobs' | 'candidates'>('pipeline');
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Forms and Slide Panels
  const { openPanel, closePanel } = useSlidePanel();
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [kanbanInitialJobId, setKanbanInitialJobId] = useState<string | undefined>(undefined);
  const [viewingApplicationsJob, setViewingApplicationsJob] = useState<JobOpening | null>(null);
  const [selectedApplicationFromJob, setSelectedApplicationFromJob] = useState<CandidateApplication | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Auth & Permissions
  const { profile } = useAuth();
  
  const hasAccess = profile && (
    profile.role === 'Admin' || 
    profile.role === 'Leadership' || 
    profile.role === 'HR' || 
    profile.role === 'UnitLeader' ||
    profile.role === 'AdminUnit' ||
    profile.email?.includes('dev') ||
    profile.email?.includes('admin') ||
    (profile as any).department === 'HR' || 
    (profile as any).department === 'BOD' || 
    (profile as any).is_director === true
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [jobsData, candidatesData] = await Promise.all([
        recruitmentService.getJobOpenings(),
        recruitmentService.getCandidates()
      ]);
      setJobOpenings(jobsData);
      setCandidates(candidatesData);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error loading recruitment data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Lọc dữ liệu dựa trên search term & filter
  const filteredJobs = jobOpenings.filter(job => {
    const matchSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredCandidates = candidates.filter(cand => {
    return cand.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (cand.phone && cand.phone.includes(searchTerm)) ||
           (cand.email && cand.email.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  if (profile && !hasAccess) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mb-4">
          <Briefcase size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Không có quyền truy cập</h2>
        <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
          Tính năng Quản lý Tuyển dụng chỉ dành cho Phòng Nhân sự (HR), Ban Giám đốc và Trưởng các đơn vị.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
            <Briefcase className="text-indigo-600 dark:text-indigo-400" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Quản lý Tuyển dụng
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pipeline ứng viên, thẻ yêu cầu tuyển dụng và ngân hàng CV
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {activeTab === 'jobs' && (
            <button
              onClick={() => {
                openPanel({
                  title: 'Tạo Yêu cầu Tuyển dụng',
                  component: (
                    <JobOpeningForm
                      job={null}
                      onClose={() => closePanel()}
                      onSuccess={() => { closePanel(); loadData(); }}
                      isInsidePanel={true}
                    />
                  )
                });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm hover:shadow"
            >
              <Plus size={18} />
              <span>Tạo Yêu cầu</span>
            </button>
          )}
          {activeTab === 'candidates' && (
            <button
              onClick={() => setShowCandidateForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm hover:shadow"
            >
              <Plus size={18} />
              <span>Thêm Ứng Viên</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Search and Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder={activeTab === 'candidates' ? "Tìm theo tên ứng viên, email, sđt..." : "Tìm tựa đề vị trí tuyển dụng..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm placeholder-slate-400 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {activeTab === 'jobs' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full md:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="open">Đang tuyển</option>
              <option value="closed">Đã đóng</option>
            </select>
          )}
          <button className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors text-sm font-medium">
            <Filter size={16} />
            <span className="hidden sm:inline">Bộ lọc</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'pipeline'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <LayoutDashboard size={18} />
          Pipeline
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'jobs'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <Briefcase size={18} />
          Vị trí tuyển
          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
            {filteredJobs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('candidates')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'candidates'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <Users size={18} />
          Ngân hàng CV
        </button>
      </div>

      {/* Content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400 truncate"></div>
          </div>
        ) : (
          <>
            {activeTab === 'pipeline' && (
               <RecruitmentKanban jobOpenings={filteredJobs} initialJobId={kanbanInitialJobId} refreshTrigger={refreshTrigger} />
            )}
            
            {activeTab === 'jobs' && (
              <div className="grid gap-4">
                {filteredJobs.map(job => (
                  <div key={job.id} onClick={() => setViewingApplicationsJob(job)} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transform transition-all duration-200 shadow-sm hover:shadow-md group">
                    <div className="flex justify-between items-start">
                       <div>
                         <div className="flex items-center gap-2 mb-1">
                           <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{job.title}</h3>
                           {job.status === 'open' ? (
                             <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-md">Đang tuyển</span>
                           ) : (
                             <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">Đã đóng</span>
                           )}
                         </div>
                         <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                           {job.department} • {job.job_type} • Hạn: {job.deadline ? formatDate(job.deadline) : 'Chưa có'}
                         </p>
                       </div>
                       <div className="text-right flex flex-col items-end gap-1.5">
                         <div className="flex items-center gap-2">
                           <button onClick={(e) => { e.stopPropagation(); openPanel({ title: `Chỉnh sửa: ${job.title}`, component: (<JobOpeningForm job={job} onClose={() => closePanel()} onSuccess={() => { closePanel(); loadData(); }} isInsidePanel={true} />) }); }} className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Sửa vị trí">
                             <Edit size={16} />
                           </button>
                           <div className="flex bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 divide-x divide-slate-200 dark:divide-slate-700 shrink-0">
                             <span className="text-sm font-medium text-slate-700 dark:text-slate-300 px-3 py-1.5">
                               {job.application_count || 0} CV
                             </span>
                             <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 px-3 py-1.5" title="Đã tuyển / Mục tiêu">
                               {job.hired_count} / {job.quantity} N.sự
                             </span>
                           </div>
                         </div>
                         <button onClick={(e) => { e.stopPropagation(); setKanbanInitialJobId(job.id); setActiveTab('pipeline'); }} className="text-xs text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end hover:underline">
                           Xem Pipeline &rarr;
                         </button>
                       </div>
                    </div>
                  </div>
                ))}
                {filteredJobs.length === 0 && (
                   <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                     <Briefcase size={32} className="mx-auto text-slate-400 mb-3" />
                     <p className="text-slate-500 dark:text-slate-400">Không tìm thấy vị trí tuyển dụng nào.</p>
                   </div>
                )}
              </div>
            )}

            {activeTab === 'candidates' && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Ứng viên</th>
                        <th className="px-4 py-3">Liên hệ</th>
                        <th className="px-4 py-3">Trình độ</th>
                        <th className="px-4 py-3">Kinh nghiệm</th>
                        <th className="px-4 py-3">Pipeline</th>
                        <th className="px-4 py-3">Ngày tạo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredCandidates.map(candidate => (
                        <tr key={candidate.id} onClick={() => setSelectedCandidate(candidate)} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900 dark:text-slate-100">{candidate.full_name}</div>
                            {candidate.is_blacklisted && <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded ml-2 font-bold tracking-wide">BLACKLIST</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-900 dark:text-slate-300">{candidate.phone}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-500">{candidate.email}</div>
                          </td>
                          <td className="px-4 py-3">{candidate.education || '-'}</td>
                          <td className="px-4 py-3">{candidate.experience_years} năm</td>
                          <td className="px-4 py-3 min-w-[180px]">
                            {candidate.applications && candidate.applications.length > 0 ? (
                              <div className="flex flex-col gap-1.5">
                                {candidate.applications.map((app: any) => (
                                  <div key={app.id} className="text-xs flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[130px] 2xl:max-w-[160px]" title={app.job_opening?.title}>
                                      • {app.job_opening?.title || 'Vị trí đã xóa'}
                                    </span>
                                    <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold text-[9px] uppercase tracking-wider shrink-0">
                                      {APP_STAGES_MAP[app.stage] || app.stage}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500 italic mt-1 block">Chưa ứng tuyển</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{formatDateShort(candidate.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredCandidates.length === 0 && (
                    <div className="text-center py-12">
                       <Users size={32} className="mx-auto text-slate-400 mb-3" />
                       <p className="text-slate-500 dark:text-slate-400">Không tìm thấy hồ sơ ứng viên nào.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>


      
      {showCandidateForm && (
        <CandidateForm
           jobOpenings={jobOpenings.filter(j => j.status === 'open')}
           onClose={() => setShowCandidateForm(false)}
           onSuccess={() => { setShowCandidateForm(false); loadData(); }}
        />
      )}

      {selectedCandidate && (
        <CandidateDetailPanel
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}

      {selectedApplicationFromJob && (
        <CandidateDetailPanel
          application={selectedApplicationFromJob}
          onClose={() => setSelectedApplicationFromJob(null)}
          onUpdate={loadData}
        />
      )}

      {viewingApplicationsJob && !selectedApplicationFromJob && (
        <JobApplicationsPanel
          jobOpening={viewingApplicationsJob}
          onClose={() => setViewingApplicationsJob(null)}
          onSelectApplication={(app) => setSelectedApplicationFromJob(app)}
        />
      )}
    </div>
  );
};

export default RecruitmentPage;
