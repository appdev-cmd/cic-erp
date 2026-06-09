import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, MapPin, GraduationCap, Briefcase, Calendar, Star, FileText, Download, Trash2, Edit, Send, Eye, CheckCircle, AlertCircle, RefreshCw, MailOpen } from 'lucide-react';
import { Candidate, CandidateApplication, ApplicationStage, ApplicationEvaluation, JobOpening, RecruitmentEmailLog } from '../../types/hrmTypes';
import { recruitmentService } from '../../services/recruitmentService';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import CandidateForm from './CandidateForm';
import { getEmailTemplate, isEmailSupportedStage, emailWrapper } from '../../lib/recruitmentEmailTemplates';
import { toast } from 'sonner';
import RichTextEditor from '../ui/RichTextEditor';
import { PenTool, Paperclip, ChevronDown, FileText as FileTextIcon, X as XIcon } from 'lucide-react';
import SignatureManagerModal from './SignatureManagerModal';
import { UserEmailSignature } from '../../types/hrmTypes';
import DateInput from '../ui/DateInput';

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
  const { profile, user } = useAuth();
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
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({});
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerData, setOfferData] = useState({
    offer_salary: 0,
    offer_date: '',
    onboard_date: '',
    targetStage: ''
  });
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Email composer state
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBodyHtml, setEmailBodyHtml] = useState('');
  const [emailHeaderBg, setEmailHeaderBg] = useState('');
  const [emailHeaderText, setEmailHeaderText] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailLogs, setEmailLogs] = useState<RecruitmentEmailLog[]>([]);
  const [isLoadingEmailLogs, setIsLoadingEmailLogs] = useState(false);

  // Signatures & Attachments
  const [emailAttachments, setEmailAttachments] = useState<{ filename: string; content: string; size: number }[]>([]);
  const [showSignatureManager, setShowSignatureManager] = useState(false);
  const [userSignatures, setUserSignatures] = useState<UserEmailSignature[]>([]);
  const [showSignatureDropdown, setShowSignatureDropdown] = useState(false);

  const cand = candidate || application?.candidate;
  const evaluatorId = profile?.employeeId;

  useEffect(() => {
    if (cand) {
      loadHistory();
    }
  }, [cand]);

  useEffect(() => {
    if (profile?.id || user?.id) {
      loadSignatures();
    }
  }, [profile?.id, user?.id]);

  const loadSignatures = async () => {
    if (!profile?.id && !user?.id) return;
    try {
      const data = await recruitmentService.getUserSignatures(user?.id || profile!.id);
      setUserSignatures(data);
    } catch (e) {
      console.error(e);
    }
  };

  const getAttachments = () => {
    if (!cand?.resume_url) return [];
    try {
      const parsed = JSON.parse(cand.resume_url);
      if (Array.isArray(parsed)) return parsed;
    } catch(e) {}
    return [{ name: 'Hồ sơ năng lực / CV', url: cand.resume_url }];
  };
  const attachments = getAttachments();

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

  const activeApp = historyApps.find(a => a.id === (localAppId || application?.id)) || application;
  const isInterviewStage = ['interview_1', 'interview_2', 'technical_test'].includes(activeApp?.stage || '');

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
    
    if (newStage === 'hired' || newStage === 'offer') {
      setOfferData(prev => ({ ...prev, targetStage: newStage }));
      setShowOfferModal(true);
      return;
    }

    setIsUpdating(true);
    try {
      await recruitmentService.moveStage(activeApp.id, newStage);
      if (onUpdate) onUpdate();
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
        notes,
        criteria_scores: isInterviewStage ? criteriaScores : undefined
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

  // ── Email handlers ──
  const openEmailComposer = () => {
    if (!activeApp || !cand) return;
    const jobTitle = activeApp.job_opening?.title || (activeApp as any).job_opening?.title;
    const template = getEmailTemplate(activeApp.stage, cand.full_name, jobTitle, {
      rejectionReason: activeApp.rejection_reason || undefined,
      offerSalary: activeApp.offer_salary || undefined,
      onboardDate: activeApp.onboard_date || undefined,
    });
    if (template) {
      setEmailSubject(template.subject);
      setEmailBodyHtml(template.bodyHtml);
      setEmailHeaderBg(template.headerBg);
      setEmailHeaderText(template.headerText);
    } else {
      setEmailSubject(`[CIC] Thông báo tuyển dụng`);
      setEmailBodyHtml(`<p>Chào ${cand.full_name},</p><p>...</p>`);
      setEmailHeaderBg('#2d3436');
      setEmailHeaderText('Thông báo tuyển dụng');
    }
    
    // Auto insert default signature
    const defaultSig = userSignatures.find(s => s.is_default);
    if (defaultSig) {
      setEmailBodyHtml(prev => prev + defaultSig.html_content);
    }
    
    setEmailAttachments([]);
    setShowEmailComposer(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      // Check total size
      const currentTotal = emailAttachments.reduce((sum, a) => sum + a.size, 0);
      if (currentTotal + file.size > 3 * 1024 * 1024) {
        toast.error('Tổng dung lượng tệp đính kèm không được vượt quá 3MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = (event.target?.result as string).split(',')[1];
        setEmailAttachments(prev => [...prev, {
          filename: file.name,
          content: base64String,
          size: file.size
        }]);
      };
      reader.readAsDataURL(file);
    });
    // Reset input
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setEmailAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const insertSignature = (sigHtml: string) => {
    setEmailBodyHtml(prev => prev + sigHtml);
    setShowSignatureDropdown(false);
  };

  const handleSendEmail = async () => {
    if (!activeApp || !cand || !cand.email) return;
    setIsSendingEmail(true);
    try {
      const finalHtml = emailWrapper(emailHeaderBg, emailHeaderText, emailBodyHtml);
      const result = await recruitmentService.sendStageEmail({
        application_id: activeApp.id,
        candidate_id: cand.id,
        stage: activeApp.stage,
        to: cand.email,
        subject: emailSubject,
        html: finalHtml,
        sent_by: evaluatorId || undefined,
        attachments: emailAttachments.length > 0 ? emailAttachments.map(a => ({ filename: a.filename, content: a.content })) : undefined
      });
      if (result.success) {
        toast.success(result.mock ? '📧 Email đã gửi (mock mode — chưa có API key)' : '✅ Email đã gửi thành công!');
        setShowEmailComposer(false);
        loadEmailLogs();
      } else {
        toast.error(`❌ Gửi thất bại: ${result.error}`);
      }
    } catch (e: any) {
      toast.error('Lỗi khi gửi email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const loadEmailLogs = async () => {
    if (!activeApp) return;
    setIsLoadingEmailLogs(true);
    try {
      const logs = await recruitmentService.getEmailLogs(activeApp.id);
      setEmailLogs(logs);
    } catch (e) {
      console.error('Error loading email logs:', e);
    } finally {
      setIsLoadingEmailLogs(false);
    }
  };

  useEffect(() => {
    if (activeApp) {
      loadEmailLogs();
    }
  }, [activeApp?.id]);

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
                  {attachments.length > 0 ? (
                    <div className="space-y-2">
                      {attachments.map((att: any, idx: number) => {
                        const isUrl = att.name.startsWith('http');
                        const extension = isUrl ? 'LINK' : (att.name.split('.').pop() || 'DOCUMENT').toUpperCase();
                        return (
                          <a key={idx} href={att.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors group">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-md shrink-0">
                                <FileText size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate" title={att.name}>{att.name}</p>
                                <p className="text-xs text-slate-500">{extension}</p>
                              </div>
                            </div>
                            <Download size={16} className="text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0" />
                          </a>
                        );
                      })}
                    </div>
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

              {/* Email Notification Button */}
              {isEmailSupportedStage(activeApp.stage) && (
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-800">
                        <Mail size={18} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Gửi Email thông báo</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {cand?.email ? `Đến: ${cand.email}` : 'Ứng viên chưa có email'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={openEmailComposer}
                      disabled={!cand?.email}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                        cand?.email
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow active:scale-95'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Send size={15} />
                      Soạn Email
                    </button>
                  </div>
                  {emailLogs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-indigo-100 dark:border-indigo-800/50">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Lịch sử gửi email</p>
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                        {emailLogs.map(log => (
                          <div key={log.id} className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              {log.status === 'sent' ? (
                                <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                              ) : (
                                <AlertCircle size={14} className="text-rose-500 shrink-0" />
                              )}
                              <span className="text-slate-700 dark:text-slate-300 truncate" title={log.email_subject}>{log.email_subject}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-slate-400 dark:text-slate-500">{log.sent_at ? formatDateTime(log.sent_at) : formatDateTime(log.created_at)}</span>
                              {log.status === 'failed' && (
                                <button
                                  onClick={openEmailComposer}
                                  className="p-1 text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors cursor-pointer"
                                  title="Gửi lại"
                                >
                                  <RefreshCw size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                                                if (ev.criteria_scores) {
                                                    setCriteriaScores(ev.criteria_scores as Record<string, number>);
                                                }
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
                    {isInterviewStage && (
                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                         <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3 block uppercase tracking-wider">Phiếu chấm điểm (Rubric)</label>
                         <div className="space-y-3">
                           {[
                             { id: 'tech_skills', label: 'Kiến thức chuyên môn' },
                             { id: 'experience', label: 'Kinh nghiệm thực tế' },
                             { id: 'problem_solving', label: 'Tư duy & Phân tích' },
                             { id: 'cultural_fit', label: 'Sự phù hợp văn hóa' },
                             { id: 'communication', label: 'Kỹ năng Giao tiếp' }
                           ].map(crit => (
                             <div key={crit.id} className="flex flex-wrap items-center justify-between gap-2">
                               <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{crit.label}</span>
                               <div className="flex gap-1">
                                 {[1, 2, 3, 4, 5].map(score => (
                                    <button 
                                      key={score}
                                      onClick={() => {
                                        setCriteriaScores(prev => {
                                          const next = { ...prev, [crit.id]: score };
                                          // Auto-calc avg rating
                                          const vals: number[] = Object.values(next);
                                          if (vals.length > 0) {
                                            const avg = Math.round(vals.reduce((a,b)=>a+b,0) / vals.length);
                                            setRating(avg);
                                          }
                                          return next;
                                        });
                                      }}
                                      className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold transition-colors cursor-pointer ${
                                        criteriaScores[crit.id] === score 
                                          ? 'bg-indigo-600 text-white' 
                                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-400'
                                      }`}
                                    >
                                      {score}
                                    </button>
                                 ))}
                               </div>
                             </div>
                           ))}
                         </div>
                      </div>
                    )}
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

      {/* Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <h3 className="font-bold text-slate-800 dark:text-slate-200">
                {(offerData as any).targetStage === 'hired' ? 'Xác nhận Tuyển dụng' : 'Gửi Job Offer'}
              </h3>
              <button onClick={() => setShowOfferModal(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                 <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Mức lương Đề nghị (VND)</label>
                 <input 
                   type="number"
                   value={offerData.offer_salary || ''}
                   onChange={e => setOfferData({...offerData, offer_salary: parseInt(e.target.value)||0})}
                   className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50"
                   placeholder="VND..."
                 />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Ngày gửi Offer</label>
                   <input 
                     type="date"
                     value={offerData.offer_date}
                     onChange={e => setOfferData({...offerData, offer_date: e.target.value})}
                     className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50"
                   />
                 </div>
                 {/* onboard_date using same input styles */}
                 <div>
                   <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Ngày nhận việc</label>
                   <input 
                     type="date"
                     value={offerData.onboard_date}
                     onChange={e => setOfferData({...offerData, onboard_date: e.target.value})}
                     className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/50"
                   />
                 </div>
              </div>
              <div className="pt-4 flex gap-3">
                 <button onClick={() => setShowOfferModal(false)} className="flex-1 py-2 font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer">
                   Hủy
                 </button>
                 <button 
                  onClick={async () => {
                    setIsUpdating(true);
                    try {
                      // Save extra offer data to application
                      await supabase.from('applications').update({
                        offer_salary: offerData.offer_salary,
                        offer_date: offerData.offer_date || null,
                        onboard_date: offerData.onboard_date || null
                      }).eq('id', activeApp?.id);

                      await recruitmentService.moveStage(activeApp!.id, (offerData as any).targetStage);
                      setShowOfferModal(false);
                      if (onUpdate) onUpdate();
                      alert(`Đã cập nhật trạng thái thành ${(offerData as any).targetStage}`);
                    } catch (e: any) {
                      alert('Lỗi khi cập nhật trạng thái Offer');
                    } finally {
                      setIsUpdating(false);
                    }
                  }} 
                  disabled={isUpdating}
                  className="flex-1 py-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-lg shadow-indigo-200/50 dark:shadow-none cursor-pointer"
                 >
                   Xác nhận
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Composer Modal */}
      {showEmailComposer && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 shrink-0">
              <div className="flex items-center gap-2">
                <MailOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Soạn Email cho Ứng viên</h3>
              </div>
              <button onClick={() => setShowEmailComposer(false)} className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer text-slate-400">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              {/* To */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Đến</label>
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 font-medium">
                  {cand?.email || 'Không có email'}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Tiêu đề</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                  placeholder="Tiêu đề email..."
                />
              </div>

              {/* Content */}
              <div>
                <div className="flex items-center justify-between mb-1.5 relative">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nội dung</label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer">
                      <Paperclip size={13} />
                      Đính kèm
                      <input type="file" multiple className="hidden" onChange={handleFileChange} />
                    </label>

                    <div className="relative">
                      <button
                        onClick={() => setShowSignatureDropdown(!showSignatureDropdown)}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors cursor-pointer"
                      >
                        <PenTool size={13} />
                        Chèn chữ ký
                        <ChevronDown size={12} />
                      </button>

                      {showSignatureDropdown && (
                        <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 z-[110]">
                          {userSignatures.length > 0 ? (
                            userSignatures.map(sig => (
                              <button
                                key={sig.id}
                                onClick={() => insertSignature(sig.html_content)}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-between group"
                              >
                                <span className="truncate mr-2">{sig.name}</span>
                                {sig.is_default && <CheckCircle size={12} className="text-emerald-500 shrink-0" />}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-xs text-slate-500 text-center">Chưa có mẫu nào</div>
                          )}
                          <div className="border-t border-slate-100 dark:border-slate-700 mt-1">
                            <button
                              onClick={() => {
                                setShowSignatureDropdown(false);
                                setShowSignatureManager(true);
                              }}
                              className="w-full text-left px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                              + Quản lý mẫu chữ ký
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <RichTextEditor
                  value={emailBodyHtml}
                  onChange={setEmailBodyHtml}
                  minHeight="300px"
                />

                {/* Attachments List */}
                {emailAttachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {emailAttachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs">
                        <FileTextIcon size={12} className="text-slate-500" />
                        <span className="text-slate-700 dark:text-slate-300 max-w-[150px] truncate">{att.filename}</span>
                        <span className="text-slate-400">({(att.size / 1024).toFixed(0)}KB)</span>
                        <button onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-500 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                          <XIcon size={12} />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center text-xs text-slate-500 ml-2 font-medium">
                      Tổng: {(emailAttachments.reduce((s, a) => s + a.size, 0) / (1024 * 1024)).toFixed(2)} / 3.0 MB
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between shrink-0">
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Gửi từ: thuongnth@cic.com.vn
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEmailComposer(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail || !emailSubject.trim() || !emailBodyHtml.trim()}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                >
                  {isSendingEmail ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  {isSendingEmail ? 'Đang gửi...' : 'Gửi Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Render form đè lên khi chọn Edit */}
      {showEditForm && (
        <React.Suspense fallback={<div>Loading...</div>}>
          <CandidateForm 
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
      {/* Modals */}
      {showSignatureManager && (
        <SignatureManagerModal
          onClose={() => setShowSignatureManager(false)}
          onSignaturesChange={loadSignatures}
        />
      )}
      
      {/* Offer Modal */}
      {showOfferModal && activeApp && (
        <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity">
          <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-md shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {offerData.targetStage === 'hired' ? 'Xác nhận Tuyển dụng' : 'Thông tin Gửi Offer'}
              </h3>
              <button onClick={() => setShowOfferModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <XIcon size={18} />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Mức lương Offer (VNĐ)</label>
                <input
                  type="number"
                  value={offerData.offer_salary || ''}
                  onChange={e => setOfferData({ ...offerData, offer_salary: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                  placeholder="Ví dụ: 15000000"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Ngày gửi Offer</label>
                  <DateInput
                    value={offerData.offer_date}
                    onChange={val => setOfferData({ ...offerData, offer_date: val })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Ngày nhận việc</label>
                  <DateInput
                    value={offerData.onboard_date}
                    onChange={val => setOfferData({ ...offerData, onboard_date: val })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setShowOfferModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={async () => {
                  setIsUpdating(true);
                  try {
                    // Update application details
                    await recruitmentService.updateApplication(activeApp.id, {
                      offer_salary: offerData.offer_salary,
                      offer_date: offerData.offer_date,
                      onboard_date: offerData.onboard_date
                    });
                    // Change stage
                    await recruitmentService.moveStage(activeApp.id, offerData.targetStage as ApplicationStage);
                    
                    if (onUpdate) onUpdate();
                    setHistoryApps(prev => prev.map(a => a.id === activeApp.id ? { 
                      ...a, 
                      stage: offerData.targetStage as ApplicationStage,
                      offer_salary: offerData.offer_salary,
                      offer_date: offerData.offer_date,
                      onboard_date: offerData.onboard_date
                    } : a));
                    setShowOfferModal(false);
                    if (offerData.targetStage === 'hired') {
                      toast.success('Đã tuyển thành công! Hệ thống đã tự động tạo hồ sơ nhân viên và khởi chạy quy trình hội nhập.');
                    } else {
                      toast.success('Đã cập nhật trạng thái thành công');
                    }
                  } catch (e) {
                    console.error(e);
                    toast.error('Có lỗi xảy ra khi cập nhật');
                  } finally {
                    setIsUpdating(false);
                  }
                }}
                disabled={isUpdating}
                className="px-5 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isUpdating ? 'Đang xử lý...' : 'Xác nhận & Cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


export default CandidateDetailPanel;
