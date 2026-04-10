import React, { useState } from 'react';
import { X, Save, Upload } from 'lucide-react';
import { recruitmentService } from '../../services/recruitmentService';
import { Candidate, JobOpening } from '../../types/hrmTypes';

interface Props {
  jobOpenings: JobOpening[];
  preSelectedJobId?: string;
  candidate?: Candidate | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CandidateForm: React.FC<Props> = ({ jobOpenings, preSelectedJobId, candidate, onClose, onSuccess }) => {
  const isEdit = !!candidate;
  
  const initialAttachments = (() => {
    if (!candidate?.resume_url) return [];
    try {
      const parsed = JSON.parse(candidate.resume_url);
      if (Array.isArray(parsed)) return parsed;
    } catch(e) {}
    return [{ name: 'Hồ sơ năng lực / CV', url: candidate.resume_url }];
  })();

  const [formData, setFormData] = useState({
    full_name: candidate?.full_name || '',
    email: candidate?.email || '',
    phone: candidate?.phone || '',
    education: candidate?.education || '',
    experience_years: candidate?.experience_years || 0,
    job_opening_id: preSelectedJobId || '',
    notes: candidate?.notes || ''
  });
  const [existingAttachments, setExistingAttachments] = useState<{name: string, url: string}[]>(initialAttachments);
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [externalUrl, setExternalUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let uploadedAttachs: any[] = [];
      for (const file of resumeFiles) {
        const url = await recruitmentService.uploadResume(file);
        uploadedAttachs.push({ name: file.name, url });
      }
      
      const allAttachments = [...existingAttachments, ...uploadedAttachs];
      if (externalUrl) {
         allAttachments.push({ name: externalUrl.split('/').pop() || 'Đính kèm tự do', url: externalUrl });
      }
      const finalResumeUrl = allAttachments.length > 0 ? JSON.stringify(allAttachments) : '';

      const candidateData: Partial<Candidate> = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        education: formData.education,
        experience_years: formData.experience_years,
        resume_url: finalResumeUrl,
        source: candidate?.source || 'other',
      };
      
      let savedCand;
      if (isEdit) {
        savedCand = await recruitmentService.updateCandidate(candidate.id, candidateData);
      } else {
        savedCand = await recruitmentService.createCandidate(candidateData);
      }

      // 2. Add to job opening if selected (chỉ áp dụng khi tạo mới)
      if (!isEdit && formData.job_opening_id) {
        await recruitmentService.createApplication({
          candidate_id: savedCand.id,
          job_opening_id: formData.job_opening_id,
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error submitting candidate:', error);
      alert(`Đã xảy ra lỗi khi tạo ứng viên: ${error.message || JSON.stringify(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 z-[110] w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {isEdit ? 'Cập nhật Ứng viên' : 'Thêm Ứng viên Mới'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden h-full">
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-slate-900 dark:text-slate-100"
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Trình độ</label>
                <input
                  type="text"
                  value={formData.education}
                  onChange={e => setFormData({ ...formData, education: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 outline-none"
                  placeholder="Đại học..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Số năm kinh nghiệm</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.experience_years}
                  onChange={e => setFormData({ ...formData, experience_years: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>

              <div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 outline-none"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Điện thoại</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 outline-none"
                      placeholder="0912..."
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Hồ sơ / CV (Đính kèm nhiều file)</label>
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0">
                        <Upload size={16} className="text-slate-600 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tải file lên</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          multiple
                          onChange={e => {
                            if (e.target.files?.length) {
                              setResumeFiles(prev => [...prev, ...Array.from(e.target.files as FileList)]);
                            }
                          }}
                        />
                      </label>
                    </div>

                    <div className="space-y-2 mt-2">
                      {existingAttachments.map((att, idx) => (
                        <div key={`existing-${idx}`} className="flex items-center gap-2 flex-1 min-w-0 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-md border border-indigo-100 dark:border-indigo-800/50">
                          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400 truncate">{att.name}</span>
                          <button type="button" onClick={() => setExistingAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 ml-auto"><X size={14}/></button>
                        </div>
                      ))}
                      {resumeFiles.map((f, idx) => (
                        <div key={`new-${idx}`} className="flex items-center gap-2 flex-1 min-w-0 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-md border border-emerald-100 dark:border-emerald-800/50">
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 truncate">{f.name}</span>
                          <button type="button" onClick={() => setResumeFiles(prev => prev.filter((_, i) => i !== idx))} className="text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 ml-auto"><X size={14}/></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-slate-400 dark:text-slate-500 font-medium">
                    <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                    HOẶC GẮN LINK
                    <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                  </div>

                  <input
                    type="url"
                    value={externalUrl}
                    onChange={e => setExternalUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="https://drive.google.com/..."
                  />
                </div>
              </div>

              {!isEdit && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-5 mt-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Ứng tuyển vào Vị trí</label>
                  <select
                    value={formData.job_opening_id}
                    onChange={e => setFormData({ ...formData, job_opening_id: e.target.value })}
                    className="w-full px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100"
                  >
                    <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">(Chỉ lưu Ngân hàng CV, không ứng tuyển)</option>
                    {jobOpenings.map(job => (
                       <option key={job.id} value={job.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">{job.title} - {job.department}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {!isEdit && formData.job_opening_id && (
                <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Ghi chú ứng tuyển</label>
                   <textarea
                     value={formData.notes || ''}
                     onChange={e => setFormData({ ...formData, notes: e.target.value })}
                     className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100"
                     placeholder="Nguồn ứng viên, nhận xét sơ bộ..."
                     rows={3}
                   />
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.full_name}
              className={`flex items-center gap-2 px-5 py-2 font-medium bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer rounded-lg shadow-sm transition-colors ${
                (isSubmitting || !formData.full_name) ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <Save size={18} />
              {isSubmitting ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Thêm Ứng viên')}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default CandidateForm;
