import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
    Loader2,
    Search,
    CreditCard,
    DollarSign,
    CheckCircle2,
    Clock,
    FileCheck,
    Filter,
    FileText,
    Building2,
    Calendar,
    Plus,
    Trash2,
    ArrowDownCircle,
    ArrowUpCircle,
    Receipt,
    AlertTriangle,
    TrendingUp,
    RotateCcw
} from 'lucide-react';
import { Payment, PaymentStatus, Unit, VoucherType } from '../types';
import { PaymentService, ContractService, UnitService } from '../services';
import { useLayoutContext } from './layout/MainLayout';
import PaymentForm from './PaymentForm';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useCurrentUserVisibleUnits } from '../hooks';
import { useAuth } from '../contexts/AuthContext';
import ScrollToTop from './ui/ScrollToTop';
import { usePermissionCheck } from '../hooks/usePermissions';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { formatNumber } from '../lib/utils';
import { formatDate } from '../utils/formatters';
import { useColumnResize } from '../hooks/useColumnResize';
import { useSlidePanelSafe } from '../contexts/SlidePanelContext';

interface PaymentListProps {
    onSelectContract?: (id: string) => void;
}

const VOUCHER_TABS: { type: VoucherType; label: string; icon: React.ReactNode; color: string; activeClass: string }[] = [
    {
        type: 'VAT_INVOICE',
        label: 'Hoá đơn VAT',
        icon: <FileText size={15} />,
        color: 'text-blue-600 dark:text-blue-400',
        activeClass: 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
    },
    {
        type: 'RECEIPT',
        label: 'Phiếu thu',
        icon: <ArrowDownCircle size={15} />,
        color: 'text-emerald-600 dark:text-emerald-400',
        activeClass: 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
    },
    {
        type: 'EXPENSE',
        label: 'Phiếu chi',
        icon: <ArrowUpCircle size={15} />,
        color: 'text-rose-600 dark:text-rose-400',
        activeClass: 'bg-rose-600 text-white shadow-lg shadow-rose-500/25'
    },
];

