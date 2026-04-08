import React, { useState, useEffect } from 'react';
import { Briefcase, Users, LayoutDashboard, Plus, Search, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { recruitmentService } from '../../services/recruitmentService';
import { JobOpening, Candidate, CandidateApplication } from '../../types/hrmTypes';
import { formatDateShort, formatDate } from '../../utils/formatters';

import JobOpeningForm from './JobOpeningForm';
import RecruitmentKanban from './RecruitmentKanban';
import CandidateForm from './CandidateForm';

const RecruitmentPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'jobs' | 'candidates'>('pipeline');
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Forms and Modals state
  const [showJobForm, setShowJobForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobOpening | null>(null);
  const [showCandidateForm, setShowCandidateForm] = useState(false);

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
    } catch (error) {
      console.error('Error loading recruitment data:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
              onClick={() => { setSelectedJob(null); setShowJobForm(true); }}
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
            {jobOpenings.filter(j => j.status === 'open').length}
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
               <RecruitmentKanban jobOpenings={jobOpenings} />
            )}
            
            {activeTab === 'jobs' && (
              <div className="grid gap-4">
                {jobOpenings.map(job => (
                  <div key={job.id} onClick={() => { setSelectedJob(job); setShowJobForm(true); }} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transform transition-all duration-200 shadow-sm hover:shadow-md">
                    <div className="flex justify-between items-start">
                       <div>
                         <div className="flex items-center gap-2 mb-1">
                           <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg">{job.title}</h3>
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
                       <div className="text-right">
                         <span className="text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                           {job.hired_count} / {job.quantity} đã tuyển
                         </span>
                       </div>
                    </div>
                  </div>
                ))}
                {jobOpenings.length === 0 && (
                   <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                     <Briefcase size={32} className="mx-auto text-slate-400 mb-3" />
                     <p className="text-slate-500 dark:text-slate-400">Chưa có vị trí tuyển dụng nào. Nhấn "Tạo Yêu cầu" để bắt đầu.</p>
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
                        <th className="px-4 py-3">Ngày tạo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {candidates.map(candidate => (
                        <tr key={candidate.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
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
                          <td className="px-4 py-3">{formatDateShort(candidate.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {candidates.length === 0 && (
                    <div className="text-center py-12">
                       <Users size={32} className="mx-auto text-slate-400 mb-3" />
                       <p className="text-slate-500 dark:text-slate-400">Chưa có hồ sơ ứng viên trong ngân hàng.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showJobForm && (
        <JobOpeningForm
          job={selectedJob}
          onClose={() => setShowJobForm(false)}
          onSuccess={() => { setShowJobForm(false); loadData(); }}
        />
      )}
      
      {showCandidateForm && (
        <CandidateForm
           jobOpenings={jobOpenings.filter(j => j.status === 'open')}
           onClose={() => setShowCandidateForm(false)}
           onSuccess={() => { setShowCandidateForm(false); loadData(); }}
        />
      )}
    </div>
  );
};

export default RecruitmentPage;
