import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    Search,
    Package,
    Tag,
    TrendingUp,
    Filter,
    ChevronDown,
    Plus,
    MoreVertical,
    CheckCircle,
    XCircle,
    Loader2,
    Pencil,
    Trash2,
    Upload,
    Download,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Building2,
    RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ProductService, UnitService, BrandService, CustomerService } from '../services';
import { Product, ProductCategory, Unit, Brand, Customer } from '../types';
import { PRODUCT_CATEGORIES } from '../constants';
import { formatCurrency } from '../utils/formatters';
import ProductForm from './ProductForm';
import ImportProductModal from './ImportProductModal';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import ScrollToTop from './ui/ScrollToTop';
import { usePermissionCheck } from '../hooks/usePermissions';
import ConfirmDialog, { useConfirmDialog } from './ui/ConfirmDialog';
import { toast } from 'sonner';
import { useColumnResize } from '../hooks/useColumnResize';
import { useAuth } from '../contexts/AuthContext';

interface ProductListProps {
    onSelectProduct?: (id: string) => void;
}

const ProductList: React.FC<ProductListProps> = ({ onSelectProduct }) => {
    const { can } = usePermissionCheck();
    const { profile: realProfile } = useAuth();
    const allowDelete = can('products', 'delete');
    const allowCreate = can('products', 'create');
    const allowUpdate = can('products', 'update');
    const confirmDialog = useConfirmDialog();

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [brandFilter, setBrandFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [supplierFilter, setSupplierFilter] = useState<string>('all');
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);

    // Sort state
    const [sortBy, setSortBy] = useState<string>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Data state
    const [units, setUnits] = useState<Unit[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [suppliers, setSuppliers] = useState<Customer[]>([]);

    // Infinite scroll batch size
    const PAGE_SIZE = 20;

    // CRUD state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const categories = PRODUCT_CATEGORIES;

    // Fetch units, brands, suppliers
    useEffect(() => {
        const fetchRefs = async () => {
            try {
                const [unitsData, brandsData, suppliersData] = await Promise.all([
                    UnitService.getAll(),
                    BrandService.getActive(),
                    CustomerService.getAll({ type: 'Supplier' }).then(res => res.data)
                ]);
                setUnits(unitsData);
                setBrands(brandsData);
                setSuppliers(suppliersData);
            } catch (error) {
                console.error('Error fetching refs:', error);
            }
        };
        fetchRefs();
    }, []);

    // Debounced search
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Infinite scroll fetch function
    const fetchProductPage = useCallback(async (page: number) => {
        const res = await ProductService.list({
            page,
            pageSize: PAGE_SIZE,
            search: debouncedSearch,
            category: categoryFilter,
            brandId: brandFilter,
            supplierId: supplierFilter,
            isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
            sortBy,
            sortOrder,
        });

        return {
            data: res.data,
            hasMore: res.data.length >= PAGE_SIZE,
            totalCount: res.total
        };
    }, [debouncedSearch, categoryFilter, brandFilter, supplierFilter, statusFilter, sortBy, sortOrder]);

    const {
        items: products,
        isLoading,
        isLoadingMore,
        hasMore,
        totalCount,
        sentinelRef,
        reset: resetInfiniteScroll,
        silentRefresh,
        setItems: setProducts
    } = useInfiniteScroll<Product>({
        fetchFn: fetchProductPage,
        pageSize: PAGE_SIZE,
        resetDeps: [debouncedSearch, categoryFilter, brandFilter, supplierFilter, statusFilter, sortBy, sortOrder]
    });

    // Realtime: silent refresh when product/brand data changes from another tab
    useEffect(() => {
        const handleRealtimeRefresh = () => { silentRefresh(); };
        window.addEventListener('product-changed', handleRealtimeRefresh);
        window.addEventListener('brand-changed', handleRealtimeRefresh);
        return () => {
            window.removeEventListener('product-changed', handleRealtimeRefresh);
            window.removeEventListener('brand-changed', handleRealtimeRefresh);
        };
    }, [silentRefresh]);

    // Use server result
    const filteredProducts = products;

    const getUnitName = (unitId?: string) => {
        if (!unitId) return 'N/A';
        return units.find(u => u.id === unitId)?.name || 'N/A';
    };

    const formatPrice = (val: number) => {
        return (val || 0).toLocaleString('vi-VN') + ' ₫';
    };

    const getCategoryColor = (category: ProductCategory) => {
        switch (category) {
            case 'Phần mềm': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'Tư vấn': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Thiết kế': return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400';
            case 'Thi công': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case 'Bảo trì': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'Đào tạo': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    // Stats (Current Page)
    const stats = useMemo(() => {
        const active = filteredProducts.filter(p => p.isActive).length;
        const totalBasePrice = filteredProducts.reduce((sum, p) => sum + p.basePrice, 0);
        const productsWithMargin = filteredProducts.filter(p => p.basePrice > 0 && p.costPrice);
        const avgMargin = productsWithMargin.length > 0
            ? productsWithMargin.reduce((sum, p) => {
                return sum + ((p.basePrice - (p.costPrice || 0)) / p.basePrice) * 100;
            }, 0) / productsWithMargin.length
            : 0;

        return { active, totalBasePrice, avgMargin };
    }, [filteredProducts]);

    // === Resizable columns ===
    const PRODUCT_TABLE_COLUMNS = useMemo(() => [
        { key: 'stt', defaultWidth: 45, minWidth: 35 },
        { key: 'code', defaultWidth: 100, minWidth: 60 },
        { key: 'name', defaultWidth: 250, minWidth: 120 },
        { key: 'category', defaultWidth: 100, minWidth: 60 },
        { key: 'unit', defaultWidth: 120, minWidth: 60 },
        { key: 'price', defaultWidth: 130, minWidth: 80 },
        { key: 'margin', defaultWidth: 80, minWidth: 50 },
        { key: 'status', defaultWidth: 100, minWidth: 60 },
        { key: 'brand', defaultWidth: 100, minWidth: 60 },
        { key: 'supplier', defaultWidth: 120, minWidth: 60 },
        { key: 'actions', defaultWidth: 45, minWidth: 35 },
    ], []);

    const { columnWidths, onResizeStart, isResizing, resetWidths } = useColumnResize({
        tableId: 'product-list',
        userId: realProfile?.id,
        columns: PRODUCT_TABLE_COLUMNS,
    });

    const selectedCategoryLabel = categoryFilter === 'all' ? 'Tất cả danh mục' : categoryFilter;

    // CRUD handlers
    const handleAdd = () => {
        setEditingProduct(undefined);
        setIsFormOpen(true);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setIsFormOpen(true);
        setActionMenuId(null);
    };

    const handleSave = async (data: Omit<Product, 'id'> | Product) => {
        if ('id' in data) {
            // Update existing
            await ProductService.update(data.id, data);
            setProducts(prev => prev.map(p => p.id === data.id ? data as Product : p));
        } else {
            // Create new
            const newProduct = await ProductService.create(data);
            setProducts(prev => [newProduct, ...prev]);
        }
    };

    const handleDelete = async (id: string) => {
        setActionMenuId(null);
        const confirmed = await confirmDialog.confirm({
            title: 'Xóa sản phẩm',
            message: 'Bạn có chắc chắn muốn xóa sản phẩm này? Hành động này không thể hoàn tác.',
            variant: 'danger',
        });
        if (confirmed) {
            await ProductService.delete(id);
            setProducts(prev => prev.filter(p => p.id !== id));
        }
    };

    // Sort handler
    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortBy !== column) return <ArrowUpDown size={14} className="text-slate-300 dark:text-slate-600" />;
        return sortOrder === 'asc'
            ? <ArrowUp size={14} className="text-indigo-500" />
            : <ArrowDown size={14} className="text-indigo-500" />;
    };

    // Export handler
    const handleExport = async () => {
        setIsExporting(true);
        try {
            const all = await ProductService.getAll();
            const exportData = all.map((p, i) => ({
                'STT': i + 1,
                'Mã SP': p.code,
                'Tên sản phẩm': p.name,
                'Danh mục': p.category,
                'Đơn vị': getUnitName(p.unitId),
                'Đơn giá bán': p.basePrice,
                'Giá vốn': p.costPrice || 0,
                'Biên LN (%)': p.basePrice > 0 && p.costPrice ? Math.round(((p.basePrice - p.costPrice) / p.basePrice) * 100) : 0,
                'Trạng thái': p.isActive ? 'Đang bán' : 'Ngừng bán',
                'Hãng': p.brandName || '',
                'NCC': p.supplierName || '',
                'SKU': p.sku || '',
                'Model': p.model || '',
            }));
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Sản phẩm');
            XLSX.writeFile(wb, `san_pham_${new Date().toISOString().slice(0, 10)}.xlsx`);
            toast.success(`Đã xuất ${all.length} sản phẩm`);
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Lỗi khi xuất Excel');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Header Row 1: Title + Action Buttons */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">
                        Sản phẩm & Dịch vụ
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                        {totalCount} sản phẩm
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-medium text-xs hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                        Xuất Excel
                    </button>

                    {/* Import Button */}
                    {allowCreate && (
                        <button
                            onClick={() => setIsImportOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-medium text-xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                        >
                            <Upload size={15} />
                            Nhập Excel
                        </button>
                    )}

                    {/* Add Button */}
                    {allowCreate && (
                        <button
                            onClick={handleAdd}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
                        >
                            <Plus size={15} />
                            Thêm SP
                        </button>
                    )}
                </div>
            </div>

            {/* Header Row 2: Filters + Search */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Category Filter Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all"
                    >
                        <Filter size={14} className="text-slate-400" />
                        <span className="truncate max-w-[120px]">{selectedCategoryLabel}</span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isCategoryDropdownOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-20"
                                onClick={() => setIsCategoryDropdownOpen(false)}
                            />
                            <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-30 overflow-hidden">
                                <button
                                    onClick={() => {
                                        setCategoryFilter('all');
                                        setIsCategoryDropdownOpen(false);
                                    }}
                                    className={`w-full px-3 py-2.5 text-xs text-left transition-colors ${categoryFilter === 'all'
                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                >
                                    Tất cả danh mục
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => {
                                            setCategoryFilter(cat);
                                            setIsCategoryDropdownOpen(false);
                                        }}
                                        className={`w-full px-3 py-2.5 text-xs text-left transition-colors ${categoryFilter === cat
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                            }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Brand Filter Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all cursor-pointer"
                    >
                        <Tag size={14} className="text-slate-400" />
                        <span className="truncate max-w-[100px]">{brandFilter === 'all' ? 'Tất cả hãng' : brands.find(b => b.id === brandFilter)?.name || 'Hãng'}</span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isBrandDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isBrandDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-20" onClick={() => setIsBrandDropdownOpen(false)} />
                            <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-30 overflow-hidden max-h-56 overflow-y-auto">
                                <button
                                    onClick={() => { setBrandFilter('all'); setIsBrandDropdownOpen(false); }}
                                    className={`w-full px-3 py-2.5 text-xs text-left transition-colors cursor-pointer ${brandFilter === 'all'
                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                >
                                    Tất cả hãng
                                </button>
                                {brands.map(brand => (
                                    <button
                                        key={brand.id}
                                        onClick={() => { setBrandFilter(brand.id); setIsBrandDropdownOpen(false); }}
                                        className={`w-full px-3 py-2.5 text-xs text-left transition-colors cursor-pointer ${brandFilter === brand.id
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                            }`}
                                    >
                                        {brand.name}{brand.country ? ` (${brand.country})` : ''}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Status Filter Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all cursor-pointer"
                    >
                        {statusFilter === 'active' ? <CheckCircle size={14} className="text-emerald-500" /> : statusFilter === 'inactive' ? <XCircle size={14} className="text-rose-400" /> : <Filter size={14} className="text-slate-400" />}
                        <span className="truncate">{statusFilter === 'all' ? 'Trạng thái' : statusFilter === 'active' ? 'Đang bán' : 'Ngừng bán'}</span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isStatusDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-20" onClick={() => setIsStatusDropdownOpen(false)} />
                            <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-30 overflow-hidden">
                                {[{ value: 'all', label: 'Tất cả' }, { value: 'active', label: 'Đang bán' }, { value: 'inactive', label: 'Ngừng bán' }].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => { setStatusFilter(opt.value); setIsStatusDropdownOpen(false); }}
                                        className={`w-full px-3 py-2.5 text-xs text-left transition-colors cursor-pointer ${statusFilter === opt.value
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Supplier Filter Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsSupplierDropdownOpen(!isSupplierDropdownOpen)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all cursor-pointer"
                    >
                        <Building2 size={14} className="text-slate-400" />
                        <span className="truncate max-w-[100px]">{supplierFilter === 'all' ? 'Tất cả NCC' : suppliers.find(s => s.id === supplierFilter)?.name || 'NCC'}</span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isSupplierDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isSupplierDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-20" onClick={() => setIsSupplierDropdownOpen(false)} />
                            <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-30 overflow-hidden max-h-56 overflow-y-auto">
                                <button
                                    onClick={() => { setSupplierFilter('all'); setIsSupplierDropdownOpen(false); }}
                                    className={`w-full px-3 py-2.5 text-xs text-left transition-colors cursor-pointer ${supplierFilter === 'all'
                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                >
                                    Tất cả NCC
                                </button>
                                {suppliers.map(supplier => (
                                    <button
                                        key={supplier.id}
                                        onClick={() => { setSupplierFilter(supplier.id); setIsSupplierDropdownOpen(false); }}
                                        className={`w-full px-3 py-2.5 text-xs text-left transition-colors cursor-pointer ${supplierFilter === supplier.id
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                            }`}
                                    >
                                        {supplier.name}{supplier.shortName ? ` (${supplier.shortName})` : ''}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="Tìm theo tên, mã, SKU..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-900 dark:text-slate-100"
                    />
                </div>
            </div>

            {/* Product Form Modal */}
            <ProductForm
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingProduct(undefined); }}
                onSave={handleSave}
                product={editingProduct}
            />

            {/* Import Modal */}
            <ImportProductModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                units={units}
                onSuccess={() => {
                    resetInfiniteScroll();
                }}
            />

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Package size={18} />
                        </div>
                        <div>
                            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{totalCount}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sản phẩm</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <CheckCircle size={18} />
                        </div>
                        <div>
                            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{stats.active}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Đang bán</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                            <Tag size={18} />
                        </div>
                        <div>
                            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{categories.length}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Danh mục</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                            <TrendingUp size={18} />
                        </div>
                        <div>
                            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{stats.avgMargin.toFixed(0)}%</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Biên LN trung bình</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={28} className="animate-spin text-indigo-500" />
                    </div>
                ) : (
                    <div className={`overflow-x-auto overflow-y-auto max-h-[calc(100vh-340px)] ${isResizing ? 'select-none' : ''}`}>
                        <table className="text-left" style={{ tableLayout: 'fixed', width: Object.values(columnWidths).reduce((a, b) => a + b, 0), minWidth: '100%' }}>
                            <colgroup>
                                {PRODUCT_TABLE_COLUMNS.map(c => (
                                    <col key={c.key} style={{ width: columnWidths[c.key] }} />
                                ))}
                            </colgroup>
                            <thead>
                                <tr className="z-20">
                                    {[
                                        { key: 'stt', label: 'STT', align: 'center', sortable: false },
                                        { key: 'code', label: 'Mã SP', align: 'left', sortable: true, sortKey: 'code' },
                                        { key: 'name', label: 'Tên sản phẩm', align: 'left', sortable: true, sortKey: 'name' },
                                        { key: 'category', label: 'Danh mục', align: 'left', sortable: false },
                                        { key: 'unit', label: 'Đơn vị', align: 'left', sortable: false },
                                        { key: 'price', label: 'Đơn giá', align: 'right', sortable: true, sortKey: 'base_price' },
                                        { key: 'margin', label: 'Biên LN', align: 'right', sortable: false },
                                        { key: 'status', label: 'Trạng thái', align: 'center', sortable: true, sortKey: 'is_active' },
                                        { key: 'brand', label: 'Hãng', align: 'left', sortable: false },
                                        { key: 'supplier', label: 'NCC', align: 'left', sortable: false },
                                        { key: 'actions', label: '', align: 'center', sortable: false },
                                    ].map((col, idx, arr) => (
                                        <th
                                            key={col.key}
                                            onClick={col.sortable ? () => handleSort(col.sortKey!) : undefined}
                                            className={`sticky top-0 z-20 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 px-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/th ${col.sortable ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none' : ''} ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                                        >
                                            <span className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                                                {col.label}
                                                {col.sortable && <SortIcon column={col.sortKey!} />}
                                            </span>
                                            {idx < arr.length - 1 && (
                                                <div
                                                    className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-30 flex items-center justify-center"
                                                    onMouseDown={(e) => { e.stopPropagation(); onResizeStart(col.key, e); }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="w-[2px] h-4 bg-slate-300 dark:bg-slate-600 rounded-full opacity-0 group-hover/th:opacity-100 transition-opacity" />
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((product, index) => {
                                    const margin = product.basePrice > 0 && product.costPrice
                                        ? ((product.basePrice - product.costPrice) / product.basePrice) * 100
                                        : 0;

                                    return (
                                        <tr
                                            key={product.id}
                                            onClick={() => onSelectProduct?.(product.id)}
                                            className="border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group cursor-pointer"
                                        >
                                            <td className="py-2.5 px-2 text-center">
                                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    {index + 1}
                                                </span>
                                            </td>
                                            {/* Code */}
                                            <td className="py-2.5 px-3">
                                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">{product.code}</span>
                                            </td>

                                            {/* Name */}
                                            <td className="py-2.5 px-3">
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">{product.name}</p>
                                                    {product.brandName && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded text-[10px] font-bold mr-1 mt-0.5">
                                                            {product.brandName}
                                                        </span>
                                                    )}
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{product.description}</p>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="py-2.5 px-3 hidden md:table-cell">
                                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${getCategoryColor(product.category)}`}>
                                                    {product.category}
                                                </span>
                                            </td>

                                            {/* Unit */}
                                            <td className="py-2.5 px-3 hidden lg:table-cell">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs text-slate-700 dark:text-slate-300">{product.unit}</span>
                                                    <span className="text-[10px] text-slate-400">• {getUnitName(product.unitId)}</span>
                                                </div>
                                            </td>

                                            {/* Price */}
                                            <td className="py-2.5 px-3 text-right">
                                                <p className="font-bold text-slate-900 dark:text-slate-100 text-xs">{formatPrice(product.basePrice)}</p>
                                                {product.costPrice && (
                                                    <p className="text-[10px] text-slate-400">Gốc: {formatPrice(product.costPrice)}</p>
                                                )}
                                            </td>

                                            {/* Margin */}
                                            <td className="py-2.5 px-3 text-right hidden sm:table-cell">
                                                <span className={`text-xs font-bold ${margin >= 50 ? 'text-emerald-600 dark:text-emerald-400' : margin >= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {margin.toFixed(0)}%
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="py-2.5 px-3 text-center hidden sm:table-cell">
                                                {product.isActive ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-bold">
                                                        <CheckCircle size={11} />
                                                        Đang bán
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-bold">
                                                        <XCircle size={11} />
                                                        Ngừng bán
                                                    </span>
                                                )}
                                            </td>

                                            {/* Brand */}
                                            <td className="py-2.5 px-3 hidden xl:table-cell">
                                                {product.brandName ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded text-[10px] font-bold">
                                                        {product.brandName}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Supplier */}
                                            <td className="py-2.5 px-3 hidden xl:table-cell">
                                                {product.supplierName ? (
                                                    <span className="text-xs text-slate-700 dark:text-slate-300">{product.supplierName}</span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400">—</span>
                                                )}
                                            </td>

                                            {/* Action */}
                                            <td className="py-2.5 px-2 relative">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === product.id ? null : product.id); }}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                                                >
                                                    <MoreVertical size={16} />
                                                </button>

                                                {/* Action Menu */}
                                                {actionMenuId === product.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setActionMenuId(null); }} />
                                                        <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-20 overflow-hidden">
                                                            {allowUpdate && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEdit(product); }}
                                                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                                >
                                                                    <Pencil size={14} />
                                                                    Chỉnh sửa
                                                                </button>
                                                            )}
                                                            {allowDelete && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                                                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                    Xóa
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* INFINITE SCROLL SENTINEL INSIDE SCROLL AREA */}
                        <div className="flex flex-col items-center justify-center p-4">
                            <div ref={sentinelRef} className="h-4 w-full" />
                            {isLoadingMore && (
                                <div className="flex items-center justify-center py-4 gap-2 text-indigo-600 dark:text-indigo-400">
                                    <Loader2 size={20} className="animate-spin" />
                                    <span className="text-sm font-medium">Đang tải thêm...</span>
                                </div>
                            )}
                            {!hasMore && filteredProducts.length > 0 && !isLoading && (
                                <div className="text-center py-4 text-sm text-slate-400 dark:text-slate-500">
                                    Đã hiển thị tất cả {totalCount} sản phẩm
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* STATUS BAR */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-slate-500">
                            Hiển thị {filteredProducts.length} / {totalCount} sản phẩm
                        </div>
                        <button
                            onClick={resetWidths}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                            title="Đặt lại kích thước cột mặc định"
                        >
                            <RotateCcw size={13} /> Reset cột
                        </button>
                    </div>
                </div>

                {!isLoading && filteredProducts.length === 0 && (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Package size={32} className="text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Không tìm thấy sản phẩm</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                    </div>
                )}

                <ScrollToTop />
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

export default ProductList;
