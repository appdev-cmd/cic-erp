import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    AreaChart, Area, ComposedChart, Line
} from 'recharts';
import {
    PieChartIcon, Calendar, Download, Building2, ChevronDown,
    TrendingUp, CreditCard, FileText, Target,
    ArrowUpRight, ArrowDownRight, BarChart3, Activity, Wallet,
    Inbox, Users, Package, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    ContractService, UnitService, EmployeeService,
    PaymentService, HistoricalProductionService,
    CustomerService, BrandService, ProductService
} from '../services';
import {
    Unit, Contract, Employee, Payment, HistoricalProduction,
    Customer, Brand, Product
} from '../types';
import { toast } from 'sonner';
import { getChartColors, getAccentColor, getTooltipStyle, getGridStroke, getCursorFill, getMutedBarFill, isDarkTheme } from '../lib/themeColors';
import { useCurrentUserVisibleUnits } from '../hooks';
import { Skeleton } from './ui/Skeleton';
import { motion } from 'framer-motion';
import { useLayoutContext } from './layout/MainLayout';

interface AnalyticsProps {
    selectedUnit: Unit;
    onSelectUnit: (unit: Unit) => void;
}

/* ─── Loading Skeleton ─── */
const AnalyticsSkeleton = () => (
    <div className="space-y-8 animate-pulse p-2">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map(i => <Skeleton key={i} className="h-[380px] rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
        <Skeleton className="h-[400px] rounded-xl" />
    </div>
);

/* ─── Empty State ─── */
const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
            <Inbox size={28} className="text-slate-300 dark:text-slate-600" />
        </div>
        <p className="text-sm font-bold text-slate-400 dark:text-slate-500">{message}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Hãy thử chọn đơn vị hoặc năm khác</p>
    </div>
);

/* ─── KPI Card ─── */
const KPICard = ({ title, value, icon, color, change, index }: {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    change?: { value: string; isUp: boolean };
    index: number;
}) => {
    const formatValue = (val: number) => {
        const abs = Math.abs(val);
        const sign = val < 0 ? '-' : '';
        if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} tỷ`;
        if (abs >= 1e6) return `${sign}${Math.round(abs / 1e6)} triệu`;
        if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}K`;
        return Math.round(val).toString();
    };

    const colorMap: Record<string, string> = {
        indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30',
        emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30',
        purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/30',
        amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4, ease: 'easeOut' }}
            className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden"
        >
            <div className="flex justify-between items-start mb-5">
                <div className={`p-3 rounded-xl ${colorMap[color]} transition-transform group-hover:rotate-6`}>
                    {icon}
                </div>
                {change && (
                    <div className={`flex items-center gap-1 text-[11px] font-black ${change.isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {change.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {change.value}%
                    </div>
                )}
            </div>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">{title}</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{formatValue(value)}</h4>
        </motion.div>
    );
};

/* ─── Chart Card Wrapper ─── */
const ChartCard = ({ title, subtitle, children, index, className = '' }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    index: number;
    className?: string;
}) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 + index * 0.12, duration: 0.5, ease: 'easeOut' }}
        className={`bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all ${className}`}
    >
        <div className="mb-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{title}</h3>
            {subtitle && <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {children}
    </motion.div>
);

/* ─── Custom Tooltip ─── */
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const dark = isDarkTheme();
    return (
        <div className={`px-5 py-4 rounded-xl shadow-2xl border ${dark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
            <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">{label}</p>
            {payload.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{p.name}:</span>
                    <span className="text-sm font-black">{formatCurrencyGlobal(p.value)}</span>
                </div>
            ))}
        </div>
    );
};

