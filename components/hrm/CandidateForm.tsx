import React, { useState } from 'react';
import { X, Save, Upload } from 'lucide-react';
import { recruitmentService } from '../../services/recruitmentService';
import { Candidate, JobOpening } from '../../types/hrmTypes';

interface Props {
  jobOpenings: JobOpening[];
  preSelectedJobId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CandidateForm: React.FC<Props> = ({ jobOpenings, preSelectedJobId, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    education: '',
    experience_years: 0,
    job_opening_id: preSelectedJobId || '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 1. Create candidate
      const candidate: Partial<Candidate> = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        education: formData.education,
        experience_years: formData.experience_years,
        source: 'other',
      };
      
      const newCand = await recruitmentService.createCandidate(candidate);

      // 2. Add to job opening if selected
      if (formData.job_opening_id) {
        await recruitmentService.createApplication({
          candidate_id: newCand.id,
          job_opening_id: formData.job_opening_id,
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error submitting candidate:', error);
      alert('Đã xảy ra lỗi khi tạo ứng viên');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Thêm Ứng viên Mới
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden h-full">
          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
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
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
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
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="md:col-span-2">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Điện thoại</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100"
                      placeholder="0912..."
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-5 mt-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Ứng tuyển vào Vị trí</label>
                <select
                  value={formData.job_opening_id}
                  onChange={e => setFormData({ ...formData, job_opening_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100"
                >
                  <option value="">(Chỉ lưu Ngân hàng CV, không ứng tuyển)</option>
                  {jobOpenings.map(job => (
                     <option key={job.id} value={job.id}>{job.title} - {job.department}</option>
                  ))}
                </select>
              </div>
              
              {formData.job_opening_id && (
                <div className="md:col-span-2">
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Ghi chú ứng tuyển</label>
                   <textarea
                     value={formData.notes || ''}
                     onChange={e => setFormData({ ...formData, notes: e.target.value })}
                     className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100"
                     placeholder="Nguồn ứng viên, nhận xét sơ bộ..."
                     rows={2}
                   />
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
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
              {isSubmitting ? 'Đang lưu...' : 'Thêm Ứng viên'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CandidateForm;
