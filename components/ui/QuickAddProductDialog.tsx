import React, { useState } from 'react';
import { X, Package, Loader2, CheckCircle } from 'lucide-react';
import { ProductService } from '../../services/productService';
import { Product, ProductCategory } from '../../types';

interface QuickAddProductDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (product: Product) => void;
    initialName?: string;
}

const CATEGORIES: ProductCategory[] = ['Phần mềm', 'Phần cứng', 'Dịch vụ', 'Tư vấn', 'Đào tạo', 'Bảo trì', 'Sản xuất', 'Khác'];
const UNITS = ['Bộ', 'Cái', 'Gói', 'Tháng', 'Năm', 'Lần', 'Dự án', 'Khác'];

const formatVND = (value: number) => new Intl.NumberFormat('vi-VN').format(Math.round(value));

const QuickAddProductDialog: React.FC<QuickAddProductDialogProps> = ({
    isOpen,
    onClose,
    onCreated,
    initialName = ''
}) => {
    const [name, setName] = useState(initialName);
    const [category, setCategory] = useState<ProductCategory>('Phần mềm');
    const [unit, setUnit] = useState('Bộ');
    const [basePrice, setBasePrice] = useState<number>(0);
    const [costPrice, setCostPrice] = useState<number>(0);
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const resetForm = () => {
        setName('');
        setCategory('Phần mềm');
        setUnit('Bộ');
        setBasePrice(0);
        setCostPrice(0);
        setDescription('');
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('Vui lòng nhập tên sản phẩm');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const newProduct = await ProductService.create({
                name: name.trim(),
                category,
                unit,
                basePrice,
                costPrice,
                description: description.trim(),
                status: 'Active'
            });

            onCreated(newProduct);
            resetForm();
            onClose();
        } catch (err: any) {
            console.error('[QuickAddProduct] Error:', err);
            setError(err.message || 'Không thể tạo sản phẩm. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                            <Package size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Thêm sản phẩm mới</h2>
                            <p className="text-indigo-100 text-xs">Tạo nhanh SP/DV để chọn cho hạng mục</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { resetForm(); onClose(); }}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={18} className="text-white" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-600 dark:text-rose-400 font-medium">
                            {error}
                        </div>
                    )}

                    {/* Name */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                            <Package size={10} /> Tên sản phẩm / dịch vụ *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="VD: Phần mềm GstarCAD..."
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Category + Unit */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Danh mục</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all"
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Đơn vị</label>
                            <select
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all"
                            >
                                {UNITS.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Giá bán (Đầu ra)</label>
                            <input
                                type="text"
                                value={basePrice ? formatVND(basePrice) : ''}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\./g, '');
                                    if (/^\d*$/.test(raw)) setBasePrice(Number(raw));
                                }}
                                placeholder="0"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-right focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Giá vốn (Đầu vào)</label>
                            <input
                                type="text"
                                value={costPrice ? formatVND(costPrice) : ''}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\./g, '');
                                    if (/^\d*$/.test(raw)) setCostPrice(Number(raw));
                                }}
                                placeholder="0"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-right focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Mô tả (tùy chọn)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Mô tả ngắn..."
                            rows={2}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => { resetForm(); onClose(); }}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim()}
                            className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-bold rounded-lg hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                            {isSubmitting ? (
                                <><Loader2 size={14} className="animate-spin" /> Đang tạo...</>
                            ) : (
                                <><CheckCircle size={14} /> Tạo & Chọn</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default QuickAddProductDialog;
