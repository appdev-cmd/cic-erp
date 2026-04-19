import React, { useState, useEffect } from 'react';
import { Briefcase, Users, LayoutDashboard, Plus, Search, Filter, Edit, Trash2, X, LayoutGrid, List, Link as LinkIcon, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { recruitmentService } from '../../services/recruitmentService';
import { JobOpening, Candidate, CandidateApplication, ApplicationStage } from '../../types/hrmTypes';
import { formatDateShort, formatDate } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import { useSlidePanel } from '../../contexts/SlidePanelContext';

import JobOpeningForm from './JobOpeningForm';
import RecruitmentKanban from './RecruitmentKanban';
import CandidateForm from './CandidateForm';
import CandidateDetailPanel from './CandidateDetailPanel';
import JobApplicationsPanel from './JobApplicationsPanel';
import RecruitmentDashboard from './RecruitmentDashboard';
import { toast } from 'sonner';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'jobs' | 'candidates'>(
    (localStorage.getItem('recruitmentActiveTab') as any) || 'dashboard'
  );
  const [viewMode, setViewMode] = useState<'list' | 'board'>(
    (localStorage.getItem('recruitmentViewMode') as any) || 'list'
  );
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
  const [showFilters, setShowFilters] = useState(false);
  const [candidateFilters, setCandidateFilters] = useState({
    source: 'all',
    experience: 'all'
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Auth & Permissions
  const { profile } = useAuth();
  
  const hasAccess = profile && (
    profile.role === 'Admin' || 
    profile.role === 'Leadership' || 
    (profile.role as string) === 'HR' || 
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

  useEffect(() => {
    localStorage.setItem('recruitmentActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('recruitmentViewMode', viewMode);
  }, [viewMode]);

  const handleDeleteJob = async (e: React.MouseEvent, job: JobOpening) => {
    e.stopPropagation();
    if (window.confirm(`CẢNH BÁO: Xóa vị trí "${job.title}" sẽ đồng thời hủy tất cả hồ sơ ứng viên đang theo vị trí này. Thao tác không thể hoàn tác!\n\nBạn có muốn tiếp tục xóa?`)) {
      try {
        await recruitmentService.deleteJobOpening(job.id);
        loadData();
      } catch (err) {
        console.error(err);
        alert('Có lỗi xảy ra khi xóa!');
      }
    }
  };

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
    const matchSearch = cand.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (cand.phone && cand.phone.includes(searchTerm)) ||
           (cand.email && cand.email.toLowerCase().includes(searchTerm.toLowerCase()));
           
    const exp = cand.experience_years || 0;
    let matchExp = true;
    if (candidateFilters.experience === '0') matchExp = exp === 0;
    else if (candidateFilters.experience === '1-3') matchExp = exp >= 1 && exp <= 3;
    else if (candidateFilters.experience === '3-5') matchExp = exp > 3 && exp <= 5;
    else if (candidateFilters.experience === '5+') matchExp = exp > 5;
    
    const matchSource = candidateFilters.source === 'all' || cand.source === candidateFilters.source;
    
    return matchSearch && matchExp && matchSource;
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
          {activeTab !== 'dashboard' && activeTab === 'jobs' && (
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
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 mr-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="Xem dạng Bảng"
                >
                  <List size={18} />
                </button>
                <button
                  onClick={() => setViewMode('board')}
                  className={`p-1.5 rounded-md transition-all ${viewMode === 'board' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="Xem dạng Kanban"
                >
                  <LayoutGrid size={18} />
                </button>
              </div>
              <button
                onClick={() => setShowCandidateForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm hover:shadow"
              >
                <Plus size={18} />
                <span>Thêm Ứng Viên</span>
              </button>
            </div>
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
          {activeTab === 'candidates' && (
             <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm font-medium ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
             >
                <Filter size={16} />
                <span className="hidden sm:inline">Bộ lọc {Object.values(candidateFilters).filter(v => v !== 'all').length > 0 && `(${Object.values(candidateFilters).filter(v => v !== 'all').length})`}</span>
             </button>
          )}
        </div>
      </div>
      
      {/* Expanded Filters for Candidates */}
      {activeTab === 'candidates' && showFilters && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Kinh nghiệm</label>
            <select 
              value={candidateFilters.experience}
              onChange={(e) => setCandidateFilters({...candidateFilters, experience: e.target.value})}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="all">Mọi mức độ</option>
              <option value="0">Chưa có kinh nghiệm</option>
              <option value="1-3">1 - 3 năm</option>
              <option value="3-5">3 - 5 năm</option>
              <option value="5+">Trên 5 năm</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
             <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Nguồn ứng viên</label>
             <select 
              value={candidateFilters.source}
              onChange={(e) => setCandidateFilters({...candidateFilters, source: e.target.value})}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="all">Tất cả nguồn</option>
              <option value="website">Website Cty</option>
              <option value="referral">Nội bộ giới thiệu</option>
              <option value="linkedin">LinkedIn</option>
              <option value="headhunt">Headhunt</option>
              <option value="job_board">Kênh tuyển dụng</option>
              <option value="other">Khác</option>
            </select>
          </div>
          
          {(candidateFilters.experience !== 'all' || candidateFilters.source !== 'all') && (
            <button 
              onClick={() => setCandidateFilters({experience: 'all', source: 'all'})}
              className="px-3 py-2 text-sm text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 underline underline-offset-2 transition-colors font-medium h-[38px] flex items-center"
            >
              Xóa lọc
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'dashboard'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <BarChart3 size={18} />
          Tổng quan
        </button>
        <button
          onClick={() => setActiveTab('candidates')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'candidates'
              ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <Users size={18} />
          Ứng viên
          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
            {filteredCandidates.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors ${
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
      </div>

      {/* Content */}
      <div className="mt-6">
        {isLoading && activeTab !== 'dashboard' ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400 truncate"></div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <RecruitmentDashboard />
            )}
            
            {activeTab === 'candidates' && viewMode === 'board' && (
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
                           <button onClick={(e) => { e.stopPropagation(); const url = `${window.location.origin}/jobs/${job.id}/apply`; navigator.clipboard.writeText(url); toast.success('Đã sao chép link ứng tuyển vòng ngoài!'); }} className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-900/30 rounded-lg transition-colors" title="Copy link ứng tuyển Public">
                             <LinkIcon size={16} />
                           </button>
                           <button onClick={(e) => handleDeleteJob(e, job)} className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-50 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-900/30 rounded-lg transition-colors" title="Xóa vị trí">
                             <Trash2 size={16} />
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
                         <button onClick={(e) => { e.stopPropagation(); setKanbanInitialJobId(job.id); setActiveTab('candidates'); }} className="text-xs text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end hover:underline">
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

            {activeTab === 'candidates' && viewMode === 'list' && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Ứng viên</th>
                        <th className="px-4 py-3">Liên hệ</th>
                        <th className="px-4 py-3">Trình độ</th>
                        <th className="px-4 py-3">Kinh nghiệm</th>
                        <th className="px-4 py-3">Vị trí ứng tuyển</th>
                        <th className="px-4 py-3 text-center">Trạng thái</th>
                        <th className="px-4 py-3">Ngày tạo</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredCandidates.map(candidate => (
                        <tr key={candidate.id} onClick={() => setSelectedCandidate(candidate)} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors group/row">
                          <td className="px-4 py-3 text-[10px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                            {candidate.full_name}
                            {candidate.is_blacklisted && <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded ml-2 font-bold tracking-wide">BLACKLIST</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-900 dark:text-slate-300">{candidate.phone}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-500">{candidate.email}</div>
                          </td>
                          <td className="px-4 py-3">{candidate.education || '-'}</td>
                          <td className="px-4 py-3">{candidate.experience_years} năm</td>
                          <td className="px-4 py-3 min-w-[200px]">
                            <div className="flex flex-col gap-2">
                              {candidate.applications && candidate.applications.length > 0 ? (
                                candidate.applications.map((app: any) => (
                                  <div key={app.id} className="h-7 flex items-center group/item">
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[170px]" title={app.job_opening?.title}>
                                      • {app.job_opening?.title || 'Vị trí đã xóa'}
                                    </span>
                                    <button 
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`Bạn có chắc muốn gỡ bỏ vị trí "${app.job_opening?.title}" khỏi hồ sơ ứng viên này?`)) {
                                          try {
                                            await recruitmentService.deleteApplication(app.id);
                                            loadData();
                                          } catch (err) {
                                            alert('Lỗi gỡ bỏ vị trí!');
                                          }
                                        }
                                      }}
                                      className="ml-auto opacity-0 group-hover/item:opacity-100 p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-all"
                                      title="Gỡ bỏ vị trí này"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400 dark:text-slate-500 italic h-7 flex items-center">Chưa ứng tuyển</span>
                              )}
                              
                              <div className="mt-1">
                                <select
                                  value=""
                                  onChange={async (e) => {
                                    e.stopPropagation();
                                    if (e.target.value) {
                                      try {
                                        await recruitmentService.createApplication({
                                          candidate_id: candidate.id,
                                          job_opening_id: e.target.value,
                                          stage: 'applied'
                                        });
                                        loadData();
                                      } catch (err) {
                                        alert('Lỗi ứng tuyển vị trí!');
                                      }
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] w-full max-w-[180px] bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded px-1.5 py-1 outline-none cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                  <option value="" disabled className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">+ Ứng tuyển vào vị trí...</option>
                                  {jobOpenings.filter(j => j.status !== 'closed').map(j => (
                                    <option key={j.id} value={j.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{j.title}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 min-w-[140px]">
                            <div className="flex flex-col gap-2 items-center">
                              {candidate.applications && candidate.applications.length > 0 ? (
                                candidate.applications.map((app: any) => (
                                  <div key={app.id} className="h-7 flex items-center">
                                    <select
                                      value={app.stage}
                                      onChange={async (e) => {
                                        e.stopPropagation();
                                        const newStage = e.target.value as ApplicationStage;
                                        try {
                                          await recruitmentService.moveStage(app.id, newStage);
                                          loadData();
                                        } catch (err) {
                                          alert('Lỗi chuyển trạng thái!');
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-block px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 font-semibold text-[9px] uppercase tracking-wider outline-none cursor-pointer hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                    >
                                      {Object.entries(APP_STAGES_MAP).map(([key, label]) => (
                                        <option key={key} value={key} className="normal-case tracking-normal bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">{label}</option>
                                      ))}
                                    </select>
                                  </div>
                                ))
                              ) : (
                                <div className="h-7" />
                              )}
                              <div className="h-[26px]" /> {/* Spacer for create application dropdown */}
                            </div>
                          </td>
                          <td className="px-4 py-3">{formatDateShort(candidate.created_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); setSelectedCandidate(candidate); }} className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800" title="Chi tiết / Sửa">
                                <Edit size={14} />
                              </button>
                              <button onClick={async (e) => {
                                e.stopPropagation();
                                if(window.confirm('CẢNH BÁO: Xóa ứng viên này sẽ đồng thời hủy toàn bộ lịch sử ứng tuyển của họ. Bạn có chắc chắn không?')) {
                                  try { await recruitmentService.deleteCandidate(candidate.id); loadData(); } catch(err) { alert('Lỗi xóa ứng viên!'); }
                                }
                              }} className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700" title="Xóa ứng viên">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
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
           jobOpenings={jobOpenings.filter(j => j.status !== 'closed')}
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
