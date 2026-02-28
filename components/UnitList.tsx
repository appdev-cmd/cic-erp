
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Search, Building, Plus, Pencil, Trash2, Target, TrendingUp, Users, Eye, FileText, LayoutGrid, Network } from 'lucide-react';
import { UnitService } from '../services';
import { Unit } from '../types';
import UnitForm from './UnitForm';
import OrganizationChart from './OrganizationChart';
import { NON_BUSINESS_UNIT_CODES } from '../constants';
import { useUnitsWithStats } from '../hooks/useUnits';
import { queryKeys } from '../lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';

interface UnitListProps {
    onSelectUnit?: (id: string) => void;
}

const UnitList: React.FC<UnitListProps> = ({ onSelectUnit }) => {
    const queryClient = useQueryClient();
    const { data: rawUnits = [], isLoading } = useUnitsWithStats();
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'orgchart'>('grid');

    // CRUD State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<Unit | undefined>(undefined);

    // Filter out non-business units
    const units = useMemo(() =>
        rawUnits.filter(u => u.id !== 'all' && !NON_BUSINESS_UNIT_CODES.includes(u.code)),
        [rawUnits]);

    const refetchData = () => queryClient.invalidateQueries({ queryKey: queryKeys.units.all });

    // Calculate Global Stats Only (Individual stats now come from Backend)
    const stats = useMemo(() => {
        const unitStats = new Map<string, { signing: number, revenue: number, profit: number }>();

        // Global sums
        let totalSigning = 0, totalRevenue = 0, totalProfit = 0;
        let targetSigning = 0, targetRevenue = 0, targetProfit = 0;

        units.forEach((u: any) => {
            const s = u.stats || { totalSigning: 0, totalRevenue: 0, totalProfit: 0 };
            const profit = s.totalProfit || 0;

            unitStats.set(u.id, {
                signing: s.totalSigning,
                revenue: s.totalRevenue,
                profit: profit
            });

            totalSigning += Number(s.totalSigning);
            totalRevenue += Number(s.totalRevenue);
            totalProfit += profit;

            targetSigning += u.target?.signing || 0;
            targetRevenue += u.target?.revenue || 0;
            targetProfit += u.target?.adminProfit || 0;
        });

        return {
            unitStats,
            global: {
                actual: { signing: totalSigning, revenue: totalRevenue, profit: totalProfit },
                target: { signing: targetSigning, revenue: targetRevenue, profit: targetProfit }
            }
        };
    }, [units]);

    const filteredUnits = useMemo(() => {
        if (!searchQuery) return units;
        return units.filter(u =>
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.code.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [units, searchQuery]);

    const formatCurrency = (val: number) => {
        if (val >= 1e9) return `${(val / 1e9).toFixed(1)} tỷ`;
        if (val >= 1e6) return `${(val / 1e6).toFixed(0)} tr`;
        return val.toLocaleString('vi-VN');
    };

    const handleAdd = () => {
        setEditingUnit(undefined);
        setIsFormOpen(true);
    };

    const handleEdit = (unit: Unit) => {
        setEditingUnit(unit);
        setIsFormOpen(true);
    };

    const handleSave = async (data: Omit<Unit, 'id'> | Unit) => {
        try {
            if ('id' in data) {
                await UnitService.update(data.id, data);
            } else {
                await UnitService.create(data);
            }
            refetchData();
            setIsFormOpen(false);
            toast.success("Lưu đơn vị thành công!");
        } catch (error) {
            console.error("Failed to save unit", error);
            toast.error("Có lỗi xảy ra khi lưu đơn vị.");
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Bạn có chắc chắn muốn xóa đơn vị này? Hành động này không thể hoàn tác.')) {
            try {
                await UnitService.delete(id);
                refetchData();
                toast.success("Đã xóa đơn vị thành công.");
            } catch (error) {
                console.error("Failed to delete unit", error);
                toast.error("Không thể xóa đơn vị. Có thể đơn vị đang có dữ liệu liên kết.");
            }
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Quản lý Đơn vị ({units.length})</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-bold mt-1">
                        Danh sách các Trung tâm và Chi nhánh trực thuộc
                    </p>
                </div>
            </div>
            {/* SCORE CARDS (GLOBAL) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    {
                        label: 'Tổng Ký kết',
                        icon: FileText,
                        color: 'text-indigo-600',
                        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
                        actual: stats.global.actual.signing,
                        target: stats.global.target.signing
                    },
                    {
                        label: 'Tổng Doanh thu',
                        icon: TrendingUp,
                        color: 'text-emerald-600',
                        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                        actual: stats.global.actual.revenue,
                        target: stats.global.target.revenue
                    },
                    {
                        label: 'Tổng LNG Quản trị',
                        icon: Target,
                        color: 'text-purple-600',
                        bg: 'bg-purple-50 dark:bg-purple-900/20',
                        actual: stats.global.actual.profit,
                        target: stats.global.target.profit
                    }
                ].map((item, idx) => {
                    const progress = item.target > 0 ? (item.actual / item.target) * 100 : 0;
                    const Icon = item.icon;
                    return (
                        <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className={`p-3 rounded-lg ${item.bg} ${item.color}`}>
                                    <Icon size={24} />
                                </div>
                                <span className={`text-lg font-black ${progress >= 100 ? 'text-emerald-600' : item.color}`}>
                                    {progress.toFixed(1)}%
                                </span>
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{item.label}</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">
                                {formatCurrency(item.actual)}
                            </p>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : item.color.replace('text-', 'bg-')}`} style={{ width: `${Math.min(progress, 100)}%` }}></div>
                            </div>
                            <p className="text-xs text-slate-500 mt-2 text-right">Mục tiêu: {formatCurrency(item.target)}</p>
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Danh sách Đơn vị</h2>

                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'grid'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <LayoutGrid size={16} />
                            Grid
                        </button>
                        <button
                            onClick={() => setViewMode('orgchart')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'orgchart'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Network size={16} />
                            Sơ đồ
                        </button>
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                    <Building size={20} /> Thêm Đơn vị
                </button>
            </div>

            {/* Conditional View */}
            {viewMode === 'orgchart' ? (
                <OrganizationChart
                    onSelectUnit={(unit) => onSelectUnit?.(unit.id)}
                    onEditUnit={handleEdit}
                />
            ) : (
                <>
                    {/* Search Bar */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="relative">
                            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm tên đơn vị hoặc mã đơn vị..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-slate-100 font-medium transition-all"
                            />
                        </div>
                    </div>

                    {/* Units Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {isLoading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 animate-pulse">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-14 h-14 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
                                        <div className="space-y-2 flex-1">
                                            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                                            <div className="flex gap-2">
                                                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-12"></div>
                                                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-10"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 mb-4">
                                        <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-16"></div>
                                        <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-16"></div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full"></div>
                                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full"></div>
                                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full"></div>
                                    </div>
                                </div>
                            ))
                        ) : filteredUnits.length === 0 ? (
                            <div className="col-span-full py-12 text-center text-slate-400">
                                Không tìm thấy đơn vị nào phù hợp.
                            </div>
                        ) : (
                            filteredUnits.map(unit => (
                                <div key={unit.id} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group relative cursor-pointer" onClick={() => onSelectUnit?.(unit.id)}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                                                <Building size={28} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">{unit.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                                                        {unit.code}
                                                    </span>
                                                    <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${unit.type === 'Center' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : unit.type === 'Branch' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                                                        {unit.type === 'Center' ? 'TT' : unit.type === 'Branch' ? 'CN' : 'CTY'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => handleEdit(unit)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(unit.id)}
                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quick badges row */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <Users size={12} className="text-blue-600" />
                                            <span className="text-xs font-bold text-blue-700 dark:text-blue-400">{(unit as any).employeeCount || '—'} NV</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                            <FileText size={12} className="text-purple-600" />
                                            <span className="text-xs font-bold text-purple-700 dark:text-purple-400">{(unit as any).stats?.contractCount || 0} HĐ</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-4">
                                            {[
                                                {
                                                    label: 'Ký kết',
                                                    icon: FileText,
                                                    val: stats.unitStats.get(unit.id)?.signing || 0,
                                                    target: unit.target.signing,
                                                    color: 'text-indigo-600',
                                                    barColor: 'bg-indigo-500'
                                                },
                                                {
                                                    label: 'Doanh thu',
                                                    icon: TrendingUp,
                                                    val: stats.unitStats.get(unit.id)?.revenue || 0,
                                                    target: unit.target.revenue,
                                                    color: 'text-emerald-600',
                                                    barColor: 'bg-emerald-500'
                                                },
                                                {
                                                    label: 'LNG Quản trị',
                                                    icon: Target,
                                                    val: stats.unitStats.get(unit.id)?.profit || 0,
                                                    target: unit.target.adminProfit,
                                                    color: 'text-purple-600',
                                                    barColor: 'bg-purple-500'
                                                }
                                            ].map((metric, idx) => {
                                                const pct = metric.target > 0 ? (metric.val / metric.target) * 100 : 0;
                                                return (
                                                    <div key={idx} className="space-y-1">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="font-bold text-slate-500 flex items-center gap-1.5">
                                                                <metric.icon size={12} /> {metric.label}
                                                            </span>
                                                            <span className={`font-black ${pct >= 100 ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                {pct.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between items-end">
                                                            <span className={`text-sm font-black ${metric.color}`}>
                                                                {formatCurrency(metric.val)}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400">
                                                                / {formatCurrency(metric.target)}
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-white dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : metric.barColor}`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            <UnitForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSave={handleSave}
                unit={editingUnit}
            />
        </div>
    );
};

export default UnitList;

