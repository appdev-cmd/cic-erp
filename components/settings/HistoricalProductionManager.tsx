import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Save, Loader2, ChevronDown, BarChart3, TrendingUp, Building2, AlertCircle, Calendar, Table2 } from 'lucide-react';
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

const MONTHS = [
    { num: 1, label: 'Th.1' }, { num: 2, label: 'Th.2' }, { num: 3, label: 'Th.3' },
    { num: 4, label: 'Th.4' }, { num: 5, label: 'Th.5' }, { num: 6, label: 'Th.6' },
    { num: 7, label: 'Th.7' }, { num: 8, label: 'Th.8' }, { num: 9, label: 'Th.9' },
    { num: 10, label: 'Th.10' }, { num: 11, label: 'Th.11' }, { num: 12, label: 'Th.12' },
];

const formatNumber = (n: number): string => {
    if (!n) return '';
    return n.toLocaleString('vi-VN');
};

const parseNumber = (s: string): number => {
    const cleaned = s.replace(/[.,\s]/g, '');
    return parseInt(cleaned) || 0;
};

const METRICS = [
    { key: 'signing', label: 'Ký kết', color: 'text-blue-600 dark:text-blue-400', bgActive: 'bg-blue-600 dark:bg-blue-500', bgInactive: 'hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
    { key: 'revenue', label: 'Doanh thu', color: 'text-emerald-600 dark:text-emerald-400', bgActive: 'bg-emerald-600 dark:bg-emerald-500', bgInactive: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
    { key: 'adminProfit', label: 'LNG QT', color: 'text-orange-600 dark:text-orange-400', bgActive: 'bg-orange-600 dark:bg-orange-500', bgInactive: 'hover:bg-orange-50 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
    { key: 'revProfit', label: 'LNG DT', color: 'text-purple-600 dark:text-purple-400', bgActive: 'bg-purple-600 dark:bg-purple-500', bgInactive: 'hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
] as const;

type ViewMode = 'yearly' | 'monthly';

const HistoricalProductionManager: React.FC = () => {
    const [viewMode, setViewMode] = useState<ViewMode>('monthly');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() - 1);
    const [selectedMetric, setSelectedMetric] = useState<string>('signing');
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Yearly data: { unitId: { signing, revenue, ... } }
    const [yearlyData, setYearlyData] = useState<Record<string, Record<string, number>>>({});
    // Monthly data: { `${unitId}_${month}`: { signing, revenue, ... } }
    const [monthlyData, setMonthlyData] = useState<Record<string, Record<string, number>>>({});

    // Fetch data
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [unitsData, yearData, monthData] = await Promise.all([
                UnitService.getAll(),
                HistoricalProductionService.getByYear(selectedYear),
                HistoricalProductionService.getMonthlyByYear(selectedYear),
            ]);

            const businessUnits = unitsData.filter(u =>
                u.id !== 'all' && u.type !== 'Company' && u.type !== 'BackOffice'
            );
            setUnits(businessUnits);

            // Init yearly edit data
            const yInit: Record<string, Record<string, number>> = {};
            businessUnits.forEach(u => {
                const r = yearData.find(d => d.unitId === u.id);
                yInit[u.id] = {
                    signing: r?.signing || 0,
                    revenue: r?.revenue || 0,
                    adminProfit: r?.adminProfit || 0,
                    revProfit: r?.revProfit || 0,
                };
            });
            setYearlyData(yInit);

            // Init monthly edit data
            const mInit: Record<string, Record<string, number>> = {};
            businessUnits.forEach(u => {
                for (let m = 1; m <= 12; m++) {
                    const key = `${u.id}_${m}`;
                    const r = monthData.find(d => d.unitId === u.id && d.month === m);
                    mInit[key] = {
                        signing: r?.signing || 0,
                        revenue: r?.revenue || 0,
                        adminProfit: r?.adminProfit || 0,
                        revProfit: r?.revProfit || 0,
                    };
                }
            });
            setMonthlyData(mInit);
            setHasChanges(false);
        } catch (error) {
            console.error('Failed to fetch historical data:', error);
            toast.error('Lỗi tải dữ liệu sản lượng');
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Handle yearly cell edit
    const handleYearlyEdit = (unitId: string, metric: string, value: string) => {
        setYearlyData(prev => ({
            ...prev,
            [unitId]: { ...prev[unitId], [metric]: parseNumber(value) }
        }));
        setHasChanges(true);
    };

    // Handle monthly cell edit
    const handleMonthlyEdit = (unitId: string, month: number, value: string) => {
        const key = `${unitId}_${month}`;
        setMonthlyData(prev => ({
            ...prev,
            [key]: { ...prev[key], [selectedMetric]: parseNumber(value) }
        }));
        setHasChanges(true);
    };

    // Calculate yearly totals
    const yearlyTotals = useMemo(() => {
        const t = { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0 };
        Object.values(yearlyData).forEach(row => {
            t.signing += row.signing || 0;
            t.revenue += row.revenue || 0;
            t.adminProfit += row.adminProfit || 0;
            t.revProfit += row.revProfit || 0;
        });
        return t;
    }, [yearlyData]);

    // Calculate monthly column totals per month
    const monthlyColTotals = useMemo(() => {
        const totals: Record<number, number> = {};
        for (let m = 1; m <= 12; m++) {
            let sum = 0;
            units.forEach(u => {
                const key = `${u.id}_${m}`;
                sum += monthlyData[key]?.[selectedMetric] || 0;
            });
            totals[m] = sum;
        }
        return totals;
    }, [monthlyData, units, selectedMetric]);

    // Calculate monthly row totals per unit
    const monthlyRowTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        units.forEach(u => {
            let sum = 0;
            for (let m = 1; m <= 12; m++) {
                const key = `${u.id}_${m}`;
                sum += monthlyData[key]?.[selectedMetric] || 0;
            }
            totals[u.id] = sum;
        });
        return totals;
    }, [monthlyData, units, selectedMetric]);

    const grandMonthlyTotal = useMemo(() => {
        return Object.values(monthlyRowTotals).reduce((a, b) => a + b, 0);
    }, [monthlyRowTotals]);

    // Save all
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const batch: Omit<HistoricalProduction, 'id'>[] = [];

            // Yearly records (month = null)
            Object.entries(yearlyData).forEach(([unitId, row]) => {
                batch.push({
                    unitId,
                    year: selectedYear,
                    month: null,
                    signing: row.signing || 0,
                    revenue: row.revenue || 0,
                    adminProfit: row.adminProfit || 0,
                    revProfit: row.revProfit || 0,
                });
            });

            // Monthly records
            Object.entries(monthlyData).forEach(([key, row]) => {
                const [unitId, monthStr] = key.split('_');
                const month = parseInt(monthStr);
                batch.push({
                    unitId,
                    year: selectedYear,
                    month,
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

    // Input class
    const inputCls = "w-full text-right bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-orange-400 dark:focus:border-orange-500 rounded px-2 py-1.5 text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-400 transition-all";

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                        <BarChart3 size={20} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200">Sản lượng Lịch sử</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Nhập dữ liệu sản lượng các năm để so sánh cùng kỳ</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* View Mode Toggle */}
                    <div className="flex bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setViewMode('yearly')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all ${viewMode === 'yearly'
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <Table2 size={14} />
                            Tổng năm
                        </button>
                        <button
                            onClick={() => setViewMode('monthly')}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all ${viewMode === 'monthly'
                                ? 'bg-orange-500 text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                        >
                            <Calendar size={14} />
                            Theo tháng
                        </button>
                    </div>

                    {/* Year Selector */}
                    <div className="relative">
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 pr-10 text-sm font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
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
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                    Đơn vị: <strong>triệu đồng</strong>. Ví dụ: 3,350 = 3 tỷ 350 triệu.
                    {viewMode === 'monthly' && ' Chọn chỉ số bên dưới để chuyển giữa Ký kết / Doanh thu / LNG.'}
                </p>
            </div>

            {/* Metric Selector (monthly view only) */}
            {viewMode === 'monthly' && (
                <div className="flex gap-1.5 flex-wrap">
                    {METRICS.map(m => (
                        <button
                            key={m.key}
                            onClick={() => setSelectedMetric(m.key)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${selectedMetric === m.key
                                ? `${m.bgActive} text-white shadow-sm`
                                : `bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 ${m.bgInactive}`
                                }`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Loading */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={32} className="animate-spin text-orange-500" />
                </div>
            ) : viewMode === 'yearly' ? (
                /* ====== YEARLY VIEW ====== */
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
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
                                                    value={formatNumber(yearlyData[unit.id]?.[m.key] || 0)}
                                                    onChange={(e) => handleYearlyEdit(unit.id, m.key, e.target.value)}
                                                    className={inputCls}
                                                    placeholder="0"
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                {/* Totals Row */}
                                <tr className="bg-orange-50 dark:bg-orange-900 border-t-2 border-orange-200 dark:border-orange-800">
                                    <td className="py-4 px-5">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp size={16} className="text-orange-600 dark:text-orange-400" />
                                            <span className="text-sm font-black text-orange-700 dark:text-orange-300">TỔNG CỘNG</span>
                                        </div>
                                    </td>
                                    {METRICS.map(m => (
                                        <td key={m.key} className="py-4 px-5 text-right">
                                            <span className="text-sm font-black text-orange-700 dark:text-orange-300 font-mono">
                                                {formatNumber(yearlyTotals[m.key as keyof typeof yearlyTotals])}
                                            </span>
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* ====== MONTHLY VIEW ====== */
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                    <th className="text-left py-3 px-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 min-w-[140px]">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={14} />
                                            Đơn vị
                                        </div>
                                    </th>
                                    {MONTHS.map(m => (
                                        <th key={m.num} className="text-center py-3 px-1 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[80px]">
                                            {m.label}
                                        </th>
                                    ))}
                                    <th className="text-right py-3 px-4 text-xs font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider min-w-[100px]">
                                        Tổng
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {units.map(unit => (
                                    <tr key={unit.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <td className="py-2 px-4 sticky left-0 bg-white dark:bg-slate-900 z-10">
                                            <div className="flex items-center gap-2">
                                                <span className="w-10 text-center px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-black text-slate-500 dark:text-slate-400">
                                                    {unit.code}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[90px]" title={unit.name}>
                                                    {unit.name}
                                                </span>
                                            </div>
                                        </td>
                                        {MONTHS.map(m => {
                                            const key = `${unit.id}_${m.num}`;
                                            const val = monthlyData[key]?.[selectedMetric] || 0;
                                            return (
                                                <td key={m.num} className="py-2 px-1">
                                                    <input
                                                        type="text"
                                                        value={formatNumber(val)}
                                                        onChange={(e) => handleMonthlyEdit(unit.id, m.num, e.target.value)}
                                                        className="w-full text-right bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-orange-400 dark:focus:border-orange-500 rounded px-1 py-1 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-400 transition-all"
                                                        placeholder="0"
                                                    />
                                                </td>
                                            );
                                        })}
                                        <td className="py-2 px-4 text-right">
                                            <span className="text-xs font-black text-slate-600 dark:text-slate-300 font-mono">
                                                {formatNumber(monthlyRowTotals[unit.id] || 0)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {/* Monthly Totals Row */}
                                <tr className="bg-orange-50 dark:bg-orange-900 border-t-2 border-orange-200 dark:border-orange-800">
                                    <td className="py-3 px-4 sticky left-0 bg-orange-50 dark:bg-orange-900 z-10">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp size={14} className="text-orange-600 dark:text-orange-400" />
                                            <span className="text-xs font-black text-orange-700 dark:text-orange-300">TỔNG</span>
                                        </div>
                                    </td>
                                    {MONTHS.map(m => (
                                        <td key={m.num} className="py-3 px-1 text-right">
                                            <span className="text-xs font-black text-orange-700 dark:text-orange-300 font-mono">
                                                {formatNumber(monthlyColTotals[m.num] || 0)}
                                            </span>
                                        </td>
                                    ))}
                                    <td className="py-3 px-4 text-right">
                                        <span className="text-xs font-black text-orange-700 dark:text-orange-300 font-mono">
                                            {formatNumber(grandMonthlyTotal)}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Footer note */}
            {!isLoading && (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                    Đang xem dữ liệu năm <strong>{selectedYear}</strong>
                    {viewMode === 'monthly' && <> · Chỉ số: <strong>{METRICS.find(m => m.key === selectedMetric)?.label}</strong></>}
                </p>
            )}
        </div>
    );
};

export default HistoricalProductionManager;
