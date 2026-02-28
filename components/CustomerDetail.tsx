import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Building2,
    FileText,
    TrendingUp,
    ChevronRight,
    Mail,
    Phone,
    MapPin,
    Globe,
    Hash,
    User,
    Edit3,
    Trash2,
    Loader2,
    Star,
    CreditCard,
    Target,
    Plus,
    Users,
    DollarSign,
    Calendar,
    CheckCircle,
    Clock,
    AlertCircle,
    StickyNote,
    Save,
    BarChart3,
    Banknote
} from 'lucide-react';
import { Customer, Contract, Payment } from '../types';
import { CustomerService, ContractService, PaymentService } from '../services';
import CustomerForm from './CustomerForm';
import CustomerContactsTab from './CustomerContactsTab';
import { usePermissionCheck } from '../hooks/usePermissions';

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
    const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'contracts' | 'payments' | 'notes'>('overview');

    // Contracts tab filter
    const [contractFilter, setContractFilter] = useState<string>('all');

    // Notes tab - editable
    const [editingNotes, setEditingNotes] = useState(false);
    const [notesValue, setNotesValue] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);

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

    useEffect(() => {
        fetchData();
    }, [customerId]);

    // Calculate stats
    const stats = useMemo(() => {
        if (!contracts.length) return {
            contractCount: 0, totalValue: 0, totalRevenue: 0, activeContracts: 0, completedContracts: 0, avgContractValue: 0
        };
        const totalValue = contracts.reduce((sum, c) => sum + (c.value || 0), 0);
        const totalRevenue = contracts.reduce((sum, c) => sum + (c.actualRevenue || 0), 0);
        const activeContracts = contracts.filter(c => c.status === 'Processing').length;
        const completedContracts = contracts.filter(c => c.status === 'Completed').length;
        const avgContractValue = contracts.length > 0 ? totalValue / contracts.length : 0;

        return {
            contractCount: contracts.length,
            totalValue,
            totalRevenue,
            activeContracts,
            completedContracts,
            avgContractValue
        };
    }, [contracts]);

    // Payment stats
    const paymentStats = useMemo(() => {
        const totalAmount = payments.reduce((s, p) => s + (p.amount || 0), 0);
        const paidAmount = payments.filter(p => p.status === 'Tiền về').reduce((s, p) => s + (p.amount || 0), 0);
        const pendingAmount = totalAmount - paidAmount;
        return { totalAmount, paidAmount, pendingAmount, count: payments.length };
    }, [payments]);

    // Filtered contracts
    const filteredContracts = useMemo(() => {
        if (contractFilter === 'all') return contracts;
        return contracts.filter(c => c.status === contractFilter);
    }, [contracts, contractFilter]);

    // Contract status counts
    const contractStatusCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        contracts.forEach(c => { counts[c.status] = (counts[c.status] || 0) + 1; });
        return counts;
    }, [contracts]);

    const formatCurrency = (val: number) => {
        if (val >= 1e9) return `${(val / 1e9).toFixed(2)} tỷ`;
        if (val >= 1e6) return `${(val / 1e6).toFixed(0)} triệu`;
        return val.toLocaleString('vi-VN') + ' đ';
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

    const handleDelete = async () => {
        if (confirm('Bạn có chắc chắn muốn xóa khách hàng này? Hành động này không thể hoàn tác.')) {
            try {
                await CustomerService.delete(customerId);
                toast.success("Đã xóa khách hàng thành công");
                onBack();
            } catch (error) {
                console.error("Error deleting customer", error);
                toast.error("Có lỗi xảy ra khi xóa khách hàng");
            }
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    // Not found state
    if (!customer) {
        return (
            <div className="text-center py-16">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Building2 size={32} className="text-slate-400" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-lg">Không tìm thấy khách hàng</p>
                <button
                    onClick={onBack}
                    className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                >
                    Quay lại
                </button>
            </div>
        );
    }

    // Revenue collection rate
    const revenueRate = stats.totalValue > 0 ? Math.min((stats.totalRevenue / stats.totalValue) * 100, 100) : 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-8">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">
                            Chi tiết Khách hàng
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                            CRM — Quản lý quan hệ khách hàng
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                        <Edit3 size={16} />
                        Chỉnh sửa
                    </button>
                    {allowDelete && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/30 rounded-lg text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                        >
                            <Trash2 size={16} />
                            Xóa
                        </button>
                    )}
                </div>
            </div>

            {/* Profile Card */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Header gradient */}
                <div className="h-28 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 relative">
                    {customer.rating && customer.rating !== 'Standard' && (
                        <div className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white">
                            <Star size={16} />
                            <span className="font-bold text-sm">{customer.rating}</span>
                        </div>
                    )}
                </div>

                {/* Profile content */}
                <div className="px-6 py-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Logo/Avatar */}
                        <div className="w-20 h-20 -mt-14 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-black text-xl shadow-xl border-4 border-white dark:border-slate-900 flex-shrink-0 relative z-10">
                            {(customer.shortName || customer.name || '?').substring(0, 3)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                                        {customer.name}
                                    </h2>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                        {customer.shortName}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {(Array.isArray(customer.industry) ? customer.industry : [customer.industry]).filter(Boolean).map((ind: string) => (
                                        <span key={ind} className={`px-3 py-1 rounded-lg text-xs font-bold ${getIndustryColor(ind)}`}>
                                            {ind}
                                        </span>
                                    ))}
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                        <FileText size={12} />
                                        {contracts.length} hợp đồng
                                    </span>
                                    {customer.rating && (
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold ${getRatingColor(customer.rating)}`}>
                                            <Star size={12} />
                                            {customer.rating}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Contact & Info Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                                {customer.taxCode && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                            <Hash size={14} className="text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">MST</p>
                                            <p className="font-medium text-slate-700 dark:text-slate-300">{customer.taxCode}</p>
                                        </div>
                                    </div>
                                )}
                                {customer.contactPerson && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                            <User size={14} className="text-purple-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Liên hệ</p>
                                            <p className="font-medium text-slate-700 dark:text-slate-300">{customer.contactPerson}</p>
                                        </div>
                                    </div>
                                )}
                                {customer.email && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                            <Mail size={14} className="text-blue-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Email</p>
                                            <p className="font-medium text-slate-700 dark:text-slate-300 truncate">{customer.email}</p>
                                        </div>
                                    </div>
                                )}
                                {customer.phone && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                            <Phone size={14} className="text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">SĐT</p>
                                            <p className="font-medium text-slate-700 dark:text-slate-300">{customer.phone}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Address & Website */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                                {customer.address && (
                                    <div className="flex items-start gap-2 text-sm">
                                        <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg mt-0.5">
                                            <MapPin size={14} className="text-amber-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Địa chỉ</p>
                                            <p className="font-medium text-slate-700 dark:text-slate-300">{customer.address}</p>
                                        </div>
                                    </div>
                                )}
                                {customer.website && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                            <Globe size={14} className="text-indigo-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Website</p>
                                            <a href={`https://${customer.website}`} target="_blank" rel="noopener noreferrer"
                                                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                                                {customer.website}
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards — Enhanced */}
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

            {/* Tab Navigation — 5 tabs */}
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
                    {/* ================================ */}
                    {/* TAB 1: OVERVIEW                 */}
                    {/* ================================ */}
                    {activeTab === 'overview' && (
                        <div className="space-y-5">
                            {/* Quick Actions */}
                            <div className="flex flex-wrap gap-2">
                                {customer.phone && (
                                    <a href={`tel:${customer.phone}`} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
                                        <Phone size={14} />Gọi điện
                                    </a>
                                )}
                                {customer.email && (
                                    <a href={`mailto:${customer.email}`} className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                                        <Mail size={14} />Gửi email
                                    </a>
                                )}
                                <button onClick={() => setActiveTab('contacts')} className="flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg text-sm font-bold hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
                                    <Users size={14} />Danh bạ
                                </button>
                                <button onClick={() => setActiveTab('contracts')} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                                    <Plus size={14} />Xem HĐ
                                </button>
                            </div>

                            {/* Revenue Progress */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                                        <BarChart3 size={13} />Tỷ lệ thu hồi doanh thu
                                    </h3>
                                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{revenueRate.toFixed(0)}%</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                                    <div
                                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-700"
                                        style={{ width: `${revenueRate}%` }}
                                    />
                                </div>
                                <div className="flex justify-between mt-2 text-[11px] text-slate-500">
                                    <span>Doanh thu: {formatCurrency(stats.totalRevenue)}</span>
                                    <span>Giá trị HĐ: {formatCurrency(stats.totalValue)}</span>
                                </div>
                            </div>

                            {/* CRM Info */}
                            {(customer.source || customer.paymentTerms || (customer.creditLimit && customer.creditLimit > 0)) && (
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                        <Target size={13} />CRM
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {customer.source && (
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Nguồn KH</p>
                                                <p className="font-medium text-sm text-slate-700 dark:text-slate-300 mt-0.5">{customer.source}</p>
                                            </div>
                                        )}
                                        {customer.paymentTerms && (
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Điều khoản TT</p>
                                                <p className="font-medium text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                                                    <CreditCard size={12} className="inline mr-1 text-slate-400" />
                                                    {customer.paymentTerms}
                                                </p>
                                            </div>
                                        )}
                                        {customer.creditLimit !== undefined && customer.creditLimit > 0 && (
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Hạn mức TD</p>
                                                <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(customer.creditLimit)}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Customer Health Indicators */}
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <TrendingUp size={13} />Chỉ số khách hàng
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase">Giá trị TB/HĐ</p>
                                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">{formatCurrency(stats.avgContractValue)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase">HĐ hoàn thành</p>
                                        <p className="font-bold text-sm text-blue-600 dark:text-blue-400 mt-0.5">{stats.completedContracts}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase">Công nợ</p>
                                        <p className={`font-bold text-sm mt-0.5 ${paymentStats.pendingAmount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                            {paymentStats.pendingAmount > 0 ? formatCurrency(paymentStats.pendingAmount) : 'Không có'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 uppercase">Thanh toán</p>
                                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5">{paymentStats.count} lần</p>
                                    </div>
                                </div>
                            </div>

                            {/* Notes Preview */}
                            {customer.notes && (
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                                            <StickyNote size={13} />Ghi chú
                                        </h3>
                                        <button onClick={() => setActiveTab('notes')} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                                            Chỉnh sửa →
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">{customer.notes}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ================================ */}
                    {/* TAB 2: CONTACTS                 */}
                    {/* ================================ */}
                    {activeTab === 'contacts' && (
                        <CustomerContactsTab customerId={customerId} />
                    )}

                    {/* ================================ */}
                    {/* TAB 3: CONTRACTS (Enhanced)     */}
                    {/* ================================ */}
                    {activeTab === 'contracts' && (
                        <div className="space-y-4">
                            {/* Contract Mini Stats */}
                            <div className="flex flex-wrap gap-3">
                                {[
                                    { label: 'Tất cả', key: 'all', count: contracts.length, color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
                                    { label: 'Đang TH', key: 'Processing', count: contractStatusCounts['Processing'] || 0, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
                                    { label: 'Hoàn thành', key: 'Completed', count: contractStatusCounts['Completed'] || 0, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                                    { label: 'Chờ duyệt', key: 'Pending', count: contractStatusCounts['Pending'] || 0, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
                                ].filter(f => f.key === 'all' || f.count > 0).map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setContractFilter(f.key)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${contractFilter === f.key
                                            ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 ' + f.color
                                            : f.color + ' opacity-70 hover:opacity-100'
                                            }`}
                                    >
                                        {f.label} ({f.count})
                                    </button>
                                ))}
                            </div>

                            {/* Contracts Table */}
                            {filteredContracts.length > 0 ? (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                                                <th className="text-left py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mã HĐ</th>
                                                <th className="text-left py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Đơn vị</th>
                                                <th className="text-left py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Ngày ký</th>
                                                <th className="text-right py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Giá trị</th>
                                                <th className="text-right py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">Doanh thu</th>
                                                <th className="text-center py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trạng thái</th>
                                                <th className="py-3 px-5 w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredContracts.map((contract) => (
                                                <tr
                                                    key={contract.id}
                                                    className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group cursor-pointer"
                                                    onClick={() => onViewContract(contract.id)}
                                                >
                                                    <td className="py-3.5 px-5">
                                                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{contract.id}</p>
                                                    </td>
                                                    <td className="py-3.5 px-5 hidden md:table-cell">
                                                        <p className="text-sm text-slate-600 dark:text-slate-400">{contract.unitId.toUpperCase()}</p>
                                                    </td>
                                                    <td className="py-3.5 px-5 hidden lg:table-cell">
                                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                                            {new Date(contract.signedDate).toLocaleDateString('vi-VN')}
                                                        </p>
                                                    </td>
                                                    <td className="py-3.5 px-5 text-right">
                                                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{formatCurrency(contract.value)}</p>
                                                    </td>
                                                    <td className="py-3.5 px-5 text-right hidden sm:table-cell">
                                                        <p className="font-medium text-slate-700 dark:text-slate-300 text-sm">{formatCurrency(contract.actualRevenue)}</p>
                                                    </td>
                                                    <td className="py-3.5 px-5 text-center">
                                                        <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${getStatusColor(contract.status)}`}>
                                                            {contract.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-5">
                                                        <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                                            <ChevronRight size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <FileText size={24} className="text-slate-400" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
                                        {contractFilter === 'all' ? 'Chưa có hợp đồng' : `Không có HĐ ${contractFilter}`}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        {contractFilter === 'all' ? 'Khách hàng này chưa có hợp đồng nào' : 'Thử chọn bộ lọc khác'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ================================ */}
                    {/* TAB 4: PAYMENTS                 */}
                    {/* ================================ */}
                    {activeTab === 'payments' && (
                        <div className="space-y-4">
                            {/* Payment Summary */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                                    <p className="text-lg font-black text-slate-900 dark:text-slate-100">{formatCurrency(paymentStats.totalAmount)}</p>
                                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">Tổng phải thu</p>
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(paymentStats.paidAmount)}</p>
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Đã thu</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                                    <p className="text-lg font-black text-amber-600 dark:text-amber-400">{formatCurrency(paymentStats.pendingAmount)}</p>
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">Công nợ</p>
                                </div>
                            </div>

                            {/* Payments List */}
                            {payments.length > 0 ? (
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                                                <th className="text-left py-3 px-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">Ngày</th>
                                                <th className="text-left py-3 px-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase hidden md:table-cell">Mã HĐ</th>
                                                <th className="text-left py-3 px-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase hidden lg:table-cell">Số HĐ/CT</th>
                                                <th className="text-right py-3 px-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">Số tiền</th>
                                                <th className="text-center py-3 px-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">PT thanh toán</th>
                                                <th className="text-center py-3 px-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()).map(payment => (
                                                <tr key={payment.id} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar size={13} className="text-slate-400" />
                                                            <span className="text-sm text-slate-700 dark:text-slate-300">
                                                                {new Date(payment.paymentDate).toLocaleDateString('vi-VN')}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 hidden md:table-cell">
                                                        <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline"
                                                            onClick={() => onViewContract(payment.contractId)}
                                                        >
                                                            {payment.contractId}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 hidden lg:table-cell">
                                                        <span className="text-sm text-slate-600 dark:text-slate-400">{payment.invoiceNumber || payment.reference || '—'}</span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{formatCurrency(payment.amount)}</span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center hidden sm:table-cell">
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                            {payment.method}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${payment.status === 'Tiền về'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                            }`}>
                                                            {payment.status === 'Tiền về' ? <CheckCircle size={10} /> : <Clock size={10} />}
                                                            {payment.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Banknote size={24} className="text-slate-400" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Chưa có thanh toán</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Chưa có lần thanh toán nào được ghi nhận</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ================================ */}
                    {/* TAB 5: NOTES                    */}
                    {/* ================================ */}
                    {activeTab === 'notes' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    <StickyNote size={18} className="text-indigo-500" />
                                    Ghi chú khách hàng
                                </h3>
                                {!editingNotes ? (
                                    <button
                                        onClick={() => { setEditingNotes(true); setNotesValue(customer.notes || ''); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        <Edit3 size={14} />
                                        {customer.notes ? 'Sửa' : 'Thêm ghi chú'}
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                            Hủy
                                        </button>
                                        <button onClick={handleSaveNotes} disabled={savingNotes} className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                                            {savingNotes ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                            Lưu
                                        </button>
                                    </div>
                                )}
                            </div>

                            {editingNotes ? (
                                <textarea
                                    value={notesValue}
                                    onChange={(e) => setNotesValue(e.target.value)}
                                    placeholder="Nhập ghi chú về khách hàng... (thông tin quan trọng, lưu ý khi làm việc, yêu cầu đặc biệt...)"
                                    className="w-full min-h-[200px] px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                                    autoFocus
                                />
                            ) : customer.notes ? (
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-5">
                                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{customer.notes}</p>
                                </div>
                            ) : (
                                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <StickyNote size={24} className="text-slate-400" />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Chưa có ghi chú</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Thêm ghi chú để lưu thông tin quan trọng</p>
                                    <button
                                        onClick={() => { setEditingNotes(true); setNotesValue(''); }}
                                        className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        <Edit3 size={14} className="inline mr-1.5" />Thêm ghi chú
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            <CustomerForm
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
                onSave={handleSave}
                customer={customer}
            />
        </div>
    );
};

export default CustomerDetail;
