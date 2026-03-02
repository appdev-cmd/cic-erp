import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Save, Loader2, ChevronDown, BarChart3, TrendingUp, Building2, AlertCircle } from 'lucide-react';
import { HistoricalProductionService, UnitService } from '../../services';
import { HistoricalProduction, Unit } from '../../types';

// Historical years: 2023-2025 always available for manual entry.
// From 2026 onwards, a year only appears after it has ended (i.e. current year excluded).
const HISTORICAL_BASE_YEARS = [2023, 2024, 2025];
const currentYear = new Date().getFullYear();
const dynamicYears: number[] = [];
for (let y = 2026; y < currentYear; y++) {
    dynamicYears.push(y);
}
const YEARS = [...HISTORICAL_BASE_YEARS, ...dynamicYears];

const formatNumber = (n: number): string => {
    if (!n) return '';
    return n.toLocaleString('vi-VN');
};

const parseNumber = (s: string): number => {
    const cleaned = s.replace(/[.,\s]/g, '');
    return parseInt(cleaned) || 0;
};

const METRICS = [
    { key: 'signing', label: 'Ký kết', color: 'text-blue-600 dark:text-blue-400' },
    { key: 'revenue', label: 'Doanh thu', color: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'adminProfit', label: 'LNG Quản trị', color: 'text-orange-600 dark:text-orange-400' },
    { key: 'revProfit', label: 'LNG theo DT', color: 'text-purple-600 dark:text-purple-400' },
] as const;

const HistoricalProductionManager: React.FC = () => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() - 1);
    const [units, setUnits] = useState<Unit[]>([]);
    const [records, setRecords] = useState<Record<string, HistoricalProduction>>({});
    const [editData, setEditData] = useState<Record<string, Record<string, number>>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Fetch units + data for selected year
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [unitsData, yearData] = await Promise.all([
                UnitService.getAll(),
                HistoricalProductionService.getByYear(selectedYear),
            ]);

            const businessUnits = unitsData.filter(u =>
                u.id !== 'all' && u.type !== 'Company' && u.type !== 'BackOffice'
            );
            setUnits(businessUnits);

            // Map records by unit_id
            const recMap: Record<string, HistoricalProduction> = {};
            yearData.forEach(r => { recMap[r.unitId] = r; });
            setRecords(recMap);

            // Init edit data from records
            const editInit: Record<string, Record<string, number>> = {};
            businessUnits.forEach(u => {
                const r = recMap[u.id];
                editInit[u.id] = {
                    signing: r?.signing || 0,
                    revenue: r?.revenue || 0,
                    adminProfit: r?.adminProfit || 0,
                    revProfit: r?.revProfit || 0,
                };
            });
            setEditData(editInit);
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to fetch historical data:', error);
            toast.error('Lỗi tải dữ liệu sản lượng');
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Handle cell edit
    const handleEdit = (unitId: string, metric: string, value: string) => {
        const num = parseNumber(value);
        setEditData(prev => ({
            ...prev,
            [unitId]: { ...prev[unitId], [metric]: num }
        }));
        setHasChanges(true);
    };

    // Calculate totals
    const totals = useMemo(() => {
        const t = { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0 };
        Object.values(editData).forEach(row => {
            t.signing += row.signing || 0;
            t.revenue += row.revenue || 0;
            t.adminProfit += row.adminProfit || 0;
            t.revProfit += row.revProfit || 0;
        });
        return t;
    }, [editData]);

    // Save all
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const batch: Omit<HistoricalProduction, 'id'>[] = [];
            Object.entries(editData).forEach(([unitId, row]) => {
                batch.push({
                    unitId,
                    year: selectedYear,
                    signing: row.signing || 0,
                    revenue: row.revenue || 0,
                    adminProfit: row.adminProfit || 0,
                    revProfit: row.revProfit || 0,
                });
            });
            await HistoricalProductionService.bulkUpsert(batch);
            toast.success(`Đã lưu dữ liệu sản lượng năm ${selectedYear}`);
            setHasChanges(false);
            await fetchData();
        } catch (error) {
            console.error('Failed to save:', error);
            toast.error('Lỗi lưu dữ liệu');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                        <BarChart3 size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200">Sản lượng Lịch sử</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Nhập dữ liệu sản lượng các năm để so sánh cùng kỳ</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Year Selector */}
                    <div className="relative">
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 pr-10 text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                        >
                            {YEARS.map(y => (
                                <option key={y} value={y}>Năm {y}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${hasChanges
                            ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-200/50 dark:shadow-none'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Lưu
                    </button>
                </div>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                    Đơn vị: <strong>triệu đồng</strong>. Ví dụ: 3,350 = 3 tỷ 350 triệu. Dữ liệu dùng để so sánh sản lượng cùng kỳ giữa các năm.
                </p>
            </div>

            {/* Data Table */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={32} className="animate-spin text-orange-500" />
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                    <th className="text-left py-4 px-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider w-[180px]">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={14} />
                                            Đơn vị
                                        </div>
                                    </th>
                                    {METRICS.map(m => (
                                        <th key={m.key} className="text-right py-4 px-5 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            <span className={m.color}>{m.label}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {units.map(unit => (
                                    <tr key={unit.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <td className="py-3 px-5">
                                            <div className="flex items-center gap-3">
                                                <span className="w-12 text-center px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-black text-slate-500 dark:text-slate-400">
                                                    {unit.code}
                                                </span>
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
                                                    {unit.name}
                                                </span>
                                            </div>
                                        </td>
                                        {METRICS.map(m => (
                                            <td key={m.key} className="py-3 px-5">
                                                <input
                                                    type="text"
                                                    value={formatNumber(editData[unit.id]?.[m.key] || 0)}
                                                    onChange={(e) => handleEdit(unit.id, m.key, e.target.value)}
                                                    className="w-full text-right bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-orange-400 dark:focus:border-orange-500 rounded-lg px-3 py-2 text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-400 transition-all"
                                                    placeholder="0"
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}

                                {/* Totals Row */}
                                <tr className="bg-orange-50 dark:bg-orange-900/20 border-t-2 border-orange-200 dark:border-orange-800">
                                    <td className="py-4 px-5">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp size={16} className="text-orange-600 dark:text-orange-400" />
                                            <span className="text-sm font-black text-orange-700 dark:text-orange-300">TỔNG CỘNG</span>
                                        </div>
                                    </td>
                                    {METRICS.map(m => (
                                        <td key={m.key} className="py-4 px-5 text-right">
                                            <span className="text-sm font-black text-orange-700 dark:text-orange-300 font-mono">
                                                {formatNumber(totals[m.key as keyof typeof totals])}
                                            </span>
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Year comparison preview */}
            {!isLoading && (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                    Đang xem dữ liệu năm <strong>{selectedYear}</strong>. Dữ liệu lịch sử: 2023–2025 (nhập thủ công). Từ 2026 trở đi, chỉ hiện sau khi kết thúc năm.
                </p>
            )}
        </div>
    );
};

export default HistoricalProductionManager;
