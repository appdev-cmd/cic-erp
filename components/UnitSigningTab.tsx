
import React, { useState, useMemo, useRef, useEffect } from 'react';
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
    Users,
    UserPlus,
    Trash2,
    Lock,
    ChevronLeft,
    ChevronRight as ChevronRightIcon,
    AlertTriangle
} from 'lucide-react';
import { Employee, KPIPlan, Unit } from '../types';
import { UnitService } from '../services';
import { EmployeeTargetService, EmployeeTarget } from '../services/employeeTargetService';
import { UnitTargetService, UnitTarget } from '../services/unitTargetService';
import { usePermissionCheck } from '../hooks/usePermissions';
import NumberInput from './ui/NumberInput';

interface UnitSigningTabProps {
    unit: Unit;
    staff: Employee[];
    yearFilter: string;
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

const UnitSigningTab: React.FC<UnitSigningTabProps> = ({ unit, staff, yearFilter, onRefresh, onViewPersonnel }) => {
    const { can, role, unitId: userUnitId } = usePermissionCheck();

    // === Permission checks ===
    // Unit target: only Admin/Leadership can set
    const canEditUnitTarget = role === 'Admin' || role === 'Leadership';
    // Employee targets: Admin/Leadership OR UnitLeader/AdminUnit of same unit
    const canEditEmployeeTargets = canEditUnitTarget ||
        ((role === 'UnitLeader' || role === 'AdminUnit') && userUnitId === unit.id);

    // === State ===
    const currentYear = new Date().getFullYear();
    const defaultYear = parseInt(yearFilter) || currentYear;
    const [selectedYear, setSelectedYear] = useState(defaultYear);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTarget, setEditTarget] = useState<KPIPlan>({ signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 });
    const [isSaving, setIsSaving] = useState(false);
    const [showAddDropdown, setShowAddDropdown] = useState(false);
    const [yearTargets, setYearTargets] = useState<EmployeeTarget[]>([]);
    const addDropdownRef = useRef<HTMLDivElement>(null);

    // === Unit target state (per-year) ===
    const [unitTarget, setUnitTarget] = useState<UnitTarget | null>(null);
    const [isEditingUnitTarget, setIsEditingUnitTarget] = useState(false);
    const [editUnitTarget, setEditUnitTarget] = useState<KPIPlan>({ signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 });
    const [isSavingUnitTarget, setIsSavingUnitTarget] = useState(false);

    const year = selectedYear;

    // Year options for selector
    const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

    // Fetch year-specific unit target
    useEffect(() => {
        UnitTargetService.getByUnitAndYear(unit.id, year)
            .then(setUnitTarget)
            .catch(e => console.error('Failed to fetch unit target:', e));
    }, [unit.id, year]);

    // Fetch year-specific employee targets
    useEffect(() => {
        EmployeeTargetService.getByUnitAndYear(unit.id, year)
            .then(setYearTargets)
            .catch(e => console.error('Failed to fetch targets:', e));
    }, [unit.id, year, staff]);

    // Target lookup map: employeeId -> EmployeeTarget
    const targetMap = useMemo(() => {
        const map = new Map<string, EmployeeTarget>();
        yearTargets.forEach(t => map.set(t.employeeId, t));
        return map;
    }, [yearTargets]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) setShowAddDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Show employees in targetMembers list
    const employees = useMemo(() => {
        const memberIds = new Set(unit.targetMembers || []);
        return (staff as EmployeeWithStats[]).filter(emp => memberIds.has(emp.id));
    }, [staff, unit.targetMembers]);

    // Available to add = staff not already in the list
    const availableToAdd = useMemo(() => {
        const memberIds = new Set(unit.targetMembers || []);
        return staff.filter(e => !memberIds.has(e.id));
    }, [staff, unit.targetMembers]);

    // Helper to get KPIPlan for an employee from year targets
    const getTarget = (empId: string): KPIPlan => {
        const t = targetMap.get(empId);
        if (!t) return { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 };
        return { signing: t.signing, revenue: t.revenue, adminProfit: t.adminProfit, revProfit: t.revProfit, cash: t.cash };
    };

