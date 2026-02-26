
import React, { useState, useEffect, useMemo } from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    AreaChart, Area, ComposedChart, Line
} from 'recharts';
import { Calendar, ChevronDown, Building2, Filter, Download, PieChart as PieChartIcon } from 'lucide-react';
import { ContractService, UnitService, EmployeeService, PaymentService } from '../services';
import { Unit, Contract, Payment, Employee } from '../types';
import { toast } from 'sonner';
import { getChartColors, getAccentColor, getTooltipStyle, getGridStroke, getCursorFill, getMutedBarFill } from '../lib/themeColors';
import { useCurrentUserVisibleUnits } from '../hooks';

interface AnalyticsProps {
    selectedUnit: Unit;
    onSelectUnit: (unit: Unit) => void;
}



const Analytics: React.FC<AnalyticsProps> = ({ selectedUnit, onSelectUnit }) => {
    const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
    const [showUnitSelector, setShowUnitSelector] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const { visibleUnits, isLoading: loadingVisibility } = useCurrentUserVisibleUnits();

    const [contracts, setContracts] = useState<Contract[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [c, u, e, payRes] = await Promise.all([
                    ContractService.getAll(),
                    UnitService.getAll(),
                    EmployeeService.getAll(),
                    PaymentService.list({ page: 1, limit: 10000 })
                ]);
                setContracts(c);
                setUnits(u);
                setEmployees(e);
                setPayments(payRes.data);
            } catch (error) {
                toast.error("Lỗi tải dữ liệu thống kê");
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const safeUnit = units.find(u => u.id === selectedUnit.id) || selectedUnit;

    const availableYears = useMemo(() => {
        const years = new Set(contracts.map(c => c.signedDate ? c.signedDate.split('-')[0] : new Date().getFullYear().toString()));
        return Array.from(years).sort().reverse();
    }, [contracts]);

    const filteredContracts = useMemo(() => {
        return contracts.filter(c => {
            const matchUnit = selectedUnit.id === 'all' || c.unitId === selectedUnit.id;
            const matchYear = yearFilter === 'All' || (c.signedDate && c.signedDate.startsWith(yearFilter));
            return matchUnit && matchYear;
        });
    }, [contracts, selectedUnit, yearFilter]);

    // 1. Structure Pie Chart Data
    const structureData = useMemo(() => {
        const allowedUnits = units.filter(u => {
            if (u.id === 'all') return false;
            if (visibleUnits === 'all') return true;
            return visibleUnits.includes(u.id);
        });

        if (selectedUnit.id === 'all') {
            return allowedUnits.map(u => ({
                name: u.name,
                value: contracts
                    .filter(c => c.unitId === u.id && (yearFilter === 'All' || c.signedDate?.startsWith(yearFilter)))
                    .reduce((sum, c) => sum + (c.actualRevenue || 0), 0)
            })).filter(d => d.value > 0);
        } else {
            // If unit selected, break down by Employee
            return employees
                .filter(e => e.unitId === selectedUnit.id)
                .map(e => ({
                    name: e.name,
                    value: filteredContracts
                        .filter(c => c.salespersonId === e.id)
                        .reduce((sum, c) => sum + (c.actualRevenue || 0), 0)
                }))
                .filter(d => d.value > 0)
                .sort((a, b) => b.value - a.value);
        }
    }, [units, contracts, selectedUnit, yearFilter, employees, filteredContracts]);

    // 2. Plan vs Actual Bar Chart
    const planVsActualData = useMemo(() => {
        const allowedUnits = units.filter(u => {
            if (u.id === 'all') return false;
            if (visibleUnits === 'all') return true;
            return visibleUnits.includes(u.id);
        });

        return allowedUnits.filter(u => selectedUnit.id === 'all' || u.id === selectedUnit.id).map(u => {
            const unitContracts = contracts.filter(c => c.unitId === u.id && (yearFilter === 'All' || c.signedDate?.startsWith(yearFilter)));
            const actualRev = unitContracts.reduce((sum, c) => sum + (c.actualRevenue || 0), 0);
            const targetRev = u.target?.revenue || 0;
            return {
                name: u.name,
                Target: targetRev,
                Actual: actualRev,
                amt: actualRev // for sorting if needed
            };
        });
    }, [units, contracts, selectedUnit, yearFilter]);

    // 3. Monthly Trend
    const monthlyTrendData = useMemo(() => {
        const months = Array.from({ length: 12 }, (_, i) => `Thg ${i + 1}`);
        const data = months.map((m, i) => {
            const monthStr = (i + 1).toString().padStart(2, '0');
            const monthContracts = filteredContracts.filter(c => c.signedDate && c.signedDate.split('-')[1] === monthStr);

            const revenue = monthContracts.reduce((sum, c) => sum + (c.actualRevenue || 0), 0);
            const profit = monthContracts.reduce((sum, c) => sum + ((c.value || 0) - (c.estimatedCost || 0)), 0);

            return {
                name: m,
                DoanhThu: revenue,
                LoiNhuan: profit
            };
        });
        return data;
    }, [filteredContracts]);

    // 4. Cashflow (In vs Out)
    const cashflowData = useMemo(() => {
        const months = Array.from({ length: 12 }, (_, i) => `Thg ${i + 1}`);
        const filteredContractIds = new Set(filteredContracts.map(c => c.id));

        return months.map((m, i) => {
            const monthStr = (i + 1).toString().padStart(2, '0'); // Assuming payment date format needs parsing or just use payment date? 
            // Actual logic: Verify payment dates. Assuming payment has date field?
            // Checking types.ts from memory: Payment has `date` or `createdAt`? 
            // Wait, `Payment` type usually has `paymentDate`. Let's assume `date`. 
            // If not, I'll filter by createdAt. 
            // Let's look at `Dashboard.tsx` ... it calculates total, not monthly cashflow.
            // I'll filter payments by month of `paymentDate`.

            const relevantPayments = payments.filter(p => {
                if (!p.paymentDate) return false;
                // p.paymentDate is likely YYYY-MM-DD
                return p.paymentDate.startsWith(`${yearFilter}-${monthStr}`) && filteredContractIds.has(p.contractId);
            });

            const inFlow = relevantPayments
                .filter(p => (p.paymentType === 'Revenue' || !p.paymentType) && p.status === 'Paid')
                .reduce((sum, p) => sum + p.paidAmount, 0);

            const outFlow = relevantPayments
                .filter(p => p.paymentType === 'Expense' && p.status === 'Paid')
                .reduce((sum, p) => sum + p.paidAmount, 0);

            return {
                name: m,
                Thu: inFlow,
                Chi: outFlow,
                Rong: inFlow - outFlow
            };
        });
    }, [payments, filteredContracts, yearFilter]);

    const formatCurrency = (val: number) => {
        if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
        if (val >= 1e6) return `${(val / 1e6).toFixed(0)}M`;
        return `${val}`;
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        Thống kê Chuyên sâu
                    </h1>
                    <p className="text-slate-500 font-medium">Phân tích hiệu quả kinh doanh & tài chính</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    {/* Unit Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUnitSelector(!showUnitSelector)}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm hover:border-orange-500 transition-colors"
                        >
                            <Building2 size={18} className="text-slate-400" />
                            <span className="font-bold text-slate-700 dark:text-slate-200">{safeUnit.name}</span>
                            <ChevronDown size={16} />
                        </button>
                        {showUnitSelector && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowUnitSelector(false)} />
                                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 shadow-xl rounded-lg z-20 overflow-hidden">
                                    {(visibleUnits === 'all' || visibleUnits.length > 1) && (
                                        <button onClick={() => { onSelectUnit({ id: 'all', name: 'Toàn công ty', type: 'Company' } as Unit); setShowUnitSelector(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm">Toàn công ty</button>
                                    )}
                                    {units.filter(u => u.name !== 'Toàn công ty' &&
                                        (u.type === 'Center' || u.type === 'Branch') &&
                                        (visibleUnits === 'all' || visibleUnits.includes(u.id))
                                    ).map(u => (
                                        <button key={u.id} onClick={() => { onSelectUnit(u); setShowUnitSelector(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm">{u.name}</button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Year Selector */}
                    <div className="relative">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
                            <Calendar size={18} className="text-slate-400" />
                            <select
                                value={yearFilter}
                                onChange={(e) => setYearFilter(e.target.value)}
                                className="bg-transparent font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none pr-4"
                            >
                                <option value="All">Tất cả</option>
                                {availableYears.map(y => <option key={y} value={y}>Năm {y}</option>)}
                            </select>
                        </div>
                    </div>

                    <button className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-lg hover:bg-orange-100 transition-colors">
                        <Download size={20} />
                    </button>
                </div>
            </div>

            {/* Top Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Revenue Structure */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                        <PieChartIcon size={20} className="text-indigo-500" />
                        Cơ cấu Doanh thu {selectedUnit.id === 'all' ? '(Theo Đơn vị)' : '(Theo Nhân sự)'}
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={structureData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {structureData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getChartColors()[index % getChartColors().length]} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number | undefined) => formatCurrency(value || 0)} contentStyle={getTooltipStyle()} />
                                <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Plan vs Actual */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">
                        Kế hoạch vs Thực tế (Doanh thu)
                    </h3>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={planVsActualData} barCategoryGap={20}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                                <Tooltip cursor={{ fill: getCursorFill() }} formatter={(value: number | undefined) => formatCurrency(value || 0)} contentStyle={getTooltipStyle()} />
                                <Legend />
                                <Bar dataKey="Actual" name="Thực tế" fill={getAccentColor()} radius={[6, 6, 0, 0]} />
                                <Bar dataKey="Target" name="Kế hoạch" fill={getMutedBarFill()} radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 3. Monthly Trend (Line/Area) */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">
                    Biểu đồ Xu hướng (Doanh thu & Lợi nhuận)
                </h3>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyTrendData}>
                            <defs>
                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={getAccentColor()} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={getAccentColor()} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip contentStyle={getTooltipStyle()} formatter={(value: number | undefined) => formatCurrency(value || 0)} />
                            <Legend />
                            <Area type="monotone" dataKey="DoanhThu" name="Doanh thu" stroke={getAccentColor()} strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                            <Area type="monotone" dataKey="LoiNhuan" name="Lợi nhuận" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 4. Cashflow (Composed) */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">
                    Biểu đồ Dòng tiền (Thu - Chi)
                </h3>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={cashflowData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip contentStyle={getTooltipStyle()} formatter={(value: number | undefined) => formatCurrency(value || 0)} />
                            <Legend />
                            <Bar dataKey="Thu" name="Dòng tiền vào" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="Chi" name="Dòng tiền ra" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                            <Line type="monotone" dataKey="Rong" name="Dòng tiền ròng" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
