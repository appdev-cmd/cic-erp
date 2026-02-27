import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Loader2,
    Search,
    CreditCard,
    DollarSign,
    AlertCircle,
    CheckCircle2,
    Clock,
    FileCheck,
    Filter,
    FileText,
    Building2,
    Calendar,
    Plus
} from 'lucide-react';
import { Payment, PaymentStatus, Customer, Unit } from '../types';
import { PaymentService, ContractService, CustomerService, UnitService } from '../services';
import PaymentForm from './PaymentForm';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useCurrentUserVisibleUnits } from '../hooks';
import { useAuth } from '../contexts/AuthContext';
import ScrollToTop from './ui/ScrollToTop';
import { usePermissionCheck } from '../hooks/usePermissions';
import { useImpersonation } from '../contexts/ImpersonationContext';

interface PaymentListProps {
    onSelectContract?: (id: string) => void;
}

const PaymentList: React.FC<PaymentListProps> = ({ onSelectContract }) => {
    const { profile: realProfile } = useAuth();
    const { impersonatedUser, isImpersonating } = useImpersonation();
    const profile = isImpersonating && impersonatedUser ? impersonatedUser : realProfile;
    const { can } = usePermissionCheck();
    const { visibleUnits, isLoading: loadingVisibility } = useCurrentUserVisibleUnits();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [unitFilter, setUnitFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<'Revenue' | 'Expense'>('Revenue');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [stats, setStats] = useState<any>(null);

    // Infinite scroll batch size
    const PAGE_SIZE = 20;
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // CRUD state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState<Payment | undefined>(undefined);


    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Infinite scroll fetch function
    const fetchPaymentPage = useCallback(async (page: number) => {
        const [listRes, statsRes, customersData, unitsData] = await Promise.all([
            PaymentService.list({
                page,
                limit: PAGE_SIZE,
                search: debouncedSearch,
                type: typeFilter,
                status: statusFilter,
                unitIds: unitFilter === 'all' ? visibleUnits : [unitFilter]
            }),
            page === 1 ? PaymentService.getStats({
                type: typeFilter,
                unitIds: unitFilter === 'all' ? visibleUnits : [unitFilter]
            }) : Promise.resolve(null),
            page === 1 && customers.length === 0 ? CustomerService.getAll({ pageSize: 200 }) : Promise.resolve(null),
            page === 1 && units.length === 0 ? UnitService.getAll() : Promise.resolve(null)
        ]);

        if (statsRes) setStats(statsRes);
        if (customersData) {
            const incoming = (customersData as any).data || customersData;
            setCustomers(incoming as Customer[]);
        }
        if (unitsData) {
            setUnits(unitsData as Unit[]);
        }

        return {
            data: listRes.data,
            hasMore: listRes.data.length >= PAGE_SIZE,
            totalCount: listRes.count
        };
    }, [debouncedSearch, typeFilter, statusFilter, unitFilter, visibleUnits, customers.length, units.length]);

    const {
        items: payments,
        isLoading,
        isLoadingMore,
        hasMore,
        totalCount,
        sentinelRef,
        reset: resetInfiniteScroll,
        setItems: setPayments
    } = useInfiniteScroll<Payment>({
        fetchFn: fetchPaymentPage,
        pageSize: PAGE_SIZE,
        resetDeps: [debouncedSearch, typeFilter, statusFilter, unitFilter, visibleUnits]
    });

    // Legacy effect for stats calculation removed (now server-side or separately fetched)

    // Memoized is removed as we depend on API result now

    const formatCurrency = (val: number) => {
        if (val >= 1e9) return `${(val / 1e9).toFixed(2).replace(/\.?0+$/, '')} tỷ`;
        if (val >= 1e6) {
            const m = (val / 1e6).toFixed(1);
            return `${m.replace('.0', '').replace('.', ',')} triệu`;
        }
        return val.toLocaleString('vi-VN') + ' đ';
    };

    const getStatusConfig = (status: PaymentStatus) => {
        switch (status) {
            case 'Tiền về':
            case 'Paid':
                return { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2, label: typeFilter === 'Revenue' ? 'Tiền về' : 'Đã chi' };
            case 'Đã xuất HĐ':
                return { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: FileCheck, label: 'Đã xuất HĐ' };
            case 'Chờ xuất HĐ':
            case 'Pending':
                return { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock, label: typeFilter === 'Revenue' ? 'Chờ thu' : 'Chờ chi' };
            case 'Quá hạn':
            case 'Overdue':
                return { color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: AlertCircle, label: 'Quá hạn' };
            default:
                return { color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400', icon: Clock, label: status };
        }
    };

    const getCustomerName = (customerId: string | null) => {
        if (!customerId) return '—';
        const customer = customers.find(c => c.id === customerId);
        return customer ? customer.name : '—';
    };

    // CRUD handlers
    const handleAdd = () => {
        setEditingPayment(undefined);
        setIsFormOpen(true);
    };

    const handleEdit = (payment: Payment) => {
        setEditingPayment(payment);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Bạn có chắc muốn xóa khoản thanh toán này?')) {
            try {
                await PaymentService.delete(id);
                setPayments(payments.filter(p => p.id !== id));
                toast.success("Đã xóa khoản thanh toán");
            } catch (error) {
                console.error("Failed to delete payment:", error);
                toast.error("Xóa thất bại");
            }
        }
    };

    const handleSave = async (paymentData: any) => {
        try {
            if (paymentData.id) {
                // Update
                const updated = await PaymentService.update(paymentData.id, paymentData);
                if (updated) {
                    setPayments(payments.map(p => p.id === paymentData.id ? updated : p));
                }
            } else {
                // Create
                const newPaymentData = {
                    ...paymentData,
                    paymentType: typeFilter // Default to current filter
                };
                const created = await PaymentService.create(newPaymentData);
                setPayments([created, ...payments]);
            }
            setIsFormOpen(false);
            setEditingPayment(undefined);
            resetInfiniteScroll(); // Refresh to ensure data consistency
            toast.success("Lưu khoản thanh toán thành công");
        } catch (error) {
            console.error("Failed to save payment:", error);
            toast.error("Lưu thất bại");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">
                        Quản lý Tài chính
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Theo dõi dòng tiền Thu & Chi
                    </p>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => { setTypeFilter('Revenue'); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${typeFilter === 'Revenue' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Khoản Thu
                    </button>
                    <button
                        onClick={() => { setTypeFilter('Expense'); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${typeFilter === 'Expense' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Khoản Chi
                    </button>
                </div>
            </div>

            {(() => {
                // Spec §6.4: Chỉ Accountant, ChiefAccountant, Admin mới được thêm thu/chi thực tế
                const canAdd = can('payments', 'create');

                if (!canAdd) return null;

                return (
                    <button
                        onClick={handleAdd}
                        className={`px-5 py-2.5 text-white rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-lg ${typeFilter === 'Revenue' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'}`}
                    >
                        <Plus size={18} />
                        Thêm {typeFilter === 'Revenue' ? 'khoản thu' : 'khoản chi'}
                    </button>
                );
            })()}


            {/* Stats Cards */}
            {
                stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                    <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-emerald-600">{formatCurrency(stats.paidAmount)}</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{typeFilter === 'Revenue' ? 'Tiền về' : 'Đã chi'} ({stats.paidCount})</p>
                                </div>
                            </div>
                        </div>
                        {typeFilter === 'Revenue' && (
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                        <FileCheck size={20} className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-blue-600">{formatCurrency(stats.invoicedAmount || 0)}</p>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Đã xuất HĐ</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                    <Clock size={20} className="text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-amber-600">{formatCurrency(stats.pendingAmount)}</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{typeFilter === 'Revenue' ? 'Chờ thu' : 'Chờ chi'} ({stats.pendingCount})</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                                    <AlertCircle size={20} className="text-rose-600 dark:text-rose-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-rose-600">{formatCurrency(stats.overdueAmount)}</p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Quá hạn ({stats.overdueCount})</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo mã, hợp đồng, hóa đơn..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <Building2 size={16} className="text-slate-400" />
                    <select
                        value={unitFilter}
                        onChange={(e) => { setUnitFilter(e.target.value); }}
                        className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
                    >
                        {(visibleUnits === 'all' || visibleUnits.length > 1) && (
                            <option value="all">Tất cả đơn vị</option>
                        )}
                        {units.filter(u =>
                            u.id !== 'all' &&
                            u.type !== 'Company' &&
                            (visibleUnits === 'all' || visibleUnits.includes(u.id))
                        ).map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <Filter size={16} className="text-slate-400" />
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); }}
                        className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
                    >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="Tiền về">Tiền về</option>
                        <option value="Đã xuất HĐ">Đã xuất HĐ</option>
                        <option value="Chờ xuất HĐ">Chờ xuất HĐ</option>
                        <option value="Quá hạn">Quá hạn</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                                <th className="text-left py-4 px-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mã / Hóa đơn</th>
                                <th className="text-left py-4 px-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Khách hàng</th>
                                <th className="text-left py-4 px-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Hợp đồng</th>
                                <th className="text-left py-4 px-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">Hạn</th>
                                <th className="text-right py-4 px-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Số tiền</th>
                                <th className="text-center py-4 px-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trạng thái</th>

                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        <Loader2 className="animate-spin inline-block mr-2" /> Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : payments.map((payment) => {
                                const statusConfig = getStatusConfig(payment.status);
                                const StatusIcon = statusConfig.icon;

                                return (
                                    <tr
                                        key={payment.id}
                                        onClick={() => handleEdit(payment)}
                                        className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-indigo-50/50 dark:hover:bg-slate-700 transition-colors group cursor-pointer"
                                    >
                                        <td className="py-4 px-5">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                    <CreditCard size={16} className="text-slate-500" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{payment.id}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{payment.invoiceNumber}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 hidden lg:table-cell">
                                            <div className="flex items-center gap-2">
                                                <Building2 size={14} className="text-slate-400" />
                                                <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                                                    {getCustomerName(payment.customerId)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 hidden md:table-cell">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onSelectContract?.(payment.contractId); }}
                                                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
                                            >
                                                <FileText size={14} />
                                                <span className="text-sm font-medium">{payment.contractId}</span>
                                            </button>
                                        </td>
                                        <td className="py-4 px-5 hidden sm:table-cell">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-slate-400" />
                                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                                    {new Date(payment.dueDate).toLocaleDateString('vi-VN')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-5 text-right">
                                            <p className="font-black text-slate-900 dark:text-slate-100">{formatCurrency(payment.amount)}</p>
                                            {payment.paidAmount > 0 && payment.paidAmount < payment.amount && (
                                                <p className="text-[10px] text-emerald-600">Đã thu: {formatCurrency(payment.paidAmount)}</p>
                                            )}
                                        </td>
                                        <td className="py-4 px-5 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${statusConfig.color}`}>
                                                <StatusIcon size={12} />
                                                {statusConfig.label}
                                            </span>
                                        </td>

                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* INFINITE SCROLL SENTINEL + STATUS */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-bold text-slate-500">
                            Hiển thị {payments.length} / {totalCount} kết quả
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
                    {!hasMore && payments.length > 0 && !isLoading && (
                        <div className="text-center py-4 text-sm text-slate-400 dark:text-slate-500">
                            Đã hiển thị tất cả {totalCount} kết quả
                        </div>
                    )}
                </div>

                {!isLoading && payments.length === 0 && (
                    <div className="text-center py-12">
                        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CreditCard size={24} className="text-slate-400" />
                        </div>
                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Không tìm thấy</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Thử thay đổi bộ lọc</p>
                    </div>
                )}
            </div>

            {/* Payment Form Modal */}
            {isFormOpen && (
                <PaymentForm
                    payment={editingPayment}
                    initialPaymentType={typeFilter}
                    onSave={handleSave}
                    onCancel={() => { setIsFormOpen(false); setEditingPayment(undefined); }}
                />
            )}
            <ScrollToTop />
        </div>
    );
};

export default PaymentList;