    // Current unit KPI plan (from per-year data, fallback to legacy unit.target only for default year)
    const currentUnitKPI = useMemo((): KPIPlan => {
        if (unitTarget) return UnitTargetService.toKPIPlan(unitTarget);
        // Only fallback to legacy unit.target for the default year (current filter year)
        if (selectedYear === defaultYear) {
            return unit.target || { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 };
        }
        // For other years without per-year data, show zeros
        return { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 };
    }, [unitTarget, unit.target, selectedYear, defaultYear]);

    // Summary totals
    const totals = useMemo(() => {
        let targetSigning = 0, targetRevenue = 0, targetProfit = 0;
        let actualSigning = 0, actualRevenue = 0, actualProfit = 0;

        employees.forEach(emp => {
            const t = getTarget(emp.id);
            targetSigning += t.signing || 0;
            targetRevenue += t.revenue || 0;
            targetProfit += t.adminProfit || 0;

            actualSigning += emp.stats?.totalSigning || 0;
            actualRevenue += emp.stats?.totalRevenue || 0;
            actualProfit += emp.stats?.totalProfit || 0;
        });

        return {
            target: { signing: targetSigning, revenue: targetRevenue, profit: targetProfit },
            actual: { signing: actualSigning, revenue: actualRevenue, profit: actualProfit }
        };
    }, [employees, targetMap]);

    // Unit target vs employee target allocation comparison
    const allocationRate = useMemo(() => {
        const uTarget = currentUnitKPI.signing || 0;
        if (uTarget === 0) return 0;
        return (totals.target.signing / uTarget) * 100;
    }, [currentUnitKPI, totals.target.signing]);

    const formatCurrency = (val: number) => {
        return (val || 0).toLocaleString('vi-VN') + ' ₫';
    };

    // === Unit target handlers ===
    const handleStartEditUnitTarget = () => {
        setIsEditingUnitTarget(true);
        setEditUnitTarget({ ...currentUnitKPI });
    };

    const handleCancelEditUnitTarget = () => {
        setIsEditingUnitTarget(false);
    };

    const handleSaveUnitTarget = async () => {
        setIsSavingUnitTarget(true);
        try {
            const saved = await UnitTargetService.upsert(unit.id, year, editUnitTarget);
            setUnitTarget(saved);
            setIsEditingUnitTarget(false);
            toast.success(`Cập nhật chỉ tiêu đơn vị năm ${year} thành công`);
            onRefresh();
        } catch (error) {
            console.error('Error updating unit target:', error);
            toast.error('Có lỗi khi cập nhật chỉ tiêu đơn vị');
        } finally {
            setIsSavingUnitTarget(false);
        }
    };

    // === Employee target handlers ===
    const handleStartEdit = (emp: EmployeeWithStats) => {
        setEditingId(emp.id);
        setEditTarget({ ...getTarget(emp.id) });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
    };

