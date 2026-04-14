import React, { useState, useEffect } from 'react';
import { Save, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CmsService } from '../types/cms';
import { CmsDataService } from '../services/cmsDataService';
import RichTextEditor from './ui/RichTextEditor';
import { generateSlug } from '../utils/formatters';

interface ServiceFormProps {
    onClose: () => void;
    onSave: (data: Partial<CmsService>, id?: string) => Promise<void>;
    service?: CmsService;
    isInsidePanel?: boolean;
}

const ServiceForm: React.FC<ServiceFormProps> = ({ onClose, onSave, service, isInsidePanel }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAutoSlug, setIsAutoSlug] = useState(true);

    const [formData, setFormData] = useState({
        nameVi: '',
        slug: '',
        descriptionVi: '',
        contentVi: '',
        iconUrl: '',
        thumbnailUrl: '',
        sortOrder: 0,
        isActive: true,
        seoTitleVi: '',
        seoDescriptionVi: '',
    });

    useEffect(() => {
        if (service) {
            setFormData({
                nameVi: service.nameVi || '',
                slug: service.slug || '',
                descriptionVi: service.descriptionVi || '',
                contentVi: service.contentVi || '',
                iconUrl: service.iconUrl || '',
                thumbnailUrl: service.thumbnailUrl || '',
                sortOrder: service.sortOrder || 0,
                isActive: service.isActive ?? true,
                seoTitleVi: service.seoTitleVi || '',
                seoDescriptionVi: service.seoDescriptionVi || '',
            });
            setIsAutoSlug(false);
        } else {
            setFormData({
                nameVi: '',
                slug: '',
                descriptionVi: '',
                contentVi: '',
                iconUrl: '',
                thumbnailUrl: '',
                sortOrder: 0,
                isActive: true,
                seoTitleVi: '',
                seoDescriptionVi: '',
            });
            setIsAutoSlug(true);
        }
    }, [service]);

    // Auto slug
    useEffect(() => {
        if (isAutoSlug && formData.nameVi) {
            setFormData(prev => ({ ...prev, slug: generateSlug(formData.nameVi) }));
        }
    }, [formData.nameVi, isAutoSlug]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.nameVi.trim() || !formData.slug.trim()) {
            toast.error('Vui lòng nhập Tên dịch vụ và Slug!');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSave(formData, service?.id);
        } catch (error) {
            console.error('Error saving service:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGenerateSlug = () => {
        if (formData.nameVi) {
            setFormData(prev => ({ ...prev, slug: generateSlug(formData.nameVi) }));
            setIsAutoSlug(true);
            toast.success('Đã tạo lại đường dẫn.');
        }
    };

    const formContent = (
        <form onSubmit={handleSubmit} className={isInsidePanel ? "flex flex-col h-full bg-white dark:bg-slate-900" : "space-y-6"}>
            <div className={isInsidePanel ? "flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" : "space-y-6"}>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Tên Dịch vụ *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.nameVi}
                            onChange={(e) => setFormData(prev => ({ ...prev, nameVi: e.target.value }))}
                            placeholder="Nhập tên dịch vụ..."
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-800 dark:text-slate-200"
                        />
                    </div>
                    
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Đường dẫn (Slug) *
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
                                className="w-full px-4 py-3 border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200"
                            />
                            <button
                                type="button"
                                onClick={handleGenerateSlug}
                                className="p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-600"
                            >
                                <RefreshCw size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Icon (Class hoặc URL)
                        </label>
                        <input
                            type="text"
                            value={formData.iconUrl}
                            onChange={(e) => setFormData(prev => ({ ...prev, iconUrl: e.target.value }))}
                            placeholder="Ví dụ: fas fa-home hoặc URL ảnh"
                            className="w-full px-4 py-3 border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                        />
                    </div>
                    
                    <div className="md:col-span-1">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Ảnh Thumbnail (URL)
                        </label>
                        <input
                            type="text"
                            value={formData.thumbnailUrl}
                            onChange={(e) => setFormData(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
                            className="w-full px-4 py-3 border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Mô tả ngắn gọn
                        </label>
                        <textarea
                            value={formData.descriptionVi}
                            onChange={(e) => setFormData(prev => ({ ...prev, descriptionVi: e.target.value }))}
                            rows={2}
                            className="w-full px-4 py-3 border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 resize-none"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <RichTextEditor
                            label="Nội dung chuyên sâu"
                            value={formData.contentVi}
                            onChange={(val) => setFormData(prev => ({ ...prev, contentVi: val }))}
                            minHeight="350px"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Thứ tự hiển thị
                        </label>
                        <input
                            type="number"
                            value={formData.sortOrder}
                            onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
                        />
                    </div>
                    
                    <div className="pt-8">
                        <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                className="w-4 h-4 text-emerald-500 rounded border-slate-300 dark:border-slate-600"
                            />
                            <span className="text-sm font-bold">Kích hoạt & Hiển thị</span>
                        </label>
                    </div>
                </div>

                {/* SEO */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide border-b border-slate-200 pb-2">SEO Options</h3>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">SEO Title</label>
                        <input
                            type="text"
                            value={formData.seoTitleVi}
                            onChange={(e) => setFormData(prev => ({ ...prev, seoTitleVi: e.target.value }))}
                            className="w-full px-4 py-2 border border-slate-200 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">SEO Description</label>
                        <textarea
                            value={formData.seoDescriptionVi}
                            onChange={(e) => setFormData(prev => ({ ...prev, seoDescriptionVi: e.target.value }))}
                            rows={2}
                            maxLength={160}
                            className="w-full px-4 py-2 border border-slate-200 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 resize-none"
                        />
                    </div>
                </div>

            </div>

            <div className={`flex justify-end gap-3 ${isInsidePanel ? 'shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.1)] dark:shadow-none p-6 border-t border-slate-100 dark:border-slate-800' : 'pt-6 border-t border-slate-200 dark:border-slate-800'}`}>
                <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-lg">Hủy</button>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-lg disabled:opacity-50">
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {service ? 'Cập nhật' : 'Lưu Dịch vụ'}
                </button>
            </div>
        </form>
    );

    return formContent;
};

export default ServiceForm;
