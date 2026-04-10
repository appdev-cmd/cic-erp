import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Briefcase, UploadCloud, CheckCircle2, Building2, MapPin, X, FileText } from 'lucide-react';
import { recruitmentService } from '../../services/recruitmentService';
import { JobOpening } from '../../types/hrmTypes';
import { toast } from 'sonner';

const PublicApplicationForm: React.FC = () => {
  const { id: jobId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [job, setJob] = useState<JobOpening | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    experience_years: 0,
    education: '',
    university: '',
    source: 'website'
  });
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (jobId) {
      loadJobDetails();
    }
  }, [jobId]);

  const loadJobDetails = async () => {
    setIsLoading(true);
    try {
      // Vì là public form, ta cần fetch job_openings trực tiếp qua API
      // Sử dụng recruitmentService hoặc Supabase client (anon role)
      const data = await recruitmentService.getJobOpenings();
      const currentJob = data.find(j => j.id === jobId && j.status === 'open');
      if (currentJob) {
        setJob(currentJob);
      } else {
        toast.error('Không tìm thấy vị trí tuyển dụng này hoặc vị trí đã đóng!');
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      toast.error('Không tải được thông tin vị trí tuyển dụng.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !jobId) return;
    
    if (selectedFiles.length === 0) {
      toast.error('Vui lòng đính kèm ít nhất 1 file CV / Hồ sơ năng lực');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload files
      let uploadedAttachs: any[] = [];
      for (const file of selectedFiles) {
        const url = await recruitmentService.uploadResume(file);
        uploadedAttachs.push({ name: file.name, url });
      }

      // 2. Tao Candidate
      const candidateData: any = {
        ...formData,
        resume_url: JSON.stringify(uploadedAttachs)
      };
      
      const newCandidate = await recruitmentService.createCandidate(candidateData);
      
      if (!newCandidate?.id) {
        throw new Error("Không tạo được hồ sơ ứng viên");
      }

      // 3. Tao Application liên kết Job + Candidate
      await recruitmentService.createApplication({
        candidate_id: newCandidate.id,
        job_opening_id: jobId,
        stage: 'applied'
      });
      
      setIsSuccess(true);
      toast.success('Gửi hồ sơ ứng tuyển thành công!');
    } catch (error) {
      console.error('Lỗi khi nộp hồ sơ:', error);
      toast.error('Đã xảy ra lỗi trong quá trình gửi hồ sơ. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center border border-slate-200">
          <Briefcase className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Vị trí không tồn tại</h2>
          <p className="text-slate-500 mb-6">Xin lỗi, vị trí tuyển dụng này không tồn tại hoặc đã hết hạn ứng tuyển.</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 py-12">
        <div className="text-center w-full max-w-md animate-in zoom-in-95 duration-500">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-10 overflow-hidden relative">
             <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 to-emerald-600" />
             <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-emerald-600" />
             </div>
             <h1 className="text-2xl font-bold text-slate-900 mb-3">Ứng tuyển thành công!</h1>
             <p className="text-slate-600 leading-relaxed mb-6">
               Hồ sơ của bạn đã được gửi đến bộ phận Nhân sự cho vị trí <span className="font-semibold text-slate-900">{job.title}</span>. Chúng tôi sẽ xem xét và phản hồi sớm nhất qua email hoặc số điện thoại bạn đã cung cấp.
             </p>
             <button 
                onClick={() => window.location.href = 'https://cic-group.vn'} 
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 px-4 rounded-xl font-medium transition-colors"
             >
                Trở về trang chủ
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 md:py-12 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto border border-slate-200 rounded-2xl bg-white shadow-xl overflow-hidden animate-in fade-in duration-500">
        <div className="bg-indigo-900 p-8 text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 p-12 opacity-10 blur-xl">
             <Briefcase size={200} />
           </div>
           <div className="relative z-10 w-full">
            <h1 className="text-3xl font-extrabold mb-2 text-white">Ứng tuyển trực tuyến</h1>
            <p className="text-indigo-200">{job.title}</p>
            <div className="flex flex-wrap gap-4 mt-6 text-sm font-medium text-indigo-100">
               <div className="flex items-center gap-1.5 bg-indigo-800/50 px-3 py-1.5 rounded-full border border-indigo-700">
                  <Building2 size={16} /> {job.department || 'Phòng ban nội bộ'}
               </div>
               <div className="flex items-center gap-1.5 bg-indigo-800/50 px-3 py-1.5 rounded-full border border-indigo-700">
                  <Briefcase size={16} /> {job.experience_level === 'fresher' ? 'Mới ra trường' : job.experience_level === 'junior' ? '1-2 năm K.Nghiệm' : job.experience_level === 'mid' ? '3-5 năm K.Nghiệm' : 'Trên 5 năm K.Nghiệm'}
               </div>
            </div>
           </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
               <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-sm">1</span> 
               Thông tin cá nhân
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
               <div className="md:col-span-2">
                 <label className="block text-sm font-semibold text-slate-700 mb-2">Họ và Tên <span className="text-red-500">*</span></label>
                 <input
                   required
                   type="text"
                   autoFocus
                   value={formData.full_name}
                   onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                   className="w-full px-4 py-3 border border-slate-200 bg-slate-50 placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-900"
                   placeholder="Nguyễn Văn A"
                 />
               </div>
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">Email liên hệ <span className="text-red-500">*</span></label>
                 <input
                   required
                   type="email"
                   value={formData.email}
                   onChange={e => setFormData({ ...formData, email: e.target.value })}
                   className="w-full px-4 py-3 border border-slate-200 bg-slate-50 placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-900"
                   placeholder="email@example.com"
                 />
               </div>
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">Số điện thoại <span className="text-red-500">*</span></label>
                 <input
                   required
                   type="tel"
                   value={formData.phone}
                   onChange={e => setFormData({ ...formData, phone: e.target.value })}
                   className="w-full px-4 py-3 border border-slate-200 bg-slate-50 placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-900"
                   placeholder="09xx xxx xxx"
                 />
               </div>
            </div>

            <div className="h-px w-full bg-slate-100 my-8"></div>
            
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
               <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-sm">2</span> 
               Kinh nghiệm & Trình độ
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">Số năm kinh nghiệm</label>
                 <input
                   type="number"
                   min="0"
                   step="0.5"
                   value={formData.experience_years}
                   onChange={e => setFormData({ ...formData, experience_years: parseFloat(e.target.value) || 0 })}
                   className="w-full px-4 py-3 border border-slate-200 bg-slate-50 placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-900"
                 />
               </div>
               <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2">Trình độ học vấn cao nhất</label>
                 <select
                   value={formData.education}
                   onChange={e => setFormData({ ...formData, education: e.target.value })}
                   className="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-900 cursor-pointer"
                 >
                   <option value="">-- Chọn trình độ --</option>
                   <option value="highschool">Trung học phổ thông</option>
                   <option value="college">Cao đẳng</option>
                   <option value="university">Đại học</option>
                   <option value="master">Thạc sĩ</option>
                 </select>
               </div>
               <div className="md:col-span-2">
                 <label className="block text-sm font-semibold text-slate-700 mb-2">Trường đào tạo (Đại học/Cao đẳng)</label>
                 <input
                   type="text"
                   value={formData.university}
                   onChange={e => setFormData({ ...formData, university: e.target.value })}
                   className="w-full px-4 py-3 border border-slate-200 bg-slate-50 placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all text-slate-900"
                   placeholder="VD: Đại học Bách Khoa..."
                 />
               </div>
            </div>

            <div className="h-px w-full bg-slate-100 my-8"></div>
            
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
               <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-sm">3</span> 
               Đính kèm CV <span className="text-red-500">*</span>
            </h3>

            <div>
              <div 
                className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-2xl p-8 text-center cursor-pointer hover:bg-indigo-50 transition-colors group relative"
                onClick={() => document.getElementById('public-file-upload')?.click()}
              >
                <input
                  id="public-file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <UploadCloud size={40} className="mx-auto text-indigo-400 group-hover:text-indigo-600 transition-colors mb-4" />
                <p className="text-sm font-semibold text-indigo-900 mb-1">Bấm để duyệt file từ máy</p>
                <p className="text-xs text-indigo-600/70">Hỗ trợ định dạng PDF, DOCX, Hình ảnh (Tối đa 10MB)</p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 border border-slate-200 bg-white rounded-xl shadow-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
                           <FileText size={18} />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
                          <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeFile(idx)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors shrink-0">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-10">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full flex items-center justify-center py-4 px-8 border border-transparent rounded-xl shadow-sm text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors ${
                  isSubmitting ? 'opacity-75 cursor-wait' : ''
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin mr-3 h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                    Đang nộp hồ sơ...
                  </>
                ) : (
                  'Xác nhận ứng tuyển'
                )}
              </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default PublicApplicationForm;
