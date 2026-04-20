import React, { useState } from 'react';
import {
  Globe, Search, Star, Eye, EyeOff, Save, Loader2, FolderOpen,
  ExternalLink, CheckCircle2, Tag, Info, Link2, FileText, BarChart2,
} from 'lucide-react';
import { BIMProject } from '../../types';
import { ProjectService } from '../../services';
import { toast } from 'sonner';

interface ProjectWebTabProps {
  project: BIMProject;
  onUpdate: (updated: BIMProject) => void;
}

/* ── Google SERP Preview ────────────────────────────────── */
const SerpPreview = ({ slug, title, description }: { slug: string; title: string; description: string }) => {
  const url = `cic.com.vn/du-an/${slug || 'ten-du-an'}`;
  const displayTitle = title || 'Tiêu đề dự án';
  const displayDesc = description || 'Mô tả ngắn gọn về dự án sẽ hiển thị tại đây trên kết quả tìm kiếm Google...';

  return (
    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-1.5 font-['Arial',sans-serif]">
      <p className="text-[12px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
        <Search size={12} />
        Xem trước kết quả tìm kiếm Google
      </p>
      <div className="space-y-0.5 mt-3">
        <p className="text-[12px] text-slate-500 dark:text-slate-400">{url}</p>
        <h4 className="text-[18px] text-blue-700 dark:text-blue-400 hover:underline cursor-pointer leading-snug line-clamp-1">
          {displayTitle}
        </h4>
        <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
          {displayDesc}
        </p>
      </div>
      <div className="pt-2 flex items-center gap-2">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${(title?.length || 0) > 60
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
          }`}>
          Tiêu đề: {title?.length || 0}/60 ký tự
        </span>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${(description?.length || 0) > 160
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
          }`}>
          Mô tả: {description?.length || 0}/160 ký tự
        </span>
      </div>
    </div>
  );
};

