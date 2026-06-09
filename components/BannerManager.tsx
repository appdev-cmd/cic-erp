import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { CmsBanner } from '../types/cms';
import { CmsDataService } from '../services/cmsDataService';
import BannerForm from './BannerForm';
import { useSlidePanel } from '../contexts/SlidePanelContext';

const BannerManager: React.FC = () => {
    const [banners, setBanners] = useState<CmsBanner[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { openPanel, closePanel } = useSlidePanel();

    const loadBanners = async () => {
        setIsLoading(true);
        try {
            const data = await CmsDataService.getBanners();
            setBanners(data);
        } catch (error) {
            console.error('Failed to load banners:', error);
            toast.error('Không thể tải danh sách banner');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadBanners();
    }, []);

    const openFormPanel = (banner?: CmsBanner) => {
        openPanel({
            title: banner ? 'Chỉnh sửa Banner' : 'Thêm Banner mới',
            component: (
                <BannerForm 
                    banner={banner} 
                    onClose={closePanel} 
                    onSave={handleSave} 
                    isInsidePanel={true} 
                />
            ),
            width: '800px'
        });
    };

    const handleAdd = () => {
        openFormPanel();
    };

    const handleEdit = (banner: CmsBanner) => {
        openFormPanel(banner);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa banner này?')) return;
        try {
            await CmsDataService.deleteBanner(id);
            toast.success('Đã xóa banner');
            loadBanners();
        } catch (error) {
            console.error(error);
            toast.error('Lỗi khi xóa banner');
        }
    };

    const handleSave = async (data: Partial<CmsBanner>, id?: string) => {
        try {
            if (id) {
                await CmsDataService.updateBanner(id, data);
                toast.success('Đã cập nhật banner');
            } else {
                await CmsDataService.createBanner(data);
                toast.success('Đã tạo banner mới');
            }
            closePanel();
            loadBanners();
        } catch (error) {
            toast.error('Lỗi khi lưu banner');
            throw error;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                        <ImageIcon className="text-orange-500" size={20} />
                        Quản lý Banner
                    </h3>
                    <p className="text-sm text-slate-500">Quản trị các hình ảnh banner quảng cáo trên Web</p>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
                >
                    <Plus size={16} /> Thêm Banner
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
            ) : banners.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700">
                        <ImageIcon size={28} className="text-slate-400 dark:text-slate-500" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Chưa có banner nào</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
                        Bạn chưa thêm bất kỳ banner quảng cáo nào. Thêm banner để làm phong phú trang chủ!
                    </p>
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 rounded-lg text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors"
                    >
                        <Plus size={16} /> Thêm Banner mới
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {banners.map((banner) => (
                        <div key={banner.id} onClick={() => handleEdit(banner)} className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer">
                            <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 relative">
                                {banner.imageUrl ? (
                                    <img src={banner.imageUrl} alt={banner.titleVi || 'Banner'} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                        <ImageIcon size={32} className="mb-2 opacity-50" />
                                        <span className="text-sm">No Image</span>
                                    </div>
                                )}
                                <div className="absolute top-2 right-2 flex gap-1 bg-white/90 dark:bg-slate-900 backdrop-blur p-1 rounded-lg shadow opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(banner); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded">
                                        <Edit size={16} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(banner.id); }} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-4">
                                <h4 className="font-bold text-slate-800 dark:text-white line-clamp-1 truncate">{banner.titleVi || '(Không tiêu đề)'}</h4>
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                                    <span className={`px-2 py-0.5 rounded font-medium ${banner.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                        {banner.isActive ? 'Đang bật' : 'Đang ẩn'}
                                    </span>
                                    <span>Vị trí: <b>{banner.position === 'left' ? 'Trái' : banner.position === 'right' ? 'Phải' : banner.position}</b></span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BannerManager;
