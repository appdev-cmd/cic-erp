import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, MapPin, GraduationCap, Briefcase, Calendar, Star, FileText, Download, Trash2, Edit } from 'lucide-react';
import { Candidate, CandidateApplication, ApplicationStage, ApplicationEvaluation, JobOpening } from '../../types/hrmTypes';
import { recruitmentService } from '../../services/recruitmentService';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';

const calculateDays = (start: string, end: string) => {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

interface Props {
  candidate?: Candidate;
  application?: CandidateApplication;
  jobOpenings?: JobOpening[]; // Dùng cho chức năng Edit
  onClose: () => void;
  onUpdate?: () => void;
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

const CandidateDetailPanel: React.FC<Props> = ({ candidate, application, onClose, onUpdate }) => {
  const { profile } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'interview'>('info');
  const [historyApps, setHistoryApps] = useState<CandidateApplication[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Notes state
  const [evaluations, setEvaluations] = useState<ApplicationEvaluation[]>([]);
  const [isLoadingEvals, setIsLoadingEvals] = useState(false);
  const [localAppId, setLocalAppId] = useState<string | undefined>(application?.id);

  const [rating, setRating] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const cand = candidate || application?.candidate;
  const evaluatorId = profile?.employeeId;

  useEffect(() => {
    if (cand) {
      loadHistory();
    }
  }, [cand]);

  const loadHistory = async () => {
    if (!cand) return;
    setIsLoadingHistory(true);
    try {
      const data = await recruitmentService.getApplicationsByCandidate(cand.id);
      setHistoryApps(data);
      if (!application && data.length > 0 && !localAppId) {
        setLocalAppId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const activeApp = application || historyApps.find(a => a.id === localAppId);

  const loadEvaluations = async (appId: string) => {
    setIsLoadingEvals(true);
    try {
      const data = await recruitmentService.getEvaluations(appId);
      setEvaluations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingEvals(false);
    }
  };

  useEffect(() => {
    if (activeApp) {
      loadEvaluations(activeApp.id);
    } else {
      setEvaluations([]);
    }
  }, [activeApp?.id]);

  const handleStageChange = async (newStage: ApplicationStage) => {
    if (!activeApp) return;
    setIsUpdating(true);
    try {
      await recruitmentService.moveStage(activeApp.id, newStage);
      if (onUpdate) onUpdate();
      // Optimistically update local view
      setHistoryApps(prev => prev.map(a => a.id === activeApp.id ? { ...a, stage: newStage } : a));
    } catch (e) {
      console.error(e);
      alert('Lỗi cập nhật vòng phỏng vấn');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!activeApp || !evaluatorId) return;
    setIsSavingNotes(true);
    try {
      await recruitmentService.upsertEvaluation({
        application_id: activeApp.id,
        evaluator_id: evaluatorId,
        rating,
        notes
      });
      await loadEvaluations(activeApp.id);
      if (onUpdate) onUpdate();
      setIsEditingNotes(false);
    } catch (e) {
      console.error(e);
      alert('Lỗi lưu đánh giá');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleDelete = async () => {
    if (!cand) return;
    const isAppDeletion = !!application;
    const confirmMessage = isAppDeletion 
      ? 'Bạn có chắc chắn muốn rút hồ sơ của ứng viên này khỏi vị trí ứng tuyển hiện tại?'
      : 'CẢNH BÁO: Xóa ứng viên này sẽ đồng thời hủy toàn bộ lịch sử ứng tuyển của họ. Bạn có chắc chắn không?';

    if (!window.confirm(confirmMessage)) return;

    setIsDeleting(true);
    try {
      if (isAppDeletion) {
        await recruitmentService.deleteApplication(application.id);
      } else {
        await recruitmentService.deleteCandidate(cand.id);
      }
      if (onUpdate) onUpdate();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Đã xảy ra lỗi khi xóa!');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!cand) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 z-[110] w-full md:max-w-lg lg:max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-5 flex items-start justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 shrink-0">
          <div>
            {activeApp && (
              <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-200 dark:border-indigo-800/50">
                {STAGES.find(s => s.id === activeApp.stage)?.label}
              </span>
            )}
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{cand.full_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {application ? `Ngày apply: ${formatDate(application.created_at)}` : `Ngày tạo CV: ${formatDate(cand.created_at)}`}
              </p>
              {activeApp && activeApp.stage_updated_at && activeApp.stage === 'hired' && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800/50">
                    Time-to-Hire: {calculateDays(activeApp.created_at, activeApp.stage_updated_at)} ngày
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowEditForm(true)}
              className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
              title="Sửa hồ sơ ứng viên"
            >
              <Edit size={18} />
            </button>
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
              title={application ? "Rút hồ sơ ứng tuyển" : "Xóa ứng viên"}
            >
              {isDeleting ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/> : <Trash2 size={18} />}
            </button>
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-1"></div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
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
                <div className="grid grid-cols-1 gap-4 text-sm bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700"><Phone size={16} className="text-indigo-500" /></div>
                    <span className="font-medium">{cand.phone || 'Chưa có SĐT'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700"><Mail size={16} className="text-indigo-500" /></div>
                    <span className="font-medium">{cand.email || 'Chưa có Email'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700"><Calendar size={16} className="text-indigo-500" /></div>
                    <span className="font-medium">{cand.date_of_birth ? formatDate(cand.date_of_birth) : 'Chưa nhập ngày sinh'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700"><MapPin size={16} className="text-indigo-500" /></div>
                    <span className="font-medium">{cand.address || 'Chưa nhập địa chỉ'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Học vấn & Kinh nghiệm</h3>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-5 border border-slate-100 dark:border-slate-800 space-y-5 text-sm">
                  <div>
                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1.5 font-medium"><GraduationCap size={16} className="text-slate-400" /> Chuyên ngành học</span>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-base">{cand.university || '—'}</p>
                    {cand.specialization && <p className="text-slate-600 dark:text-slate-400 mt-0.5">Khoa: {cand.specialization}</p>}
                  </div>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 w-full" />
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

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Hồ sơ đính kèm</h3>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                  {cand.resume_url ? (
                    <a href={cand.resume_url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-md">
                          <FileText size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Hồ sơ năng lực / CV</p>
                          <p className="text-xs text-slate-500">Tài liệu đính kèm</p>
                        </div>
                      </div>
                      <Download size={16} className="text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                    </a>
                  ) : (
                    <div className="text-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                      <FileText size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Chưa có file đính kèm</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Lịch sử ứng tuyển</h3>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                    {isLoadingHistory ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">Đang tải lịch sử...</p>
                    ) : historyApps.length > 0 ? (
                      <div className="space-y-3">
                        {historyApps.map((app) => (
                          <div key={app.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm line-clamp-1" title={app.job_opening?.title}>{app.job_opening?.title || 'Vị trí không xác định'}</p>
                              <p className="text-xs text-slate-500 mt-1">{formatDate(app.created_at)}</p>
                            </div>
                            <span className="shrink-0 ml-3 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wide border border-slate-200 dark:border-slate-700">
                              {STAGES.find(s => s.id === app.stage)?.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Chưa ứng tuyển vị trí nào</p>
                        <p className="text-xs text-slate-400 mt-0.5">Ứng viên chỉ nằm trong ngân hàng CV</p>
                      </div>
                    )}
                  </div>
                </div>
            </div>
          )}

          {activeTab === 'interview' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              {!activeApp ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Briefcase size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Ứng viên chưa ứng tuyển vị trí nào</p>
                  <p className="text-xs text-slate-500 mt-1">Chưa thể đánh giá hoặc chuyển vòng</p>
                </div>
              ) : (
                <>
                  {historyApps.length > 1 && !application && (
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Chọn vị trí đánh giá</label>
                       <select 
                         value={activeApp.id} 
                         onChange={(e) => setLocalAppId(e.target.value)}
                         className="w-full truncate px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                       >
                         {historyApps.map(app => (
                           <option key={app.id} value={app.id}>{app.job_opening?.title || 'Vị trí không xác định'} - ({STAGES.find(s=>s.id===app.stage)?.label})</option>
                         ))}
                       </select>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Chuyển Stage Nhanh</h3>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                      <div className="flex flex-wrap gap-2">
                        {STAGES.map(stage => {
                          const isCurrent = stage.id === activeApp.stage;
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
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Đánh giá ứng viên</h3>
                  {!isEditingNotes && evaluatorId && !evaluations.find(e => e.evaluator_id === evaluatorId) && (
                    <button 
                      onClick={() => {
                        setRating(0);
                        setNotes('');
                        setIsEditingNotes(true);
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-medium cursor-pointer hover:underline"
                    >
                      + Đánh giá của tôi
                    </button>
                  )}
                </div>

                {/* List of evaluations */}
                {isLoadingEvals ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">Đang tải đánh giá...</p>
                ) : evaluations.length > 0 ? (
                    <div className="space-y-3">
                        {evaluations.map(ev => {
                            const isMe = ev.evaluator_id === evaluatorId;
                            if (isEditingNotes && isMe) return null; // Hide if currently editing
                            
                            return (
                                <div key={ev.id} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                          <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                                            {ev.evaluator?.name?.charAt(0) || '?'}
                                          </div>
                                          <div>
                                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                  {ev.evaluator?.name || 'Người dùng ẩn'}
                                                  {isMe && <span className="ml-2 text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded uppercase tracking-wide">BẠN</span>}
                                              </p>
                                              <p className="text-[10px] text-slate-500 dark:text-slate-500">{formatDateTime(ev.updated_at)}</p>
                                          </div>
                                      </div>
                                      {isMe && (
                                          <button 
                                            onClick={() => {
                                                setRating(ev.rating || 0);
                                                setNotes(ev.notes || '');
                                                setIsEditingNotes(true);
                                            }}
                                            className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-400 hover:underline px-2 py-1 cursor-pointer"
                                          >
                                              Sửa
                                          </button>
                                      )}
                                    </div>
                                    {(ev.rating && ev.rating > 0) ? (
                                        <div className="flex gap-1 mb-2">
                                          {[1, 2, 3, 4, 5].map(star => (
                                              <Star key={star + Math.random()} size={14} fill={ev.rating! >= star ? "currentColor" : "none"} className={ev.rating! >= star ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'} />
                                          ))}
                                        </div>
                                    ) : null}
                                    {ev.notes && (
                                        <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800/50">
                                          {ev.notes}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : !isEditingNotes && (
                  <div className="text-center p-6 bg-slate-50 dark:bg-slate-800 border border-slate-200 border-dashed dark:border-slate-700 rounded-xl">
                    <Star size={20} className="mx-auto text-slate-300 dark:text-slate-500 mb-2" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Chưa có đánh giá nào</p>
                    {!evaluatorId && (
                        <p className="text-xs text-rose-500 mt-1">Lỗi: Tài khoản của bạn không được map với nhân sự nên không thể đánh giá.</p>
                    )}
                  </div>
                )}

                {isEditingNotes && evaluatorId && (
                  <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4 space-y-4 shadow-sm animate-in fade-in zoom-in-95 duration-200 mt-4 relative">
                    <div className="flex items-center justify-between">
                       <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Đánh giá của bạn</h4>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">Xếp hạng (1-5 sao)</label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(star => (
                              <button 
                                key={star} 
                                onClick={() => setRating(star)} 
                                className={`p-1.5 transition-all outline-none transform active:scale-90 cursor-pointer ${rating >= star ? 'text-amber-400 scale-110' : 'text-slate-200 dark:text-slate-700 hover:text-amber-200'}`}
                              >
                                <Star size={24} fill={rating >= star ? "currentColor" : "none"} />
                              </button>
                          ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 block">Ghi chú & Nhận xét</label>
                        <textarea
                          className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-700 dark:text-slate-300 custom-scrollbar resize-y min-h-[96px] placeholder-slate-400"
                          placeholder="Ví dụ: Ứng viên giao tiếp rành mạch, kỹ năng cứng phù hợp..."
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800/50">
                        <button 
                          onClick={() => {
                              setIsEditingNotes(false);
                          }}
                          className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          Hủy
                        </button>
                        <button 
                          onClick={handleSaveNotes}
                          disabled={isSavingNotes || (!notes && rating === 0)}
                          className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm shadow-indigo-200 dark:shadow-none disabled:opacity-50 flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                          {isSavingNotes ? (
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Star size={14} fill="currentColor" />
                          )}
                          Lưu đánh giá
                        </button>
                    </div>
                  </div>
                )}
              </div>
              </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Render form đè lên khi chọn Edit */}
      {showEditForm && (
        <React.Suspense fallback={<div>Loading...</div>}>
          <CandidateFormBase 
            jobOpenings={[]} 
            candidate={cand} 
            onClose={() => setShowEditForm(false)} 
            onSuccess={() => {
              setShowEditForm(false);
              if (onUpdate) onUpdate();
              // Lưu ý: data ở detail view có thể bị cũ. Nên lấy lại trên component cha
            }}
          />
        </React.Suspense>
      )}
    </>
  );
};

// Sử dụng lazy loading cho CandidateForm để tránh circular dependency nếu có
const CandidateFormBase = React.lazy(() => import('./CandidateForm'));

export default CandidateDetailPanel;
