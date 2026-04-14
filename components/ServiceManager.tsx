import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Loader2, Wrench, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { CmsService } from '../types/cms';
import { CmsDataService } from '../services/cmsDataService';
import ServiceForm from './ServiceForm';
import ServiceDetail from './ServiceDetail';
import { useSlidePanel } from '../contexts/SlidePanelContext';

const ServiceManager: React.FC = () => {
    const [services, setServices] = useState<CmsService[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { openPanel, closePanel } = useSlidePanel();

    const loadServices = async () => {
        setIsLoading(true);
        try {
            const data = await CmsDataService.getServices();
            setServices(data);
        } catch (error) {
            console.error('Failed to load services:', error);
            toast.error('Không thể tải danh sách dịch vụ');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadServices();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Xóa dịch vụ này? Hành động này không thể hoàn tác.')) return;
        try {
            await CmsDataService.deleteService(id);
            toast.success('Đã xóa dịch vụ');
            loadServices();
        } catch (error) {
            console.error(error);
            toast.error('Lỗi khi xóa dịch vụ');
        }
    };

    const handleSave = async (data: Partial<CmsService>, id?: string) => {
        try {
            if (id) {
                await CmsDataService.updateService(id, data);
                toast.success('Đã cập nhật dịch vụ');
            } else {
                await CmsDataService.createService(data);
                toast.success('Đã tạo dịch vụ mới');
            }
            closePanel();
            loadServices();
        } catch (error) {
            toast.error('Lỗi khi lưu dịch vụ');
            throw error;
        }
    };

    const openFormPanel = (service?: CmsService) => {
        openPanel({
            title: service ? 'Chỉnh sửa Dịch vụ' : 'Thêm Dịch vụ mới',
            component: (
                <ServiceForm 
                    service={service} 
                    onClose={closePanel} 
                    onSave={handleSave} 
                    isInsidePanel={true} 
                />
            ),
            width: '800px'
        });
    };

    const showDetailPanel = (service: CmsService) => {
        openPanel({
            title: 'Chi tiết Dịch vụ',
            icon: <Wrench className="text-orange-500" size={20} />,
            component: (
                <div className="flex flex-col h-full bg-white dark:bg-slate-900">
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <ServiceDetail service={service} />
                    </div>
                    {/* Footer for actions in detail view */}
                    <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                        <button
                            onClick={closePanel}
                            className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors rounded-lg"
                        >
                            Đóng
                        </button>
                        <button
                            onClick={() => {
                                openFormPanel(service);
                            }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-lg"
                        >
                            <Edit size={16} /> Chỉnh sửa
                        </button>
                    </div>
                </div>
            ),
            width: '800px'
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                        <Wrench className="text-blue-500" size={20} />
                        Quản lý Dịch vụ
                    </h3>
                    <p className="text-sm text-slate-500">Thêm, sửa nội dung các dịch vụ hiển thị trên Website</p>
                </div>
                <button
                    onClick={() => openFormPanel()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
                >
                    <Plus size={16} /> Thêm Dịch vụ
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
            ) : services.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700">
                        <Wrench size={28} className="text-slate-400 dark:text-slate-500" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Chưa có dịch vụ nào</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
                        Bạn chưa thêm bất kỳ dịch vụ nào để hiển thị trên website. Hãy thêm dịch vụ đầu tiên!
                    </p>
                    <button
                        onClick={() => openFormPanel()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 rounded-lg text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors"
                    >
                        <Plus size={16} /> Thêm Dịch vụ mới
                    </button>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-500 font-bold">
                                <th className="p-4">Dịch vụ</th>
                                <th className="p-4">Slug</th>
                                <th className="p-4 text-center">Trạng thái</th>
                                <th className="p-4 text-center">Sắp xếp</th>
                                <th className="p-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {services.map(svc => (
                                <tr key={svc.id} onClick={() => showDetailPanel(svc)} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            {svc.thumbnailUrl ? (
                                                <img src={svc.thumbnailUrl} alt={svc.nameVi} className="w-10 h-10 rounded object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                                                    <ImageIcon size={16} />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-white">{svc.nameVi}</p>
                                                <p className="text-xs text-slate-500 line-clamp-1">{svc.descriptionVi}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm font-mono text-slate-500">/{svc.slug}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${svc.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                            {svc.isActive ? 'Bật' : 'Tắt'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center text-sm font-bold">{svc.sortOrder}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); openFormPanel(svc); }} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"><Edit size={16}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(svc.id); }} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ServiceManager;