const formatCurrencyGlobal = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} tỷ`;
    if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)} tr`;
    if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}K`;
    return `${Math.round(val)}`;
};

/* ═══════════════════════════════════════ MAIN COMPONENT ═══════════════════════════════════════ */

const Analytics: React.FC<AnalyticsProps> = ({ selectedUnit: propSelectedUnit, onSelectUnit: propOnSelectUnit }) => {
    const { yearFilter, periodFilter, setYearFilter, selectedUnit: ctxSelectedUnit, setSelectedUnit: ctxSetSelectedUnit } = useLayoutContext();
    const selectedUnit = propSelectedUnit || ctxSelectedUnit;
    const onSelectUnit = propOnSelectUnit || ctxSetSelectedUnit;

    const [showUnitSelector, setShowUnitSelector] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [drillDown, setDrillDown] = useState<{
        isOpen: boolean;
        title: string;
        contracts: Contract[];
    } | null>(null);

    const { visibleUnits } = useCurrentUserVisibleUnits();

    // Contracts fetched WITH payments join (via list) for accurate revenue
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [historicalData, setHistoricalData] = useState<HistoricalProduction[]>([]);

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // KPI data from getStats RPC (same source as Dashboard)
    const [statsData, setStatsData] = useState<{
        totalRevenue: number; totalProfit: number; totalSigningProfit: number;
        totalRevenueProfit: number; totalCash: number; totalValue: number; totalContracts: number;
    } | null>(null);

    // Fetch base data (units, employees, historical) once
    useEffect(() => {
        const fetchBaseData = async () => {
            try {
                const [u, e, hRes, cust, br, prd] = await Promise.all([
                    UnitService.getAll(),
                    EmployeeService.getAll(),
                    HistoricalProductionService.getAll(),
                    CustomerService.getAll(),
                    BrandService.getAll(),
                    ProductService.getAll()
                ]);
                setUnits(u);
                setEmployees(e);
                setHistoricalData(hRes);
                setCustomers(Array.isArray(cust) ? cust : cust.data || []);
                setBrands(Array.isArray(br) ? br : (br as any).data || []);
                setProducts(Array.isArray(prd) ? prd : (prd as any).data || []);
            } catch (error) {
                toast.error("Lỗi tải dữ liệu cơ sở");
            }
        };
        fetchBaseData();
    }, []);

    // Fetch contracts & stats when unit/year changes — uses list() with payments join
    useEffect(() => {
        let cancelled = false;
        const fetchFilteredData = async () => {
            setIsLoading(true);
            try {
                const unitId = selectedUnit?.id === 'all' ? 'all' : selectedUnit?.id;

                let dateFrom: string | undefined = undefined;
                let dateTo: string | undefined = undefined;

                if (yearFilter && yearFilter !== 'All' && yearFilter !== 'all') {
                    dateFrom = `${yearFilter}-01-01`;
                    dateTo = `${yearFilter}-12-31`;
                    if (periodFilter) {
                        if (periodFilter.startsWith('M')) {
                            const month = parseInt(periodFilter.substring(1));
                            dateFrom = `${yearFilter}-${month.toString().padStart(2, '0')}-01`;
                            dateTo = new Date(parseInt(yearFilter), month, 0).toISOString().split('T')[0];
                        } else if (periodFilter.startsWith('Q')) {
                            const quarter = parseInt(periodFilter.substring(1));
                            const startMonth = (quarter - 1) * 3 + 1;
                            const endMonth = quarter * 3;
                            dateFrom = `${yearFilter}-${startMonth.toString().padStart(2, '0')}-01`;
                            dateTo = new Date(parseInt(yearFilter), endMonth, 0).toISOString().split('T')[0];
                        }
                    }
                }

                // Parallel: getStats (KPI) + list (contracts with payments) + payments
                const [stats, contractsRes, payRes] = await Promise.all([
                    ContractService.getStats({ unitId, dateFrom, dateTo }),
                    ContractService.list({ page: 1, limit: 10000, unitId, dateFrom, dateTo }),
                    PaymentService.list({ page: 1, limit: 10000 })
                ]);

                if (!cancelled) {
                    setStatsData(stats as any);
                    setContracts(contractsRes.data);
                    setPayments(payRes.data);
                }
            } catch (error) {
                toast.error("Lỗi tải dữ liệu thống kê");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        fetchFilteredData();
        return () => { cancelled = true; };
    }, [selectedUnit, yearFilter, periodFilter]);

    const safeUnit = units.find(u => u.id === selectedUnit.id) || selectedUnit;

    const availableYears = useMemo(() => {
        const years = new Set(contracts.map(c => c.signedDate ? c.signedDate.split('-')[0] : new Date().getFullYear().toString()));
        return Array.from(years).sort().reverse();
    }, [contracts]);

    // Contracts are already filtered by unit+year from the API call
    const filteredContracts = contracts;

    /* ─── KPI Calculations (from getStats RPC — same as Dashboard) ─── */
    const kpiData = useMemo(() => {
        if (!statsData) return { totalRevenue: 0, totalProfit: 0, contractCount: 0, completionRate: 0 };

        const totalRevenue = statsData.totalRevenue || 0;
        const totalProfit = statsData.totalSigningProfit || 0;
        const contractCount = statsData.totalContracts || 0;

        // Target: aggregate from all business units when viewing 'all'
        let targetRevenue = 0;
        if (selectedUnit.id === 'all') {
            const businessUnits = units.filter(u => u.id !== 'all' && (u.type === 'Center' || u.type === 'Branch'));
            targetRevenue = businessUnits.reduce((sum, u) => sum + (u.target?.revenue || 0), 0);
        } else {
            targetRevenue = safeUnit.target?.revenue || 0;
        }
        const completionRate = targetRevenue > 0 ? Math.min(100, (totalRevenue / targetRevenue) * 100) : 0;

        return { totalRevenue, totalProfit, contractCount, completionRate };
    }, [statsData, safeUnit, selectedUnit, units]);

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
    }, [units, contracts, selectedUnit, yearFilter, employees, filteredContracts, visibleUnits]);

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
            };
        });
    }, [units, contracts, selectedUnit, yearFilter, visibleUnits]);

    // 3. Monthly Trend
    const monthlyTrendData = useMemo(() => {
        const months = Array.from({ length: 12 }, (_, i) => `Th.${i + 1}`);
        return months.map((m, i) => {
            const monthStr = (i + 1).toString().padStart(2, '0');
            const monthContracts = filteredContracts.filter(c => c.signedDate && c.signedDate.split('-')[1] === monthStr);
            const revenue = monthContracts.reduce((sum, c) => sum + (c.actualRevenue || 0), 0);
            const profit = monthContracts.reduce((sum, c) => sum + ((c.value || 0) - (c.estimatedCost || 0)), 0);
            return { name: m, DoanhThu: revenue, LoiNhuan: profit };
        });
    }, [filteredContracts]);

    // 4. Cashflow (In vs Out)
    const cashflowData = useMemo(() => {
        const months = Array.from({ length: 12 }, (_, i) => `Th.${i + 1}`);
        const filteredContractIds = new Set(filteredContracts.map(c => c.id));
        // When yearFilter is 'All', use current year for monthly breakdown
        const effectiveYear = yearFilter === 'All' ? new Date().getFullYear().toString() : yearFilter;

        return months.map((m, i) => {
            const monthStr = (i + 1).toString().padStart(2, '0');
            const relevantPayments = payments.filter(p => {
                if (!p.paymentDate) return false;
                const matchContract = filteredContractIds.has(p.contractId);
                if (yearFilter === 'All') {
                    // When 'All', group by month across all years
                    const payMonth = p.paymentDate.split('-')[1];
                    return payMonth === monthStr && matchContract;
                }
                return p.paymentDate.startsWith(`${effectiveYear}-${monthStr}`) && matchContract;
            });

            const inFlow = relevantPayments
                .filter(p => (p.paymentType === 'Revenue' || !p.paymentType) && (p.status === 'Tiền về' || p.status === 'Tạm ứng'))
                .reduce((sum, p) => sum + p.paidAmount, 0);

            const outFlow = relevantPayments
                .filter(p => p.paymentType === 'Expense' && p.status === 'Đã chi')
                .reduce((sum, p) => sum + p.paidAmount, 0);

            return { name: m, Thu: inFlow, Chi: outFlow, Rong: inFlow - outFlow };
        });
    }, [payments, filteredContracts, yearFilter]);

    // 5. Historical Comparison (YoY)
    const historicalComparisonData = useMemo(() => {
        const relevantHist = historicalData.filter(h => selectedUnit.id === 'all' ? true : h.unitId === selectedUnit.id);
        const yearMap = new Map<number, any>();
        relevantHist.forEach(h => {
            if (!yearMap.has(h.year)) {
                yearMap.set(h.year, { name: h.year.toString(), 'Ký kết': 0, 'Doanh thu': 0, 'LNG QT': 0, 'LNG DT': 0 });
            }
            const entry = yearMap.get(h.year);
            entry['Ký kết'] += h.signing * 1000000;
            entry['Doanh thu'] += h.revenue * 1000000;
            entry['LNG QT'] += h.adminProfit * 1000000;
            entry['LNG DT'] += h.revProfit * 1000000;
        });
        return Array.from(yearMap.values()).sort((a, b) => parseInt(a.name) - parseInt(b.name));
    }, [historicalData, selectedUnit]);

    // 6. Top Customers by Revenue (Top 5)
    const topCustomersData = useMemo(() => {
        const customerMap = new Map<string, number>();
        filteredContracts.forEach(c => {
            if (c.customerId) {
                customerMap.set(c.customerId, (customerMap.get(c.customerId) || 0) + (c.actualRevenue || 0));
            }
        });
        return Array.from(customerMap.entries())
            .map(([id, rev]) => ({
                id,
                type: 'CUSTOMER',
                name: customers.find(cus => cus.id === id)?.shortName || customers.find(cus => cus.id === id)?.name || 'Khách hàng ẩn',
                value: rev
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [filteredContracts, customers]);

    // 7. Top Brands by Revenue
    // Dùng outputPrice × quantity trực tiếp (nhất quán với vw_products_with_stats trong module Đối tác)
    const topBrandsData = useMemo(() => {
        const brandMap = new Map<string, number>(); // brandId -> revenue
        filteredContracts.forEach(c => {
            if (c.lineItems && Array.isArray(c.lineItems)) {
                c.lineItems.forEach((li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    if (product && product.brandId) {
                        // Dùng outputPrice × quantity = giá trị thực tế của sản phẩm trong hợp đồng
                        // Nhất quán với cách tính total_revenue trong vw_products_with_stats (module Đối tác)
                        const lineRevenue = (li.outputPrice || 0) * (li.quantity || 1);
                        brandMap.set(product.brandId, (brandMap.get(product.brandId) || 0) + lineRevenue);
                    }
                });
            }
        });
        return Array.from(brandMap.entries())
            .map(([id, rev]) => ({
                id,
                type: 'BRAND',
                name: brands.find(b => b.id === id)?.name || 'Hãng khác',
                value: rev
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [filteredContracts, products, brands]);

    // 8. Product Category Distribution
    const productCategoryData = useMemo(() => {
        const catMap = new Map<string, number>();
        filteredContracts.forEach(c => {
            if (c.lineItems && Array.isArray(c.lineItems)) {
                c.lineItems.forEach((li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    const cat = product?.category || 'Chưa phân loại';
                    const proportion = c.value > 0 ? ((li.outputPrice || 0) * (li.quantity || 1)) / c.value : 0;
                    const allocatedRevenue = (c.actualRevenue || 0) * proportion;
                    catMap.set(cat, (catMap.get(cat) || 0) + allocatedRevenue);
                });
            }
        });
        return Array.from(catMap.entries())
            .map(([name, value]) => ({
                id: name,
                type: 'CATEGORY',
                name,
                value
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [filteredContracts, products]);

    // 9. Payment Status / Debt (Rủi ro dòng tiền)
    const paymentStatusData = useMemo(() => {
        let paid = 0;
        let invoiceIssuedNotPaid = 0;
        let notInvoiced = 0;

        filteredContracts.forEach(c => {
            const actualRev = c.actualRevenue || 0;
            const cashed = c.cashReceived || 0;
            const invoiced = c.invoicedAmount || 0;

            paid += cashed;

            // Số tiền đã xuất HĐ nhưng chưa thu (có thể cashed lại nhỏ hơn vì cấn trừ tạm ứng)
            const unpaidInvoice = Math.max(0, invoiced - cashed);
            invoiceIssuedNotPaid += unpaidInvoice;

            // Số tiền doanh thu thực tế chưa lên HĐ
            const unbilled = Math.max(0, actualRev - Math.max(cashed, invoiced));
            notInvoiced += unbilled;
        });

        return [
            { name: 'Đã thanh toán', value: paid, color: '#10b981' },
            { name: 'Đã X.HĐ (Chờ thu)', value: invoiceIssuedNotPaid, color: '#f59e0b' },
            { name: 'Chưa X.HĐ', value: notInvoiced, color: '#ef4444' }
        ].filter(d => d.value > 0);
    }, [filteredContracts]);

    // 10. Top Employees (Sales Performance)
    const topEmployeesData = useMemo(() => {
        const empMap = new Map<string, number>();
        filteredContracts.forEach(c => {
            const rev = c.actualRevenue || 0;
            if (rev > 0) {
                // Determine the primary sales person or allocate
                const empId = c.salespersonId;
                if (empId) {
                    empMap.set(empId, (empMap.get(empId) || 0) + rev);
                }
            }
        });
        return Array.from(empMap.entries())
            .map(([id, rev]) => ({
                id,
                type: 'EMPLOYEE',
                name: employees.find(e => e.id === id)?.name || 'Không xác định',
                value: rev
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // top 5
    }, [filteredContracts, employees]);

    // 11. Brand Profitability Margin
    const brandProfitabilityData = useMemo(() => {
        const brandMap = new Map<string, { rev: number, profit: number }>();
        filteredContracts.forEach(c => {
            if (c.lineItems && Array.isArray(c.lineItems)) {
                c.lineItems.forEach((li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    if (product && product.brandId) {
                        const proportion = c.value > 0 ? ((li.outputPrice || 0) * (li.quantity || 1)) / c.value : 0;
                        const allocatedRevenue = (c.actualRevenue || 0) * proportion;
                        const allocatedProfit = ((c.adminProfit || 0) + (c.revProfit || 0)) * proportion; // tổng LN gộp

                        const current = brandMap.get(product.brandId) || { rev: 0, profit: 0 };
                        brandMap.set(product.brandId, {
                            rev: current.rev + allocatedRevenue,
                            profit: current.profit + allocatedProfit
                        });
                    }
                });
            }
        });
        return Array.from(brandMap.entries())
            .map(([id, data]) => {
                const margin = data.rev > 0 ? (data.profit / data.rev) * 100 : 0;
                return {
                    id,
                    type: 'BRAND',
                    name: brands.find(b => b.id === id)?.name || 'Hãng khác',
                    value: margin,
                    revenue: data.rev // keep revenue for tooltip info
                };
            })
            .filter(d => d.revenue > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [filteredContracts, products, brands]);

    const formatCurrency = (val: number) => {
        const abs = Math.abs(val);
        const sign = val < 0 ? '-' : '';
        if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)} tỷ`;
        if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)} triệu`;
        return `${val}`;
    };

    const formatCurrencyCompact = (val: number) => {
        if (val >= 1000000000) return (val / 1000000000).toFixed(1) + ' tỷ';
        if (val >= 1000000) return (val / 1000000).toFixed(1) + ' tr';
        return new Intl.NumberFormat('vi-VN').format(val);
    };

    const renderHoverTable = (data: any) => {
        let matches: Contract[] = [];
        if (data.type === 'CUSTOMER') {
            matches = filteredContracts.filter(c => c.customerId === data.id);
        } else if (data.type === 'BRAND') {
            matches = filteredContracts.filter(c =>
                c.lineItems?.some((li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    return product?.brandId === data.id;
                })
            );
        } else if (data.type === 'EMPLOYEE') {
            matches = filteredContracts.filter(c => c.salespersonId === data.id);
        } else if (data.type === 'CATEGORY') {
            matches = filteredContracts.filter(c =>
                c.lineItems?.some((li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    return (product?.category || 'Chưa phân loại') === data.name;
                })
            );
        }

        if (matches.length === 0) return null;

        return (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">Chi tiết Hợp đồng ({matches.length}):</p>
                <div className="space-y-1.5 min-w-[440px] max-h-[200px] overflow-y-auto pr-2 select-text pointer-events-auto styled-scrollbar">
                    {matches.map(c => (
                        <Link
                            key={c.id}
                            to={`/?contractId=${c.id}`}
                            className="flex justify-between items-center text-[13px] gap-4 hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-2 -mx-2 py-1.5 transition-all text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 group"
                        >
                            <span className="truncate max-w-[320px] font-medium" title={c.title}>
                                {c.contractCode} - {c.title}
                            </span>
                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400 shrink-0">
                                {formatCurrencyCompact(c.actualRevenue || 0)}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        );
    };


    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div
                    style={getTooltipStyle()}
                    className="rounded-xl shadow-xl p-5 border max-w-xl w-[500px] z-50 pointer-events-auto"
                >
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">{label || data.name}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm font-black flex justify-between gap-4" style={{ color: entry.color }}>
                            <span>{entry.name}:</span>
                            <span>{formatCurrency(entry.value)}</span>
                        </p>
                    ))}
                    {data.type && renderHoverTable(data)}
                </div>
            );
        }
        return null;
    };


    const pieTotal = useMemo(() => structureData.reduce((s, d) => s + d.value, 0), [structureData]);

    if (isLoading) return <AnalyticsSkeleton />;

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-gray-100 flex items-center gap-2">
                        <Activity className="text-indigo-600 dark:text-indigo-400" />
                        Báo cáo Quản trị (BI)
                    </h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                        Trung tâm theo dõi và phân tích hiệu quả kinh doanh
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    {/* Unit Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUnitSelector(!showUnitSelector)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:border-orange-500 dark:hover:border-orange-500 transition-colors cursor-pointer"
                        >
                            <Building2 size={18} className="text-slate-400 dark:text-slate-500" />
                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{safeUnit.name}</span>
                            <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" />
                        </button>
                        {showUnitSelector && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowUnitSelector(false)} />
                                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl z-20 overflow-hidden">
                                    {(visibleUnits === 'all' || visibleUnits.length > 1) && (
                                        <button onClick={() => { onSelectUnit({ id: 'all', name: 'Toàn công ty', type: 'Company' } as Unit); setShowUnitSelector(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm text-slate-700 dark:text-slate-200 transition-colors">Toàn công ty</button>
                                    )}
                                    {units.filter(u => u.name !== 'Toàn công ty' &&
                                        (u.type === 'Center' || u.type === 'Branch') &&
                                        (visibleUnits === 'all' || visibleUnits.includes(u.id))
                                    ).sort((a, b) => a.name.localeCompare(b.name, 'vi')).map(u => (
                                        <button key={u.id} onClick={() => { onSelectUnit(u); setShowUnitSelector(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm text-slate-700 dark:text-slate-200 transition-colors">{u.name}</button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Year Selector */}
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                        <Calendar size={18} className="text-slate-400 dark:text-slate-500" />
                        <select
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            className="bg-transparent font-bold text-sm text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer appearance-none pr-4"
                        >
                            <option value="All">Tất cả</option>
                            {availableYears.map(y => <option key={y} value={y}>Năm {y}</option>)}
                        </select>
                    </div>

                    <button className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors cursor-pointer border border-orange-100 dark:border-orange-900/30">
                        <Download size={18} />
                        <span className="text-sm font-bold hidden sm:inline">Xuất báo cáo</span>
                    </button>
                </div>
            </div>

            {/* ═══ KPI Summary Cards ═══ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Tổng Doanh thu"
                    value={kpiData.totalRevenue}
                    icon={<CreditCard size={20} />}
                    color="emerald"
                    index={0}
                />
                <KPICard
                    title="Lợi nhuận QT"
                    value={kpiData.totalProfit}
                    icon={<TrendingUp size={20} />}
                    color="purple"
                    index={1}
                />
                <KPICard
                    title="Số Hợp đồng"
                    value={kpiData.contractCount}
                    icon={<FileText size={20} />}
                    color="indigo"
                    index={2}
                />
                <KPICard
                    title="Hoàn thành KH"
                    value={kpiData.completionRate}
                    icon={<Target size={20} />}
                    color="amber"
                    change={{ value: kpiData.completionRate.toFixed(1), isUp: kpiData.completionRate >= 50 }}
                    index={3}
                />
            </div>

            {/* ═══ Top Charts Row ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Revenue Structure — Donut */}
                <ChartCard
                    title={`Cơ cấu Doanh thu ${selectedUnit.id === 'all' ? '(Theo Đơn vị)' : '(Theo Nhân sự)'}`}
                    subtitle="Tỷ trọng đóng góp vào tổng doanh thu"
                    index={0}
                >
                    {structureData.length === 0 ? (
                        <EmptyState message="Chưa có dữ liệu doanh thu" />
                    ) : (
                        <>
                            <div className="h-[280px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={structureData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={70}
                                            outerRadius={95}
                                            paddingAngle={4}
                                            dataKey="value"
                                            cornerRadius={6}
                                        >
                                            {structureData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={getChartColors()[index % getChartColors().length]} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Center label */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <p className="text-[10px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest">Tổng</p>
                                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{formatCurrencyGlobal(pieTotal)}</p>
                                </div>
                            </div>
                            {/* Custom Legend */}
                            <div className="mt-4 space-y-2.5">
                                {structureData.slice(0, 5).map((d, i) => (
                                    <div key={i} className="flex items-center justify-between group cursor-default">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-md transition-transform group-hover:scale-125" style={{ backgroundColor: getChartColors()[i % getChartColors().length] }} />
                                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 truncate max-w-[160px]">{d.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{pieTotal > 0 ? ((d.value / pieTotal) * 100).toFixed(1) : '0'}%</span>
                                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (d.value / (Math.max(...structureData.map(x => x.value)) || 1)) * 100)}%`, backgroundColor: getChartColors()[i % getChartColors().length] }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </ChartCard>

                {/* 2. Plan vs Actual */}
                <ChartCard
                    title="Kế hoạch vs Thực tế"
                    subtitle="So sánh doanh thu thực tế với mục tiêu đặt ra"
                    index={1}
                >
                    {planVsActualData.length === 0 ? (
                        <EmptyState message="Chưa có dữ liệu kế hoạch" />
                    ) : (
                        <div className="h-[340px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={planVsActualData} barCategoryGap={20}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }} />
                                    <Legend wrapperStyle={{ paddingTop: '16px', fontWeight: 700, fontSize: '12px' }} />
                                    <Bar dataKey="Actual" name="Thực tế" fill={getAccentColor()} radius={[6, 6, 0, 0]} barSize={32} />
                                    <Bar dataKey="Target" name="Kế hoạch" fill={getMutedBarFill()} radius={[6, 6, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </ChartCard>
            </div>

            {/* ═══ 3. Monthly Trend ═══ */}
            <ChartCard
                title="Xu hướng theo tháng"
                subtitle="Biến động Doanh thu & Lợi nhuận hàng tháng"
                index={2}
            >
                <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyTrendData}>
                            <defs>
                                <linearGradient id="colorRevAnalytics" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={getAccentColor()} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={getAccentColor()} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorProfitAnalytics" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }} />
                            <Legend wrapperStyle={{ paddingTop: '16px', fontWeight: 700, fontSize: '12px' }} />
                            <Area type="monotone" dataKey="DoanhThu" name="Doanh thu" stroke={getAccentColor()} strokeWidth={3} fillOpacity={1} fill="url(#colorRevAnalytics)" activeDot={{ r: 5, strokeWidth: 2 }} />
                            <Area type="monotone" dataKey="LoiNhuan" name="Lợi nhuận" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfitAnalytics)" activeDot={{ r: 5, strokeWidth: 2 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            {/* ═══ 4. Cashflow ═══ */}
            <ChartCard
                title="Dòng tiền Thu – Chi"
                subtitle="Phân tích luồng tiền vào/ra hàng tháng"
                index={3}
            >
                <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={cashflowData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }} />
                            <Legend wrapperStyle={{ paddingTop: '16px', fontWeight: 700, fontSize: '12px' }} />
                            <Bar dataKey="Thu" name="Dòng tiền vào" fill="#10b981" radius={[6, 6, 0, 0]} barSize={28} />
                            <Bar dataKey="Chi" name="Dòng tiền ra" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={28} />
                            <Line type="monotone" dataKey="Rong" name="Dòng tiền ròng" stroke="#0ea5e9" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: '#0ea5e9' }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            {/* ═══ Customer & Product Insights ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Customers */}
                <ChartCard title="Top Khách hàng" subtitle="Hàng đầu theo Danh thu" index={4}>
                    {topCustomersData.length === 0 ? <EmptyState message="Chưa có dữ liệu khách hàng" /> : (
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topCustomersData} layout="vertical" margin={{ left: -10, top: 10, bottom: 0, right: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={getGridStroke()} />
                                    <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={100} tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }} />
                                    <Bar
                                        dataKey="value"
                                        name="Doanh thu"
                                        fill="#f97316"
                                        radius={[0, 4, 4, 0]}
                                        barSize={16}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {topCustomersData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa'][index]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </ChartCard>

                {/* Top Brands */}
                <ChartCard title="Top Hãng / Đối tác" subtitle="Đóng góp nhiều doanh thu nhất" index={5}>
                    {topBrandsData.length === 0 ? <EmptyState message="Chưa có dữ liệu hãng" /> : (
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topBrandsData} layout="vertical" margin={{ left: -10, top: 10, bottom: 0, right: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={getGridStroke()} />
                                    <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={80} tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }} />
                                    <Bar
                                        dataKey="value"
                                        name="Doanh thu"
                                        fill="#0ea5e9"
                                        radius={[0, 4, 4, 0]}
                                        barSize={16}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {topBrandsData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'][index]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </ChartCard>

                {/* Categories */}
                <ChartCard title="Nhóm Sản Phẩm" subtitle="Tỷ trọng doanh thu theo nhóm" index={6}>
                    {productCategoryData.length === 0 ? <EmptyState message="Chưa có dữ liệu sản phẩm" /> : (
                        <div className="h-[300px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                                    <Pie
                                        data={productCategoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={4}
                                        dataKey="value"
                                        cornerRadius={4}
                                    >
                                        {productCategoryData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#f43f5e'][index % 7]} strokeWidth={0} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }} />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={60}
                                        content={(props) => {
                                            return (
                                                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 px-2">
                                                    {props.payload?.map((entry, index) => (
                                                        <div key={`item-${index}`} className="flex items-center gap-1.5 min-w-fit">
                                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 capitalize whitespace-nowrap">{entry.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </ChartCard>
            </div>

            {/* ═══ Advanced Insights Row (Payment, Sales, Profitability) ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Payment Status / Cash Risk */}
                <ChartCard title="Tiến độ Thanh toán" subtitle="Tình trạng thu hồi doanh thu thực tế" index={7}>
                    {paymentStatusData.length === 0 ? <EmptyState message="Chưa có dữ liệu thanh toán" /> : (
                        <div className="h-[250px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                                    <Pie
                                        data={paymentStatusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={75}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {paymentStatusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }} />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={40}
                                        content={(props) => (
                                            <div className="flex flex-wrap justify-center gap-4 mt-2">
                                                {props.payload?.map((entry, index) => (
                                                    <div key={`item-${index}`} className="flex items-center gap-1.5 focus:outline-none">
                                                        <div className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: entry.color, borderRadius: '4px' }} />
                                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{entry.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </ChartCard>

                {/* Top Sales Employees */}
                <ChartCard title="Hiệu suất Nhân sự" subtitle="Top Doanh số theo Nhân viên" index={8}>
                    {topEmployeesData.length === 0 ? <EmptyState message="Chưa có dữ liệu sales" /> : (
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topEmployeesData} layout="vertical" margin={{ left: -10, top: 10, bottom: 0, right: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={getGridStroke()} />
                                    <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={90} tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }} />
                                    <Bar
                                        dataKey="value"
                                        name="Doanh số"
                                        fill="#3b82f6"
                                        radius={[0, 4, 4, 0]}
                                        barSize={16}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {topEmployeesData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'][index]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </ChartCard>

                {/* Profitability Margin by Brand */}
                <ChartCard title="Tỷ suất Lợi nhuận" subtitle="Top biên lợi nhuận (%) theo Hãng" index={9}>
                    {brandProfitabilityData.length === 0 ? <EmptyState message="Chưa có dữ liệu lợi nhuận" /> : (
                        <div className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={brandProfitabilityData} margin={{ left: -20, top: 10, bottom: 0, right: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} stroke={getGridStroke()} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10, fontWeight: 600 }} />
                                    <YAxis type="number" domain={[0, 'dataMax + 10']} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} tick={{ fill: '#64748b', fontSize: 10 }} />
                                    <Tooltip
                                        cursor={{ fill: getCursorFill() }}
                                        wrapperStyle={{ zIndex: 100, pointerEvents: 'auto' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div style={getTooltipStyle()} className="rounded-lg shadow-xl p-3 border">
                                                        <p className="text-xs font-bold text-slate-500 mb-1">{data.name}</p>
                                                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                            Biên lợi nhuận: {data.value.toFixed(1)}%
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            (Doanh thu DT: {formatCurrency(data.revenue)})
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar
                                        dataKey="value"
                                        name="Biên LN (%)"
                                        fill="#10b981"
                                        radius={[4, 4, 0, 0]}
                                        barSize={36}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </ChartCard>
            </div>

            {/* ═══ 5. Historical Comparison YoY ═══ */}
            {historicalComparisonData.length > 0 && (
                <ChartCard
                    title="So sánh Cùng kỳ (Lịch sử)"
                    subtitle="Theo dõi sự tăng trưởng qua các năm"
                    index={4}
                >
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={historicalComparisonData} barCategoryGap={25}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13, fontWeight: 700 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: getCursorFill() }} wrapperStyle={{ pointerEvents: 'auto', zIndex: 100 }} />
                                <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 700, fontSize: '12px' }} />
                                <Bar dataKey="Ký kết" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={24} />
                                <Bar dataKey="Doanh thu" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24} />
                                <Bar dataKey="LNG QT" fill="#a855f7" radius={[6, 6, 0, 0]} barSize={24} />
                                <Bar dataKey="LNG DT" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            )}
        </div>
    );
};

export default Analytics;
