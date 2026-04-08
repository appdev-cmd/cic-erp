import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { JobOpening } from '../../types/hrmTypes';
import DateInput from '../ui/DateInput';
import { recruitmentService } from '../../services/recruitmentService';

interface Props {
  job?: JobOpening | null;
  onClose: () => void;
  onSuccess: () => void;
}

const JobOpeningForm: React.FC<Props> = ({ job, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<Partial<JobOpening>>(
    job || {
      title: '',
      department: '',
      quantity: 1,
      job_type: 'fulltime',
      experience_level: 'junior',
      status: 'draft',
      priority: 'normal',
      deadline: ''
    }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (job?.id) {
        await recruitmentService.updateJobOpening(job.id, formData);
      } else {
        await recruitmentService.createJobOpening(formData);
      }
      onSuccess();
    } catch (error) {
      console.error('Error submitting job opening:', error);
      alert('Đã xảy ra lỗi khi lưu yêu cầu tuyển dụng');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {job ? 'Cập nhật Vị trí Tuyển dụng' : 'Tạo Vị trí Tuyển dụng Mới'}
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
                  Tiêu đề / Vị trí <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-slate-900 dark:text-slate-100"
                  placeholder="VD: Chuyên viên Kinh doanh"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Phòng ban</label>
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={e => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Số lượng cần tuyển</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Trạng thái</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
                >
                  <option value="draft">Bản nháp (Draft)</option>
                  <option value="open">Đang mở tuyển (Open)</option>
                  <option value="on_hold">Tạm dừng (Hold)</option>
                  <option value="closed">Đã đóng (Closed)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Hạn chót (Deadline)</label>
                <DateInput
                  value={formData.deadline || ''}
                  onChange={val => setFormData({ ...formData, deadline: val })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100"
                />
              </div>
              
              <div className="md:col-span-2">
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Yêu cầu công việc</label>
                 <textarea
                   value={formData.requirements || ''}
                   onChange={e => setFormData({ ...formData, requirements: e.target.value })}
                   className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100 min-h-[120px] resize-y"
                   placeholder="Mô tả kỹ năng, bằng cấp..."
                 />
              </div>
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
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-5 py-2 font-medium bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer rounded-lg shadow-sm transition-colors ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              <Save size={18} />
              {isSubmitting ? 'Đang lưu...' : (job ? 'Cập nhật' : 'Tạo Yêu cầu')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobOpeningForm;
