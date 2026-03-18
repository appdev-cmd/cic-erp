import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Search,
    Building2,
    Phone,
    Mail,
    MapPin,
    FileText,
    TrendingUp,
    Plus,
    Pencil,
    Trash2,
    MoreVertical,
    Upload,
    Loader2,
    Star,
    Crown,
    ChevronDown,
    Tag,
    RotateCcw
} from 'lucide-react';
import { Customer } from '../types';
import { CustomerService } from '../services';
import { INDUSTRIES } from '../constants';
import CustomerForm from './CustomerForm';
import ImportCustomerModal from './ImportCustomerModal';
import BrandManager from './settings/BrandManager';
import BrandDetail from './BrandDetail';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import ScrollToTop from './ui/ScrollToTop';
import { usePermissionCheck } from '../hooks/usePermissions';
import { useColumnResize } from '../hooks/useColumnResize';
import { useAuth } from '../contexts/AuthContext';

interface CustomerListProps {
    onSelectCustomer?: (id: string) => void;
    onSelectProduct?: (id: string) => void;
}

const CustomerList: React.FC<CustomerListProps> = ({ onSelectCustomer, onSelectProduct }) => {
    const { can } = usePermissionCheck();
    const { profile: realProfile } = useAuth();
    const allowDelete = can('customers', 'delete');

    const [searchQuery, setSearchQuery] = useState('');
    const [industryFilter, setIndustryFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'Customer' | 'Supplier'>('all');
    const [ratingFilter, setRatingFilter] = useState<string>('all');
    const [activeView, setActiveView] = useState<'partners' | 'brands'>('partners');
    const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
    const [brandFormOpen, setBrandFormOpen] = useState(false);

    // Infinite scroll batch size
    const PAGE_SIZE = 20;

    // CRUD state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);
    const [isImportOpen, setIsImportOpen] = useState(false);

    // Debounced search
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Infinite scroll fetch function
    const fetchCustomerPage = useCallback(async (page: number) => {
        const custRes = await CustomerService.getAll({
            page,
            pageSize: PAGE_SIZE,
            search: debouncedSearch,
            type: typeFilter,
            industry: industryFilter,
            rating: ratingFilter !== 'all' ? ratingFilter : undefined
        });

        return {
            data: custRes.data,
            hasMore: custRes.data.length >= PAGE_SIZE,
            totalCount: custRes.total
        };
    }, [debouncedSearch, typeFilter, industryFilter, ratingFilter]);

    const {
        items: customers,
        isLoading,
        isLoadingMore,
        hasMore,
        totalCount,
        sentinelRef,
        reset: resetInfiniteScroll,
        silentRefresh,
        setItems: setCustomers
    } = useInfiniteScroll<Customer>({
        fetchFn: fetchCustomerPage,
        pageSize: PAGE_SIZE,
        resetDeps: [debouncedSearch, typeFilter, industryFilter, ratingFilter]
    });

    // Realtime: silent refresh when customer data changes from another tab
    useEffect(() => {
        const handleRealtimeRefresh = () => { silentRefresh(); };
        window.addEventListener('customer-changed', handleRealtimeRefresh);
        return () => window.removeEventListener('customer-changed', handleRealtimeRefresh);
    }, [silentRefresh]);

    const industries = ['all', ...INDUSTRIES];
    const RATINGS = ['all', 'VIP', 'Gold', 'Standard', 'Lead'];

    // === Resizable columns ===
    const CUSTOMER_TABLE_COLUMNS = useMemo(() => [
        { key: 'stt', defaultWidth: 50, minWidth: 35 },
        { key: 'name', defaultWidth: 350, minWidth: 150 },
        { key: 'rating', defaultWidth: 80, minWidth: 50 },
        { key: 'contact', defaultWidth: 220, minWidth: 100 },
        { key: 'contracts', defaultWidth: 80, minWidth: 50 },
        { key: 'value', defaultWidth: 150, minWidth: 80 },
        { key: 'actions', defaultWidth: 55, minWidth: 40 },
    ], []);

    const { columnWidths, onResizeStart, isResizing, resetWidths } = useColumnResize({
        tableId: 'customer-list',
        userId: realProfile?.id,
        columns: CUSTOMER_TABLE_COLUMNS,
    });

    const formatCurrency = (val: number) => {
        return (val || 0).toLocaleString('vi-VN') + ' ₫';
    };

    const getIndustryColor = (industry: string) => {
        switch (industry) {
            case 'Xây dựng': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case 'Bất động sản': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Năng lượng': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'Công nghệ': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'Sản xuất': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            case 'Thương mại': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'Dịch vụ': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400';
            case 'Giáo dục': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
            case 'Y tế': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const getRatingBadge = (rating?: string) => {
        if (!rating || rating === 'Standard') return null;
        const colors: Record<string, string> = {
            'VIP': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            'Gold': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            'Lead': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
        };
        return (
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ml-1.5 ${colors[rating] || ''}`}>
                <Star size={9} />
                {rating}
            </span>
        );
    };

    // Summary stats for current view
    const viewStats = useMemo(() => {
        let totalContracts = 0;
        let totalValue = 0;
        let vipCount = 0;
        customers.forEach(c => {
            const stats = c.stats || { contractCount: 0, totalValue: 0, totalRevenue: 0, activeContracts: 0 };
            totalContracts += stats.contractCount;
            totalValue += stats.totalValue;
            if (c.rating === 'VIP' || c.rating === 'Gold') vipCount++;
        });
        return { totalContracts, totalValue, vipCount };
    }, [customers]);

    // CRUD handlers
    const handleAdd = () => {
        setEditingCustomer(undefined);
        setIsFormOpen(true);
    };

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsFormOpen(true);
        setActionMenuId(null);
    };

    const handleSave = async (data: Omit<Customer, 'id'> | Customer) => {
        try {
            if ('id' in data) {
                const updated = await CustomerService.update(data.id, data);
                // Note: 'updated' might not have stats if API generic update doesn't return joined stats.
                // Ideally we should refetch or preserve old stats. For now, let's just refetch to be safe/simple.
                setCustomers(prev => prev.map(c => c.id === data.id ? { ...updated!, stats: c.stats } : c));
                toast.success("Cập nhật đối tác thành công");
            } else {
                const newCustomer = await CustomerService.create(data);
                setCustomers(prev => [newCustomer, ...prev]);
                toast.success("Thêm đối tác thành công");
            }
        } catch (e: any) {
            toast.error("Lỗi lưu đối tác: " + e.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Bạn có chắc chắn muốn xóa khách hàng này?')) {
            try {
                await CustomerService.delete(id);
                setCustomers(prev => prev.filter(c => c.id !== id));
                toast.success("Đã xóa đối tác");
            } catch (e: any) {
                toast.error("Không thể xóa: " + e.message);
            }
        }
        setActionMenuId(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">
                    {typeFilter === 'all' ? 'Quản lý Đối tác' : typeFilter === 'Customer' ? 'Quản lý Khách hàng' : 'Quản lý Nhà cung cấp'}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    {totalCount} {typeFilter === 'Supplier' ? 'nhà cung cấp' : 'khách hàng'}
                </p>
            </div>

            <div className="flex gap-3">
                <div className="relative flex-1 md:w-72">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm khách hàng..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100"
                    />
                </div>
                {activeView === 'partners' && (
                    <button
                        onClick={() => setIsImportOpen(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 dark:shadow-none"
                    >
                        <Upload size={18} />
                        <span className="hidden md:inline">Import</span>
                    </button>
                )}
                {activeView === 'partners' ? (
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none cursor-pointer"
                    >
                        <Plus size={18} />
                        <span className="hidden md:inline">Thêm Đối tác</span>
                    </button>
                ) : (
                    <button
                        onClick={() => setBrandFormOpen(true)}
                        className="flex items-center gap-2 px-5 py-3 bg-violet-600 text-white rounded-lg font-bold text-sm hover:bg-violet-700 transition-colors shadow-lg shadow-violet-200 dark:shadow-none cursor-pointer"
                    >
                        <Plus size={18} />
                        <span className="hidden md:inline">Thêm Hãng</span>
                    </button>
                )}
            </div>

            {/* Customer Form Modal */}
            <CustomerForm
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingCustomer(undefined); }}
                onSave={handleSave}
                customer={editingCustomer}
            />

            {/* Import Modal */}
            <ImportCustomerModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                onSuccess={() => {
                    resetInfiniteScroll();
                    setIsImportOpen(false);
                }}
            />

            {/* View Tabs: Partners vs Brands */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveView('partners')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${activeView === 'partners'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <span className="flex items-center gap-1.5"><Building2 size={15} />Đối tác</span>
                </button>
                <button
                    onClick={() => setActiveView('brands')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${activeView === 'brands'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                >
                    <span className="flex items-center gap-1.5"><Tag size={15} />Hãng sản xuất</span>
                </button>
            </div>

            {activeView === 'brands' ? (
                selectedBrandId ? (
                    <BrandDetail
                        brandId={selectedBrandId}
                        onBack={() => setSelectedBrandId(null)}
                        onSelectProduct={onSelectProduct}
                    />
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
                        <BrandManager
                        onSelectBrand={(id) => setSelectedBrandId(id)}
                        isFormOpenExternal={brandFormOpen}
                        onFormClose={() => setBrandFormOpen(false)}
                    />
                    </div>
                )
            ) : (
                <>

                    {/* Partner Type Tabs */}
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
                        {(['all', 'Customer', 'Supplier'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => setTypeFilter(type)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${typeFilter === type
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                {type === 'all' ? 'Tất cả' : type === 'Customer' ? 'Khách hàng' : 'Nhà cung cấp'}
                            </button>
                        ))}
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Industry Filter */}
                        <div className="flex gap-2 overflow-x-auto flex-1 no-scrollbar">
                            {industries.map(industry => (
                                <button
                                    key={industry}
                                    onClick={() => setIndustryFilter(industry)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${industryFilter === industry
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                                        }`}
                                >
                                    {industry === 'all' ? 'Tất cả ngành' : industry}
                                </button>
                            ))}
                        </div>
                        {/* Rating Filter */}
                        <div className="relative">
                            <select
                                value={ratingFilter}
                                onChange={(e) => setRatingFilter(e.target.value)}
                                className="appearance-none pl-3 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                            >
                                {RATINGS.map(r => (
                                    <option key={r} value={r}>{r === 'all' ? '⭐ Tất cả hạng' : r}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                    <Building2 size={20} />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{totalCount}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đối tác</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{viewStats.totalContracts}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Hợp đồng</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(viewStats.totalValue)}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng giá trị</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                                    <Crown size={20} />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{viewStats.vipCount}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">VIP / Gold</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Customer List */}
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                        <div className={`overflow-x-auto overflow-y-auto max-h-[calc(100vh-380px)] ${isResizing ? 'select-none' : ''}`}>
                            <table className="text-left" style={{ tableLayout: 'fixed', width: Object.values(columnWidths).reduce((a, b) => a + b, 0), minWidth: '100%' }}>
                                <colgroup>
                                    {CUSTOMER_TABLE_COLUMNS.map(c => (
                                        <col key={c.key} style={{ width: columnWidths[c.key] }} />
                                    ))}
                                </colgroup>
                                <thead>
                                    <tr className="z-20">
                                        {[
                                            { key: 'stt', label: 'STT', align: 'center' },
                                            { key: 'name', label: 'Đối tác', align: 'left' },
                                            { key: 'rating', label: 'Hạng', align: 'center' },
                                            { key: 'contact', label: 'Liên hệ', align: 'left' },
                                            { key: 'contracts', label: 'HĐ', align: 'right' },
                                            { key: 'value', label: 'Giá trị', align: 'right' },
                                            { key: 'actions', label: '', align: 'center' },
                                        ].map((col, idx, arr) => (
                                            <th key={col.key} className={`sticky top-0 z-20 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 py-4 px-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/th ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}>
                                                {col.label}
                                                {idx < arr.length - 1 && (
                                                    <div
                                                        className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-30 flex items-center justify-center"
                                                        onMouseDown={(e) => onResizeStart(col.key, e)}
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
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-500">Đang tải dữ liệu...</td>
                                        </tr>
                                    ) : customers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center">
                                                    <Building2 size={32} className="text-slate-300 mb-2" />
                                                    <p>Không tìm thấy đối tác nào</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        customers.map((customer, index) => {
                                            const stats = customer.stats || { contractCount: 0, totalValue: 0, totalRevenue: 0, activeContracts: 0 };
                                            return (
                                                <tr
                                                    key={customer.id}
                                                    className="border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group cursor-pointer"
                                                    onClick={() => onSelectCustomer?.(customer.id)}
                                                >
                                                    <td className="py-4 px-3 text-center">
                                                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                                            {index + 1}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center font-black text-slate-600 dark:text-slate-300 text-sm">
                                                                {customer.shortName ? customer.shortName.substring(0, 3) : 'KH'}
                                                            </div>
                                                            <div>
                                                                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1">
                                                                    {customer.name}
                                                                    {customer.shortName && (
                                                                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">({customer.shortName})</span>
                                                                    )}
                                                                    {getRatingBadge(customer.rating)}
                                                                </h3>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                                                    <MapPin size={12} />
                                                                    {customer.address?.split(',').pop()?.trim() || 'N/A'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 hidden md:table-cell text-center">
                                                        {getRatingBadge(customer.rating)}
                                                    </td>
                                                    <td className="py-4 px-6 hidden lg:table-cell">
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{customer.contactPerson}</p>
                                                            <div className="flex flex-col gap-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                                {customer.phone && (
                                                                    <span className="flex items-center gap-1"><Phone size={11} />{customer.phone}</span>
                                                                )}
                                                                {customer.email && (
                                                                    <span className="flex items-center gap-1 truncate max-w-[180px]"><Mail size={11} />{customer.email}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-right">
                                                        <p className="font-bold text-slate-900 dark:text-slate-100">{stats.contractCount}</p>
                                                        {stats.activeContracts > 0 && (
                                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{stats.activeContracts} đang thực hiện</p>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-right hidden sm:table-cell">
                                                        <p className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(stats.totalValue)}</p>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">DT: {formatCurrency(stats.totalRevenue)}</p>
                                                    </td>
                                                    <td className="py-4 px-6 relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActionMenuId(actionMenuId === customer.id ? null : customer.id);
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>

                                                        {actionMenuId === customer.id && (
                                                            <>
                                                                <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
                                                                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-20 overflow-hidden">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleEdit(customer);
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                                    >
                                                                        <Pencil size={14} />
                                                                        Chỉnh sửa
                                                                    </button>
                                                                    {allowDelete && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDelete(customer.id);
                                                                            }}
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
                                        })
                                    )}
                                </tbody>
                            </table>

                            {/* INFINITE SCROLL SENTINEL INSIDE SCROLL AREA */}
                            <div className="p-4 flex flex-col items-center justify-center">
                                <div ref={sentinelRef} className="h-4 w-full" />
                                {isLoadingMore && (
                                    <div className="flex items-center justify-center py-4 gap-2 text-indigo-600 dark:text-indigo-400">
                                        <Loader2 size={20} className="animate-spin" />
                                        <span className="text-sm font-medium">Đang tải thêm...</span>
                                    </div>
                                )}
                                {!hasMore && customers.length > 0 && !isLoading && (
                                    <div className="text-center py-4 text-sm text-slate-400 dark:text-slate-500">
                                        Đã hiển thị tất cả {totalCount} đối tác
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* STATUS BAR */}
                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-bold text-slate-500">
                                    Hiển thị {customers.length} / {totalCount} đối tác
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

                        <ScrollToTop />
                    </div>
                </>
            )}
        </div>
    );
};

export default CustomerList;
