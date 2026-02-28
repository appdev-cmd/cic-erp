
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
    FileText,
    TrendingUp,
    Target,
    Save,
    Loader2,
    Pencil,
    X,
    Check,
    ChevronRight,
    ArrowUpRight,
    ArrowDownRight,
    Minus as MinusIcon,
    Wallet,
    Users
} from 'lucide-react';
import { Employee, KPIPlan, Unit } from '../types';
import { EmployeeService } from '../services';
import NumberInput from './ui/NumberInput';

interface UnitSigningTabProps {
    unit: Unit;
    staff: Employee[];
    onRefresh: () => void;
    onViewPersonnel: (id: string) => void;
}

interface EmployeeWithStats extends Employee {
    stats?: {
        totalSigning?: number;
        totalRevenue?: number;
        totalProfit?: number;
        totalCash?: number;
    };
}

const UnitSigningTab: React.FC<UnitSigningTabProps> = ({ unit, staff, onRefresh, onViewPersonnel }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTarget, setEditTarget] = useState<KPIPlan>({ signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 });
    const [isSaving, setIsSaving] = useState(false);

    // Only show sales employees — filter by position (roleCode is unreliable, many staff default to NVKD)
    const employees = useMemo(() => {
        return (staff as EmployeeWithStats[]).filter(emp => {
            const pos = (emp.position || '').toLowerCase();
            return pos.includes('kinh doanh');
        });
    }, [staff]);

    // Summary totals
    const totals = useMemo(() => {
        let targetSigning = 0, targetRevenue = 0, targetProfit = 0;
        let actualSigning = 0, actualRevenue = 0, actualProfit = 0;

        employees.forEach(emp => {
            targetSigning += emp.target?.signing || 0;
            targetRevenue += emp.target?.revenue || 0;
            targetProfit += emp.target?.adminProfit || 0;

            actualSigning += emp.stats?.totalSigning || 0;
            actualRevenue += emp.stats?.totalRevenue || 0;
            actualProfit += emp.stats?.totalProfit || 0;
        });

        return {
            target: { signing: targetSigning, revenue: targetRevenue, profit: targetProfit },
            actual: { signing: actualSigning, revenue: actualRevenue, profit: actualProfit }
        };
    }, [employees]);

    // Unit target vs employee target allocation comparison
    const allocationRate = useMemo(() => {
        const unitTarget = unit.target?.signing || 0;
        if (unitTarget === 0) return 0;
        return (totals.target.signing / unitTarget) * 100;
    }, [unit.target, totals.target.signing]);

    const formatCurrency = (val: number) => {
        if (val >= 1e9) return `${(val / 1e9).toFixed(2)} tỷ`;
        if (val >= 1e6) return `${(val / 1e6).toFixed(0)} tr`;
        if (val === 0) return '0';
        return val.toLocaleString('vi-VN');
    };

    const handleStartEdit = (emp: EmployeeWithStats) => {
        setEditingId(emp.id);
        setEditTarget({ ...(emp.target || { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 }) });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
    };

    const handleSaveTarget = async (empId: string) => {
        setIsSaving(true);
        try {
            await EmployeeService.update(empId, { target: editTarget });
            toast.success('Cập nhật chỉ tiêu thành công');
            setEditingId(null);
            onRefresh();
        } catch (error) {
            console.error('Error updating employee target:', error);
            toast.error('Có lỗi khi cập nhật chỉ tiêu');
        } finally {
            setIsSaving(false);
        }
    };

    const getProgressColor = (pct: number) => {
        if (pct >= 100) return 'text-emerald-600';
        if (pct >= 70) return 'text-indigo-600';
        if (pct >= 40) return 'text-amber-600';
        return 'text-slate-500';
    };

    const getProgressBarColor = (pct: number) => {
        if (pct >= 100) return 'bg-emerald-500';
        if (pct >= 70) return 'bg-indigo-500';
        if (pct >= 40) return 'bg-amber-500';
        return 'bg-slate-400';
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards: Unit target vs Employee targets allocated */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Signing Summary */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full"></div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                            <FileText size={16} className="text-indigo-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chỉ tiêu Ký kết</span>
                    </div>
                    <p className="text-xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(totals.target.signing)}</p>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-500">ĐV: {formatCurrency(unit.target?.signing || 0)}</span>
                        <span className={`text-xs font-bold ${allocationRate > 100 ? 'text-amber-600' : allocationRate >= 80 ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {allocationRate.toFixed(0)}% phân bổ
                        </span>
                    </div>
                </div>

                {/* Revenue Summary */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full"></div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                            <TrendingUp size={16} className="text-emerald-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chỉ tiêu Doanh thu</span>
                    </div>
                    <p className="text-xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(totals.target.revenue)}</p>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-500">Thực tế: {formatCurrency(totals.actual.revenue)}</span>
                        <span className={`text-xs font-bold ${totals.target.revenue > 0 ? getProgressColor((totals.actual.revenue / totals.target.revenue) * 100) : 'text-slate-400'}`}>
                            {totals.target.revenue > 0 ? `${((totals.actual.revenue / totals.target.revenue) * 100).toFixed(0)}%` : '—'}
                        </span>
                    </div>
                </div>

                {/* Profit Summary */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full"></div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <Target size={16} className="text-purple-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chỉ tiêu LNG QT</span>
                    </div>
                    <p className="text-xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(totals.target.profit)}</p>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-500">Thực tế: {formatCurrency(totals.actual.profit)}</span>
                        <span className={`text-xs font-bold ${totals.target.profit > 0 ? getProgressColor((totals.actual.profit / totals.target.profit) * 100) : 'text-slate-400'}`}>
                            {totals.target.profit > 0 ? `${((totals.actual.profit / totals.target.profit) * 100).toFixed(0)}%` : '—'}
                        </span>
                    </div>
                </div>

                {/* Employee Count */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full"></div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                            <Users size={16} className="text-amber-600" />
                        </div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nhân viên</span>
                    </div>
                    <p className="text-xl font-black text-slate-900 dark:text-slate-100">{employees.length}</p>
                    <p className="text-[10px] text-slate-500 mt-2">
                        {employees.filter(e => (e.target?.signing || 0) > 0).length} NV có chỉ tiêu
                    </p>
                </div>
            </div>

            {/* Employee KPI Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <FileText size={16} className="text-indigo-500" />
                        Chỉ tiêu ký kết NVKD
                    </h3>
                    <span className="text-xs text-slate-400">
                        Click <Pencil size={12} className="inline" /> để chỉnh sửa chỉ tiêu
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-[200px]">Nhân viên</th>
                                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">CT Ký kết</th>
                                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Thực tế</th>
                                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-[80px]">%</th>
                                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">CT Doanh thu</th>
                                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">CT LNG QT</th>
                                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-[100px]"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-slate-400">
                                        <Users size={40} className="mx-auto mb-3 opacity-50" />
                                        <p>Chưa có nhân viên trong đơn vị</p>
                                    </td>
                                </tr>
                            ) : employees.map(emp => {
                                const isEditing = editingId === emp.id;
                                const signingTarget = emp.target?.signing || 0;
                                const actualSigning = emp.stats?.totalSigning || 0;
                                const signingPct = signingTarget > 0 ? (actualSigning / signingTarget) * 100 : 0;

                                return (
                                    <tr key={emp.id} className={`transition-colors ${isEditing ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                        {/* Employee Name */}
                                        <td className="px-4 py-3">
                                            <div
                                                className="flex items-center gap-3 cursor-pointer group/name"
                                                onClick={() => onViewPersonnel(emp.id)}
                                            >
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                    {emp.avatar ? <img src={emp.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : emp.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate group-hover/name:text-indigo-600 transition-colors">{emp.name}</p>
                                                    <p className="text-[11px] text-slate-500 truncate">{emp.position || 'Nhân viên'}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Target Signing */}
                                        <td className="px-4 py-3 text-right">
                                            {isEditing ? (
                                                <NumberInput
                                                    value={editTarget.signing}
                                                    onChange={(v) => setEditTarget(prev => ({ ...prev, signing: v }))}
                                                    className="w-32 ml-auto px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-right text-sm font-bold"
                                                />
                                            ) : (
                                                <span className={`text-sm font-bold ${signingTarget > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                                    {signingTarget > 0 ? formatCurrency(signingTarget) : '—'}
                                                </span>
                                            )}
                                        </td>

                                        {/* Actual Signing */}
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                                                {actualSigning > 0 ? formatCurrency(actualSigning) : '0'}
                                            </span>
                                        </td>

                                        {/* Progress % */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`text-xs font-black ${getProgressColor(signingPct)}`}>
                                                    {signingTarget > 0 ? `${signingPct.toFixed(0)}%` : '—'}
                                                </span>
                                                {signingTarget > 0 && (
                                                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-1 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(signingPct)}`}
                                                            style={{ width: `${Math.min(signingPct, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Target Revenue */}
                                        <td className="px-4 py-3 text-right">
                                            {isEditing ? (
                                                <NumberInput
                                                    value={editTarget.revenue}
                                                    onChange={(v) => setEditTarget(prev => ({ ...prev, revenue: v }))}
                                                    className="w-32 ml-auto px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-right text-sm font-bold"
                                                />
                                            ) : (
                                                <span className={`text-sm font-bold ${(emp.target?.revenue || 0) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {(emp.target?.revenue || 0) > 0 ? formatCurrency(emp.target.revenue) : '—'}
                                                </span>
                                            )}
                                        </td>

                                        {/* Target Admin Profit */}
                                        <td className="px-4 py-3 text-right">
                                            {isEditing ? (
                                                <NumberInput
                                                    value={editTarget.adminProfit}
                                                    onChange={(v) => setEditTarget(prev => ({ ...prev, adminProfit: v }))}
                                                    className="w-32 ml-auto px-3 py-1.5 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none text-right text-sm font-bold"
                                                />
                                            ) : (
                                                <span className={`text-sm font-bold ${(emp.target?.adminProfit || 0) > 0 ? 'text-purple-600' : 'text-slate-400'}`}>
                                                    {(emp.target?.adminProfit || 0) > 0 ? formatCurrency(emp.target.adminProfit) : '—'}
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                {isEditing ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleSaveTarget(emp.id)}
                                                            disabled={isSaving}
                                                            className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
                                                            title="Lưu"
                                                        >
                                                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                            title="Hủy"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleStartEdit(emp)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors cursor-pointer"
                                                        title="Chỉnh sửa chỉ tiêu"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {/* Totals Row */}
                            {employees.length > 0 && (
                                <tr className="bg-slate-50 dark:bg-slate-800/50 font-black">
                                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                        Tổng cộng ({employees.length} NV)
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-indigo-600 font-black">
                                        {formatCurrency(totals.target.signing)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-slate-900 dark:text-slate-100 font-black">
                                        {formatCurrency(totals.actual.signing)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`text-xs font-black ${getProgressColor(totals.target.signing > 0 ? (totals.actual.signing / totals.target.signing) * 100 : 0)}`}>
                                            {totals.target.signing > 0 ? `${((totals.actual.signing / totals.target.signing) * 100).toFixed(0)}%` : '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-emerald-600 font-black">
                                        {formatCurrency(totals.target.revenue)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-purple-600 font-black">
                                        {formatCurrency(totals.target.profit)}
                                    </td>
                                    <td className="px-4 py-3"></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Allocation Comparison Card */}
            {unit.target?.signing > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Target size={16} className="text-indigo-500" />
                        So sánh phân bổ chỉ tiêu
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                            <p className="text-xs text-slate-500 mb-1">Chỉ tiêu Đơn vị</p>
                            <p className="text-lg font-black text-slate-900 dark:text-slate-100">{formatCurrency(unit.target.signing)}</p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                            <p className="text-xs text-slate-500 mb-1">Tổng CT nhân viên</p>
                            <p className="text-lg font-black text-indigo-600">{formatCurrency(totals.target.signing)}</p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                            <p className="text-xs text-slate-500 mb-1">Chênh lệch</p>
                            {(() => {
                                const diff = totals.target.signing - (unit.target?.signing || 0);
                                return (
                                    <p className={`text-lg font-black flex items-center justify-center gap-1 ${diff > 0 ? 'text-amber-600' : diff < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {diff > 0 && <ArrowUpRight size={16} />}
                                        {diff < 0 && <ArrowDownRight size={16} />}
                                        {diff === 0 && <Check size={16} />}
                                        {diff === 0 ? 'Cân bằng' : formatCurrency(Math.abs(diff))}
                                    </p>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UnitSigningTab;
