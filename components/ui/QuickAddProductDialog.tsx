import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, ChevronDown, Sparkles, Plus, RefreshCw, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import Modal from './Modal';
import { ProductService } from '../../services/productService';
import { ProductLineService, ProductLine } from '../../services/productLineService';
import { ProductEditionService, ProductEdition } from '../../services/productEditionService';
import { BrandService } from '../../services/brandService';
import { UnitService, CustomerService } from '../../services';
import { Product, ProductCategory, LicenseType, Brand, Unit, Customer } from '../../types';
import QuickAddBrandDialog from './QuickAddBrandDialog';
import QuickAddSupplierDialog from './QuickAddSupplierDialog';
import { removeDiacritics } from '../../utils/formatters';

interface QuickAddProductDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (product: Product) => void;
    initialName?: string;
}

/** Category with abbreviation code for auto-code generation */
const CATEGORY_MAP: { label: string; code: string }[] = [
    { label: 'Phần mềm', code: 'PM' },
    { label: 'Thiết bị', code: 'TB' },
    { label: 'Tư vấn', code: 'TV' },
    { label: 'Bảo trì', code: 'BT' },
    { label: 'Đào tạo', code: 'ĐT' },
    { label: 'Khác', code: 'K' },
];
const CATEGORIES = CATEGORY_MAP.map(c => c.label);
const getCategoryCode = (label: string) => CATEGORY_MAP.find(c => c.label === label)?.code || 'K';

const LICENSE_TYPES: LicenseType[] = ['Standalone', 'Network', 'Hardlock'];

const formatVND = (value: number) => new Intl.NumberFormat('vi-VN').format(Math.round(value));

/** Categories that get auto-prepended to the product name */
const PREFIXED_CATEGORIES = ['Phần mềm', 'Thiết bị'];

/**
 * Build display name from structured parts.
 * If category is Phần mềm or Thiết bị, prepend it as a prefix.
 */
const buildProductName = (category: string, line?: string, edition?: string): string => {
    const parts = [line, edition].filter(Boolean);
    if (parts.length === 0) return '';
    const base = parts.join(' ');
    if (PREFIXED_CATEGORIES.includes(category)) {
        return `${category} ${base}`;
    }
    return base;
};

/**
 * Combobox component: dropdown with search + type-to-add-new
 */
const ComboboxInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder: string;
    label: string;
    autoFocus?: boolean;
}> = ({ value, onChange, options, placeholder, label, autoFocus }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

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
        <div className="relative space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{label}</label>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className="w-full px-4 py-2.5 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400"
                />
                <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
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
 * Brand Combobox: select existing brand + quick add
 */
const BrandComboboxQuick: React.FC<{
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
        <div className="relative space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Hãng / Thương hiệu *</label>
            <div className="relative">
                {value ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
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
                            className="w-full px-4 py-2.5 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400"
                        />
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </>
                )}
            </div>
            {isOpen && !value && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-auto animate-in fade-in slide-in-from-top-2 duration-150">
                    {filtered.map((brand) => (
                        <button
                            key={brand.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelect(brand)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-slate-700 dark:text-slate-300"
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
                            className="w-full text-left px-4 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors border-t border-slate-100 dark:border-slate-700 flex items-center gap-2"
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

const QuickAddProductDialog: React.FC<QuickAddProductDialogProps> = ({
    isOpen,
    onClose,
    onCreated,
    initialName = ''
}) => {
    // Structured name fields
    const [productLine, setProductLine] = useState('');
    const [edition, setEdition] = useState('');
    const [licenseType, setLicenseType] = useState('');

    // Lookup data
    const [productLines, setProductLines] = useState<ProductLine[]>([]);
    const [productEditions, setProductEditions] = useState<ProductEdition[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);

    // Other fields
    const [category, setCategory] = useState<ProductCategory>('Phần mềm');
    const [unit, setUnit] = useState('Bộ');
    const [unitId, setUnitId] = useState('');
    const [brandId, setBrandId] = useState('');
    const [brandName, setBrandName] = useState('');
    const [autoCode, setAutoCode] = useState('');
    const [basePrice, setBasePrice] = useState<number>(0);
    const [costPrice, setCostPrice] = useState<number>(0);
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [error, setError] = useState('');
    const [brandDialogOpen, setBrandDialogOpen] = useState(false);
    const [brandDialogInitial, setBrandDialogInitial] = useState('');

    // Supplier fields
    const [supplierId, setSupplierId] = useState('');
    const [supplierSearch, setSupplierSearch] = useState('');
    const [supplierResults, setSupplierResults] = useState<Customer[]>([]);
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
    const [selectedSupplierName, setSelectedSupplierName] = useState('');
    const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
    const [supplierDialogInitial, setSupplierDialogInitial] = useState('');

    // Duplicate name check
    const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null);
    const duplicateTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-build name from structured parts (with category prefix for PM/TB)
    const builtName = useMemo(
        () => buildProductName(category, productLine, edition),
        [category, productLine, edition]
    );

    // Debounced duplicate name check
    useEffect(() => {
        if (duplicateTimerRef.current) clearTimeout(duplicateTimerRef.current);
        if (!builtName || builtName.trim().length < 3) {
            setDuplicateProduct(null);
            return;
        }
        duplicateTimerRef.current = setTimeout(async () => {
            const existing = await ProductService.checkNameExists(builtName.trim());
            setDuplicateProduct(existing);
        }, 500);
        return () => { if (duplicateTimerRef.current) clearTimeout(duplicateTimerRef.current); };
    }, [builtName]);

    const refreshBrands = () => {
        BrandService.getActive().then(setBrands).catch(() => {});
    };

    // Auto-generate code
    const generateCode = async (cat?: string, bName?: string, uId?: string) => {
        const catCode = getCategoryCode(cat || category);
        const brand = bName ?? brandName;
        const unitObj = units.find(u => u.id === (uId ?? unitId));
        const uCode = unitObj?.code || '';

        const parts = [catCode, brand, uCode].filter(Boolean);
        if (parts.length === 0) return;

        const prefix = parts.join('-');
        setIsGeneratingCode(true);
        try {
            const code = await ProductService.getNextCode(prefix);
            setAutoCode(code);
        } catch (err) {
            console.error('Auto-code error:', err);
        } finally {
            setIsGeneratingCode(false);
        }
    };

    // Re-generate code when deps change
    useEffect(() => {
        if (isOpen && (category || brandName || unitId)) {
            generateCode();
        }
    }, [category, brandName, unitId, units]);

    // Load lookup data
    useEffect(() => {
        if (isOpen) {
            ProductLineService.getAll().then(setProductLines).catch(() => {});
            ProductEditionService.getAll().then(setProductEditions).catch(() => {});
            refreshBrands();
            UnitService.getActive().then(setUnits).catch(() => {});
            if (initialName) {
                setProductLine(initialName);
            }
        }
    }, [isOpen, initialName]);

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

    const selectSupplier = (supplier: Customer) => {
        setSupplierId(supplier.id);
        setSelectedSupplierName(supplier.name);
        setSupplierSearch('');
        setShowSupplierDropdown(false);
    };

    const clearSupplier = () => {
        setSupplierId('');
        setSelectedSupplierName('');
    };

    const resetForm = () => {
        setProductLine('');
        setEdition('');
        setLicenseType('');
        setCategory('Phần mềm');
        setUnit('Bộ');
        setUnitId('');
        setBrandId('');
        setBrandName('');
        setAutoCode('');
        setBasePrice(0);
        setCostPrice(0);
        setDescription('');
        setError('');
        setSupplierId('');
        setSelectedSupplierName('');
        setSupplierSearch('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const finalName = builtName.trim();
        if (!finalName) {
            setError('Vui lòng nhập ít nhất Dòng sản phẩm');
            return;
        }
        if (!brandId) {
            setError('Vui lòng chọn hoặc thêm Hãng/Thương hiệu');
            return;
        }
        if (duplicateProduct) {
            setError(`Sản phẩm "${finalName}" đã tồn tại (Mã: ${duplicateProduct.code}). Vui lòng kiểm tra lại.`);
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Persist new lookup values
            if (productLine.trim()) {
                await ProductLineService.findOrCreate(productLine.trim());
            }
            if (edition.trim()) {
                await ProductEditionService.findOrCreate(edition.trim());
            }

            const newProduct = await ProductService.create({
                code: autoCode || `SP-${Date.now()}`,
                name: finalName,
                productLine: productLine.trim() || undefined,
                edition: edition.trim() || undefined,
                licenseType: (licenseType as LicenseType) || undefined,
                category,
                unit,
                unitId: unitId || undefined,
                brandId: brandId || undefined,
                supplierId: supplierId || undefined,
                basePrice,
                costPrice,
                description: description.trim(),
                isActive: true
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

    const lineOptions = productLines.map(pl => pl.name);
    const editionOptions = productEditions.map(pe => pe.name);

    return (<>
        <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Thêm Sản phẩm mới" size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-600 dark:text-rose-400 font-medium">
                        {error}
                    </div>
                )}

                {/* Row 1: Code (auto-generated) */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                        Mã sản phẩm * <span className="text-slate-400 dark:text-slate-500 normal-case font-normal">(tự sinh theo [Danh mục]-[Hãng]-[ĐVPT]-[STT])</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            required
                            value={autoCode}
                            onChange={(e) => setAutoCode(e.target.value)}
                            placeholder="VD: PM-Bentley-DCS-001"
                            className="w-full px-4 py-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono font-bold transition-colors text-slate-800 dark:text-slate-200"
                        />
                        <button
                            type="button"
                            onClick={() => generateCode()}
                            disabled={isGeneratingCode}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                            title="Tạo lại mã"
                        >
                            <RefreshCw size={14} className={`text-slate-400 ${isGeneratingCode ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* ── STRUCTURED NAME BUILDER ── */}
                <div className="space-y-3 p-4 bg-gradient-to-br from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles size={14} className="text-indigo-500" />
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Cấu trúc tên sản phẩm</span>
                    </div>

                    {/* Row 1: Danh mục + Sản phẩm */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Danh mục *</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200"
                            >
                                {CATEGORY_MAP.map(cat => (
                                    <option key={cat.label} value={cat.label}>{cat.label} ({cat.code})</option>
                                ))}
                            </select>
                        </div>
                        <ComboboxInput
                            value={productLine}
                            onChange={setProductLine}
                            options={lineOptions}
                            placeholder="VD: enjiCAD, Escon..."
                            label="Sản phẩm *"
                            autoFocus
                        />
                    </div>

                    {/* Row 2: Phiên bản + License */}
                    <div className="grid grid-cols-2 gap-3">
                        <ComboboxInput
                            value={edition}
                            onChange={setEdition}
                            options={editionOptions}
                            placeholder="VD: Pro, Standard..."
                            label="Phiên bản (tùy chọn)"
                        />
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                                License (tùy chọn)
                            </label>
                            <select
                                value={licenseType}
                                onChange={(e) => setLicenseType(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200"
                            >
                                <option value="">— Không chọn —</option>
                                {LICENSE_TYPES.map(lt => (
                                    <option key={lt} value={lt}>{lt}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {builtName && (
                        <div className="mt-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Tên SP:</span>
                            <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 truncate flex-1">{builtName}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">ĐVT:</span>
                            <input
                                type="text"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-sm font-bold text-center focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200"
                            />
                        </div>
                    )}
                    {!builtName && (
                        <div className="mt-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">ĐVT:</span>
                            <input
                                type="text"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                placeholder="Bộ"
                                className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-sm font-bold text-center focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200"
                            />
                        </div>
                    )}
                    {duplicateProduct && (
                        <div className="mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg flex items-start gap-2">
                            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                            <div className="text-xs text-amber-700 dark:text-amber-400">
                                <span className="font-bold">Trùng tên!</span> Sản phẩm <span className="font-bold">"{duplicateProduct.name}"</span> đã tồn tại (Mã: {duplicateProduct.code}).
                            </div>
                        </div>
                    )}
                </div>

                {/* Row 3: Brand + Supplier (same row) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <BrandComboboxQuick
                        value={brandId}
                        brandName={brandName}
                        brands={brands}
                        onChange={(id, name) => { setBrandId(id); setBrandName(name); }}
                        onAddNew={(text) => {
                            setBrandDialogInitial(text);
                            setBrandDialogOpen(true);
                        }}
                    />
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Nhà cung cấp chính</label>
                        <div className="relative">
                            {supplierId ? (
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
                                        onChange={(e) => {
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
                        {showSupplierDropdown && !supplierId && (
                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-auto">
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
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Đơn vị phụ trách</label>
                    <select
                        value={unitId}
                        onChange={(e) => setUnitId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200"
                    >
                        <option value="">-- Không chỉ định --</option>
                        {units.map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                        ))}
                    </select>
                </div>

                {/* Row 5: Description */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Mô tả</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Mô tả chi tiết về sản phẩm/dịch vụ..."
                        rows={3}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none transition-colors text-slate-800 dark:text-slate-200"
                    />
                </div>

                {/* Row 6: Prices (optional) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Đơn giá bán (VNĐ)</label>
                        <input
                            type="text"
                            value={basePrice ? formatVND(basePrice) : ''}
                            onChange={(e) => {
                                const raw = e.target.value.replace(/\./g, '');
                                if (/^\d*$/.test(raw)) setBasePrice(Number(raw));
                            }}
                            placeholder="0"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-right transition-colors text-slate-800 dark:text-slate-200"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Giá vốn (VNĐ)</label>
                        <input
                            type="text"
                            value={costPrice ? formatVND(costPrice) : ''}
                            onChange={(e) => {
                                const raw = e.target.value.replace(/\./g, '');
                                if (/^\d*$/.test(raw)) setCostPrice(Number(raw));
                            }}
                            placeholder="0"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-right transition-colors text-slate-800 dark:text-slate-200"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={() => { resetForm(); onClose(); }}
                        className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || !builtName.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Tạo & Chọn
                    </button>
                </div>
            </form>

            {/* Quick Add Brand Dialog */}
            <QuickAddBrandDialog
                isOpen={brandDialogOpen}
                onClose={() => setBrandDialogOpen(false)}
                onCreated={(brand) => {
                    setBrandId(brand.id);
                    setBrandName(brand.name);
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
                    setSupplierId(supplier.id);
                    setSelectedSupplierName(supplier.name);
                    setSupplierDialogOpen(false);
                }}
                initialName={supplierDialogInitial}
            />
        </Modal>
    </>);
};

export default QuickAddProductDialog;
