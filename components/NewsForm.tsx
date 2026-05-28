import React, { useState, useEffect } from 'react';
import { Save, Loader2, RefreshCw, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import Modal from './ui/Modal';
import RichTextEditor from './ui/RichTextEditor';
import { NewsPost, PostStatus, PostCategory } from '../types/news';
import { generateSlug } from '../utils/formatters';
import { NewsService } from '../services/newsService';
import { useEffectiveProfile } from '../contexts/ImpersonationContext';

interface NewsFormProps {
    isOpen?: boolean;
    onClose: () => void;
    onSave: (data: Partial<NewsPost>, id?: string) => Promise<void>;
    post?: NewsPost;
    isInsidePanel?: boolean;
}

const NewsForm: React.FC<NewsFormProps> = ({ isOpen, onClose, onSave, post, isInsidePanel }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { profile: effectiveProfile } = useEffectiveProfile();
    // Impersonation-aware role check
    const hasEffectiveRole = (roles: string[]) => roles.includes(effectiveProfile?.role || '');
    const [categories, setCategories] = useState<PostCategory[]>([]);
    const [formData, setFormData] = useState({
        titleVi: '',
        slug: '',
        categoryId: '',
        excerptVi: '',
        contentVi: '',
        status: (hasEffectiveRole(['Admin', 'Marketing', 'Leadership']) ? 'draft' : 'pending_approval') as PostStatus,
        isFeatured: false,
        seoTitleVi: '',
        seoDescriptionVi: '',
        thumbnailUrl: '',
        tags: [] as string[],
    });

    const [isAutoSlug, setIsAutoSlug] = useState(true);
    const [isLoadingPost, setIsLoadingPost] = useState(false);
    const [tagInput, setTagInput] = useState('');

    const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const tag = tagInput.trim();
            if (tag && !formData.tags.includes(tag)) {
                setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
            }
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
    };


    // Initialize form data
    useEffect(() => {
        NewsService.getCategories().then(setCategories).catch(console.error);
        if (post) {
            setFormData({
                titleVi: post.titleVi || '',
                slug: post.slug || '',
                categoryId: post.categoryId || '',
                excerptVi: post.excerptVi || '',
                contentVi: post.contentVi || '',
                status: post.status,
                isFeatured: post.isFeatured || false,
                seoTitleVi: post.seoTitleVi || '',
                seoDescriptionVi: post.seoDescriptionVi || '',
                thumbnailUrl: post.thumbnailUrl || '',
                tags: post.tags || [],
            });
            setIsAutoSlug(false); // Don't auto-generate slug for existing posts unless user wants to
            
            // Fetch full post to get the content if we only have the partial list view
            if (post.id && !post.contentVi) {
                setIsLoadingPost(true);
                NewsService.getById(post.id).then(fullPost => {
                    if (fullPost && fullPost.contentVi) {
                        setFormData(prev => ({
                            ...prev,
                            contentVi: fullPost.contentVi || prev.contentVi,
                            excerptVi: fullPost.excerptVi || prev.excerptVi
                        }));
                    }
                }).catch(console.error).finally(() => {
                    setIsLoadingPost(false);
                });
            }
        } else {
            setFormData({
                titleVi: '',
                slug: '',
                categoryId: '',
                excerptVi: '',
                contentVi: '',
                status: 'draft',
                isFeatured: false,
                seoTitleVi: '',
                seoDescriptionVi: '',
                thumbnailUrl: '',
                tags: [],
            });
            setIsAutoSlug(true);
        }
    }, [post, isOpen]);

    // Auto-generate slug when title changes
    useEffect(() => {
        if (isAutoSlug && formData.titleVi) {
            setFormData(prev => ({ ...prev, slug: generateSlug(formData.titleVi) }));
        }
    }, [formData.titleVi, isAutoSlug]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.titleVi.trim()) {
            toast.error('Vui lòng nhập tiêu đề bài viết!');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSave(formData, post?.id);
            // Form is closed by parent on success
        } catch (error) {
            console.error('Error saving news post:', error);
            // Toast is handled by parent or here if preferred
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGenerateSlug = () => {
        if (formData.titleVi) {
            setFormData(prev => ({ ...prev, slug: generateSlug(formData.titleVi) }));
            setIsAutoSlug(true);
            toast.success('Đã tạo lại đường dẫn tĩnh.');
        } else {
            toast.error('Vui lòng nhập tiêu đề trước khi tạo đường dẫn tĩnh.');
        }
    };

    const formContent = (
        <form onSubmit={handleSubmit} className={isInsidePanel ? "flex flex-col h-full bg-white dark:bg-slate-900" : "space-y-6"}>
            <div className={isInsidePanel ? "flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50" : "space-y-6"}>
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left Column - Main Content */}
                    <div className="flex-1 min-w-0 space-y-6">
                        {/* Title & Slug */}
                        <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                    Tiêu đề bài viết <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.titleVi}
                                    onChange={(e) => setFormData(prev => ({ ...prev, titleVi: e.target.value }))}
                                    placeholder="Nhập tiêu đề bài viết..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[15px] transition-colors text-slate-800 dark:text-slate-200 font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                    Đường dẫn tĩnh (Slug) <span className="text-rose-500">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        required
                                        value={formData.slug}
                                        onChange={(e) => {
                                            setFormData(prev => ({ ...prev, slug: e.target.value }));
                                            setIsAutoSlug(false);
                                        }}
                                        placeholder="tu-dong-tao-tu-tieu-de"
                                        className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-sm text-slate-800 dark:text-slate-200 font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleGenerateSlug}
                                        title="Tạo tự động từ tiêu đề"
                                        className="p-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                                    >
                                        <RefreshCw size={16} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                    Tóm tắt ngắn gọn
                                </label>
                                <textarea
                                    value={formData.excerptVi}
                                    onChange={(e) => setFormData(prev => ({ ...prev, excerptVi: e.target.value }))}
                                    placeholder="Mô tả ngắn gọn về bài viết để hiển thị trên danh sách..."
                                    rows={3}
                                    maxLength={300}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200 resize-none"
                                />
                                <div className="flex justify-end mt-1 text-[10px] text-slate-500">
                                    <span className={formData.excerptVi.length > 280 ? 'text-amber-500 font-medium' : ''}>
                                        {formData.excerptVi.length}/300
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Editor */}
                        <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                            <RichTextEditor
                                label="Nội dung bài viết"
                                value={formData.contentVi}
                                onChange={(val) => setFormData(prev => ({ ...prev, contentVi: val }))}
                                minHeight="450px"
                            />
                        </div>
                    </div>

                    {/* Right Column - Settings & Meta */}
                    <div className="w-full lg:w-[340px] shrink-0 space-y-6">
                        {/* Publish Settings */}
                        <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700 pb-2">
                                Đăng tải & Phân loại
                            </h3>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                    Trạng thái
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as PostStatus }))}
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors font-bold ${
                                        formData.status === 'published' 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' 
                                            : formData.status === 'approved'
                                                ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800'
                                                : formData.status === 'pending_approval'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                                                    : formData.status === 'draft'
                                                        ? 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'
                                                        : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'
                                    }`}
                                >
                                    {!hasEffectiveRole(['Admin', 'Marketing', 'Leadership']) && (
                                        <option value="pending_approval">Chờ duyệt (Chỉ BGD duyệt)</option>
                                    )}
                                    {hasEffectiveRole(['Admin', 'Marketing', 'Leadership']) && (
                                        <>
                                            <option value="draft">Bản nháp (Chưa hiển thị)</option>
                                            <option value="pending_approval">Chờ duyệt (Chỉ BGD duyệt)</option>
                                            <option value="approved" disabled={!hasEffectiveRole(['Admin', 'Leadership'])}>Đã duyệt (Chờ đăng)</option>
                                            <option value="published" disabled={!hasEffectiveRole(['Admin', 'Marketing'])}>Xuất bản (Hiện Web)</option>
                                            <option value="archived">Lưu trữ</option>
                                        </>
                                    )}
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                    Chuyên mục
                                </label>
                                <select
                                    value={formData.categoryId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200"
                                >
                                    <option value="">-- Chọn chuyên mục --</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.nameVi}</option>
                                    ))}
                                </select>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer pt-2 group">
                                <input
                                    type="checkbox"
                                    checked={formData.isFeatured}
                                    onChange={e => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                                    className="w-4 h-4 text-orange-500 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-900 focus:ring-orange-500"
                                />
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">Đánh dấu Nổi bật</span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Ưu tiên hiển thị trên trang chủ</span>
                                </div>
                            </label>
                        </div>

                        {/* Media Settings */}
                        <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700 pb-2">
                                Ảnh đại diện
                            </h3>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                    URL hoặc Đường dẫn nội bộ
                                </label>
                                <input
                                    type="text"
                                    value={formData.thumbnailUrl}
                                    onChange={(e) => setFormData(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
                                    placeholder="VD: /images/news/abc.jpg"
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                                />
                            </div>
                            {formData.thumbnailUrl ? (
                                <div className="w-full aspect-video bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden flex items-center justify-center relative group">
                                    <img 
                                        src={formData.thumbnailUrl} 
                                        alt="Thumbnail Preview" 
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData(prev => ({ ...prev, thumbnailUrl: '' }))}
                                        className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"
                                        title="Xóa ảnh"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full aspect-video bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                                    <ImageIcon className="mb-2 opacity-50" size={24} />
                                    <span className="text-xs font-medium">Chưa có ảnh</span>
                                </div>
                            )}
                        </div>

                        {/* Search & Tags */}
                        <div className="p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700 pb-2">
                                Khám phá & SEO
                            </h3>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                    Từ khóa (Tags)
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {formData.tags.map(tag => (
                                        <span key={tag} className="flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-medium border border-indigo-200 dark:border-indigo-800">
                                            {tag}
                                            <button type="button" onClick={() => removeTag(tag)} className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200">
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleAddTag}
                                    placeholder="Nhập từ khóa và nhấn Enter..."
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                                />
                            </div>

                            <div className="pt-2">
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                    SEO Title
                                </label>
                                <input
                                    type="text"
                                    value={formData.seoTitleVi}
                                    onChange={(e) => setFormData(prev => ({ ...prev, seoTitleVi: e.target.value }))}
                                    placeholder={formData.titleVi || "Tiêu đề hiển thị Google..."}
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                    SEO Description
                                </label>
                                <textarea
                                    value={formData.seoDescriptionVi}
                                    onChange={(e) => setFormData(prev => ({ ...prev, seoDescriptionVi: e.target.value }))}
                                    placeholder={formData.excerptVi || "Mô tả SEO..."}
                                    rows={3}
                                    maxLength={160}
                                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-sm text-slate-800 dark:text-slate-200 resize-none"
                                />
                                <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500">
                                    <span>Tối ưu: ~150 ký tự</span>
                                    <span className={formData.seoDescriptionVi.length > 155 ? 'text-amber-500 font-bold' : ''}>
                                        {formData.seoDescriptionVi.length}/160
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className={`flex justify-end gap-3 shrink-0 ${isInsidePanel ? 'shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.1)] dark:shadow-none p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900' : 'pt-6 border-t border-slate-200 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 z-10 w-[calc(100%+3rem)] -mx-6 px-6 pb-2'}`}>
                <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                    Hủy bỏ
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {post ? 'Cập nhật bài viết' : 'Lưu bài viết'}
                </button>
            </div>
        </form>
    );

    if (isInsidePanel) {
        return formContent;
    }

    return (
        <Modal 
            isOpen={isOpen!} 
            onClose={onClose} 
            title={post ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới'} 
            size="lg"
        >
            {formContent}
        </Modal>
    );
};

export default NewsForm;
