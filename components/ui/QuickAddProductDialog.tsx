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
import { PRODUCT_CATEGORY_MAP } from '../../constants';
import { buildProductName, getCategoryCode } from '../../utils/productHelpers';
import { ComboboxInput } from '../product/ComboboxInput';
import { BrandCombobox } from '../product/BrandCombobox';
import { SupplierCombobox } from '../product/SupplierCombobox';

interface QuickAddProductDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (product: Product) => void;
    initialName?: string;
}

const LICENSE_TYPES: LicenseType[] = ['Standalone', 'Network', 'Hardlock'];

const formatVND = (value: number) => new Intl.NumberFormat('vi-VN').format(Math.round(value));



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
                                {PRODUCT_CATEGORY_MAP.map(cat => (
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
                    <BrandCombobox
                        value={brandId}
                        brandName={brandName}
                        brands={brands}
                        onChange={(id, name) => { setBrandId(id); setBrandName(name); }}
                        onAddNew={(text) => {
                            setBrandDialogInitial(text);
                            setBrandDialogOpen(true);
                        }}
                    />
                    <SupplierCombobox 
                        value={supplierId}
                        supplierName={selectedSupplierName}
                        onChange={(id, name) => { setSupplierId(id); setSelectedSupplierName(name); }}
                        onAddNew={(text) => {
                            setSupplierDialogInitial(text);
                            setSupplierDialogOpen(true);
                        }}
                    />
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