/* ── Toggle Switch ──────────────────────────────────────── */
const Toggle = ({
  checked, onChange, label, description, icon, activeColor = 'bg-indigo-500',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  icon: React.ReactNode;
  activeColor?: string;
}) => (
  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${checked ? `${activeColor} text-white` : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'} transition-colors`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{label}</p>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
      </div>
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${checked ? activeColor : 'bg-slate-300 dark:bg-slate-600'
        }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'
          }`}
      />
    </button>
  </div>
);

/* ── Input Field ─────────────────────────────────────────── */
const inputCls = 'w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all';
const labelCls = 'block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5';

/* ── Main Component ─────────────────────────────────────── */
const ProjectWebTab: React.FC<ProjectWebTabProps> = ({ project, onUpdate }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    slug: project.slug || '',
    seoTitle: project.seoTitle || '',
    seoDescription: project.seoDescription || '',
    webCategory: project.webCategory || '',
    webClientName: project.webClientName || '',
    webStats: project.webStats || '',
    isPublishedWeb: project.isPublishedWeb ?? false,
    isFeaturedWeb: project.isFeaturedWeb ?? false,
  });

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Auto-generate slug from name if empty
      const slug = form.slug || project.name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const updated = await ProjectService.update(project.id, {
        slug,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
        webCategory: form.webCategory,
        webClientName: form.webClientName,
        webStats: form.webStats,
        isPublishedWeb: form.isPublishedWeb,
        isFeaturedWeb: form.isFeaturedWeb,
      });
      if (slug !== form.slug) setForm(prev => ({ ...prev, slug }));
      onUpdate(updated);
      toast.success('Đã lưu thông tin Web thành công!');
    } catch (err: any) {
      toast.error('Lỗi lưu thông tin: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-400">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Globe size={20} className="text-indigo-500" />
            Hồ sơ & Web
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Cấu hình SEO và trạng thái hiển thị dự án trên website cic.com.vn
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60 transition-all shadow-sm"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>

      {/* ── Published Status Banner ── */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${form.isPublishedWeb
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
        }`}>
        {form.isPublishedWeb
          ? <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          : <EyeOff size={18} className="text-slate-400 shrink-0" />
        }
        <div>
          <p className={`text-sm font-bold ${form.isPublishedWeb ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
            }`}>
            {form.isPublishedWeb ? 'Đang hiển thị trên website' : 'Chưa xuất bản lên website'}
          </p>
          {form.isPublishedWeb && form.slug && (
            <a
              href={`https://cic.com.vn/du-an/${form.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 mt-0.5"
            >
              cic.com.vn/du-an/{form.slug}
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left Column: Settings ── */}
        <div className="space-y-6">

          {/* Publish Toggles */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
              Trạng thái xuất bản
            </h3>
            <Toggle
              checked={form.isPublishedWeb}
              onChange={v => set('isPublishedWeb', v)}
              label="Xuất bản lên Website"
              description="Hiển thị dự án công khai trên cic.com.vn"
              icon={<Eye size={15} />}
              activeColor="bg-emerald-500"
            />
            <Toggle
              checked={form.isFeaturedWeb}
              onChange={v => set('isFeaturedWeb', v)}
              label="Dự án Nổi bật"
              description="Hiển thị ở vị trí đầu trang chủ và trang danh mục"
              icon={<Star size={15} />}
              activeColor="bg-amber-500"
            />
          </div>

          {/* URL & Category */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Đường dẫn & Phân loại
            </h3>

            <div>
              <label className={labelCls}>
                <Link2 size={10} className="inline mr-1" />
                URL Slug
              </label>
              <div className="flex items-center gap-0">
                <span className="px-3 py-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-r-0 border-slate-200 dark:border-slate-700 rounded-l-lg whitespace-nowrap">
                  /du-an/
                </span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                  placeholder="ten-du-an-cua-ban"
                  className={`${inputCls} rounded-l-none`}
                />
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Để trống để tự động tạo từ tên dự án
              </p>
            </div>

            <div>
              <label className={labelCls}>
                <Tag size={10} className="inline mr-1" />
                Danh mục Web
              </label>
              <select
                value={form.webCategory}
                onChange={e => set('webCategory', e.target.value)}
                className={inputCls}
              >
                <option value="">-- Chọn danh mục --</option>
                <option value="bim">BIM & Mô hình hóa</option>
                <option value="giao-thong">Giao thông - Hạ tầng</option>
                <option value="dan-dung">Nhà ở - Dân dụng</option>
                <option value="cong-nghiep">Công nghiệp</option>
                <option value="do-thi">Quy hoạch đô thị</option>
                <option value="cong-trinh-ngam">Công trình ngầm</option>
                <option value="khac">Khác</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>
                <Info size={10} className="inline mr-1" />
                Tên Khách hàng (hiển thị Web)
              </label>
              <input
                type="text"
                value={form.webClientName}
                onChange={e => set('webClientName', e.target.value)}
                placeholder="VD: Ban QLDA Đầu tư xây dựng..."
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>
                <BarChart2 size={10} className="inline mr-1" />
                Thông số nổi bật (Web Stats)
              </label>
              <input
                type="text"
                value={form.webStats}
                onChange={e => set('webStats', e.target.value)}
                placeholder="VD: 50,000 m² • 24 tháng • 150 tỷ VNĐ"
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Hiển thị như badge thống kê trên card dự án
              </p>
            </div>
          </div>

          {/* Folder Links */}
          {(project.folderPotentialUrl || project.folderOngoingUrl) && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                Thư mục Hồ sơ
              </h3>
              {project.folderPotentialUrl && (
                <a
                  href={project.folderPotentialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-600 transition-all group"
                >
                  <FolderOpen size={16} className="text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Hồ sơ Tiền dự án</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{project.folderPotentialUrl}</p>
                  </div>
                  <ExternalLink size={13} className="text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0" />
                </a>
              )}
              {project.folderOngoingUrl && (
                <a
                  href={project.folderOngoingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-600 transition-all group"
                >
                  <FolderOpen size={16} className="text-indigo-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Hồ sơ Triển khai</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{project.folderOngoingUrl}</p>
                  </div>
                  <ExternalLink size={13} className="text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Right Column: SEO ── */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Cấu hình SEO
            </h3>

            <div>
              <label className={labelCls}>
                <FileText size={10} className="inline mr-1" />
                Meta Title (Tiêu đề SEO)
              </label>
              <input
                type="text"
                value={form.seoTitle}
                onChange={e => set('seoTitle', e.target.value)}
                placeholder="VD: Dự án BIM Cầu Thủ Thiêm 2 - CIC"
                className={`${inputCls} ${(form.seoTitle?.length || 0) > 60 ? 'border-amber-400 dark:border-amber-600 focus:ring-amber-500' : ''}`}
                maxLength={80}
              />
            </div>

            <div>
              <label className={labelCls}>
                <FileText size={10} className="inline mr-1" />
                Meta Description (Mô tả SEO)
              </label>
              <textarea
                value={form.seoDescription}
                onChange={e => set('seoDescription', e.target.value)}
                placeholder="VD: CIC cung cấp dịch vụ tư vấn BIM chuyên sâu cho dự án cầu Thủ Thiêm 2, TP.HCM..."
                className={`${inputCls} resize-none h-28 ${(form.seoDescription?.length || 0) > 160 ? 'border-amber-400 dark:border-amber-600 focus:ring-amber-500' : ''}`}
                maxLength={200}
              />
            </div>

            {/* SERP Preview */}
            <SerpPreview
              slug={form.slug}
              title={form.seoTitle || project.name}
              description={form.seoDescription || project.description || ''}
            />
          </div>

          {/* Tips */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              💡 Tips tối ưu SEO
            </h4>
            <ul className="space-y-1.5">
              {[
                'Meta Title nên từ 50–60 ký tự, chứa từ khóa chính',
                'Meta Description nên từ 120–160 ký tự, hấp dẫn người đọc',
                'Slug URL dùng chữ thường, dấu gạch ngang, không dấu tiếng Việt',
                'Bật "Nổi bật" để hiển thị ở vị trí đầu trang chủ',
              ].map((tip, i) => (
                <li key={i} className="text-[12px] text-indigo-700 dark:text-indigo-400 flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectWebTab;
