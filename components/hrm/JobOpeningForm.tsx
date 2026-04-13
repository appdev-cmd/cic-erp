import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Users, Briefcase, Calendar, Info, Clock, CheckCircle2 } from 'lucide-react';
import { JobOpening } from '../../types/hrmTypes';
import DateInput from '../ui/DateInput';
import { recruitmentService } from '../../services/recruitmentService';
import { UnitService } from '../../services/unitService';
import { EmployeeService } from '../../services/employeeService';
import SearchableSelect from '../ui/SearchableSelect';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import { toast } from 'sonner';
import { generateSlug } from '../../utils/formatters';
import RichTextEditor from '../ui/RichTextEditor';

interface Props {
  job?: JobOpening | null;
  onClose: () => void;
  onSuccess: () => void;
  isInsidePanel?: boolean;
}

const JobOpeningForm: React.FC<Props> = ({ job, onClose, onSuccess, isInsidePanel = false }) => {
  const { lockPanel, unlockPanel, setOnCloseBlocked } = useSlidePanel();
  const [formData, setFormData] = useState<Partial<JobOpening>>(
    job || {
      title: '',
      unit_id: null,
      department: '',
      quantity: 1,
      job_type: 'fulltime',
      experience_level: 'junior',
      status: 'draft',
      priority: 'normal',
      deadline: '',
      description: '',
      requirements: '',
      benefits: '',
      requester_id: null,
      recruiter_id: null,
      interviewer_ids: [],
      is_published_web: false,
      is_featured: false,
      slug: ''
    }
  );

  const [units, setUnits] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'details' | 'personnel'>('info');

  // Load options
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [unitsData, employeesData] = await Promise.all([
          UnitService.getAll(),
          EmployeeService.getAll()
        ]);
        
        setUnits(unitsData.map(u => ({ id: u.id, name: u.name })));
        setEmployees(employeesData.map(e => ({ 
          id: e.id, 
          name: e.name, 
          subText: `${e.position || ''} ${e.department ? `(${e.department})` : ''}` 
        })));
      } catch (error) {
        console.error('Error loading form options:', error);
      } finally {
        setIsLoadingOptions(false);
      }
    };
    loadOptions();
  }, []);

  // Dirty state tracking for SlidePanel
  const initialData = useMemo(() => JSON.stringify(job || {
    title: '',
    unit_id: null,
    department: '',
    quantity: 1,
    job_type: 'fulltime',
    experience_level: 'junior',
    status: 'draft',
    priority: 'normal',
    deadline: '',
    description: '',
    requirements: '',
    benefits: '',
    requester_id: null,
    recruiter_id: null,
    interviewer_ids: [],
    is_published_web: false,
    is_featured: false,
    slug: ''
  }), [job]);

  const isDirty = useMemo(() => JSON.stringify(formData) !== initialData, [formData, initialData]);

  // Auto-generate slug when title changes (only for new job and empty slug)
  useEffect(() => {
    if (!job && formData.title && !formData.slug) {
      setFormData(prev => ({ ...prev, slug: generateSlug(prev.title || '') }));
    }
  }, [formData.title, job, formData.slug]);

  useEffect(() => {
    if (isDirty) {
      lockPanel();
      setOnCloseBlocked(() => {
        if (confirm('Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn đóng?')) {
          unlockPanel();
          onClose();
        }
      });
    } else {
      unlockPanel();
      setOnCloseBlocked(null);
    }
    return () => {
      unlockPanel();
      setOnCloseBlocked(null);
    };
  }, [isDirty, lockPanel, unlockPanel, setOnCloseBlocked, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error('Vui lòng nhập tiêu đề vị trí tuyển dụng');
      return;
    }

    setIsSubmitting(true);
    try {
      if (job?.id) {
        await recruitmentService.updateJobOpening(job.id, formData);
        toast.success('Cập nhật yêu cầu tuyển dụng thành công');
      } else {
        await recruitmentService.createJobOpening(formData);
        toast.success('Tạo yêu cầu tuyển dụng thành công');
      }
      unlockPanel();
      onSuccess();
    } catch (error) {
      console.error('Error submitting job opening:', error);
      toast.error('Đã xảy ra lỗi khi lưu yêu cầu tuyển dụng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInterviewerToggle = (id: string | null) => {
    if (!id) return;
    const current = formData.interviewer_ids || [];
    if (current.includes(id)) {
      setFormData({ ...formData, interviewer_ids: current.filter(i => i !== id) });
    } else {
      setFormData({ ...formData, interviewer_ids: [...current, id] });
    }
  };

  const interviewerNames = (formData.interviewer_ids || []).map(id => {
    const emp = employees.find(e => e.id === id);
    return emp ? emp.name : id;
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'info':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Tiêu đề / Vị trí <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-900 dark:text-white font-medium"
                  placeholder="VD: Chuyên viên Kinh doanh"
                />
              </div>

              <div>
                <SearchableSelect
                  label="Đơn vị / Phòng ban"
                  value={formData.unit_id}
                  onChange={(id, opt) => setFormData({ ...formData, unit_id: id, department: opt?.name || '' })}
                  placeholder="Chọn đơn vị..."
                  onSearch={async (q) => units.filter(u => u.name.toLowerCase().includes(q.toLowerCase()))}
                  initialOptions={units}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Số lượng cần tuyển</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Hình thức làm việc</label>
                <select
                  value={formData.job_type}
                  onChange={e => setFormData({ ...formData, job_type: e.target.value as any })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-slate-900 dark:text-white font-medium cursor-pointer"
                >
                  <option value="fulltime">Toàn thời gian (Full-time)</option>
                  <option value="parttime">Bán thời gian (Part-time)</option>
                  <option value="intern">Thực tập sinh (Intern)</option>
                  <option value="contract">Hợp đồng khoán (Contract)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Cấp bậc / Kinh nghiệm</label>
                <select
                  value={formData.experience_level}
                  onChange={e => setFormData({ ...formData, experience_level: e.target.value as any })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-slate-900 dark:text-white font-medium cursor-pointer"
                >
                  <option value="fresher">Fresher / Mới ra trường</option>
                  <option value="junior">Junior (1-2 năm)</option>
                  <option value="mid">Middle (3-5 năm)</option>
                  <option value="senior">Senior (5+ năm)</option>
                  <option value="lead">Lead / Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Hạn chót (Deadline)</label>
                <DateInput
                  value={formData.deadline || ''}
                  onChange={val => setFormData({ ...formData, deadline: val })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Ưu tiên</label>
                <select
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-slate-900 dark:text-white font-medium cursor-pointer"
                >
                  <option value="normal">Bình thường</option>
                  <option value="high">Cao</option>
                  <option value="urgent">Khẩn cấp</option>
                  <option value="low">Thấp</option>
                </select>
              </div>

              {/* Web Publishing Section */}
              <div className="md:col-span-2 p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-4">Thông tin xuất bản Website</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Đường dẫn tĩnh (Slug)</label>
                    <input
                      type="text"
                      value={formData.slug || ''}
                      onChange={e => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="VD: chuyen-vien-kinh-doanh"
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-6 mt-8">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_published_web || false}
                        onChange={e => setFormData({ ...formData, is_published_web: e.target.checked })}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Hiển thị trên Web</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_featured || false}
                        onChange={e => setFormData({ ...formData, is_featured: e.target.checked })}
                        className="w-4 h-4 text-orange-500 rounded border-slate-300"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tin tuyển dụng nổi bật</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'details':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <RichTextEditor
                label="Mô tả công việc"
                value={formData.description || ''}
                onChange={val => setFormData({ ...formData, description: val })}
                minHeight="150px"
              />
            </div>
            <div>
              <RichTextEditor
                label="Yêu cầu ứng viên"
                value={formData.requirements || ''}
                onChange={val => setFormData({ ...formData, requirements: val })}
                minHeight="150px"
              />
            </div>
            <div>
              <RichTextEditor
                label="Quyền lợi"
                value={formData.benefits || ''}
                onChange={val => setFormData({ ...formData, benefits: val })}
                minHeight="150px"
              />
            </div>
          </div>
        );
      case 'personnel':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SearchableSelect
                label="Trưởng phòng yêu cầu"
                value={formData.requester_id}
                onChange={(id) => setFormData({ ...formData, requester_id: id })}
                onSearch={async (q) => employees.filter(e => e.name.toLowerCase().includes(q.toLowerCase()))}
                initialOptions={employees.slice(0, 50)}
              />
              <SearchableSelect
                label="HR phụ trách"
                value={formData.recruiter_id}
                onChange={(id) => setFormData({ ...formData, recruiter_id: id })}
                onSearch={async (q) => employees.filter(e => e.name.toLowerCase().includes(q.toLowerCase()))}
                initialOptions={employees.slice(0, 50)}
              />
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Hội đồng phỏng vấn (Tag nhân sự)</label>
              <SearchableSelect
                placeholder="Thêm người phỏng vấn..."
                value={null}
                onChange={(id) => handleInterviewerToggle(id)}
                onSearch={async (q) => employees.filter(e => e.name.toLowerCase().includes(q.toLowerCase()))}
                initialOptions={employees.slice(0, 50)}
              />
              <div className="flex flex-wrap gap-2 pt-2">
                {(formData.interviewer_ids || []).map(id => {
                  const emp = employees.find(e => e.id === id);
                  return (
                    <div key={id} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium border border-indigo-100 dark:border-indigo-800 group transition-all animate-in zoom-in-90">
                      <Users size={14} />
                      {emp?.name || id}
                      <button 
                        type="button" 
                        onClick={() => handleInterviewerToggle(id)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
                {(formData.interviewer_ids || []).length === 0 && (
                  <p className="text-sm text-slate-400 italic">Chưa có người phỏng vấn nào được tag.</p>
                )}
              </div>
            </div>
          </div>
        );
    }
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 px-6 pt-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('info')}
          className={`px-4 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'info' 
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <Info size={16} /> Thông tin chung
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`px-4 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'details' 
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <Briefcase size={16} /> Mô tả & Yêu cầu
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('personnel')}
          className={`px-4 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'personnel' 
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' 
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <Users size={16} /> Phụ trách & Phỏng vấn
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {renderContent()}
      </div>

      <div className="p-6 bg-white dark:bg-slate-900 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
        <div>
           {isDirty && (
             <span className="text-xs text-amber-500 font-medium flex items-center gap-1.5 animate-pulse">
                <Clock size={12} /> Có thay đổi chưa lưu
             </span>
           )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`flex items-center gap-2 px-8 py-2.5 font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            <Save size={18} />
            {isSubmitting ? 'Đang lưu...' : (job ? 'Cập nhật' : 'Gửi Yêu cầu')}
          </button>
        </div>
      </div>
    </form>
  );

  if (isInsidePanel) {
    return formContent;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-white dark:bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
              <Plus className="text-indigo-600 dark:text-indigo-400" size={20} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {job ? 'Cập nhật Vị trí Tuyển dụng' : 'Tạo Yêu cầu Tuyển dụng Mới'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {formContent}
      </div>
    </div>
  );
};

export default JobOpeningForm;