const PaymentList: React.FC<PaymentListProps> = ({ onSelectContract }) => {
    const { profile: realProfile } = useAuth();
    const { impersonatedUser, isImpersonating } = useImpersonation();
    const profile = isImpersonating && impersonatedUser ? impersonatedUser : realProfile;
    const { can } = usePermissionCheck();
    const { visibleUnits, isLoading: loadingVisibility } = useCurrentUserVisibleUnits();

    const [voucherTab, setVoucherTabState] = useState<VoucherType>(() => {
        return (localStorage.getItem('cic-erp-payment-tab') as VoucherType) || 'VAT_INVOICE';
    });

    const setVoucherTab = (tab: VoucherType) => {
        setVoucherTabState(tab);
        localStorage.setItem('cic-erp-payment-tab', tab);
    };

    // === Resizable columns ===
    const PAYMENT_TABLE_COLUMNS = useMemo(() => [
        { key: 'stt', defaultWidth: 45, minWidth: 35 },
        { key: 'extra', defaultWidth: 130, minWidth: 70 },
        { key: 'customer', defaultWidth: 280, minWidth: 120 },
        { key: 'contract', defaultWidth: 200, minWidth: 100 },
        { key: 'date', defaultWidth: 110, minWidth: 70 },
        { key: 'amount', defaultWidth: 140, minWidth: 80 },
        { key: 'actions', defaultWidth: 45, minWidth: 35 },
    ], []);

    const { columnWidths, onResizeStart, isResizing, resetWidths } = useColumnResize({
        tableId: 'payment-list',
        userId: realProfile?.id,
        columns: PAYMENT_TABLE_COLUMNS,
    });

    const { selectedUnit, yearFilter } = useLayoutContext();
    const unitFilter = selectedUnit?.id || 'all';

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [units, setUnits] = useState<Unit[]>([]);
    const [stats, setStats] = useState<any>(null);

    const PAGE_SIZE = 20;
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState<Payment | undefined>(undefined);

    // Slide panel support for ear-style tab opening
    const slidePanelCtx = useSlidePanelSafe();

    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchQuery); }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset status filter when tab changes
    useEffect(() => {
        setStatusFilter('all');
    }, [voucherTab]);

    const fetchPaymentPage = useCallback(async (page: number) => {
        const [listRes, statsRes, unitsData] = await Promise.all([
            PaymentService.list({
                page,
                limit: PAGE_SIZE,
                search: debouncedSearch,
                voucherType: voucherTab,
                status: statusFilter,
                unitIds: unitFilter === 'all' ? visibleUnits : [unitFilter],
                year: yearFilter
            }),
            page === 1 ? PaymentService.getStats({
                unitIds: unitFilter === 'all' ? visibleUnits : [unitFilter],
                year: yearFilter
            }) : Promise.resolve(null),
            page === 1 && units.length === 0 ? UnitService.getAll() : Promise.resolve(null)
        ]);

        if (statsRes) setStats(statsRes);
        if (unitsData) setUnits(unitsData as Unit[]);

        return {
            data: listRes.data,
            hasMore: listRes.data.length >= PAGE_SIZE,
            totalCount: listRes.count
        };
    }, [debouncedSearch, voucherTab, statusFilter, unitFilter, visibleUnits, yearFilter, units.length]);

    const {
        items: payments,
        isLoading,
        isLoadingMore,
        hasMore,
        totalCount,
        sentinelRef,
        reset: resetInfiniteScroll,
        silentRefresh,
        setItems: setPayments
    } = useInfiniteScroll<Payment>({
        fetchFn: fetchPaymentPage,
        pageSize: PAGE_SIZE,
        resetDeps: [debouncedSearch, voucherTab, statusFilter, unitFilter, visibleUnits, yearFilter]
    });

    // Realtime: silent refresh when payment data changes from another tab
    useEffect(() => {
        const handleRealtimeRefresh = () => { silentRefresh(); };
        window.addEventListener('payment-changed', handleRealtimeRefresh);
        return () => window.removeEventListener('payment-changed', handleRealtimeRefresh);
    }, [silentRefresh]);

    const formatCurrency = (val: number) => formatNumber(val) + ' ₫';

    const getStatusConfig = (status: PaymentStatus) => {
        switch (status) {
            case 'Tạm ứng': return { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: DollarSign, label: 'Tạm ứng' };
            case 'Tiền về': return { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2, label: 'Tiền về' };
            case 'Đã xuất HĐ': return { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: FileCheck, label: 'Đã xuất HĐ' };
            case 'Đã giao KH': return { color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: CheckCircle2, label: 'Đã giao KH' };
            case 'Đề nghị chi': return { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: Clock, label: 'Đề nghị chi' };
            case 'Đã chi': return { color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: CheckCircle2, label: 'Đã chi' };
            default: return { color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400', icon: Clock, label: status };
        }
    };

    const getCustomerName = (payment: Payment & { customerName?: string }) => {
        return (payment as any).customerName || '—';
    };

    const getUnitName = (unitId?: string) => {
        if (!unitId) return '—';
        return units.find(u => u.id === unitId)?.name || '—';
    };

    // CRUD
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const handleDeleteConfirm = async () => {
        if (!deleteConfirmId) return;
        try {
            await PaymentService.delete(deleteConfirmId);
            setPayments(payments.filter(p => p.id !== deleteConfirmId));
            toast.success("Đã xóa phiếu tài chính");
        } catch (error) {
            console.error("Failed to delete payment:", error);
            toast.error("Xóa thất bại");
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const handleFormClose = () => {
        setIsFormOpen(false);
        setEditingPayment(undefined);
    };

    const handleSave = async (paymentData: any) => {
        try {
            if (paymentData.id) {
                const updated = await PaymentService.update(paymentData.id, paymentData);
                if (updated) setPayments(payments.map(p => p.id === paymentData.id ? updated : p));
            } else {
                const created = await PaymentService.create(paymentData);
                setPayments([created, ...payments]);
            }
            // Close slide panel if opened there
            if (slidePanelCtx) {
                slidePanelCtx.closePanel();
            } else {
                setIsFormOpen(false);
            }
            setEditingPayment(undefined);
            resetInfiniteScroll();
            toast.success(paymentData.id ? "Cập nhật thành công" : "Tạo phiếu thành công");
        } catch (error) {
            console.error("Failed to save payment:", error);
            toast.error("Lưu thất bại");
        }
    };

    const handleCancel = () => {
        if (slidePanelCtx) {
            slidePanelCtx.closePanel();
        } else {
            handleFormClose();
        }
    };

    const openPaymentInPanel = (payment?: Payment) => {
        const vType = payment?.voucherType || voucherTab;
        const typeLabel = vType === 'VAT_INVOICE' ? 'HĐ VAT' : vType === 'RECEIPT' ? 'Phiếu thu' : 'Phiếu chi';
        const title = payment
            ? `${typeLabel}: ${payment.invoiceNumber || payment.expenseCategory || formatNumber(payment.amount)}`
            : `Thêm ${typeLabel}`;

        if (slidePanelCtx) {
            const icon = vType === 'VAT_INVOICE'
                ? <FileText size={14} />
                : vType === 'RECEIPT'
                    ? <ArrowDownCircle size={14} />
                    : <ArrowUpCircle size={14} />;
            slidePanelCtx.openPanel({
                title,
                icon,
                component: (
                    <div className="p-4 md:p-6 lg:p-8">
                        <PaymentForm
                            payment={payment}
                            initialVoucherType={voucherTab}
                            isInsidePanel={true}
                            onSave={handleSave}
                            onCancel={() => slidePanelCtx.closePanel()}
                        />
                    </div>
                ),
            });
        } else {
            // Fallback: open as modal
            setEditingPayment(payment);
            setIsFormOpen(true);
        }
    };

    const handleAdd = () => { openPaymentInPanel(undefined); };
    const handleEdit = (payment: Payment) => {
        if (can('payments', 'update')) {
            openPaymentInPanel(payment);
        } else {
            openPaymentInPanel(payment);
        }
    };

    // Status filter options per tab
    const getStatusOptions = (): { value: string; label: string }[] => {
        const opts: { value: string; label: string }[] = [{ value: 'all', label: 'Tất cả' }];
        switch (voucherTab) {
            case 'VAT_INVOICE': break; // VAT invoices have no status filter
            case 'RECEIPT': opts.push({ value: 'Tạm ứng', label: 'Tạm ứng' }, { value: 'Tiền về', label: 'Tiền về' }); break;
            case 'EXPENSE': opts.push({ value: 'Đề nghị chi', label: 'Đề nghị chi' }, { value: 'Đã chi', label: 'Đã chi' }); break;
        }
        return opts;
    };

    // Permission check: only show Add button if user has create permission
    const canCreate = can('payments', 'create');
    const canDelete = can('payments', 'delete');

    // Tab-specific extra column header
    const getExtraColumnHeader = () => {
        switch (voucherTab) {
            case 'VAT_INVOICE': return 'Số HĐ';
            case 'RECEIPT': return 'Số Phiếu thu';
            case 'EXPENSE': return 'Hạng mục';
        }
    };

    const getExtraColumnValue = (p: Payment) => {
        switch (voucherTab) {
            case 'VAT_INVOICE': return p.invoiceNumber || '—';
            case 'RECEIPT': return p.reference || '—';
            case 'EXPENSE': return p.expenseCategory || '—';
        }
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">
                        Quản lý Tài chính
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Phiếu xuất HĐ VAT, Phiếu thu, Phiếu chi theo hợp đồng
                    </p>
                </div>

                {canCreate && (
                    <button
                        onClick={handleAdd}
                        className={`px-5 py-2.5 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg ${voucherTab === 'VAT_INVOICE' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-blue-900/30'
                            : voucherTab === 'RECEIPT' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 dark:shadow-emerald-900/30'
                                : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200 dark:shadow-rose-900/30'
                            }`}
                    >
                        <Plus size={18} />
                        Thêm phiếu
                    </button>
                )}
            </div>

            {/* === 3 TABS (ear-style) === */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 gap-0">
                {VOUCHER_TABS.map(tab => (
                    <button
                        key={tab.type}
                        onClick={() => setVoucherTab(tab.type)}
                        className={`flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold transition-all relative ${voucherTab === tab.type
                            ? `${tab.color} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 border-b-white dark:border-b-slate-900 rounded-t-xl -mb-px z-10`
                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-t-xl'
                            }`}
                    >
                        {tab.icon}
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Global Financial Summary — Always visible across all tabs */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Doanh thu (−VAT) = same as Dashboard "Doanh thu" */}
                    <div className={`bg-white dark:bg-slate-900 p-4 rounded-xl border transition-all ${voucherTab === 'VAT_INVOICE' ? 'border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'border-slate-200 dark:border-slate-800'}`}>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl"><TrendingUp size={18} className="text-indigo-600 dark:text-indigo-400" /></div>
                            <div>
                                <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(stats.revenueAmount || 0)}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Doanh thu (−VAT)</p>
                            </div>
                        </div>
                    </div>
                    {/* Đã xuất HĐ (gross VAT invoiced) */}
                    <div className={`bg-white dark:bg-slate-900 p-4 rounded-xl border transition-all ${voucherTab === 'VAT_INVOICE' ? 'border-blue-300 dark:border-blue-700 ring-1 ring-blue-200 dark:ring-blue-800' : 'border-slate-200 dark:border-slate-800'}`}>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl"><FileCheck size={18} className="text-blue-600 dark:text-blue-400" /></div>
                            <div>
                                <p className="text-lg font-black text-blue-600 dark:text-blue-400">{formatCurrency(stats.invoicedAmount || 0)}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Đã xuất HĐ ({stats.invoicedCount || 0} phiếu)</p>
                            </div>
                        </div>
                    </div>
                    {/* Tiền về */}
                    <div className={`bg-white dark:bg-slate-900 p-4 rounded-xl border transition-all ${voucherTab === 'RECEIPT' ? 'border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800' : 'border-slate-200 dark:border-slate-800'}`}>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl"><CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" /></div>
                            <div>
                                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency((stats.cashReceivedAmount || 0) + (stats.advanceAmount || 0))}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Tiền về ({stats.cashReceivedCount || 0}) + Tạm ứng ({stats.advanceCount || 0})</p>
                            </div>
                        </div>
                    </div>
                    {/* Tổng chi */}
                    <div className={`bg-white dark:bg-slate-900 p-4 rounded-xl border transition-all ${voucherTab === 'EXPENSE' ? 'border-rose-300 dark:border-rose-700 ring-1 ring-rose-200 dark:ring-rose-800' : 'border-slate-200 dark:border-slate-800'}`}>
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl"><ArrowUpCircle size={18} className="text-rose-600 dark:text-rose-400" /></div>
                            <div>
                                <p className="text-lg font-black text-rose-600 dark:text-rose-400">{formatCurrency(stats.expenseAmount || 0)}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Tổng chi ({stats.expenseCount || 0}){stats.pendingExpenseAmount > 0 ? ` · Chờ duyệt: ${formatCurrency(stats.pendingExpenseAmount)}` : ''}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm theo Số HĐ, khách hàng, hợp đồng, số chứng từ..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className={`overflow-x-auto overflow-y-auto max-h-[calc(100vh-420px)] ${isResizing ? 'select-none' : ''}`}>
                    <table className="text-left" style={{ tableLayout: 'fixed', width: Object.values(columnWidths).reduce((a, b) => a + b, 0), minWidth: '100%' }}>
                        <colgroup>
                            {PAYMENT_TABLE_COLUMNS.map(c => (
                                <col key={c.key} style={{ width: columnWidths[c.key] }} />
                            ))}
                        </colgroup>
                        <thead>
                            <tr>
                                {[
                                    { key: 'stt', label: 'STT', align: 'center' },
                                    { key: 'extra', label: getExtraColumnHeader(), align: 'left' },
                                    { key: 'customer', label: 'Khách hàng', align: 'left' },
                                    { key: 'contract', label: 'Hợp đồng', align: 'left' },
                                    { key: 'date', label: 'Ngày', align: 'left' },
                                    { key: 'amount', label: 'Số tiền', align: 'right' },
                                    ...(canDelete ? [{ key: 'actions', label: '', align: 'center' }] : []),
                                ].map((col, idx, arr) => (
                                    <th key={col.key} className={`sticky top-0 z-20 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 py-3 px-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase relative group/th ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}>
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
                                    <td colSpan={8} className="p-8 text-center text-slate-500">
                                        <Loader2 className="animate-spin inline-block mr-2" /> Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : payments.map((payment, index) => {
                                const statusConfig = getStatusConfig(payment.status);
                                const StatusIcon = statusConfig.icon;
                                const dateStr = payment.paymentDate || payment.dueDate;

                                return (
                                    <tr
                                        key={payment.id}
                                        onClick={() => handleEdit(payment)}
                                        className="border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                                    >
                                        <td className="py-3 px-2 text-center">
                                            <span className="text-xs font-medium text-slate-400">{index + 1}</span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                {getExtraColumnValue(payment)}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 hidden lg:table-cell">
                                            <div className="flex items-center gap-1.5">
                                                <Building2 size={12} className="text-slate-400 flex-shrink-0" />
                                                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium" title={getCustomerName(payment)}>
                                                    {getCustomerName(payment)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 hidden md:table-cell">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onSelectContract?.(payment.contractId); }}
                                                className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                                            >
                                                <FileText size={12} />
                                                <span className="text-xs font-medium">{(payment as any).contractCode || payment.contractId}</span>
                                            </button>
                                        </td>
                                        <td className="py-3 px-3 hidden sm:table-cell">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={12} className="text-slate-400" />
                                                <span className="text-xs text-slate-600 dark:text-slate-400">
                                                    {dateStr ? formatDate(dateStr) : '—'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                            <p className="font-black text-slate-900 dark:text-slate-100 text-xs">{formatCurrency(payment.amount)}</p>
                                        </td>

                                        {canDelete && (
                                            <td className="py-3 px-2 text-center">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(payment.id); }}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                                                    title="Xóa phiếu"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Infinite scroll sentinel */}
                    <div className="p-4 flex flex-col items-center justify-center">
                        <div ref={sentinelRef} className="h-4 w-full" />
                        {isLoadingMore && (
                            <div className="flex items-center justify-center py-4 gap-2 text-indigo-600 dark:text-indigo-400">
                                <Loader2 size={20} className="animate-spin" />
                                <span className="text-sm font-medium">Đang tải thêm...</span>
                            </div>
                        )}
                        {!hasMore && payments.length > 0 && !isLoading && (
                            <div className="text-center py-4 text-sm text-slate-400">
                                Đã hiển thị tất cả {totalCount} kết quả
                            </div>
                        )}
                    </div>
                </div>

                {/* Status bar */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            Hiển thị {payments.length} / {totalCount} kết quả
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

                {!isLoading && payments.length === 0 && (
                    <div className="text-center py-12">
                        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CreditCard size={24} className="text-slate-400" />
                        </div>
                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Không tìm thấy phiếu nào</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Thử thay đổi bộ lọc hoặc thêm phiếu mới</p>
                    </div>
                )}
            </div>

            {/* Payment Form Modal (fallback when no slide panel available) */}
            {isFormOpen && !slidePanelCtx && (
                <PaymentForm
                    payment={editingPayment}
                    initialVoucherType={voucherTab}
                    onSave={handleSave}
                    onCancel={handleCancel}
                />
            )}

            {/* Delete Confirmation */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl">
                                <Trash2 size={20} className="text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Xóa phiếu tài chính</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{deleteConfirmId}</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Bạn có chắc chắn muốn xóa? <span className="font-bold text-red-600 dark:text-red-400">Không thể hoàn tác</span>.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                Hủy
                            </button>
                            <button onClick={handleDeleteConfirm} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors">
                                Xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ScrollToTop />
        </div>
    );
};

export default PaymentList;