    const handleSaveTarget = async (empId: string) => {
        setIsSaving(true);
        try {
            await EmployeeTargetService.upsert(empId, unit.id, year, editTarget);
            toast.success(`Cập nhật chỉ tiêu ${year} thành công`);
            setEditingId(null);
            const updated = await EmployeeTargetService.getByUnitAndYear(unit.id, year);
            setYearTargets(updated);
        } catch (error) {
            console.error('Error updating employee target:', error);
            toast.error('Có lỗi khi cập nhật chỉ tiêu');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddEmployee = async (emp: Employee) => {
        const newMembers = [...(unit.targetMembers || []), emp.id];
        try {
            await UnitService.update(unit.id, { targetMembers: newMembers });
            setShowAddDropdown(false);
            toast.success(`Đã thêm ${emp.name}`);
            onRefresh();
        } catch {
            toast.error('Lỗi khi thêm nhân viên');
        }
    };

    const handleRemoveEmployee = async (emp: EmployeeWithStats) => {
        const newMembers = (unit.targetMembers || []).filter(id => id !== emp.id);
        try {
            await UnitService.update(unit.id, { targetMembers: newMembers });
            toast.success(`Đã xóa ${emp.name}`);
            onRefresh();
        } catch {
            toast.error('Lỗi khi xóa nhân viên');
        }
    };

    const getProgressColor = (pct: number) => {
        if (pct >= 100) return 'text-emerald-600 dark:text-emerald-400';
        if (pct >= 70) return 'text-indigo-600 dark:text-indigo-400';
        if (pct >= 40) return 'text-amber-600 dark:text-amber-400';
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
            {/* ═══════════════════════════════════════════════ */}
            {/* SECTION 1: Unit-level KPI Targets (per-year) */}
            {/* ═══════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <Target size={16} className="text-indigo-500" />
                            Chỉ tiêu Đơn vị
                        </h3>
                        {/* Year Selector */}
                        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                            <button
                                onClick={() => setSelectedYear(prev => prev - 1)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors cursor-pointer"
                                title="Năm trước"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            {yearOptions.map(y => (
                                <button
                                    key={y}
                                    onClick={() => setSelectedYear(y)}
                                    className={`px-2.5 py-1 text-[11px] font-black rounded-md transition-all cursor-pointer ${
                                        y === selectedYear
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {y}
                                </button>
                            ))}
                            <button
                                onClick={() => setSelectedYear(prev => prev + 1)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors cursor-pointer"
                                title="Năm sau"
                            >
                                <ChevronRightIcon size={14} />
                            </button>
                        </div>
                    </div>
                    {canEditUnitTarget ? (
                        isEditingUnitTarget ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSaveUnitTarget}
                                    disabled={isSavingUnitTarget}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs font-bold rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer"
                                >
                                    {isSavingUnitTarget ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    Lưu
                                </button>
                                <button
                                    onClick={handleCancelEditUnitTarget}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                    <X size={14} />
                                    Hủy
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleStartEditUnitTarget}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
                            >
                                <Pencil size={14} />
                                Giao chỉ tiêu
                            </button>
                        )
                    ) : (
                        <span className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Lock size={12} />
                            Chỉ BGĐ được giao chỉ tiêu
                        </span>
                    )}
                </div>

                <div className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Ký kết */}
                        <div className="relative p-4 bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full"></div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                    <FileText size={14} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CT Ký kết</span>
                            </div>
                            {isEditingUnitTarget ? (
                                <NumberInput
                                    value={editUnitTarget.signing}
                                    onChange={(v) => setEditUnitTarget(prev => ({ ...prev, signing: v }))}
                                    className="w-full px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                                />
                            ) : (
                                <>
                                    <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                                        {currentUnitKPI.signing > 0 ? formatCurrency(currentUnitKPI.signing) : '—'}
                                    </p>
                                    {currentUnitKPI.signing > 0 && (
                                        <div className="mt-2">
                                            <div className="flex items-center justify-between text-[10px] mb-1">
                                                <span className="text-slate-500 dark:text-slate-400">Thực tế: {formatCurrency(totals.actual.signing)}</span>
                                                <span className={`font-black ${getProgressColor(currentUnitKPI.signing > 0 ? (totals.actual.signing / currentUnitKPI.signing) * 100 : 0)}`}>
                                                    {((totals.actual.signing / currentUnitKPI.signing) * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${getProgressBarColor((totals.actual.signing / currentUnitKPI.signing) * 100)}`}
                                                    style={{ width: `${Math.min((totals.actual.signing / currentUnitKPI.signing) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Doanh thu */}
                        <div className="relative p-4 bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full"></div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                    <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CT Doanh thu</span>
                            </div>
                            {isEditingUnitTarget ? (
                                <NumberInput
                                    value={editUnitTarget.revenue}
                                    onChange={(v) => setEditUnitTarget(prev => ({ ...prev, revenue: v }))}
                                    className="w-full px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                                />
                            ) : (
                                <>
                                    <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                                        {currentUnitKPI.revenue > 0 ? formatCurrency(currentUnitKPI.revenue) : '—'}
                                    </p>
                                    {currentUnitKPI.revenue > 0 && (
                                        <div className="mt-2">
                                            <div className="flex items-center justify-between text-[10px] mb-1">
                                                <span className="text-slate-500 dark:text-slate-400">Thực tế: {formatCurrency(totals.actual.revenue)}</span>
                                                <span className={`font-black ${getProgressColor(currentUnitKPI.revenue > 0 ? (totals.actual.revenue / currentUnitKPI.revenue) * 100 : 0)}`}>
                                                    {((totals.actual.revenue / currentUnitKPI.revenue) * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${getProgressBarColor((totals.actual.revenue / currentUnitKPI.revenue) * 100)}`}
                                                    style={{ width: `${Math.min((totals.actual.revenue / currentUnitKPI.revenue) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* LNG gộp theo DT */}
                        <div className="relative p-4 bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden">
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full"></div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                    <Target size={14} className="text-purple-600 dark:text-purple-400" />
                                </div>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CT LNG gộp DT</span>
                            </div>
                            {isEditingUnitTarget ? (
                                <NumberInput
                                    value={editUnitTarget.adminProfit}
                                    onChange={(v) => setEditUnitTarget(prev => ({ ...prev, adminProfit: v }))}
                                    className="w-full px-3 py-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold"
                                />
                            ) : (
                                <>
                                    <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                                        {currentUnitKPI.adminProfit > 0 ? formatCurrency(currentUnitKPI.adminProfit) : '—'}
                                    </p>
                                    {currentUnitKPI.adminProfit > 0 && (
                                        <div className="mt-2">
                                            <div className="flex items-center justify-between text-[10px] mb-1">
                                                <span className="text-slate-500 dark:text-slate-400">Thực tế: {formatCurrency(totals.actual.profit)}</span>
                                                <span className={`font-black ${getProgressColor(currentUnitKPI.adminProfit > 0 ? (totals.actual.profit / currentUnitKPI.adminProfit) * 100 : 0)}`}>
                                                    {((totals.actual.profit / currentUnitKPI.adminProfit) * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${getProgressBarColor((totals.actual.profit / currentUnitKPI.adminProfit) * 100)}`}
                                                    style={{ width: `${Math.min((totals.actual.profit / currentUnitKPI.adminProfit) * 100, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>


            {/* ═══════════════════════════════════════════════ */}
            {/* SECTION 3: Employee KPI Table */}
            {/* ═══════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <FileText size={16} className="text-indigo-500" />
                        Chỉ tiêu ký kết NVKD
                        <span className="ml-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-black rounded-md">
                            {selectedYear}
                        </span>
                    </h3>
                    <div className="flex items-center gap-3">
                        {canEditEmployeeTargets ? (
                            <>
                                <span className="text-xs text-slate-400">
                                    Click <Pencil size={12} className="inline" /> để chỉnh sửa
                                </span>
                                <div className="relative" ref={addDropdownRef}>
                                    <button
                                        onClick={() => setShowAddDropdown(!showAddDropdown)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
                                    >
                                        <UserPlus size={14} />
                                        Thêm NV
                                    </button>
                                    {showAddDropdown && (
                                        <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                                            {availableToAdd.length === 0 ? (
                                                <div className="p-4 text-center text-sm text-slate-400">Tất cả nhân viên đã được thêm</div>
                                            ) : availableToAdd.map(emp => (
                                                <button
                                                    key={emp.id}
                                                    onClick={() => handleAddEmployee(emp)}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                                                >
                                                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 overflow-hidden">
                                                        {emp.avatar ? <img src={emp.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : emp.name.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{emp.name}</p>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{emp.position || 'Nhân viên'}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <span className="flex items-center gap-1.5 text-xs text-slate-400">
                                <Lock size={12} />
                                Chỉ lãnh đạo đơn vị được phân bổ
                            </span>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[200px]">Nhân viên</th>
                                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CT Ký kết</th>
                                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CT Doanh thu</th>
                                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CT LNG</th>
                                {canEditEmployeeTargets && (
                                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[100px]"></th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={canEditEmployeeTargets ? 5 : 4} className="text-center py-12 text-slate-400">
                                        <Users size={40} className="mx-auto mb-3 opacity-50" />
                                        <p>Chưa có nhân viên trong đơn vị</p>
                                    </td>
                                </tr>
                            ) : employees.map(emp => {
                                const isEditing = editingId === emp.id;
                                const empTarget = getTarget(emp.id);
                                const signingTarget = empTarget.signing || 0;
                                const actualSigning = emp.stats?.totalSigning || 0;
                                const signingPct = signingTarget > 0 ? (actualSigning / signingTarget) * 100 : 0;

                                return (
                                    <tr key={emp.id} className={`transition-colors ${isEditing ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
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
                                                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate group-hover/name:text-indigo-600 dark:group-hover/name:text-indigo-400 transition-colors">{emp.name}</p>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{emp.position || 'Nhân viên'}</p>
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
                                                <span className={`text-sm font-bold ${signingTarget > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                                                    {signingTarget > 0 ? formatCurrency(signingTarget) : '—'}
                                                </span>
                                            )}
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
                                                <span className={`text-sm font-bold ${(empTarget.revenue || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                    {(empTarget.revenue || 0) > 0 ? formatCurrency(empTarget.revenue) : '—'}
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
                                                <span className={`text-sm font-bold ${(empTarget.adminProfit || 0) > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
                                                    {(empTarget.adminProfit || 0) > 0 ? formatCurrency(empTarget.adminProfit) : '—'}
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        {canEditEmployeeTargets && (
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
                                                        <>
                                                            <button
                                                                onClick={() => handleStartEdit(emp)}
                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors cursor-pointer"
                                                                title="Chỉnh sửa chỉ tiêu"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemoveEmployee(emp)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors cursor-pointer"
                                                                title="Xóa khỏi danh sách"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}

                            {/* Totals Row */}
                            {employees.length > 0 && (
                                <tr className="bg-slate-50 dark:bg-slate-800 font-black">
                                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                                        Tổng cộng ({employees.length} NV)
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-indigo-600 dark:text-indigo-400 font-black">
                                        {formatCurrency(totals.target.signing)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-emerald-600 dark:text-emerald-400 font-black">
                                        {formatCurrency(totals.target.revenue)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-purple-600 dark:text-purple-400 font-black">
                                        {formatCurrency(totals.target.profit)}
                                    </td>
                                    {canEditEmployeeTargets && <td className="px-4 py-3"></td>}
                                </tr>
                            )}

                            {/* Còn thiếu Row */}
                            {employees.length > 0 && currentUnitKPI.signing > 0 && (() => {
                                const remainSigning = (currentUnitKPI.signing || 0) - totals.target.signing;
                                const remainRevenue = (currentUnitKPI.revenue || 0) - totals.target.revenue;
                                const remainProfit = (currentUnitKPI.adminProfit || 0) - totals.target.profit;
                                const hasShortfall = remainSigning > 0 || remainRevenue > 0 || remainProfit > 0;
                                if (!hasShortfall) return null;
                                return (
                                    <tr className="bg-amber-50/50 dark:bg-amber-900/10 border-t-2 border-dashed border-amber-300 dark:border-amber-700">
                                        <td className="px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400 font-bold">
                                            Còn thiếu
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-sm font-bold">
                                            <span className={`inline-flex items-center gap-1 ${remainSigning > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                {remainSigning > 0 ? <><AlertTriangle size={13} /> {formatCurrency(remainSigning)}</> : <Check size={13} />}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-sm font-bold">
                                            <span className={`inline-flex items-center gap-1 ${remainRevenue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                {remainRevenue > 0 ? <><AlertTriangle size={13} /> {formatCurrency(remainRevenue)}</> : <Check size={13} />}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-sm font-bold">
                                            <span className={`inline-flex items-center gap-1 ${remainProfit > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                {remainProfit > 0 ? <><AlertTriangle size={13} /> {formatCurrency(remainProfit)}</> : <Check size={13} />}
                                            </span>
                                        </td>
                                        {canEditEmployeeTargets && <td className="px-4 py-2.5"></td>}
                                    </tr>
                                );
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>


        </div>
    );
};

export default UnitSigningTab;
