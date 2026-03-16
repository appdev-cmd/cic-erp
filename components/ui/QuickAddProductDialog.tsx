import React, { useState, useEffect, useMemo } from 'react';
import { X, Package, Loader2, CheckCircle, ChevronDown, Sparkles, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { ProductService } from '../../services/productService';
import { ProductLineService, ProductLine } from '../../services/productLineService';
import { ProductEditionService, ProductEdition } from '../../services/productEditionService';
import { BrandService } from '../../services/brandService';
import { UnitService } from '../../services';
import { Product, ProductCategory, LicenseType, Brand, Unit } from '../../types';
import QuickAddBrandDialog from './QuickAddBrandDialog';

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

/**
 * Build display name from structured parts.
 * Only non-empty parts are joined with spaces.
 */
const buildProductName = (line?: string, edition?: string, license?: string): string => {
    return [line, edition, license].filter(Boolean).join(' ');
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
        return options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
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
        return brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));
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

    // Auto-build name from structured parts
    const builtName = useMemo(
        () => buildProductName(productLine, edition, licenseType),
        [productLine, edition, licenseType]
    );

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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                            <Package size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Thêm sản phẩm mới</h2>
                            <p className="text-indigo-100 text-xs">Ghép tên SP từ Dòng SP + Phiên bản + License</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { resetForm(); onClose(); }}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={18} className="text-white" />
                    </button>
                </div>

                {/* Form — scrollable */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                    {error && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-600 dark:text-rose-400 font-medium">
                            {error}
                        </div>
                    )}

                    {/* Code (auto-generated) */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                            Mã sản phẩm * <span className="normal-case font-normal">(tự sinh)</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                value={autoCode}
                                onChange={(e) => setAutoCode(e.target.value)}
                                placeholder="VD: PM-Bentley-DCS-001"
                                className="w-full px-4 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200"
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

                        <ComboboxInput
                            value={productLine}
                            onChange={setProductLine}
                            options={lineOptions}
                            placeholder="Chỉ ghi tên ngắn gọn. VD: enjiCAD, Escon, SAP2000, Tư vấn BIM..."
                            label="Dòng sản phẩm *"
                            autoFocus
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <ComboboxInput
                                value={edition}
                                onChange={setEdition}
                                options={editionOptions}
                                placeholder="VD: Pro, Standard..."
                                label="Phiên bản (tùy chọn)"
                            />
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                    License (tùy chọn)
                                </label>
                                <select
                                    value={licenseType}
                                    onChange={(e) => setLicenseType(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200"
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
                                <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 truncate">{builtName}</span>
                            </div>
                        )}
                    </div>

                    {/* Category + Unit */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Danh mục *</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200"
                            >
                                {CATEGORY_MAP.map(cat => (
                                    <option key={cat.label} value={cat.label}>{cat.label} ({cat.code})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Đơn vị tính *</label>
                            <input
                                type="text"
                                value={unit}
                                onChange={(e) => setUnit(e.target.value)}
                                placeholder="VD: Bộ, Gói, m2, Tháng"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200"
                            />
                        </div>
                    </div>

                    {/* Brand (required) */}
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

                    {/* Đơn vị phụ trách */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Đơn vị phụ trách</label>
                        <select
                            value={unitId}
                            onChange={(e) => setUnitId(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200"
                        >
                            <option value="">-- Không chỉ định --</option>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                            ))}
                        </select>
                    </div>

                    {/* Prices (optional) */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Giá bán (tùy chọn)</label>
                            <input
                                type="text"
                                value={basePrice ? formatVND(basePrice) : ''}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\./g, '');
                                    if (/^\d*$/.test(raw)) setBasePrice(Number(raw));
                                }}
                                placeholder="0"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-right focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Giá vốn (tùy chọn)</label>
                            <input
                                type="text"
                                value={costPrice ? formatVND(costPrice) : ''}
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\./g, '');
                                    if (/^\d*$/.test(raw)) setCostPrice(Number(raw));
                                }}
                                placeholder="0"
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-right focus:border-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Mô tả (tùy chọn)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Mô tả ngắn..."
                            rows={2}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 outline-none transition-all resize-none text-slate-800 dark:text-slate-200"
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
                            disabled={isSubmitting || !builtName.trim()}
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
    </>);
};

export default QuickAddProductDialog;
