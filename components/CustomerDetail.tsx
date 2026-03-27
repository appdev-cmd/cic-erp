import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import {
    ArrowLeft, Building2, FileText, Edit3, Trash2, Loader2,
    Target, Users, DollarSign, StickyNote
} from 'lucide-react';
import { Customer, Contract, Payment } from '../types';
import { CustomerService, ContractService, PaymentService } from '../services';
import CustomerForm from './CustomerForm';
import CustomerContactsTab from './CustomerContactsTab';
import { usePermissionCheck } from '../hooks/usePermissions';

// Sub-components
import CustomerProfileCard from './customer-detail/CustomerProfileCard';
import CustomerOverviewTab from './customer-detail/CustomerOverviewTab';
import CustomerContractsTab from './customer-detail/CustomerContractsTab';
import CustomerPaymentsTab from './customer-detail/CustomerPaymentsTab';
import CustomerNotesTab from './customer-detail/CustomerNotesTab';

interface CustomerDetailProps {
    customerId: string;
    onBack: () => void;
    onViewContract: (contractId: string) => void;
}

const CustomerDetail: React.FC<CustomerDetailProps> = ({ customerId, onBack, onViewContract }) => {
    const { can } = usePermissionCheck();
    const allowDelete = can('customers', 'delete');

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTabState] = useState<'overview' | 'contacts' | 'contracts' | 'payments' | 'notes'>(() => {
        return (localStorage.getItem('cic-erp-customer-tab') as any) || 'overview';
    });

    const setActiveTab = (tab: 'overview' | 'contacts' | 'contracts' | 'payments' | 'notes') => {
        setActiveTabState(tab);
        localStorage.setItem('cic-erp-customer-tab', tab);
    };

    // Tab-specific state
    const [contractFilter, setContractFilter] = useState<string>('all');
    const [editingNotes, setEditingNotes] = useState(false);
    const [notesValue, setNotesValue] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // ==================== DATA FETCHING ====================
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [custData, contData, payData] = await Promise.all([
                CustomerService.getById(customerId),
                ContractService.getByCustomerId(customerId),
                PaymentService.getByCustomerId(customerId).catch(() => [] as Payment[])
            ]);
            setCustomer(custData || null);
            setContracts(contData || []);
            setPayments(payData || []);
            if (custData) setNotesValue(custData.notes || '');
        } catch (error) {
            console.error("Error fetching customer details", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [customerId]);

    // Realtime: silently refetch when related data changes
    useEffect(() => {
        const handleRefresh = () => { fetchData(); };
        window.addEventListener('customer-changed', handleRefresh);
        window.addEventListener('contract-changed', handleRefresh);
        window.addEventListener('payment-changed', handleRefresh);
        return () => {
            window.removeEventListener('customer-changed', handleRefresh);
            window.removeEventListener('contract-changed', handleRefresh);
            window.removeEventListener('payment-changed', handleRefresh);
        };
    }, [customerId]);

    // ==================== COMPUTED VALUES ====================
    const stats = useMemo(() => {
        if (!contracts.length) return { contractCount: 0, totalValue: 0, totalRevenue: 0, activeContracts: 0, completedContracts: 0, avgContractValue: 0 };
        const totalValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);
        const totalRevenue = contracts.reduce((sum, c) => sum + (c.actualRevenue || 0), 0);
        return {
            contractCount: contracts.length,
            totalValue,
            totalRevenue,
            activeContracts: contracts.filter(c => c.status === 'Processing').length,
            completedContracts: contracts.filter(c => c.status === 'Completed').length,
            avgContractValue: contracts.length > 0 ? totalValue / contracts.length : 0
        };
    }, [contracts]);

    const paymentStats = useMemo(() => {
        const totalAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
        const paidAmount = payments.filter(p => p.status === 'Tiền về').reduce((s, p) => s + (p.amount || 0), 0);
        return { totalAmount, paidAmount, pendingAmount: totalAmount - paidAmount, count: payments.length };
    }, [payments]);

    const filteredContracts = useMemo(() => {
        if (contractFilter === 'all') return contracts;
        return contracts.filter(c => c.status === contractFilter);
    }, [contracts, contractFilter]);

    const contractStatusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        contracts.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
        return counts;
    }, [contracts]);

    const revenueRate = stats.totalValue > 0 ? Math.min((stats.totalRevenue / stats.totalValue) * 100, 100) : 0;

    // ==================== UTILITY FUNCTIONS ====================
    const formatCurrency = (val: number) => {
        return (val || 0).toLocaleString('vi-VN') + ' ₫';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': case 'Processing': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'Completed': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'Expired': case 'Cancelled': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
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

    const getRatingColor = (rating?: string) => {
        switch (rating) {
            case 'VIP': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'Gold': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'Lead': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    // ==================== HANDLERS ====================
    const handleDelete = async () => {
        setDeleting(true);
        try {
            await CustomerService.delete(customerId);
            toast.success("Đã xóa khách hàng thành công");
            onBack();
        } catch (error) {
            console.error("Error deleting customer", error);
            toast.error("Có lỗi xảy ra khi xóa khách hàng");
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleSave = async (data: Customer | Omit<Customer, 'id'>) => {
        if ('id' in data) {
            await CustomerService.update(data.id, data);
            setCustomer(data as Customer);
            setIsEditing(false);
            toast.success("Cập nhật thông tin khách hàng thành công");
        }
    };

    const handleSaveNotes = async () => {
        if (!customer) return;
        setSavingNotes(true);
        try {
            await CustomerService.update(customerId, { ...customer, notes: notesValue });
            setCustomer({ ...customer, notes: notesValue });
            setEditingNotes(false);
            toast.success("Đã lưu ghi chú");
        } catch (err) {
            toast.error("Lỗi khi lưu ghi chú");
        } finally {
            setSavingNotes(false);
        }
    };

    // ==================== LOADING / ERROR STATES ====================
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="text-center py-16">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building2 size={32} className="text-slate-400" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-lg">Không tìm thấy khách hàng</p>
                <button onClick={onBack} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors">
                    Quay lại
                </button>
            </div>
        );
    }

    // ==================== RENDER ====================
    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">Chi tiết Khách hàng</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">CRM — Quản lý quan hệ khách hàng</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                        <Edit3 size={16} /> Chỉnh sửa
                    </button>
                    {allowDelete && (
                        <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/30 rounded-lg text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all cursor-pointer">
                            <Trash2 size={16} /> Xóa
                        </button>
                    )}
                </div>
            </div>

            {/* Profile Card */}
            <CustomerProfileCard customer={customer} contractCount={contracts.length}
                getIndustryColor={getIndustryColor} getRatingColor={getRatingColor} />

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.contractCount}</p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Tổng HĐ</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.activeContracts}</p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Đang thực hiện</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(stats.totalValue)}</p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Tổng giá trị</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{formatCurrency(stats.totalRevenue)}</p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Doanh thu</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center col-span-2 md:col-span-1">
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{formatCurrency(paymentStats.paidAmount)}</p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Đã thanh toán</p>
                </div>
            </div>

            {/* Tab Navigation + Content */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800 no-scrollbar">
                    {[
                        { key: 'overview' as const, label: 'Tổng quan', icon: Target },
                        { key: 'contacts' as const, label: 'Liên hệ', icon: Users },
                        { key: 'contracts' as const, label: `Hợp đồng (${contracts.length})`, icon: FileText },
                        { key: 'payments' as const, label: `Thanh toán (${payments.length})`, icon: DollarSign },
                        { key: 'notes' as const, label: 'Ghi chú', icon: StickyNote }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold transition-all border-b-2 -mb-px whitespace-nowrap ${activeTab === tab.key
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-5">
                    {activeTab === 'overview' && (
                        <CustomerOverviewTab customer={customer} stats={stats}
                            paymentStats={paymentStats} revenueRate={revenueRate}
                            formatCurrency={formatCurrency} setActiveTab={setActiveTab} />
                    )}
                    {activeTab === 'contacts' && <CustomerContactsTab customerId={customerId} />}
                    {activeTab === 'contracts' && (
                        <CustomerContractsTab contracts={contracts} filteredContracts={filteredContracts}
                            contractFilter={contractFilter} setContractFilter={setContractFilter}
                            contractStatusCounts={contractStatusCounts} formatCurrency={formatCurrency}
                            getStatusColor={getStatusColor} onViewContract={onViewContract} />
                    )}
                    {activeTab === 'payments' && (
                        <CustomerPaymentsTab payments={payments} paymentStats={paymentStats}
                            formatCurrency={formatCurrency} onViewContract={onViewContract} />
                    )}
                    {activeTab === 'notes' && (
                        <CustomerNotesTab customer={customer} editingNotes={editingNotes}
                            setEditingNotes={setEditingNotes} notesValue={notesValue}
                            setNotesValue={setNotesValue} savingNotes={savingNotes}
                            handleSaveNotes={handleSaveNotes} />
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            <CustomerForm isOpen={isEditing} onClose={() => setIsEditing(false)} onSave={handleSave} customer={customer} />

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-md mx-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-full">
                                <Trash2 size={20} className="text-rose-600 dark:text-rose-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Xóa khách hàng?</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Hành động này không thể hoàn tác</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Bạn có chắc muốn xóa <strong className="text-slate-900 dark:text-slate-100">{customer.name}</strong>?
                            Tất cả dữ liệu liên quan sẽ bị xóa vĩnh viễn.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                                Hủy
                            </button>
                            <button onClick={handleDelete} disabled={deleting}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50">
                                {deleting ? (<><Loader2 size={14} className="animate-spin" /> Đang xóa...</>) : (<><Trash2 size={14} /> Xóa vĩnh viễn</>)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerDetail;
