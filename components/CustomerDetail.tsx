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
    Loader2
} from 'lucide-react';
import { Customer, Contract } from '../types';
import { CustomerService, ContractService } from '../services';
import CustomerForm from './CustomerForm';
import { useAuth } from '../contexts/AuthContext';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { canDeleteCustomer } from '../lib/permissions';

interface CustomerDetailProps {
    customerId: string;
    onBack: () => void;
    onViewContract: (contractId: string) => void;
}

const CustomerDetail: React.FC<CustomerDetailProps> = ({ customerId, onBack, onViewContract }) => {
    const { profile: realProfile } = useAuth();
    const { impersonatedUser, isImpersonating } = useImpersonation();
    const profile = isImpersonating && impersonatedUser ? impersonatedUser : realProfile;
    const allowDelete = profile ? canDeleteCustomer(profile.role) : false;

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [custData, contData] = await Promise.all([
                CustomerService.getById(customerId),
                ContractService.getByCustomerId(customerId)
            ]);
            setCustomer(custData || null);
            setContracts(contData || []);
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
        const activeContracts = contracts.filter(c => c.status === 'Active').length;
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

    const formatCurrency = (val: number) => {
        if (val >= 1e9) return `${(val / 1e9).toFixed(2)} tỷ`;
        if (val >= 1e6) return `${(val / 1e6).toFixed(0)} triệu`;
        return val.toLocaleString('vi-VN') + ' đ';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'Completed': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'Expired': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
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
                            Thông tin và lịch sử hợp đồng
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
                    {stats.contractCount >= 10 && (
                        <div className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white">
                            <TrendingUp size={16} />
                            <span className="font-bold text-sm">VIP</span>
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
                                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${getIndustryColor(customer.industry)}`}>
                                        {customer.industry}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                        <FileText size={12} />
                                        {contracts.length} hợp đồng
                                    </span>
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

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{stats.contractCount}</p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Tổng HĐ</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-2xl font-black text-emerald-600">{stats.activeContracts}</p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Đang thực hiện</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-2xl font-black text-indigo-600">{formatCurrency(stats.totalValue)}</p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Tổng giá trị</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-2xl font-black text-purple-600">{formatCurrency(stats.totalRevenue)}</p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Doanh thu</p>
                </div>
            </div>

            {/* Contracts Table */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <FileText size={18} className="text-indigo-500" />
                        Lịch sử Hợp đồng
                    </h3>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                        {contracts.length} hợp đồng
                    </span>
                </div>

                {contracts.length > 0 ? (
                    <div className="overflow-x-auto">
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
                                {contracts.slice(0, 15).map((contract) => (
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
                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Chưa có hợp đồng</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Khách hàng này chưa có hợp đồng nào</p>
                    </div>
                )}

                {contracts.length > 15 && (
                    <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Hiển thị 15 / {contracts.length} hợp đồng
                        </p>
                    </div>
                )}
            </div>

            {/* Notes Section */}
            {customer.notes && (
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">Ghi chú</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{customer.notes}</p>
                </div>
            )}

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
