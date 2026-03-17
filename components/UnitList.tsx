
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Search, Building, Plus, Pencil, Trash2, Target, TrendingUp, Users, Eye, FileText, LayoutGrid, Network, ChevronRight } from 'lucide-react';
import { UnitService } from '../services';
import { Unit } from '../types';
import UnitForm from './UnitForm';
import OrganizationChart from './OrganizationChart';
import { NON_BUSINESS_UNIT_CODES } from '../constants';
import { useUnitsWithStats } from '../hooks/useUnits';
import { queryKeys } from '../lib/queryClient';
import { useQueryClient } from '@tanstack/react-query';
import { usePermissionCheck } from '../hooks/usePermissions';

interface UnitListProps {
    onSelectUnit?: (id: string) => void;
}

const UnitList: React.FC<UnitListProps> = ({ onSelectUnit }) => {
    const queryClient = useQueryClient();
    const { role, unitId: userUnitId, can } = usePermissionCheck();
    // User can see all units if they are Admin/Leadership OR have explicit DB permission
    const isAdmin = role === 'Admin' || role === 'Leadership';
    const canViewAll = isAdmin || can('units', 'view');
    const { data: rawUnits = [], isLoading } = useUnitsWithStats();
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'orgchart'>('grid');

    // CRUD State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<Unit | undefined>(undefined);
    const [presetParentId, setPresetParentId] = useState<string | undefined>(undefined);

    // Filter out non-business units + scope to user's own unit for unit-scoped roles
    const units = useMemo(() => {
        let filtered = rawUnits.filter(u => u.id !== 'all' && !NON_BUSINESS_UNIT_CODES.includes(u.code));
        // Non-admin without explicit view permission: only see their own unit
        if (!canViewAll && userUnitId) {
            filtered = filtered.filter(u => u.id === userUnitId);
        }
        return filtered;
    }, [rawUnits, canViewAll, userUnitId]);

    const refetchData = () => queryClient.invalidateQueries({ queryKey: queryKeys.units.all });

    // Calculate Global Stats Only (Individual stats now come from Backend)
    const stats = useMemo(() => {
        const unitStats = new Map<string, { signing: number, revenue: number, profit: number }>();

        units.forEach((u: any) => {
            const s = u.stats || { totalSigning: 0, totalRevenue: 0, totalProfit: 0 };
            const profit = s.totalProfit || 0;

            unitStats.set(u.id, {
                signing: s.totalSigning,
                revenue: s.totalRevenue,
                profit: profit
            });
        });

        return { unitStats };
    }, [units]);

    const filteredUnits = useMemo(() => {
        if (!searchQuery) return units;
        return units.filter(u =>
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.code.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [units, searchQuery]);

    const formatCurrency = (val: number) => {
        if (!val) return '0';
        const abs = Math.abs(val);
        const sign = val < 0 ? '-' : '';
        if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + ' tỷ';
        if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + ' triệu';
        if (abs >= 1e3) return sign + (abs / 1e3).toFixed(0) + 'K';
        return sign + abs.toLocaleString('vi-VN');
    };

    const handleAdd = () => {
        setEditingUnit(undefined);
        setPresetParentId(undefined);
        setIsFormOpen(true);
    };

    const handleAddChild = (parentId: string) => {
        setEditingUnit(undefined);
        setPresetParentId(parentId);
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

    const typeLabel = (type: string) => {
        if (type === 'Center') return { text: 'Trung tâm', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
        if (type === 'Branch') return { text: 'Chi nhánh', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
        return { text: 'Công ty', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' };
    };

    return (
        <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-500 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Quản lý Đơn vị ({units.length})</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-bold mt-1">
                        {canViewAll ? 'Danh sách các Trung tâm và Chi nhánh trực thuộc' : 'Đơn vị của bạn'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'grid'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <LayoutGrid size={16} />
                            Danh sách
                        </button>
                        <button
                            onClick={() => setViewMode('orgchart')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'orgchart'
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <Network size={16} />
                            Sơ đồ
                        </button>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={handleAdd}
                            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200/50 dark:shadow-none"
                        >
                            <Plus size={18} /> Thêm Đơn vị
                        </button>
                    )}
                </div>
            </div>

            {/* Conditional View */}
            {viewMode === 'orgchart' ? (
                <OrganizationChart
                    onSelectUnit={(unit) => onSelectUnit?.(unit.id)}
                    onEditUnit={handleEdit}
                    onAddChild={handleAddChild}
                />
            ) : (
                <>
                    {/* Search Bar */}
                    <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm tên đơn vị hoặc mã đơn vị..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-900 dark:text-slate-100 font-medium transition-all"
                        />
                    </div>

                    {/* Compact Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        {isLoading ? (
                            <div className="p-8 space-y-4">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-4 animate-pulse">
                                        <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
                                        <div className="flex-1 space-y-2">
                                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                                            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/4"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : filteredUnits.length === 0 ? (
                            <div className="py-16 text-center text-slate-400 font-medium">
                                Không tìm thấy đơn vị nào phù hợp.
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                                        <th className="text-left py-3 px-5 text-[11px] font-black text-slate-400 uppercase tracking-wider">Đơn vị</th>
                                        <th className="text-center py-3 px-3 text-[11px] font-black text-slate-400 uppercase tracking-wider w-20">NV</th>
                                        <th className="text-center py-3 px-3 text-[11px] font-black text-slate-400 uppercase tracking-wider w-20">HĐ</th>
                                        <th className="text-right py-3 px-3 text-[11px] font-black text-blue-500 uppercase tracking-wider">Ký kết</th>
                                        <th className="text-right py-3 px-3 text-[11px] font-black text-emerald-500 uppercase tracking-wider">Doanh thu</th>
                                        <th className="text-right py-3 px-3 text-[11px] font-black text-purple-500 uppercase tracking-wider">LNG QT</th>
                                        <th className="py-3 px-4 w-24"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUnits.map((unit) => {
                                        const unitStat = stats.unitStats.get(unit.id);
                                        const signing = unitStat?.signing || 0;
                                        const revenue = unitStat?.revenue || 0;
                                        const profit = unitStat?.profit || 0;
                                        const targetSigning = unit.target?.signing || 0;
                                        const targetRevenue = unit.target?.revenue || 0;
                                        const targetProfit = unit.target?.adminProfit || 0;
                                        const pctSigning = targetSigning > 0 ? Math.round((signing / targetSigning) * 100) : 0;
                                        const pctRevenue = targetRevenue > 0 ? Math.round((revenue / targetRevenue) * 100) : 0;
                                        const pctProfit = targetProfit > 0 ? Math.round((profit / targetProfit) * 100) : 0;
                                        const tl = typeLabel(unit.type);

                                        return (
                                            <tr
                                                key={unit.id}
                                                className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
                                                onClick={() => onSelectUnit?.(unit.id)}
                                            >
                                                {/* Unit Info */}
                                                <td className="py-3 px-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                                                            <Building size={18} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">{unit.name}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">
                                                                    {unit.code}
                                                                </span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${tl.cls}`}>
                                                                    {tl.text}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Employee Count */}
                                                <td className="py-3 px-3 text-center">
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{(unit as any).employeeCount || '—'}</span>
                                                </td>

                                                {/* Contract Count */}
                                                <td className="py-3 px-3 text-center">
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{(unit as any).stats?.contractCount || 0}</span>
                                                </td>

                                                <td className="py-3 px-3 text-right">
                                                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">{formatCurrency(signing)}</span>
                                                    {targetSigning > 0 && <span className="text-[10px] text-slate-400 dark:text-slate-500">/{formatCurrency(targetSigning)}</span>}
                                                    {targetSigning > 0 && (
                                                        <div className="flex items-center gap-1.5 mt-1 justify-end">
                                                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-700 ${pctSigning >= 100 ? 'bg-emerald-500' : pctSigning >= 70 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                                                    style={{ width: `${Math.min(100, pctSigning)}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className={`text-[10px] font-black ${pctSigning >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>{pctSigning}%</span>
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="py-3 px-3 text-right">
                                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(revenue)}</span>
                                                    {targetRevenue > 0 && <span className="text-[10px] text-slate-400 dark:text-slate-500">/{formatCurrency(targetRevenue)}</span>}
                                                    {targetRevenue > 0 && (
                                                        <div className="flex items-center gap-1.5 mt-1 justify-end">
                                                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-700 ${pctRevenue >= 100 ? 'bg-emerald-500' : pctRevenue >= 70 ? 'bg-emerald-400' : 'bg-amber-500'}`}
                                                                    style={{ width: `${Math.min(100, pctRevenue)}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className={`text-[10px] font-black ${pctRevenue >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>{pctRevenue}%</span>
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="py-3 px-3 text-right">
                                                    <span className="text-sm font-black text-purple-600 dark:text-purple-400">{formatCurrency(profit)}</span>
                                                    {targetProfit > 0 && <span className="text-[10px] text-slate-400 dark:text-slate-500">/{formatCurrency(targetProfit)}</span>}
                                                    {targetProfit > 0 && (
                                                        <div className="flex items-center gap-1.5 mt-1 justify-end">
                                                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-700 ${pctProfit >= 100 ? 'bg-emerald-500' : pctProfit >= 70 ? 'bg-purple-500' : 'bg-amber-500'}`}
                                                                    style={{ width: `${Math.min(100, pctProfit)}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className={`text-[10px] font-black ${pctProfit >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>{pctProfit}%</span>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {isAdmin && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleEdit(unit)}
                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                                                    title="Chỉnh sửa"
                                                                >
                                                                    <Pencil size={15} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(unit.id)}
                                                                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                                                    title="Xóa"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </>
                                                        )}
                                                        <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 ml-1" />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}

            <UnitForm
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setPresetParentId(undefined); }}
                onSave={handleSave}
                unit={editingUnit}
                presetParentId={presetParentId}
            />
        </div>
    );
};

export default UnitList;
