import React, { useState } from 'react';
import { X, User, Phone, Mail, MapPin, GraduationCap, Briefcase, Calendar, Star } from 'lucide-react';
import { CandidateApplication, ApplicationStage } from '../../types/hrmTypes';
import { recruitmentService } from '../../services/recruitmentService';
import { formatDate } from '../../utils/formatters';

interface Props {
  application: CandidateApplication;
  onClose: () => void;
  onUpdate: () => void;
}

const STAGES: { id: ApplicationStage; label: string }[] = [
  { id: 'applied', label: 'Ứng tuyển mới' },
  { id: 'screening', label: 'Sàng lọc CV' },
  { id: 'interview_1', label: 'Phỏng vấn vòng 1' },
  { id: 'interview_2', label: 'Phỏng vấn vòng 2' },
  { id: 'technical_test', label: 'Bài Test' },
  { id: 'offer', label: 'Gửi Offer' },
  { id: 'hired', label: 'Đã Tuyển' },
  { id: 'rejected', label: 'Từ chối' },
  { id: 'withdrawn', label: 'Rút lui' },
];

const CandidateDetailPanel: React.FC<Props> = ({ application, onClose, onUpdate }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'interview'>('info');

  const handleStageChange = async (newStage: ApplicationStage) => {
    setIsUpdating(true);
    try {
      await recruitmentService.moveStage(application.id, newStage);
      onUpdate();
      // Optimistically update local view indirectly through parent remount or state
    } catch (e) {
      console.error(e);
      alert('Lỗi cập nhật vòng phỏng vấn');
    } finally {
      setIsUpdating(false);
    }
  };

  const cand = application.candidate;
  if (!cand) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 z-[110] w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-5 flex items-start justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <div>
            <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-200 dark:border-indigo-800/50">
              {STAGES.find(s => s.id === application.stage)?.label}
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{cand.full_name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ngày apply: {formatDate(application.created_at)}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/50 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 pt-2 shrink-0 bg-white dark:bg-slate-900">
          <button 
            onClick={() => setActiveTab('info')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'info' ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Hồ sơ & Liên hệ
          </button>
          <button 
            onClick={() => setActiveTab('interview')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === 'interview' ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Đánh giá & Chuyển vòng
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white dark:bg-slate-900">
          {activeTab === 'info' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Thông tin Liên hệ</h3>
                <div className="grid grid-cols-1 gap-4 text-sm bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700/50"><Phone size={16} className="text-indigo-500" /></div>
                    <span className="font-medium">{cand.phone || 'Chưa có SĐT'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700/50"><Mail size={16} className="text-indigo-500" /></div>
                    <span className="font-medium">{cand.email || 'Chưa có Email'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700/50"><Calendar size={16} className="text-indigo-500" /></div>
                    <span className="font-medium">{cand.date_of_birth ? formatDate(cand.date_of_birth) : 'Chưa nhập ngày sinh'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700/50"><MapPin size={16} className="text-indigo-500" /></div>
                    <span className="font-medium">{cand.address || 'Chưa nhập địa chỉ'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Học vấn & Kinh nghiệm</h3>
                <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-5 border border-slate-100 dark:border-slate-800 space-y-5 text-sm">
                  <div>
                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1.5 font-medium"><GraduationCap size={16} className="text-slate-400" /> Chuyên ngành học</span>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-base">{cand.university || '—'}</p>
                    {cand.specialization && <p className="text-slate-600 dark:text-slate-400 mt-0.5">Khoa: {cand.specialization}</p>}
                  </div>
                  <div className="h-px bg-slate-200 dark:bg-slate-700/50 w-full" />
                  <div>
                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1.5 font-medium"><Briefcase size={16} className="text-slate-400" /> Kinh nghiệm làm việc</span>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-base">{cand.experience_years} năm</p>
                    {cand.current_company && (
                      <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Cựu <span className="font-medium text-slate-700 dark:text-slate-300">{cand.current_position}</span> tại <span className="font-medium text-slate-700 dark:text-slate-300">{cand.current_company}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'interview' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Chuyển Stage Nhanh</h3>
                <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-wrap gap-2">
                    {STAGES.map(stage => {
                      const isCurrent = stage.id === application.stage;
                      const isDanger = ['rejected', 'withdrawn'].includes(stage.id);
                      return (
                        <button
                          key={stage.id}
                          disabled={isUpdating || isCurrent}
                          onClick={() => handleStageChange(stage.id)}
                          className={`px-3 py-2 text-xs font-medium border rounded-lg transition-all cursor-pointer ${
                            isCurrent 
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md dark:bg-indigo-500 dark:border-indigo-500 cursor-default scale-[1.02]'
                              : isDanger
                                ? 'bg-white border-slate-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:bg-slate-800 dark:border-slate-700 dark:text-rose-400 dark:hover:border-rose-500/50 dark:hover:bg-rose-900/20'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/10'
                          } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {stage.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between pl-1">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Lịch sử đánh giá</h3>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer hover:underline">+ Thêm ghi chú</span>
                </div>
                <div className="text-center p-8 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 border-dashed dark:border-slate-700 rounded-xl">
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100 dark:border-slate-700">
                    <Star size={20} className="text-slate-300 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Chưa có đánh giá</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cập nhật điểm phỏng vấn hoặc ghi chú ở đây.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CandidateDetailPanel;
