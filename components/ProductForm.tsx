import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Save, X, Loader2, Search, ChevronDown, Sparkles, Plus, RefreshCw, AlertTriangle } from 'lucide-react';
import Modal from './ui/Modal';
import NumberInput from './ui/NumberInput';
import QuickAddBrandDialog from './ui/QuickAddBrandDialog';
import QuickAddSupplierDialog from './ui/QuickAddSupplierDialog';
import { Product, ProductCategory, Unit, Brand, Customer } from '../types';
import { UnitService, BrandService, CustomerService, ProductLineService, ProductEditionService } from '../services';
import { ProductService } from '../services/productService';
import { ProductLine } from '../services/productLineService';
import { ProductEdition } from '../services/productEditionService';
import { removeDiacritics, generateSlug } from '../utils/formatters';
import RichTextEditor from './ui/RichTextEditor';

interface ProductFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Omit<Product, 'id'> | Product) => Promise<void>;
    product?: Product; // If provided, we're editing
}

/** Category with abbreviation code for auto-code generation */
const CATEGORY_MAP: { label: string; code: string }[] = [
    { label: 'Phần mềm', code: 'PM' },
    { label: 'Thiết bị', code: 'TB' },
    { label: 'Tư vấn', code: 'TV' },
    { label: 'Dịch vụ', code: 'DV' },
    { label: 'Bảo trì', code: 'BT' },
    { label: 'Đào tạo', code: 'ĐT' },
    { label: 'Khác', code: 'K' },
];
const CATEGORIES = CATEGORY_MAP.map(c => c.label);
const getCategoryCode = (label: string) => CATEGORY_MAP.find(c => c.label === label)?.code || 'K';



/**
 * Combobox: dropdown with search + type-to-add
 */
const ComboboxInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder: string;
    label: string;
}> = ({ value, onChange, options, placeholder, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search) return options;
        const q = removeDiacritics(search.toLowerCase());
        return options.filter(o => removeDiacritics(o.toLowerCase()).includes(q));
    }, [options, search]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setSearch(v);
        onChange(v);
        if (!isOpen) setIsOpen(true);
    };

    const handleSelect = (opt: string) => {
        onChange(opt);
        setSearch('');
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{label}</label>
            <div className="relative">
                <input
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200 placeholder-slate-400"
                />
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {isOpen && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-auto animate-in fade-in slide-in-from-top-2 duration-150">
                    {filtered.map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelect(opt)}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${
                                opt === value
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold'
                                    : 'text-slate-700 dark:text-slate-300'
                            }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Brand Combobox: select existing brand + type to add new
 */
const BrandCombobox: React.FC<{
    value: string;
    brandName: string;
    brands: Brand[];
    onChange: (brandId: string, brandName: string) => void;
    onAddNew: (searchText: string) => void;
}> = ({ value, brandName, brands, onChange, onAddNew }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search) return brands;
        const q = removeDiacritics(search.toLowerCase());
        return brands.filter(b => removeDiacritics(b.name.toLowerCase()).includes(q));
    }, [brands, search]);

    const displayValue = value ? (brandName || brands.find(b => b.id === value)?.name || '') : search;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        if (value) onChange('', '');
        if (!isOpen) setIsOpen(true);
    };

    const handleSelect = (brand: Brand) => {
        onChange(brand.id, brand.name);
        setSearch('');
        setIsOpen(false);
    };

    const handleAddNew = () => {
        if (!search.trim()) return;
        setIsOpen(false);
        onAddNew(search.trim());
    };

    const handleClear = () => {
        onChange('', '');
        setSearch('');
    };

    return (
        <div className="relative">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                Hãng / Thương hiệu *
            </label>
            <div className="relative">
                {value ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                        <span className="flex-1 font-medium text-slate-900 dark:text-slate-100 truncate">{displayValue}</span>
                        <button type="button" onClick={handleClear} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer">
                            <X size={14} className="text-slate-400" />
                        </button>
                    </div>
                ) : (
                    <>
                        <input
                            type="text"
                            value={search}
                            onChange={handleInputChange}
                            onFocus={() => setIsOpen(true)}
                            onBlur={() => setTimeout(() => setIsOpen(false), 250)}
                            placeholder="Gõ tên hãng hoặc chọn..."
                            className="w-full px-4 py-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200 placeholder-slate-400"
                        />
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </>
                )}
            </div>
            {isOpen && !value && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-56 overflow-auto animate-in fade-in slide-in-from-top-2 duration-150">
                    {filtered.map((brand) => (
                        <button
                            key={brand.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelect(brand)}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-slate-700 dark:text-slate-300"
                        >
                            {brand.name}
                            {brand.country && <span className="ml-2 text-slate-400 text-xs">({brand.country})</span>}
                        </button>
                    ))}
                    {search.trim() && !filtered.some(b => b.name.toLowerCase() === search.trim().toLowerCase()) && (
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleAddNew}
                            className="w-full text-left px-4 py-2.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors border-t border-slate-100 dark:border-slate-700 flex items-center gap-2"
                        >
                            <Plus size={14} />
                            Thêm hãng "{search.trim()}"
                        </button>
                    )}
                    {filtered.length === 0 && !search.trim() && (
                        <div className="px-4 py-3 text-sm text-slate-400 text-center">Chưa có hãng nào</div>
                    )}
                </div>
            )}
        </div>
    );
};

