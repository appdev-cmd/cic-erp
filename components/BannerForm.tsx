import React, { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CmsBanner } from '../types/cms';
import { CmsDataService } from '../services/cmsDataService';

interface BannerFormProps {
    onClose: () => void;
    onSave: (data: Partial<CmsBanner>, id?: string) => Promise<void>;
    banner?: CmsBanner;
    isInsidePanel?: boolean;
}

const BannerForm: React.FC<BannerFormProps> = ({ onClose, onSave, banner, isInsidePanel }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        titleVi: '',
        subtitleVi: '',
        imageUrl: '',
        linkUrl: '',
        position: 'left',
        sortOrder: 0,
        isActive: true,
    });

    useEffect(() => {
        if (banner) {
            setFormData({
                titleVi: banner.titleVi || '',
                subtitleVi: banner.subtitleVi || '',
                imageUrl: banner.imageUrl || '',
                linkUrl: banner.linkUrl || '',
                position: banner.position || 'left',
                sortOrder: banner.sortOrder || 0,
                isActive: banner.isActive,
            });
        } else {
            setFormData({
                titleVi: '',
                subtitleVi: '',
                imageUrl: '',
                linkUrl: '',
                position: 'left',
                sortOrder: 0,
                isActive: true,
            });
        }
    }, [banner]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.imageUrl.trim()) {
            toast.error('Vui lòng nhập đường dẫn ảnh (URL)!');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSave(formData, banner?.id);
        } catch (error) {
            console.error('Error saving banner:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formContent = (
        <form onSubmit={handleSubmit} className={isInsidePanel ? "flex flex-col h-full bg-white dark:bg-slate-900" : "space-y-6"}>
            <div className={isInsidePanel ? "flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" : "space-y-6"}>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Tiêu đề (tuỳ chọn)
                        </label>
                        <input
                            type="text"
                            value={formData.titleVi}
                            onChange={(e) => setFormData(prev => ({ ...prev, titleVi: e.target.value }))}
                            placeholder="Tiêu đề banner"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200"
                        />
                    </div>
                    
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Đường dẫn ảnh URL *
                        </label>
                        <div className="flex flex-col gap-4">
                            <input
                                type="url"
                                required
                                value={formData.imageUrl}
                                onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                                placeholder="https://domain.com/banner.jpg"
                                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200"
                            />
                            {formData.imageUrl && (
                                <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded overflow-hidden flex items-center justify-center p-2">
                                    <img 
                                        src={formData.imageUrl} 
                                        alt="Thumbnail Preview" 
                                        className="h-32 object-contain"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Đường dẫn điều hướng (Link)
                        </label>
                        <input
                            type="url"
                            value={formData.linkUrl}
                            onChange={(e) => setFormData(prev => ({ ...prev, linkUrl: e.target.value }))}
                            placeholder="https://..."
                            className="w-full px-4 py-3 border border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Vị trí Banner
                        </label>
                        <select
                            value={formData.position}
                            onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
                        >
                            <option value="left">Bên trái</option>
                            <option value="right">Bên phải</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                            Thứ tự ưu tiên
                        </label>
                        <input
                            type="number"
                            value={formData.sortOrder}
                            onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200"
                        />
                    </div>
                    
                    <div className="md:col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer mt-2 p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                className="w-4 h-4 text-emerald-500 rounded border-slate-300 dark:border-slate-600"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Hiển thị Banner này</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Nếu bỏ check, banner sẽ bị ẩn khỏi trang chủ.</span>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            <div className={`flex justify-end gap-3 ${isInsidePanel ? 'shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.1)] dark:shadow-none p-6 border-t border-slate-100 dark:border-slate-800' : 'pt-6 border-t border-slate-200 dark:border-slate-800'}`}>
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
                    {banner ? 'Cập nhật Banner' : 'Lưu Banner'}
                </button>
            </div>
        </form>
    );

    return formContent;
};

export default BannerForm;
