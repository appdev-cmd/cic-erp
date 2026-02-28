import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, X, Loader2, Search, ShieldCheck } from 'lucide-react';
import Modal from './ui/Modal';
import NumberInput from './ui/NumberInput';
import { Product, ProductCategory, Unit, Brand, Customer } from '../types';
import { UnitService, BrandService, CustomerService } from '../services';

interface ProductFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<Product, 'id'> | Product) => Promise<void>;
    product?: Product; // If provided, we're editing
}

const CATEGORIES: string[] = ['Phần mềm', 'Tư vấn', 'Thiết kế', 'Thi công', 'Bảo trì', 'Đào tạo', 'Khác'];

const ProductForm: React.FC<ProductFormProps> = ({ isOpen, onClose, onSave, product }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        category: 'Phần mềm' as ProductCategory,
        description: '',
        unit: 'Gói',
        basePrice: 0,
        costPrice: 0,
        isActive: true,
        unitId: '',
        brandId: '',
        supplierId: '',
        sku: '',
        model: '',
        warrantyMonths: 0,
    });

    // Data lists
    const [units, setUnits] = useState<Unit[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [suppliers, setSuppliers] = useState<Customer[]>([]);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [supplierResults, setSupplierResults] = useState<Customer[]>([]);
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [selectedSupplierName, setSelectedSupplierName] = useState('');

    // Load reference data
    useEffect(() => {
        if (isOpen) {
            UnitService.getActive().then(setUnits).catch(console.error);
            BrandService.getActive().then(setBrands).catch(console.error);
        }
    }, [isOpen]);

    // Reset form when product changes
    useEffect(() => {
        if (product) {
            setFormData({
                code: product.code,
                name: product.name,
                category: product.category,
                description: product.description,
                unit: product.unit,
                basePrice: product.basePrice,
                costPrice: product.costPrice || 0,
                isActive: product.isActive,
                unitId: product.unitId || '',
                brandId: product.brandId || '',
                supplierId: product.supplierId || '',
                sku: product.sku || '',
                model: product.model || '',
                warrantyMonths: product.warrantyMonths || 0,
            });
            setSelectedSupplierName(product.supplierName || '');
        } else {
            setFormData({
                code: '',
                name: '',
                category: 'Phần mềm',
                description: '',
                unit: 'Gói',
                basePrice: 0,
                costPrice: 0,
                isActive: true,
                unitId: '',
                brandId: '',
                supplierId: '',
                sku: '',
                model: '',
                warrantyMonths: 0,
            });
            setSelectedSupplierName('');
        }
    }, [product, isOpen]);

    // Supplier search debounce
    useEffect(() => {
        if (supplierSearch.length < 2) {
            setSupplierResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const results = await CustomerService.searchSuppliers(supplierSearch);
                setSupplierResults(results);
                setShowSupplierDropdown(true);
            } catch (err) {
                console.error('Supplier search error:', err);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [supplierSearch]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (product) {
                await onSave({ ...formData, id: product.id });
            } else {
                await onSave(formData);
            }
            onClose();
        } catch (error) {
            console.error('Error saving product:', error);
            toast.error('Lỗi khi lưu sản phẩm');
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectSupplier = (supplier: Customer) => {
        setFormData(prev => ({ ...prev, supplierId: supplier.id }));
        setSelectedSupplierName(supplier.name);
        setSupplierSearch('');
        setShowSupplierDropdown(false);
    };

    const clearSupplier = () => {
        setFormData(prev => ({ ...prev, supplierId: '' }));
        setSelectedSupplierName('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={product ? 'Chỉnh sửa Sản phẩm' : 'Thêm Sản phẩm mới'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Row 1: Code + Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Mã sản phẩm *</label>
                        <input
                            type="text"
                            required
                            value={formData.code}
                            onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                            placeholder="VD: PM-DCS-01"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Tên sản phẩm *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="VD: Hệ thống quản lý dữ liệu"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
                        />
                    </div>
                </div>

                {/* Row 2: Category + Unit */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Danh mục *</label>
                        <select
                            required
                            value={formData.category}
                            onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
                        >
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Đơn vị tính *</label>
                        <input
                            type="text"
                            required
                            value={formData.unit}
                            onChange={e => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                            placeholder="VD: Gói, m2, Tháng"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
                        />
                    </div>
                </div>

                {/* Row 3: Brand + Supplier */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Hãng / Thương hiệu</label>
                        <select
                            value={formData.brandId}
                            onChange={e => setFormData(prev => ({ ...prev, brandId: e.target.value }))}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
                        >
                            <option value="">-- Không chỉ định --</option>
                            {brands.map(brand => (
                                <option key={brand.id} value={brand.id}>{brand.name}{brand.country ? ` (${brand.country})` : ''}</option>
                            ))}
                        </select>
                    </div>
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Nhà cung cấp chính</label>
                        {selectedSupplierName ? (
                            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                                <span className="flex-1 font-medium text-slate-900 dark:text-slate-100 truncate">{selectedSupplierName}</span>
                                <button type="button" onClick={clearSupplier} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer">
                                    <X size={14} className="text-slate-400" />
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={supplierSearch}
                                    onChange={e => setSupplierSearch(e.target.value)}
                                    onFocus={() => supplierResults.length > 0 && setShowSupplierDropdown(true)}
                                    placeholder="Tìm NCC theo tên..."
                                    className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
                                />
                            </div>
                        )}
                        {showSupplierDropdown && supplierResults.length > 0 && (
                            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                {supplierResults.map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => selectSupplier(s)}
                                        className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-slate-800 text-sm transition-colors cursor-pointer"
                                    >
                                        <span className="font-medium text-slate-900 dark:text-slate-100">{s.name}</span>
                                        {s.shortName && <span className="ml-2 text-slate-400 text-xs">({s.shortName})</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Row 4: SKU + Model + Warranty */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">SKU (mã hãng)</label>
                        <input
                            type="text"
                            value={formData.sku}
                            onChange={e => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                            placeholder="VD: AEC-DCS-001"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Model / Version</label>
                        <input
                            type="text"
                            value={formData.model}
                            onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
                            placeholder="VD: v2024.1"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                            <ShieldCheck size={12} /> Bảo hành (tháng)
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={formData.warrantyMonths || ''}
                            onChange={e => setFormData(prev => ({ ...prev, warrantyMonths: parseInt(e.target.value) || 0 }))}
                            placeholder="12"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
                        />
                    </div>
                </div>

                {/* Row 5: Business Unit */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Đơn vị phụ trách</label>
                    <select
                        value={formData.unitId}
                        onChange={e => setFormData(prev => ({ ...prev, unitId: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors"
                    >
                        <option value="">-- Không chỉ định --</option>
                        {units.map(unit => (
                            <option key={unit.id} value={unit.id}>{unit.name}</option>
                        ))}
                    </select>
                </div>

                {/* Row 6: Description */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Mô tả</label>
                    <textarea
                        value={formData.description}
                        onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        placeholder="Mô tả chi tiết về sản phẩm/dịch vụ..."
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none transition-colors"
                    />
                </div>

                {/* Row 7: Prices */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Đơn giá bán (VNĐ) *</label>
                        <NumberInput
                            value={formData.basePrice}
                            onChange={(value) => setFormData(prev => ({ ...prev, basePrice: value }))}
                            placeholder="VD: 500.000.000"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Giá vốn (VNĐ)</label>
                        <NumberInput
                            value={formData.costPrice}
                            onChange={(value) => setFormData(prev => ({ ...prev, costPrice: value }))}
                            placeholder="VD: 150.000.000"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                </div>

                {/* Row 8: Active Toggle */}
                <div className="flex items-center gap-3 py-2">
                    <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                        className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${formData.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.isActive ? 'left-6' : 'left-1'}`} />
                    </button>
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                        {formData.isActive ? 'Đang bán' : 'Ngừng bán'}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {product ? 'Cập nhật' : 'Thêm mới'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ProductForm;
