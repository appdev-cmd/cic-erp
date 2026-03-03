import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Tag,
    Globe,
    MapPin,
    Package,
    CheckCircle,
    XCircle,
    Loader2,
    Pencil,
    Trash2,
    Save,
    X,
    ExternalLink
} from 'lucide-react';
import { Brand, Product } from '../types';
import { BrandService, ProductService } from '../services';
import { formatCurrency } from '../utils/formatters';
import ConfirmDialog, { useConfirmDialog } from './ui/ConfirmDialog';

interface BrandDetailProps {
    brandId: string;
    onBack: () => void;
    onSelectProduct?: (id: string) => void;
}

const BrandDetail: React.FC<BrandDetailProps> = ({ brandId, onBack, onSelectProduct }) => {
    const [brand, setBrand] = useState<Brand | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Brand>>({});
    const [isSaving, setIsSaving] = useState(false);
    const confirmDialog = useConfirmDialog();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [brandData, productData] = await Promise.all([
                    BrandService.getById(brandId),
                    ProductService.getByBrand(brandId),
                ]);
                setBrand(brandData || null);
                setProducts(productData);
            } catch (error) {
                console.error('Error fetching brand detail:', error);
                toast.error('Lỗi khi tải thông tin hãng');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [brandId]);

    const handleEdit = () => {
        if (!brand) return;
        setEditData({
            name: brand.name,
            code: brand.code,
            country: brand.country,
            website: brand.website,
            description: brand.description,
            isActive: brand.isActive,
        });
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!brand || !editData.name?.trim()) return;
        setIsSaving(true);
        try {
            const updated = await BrandService.update(brand.id, editData);
            setBrand(updated);
            setIsEditing(false);
            toast.success('Đã cập nhật hãng');
        } catch (error) {
            toast.error('Lỗi khi cập nhật hãng');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!brand) return;
        const confirmed = await confirmDialog.confirm({
            title: 'Xóa hãng sản xuất',
            message: `Xóa hãng "${brand.name}"? ${products.length > 0 ? `Có ${products.length} sản phẩm sẽ mất liên kết hãng.` : ''}`,
            variant: 'danger',
        });
        if (confirmed) {
            try {
                await BrandService.delete(brand.id);
                toast.success('Đã xóa hãng');
                onBack();
            } catch (error) {
                toast.error('Không thể xóa hãng');
            }
        }
    };

    // Stats
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.isActive).length;
    const totalValue = products.reduce((sum, p) => sum + (p.basePrice || 0), 0);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <Loader2 size={32} className="animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!brand) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-12">
                <p className="text-slate-500 dark:text-slate-400 mb-4">Không tìm thấy hãng sản xuất</p>
                <button onClick={onBack} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer">Quay lại</button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400 cursor-pointer"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <Tag size={24} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">{brand.name}</h1>
                                {brand.code && (
                                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded">
                                        {brand.code}
                                    </span>
                                )}
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${brand.isActive
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                    }`}>
                                    {brand.isActive ? <CheckCircle size={11} /> : <XCircle size={11} />}
                                    {brand.isActive ? 'Active' : 'Off'}
                                </span>
                            </div>
                            {brand.description && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{brand.description}</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleEdit}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                        <Pencil size={14} />
                        Sửa
                    </button>
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/30 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                    >
                        <Trash2 size={14} />
                        Xóa
                    </button>
                </div>
            </div>

            {/* Edit Inline Form */}
            {isEditing && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 space-y-4">
                    <h4 className="font-bold text-sm text-indigo-700 dark:text-indigo-300">Chỉnh sửa hãng</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Tên hãng *</label>
                            <input
                                type="text"
                                value={editData.name || ''}
                                onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Mã hãng</label>
                            <input
                                type="text"
                                value={editData.code || ''}
                                onChange={e => setEditData(prev => ({ ...prev, code: e.target.value }))}
                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Quốc gia</label>
                            <input
                                type="text"
                                value={editData.country || ''}
                                onChange={e => setEditData(prev => ({ ...prev, country: e.target.value }))}
                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Website</label>
                            <input
                                type="text"
                                value={editData.website || ''}
                                onChange={e => setEditData(prev => ({ ...prev, website: e.target.value }))}
                                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wide">Mô tả</label>
                        <input
                            type="text"
                            value={editData.description || ''}
                            onChange={e => setEditData(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => setIsEditing(false)}
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
                            Lưu
                        </button>
                    </div>
                </div>
            )}

            {/* Info Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400">
                            <Package size={18} />
                        </div>
                        <div>
                            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{totalProducts}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Sản phẩm</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <CheckCircle size={18} />
                        </div>
                        <div>
                            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{activeProducts}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Đang bán</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 col-span-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                            <Globe size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {brand.country && (
                                    <span className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                                        <MapPin size={13} />{brand.country}
                                    </span>
                                )}
                                {brand.website && (
                                    <a
                                        href={brand.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >
                                        <ExternalLink size={13} />
                                        {brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Product List */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Package size={16} className="text-indigo-500" />
                        Danh sách sản phẩm ({totalProducts})
                    </h3>
                </div>
                {products.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Package size={24} className="text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có sản phẩm nào thuộc hãng này</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800">
                                    <th className="text-left py-2.5 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">STT</th>
                                    <th className="text-left py-2.5 px-4 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tên sản phẩm</th>
                                    <th className="text-left py-2.5 px-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Danh mục</th>
                                    <th className="text-right py-2.5 px-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">Giá bán</th>
                                    <th className="text-center py-2.5 px-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((product, idx) => (
                                    <tr
                                        key={product.id}
                                        className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                        onClick={() => onSelectProduct?.(product.id)}
                                    >
                                        <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">{idx + 1}</td>
                                        <td className="py-3 px-4">
                                            <div>
                                                <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{product.name}</p>
                                                {product.code && (
                                                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{product.code}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 hidden md:table-cell">
                                            <span className="text-xs text-slate-600 dark:text-slate-400">{product.category || '—'}</span>
                                        </td>
                                        <td className="py-3 px-3 text-right hidden sm:table-cell">
                                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                                {product.basePrice ? formatCurrency(product.basePrice) : '—'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            {product.isActive ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-bold">
                                                    <CheckCircle size={11} />
                                                    Đang bán
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-bold">
                                                    <XCircle size={11} />
                                                    Ngừng
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

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

export default BrandDetail;
