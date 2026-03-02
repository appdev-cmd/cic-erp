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
    Upload
} from 'lucide-react';
import { ProductService, UnitService, BrandService } from '../services';
import { Product, ProductCategory, Unit, Brand } from '../types';
import ProductForm from './ProductForm';
import ImportProductModal from './ImportProductModal';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import ScrollToTop from './ui/ScrollToTop';
import { usePermissionCheck } from '../hooks/usePermissions';

interface ProductListProps {
    onSelectProduct?: (id: string) => void;
}

const ProductList: React.FC<ProductListProps> = ({ onSelectProduct }) => {
    const { can } = usePermissionCheck();
    const allowDelete = can('products', 'delete');

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [brandFilter, setBrandFilter] = useState<string>('all');
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);

    // Data state
    const [units, setUnits] = useState<Unit[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);

    // Infinite scroll batch size
    const PAGE_SIZE = 20;

    // CRUD state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);

    const categories: ProductCategory[] = ['Phần mềm', 'Tư vấn', 'Thiết kế', 'Thi công', 'Bảo trì', 'Đào tạo'];

    // Fetch units once
    useEffect(() => {
        const fetchRefs = async () => {
            try {
                const [unitsData, brandsData] = await Promise.all([
                    UnitService.getAll(),
                    BrandService.getActive()
                ]);
                setUnits(unitsData);
                setBrands(brandsData);
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
        });

        return {
            data: res.data,
            hasMore: res.data.length >= PAGE_SIZE,
            totalCount: res.total
        };
    }, [debouncedSearch, categoryFilter, brandFilter]);

    const {
        items: products,
        isLoading,
        isLoadingMore,
        hasMore,
        totalCount,
        sentinelRef,
        reset: resetInfiniteScroll,
        setItems: setProducts
    } = useInfiniteScroll<Product>({
        fetchFn: fetchProductPage,
        pageSize: PAGE_SIZE,
        resetDeps: [debouncedSearch, categoryFilter, brandFilter]
    });

    // Use server result
    const filteredProducts = products;

    const getUnitName = (unitId?: string) => {
        if (!unitId) return 'N/A';
        return units.find(u => u.id === unitId)?.name || 'N/A';
    };

    const formatCurrency = (val: number) => {
        if (val >= 1e9) return `${(val / 1e9).toFixed(1)} tỷ`;
        if (val >= 1e6) return `${(val / 1e6).toFixed(0)} tr`;
        if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
        return val.toLocaleString('vi-VN');
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
        const avgMargin = filteredProducts.length > 0
            ? filteredProducts.reduce((sum, p) => {
                const margin = p.costPrice ? ((p.basePrice - p.costPrice) / p.basePrice) * 100 : 50;
                return sum + margin;
            }, 0) / filteredProducts.length
            : 0;

        return { active, totalBasePrice, avgMargin };
    }, [filteredProducts]);

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
        if (confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
            await ProductService.delete(id);
            setProducts(prev => prev.filter(p => p.id !== id));
        }
        setActionMenuId(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">
                        Sản phẩm & Dịch vụ
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {totalCount} sản phẩm
                    </p>
                </div>

                <div className="flex gap-3">
                    {/* Category Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-300 transition-all min-w-[160px]"
                        >
                            <Filter size={18} className="text-slate-400" />
                            <span className="flex-1 text-left truncate">{selectedCategoryLabel}</span>
                            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isCategoryDropdownOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsCategoryDropdownOpen(false)}
                                />
                                <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-20 overflow-hidden">
                                    <button
                                        onClick={() => {
                                            setCategoryFilter('all');
                                            setIsCategoryDropdownOpen(false);
                                        }}
                                        className={`w-full px-4 py-3 text-sm text-left transition-colors ${categoryFilter === 'all'
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
                                            className={`w-full px-4 py-3 text-sm text-left transition-colors ${categoryFilter === cat
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
                            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-300 transition-all min-w-[140px] cursor-pointer"
                        >
                            <Tag size={18} className="text-slate-400" />
                            <span className="flex-1 text-left truncate">{brandFilter === 'all' ? 'Tất cả hãng' : brands.find(b => b.id === brandFilter)?.name || 'Hãng'}</span>
                            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isBrandDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isBrandDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsBrandDropdownOpen(false)} />
                                <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-20 overflow-hidden max-h-64 overflow-y-auto">
                                    <button
                                        onClick={() => { setBrandFilter('all'); setIsBrandDropdownOpen(false); }}
                                        className={`w-full px-4 py-3 text-sm text-left transition-colors cursor-pointer ${brandFilter === 'all'
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
                                            className={`w-full px-4 py-3 text-sm text-left transition-colors cursor-pointer ${brandFilter === brand.id
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

                    {/* Search */}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm sản phẩm..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
                        />
                    </div>

                    {/* Import Button */}
                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm hover:border-indigo-400 transition-colors"
                    >
                        <Upload size={18} />
                        <span className="hidden md:inline">Import</span>
                    </button>

                    {/* Add Button */}
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                        <Plus size={18} />
                        <span className="hidden md:inline">Thêm SP</span>
                    </button>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Package size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{totalCount}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sản phẩm</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.active}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đang bán</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                            <Tag size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{categories.length}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Danh mục</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.avgMargin.toFixed(0)}%</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Biên lợi nhuận TB</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={32} className="animate-spin text-indigo-500" />
                    </div>
                ) : (
                    <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-360px)]">
                        <table className="w-full">
                            <thead>
                                <tr className="z-20">
                                    <th className="sticky top-0 z-20 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center py-4 px-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider w-12">STT</th>
                                    <th className="sticky top-0 z-20 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mã SP</th>
                                    <th className="sticky top-0 z-20 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tên sản phẩm</th>
                                    <th className="sticky top-0 z-20 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Danh mục</th>
                                    <th className="sticky top-0 z-20 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Đơn vị</th>
                                    <th className="sticky top-0 z-20 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đơn giá</th>
                                    <th className="sticky top-0 z-20 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-right py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">LN %</th>
                                    <th className="sticky top-0 z-20 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">Trạng thái</th>
                                    <th className="sticky top-0 z-20 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-4 px-6 w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.map((product, index) => {
                                    const margin = product.costPrice
                                        ? ((product.basePrice - product.costPrice) / product.basePrice) * 100
                                        : 50;

                                    return (
                                        <tr
                                            key={product.id}
                                            onClick={() => onSelectProduct?.(product.id)}
                                            className="border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group cursor-pointer"
                                        >
                                            <td className="py-4 px-3 text-center">
                                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                                    {index + 1}
                                                </span>
                                            </td>
                                            {/* Code */}
                                            <td className="py-4 px-6">
                                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">{product.code}</span>
                                            </td>

                                            {/* Name */}
                                            <td className="py-4 px-6">
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{product.name}</p>
                                                    {product.brandName && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded text-[10px] font-bold mr-1 mt-0.5">
                                                            {product.brandName}
                                                        </span>
                                                    )}
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{product.description}</p>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="py-4 px-6 hidden md:table-cell">
                                                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold ${getCategoryColor(product.category)}`}>
                                                    {product.category}
                                                </span>
                                            </td>

                                            {/* Unit */}
                                            <td className="py-4 px-6 hidden lg:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-slate-700 dark:text-slate-300">{product.unit}</span>
                                                    <span className="text-[10px] text-slate-400">• {getUnitName(product.unitId)}</span>
                                                </div>
                                            </td>

                                            {/* Price */}
                                            <td className="py-4 px-6 text-right">
                                                <p className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(product.basePrice)}</p>
                                                {product.costPrice && (
                                                    <p className="text-[10px] text-slate-400">Giá vốn: {formatCurrency(product.costPrice)}</p>
                                                )}
                                            </td>

                                            {/* Margin */}
                                            <td className="py-4 px-6 text-right hidden sm:table-cell">
                                                <span className={`font-bold ${margin >= 50 ? 'text-emerald-600 dark:text-emerald-400' : margin >= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {margin.toFixed(0)}%
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="py-4 px-6 text-center hidden sm:table-cell">
                                                {product.isActive ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-bold">
                                                        <CheckCircle size={12} />
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-bold">
                                                        <XCircle size={12} />
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>

                                            {/* Action */}
                                            <td className="py-4 px-6 relative">
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
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEdit(product); }}
                                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                            >
                                                                <Pencil size={14} />
                                                                Chỉnh sửa
                                                            </button>
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
        </div>
    );
};

export default ProductList;
