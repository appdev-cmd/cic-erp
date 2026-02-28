import React, { useMemo, useState, useEffect } from 'react';
import { CONTRACT_STATUS_LABELS, ROLE_LABELS } from '../constants';
import { toast } from 'sonner';

import {
    ArrowLeft,
    User,
    Building,
    Target,
    TrendingUp,
    FileText,
    Award,
    ChevronRight,
    Loader2,
    Mail,
    Phone,
    Briefcase,
    Calendar,
    Hash,
    Pencil
} from 'lucide-react';
import { EmployeeService, ContractService, UnitService } from '../services'; // Updated imports
import PersonnelForm from './PersonnelForm';
import { Employee, Contract, Unit, UserRole } from '../types';

interface PersonnelDetailProps {
    personnelId: string;
    onBack: () => void;
    onViewContract: (contractId: string) => void;
}

interface PersonnelStats {
    contractCount: number;
    totalSigning: number;
    totalRevenue: number;
    activeContracts: number;
    completedContracts: number;
    signingProgress: number;
    revenueProgress: number;
}

const PersonnelDetail: React.FC<PersonnelDetailProps> = ({ personnelId, onBack, onViewContract }) => {
    // State for data
    const [person, setPerson] = useState<Employee | null>(null);
    const [unit, setUnit] = useState<Unit | null>(null);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [stats, setStats] = useState<PersonnelStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    // Fetch data on mount
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [personData, statsData, contractsData] = await Promise.all([
                EmployeeService.getById(personnelId),
                EmployeeService.getStats(personnelId),
                ContractService.getByEmployeeId(personnelId),
            ]);

            if (personData) {
                setPerson(personData);
                const unitData = await UnitService.getById(personData.unitId);
                setUnit(unitData || null);
            }
            setStats(statsData);
            setContracts(contractsData);
        } catch (error) {
            console.error('Error fetching personnel data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [personnelId]);

    const handleEditSave = async (data: Omit<Employee, 'id'> | Employee) => {
        try {
            if (person) {
                await EmployeeService.update(person.id, data);
            }
            setIsEditing(false);
            fetchData(); // Reload data
            toast.success("Cập nhật thông tin nhân viên thành công");
        } catch (error) {
            console.error('Error updating personnel:', error);
            toast.error('Có lỗi xảy ra khi cập nhật thông tin.');
        }
    };

    const formatCurrency = (val: number) => {
        if (val >= 1e9) return `${(val / 1e9).toFixed(2)} tỷ`;
        if (val >= 1e6) return `${(val / 1e6).toFixed(0)} triệu`;
        return val.toLocaleString('vi-VN') + ' đ';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Processing': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'Completed': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Suspended': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'Acceptance': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
            case 'Liquidated': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
            case 'Active': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'Expired': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const getProgressColor = (progress: number) => {
        if (progress >= 100) return 'bg-emerald-500';
        if (progress >= 70) return 'bg-indigo-500';
        if (progress >= 40) return 'bg-amber-500';
        return 'bg-rose-500';
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                    <Loader2 size={40} className="animate-spin text-indigo-500 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    // Not found state
    if (!person) {
        return (
            <div className="text-center py-16">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User size={32} className="text-slate-400" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-lg">Không tìm thấy nhân viên</p>
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
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                </button>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">
                        Chi tiết Nhân viên
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                        Thông tin và hợp đồng phụ trách
                    </p>
                </div>
            </div>

            {/* Profile Card - Fixed layout */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Header gradient */}
                <div className="h-20 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 relative">
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        {stats && stats.signingProgress >= 100 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white">
                                <Award size={14} />
                                <span className="font-bold text-xs">Đạt KPI</span>
                            </div>
                        )}
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-2 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-colors"
                            title="Chỉnh sửa thông tin"
                        >
                            <Pencil size={18} />
                        </button>
                    </div>
                </div>

                {/* Profile content */}
                <div className="px-6 py-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Avatar - positioned to overlap header */}
                        <div className="relative z-10 w-20 h-20 -mt-14 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-xl border-4 border-white dark:border-slate-900 flex-shrink-0 overflow-hidden">
                            {person.avatar ? (
                                <img src={person.avatar} alt={person.name} className="w-full h-full object-cover" />
                            ) : (
                                person.name.split(' ').pop()?.charAt(0) || '?'
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                                        {person.name}
                                    </h2>
                                    {person.position && (
                                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">
                                            {ROLE_LABELS[person.position as UserRole] || person.position}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400">
                                        <Building size={12} />
                                        {unit?.name || 'N/A'}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                        <FileText size={12} />
                                        {contracts.length} hợp đồng
                                    </span>
                                </div>
                            </div>

                            {/* Contact & Info Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                                {person.employeeCode && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                            <Hash size={14} className="text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Mã NV</p>
                                            <p className="font-medium text-slate-700 dark:text-slate-300">{person.employeeCode}</p>
                                        </div>
                                    </div>
                                )}
                                {person.email && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                            <Mail size={14} className="text-blue-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Email</p>
                                            <p className="font-medium text-slate-700 dark:text-slate-300 truncate">{person.email}</p>
                                        </div>
                                    </div>
                                )}
                                {person.phone && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                            <Phone size={14} className="text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">SĐT</p>
                                            <p className="font-medium text-slate-700 dark:text-slate-300">{person.phone}</p>
                                        </div>
                                    </div>
                                )}
                                {person.dateJoined && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                            <Calendar size={14} className="text-amber-500" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Ngày vào</p>
                                            <p className="font-medium text-slate-700 dark:text-slate-300">
                                                {new Date(person.dateJoined).toLocaleDateString('vi-VN')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Stats - 2 column grid */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Signing KPI */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                                    <Target size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">KPI Giá trị ký</p>
                                    <p className="text-xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(stats.totalSigning)}</p>
                                </div>
                            </div>
                            <div className={`text-xl font-black ${stats.signingProgress >= 100 ? 'text-emerald-600' : stats.signingProgress >= 70 ? 'text-indigo-600' : 'text-amber-600'}`}>
                                {stats.signingProgress.toFixed(0)}%
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                <span>Thực hiện</span>
                                <span>Mục tiêu: {formatCurrency(person.target.signing)}</span>
                            </div>
                            <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${getProgressColor(stats.signingProgress)}`}
                                    style={{ width: `${Math.min(stats.signingProgress, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Revenue KPI */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">KPI Doanh thu</p>
                                    <p className="text-xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(stats.totalRevenue)}</p>
                                </div>
                            </div>
                            <div className={`text-xl font-black ${stats.revenueProgress >= 100 ? 'text-emerald-600' : stats.revenueProgress >= 70 ? 'text-indigo-600' : 'text-amber-600'}`}>
                                {stats.revenueProgress.toFixed(0)}%
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                <span>Thực hiện</span>
                                <span>Mục tiêu: {formatCurrency(person.target.revenue)}</span>
                            </div>
                            <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${getProgressColor(stats.revenueProgress)}`}
                                    style={{ width: `${Math.min(stats.revenueProgress, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Stats */}
            {stats && (
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
                        <p className="text-2xl font-black text-blue-600">{stats.completedContracts}</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Hoàn thành</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-2xl font-black text-purple-600">{formatCurrency(person.target.adminProfit)}</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">KPI Lợi nhuận</p>
                    </div>
                </div>
            )}

            {/* Contracts Table */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <FileText size={18} className="text-indigo-500" />
                        Hợp đồng phụ trách
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
                                    <th className="text-left py-3 px-5 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Khách hàng</th>
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
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 md:hidden mt-0.5">{contract.clientInitials}</p>
                                        </td>
                                        <td className="py-3.5 px-5 hidden md:table-cell">
                                            <p className="font-medium text-slate-700 dark:text-slate-300 text-sm truncate max-w-[200px]">{contract.partyA}</p>
                                        </td>
                                        <td className="py-3.5 px-5 text-right">
                                            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{formatCurrency(contract.value)}</p>
                                        </td>
                                        <td className="py-3.5 px-5 text-right hidden sm:table-cell">
                                            <p className="font-medium text-slate-700 dark:text-slate-300 text-sm">{formatCurrency(contract.actualRevenue)}</p>
                                        </td>
                                        <td className="py-3.5 px-5 text-center">
                                            <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${getStatusColor(contract.status)}`}>
                                                {CONTRACT_STATUS_LABELS[contract.status] || contract.status}
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
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Nhân viên này chưa phụ trách hợp đồng nào</p>
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
            {/* Edit Modal */}
            <PersonnelForm
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
                onSave={handleEditSave}
                person={person}
            />
        </div>
    );
};

export default PersonnelDetail;
