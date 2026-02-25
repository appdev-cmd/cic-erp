import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Search,
    Building2,
    Phone,
    MapPin,
    FileText,
    TrendingUp,
    Filter,
    Plus,
    Pencil,
    Trash2,
    MoreVertical,
    Upload,
    Loader2
} from 'lucide-react';
import { Customer } from '../types';
import { CustomerService } from '../services';
import CustomerForm from './CustomerForm';
import ImportCustomerModal from './ImportCustomerModal';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import ScrollToTop from './ui/ScrollToTop';

interface CustomerListProps {
    onSelectCustomer?: (id: string) => void;
}

const CustomerList: React.FC<CustomerListProps> = ({ onSelectCustomer }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [industryFilter, setIndustryFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'Customer' | 'Supplier'>('all');

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
            industry: industryFilter
        });

        return {
            data: custRes.data,
            hasMore: custRes.data.length >= PAGE_SIZE,
            totalCount: custRes.total
        };
    }, [debouncedSearch, typeFilter, industryFilter]);

    const {
        items: customers,
        isLoading,
        isLoadingMore,
        hasMore,
        totalCount,
        sentinelRef,
        reset: resetInfiniteScroll,
        setItems: setCustomers
    } = useInfiniteScroll<Customer>({
        fetchFn: fetchCustomerPage,
        pageSize: PAGE_SIZE,
        resetDeps: [debouncedSearch, typeFilter, industryFilter]
    });

    const industries = ['all', 'Xây dựng', 'Bất động sản', 'Năng lượng', 'Công nghệ', 'Sản xuất', 'Khác']; // Hardcoded for filter UI

    const formatCurrency = (val: number) => {
        if (val >= 1e9) return `${(val / 1e9).toFixed(1)} tỷ`;
        if (val >= 1e6) return `${(val / 1e6).toFixed(0)} tr`;
        return val.toLocaleString('vi-VN');
    };

    const getIndustryColor = (industry: string) => {
        switch (industry) {
            case 'Xây dựng': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            case 'Bất động sản': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Năng lượng': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'Công nghệ': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'Sản xuất': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    // Summary stats for current view
    const viewStats = useMemo(() => {
        let totalContracts = 0;
        let totalValue = 0;
        customers.forEach(c => {
            const stats = c.stats || { contractCount: 0, totalValue: 0, totalRevenue: 0, activeContracts: 0 };
            totalContracts += stats.contractCount;
            totalValue += stats.totalValue;
        });
        return { totalContracts, totalValue };
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
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                </div>
                <button
                    onClick={() => setIsImportOpen(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 dark:shadow-none"
                >
                    <Upload size={18} />
                    <span className="hidden md:inline">Import</span>
                </button>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                    <Plus size={18} />
                    <span className="hidden md:inline">Thêm Đối tác</span>
                </button>
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

            {/* Partner Type Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
                {(['all', 'Customer', 'Supplier'] as const).map(type => (
                    <button
                        key={type}
                        onClick={() => setTypeFilter(type)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${typeFilter === type
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        {type === 'all' ? 'Tất cả' : type === 'Customer' ? 'Khách hàng' : 'Nhà cung cấp'}
                    </button>
                ))}
            </div>

            {/* Industry Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {industries.map(industry => (
                    <button
                        key={industry}
                        onClick={() => setIndustryFilter(industry)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${industryFilter === industry
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                            }`}
                    >
                        {industry === 'all' ? 'Tất cả' : industry}
                    </button>
                ))}
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
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Hợp đồng (Trang này)</p>
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
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Giá trị (Trang này)</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                            <Filter size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{industries.length - 1}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ngành nghề</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Customer List */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800">
                                <th className="text-left py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Đối tác</th>
                                <th className="text-left py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Ngành</th>
                                <th className="text-left py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Liên hệ</th>
                                <th className="text-right py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hợp đồng</th>
                                <th className="text-right py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">Giá trị</th>
                                <th className="py-4 px-6"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-500">Đang tải dữ liệu...</td>
                                </tr>
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center">
                                            <Building2 size={32} className="text-slate-300 mb-2" />
                                            <p>Không tìm thấy đối tác nào</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                customers.map((customer) => {
                                    const stats = customer.stats || { contractCount: 0, totalValue: 0, totalRevenue: 0, activeContracts: 0 };
                                    return (
                                        <tr
                                            key={customer.id}
                                            className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group cursor-pointer"
                                            onClick={() => onSelectCustomer?.(customer.id)}
                                        >
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center font-black text-slate-600 dark:text-slate-300 text-sm">
                                                        {customer.shortName ? customer.shortName.substring(0, 3) : 'KH'}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                                            {customer.name}
                                                        </h3>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <MapPin size={12} />
                                                            {customer.address?.split(',').pop()?.trim() || 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 hidden md:table-cell">
                                                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold ${getIndustryColor(customer.industry || '')}`}>
                                                    {customer.industry || 'Khác'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 hidden lg:table-cell">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{customer.contactPerson}</p>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                                        <span className="flex items-center gap-1"><Phone size={12} />{customer.phone}</span>
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
                </div>

                {/* INFINITE SCROLL SENTINEL + STATUS */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Hiển thị <strong>{customers.length}</strong> trên tổng số <strong>{totalCount}</strong> đối tác
                        </div>
                    </div>
                    {/* Sentinel for IntersectionObserver */}
                    <div ref={sentinelRef} className="h-1" />
                    {isLoadingMore && (
                        <div className="flex items-center justify-center py-6 gap-2 text-indigo-600 dark:text-indigo-400">
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

                <ScrollToTop />
            </div>
        </div>
    );
};

export default CustomerList;
