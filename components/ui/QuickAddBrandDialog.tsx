import React, { useState } from 'react';
import { X, Tag, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { BrandService } from '../../services';
import { Brand } from '../../types';

interface QuickAddBrandDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (brand: Brand) => void;
    initialName?: string;
}

const QuickAddBrandDialog: React.FC<QuickAddBrandDialogProps> = ({
    isOpen,
    onClose,
    onCreated,
    initialName = ''
}) => {
    const [formData, setFormData] = useState({
        name: initialName,
        code: '',
        country: '',
        website: '',
        description: '',
        isActive: true,
    });
    const [isSaving, setIsSaving] = useState(false);

    // Reset when opening
    React.useEffect(() => {
        if (isOpen) {
            setFormData({
                name: initialName,
                code: '',
                country: '',
                website: '',
                description: '',
                isActive: true,
            });
        }
    }, [isOpen, initialName]);

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('Vui lòng nhập tên hãng');
            return;
        }
        setIsSaving(true);
        try {
            const created = await BrandService.create(formData);
            toast.success(`Đã thêm hãng "${created.name}"`);
            onCreated(created);
            onClose();
        } catch (error: any) {
            console.error('Error creating brand:', error);
            if (error?.message?.includes('duplicate') || error?.code === '23505') {
                toast.error('Tên hãng đã tồn tại');
            } else {
                toast.error('Lỗi khi tạo hãng');
            }
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                            <Tag size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Thêm hãng mới</h2>
                            <p className="text-violet-100 text-xs">Quản lý thông tin hãng/thương hiệu</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                    >
                        <X size={18} className="text-white" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Tên hãng *</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="VD: Autodesk"
                                autoFocus
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Mã hãng</label>
                            <input
                                type="text"
                                value={formData.code}
                                onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                placeholder="VD: ADSK"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Quốc gia</label>
                            <input
                                type="text"
                                value={formData.country}
                                onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))}
                                placeholder="VD: Mỹ"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Website</label>
                            <input
                                type="text"
                                value={formData.website}
                                onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                                placeholder="VD: https://autodesk.com"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Mô tả</label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Mô tả ngắn gọn về hãng..."
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                        />
                    </div>
                    <div className="flex items-center gap-3 py-1">
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                            className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${formData.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.isActive ? 'left-6' : 'left-1'}`} />
                        </button>
                        <span className="text-sm text-slate-600 dark:text-slate-400">{formData.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={14} />}
                            Thêm mới
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickAddBrandDialog;
