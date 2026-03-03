import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Search,
    Tag,
    Globe,
    CheckCircle,
    XCircle,
    Save,
    X,
} from 'lucide-react';
import { Brand } from '../../types';
import { BrandService } from '../../services';
import ConfirmDialog, { useConfirmDialog } from '../ui/ConfirmDialog';

interface BrandManagerProps {
    onSelectBrand?: (id: string) => void;
}

const EMPTY_FORM: Omit<Brand, 'id'> = {
    name: '',
    code: '',
    website: '',
    country: '',
    description: '',
    isActive: true,
};

const BrandManager: React.FC<BrandManagerProps> = ({ onSelectBrand }) => {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
    const [formData, setFormData] = useState<Omit<Brand, 'id'>>(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);

    const confirmDialog = useConfirmDialog();

    // Fetch brands
    const fetchBrands = async () => {
        setIsLoading(true);
        try {
            const data = await BrandService.getAll();
            setBrands(data);
        } catch (error) {
            console.error('Error fetching brands:', error);
            toast.error('Lỗi khi tải danh sách hãng');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBrands();
    }, []);

    // Filtered brands
    const filtered = brands.filter(b => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            b.name.toLowerCase().includes(q) ||
            (b.code || '').toLowerCase().includes(q) ||
            (b.country || '').toLowerCase().includes(q)
        );
    });

    // Open form for add
    const handleAdd = () => {
        setEditingBrand(null);
        setFormData(EMPTY_FORM);
        setIsFormOpen(true);
    };

    // Open form for edit
    const handleEdit = (brand: Brand) => {
        setEditingBrand(brand);
        setFormData({
            name: brand.name,
            code: brand.code || '',
            website: brand.website || '',
            country: brand.country || '',
            description: brand.description || '',
            isActive: brand.isActive,
        });
        setIsFormOpen(true);
    };

    // Save
    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('Vui lòng nhập tên hãng');
            return;
        }
        setIsSaving(true);
        try {
            if (editingBrand) {
                const updated = await BrandService.update(editingBrand.id, formData);
                setBrands(prev => prev.map(b => b.id === editingBrand.id ? updated : b));
                toast.success('Đã cập nhật hãng');
            } else {
                const created = await BrandService.create(formData);
                setBrands(prev => [created, ...prev]);
                toast.success('Đã thêm hãng mới');
            }
            setIsFormOpen(false);
        } catch (error: any) {
            console.error('Error saving brand:', error);
            if (error?.message?.includes('duplicate') || error?.code === '23505') {
                toast.error('Tên hãng đã tồn tại');
            } else {
                toast.error('Lỗi khi lưu hãng');
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Delete
    const handleDelete = async (brand: Brand) => {
        const confirmed = await confirmDialog.confirm({
            title: 'Xóa hãng sản xuất',
            message: `Bạn có chắc chắn muốn xóa hãng "${brand.name}"? Các sản phẩm đang liên kết sẽ mất thông tin hãng.`,
            variant: 'danger',
        });
        if (confirmed) {
            try {
                await BrandService.delete(brand.id);
                setBrands(prev => prev.filter(b => b.id !== brand.id));
                toast.success('Đã xóa hãng');
            } catch (error) {
                console.error('Error deleting brand:', error);
                toast.error('Không thể xóa hãng (có thể đang được sử dụng)');
            }
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Tag size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200">Hãng sản xuất</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Quản lý danh mục hãng/thương hiệu cho sản phẩm</p>
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none cursor-pointer"
                >
                    <Plus size={15} />
                    Thêm hãng
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                    type="text"
                    placeholder="Tìm theo tên, mã, quốc gia..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
                />
            </div>

            {/* Inline Form */}
            {isFormOpen && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <h4 className="font-bold text-sm text-indigo-700 dark:text-indigo-300">
                        {editingBrand ? `Chỉnh sửa: ${editingBrand.name}` : 'Thêm hãng mới'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Tên hãng *</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="VD: Autodesk"
                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Mã hãng</label>
                            <input
                                type="text"
                                value={formData.code || ''}
                                onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                placeholder="VD: ADSK"
                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Quốc gia</label>
                            <input
                                type="text"
                                value={formData.country || ''}
                                onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))}
                                placeholder="VD: Mỹ"
                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Website</label>
                            <input
                                type="text"
                                value={formData.website || ''}
                                onChange={e => setFormData(prev => ({ ...prev, website: e.target.value }))}
                                placeholder="VD: https://autodesk.com"
                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Mô tả</label>
                        <input
                            type="text"
                            value={formData.description || ''}
                            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Mô tả ngắn gọn về hãng..."
                            className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 transition-colors"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                                className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${formData.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.isActive ? 'left-[18px]' : 'left-0.5'}`} />
                            </button>
                            <span className="text-xs text-slate-600 dark:text-slate-400">{formData.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsFormOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                {editingBrand ? 'Cập nhật' : 'Thêm mới'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 size={28} className="animate-spin text-indigo-500" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Tag size={28} className="text-slate-400" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300">
                        {searchQuery ? 'Không tìm thấy hãng nào' : 'Chưa có hãng nào'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                        {searchQuery ? 'Thử từ khóa khác' : 'Nhấn "Thêm hãng" để bắt đầu'}
                    </p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800">
                                <th className="text-left py-2.5 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tên hãng</th>
                                <th className="text-left py-2.5 px-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">Mã</th>
                                <th className="text-left py-2.5 px-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Quốc gia</th>
                                <th className="text-left py-2.5 px-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Website</th>
                                <th className="text-center py-2.5 px-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">T.Thái</th>
                                <th className="py-2.5 px-2 w-20"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(brand => (
                                <tr
                                    key={brand.id}
                                    className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    onClick={() => onSelectBrand?.(brand.id)}
                                >
                                    <td className="py-3 px-4">
                                        <div>
                                            <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{brand.name}</p>
                                            {brand.description && (
                                                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{brand.description}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-3 hidden sm:table-cell">
                                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{brand.code || '—'}</span>
                                    </td>
                                    <td className="py-3 px-3 hidden md:table-cell">
                                        <span className="text-xs text-slate-600 dark:text-slate-400">{brand.country || '—'}</span>
                                    </td>
                                    <td className="py-3 px-3 hidden lg:table-cell">
                                        {brand.website ? (
                                            <a
                                                href={brand.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <Globe size={12} />
                                                {brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                            </a>
                                        ) : (
                                            <span className="text-xs text-slate-400">—</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                        {brand.isActive ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-bold">
                                                <CheckCircle size={11} />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-bold">
                                                <XCircle size={11} />
                                                Off
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 px-2">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button
                                                onClick={() => handleEdit(brand)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all cursor-pointer"
                                                title="Chỉnh sửa"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(brand)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all cursor-pointer"
                                                title="Xóa"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {filtered.length} hãng {searchQuery && `(tìm thấy từ ${brands.length})`}
                        </span>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={confirmDialog.close}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                variant={confirmDialog.variant}
                confirmText="Xóa"
                cancelText="Hủy"
            />
        </div>
    );
};

export default BrandManager;
