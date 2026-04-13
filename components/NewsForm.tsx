import React, { useState, useEffect } from 'react';
import { Save, Loader2, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import Modal from './ui/Modal';
import RichTextEditor from './ui/RichTextEditor';
import { NewsPost, PostStatus, PostCategory } from '../types/news';
import { generateSlug } from '../utils/formatters';
import { NewsService } from '../services/newsService';

interface NewsFormProps {
    isOpen?: boolean;
    onClose: () => void;
    onSave: (data: Partial<NewsPost>, id?: string) => Promise<void>;
    post?: NewsPost;
    isInsidePanel?: boolean;
}

const NewsForm: React.FC<NewsFormProps> = ({ isOpen, onClose, onSave, post, isInsidePanel }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [categories, setCategories] = useState<PostCategory[]>([]);
    const [formData, setFormData] = useState({
        titleVi: '',
        slug: '',
        categoryId: '',
        excerptVi: '',
        contentVi: '',
        status: 'draft' as PostStatus,
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
            <div className={isInsidePanel ? "flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" : "space-y-6"}>
                
                {/* Header Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Tiêu đề bài viết *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.titleVi}
                            onChange={(e) => setFormData(prev => ({ ...prev, titleVi: e.target.value }))}
                            placeholder="Nhập tiêu đề bài viết..."
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200 font-bold"
                        />
                    </div>
                    
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Đường dẫn tĩnh (Slug) *
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
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 font-mono"
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
                            Chuyên mục
                        </label>
                        <select
                            value={formData.categoryId}
                            onChange={(e) => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200"
                        >
                            <option value="">-- Chọn chuyên mục --</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.nameVi}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Trạng thái xuất bản
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as PostStatus }))}
                            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors font-bold ${
                                formData.status === 'published' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800' 
                                    : formData.status === 'draft'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-800'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}
                        >
                            <option value="draft">Bản nháp (Chưa hiển thị)</option>
                            <option value="published">Đã xuất bản (Hiển thị ngay)</option>
                            <option value="archived">Lưu trữ</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Ảnh đại diện (URL)
                        </label>
                        <div className="flex flex-col md:flex-row gap-4">
                            <input
                                type="url"
                                value={formData.thumbnailUrl}
                                onChange={(e) => setFormData(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
                                placeholder="https://example.com/image.jpg"
                                className="flex-1 px-4 py-2 h-10 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                            />
                            {formData.thumbnailUrl && (
                                <div className="shrink-0 w-full md:w-32 h-32 md:h-20 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded overflow-hidden flex items-center justify-center">
                                    <img 
                                        src={formData.thumbnailUrl} 
                                        alt="Thumbnail Preview" 
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="md:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer mt-2 p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.isFeatured}
                                onChange={e => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                                className="w-4 h-4 text-orange-500 rounded border-slate-300"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Đánh dấu Nổi bật</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Bài viết sẽ hiển thị ở khu vực ưu tiên hoặc Slide chính.</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Content Section */}
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Từ khóa / Tags
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {formData.tags.map(tag => (
                                <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-medium border border-indigo-200 dark:border-indigo-800">
                                    {tag}
                                    <button type="button" onClick={() => removeTag(tag)} className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200"><X size={12} /></button>
                                </span>
                            ))}
                        </div>
                        <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleAddTag}
                            placeholder="Nhập từ khóa và nhấn Enter..."
                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Nhấn Enter hoặc Dấu phẩy (,) để thêm từ khóa mới.</p>
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
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200 resize-none"
                        />
                    </div>

                    <div>
                        <RichTextEditor
                            label="Nội dung bài viết"
                            value={formData.contentVi}
                            onChange={(val) => setFormData(prev => ({ ...prev, contentVi: val }))}
                            minHeight="450px"
                        />
                    </div>
                </div>

                {/* SEO Configuration */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 pb-2">
                        Tối ưu hóa SEO (Google)
                    </h3>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                            SEO Title (Thẻ tiêu đề SEO)
                        </label>
                        <input
                            type="text"
                            value={formData.seoTitleVi}
                            onChange={(e) => setFormData(prev => ({ ...prev, seoTitleVi: e.target.value }))}
                            placeholder={formData.titleVi || "Nhập tiêu đề hiển thị trên Google..."}
                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">Tối ưu: 50-60 ký tự.</span>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                            SEO Description (Thẻ mô tả SEO)
                        </label>
                        <textarea
                            value={formData.seoDescriptionVi}
                            onChange={(e) => setFormData(prev => ({ ...prev, seoDescriptionVi: e.target.value }))}
                            placeholder={formData.excerptVi || "Nhập mô tả hiển thị trên Google..."}
                            rows={2}
                            maxLength={160}
                            className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 resize-none"
                        />
                        <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500">
                            <span>Tối ưu: ~150 ký tự.</span>
                            <span className={formData.seoDescriptionVi.length > 155 ? 'text-amber-500 font-medium' : ''}>
                                {formData.seoDescriptionVi.length}/160
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className={`flex justify-end gap-3 ${isInsidePanel ? 'shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.1)] dark:shadow-none p-6 border-t border-slate-100 dark:border-slate-800' : 'pt-6 border-t border-slate-200 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 z-10 w-[calc(100%+3rem)] -mx-6 px-6 pb-2'}`}>
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
