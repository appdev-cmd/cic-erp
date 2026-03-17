
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Building,
    Target,
    TrendingUp,
    Users,
    FileText,
    Pencil,
    Loader2,
    ChevronRight,
    BarChart3,
    Calendar,
    DollarSign,
    Clock,
    Award,
    Briefcase,
    Activity
} from 'lucide-react';
import { UnitService, EmployeeService, ContractService } from '../services';
import { Unit, KPIPlan, Employee, Contract } from '../types';
import UnitForm from './UnitForm';
import UnitSigningTab from './UnitSigningTab';

import { formatDate } from '../utils/formatters';

interface UnitDetailProps {
    unitId: string;
    onBack: () => void;
    onViewContract: (id: string) => void;
    onViewPersonnel: (id: string) => void;
    yearFilter?: string;
}

type TabType = 'overview' | 'signing' | 'employees' | 'contracts' | 'history';

const UnitDetail: React.FC<UnitDetailProps> = ({ unitId, onBack, onViewContract, onViewPersonnel, yearFilter = String(new Date().getFullYear()) }) => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [unit, setUnit] = useState<Unit | null>(null);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [staff, setStaff] = useState<Employee[]>([]);
    const [stats, setStats] = useState<{
        actualSigning: number;
        actualRevenue: number;
        adminProfit: number;
        signingProgress: number;
        revenueProgress: number;
        adminProfitProgress: number;
        contractCount: number;
        cashReceived: number;
    } | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const unitData = await UnitService.getById(unitId);
            setUnit(unitData || null);

            if (unitData) {
                const yearParam = yearFilter === 'All' ? null : parseInt(yearFilter);
                const results = await Promise.allSettled([
                    UnitService.getStats(unitId, yearParam),
                    ContractService.list({ unitId: unitId, year: yearParam === null ? undefined : yearParam.toString(), limit: 50, page: 1 }),
                    EmployeeService.getWithStats(unitId, undefined, yearParam),
                ]);

                const statsData = results[0].status === 'fulfilled' ? results[0].value : { totalSigning: 0, totalRevenue: 0, totalProfit: 0, totalCash: 0 };
                const contractsData = results[1].status === 'fulfilled' ? results[1].value : { data: [], count: 0 };
                const staffData = results[2].status === 'fulfilled' ? results[2].value : [];

                const calculatedStats = {
                    actualSigning: statsData.totalSigning || 0,
                    actualRevenue: statsData.totalRevenue || 0,
                    adminProfit: statsData.totalProfit || 0,
                    cashReceived: statsData.totalCash || 0,
                    contractCount: contractsData.count || contractsData.data?.length || 0,
                    signingProgress: unitData.target.signing ? (statsData.totalSigning / unitData.target.signing) * 100 : 0,
                    revenueProgress: unitData.target.revenue ? (statsData.totalRevenue / unitData.target.revenue) * 100 : 0,
                    adminProfitProgress: unitData.target.adminProfit ? ((statsData.totalProfit || 0) / unitData.target.adminProfit) * 100 : 0
                };

                setStats(calculatedStats);
                setContracts(contractsData.data || []);
                const people = Array.isArray(staffData) ? staffData : (staffData as any).data || [];
                setStaff(people as Employee[]);
            }
        } catch (error) {
            console.error('Error fetching unit details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [unitId]);

    const handleEditSave = async (data: Omit<Unit, 'id'> | Unit) => {
        try {
            if (unit) {
                await UnitService.update(unit.id, data);
            }
            setIsEditing(false);
            fetchData();
            toast.success("Cập nhật đơn vị thành công");
        } catch (error) {
            console.error('Error updating unit:', error);
            toast.error('Có lỗi xảy ra khi cập nhật đơn vị.');
        }
    };

    const formatCurrency = (val: number) => {
        return (val || 0).toLocaleString('vi-VN') + ' ₫';
    };

    // Status mapping to Vietnamese
    const statusViMap: Record<string, string> = {
        'Draft': 'Nháp',
        'Pending_Review': 'Chờ duyệt',
        'Both_Approved': 'Đã duyệt',
        'Pending_Sign': 'Chờ ký',
        'Processing': 'Đang thực hiện',
        'Suspended': 'Tạm dừng',
        'Acceptance': 'Nghiệm thu',
        'Liquidated': 'Thanh lý',
        'Completed': 'Hoàn thành',
    };
    const getStatusVi = (status: string) => statusViMap[status] || status;

    // Contract stats by status
    const contractStats = useMemo(() => {
        const statusCount: Record<string, number> = {};
        contracts.forEach(c => {
            const label = getStatusVi(c.status);
            statusCount[label] = (statusCount[label] || 0) + 1;
        });
        return statusCount;
    }, [contracts]);

    // Employee stats by position
    const employeeStats = useMemo(() => {
        const positionCount: Record<string, number> = {};
        staff.forEach(e => {
            const pos = e.position || 'Khác';
            positionCount[pos] = (positionCount[pos] || 0) + 1;
        });
        return positionCount;
    }, [staff]);

    // Top performers (by contract value)
    const topPerformers = useMemo(() => {
        const employeeValues: Record<string, { name: string; value: number; count: number }> = {};
        contracts.forEach(c => {
            if (!employeeValues[c.salespersonId]) {
                const emp = staff.find(s => s.id === c.salespersonId);
                employeeValues[c.salespersonId] = { name: emp?.name || 'N/A', value: 0, count: 0 };
            }
            employeeValues[c.salespersonId].value += c.value || 0;
            employeeValues[c.salespersonId].count += 1;
        });
        return Object.entries(employeeValues)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [contracts, staff]);

    const tabs = [
        { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
        { id: 'employees', label: `Nhân sự (${staff.length})`, icon: Users },
        { id: 'signing', label: 'Chỉ tiêu KD', icon: Target },
        { id: 'contracts', label: `Hợp đồng (${contracts.length})`, icon: FileText },
        { id: 'history', label: 'Lịch sử', icon: Clock }
    ] as const;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Loader2 size={40} className="animate-spin text-indigo-500" />
            </div>
        );
    }

    if (!unit) {
        return (
            <div className="text-center py-12">
                <p>Không tìm thấy đơn vị.</p>
                <button onClick={onBack} className="text-indigo-600 font-bold mt-2">Quay lại</button>
            </div>
        );
    }

    const renderOverviewTab = () => (
        <div className="space-y-6">
            {/* KPI Cards */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Signing */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full"></div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                <FileText size={18} className="text-indigo-600" />
                            </div>
                            <span className={`text-sm font-black ${stats.signingProgress >= 100 ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-400'}`}>
                                {stats.signingProgress.toFixed(0)}%
                            </span>
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ký kết</p>
                        <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(stats.actualSigning)}</p>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-1000" style={{ width: `${Math.min(stats.signingProgress, 100)}%` }}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">Mục tiêu: {formatCurrency(unit.target.signing)}</p>
                    </div>

                    {/* Revenue */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full"></div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                <TrendingUp size={18} className="text-emerald-600" />
                            </div>
                            <span className={`text-sm font-black ${stats.revenueProgress >= 100 ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-400'}`}>
                                {stats.revenueProgress.toFixed(0)}%
                            </span>
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Doanh thu</p>
                        <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(stats.actualRevenue)}</p>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000" style={{ width: `${Math.min(stats.revenueProgress, 100)}%` }}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">Mục tiêu: {formatCurrency(unit.target.revenue)}</p>
                    </div>

                    {/* Profit */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full"></div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                <Target size={18} className="text-purple-600" />
                            </div>
                            <span className={`text-sm font-black ${stats.adminProfitProgress >= 100 ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-400'}`}>
                                {stats.adminProfitProgress.toFixed(0)}%
                            </span>
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">LNG Quản trị</p>
                        <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(stats.adminProfit)}</p>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-1000" style={{ width: `${Math.min(stats.adminProfitProgress, 100)}%` }}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">Mục tiêu: {formatCurrency(unit.target.adminProfit)}</p>
                    </div>

                    {/* Số hợp đồng */}
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full"></div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <Briefcase size={18} className="text-amber-600" />
                            </div>
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Số hợp đồng</p>
                        <p className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">{stats.contractCount}</p>
                        <div className="flex flex-wrap gap-1 mt-3">
                            {Object.entries(contractStats).slice(0, 3).map(([status, count]) => (
                                <span key={status} className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400">
                                    {status}: {count}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Functions */}
            {unit.functions && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                        <Target size={16} className="text-indigo-500" /> Chức năng - Nhiệm vụ
                    </h3>
                    <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 text-sm whitespace-pre-line">
                        {unit.functions}
                    </div>
                </div>
            )}

            {/* Top Performers & Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Performers */}
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Award size={16} className="text-amber-500" /> Top Performers
                    </h3>
                    <div className="space-y-3">
                        {topPerformers.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-4">Chưa có dữ liệu</p>
                        ) : (
                            topPerformers.map((p, idx) => (
                                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => onViewPersonnel(p.id)}>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : idx === 1 ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' : idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{p.name}</p>
                                        <p className="text-xs text-slate-500">{p.count} HĐ</p>
                                    </div>
                                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(p.value)}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Employee Stats */}
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Users size={16} className="text-indigo-500" /> Phân bổ Nhân sự
                    </h3>
                    <div className="space-y-2">
                        {Object.entries(employeeStats).slice(0, 5).map(([pos, count]) => (
                            <div key={pos} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                <span className="text-sm text-slate-600 dark:text-slate-400">{pos}</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{count}</span>
                            </div>
                        ))}
                        {Object.keys(employeeStats).length === 0 && (
                            <p className="text-slate-500 text-sm text-center py-4">Chưa có nhân sự</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Contracts */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <FileText size={16} className="text-emerald-500" /> Hợp đồng gần đây
                </h3>
                <div className="space-y-2">
                    {contracts.slice(0, 5).map(c => (
                        <div key={c.id} onClick={() => onViewContract(c.id)} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                            <div className="min-w-0 flex-1">
                                <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{c.partyA}</p>
                                <p className="text-xs text-slate-500">{formatCurrency(c.value)}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${c.status === 'Processing' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : c.status === 'Completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                                {getStatusVi(c.status)}
                            </span>
                        </div>
                    ))}
                    {contracts.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-4">Chưa có hợp đồng</p>
                    )}
                </div>
            </div>
        </div>
    );

    const renderEmployeesTab = () => (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Nhân viên</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Chức vụ</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Email</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Số ĐT</th>
                            <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {[...staff].sort((a, b) => {
                            const posOrder = (p: string | undefined) => {
                                if (!p) return 99;
                                if (p.includes('Giám đốc') && !p.includes('Phó')) return 0;
                                if (p.includes('Phó Giám đốc')) return 1;
                                if (p.includes('kinh doanh')) return 2;
                                if (p.includes('hồ sơ')) return 3;
                                if (p.includes('Kỹ thuật')) return 4;
                                return 50;
                            };
                            return posOrder(a.position) - posOrder(b.position);
                        }).map(e => {
                            return (
                                <tr key={e.id} onClick={() => onViewPersonnel(e.id)} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-500">
                                                {e.avatar ? <img src={e.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : e.name.charAt(0)}
                                            </div>
                                            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{e.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{e.position || '—'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{e.email || '—'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{e.phone || '—'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <ChevronRight size={16} className="text-slate-300" />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {staff.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        <Users size={40} className="mx-auto mb-3 opacity-50" />
                        <p>Chưa có nhân sự thuộc đơn vị này</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderContractsTab = () => (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Khách hàng</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Mã HĐ</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Nội dung</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Trạng thái</th>
                            <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase">Giá trị</th>
                            <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase">Doanh thu</th>
                            <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase">Ngày ký</th>
                            <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {contracts.map(c => (
                            <tr key={c.id} onClick={() => onViewContract(c.id)} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                                <td className="px-4 py-3">
                                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[200px]">{c.partyA}</p>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-sm text-indigo-600 dark:text-indigo-400 font-mono font-bold truncate max-w-[160px]">{c.contractCode || '—'}</p>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{c.content || '—'}</p>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${c.status === 'Processing' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : c.status === 'Completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : c.status === 'Suspended' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                                        {getStatusVi(c.status)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-bold text-slate-900 dark:text-slate-100">{formatCurrency(c.value)}</td>
                                <td className="px-4 py-3 text-sm text-right text-slate-600 dark:text-slate-400">{formatCurrency(c.actualRevenue)}</td>
                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{c.signedDate ? formatDate(c.signedDate) : '—'}</td>
                                <td className="px-4 py-3 text-right">
                                    <ChevronRight size={16} className="text-slate-300" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {contracts.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        <FileText size={40} className="mx-auto mb-3 opacity-50" />
                        <p>Chưa có hợp đồng nào</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderHistoryTab = () => (
        <div className="space-y-6">
            {/* Placeholder for monthly/quarterly charts */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Activity size={16} className="text-indigo-500" /> Lịch sử KPI theo tháng
                </h3>
                <div className="h-48 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                        <BarChart3 size={40} className="mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Biểu đồ KPI theo thời gian</p>
                        <p className="text-xs mt-1">(Tính năng đang phát triển)</p>
                    </div>
                </div>
            </div>

            {/* Year over Year comparison placeholder */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Calendar size={16} className="text-emerald-500" /> So sánh năm
                </h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Năm nay</p>
                        <p className="text-lg font-black text-slate-900 dark:text-slate-100">{formatCurrency(stats?.actualSigning || 0)}</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Năm trước</p>
                        <p className="text-lg font-black text-slate-900 dark:text-slate-100">{formatCurrency(unit.lastYearActual?.signing || 0)}</p>
                    </div>
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Tăng trưởng</p>
                        <p className="text-lg font-black text-emerald-600">
                            {unit.lastYearActual?.signing ? `${(((stats?.actualSigning || 0) / unit.lastYearActual.signing - 1) * 100).toFixed(0)}%` : 'N/A'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 truncate">{unit.name}</h1>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase">{unit.code}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${unit.type === 'Center' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : unit.type === 'Branch' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                            {unit.type === 'Center' ? 'Trung tâm' : unit.type === 'Branch' ? 'Chi nhánh' : 'Công ty'}
                        </span>
                        <span className="text-[10px] text-slate-400">{staff.length} nhân viên • {contracts.length} hợp đồng</span>
                    </div>
                </div>
                <button onClick={() => setIsEditing(true)} className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                    <Pencil size={18} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'signing' && (
                <UnitSigningTab
                    unit={unit}
                    staff={staff}
                    yearFilter={yearFilter}
                    onRefresh={fetchData}
                    onViewPersonnel={onViewPersonnel}
                />
            )}
            {activeTab === 'employees' && renderEmployeesTab()}
            {activeTab === 'contracts' && renderContractsTab()}
            {activeTab === 'history' && renderHistoryTab()}

            <UnitForm isOpen={isEditing} onClose={() => setIsEditing(false)} onSave={handleEditSave} unit={unit} />
        </div>
    );
};

export default UnitDetail;