/** All categories get auto-prepended to the product name */
const PREFIXED_CATEGORIES = CATEGORIES;

const buildProductName = (category: string, line?: string, edition?: string): string => {
    const parts = [line, edition].filter(Boolean);
    if (parts.length === 0) return '';
    const base = parts.join(' ');
    if (PREFIXED_CATEGORIES.includes(category)) {
        return `${category} ${base}`;
    }
    return base;
};

const ProductForm: React.FC<ProductFormProps> = ({ isOpen, onClose, onSave, product }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        category: 'Phần mềm' as ProductCategory,
        description: '',
        unit: 'Bộ',
        basePrice: 0,
        costPrice: 0,
        isActive: true,
        unitId: '',
        productLine: '',
        edition: '',
        brandId: '',
        supplierId: '',
        isPublishedWeb: false,
        isFeaturedWeb: false,
        slug: '',
        summary: '',
        seoTitle: '',
        seoDescription: '',
        featuresDetails: '',
        systemRequirements: '',
        videoUrl: '',
        brochureUrl: '',
        demoUrl: '',
    });

    const [activeTab, setActiveTab] = useState<'basic' | 'web' | 'contracts'>('basic');

    // Data lists
    const [units, setUnits] = useState<Unit[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [productLines, setProductLines] = useState<ProductLine[]>([]);
    const [productEditions, setProductEditions] = useState<ProductEdition[]>([]);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [supplierResults, setSupplierResults] = useState<Customer[]>([]);
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [selectedSupplierName, setSelectedSupplierName] = useState('');
    const [selectedBrandName, setSelectedBrandName] = useState('');
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [brandDialogOpen, setBrandDialogOpen] = useState(false);
    const [brandDialogInitial, setBrandDialogInitial] = useState('');
    const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
    const [supplierDialogInitial, setSupplierDialogInitial] = useState('');

    // Duplicate name check
    const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null);
    const duplicateTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-build name from structured parts (with category prefix for PM/TB)
    const builtName = useMemo(
        () => buildProductName(formData.category, formData.productLine, formData.edition),
        [formData.category, formData.productLine, formData.edition]
    );

    // Auto-generate slug when name changes (only if empty or creating new)
    useEffect(() => {
        if (!product && builtName) {
            setFormData(prev => ({ ...prev, slug: generateSlug(builtName) }));
        }
    }, [builtName, product]);

    // Debounced duplicate name check
    useEffect(() => {
        if (duplicateTimerRef.current) clearTimeout(duplicateTimerRef.current);
        const nameToCheck = builtName;
        if (!nameToCheck || nameToCheck.trim().length < 3) {
            setDuplicateProduct(null);
            return;
        }
        duplicateTimerRef.current = setTimeout(async () => {
            const existing = await ProductService.checkNameExists(nameToCheck.trim(), product?.id);
            setDuplicateProduct(existing);
        }, 500);
        return () => { if (duplicateTimerRef.current) clearTimeout(duplicateTimerRef.current); };
    }, [builtName, product?.id]);

    const refreshBrands = () => {
        BrandService.getActive().then(setBrands).catch(console.error);
    };

    // Auto-generate code when category, brand, or unit changes
    const generateCode = async () => {
        const catCode = getCategoryCode(formData.category);
        const bName = selectedBrandName || '';
        const unitObj = units.find(u => u.id === formData.unitId);
        const unitCode = unitObj?.code || '';

        const parts = [catCode, bName, unitCode].filter(Boolean);
        if (parts.length === 0) return;

        const prefix = parts.join('-');
        setIsGeneratingCode(true);
        try {
            const code = await ProductService.getNextCode(prefix);
            setFormData(prev => ({ ...prev, code }));
        } catch (err) {
            console.error('Auto-code error:', err);
        } finally {
            setIsGeneratingCode(false);
        }
    };

    // Re-generate code when category/brand/unit change (only for new products)
    useEffect(() => {
        if (isOpen && (formData.category || selectedBrandName || formData.unitId)) {
            generateCode();
        }
    }, [formData.category, selectedBrandName, formData.unitId, units]);

    // Load reference data
    useEffect(() => {
        if (isOpen) {
            UnitService.getActive().then(setUnits).catch(console.error);
            refreshBrands();
            ProductLineService.getAll().then(setProductLines).catch(console.error);
            ProductEditionService.getAll().then(setProductEditions).catch(console.error);
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
                productLine: product.productLine || '',
                edition: product.edition || '',
                brandId: product.brandId || '',
                supplierId: product.supplierId || '',
                isPublishedWeb: product.isPublishedWeb || false,
                isFeaturedWeb: product.isFeaturedWeb || false,
                slug: product.slug || '',
                summary: product.summary || '',
                seoTitle: product.seoTitle || '',
                seoDescription: product.seoDescription || '',
                featuresDetails: product.featuresDetails || '',
                systemRequirements: product.systemRequirements || '',
                videoUrl: product.videoUrl || '',
                brochureUrl: product.brochureUrl || '',
                demoUrl: product.demoUrl || '',
            });
            setSelectedSupplierName(product.supplierName || '');
            setSelectedBrandName(product.brandName || '');
        } else {
            setFormData({
                code: '',
                name: '',
                category: 'Phần mềm',
                description: '',
                unit: 'Bộ',
                basePrice: 0,
                costPrice: 0,
                isActive: true,
                unitId: '',
                productLine: '',
                edition: '',
                brandId: '',
                supplierId: '',
                isPublishedWeb: false,
                isFeaturedWeb: false,
                slug: '',
                summary: '',
                seoTitle: '',
                seoDescription: '',
                featuresDetails: '',
                systemRequirements: '',
                videoUrl: '',
                brochureUrl: '',
                demoUrl: '',
            });
            setActiveTab('basic');
            setSelectedSupplierName('');
            setSelectedBrandName('');
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

        // Validate brand (required)
        if (!formData.brandId) {
            toast.error('Vui lòng chọn hoặc thêm Hãng/Thương hiệu');
            return;
        }
        if (duplicateProduct) {
            toast.error(`Sản phẩm "${builtName}" đã tồn tại (Mã: ${duplicateProduct.code}). Vui lòng kiểm tra lại.`);
            return;
        }

        setIsSubmitting(true);
        try {
            let submitData = { ...formData };
            if (builtName.trim()) {
                submitData.name = builtName.trim();
            }

            // Persist new lookup values
            if (submitData.productLine?.trim()) {
                await ProductLineService.findOrCreate(submitData.productLine.trim());
            }
            if (submitData.edition?.trim()) {
                await ProductEditionService.findOrCreate(submitData.edition.trim());
            }

            if (product) {
                await onSave({ ...submitData, id: product.id });
            } else {
                await onSave(submitData);
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

    const lineOptions = productLines.map(pl => pl.name);
    const editionOptions = productEditions.map(pe => pe.name);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={product ? 'Chỉnh sửa Sản phẩm' : 'Thêm Sản phẩm mới'} size="lg">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-6">
                <button
                    onClick={() => setActiveTab('basic')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'basic' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}
                >
                    Thông tin cơ bản
                </button>
                <button
                    onClick={() => setActiveTab('web')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'web' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}
                >
                    Web & Marketing
                </button>
                <button
                    onClick={() => setActiveTab('contracts')}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'contracts' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}
                >
                    Hợp đồng liên quan
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* ── TAB: THÔNG TIN CƠ BẢN ── */}
                <div className={activeTab === 'basic' ? 'block space-y-5' : 'hidden'}>
                {/* Row 1: Code (auto-generated) */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                        Mã sản phẩm * <span className="text-slate-400 dark:text-slate-500 normal-case font-normal">(tự sinh theo [Danh mục]-[Hãng]-[ĐVPT]-[STT])</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            required
                            value={formData.code}
                            onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                            placeholder="VD: PM-Bentley-DCS-001"
                            className="w-full px-4 py-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono font-bold transition-colors text-slate-800 dark:text-slate-200"
                        />
                        {!product && (
                            <button
                                type="button"
                                onClick={generateCode}
                                disabled={isGeneratingCode}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                                title="Tạo lại mã"
                            >
                                <RefreshCw size={14} className={`text-slate-400 ${isGeneratingCode ? 'animate-spin' : ''}`} />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── STRUCTURED NAME BUILDER ── */}
                <div className="space-y-3 p-4 bg-gradient-to-br from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles size={14} className="text-indigo-500" />
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Cấu trúc tên sản phẩm</span>
                    </div>

                    {/* Row 1: Danh mục + Dòng sản phẩm */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Danh mục *</label>
                            <select
                                required
                                value={formData.category}
                                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200"
                            >
                                {CATEGORY_MAP.map(cat => (
                                    <option key={cat.label} value={cat.label}>{cat.label} ({cat.code})</option>
                                ))}
                            </select>
                        </div>
                        <ComboboxInput
                            value={formData.productLine}
                            onChange={(v) => setFormData(prev => ({ ...prev, productLine: v }))}
                            options={lineOptions}
                            placeholder="VD: enjiCAD, Escon..."
                            label="Sản phẩm *"
                        />
                    </div>

                    {/* Row 2: Phiên bản + Đơn vị tính */}
                    <div className="grid grid-cols-2 gap-3">
                        <ComboboxInput
                            value={formData.edition}
                            onChange={(v) => setFormData(prev => ({ ...prev, edition: v }))}
                            options={editionOptions}
                            placeholder="VD: Pro, Standard..."
                            label="Phiên bản (tùy chọn)"
                        />
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                Đơn vị tính *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.unit}
                                onChange={e => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                                placeholder="VD: Bộ, Gói, m2, Tháng"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200"
                            />
                        </div>
                    </div>

                    {builtName && (
                        <div className="mt-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Tên SP:</span>
                            <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 truncate flex-1">{builtName}</span>
                        </div>
                    )}
                </div>

                {/* Duplicate warning */}
                {duplicateProduct && (
                    <div className="-mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg flex items-start gap-2">
                        <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                        <div className="text-xs text-amber-700 dark:text-amber-400">
                            <span className="font-bold">Trùng tên!</span> Sản phẩm <span className="font-bold">"{duplicateProduct.name}"</span> đã tồn tại (Mã: {duplicateProduct.code}).
                        </div>
                    </div>
                )}

                {/* Row 3: Brand (required, combobox with add-new) + Supplier */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <BrandCombobox
                        value={formData.brandId}
                        brandName={selectedBrandName}
                        brands={brands}
                        onChange={(id, name) => {
                            setFormData(prev => ({ ...prev, brandId: id }));
                            setSelectedBrandName(name);
                        }}
                        onAddNew={(text) => {
                            setBrandDialogInitial(text);
                            setBrandDialogOpen(true);
                        }}
                    />
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Nhà cung cấp chính</label>
                        <div className="relative">
                            {formData.supplierId ? (
                                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                                    <span className="flex-1 font-medium text-slate-900 dark:text-slate-100 truncate">{selectedSupplierName}</span>
                                    <button type="button" onClick={clearSupplier} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer">
                                        <X size={14} className="text-slate-400" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        value={supplierSearch}
                                        onChange={e => {
                                            setSupplierSearch(e.target.value);
                                            if (!showSupplierDropdown) setShowSupplierDropdown(true);
                                        }}
                                        onFocus={() => setShowSupplierDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 250)}
                                        placeholder="Gõ tên NCC hoặc chọn..."
                                        className="w-full px-4 py-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200 placeholder-slate-400"
                                    />
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </>
                            )}
                        </div>
                        {showSupplierDropdown && !formData.supplierId && (
                            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                {supplierResults.map(s => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => selectSupplier(s)}
                                        className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-slate-800 text-sm transition-colors cursor-pointer"
                                    >
                                        {s.name}
                                        {s.shortName && <span className="ml-2 text-slate-400 text-xs">({s.shortName})</span>}
                                    </button>
                                ))}
                                {supplierSearch.trim() && !supplierResults.some(s => s.name.toLowerCase() === supplierSearch.trim().toLowerCase()) && (
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            setSupplierDialogInitial(supplierSearch.trim());
                                            setSupplierDialogOpen(true);
                                            setShowSupplierDropdown(false);
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors border-t border-slate-100 dark:border-slate-700 flex items-center gap-2"
                                    >
                                        <Plus size={14} />
                                        Thêm NCC "{supplierSearch.trim()}"
                                    </button>
                                )}
                                {supplierResults.length === 0 && !supplierSearch.trim() && (
                                    <div className="px-4 py-3 text-sm text-slate-400 text-center">Gõ tên để tìm NCC</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Row 4: Business Unit */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Đơn vị phụ trách</label>
                        <select
                            value={formData.unitId}
                            onChange={e => setFormData(prev => ({ ...prev, unitId: e.target.value }))}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200"
                        >
                            <option value="">-- Không chỉ định --</option>
                            {units.map(unit => (
                                <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>
                            ))}
                        </select>
                    </div>
                </div>
                </div>

                {/* ── TAB: WEB & MARKETING ── */}
                <div className={activeTab === 'web' ? 'block space-y-5' : 'hidden'}>

                {/* Row 5: Web Content & Description */}
                <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex items-center gap-2 mb-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200">Thông tin xuất bản Website</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Đường dẫn tĩnh (Slug)</label>
                            <input
                                type="text"
                                value={formData.slug}
                                onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                                placeholder="VD: pmbentleydcs001"
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                            />
                        </div>
                        <div className="flex items-center gap-4 mt-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isPublishedWeb}
                                    onChange={e => setFormData(prev => ({ ...prev, isPublishedWeb: e.target.checked }))}
                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Hiển thị trên Web</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isFeaturedWeb}
                                    onChange={e => setFormData(prev => ({ ...prev, isFeaturedWeb: e.target.checked }))}
                                    className="w-4 h-4 text-orange-500 rounded border-slate-300"
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Sản phẩm tiêu biểu</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Tóm tắt ngắn (Summary)</label>
                        <textarea
                            value={formData.summary}
                            onChange={e => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                            rows={2}
                            placeholder="Mô tả tóm tắt..."
                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none transition-colors text-slate-800 dark:text-slate-200"
                        />
                    </div>

                    <div>
                        <RichTextEditor
                            label="Mô tả chi tiết"
                            value={formData.description}
                            onChange={(val) => setFormData(prev => ({ ...prev, description: val }))}
                            minHeight="200px"
                        />
                    </div>
                </div>

                {/* Row 6: Prices (optional) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Đơn giá bán (VNĐ)</label>
                        <NumberInput
                            value={formData.basePrice}
                            onChange={(value) => setFormData(prev => ({ ...prev, basePrice: value }))}
                            placeholder="VD: 500.000.000"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Video Youtube (Link)</label>
                            <input
                                type="text"
                                value={formData.videoUrl}
                                onChange={e => setFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
                                placeholder="https://youtube.com/watch?v=..."
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Link tải Demo (.exe / .zip)</label>
                            <input
                                type="text"
                                value={formData.demoUrl}
                                onChange={e => setFormData(prev => ({ ...prev, demoUrl: e.target.value }))}
                                placeholder="https://..."
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Tài liệu giới thiệu / Brochure (.pdf)</label>
                            <input
                                type="text"
                                value={formData.brochureUrl}
                                onChange={e => setFormData(prev => ({ ...prev, brochureUrl: e.target.value }))}
                                placeholder="https://..."
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                            />
                        </div>
                    </div>

                    <div>
                        <RichTextEditor
                            label="Tính năng chính (Dành riêng cho Web)"
                            value={formData.featuresDetails}
                            onChange={(val) => setFormData(prev => ({ ...prev, featuresDetails: val }))}
                            minHeight="150px"
                        />
                    </div>
                    
                    <div>
                        <RichTextEditor
                            label="Yêu cầu hệ thống (System Requirements)"
                            value={formData.systemRequirements}
                            onChange={(val) => setFormData(prev => ({ ...prev, systemRequirements: val }))}
                            minHeight="150px"
                        />
                    </div>
                </div>
                </div>

                {/* ── TAB: HỢP ĐỒNG LIÊN QUAN ── */}
                <div className={activeTab === 'contracts' ? 'block' : 'hidden'}>
                    {!product ? (
                        <div className="p-8 text-center text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            Vui lòng lưu sản phẩm trước khi xem các hợp đồng liên quan.
                        </div>
                    ) : (
                        <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Chưa có dữ liệu Hợp đồng liên quan</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Tính năng liệt kê hợp đồng dựa trên hóa đơn có chứa sản phẩm "{product.name}" đang được hoàn thiện.
                            </p>
                        </div>
                    )}
                </div>

                {/* Row 7: Active Toggle */}
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

            {/* Quick Add Brand Dialog */}
            <QuickAddBrandDialog
                isOpen={brandDialogOpen}
                onClose={() => setBrandDialogOpen(false)}
                onCreated={(brand) => {
                    setFormData(prev => ({ ...prev, brandId: brand.id }));
                    setSelectedBrandName(brand.name);
                    refreshBrands();
                    setBrandDialogOpen(false);
                }}
                initialName={brandDialogInitial}
            />

            {/* Quick Add Supplier Dialog */}
            <QuickAddSupplierDialog
                isOpen={supplierDialogOpen}
                onClose={() => setSupplierDialogOpen(false)}
                onCreated={(supplier) => {
                    setFormData(prev => ({ ...prev, supplierId: supplier.id }));
                    setSelectedSupplierName(supplier.name);
                    setSupplierDialogOpen(false);
                }}
                initialName={supplierDialogInitial}
            />
        </Modal>
    );
};

export default ProductForm;
