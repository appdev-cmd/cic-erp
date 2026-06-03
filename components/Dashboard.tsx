
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Line,
  Area,
  ComposedChart,
} from 'recharts';
import OnlineUsers from './dashboard/OnlineUsers';
import TaskDashboardWidget from './tasks/TaskDashboardWidget';
import {
  FileText,
  CreditCard,
  Target,
  Users,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  Zap,
  ShieldCheck,
  Loader2,
  Building2,
  PackageCheck,
  Download
} from 'lucide-react';
import { Skeleton } from './ui/Skeleton';
import ErrorBoundary from './ErrorBoundary';
import { exportDashboardReport } from '../utils/dashboardExport';
import { ContractService, UnitService, EmployeeService, HistoricalProductionService } from '../services';
import { CompanyTargetService, CompanyTarget } from '../services/companyTargetService';
import { Unit, KPIPlan, Contract, HistoricalProduction } from '../types';
import { getSmartInsights as getSmartInsightsWithDeepSeek } from '../services/ai';
import { getChartColors, getAccentColor, getAccentColorLight, getTooltipStyle, getGridStroke, getCursorFill, getMutedBarFill, isDarkTheme } from '../lib/themeColors';
import { useCurrentUserVisibleUnits } from '../hooks';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { useAuth } from '../contexts/AuthContext';

interface DashboardProps {
  selectedUnit: Unit;
  onSelectUnit: (unit: Unit) => void;
  onSelectContract: (id: string) => void;
  onSelectEmployee?: (id: string) => void;
  onSelectPerformanceUnit?: (id: string) => void;
  yearFilter: string;
  periodFilter?: string;
}



const DashboardSkeleton = () => (
  <div className="space-y-8 animate-pulse p-6">
    <div className="flex flex-col xl:flex-row justify-between gap-6">
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-24 rounded-lg" />)}
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-32 rounded-lg" />)}
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Skeleton className="xl:col-span-2 h-[400px] rounded-lg" />
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ selectedUnit, onSelectUnit, onSelectContract, onSelectEmployee, onSelectPerformanceUnit, yearFilter, periodFilter }) => {
  const navigate = useNavigate();
  const [activeMetric, setActiveMetric] = useState<keyof KPIPlan>('signing');
  const [previousYear, setPreviousYear] = useState<string>((new Date().getFullYear() - 1).toString());

  // Cross-unit visibility
  const { visibleUnits } = useCurrentUserVisibleUnits();
  const { profile } = useAuth();
  const { impersonatedUser, isImpersonating } = useImpersonation();

  // Determine if we're viewing a unit that isn't the user's own unit
  // In that case, hide individual employee performance details for privacy
  const effectiveProfile = isImpersonating && impersonatedUser ? impersonatedUser : profile;
  const effectiveRole = effectiveProfile?.role;
  const GLOBAL_ROLES = ['Admin', 'Leadership', 'Legal', 'Accountant', 'ChiefAccountant'];
  const isGlobalRole = effectiveRole && GLOBAL_ROLES.includes(effectiveRole);
  const isViewingForeignUnit = !isGlobalRole && selectedUnit?.id !== 'all' && selectedUnit?.id !== effectiveProfile?.unitId;

  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Data State for RPCs
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Dashboard Metrics
  const [stats, setStats] = useState({
    actual: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 },
    statusCounts: { processing: 0, suspended: 0, cancelled: 0, handover: 0, acceptance: 0, completed: 0 }
  });

  // Chỉ tiêu ĐHCĐ cấp công ty
  const [companyTarget, setCompanyTarget] = useState<CompanyTarget | null>(null);

  // Chart Data
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [chartDataCurrent, setChartDataCurrent] = useState<any[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalProduction[]>([]);
  const [monthlyHistLast, setMonthlyHistLast] = useState<HistoricalProduction[]>([]);
  const [monthlyHistPrev, setMonthlyHistPrev] = useState<HistoricalProduction[]>([]);

  // Distribution Data
  const [distributionData, setDistributionData] = useState<any[]>([]);

  // Performance Table
  const [performanceTableData, setPerformanceTableData] = useState<any[]>([]);
  const [rawDistData, setRawDistData] = useState<any[]>([]); // Store raw data for local re-calc

  // Recent Activity (Light Fetch)
  const [recentContracts, setRecentContracts] = useState<Contract[]>([]);

  // Realtime: silent refresh counter — incremented by realtime events to re-trigger data fetch
  const [realtimeRefreshCounter, setRealtimeRefreshCounter] = useState(0);
  const hasRunAutoTransitions = useRef(false);
  useEffect(() => {
    const handleRealtimeRefresh = () => {
      setRealtimeRefreshCounter(c => c + 1);
    };
    window.addEventListener('contract-changed', handleRealtimeRefresh);
    window.addEventListener('payment-changed', handleRealtimeRefresh);
    window.addEventListener('employee-target-changed', handleRealtimeRefresh);
    return () => {
      window.removeEventListener('contract-changed', handleRealtimeRefresh);
      window.removeEventListener('payment-changed', handleRealtimeRefresh);
      window.removeEventListener('employee-target-changed', handleRealtimeRefresh);
    };
  }, []);


  // Update Previous Year when year filter changes
  useEffect(() => {
    if (yearFilter !== 'All') {
      setPreviousYear((parseInt(yearFilter) - 1).toString());
    }
  }, [yearFilter]);

  // Main Data Fetch Effect - SIMPLIFIED VERSION
  useEffect(() => {
    console.log('[Dashboard] Main fetch effect triggered, selectedUnit:', selectedUnit?.id);
    let isCancelled = false;

    const fetchDashboardData = async () => {
      console.log('[Dashboard] fetchDashboardData starting...');
      // Only show loading on initial load, not realtime refetches
      const isRealtimeRefresh = hasRunAutoTransitions.current;
      if (!isRealtimeRefresh) setLoadingConfig(true);

      const unitId = selectedUnit ? selectedUnit.id : 'all';
      const year = yearFilter;
      const prevYear = yearFilter === 'All' ? 'All' : (parseInt(yearFilter) - 1).toString();

      console.log('[Dashboard] Fetching with:', {
        unitId,
        year,
        periodFilter,
        typeUnitId: typeof unitId,
        typeYear: typeof year
      });

      // STEP 0: Auto-check status transitions
      if (!hasRunAutoTransitions.current) {
        try {
          console.log('[Dashboard] Step 0: Auto-checking status transitions...');
          const autoResult = await ContractService.checkAutoStatusTransitions();
          if (autoResult.updated > 0) {
            console.log(`[Dashboard] Auto-transitions: ${autoResult.updated} contracts updated`, autoResult.details);
          }
        } catch (error) {
          console.warn('[Dashboard] Step 0 failed (non-critical):', error);
        } finally {
          hasRunAutoTransitions.current = true;
        }
      }

      // STEP 1: Fetch Stats
      try {
        console.log('[Dashboard] Step 1: Fetching stats via ContractService...');
        const statsData = await ContractService.getStatsRPC(unitId, year, periodFilter);
        console.log('[Dashboard] Stats received:', statsData);

        if (!isCancelled) {
          setStats({
            actual: {
              signing: Number(statsData?.totalValue) || 0,
              revenue: Number(statsData?.totalRevenue) || 0,
              adminProfit: Number(statsData?.totalSigningProfit) || 0,
              revProfit: Number(statsData?.totalRevenueProfit) || 0,
              cash: Number(statsData?.totalCash) || 0
            },
            statusCounts: {
              processing: Number((statsData as any)?.processingCount) || 0,
              suspended: Number((statsData as any)?.suspendedCount) || 0,
              cancelled: Number((statsData as any)?.cancelledCount) || 0,
              handover: Number((statsData as any)?.handoverCount) || 0,
              acceptance: Number((statsData as any)?.acceptanceCount) || 0,
              completed: Number((statsData as any)?.completedCount) || 0
            }
          });
        }
      } catch (error) {
        console.error("[Dashboard] Step 1 Data Fetch Error:", error);
        if (!isCancelled) {
          setStats({
            actual: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 },
            statusCounts: { processing: 0, suspended: 0, cancelled: 0, handover: 0, acceptance: 0, completed: 0 }
          });
        }
      }

      // STEP 2: Fetch Chart Data
      try {
        console.log('[Dashboard] Step 2: Fetching chart data...');
        const chartCurrent = await ContractService.getChartDataRPC(unitId, year);
        if (!isCancelled) setChartDataCurrent(chartCurrent || []);
      } catch (error) {
        console.warn("[Dashboard] Step 2 Chart Fetch Error:", error);
        if (!isCancelled) setChartDataCurrent([]);
      }

      // STEP 3: Fetch Historical Data
      try {
        console.log('[Dashboard] Step 3: Fetching historical data...');
        let hist: HistoricalProduction[] = [];
        if (unitId === 'all') {
          const allHist = await HistoricalProductionService.getAll();
          const yearMap: Record<number, HistoricalProduction> = {};
          allHist.forEach(h => {
            if (!yearMap[h.year]) {
              yearMap[h.year] = { unitId: 'all', year: h.year, signing: 0, revenue: 0, adminProfit: 0, revProfit: 0 };
            }
            yearMap[h.year].signing += h.signing;
            yearMap[h.year].revenue += h.revenue;
            yearMap[h.year].adminProfit += h.adminProfit;
            yearMap[h.year].revProfit += h.revProfit;
          });
          hist = Object.values(yearMap);
        } else {
          hist = await HistoricalProductionService.getByUnit(unitId);
        }
        if (!isCancelled) setHistoricalData(hist);
      } catch (error) {
        console.warn("[Dashboard] Step 3 Historical Fetch Error:", error);
        if (!isCancelled) setHistoricalData([]);
      }

      // STEP 3.5: Fetch Monthly Historical Data for chart zig-zag lines
      try {
        const currentYearNum = year === 'All' ? new Date().getFullYear() : parseInt(year);
        const lastYearNum = currentYearNum - 1;
        const prevPrevYearNum = currentYearNum - 2;

        const fetchMonthlyFor = async (yr: number): Promise<HistoricalProduction[]> => {
          if (unitId === 'all') {
            const all = await HistoricalProductionService.getMonthlyByYear(yr);
            // Aggregate monthly data across all units
            const monthMap: Record<number, HistoricalProduction> = {};
            all.forEach(h => {
              const m = h.month!;
              if (!monthMap[m]) {
                monthMap[m] = { unitId: 'all', year: yr, month: m, signing: 0, revenue: 0, adminProfit: 0, revProfit: 0 };
              }
              monthMap[m].signing += h.signing;
              monthMap[m].revenue += h.revenue;
              monthMap[m].adminProfit += h.adminProfit;
              monthMap[m].revProfit += h.revProfit;
            });
            return Object.values(monthMap);
          } else {
            return HistoricalProductionService.getMonthlyByYearAndUnit(yr, unitId);
          }
        };

        const mLast = await fetchMonthlyFor(lastYearNum);
        const mPrev = await fetchMonthlyFor(prevPrevYearNum);
        if (!isCancelled) {
          setMonthlyHistLast(mLast);
          setMonthlyHistPrev(mPrev);
        }
      } catch (error) {
        console.warn("[Dashboard] Step 3.5 Monthly Historical Fetch Error:", error);
      }

      // STEP 4: Fetch Distribution Data
      try {
        console.log('[Dashboard] Step 4: Fetching distribution...');
        let distData: any[] = [];
        const yearParam = yearFilter === 'All' ? null : parseInt(yearFilter);
        if (unitId === 'all') {
          distData = await UnitService.getWithStats(yearParam, periodFilter);
        } else {
          distData = await EmployeeService.getWithStats(unitId, undefined, yearParam, periodFilter);
        }
        if (!isCancelled) setRawDistData(distData || []);
      } catch (error) {
        console.warn("[Dashboard] Step 4 Distribution Fetch Error:", error);
        if (!isCancelled) setRawDistData([]);
      }

      // STEP 6: Fetch Recent Contracts
      try {
        console.log('[Dashboard] Step 6: Fetching recent contracts...');
        const recent = await ContractService.search('', 5);
        if (!isCancelled) {
          setRecentContracts(recent || []);
          if (recent.length > 0) {
            fetchAI(recent);
          }
        }
      } catch (error) {
        console.warn("[Dashboard] Step 6 Recent Contracts Fetch Error:", error);
        if (!isCancelled) setRecentContracts([]);
      }

      // STEP 7: Fetch Company Target (ĐHCĐ) — only when viewing whole company
      if (unitId === 'all' && year !== 'All') {
        try {
          const ct = await CompanyTargetService.getByYear(parseInt(year));
          if (!isCancelled) setCompanyTarget(ct);
        } catch (error) {
          console.warn('[Dashboard] Step 7 Company Target Fetch Error:', error);
          if (!isCancelled) setCompanyTarget(null);
        }
      } else {
        if (!isCancelled) setCompanyTarget(null);
      }

      console.log('[Dashboard] All data loaded successfully!');
      if (!isCancelled) setLoadingConfig(false);
    };

    fetchDashboardData();

    return () => { isCancelled = true; };
  }, [selectedUnit, yearFilter, periodFilter, realtimeRefreshCounter]); // Always fetch when these change or on realtime events

  // Local effect to recalculate Performance/Pie data when activeMetric changes or data updates
  useEffect(() => {
    if (!rawDistData.length) return;

    const unitId = selectedUnit ? selectedUnit.id : 'all';
    let perfData: any[] = [];

    if (unitId === 'all') {
      // For All Units: map raw unit data (exclude non-business units)
      const businessUnits = rawDistData.filter((u: any) => u.type === 'Center' || u.type === 'Branch');
      perfData = businessUnits.map(u => ({
        id: u.id,
        name: u.name,
        subText: u.type === 'Branch' ? 'Chi nhánh' : 'Trung tâm',
        target: activeMetric === 'signing' ? (u.target?.signing || 0)
          : activeMetric === 'revenue' ? (u.target?.revenue || 0)
            : activeMetric === 'adminProfit' ? (u.target?.adminProfit || 0)
              : activeMetric === 'revProfit' ? (u.target?.revProfit || 0)
                : (u.target?.cash || 0),
        actual: activeMetric === 'signing' ? (u.stats?.totalSigning || 0)
          : activeMetric === 'revenue' ? (u.stats?.totalRevenue || 0)
            : activeMetric === 'adminProfit' ? (u.stats?.totalProfit || 0)
              : activeMetric === 'revProfit' ? (u.stats?.totalRevenueProfit || 0)
                : (u.stats?.totalCash || 0),
        // Progress based on target vs actual for active metric
        progress: (activeMetric === 'signing' ? (u.target?.signing || 0) :
          activeMetric === 'revenue' ? (u.target?.revenue || 0) :
            activeMetric === 'adminProfit' ? (u.target?.adminProfit || 0) :
              activeMetric === 'revProfit' ? (u.target?.revProfit || 0) :
                (u.target?.cash || 0)) ?
          Math.round(
            (activeMetric === 'signing' ? (u.stats?.totalSigning || 0) :
              activeMetric === 'revenue' ? (u.stats?.totalRevenue || 0) :
                activeMetric === 'adminProfit' ? (u.stats?.totalProfit || 0) :
                  activeMetric === 'revProfit' ? (u.stats?.totalRevenueProfit || 0) :
                    (u.stats?.totalCash || 0)) /
            (activeMetric === 'signing' ? (u.target?.signing || 0) :
              activeMetric === 'revenue' ? (u.target?.revenue || 0) :
                activeMetric === 'adminProfit' ? (u.target?.adminProfit || 0) :
                  activeMetric === 'revProfit' ? (u.target?.revProfit || 0) :
                    (u.target?.cash || 0))
            * 100) : 0,
        // Pie Chart Value: Dynamic based on activeMetric
        value: activeMetric === 'signing' ? (u.stats?.totalSigning || 0)
          : activeMetric === 'revenue' ? (u.stats?.totalRevenue || 0)
            : activeMetric === 'adminProfit' ? (u.stats?.totalProfit || 0)
              : activeMetric === 'revProfit' ? (u.stats?.totalRevenueProfit || 0)
                : (u.stats?.totalCash || 0)
      }));

      // Khi xem Toàn công ty: hiện tất cả đơn vị (dữ liệu cấp đơn vị không bảo mật)
      // Chỉ ẩn chi tiết cá nhân khi xem đơn vị khác
    } else {
      // For Specific Unit: map employee data
      perfData = rawDistData.map(e => ({
        id: e.id,
        slug: e.slug || e.id,
        name: e.name,
        subText: e.employeeCode || 'NVKD',
        avatar: e.avatar || '',
        target: activeMetric === 'signing' ? (e.target?.signing || 0)
          : activeMetric === 'revenue' ? (e.target?.revenue || 0)
            : activeMetric === 'adminProfit' ? (e.target?.adminProfit || 0)
              : activeMetric === 'revProfit' ? (e.target?.revProfit || 0)
                : (e.target?.cash || 0),
        actual: activeMetric === 'signing' ? (e.stats?.totalSigning || 0)
          : activeMetric === 'revenue' ? (e.stats?.totalRevenue || 0)
            : activeMetric === 'adminProfit' ? (e.stats?.totalProfit || 0)
              : activeMetric === 'revProfit' ? (e.stats?.totalRevenueProfit || 0)
                : (e.stats?.totalCash || 0),
        progress: (() => {
          const t = activeMetric === 'signing' ? (e.target?.signing || 0)
            : activeMetric === 'revenue' ? (e.target?.revenue || 0)
              : activeMetric === 'adminProfit' ? (e.target?.adminProfit || 0)
                : activeMetric === 'revProfit' ? (e.target?.revProfit || 0)
                  : (e.target?.cash || 0);
          const a = activeMetric === 'signing' ? (e.stats?.totalSigning || 0)
            : activeMetric === 'revenue' ? (e.stats?.totalRevenue || 0)
              : activeMetric === 'adminProfit' ? (e.stats?.totalProfit || 0)
                : activeMetric === 'revProfit' ? (e.stats?.totalRevenueProfit || 0)
                  : (e.stats?.totalCash || 0);
          return t > 0 ? Math.round((a / t) * 100) : 0;
        })(),
        value: activeMetric === 'signing' ? (e.stats?.totalSigning || 0)
          : activeMetric === 'revenue' ? (e.stats?.totalRevenue || 0)
            : activeMetric === 'adminProfit' ? (e.stats?.totalProfit || 0)
              : activeMetric === 'revProfit' ? (e.stats?.totalRevenueProfit || 0)
                : (e.stats?.totalCash || 0)
      }));
    }

    setPerformanceTableData(perfData.sort((a, b) => b.actual - a.actual));
    setDistributionData(perfData.map(p => ({
      name: p.name,
      value: p.value
    })).filter(p => p.value > 0).sort((a, b) => b.value - a.value));

  }, [rawDistData, activeMetric, selectedUnit]);

  // Memoize Monthly Chart Logic — uses monthly historical_production data for zig-zag lines
  useEffect(() => {
    const months = ['Th.1', 'Th.2', 'Th.3', 'Th.4', 'Th.5', 'Th.6', 'Th.7', 'Th.8', 'Th.9', 'Th.10', 'Th.11', 'Th.12'];

    const getContractVal = (d: any) => {
      if (!d) return 0;
      if (activeMetric === 'signing') return d.signing;
      if (activeMetric === 'revenue') return d.revenue;
      if (activeMetric === 'revProfit') return d.revProfit;
      return d.profit;
    };

    const getHistVal = (rec: HistoricalProduction | undefined) => {
      if (!rec) return null;
      let v = 0;
      if (activeMetric === 'signing') v = rec.signing;
      else if (activeMetric === 'revenue') v = rec.revenue;
      else if (activeMetric === 'adminProfit') v = rec.adminProfit;
      else if (activeMetric === 'revProfit') v = rec.revProfit;
      return v * 1_000_000; // convert triệu → VNĐ
    };

    const mapped = months.map((m, idx) => {
      const monthNum = idx + 1;
      const curr = chartDataCurrent.find((c: any) => c.month === monthNum);
      const lastRec = monthlyHistLast.find(h => h.month === monthNum);
      const prevRec = monthlyHistPrev.find(h => h.month === monthNum);

      return {
        name: m,
        current: getContractVal(curr),
        lastYearLine: getHistVal(lastRec),
        prevYearLine: getHistVal(prevRec)
      };
    });

    setMonthlyData(mapped);
  }, [chartDataCurrent, monthlyHistLast, monthlyHistPrev, activeMetric]);


  const fetchAI = async (contracts: Contract[]) => {
    setIsLoadingAI(true);
    try {
      // Limit to 5 for AI processing to be fast
      const res = await getSmartInsightsWithDeepSeek(contracts.slice(0, 5));
      if (Array.isArray(res)) setAiInsights(res);
      else setAiInsights([]);
    } catch (e) { setAiInsights([]); }
    setIsLoadingAI(false);
  };

  const formatCurrency = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} tỷ`;
    if (abs >= 1e6) return `${sign}${Math.round(abs / 1e6)} triệu`;
    if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}K`;
    return Math.round(val).toString();
  };

  const handleExportReport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportDashboardReport(activeMetric, yearFilter);
      toast.success('Đã tải xuống báo cáo thành công!');
    } catch (error) {
      toast.error('Lỗi khi tải xuống báo cáo. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const getYoY = (metric: keyof KPIPlan) => {
    const curr = stats.actual[metric] || 0;
    if (yearFilter === 'All') return { value: '0.0', isUp: true, lastYearTotal: 0 };

    // Determine which months of the previous year to compare against
    let startMonth = 1;
    let endMonth = new Date().getMonth() + 1; // default: YTD (cả năm → so sánh tới tháng hiện tại)

    if (periodFilter) {
      if (periodFilter.startsWith('M')) {
        // Tháng cụ thể: so sánh cùng tháng năm ngoái
        const m = parseInt(periodFilter.substring(1));
        startMonth = m;
        endMonth = m;
      } else if (periodFilter.startsWith('Q')) {
        // Quý cụ thể: so sánh cùng quý năm ngoái
        const q = parseInt(periodFilter.substring(1));
        startMonth = (q - 1) * 3 + 1;
        endMonth = q * 3;
      }
    }

    // Use monthlyHistLast (already loaded monthly data for previous year)
    const samePeriodData = monthlyHistLast.filter(
      h => h.month != null && h.month >= startMonth && h.month <= endMonth
    );

    let lastYearVal = 0;
    if (samePeriodData.length > 0) {
      lastYearVal = samePeriodData.reduce((sum, h) => sum + (h[metric] || 0), 0);
    } else {
      // Fallback: use annual aggregate from historicalData (only when viewing full year)
      if (!periodFilter) {
        const currentYear = parseInt(yearFilter);
        const lastYear = currentYear - 1;
        const lastYearAnnual = historicalData.find(h => h.year === lastYear);
        if (lastYearAnnual) {
          lastYearVal = lastYearAnnual[metric] || 0;
        }
      }
    }

    if (lastYearVal === 0) return { value: '0.0', isUp: true, lastYearTotal: 0 };

    // Convert millions to actual VND for calculation
    const trueLastYearVal = lastYearVal * 1_000_000;
    const growth = ((curr - trueLastYearVal) / trueLastYearVal) * 100;

    return { value: Math.abs(growth).toFixed(1), isUp: growth >= 0, lastYearTotal: trueLastYearVal };
  };

  // Safe Unit for Display
  const safeUnit: Unit = selectedUnit || {
    id: 'all',
    name: 'Công ty',
    type: 'Company',
    code: 'CIC',
    target: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 }
  };

  // Khi xem toàn công ty: cộng dồn chỉ tiêu từ các đơn vị
  // Khi xem đơn vị cụ thể: dùng chỉ tiêu của đơn vị đó
  const displayTarget = useMemo(() => {
    if (safeUnit.id === 'all' && rawDistData.length > 0) {
      const sumTarget: any = { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 };
      rawDistData.forEach((u: any) => {
        if (u.id === 'all') return;
        sumTarget.signing += u.target?.signing || 0;
        sumTarget.revenue += u.target?.revenue || 0;
        sumTarget.adminProfit += u.target?.adminProfit || 0;
        sumTarget.cash += u.target?.cash || 0;
      });
      // Chỉ tiêu LNG Doanh thu = Chỉ tiêu LNG Quản trị; cash không có chỉ tiêu
      sumTarget.revProfit = sumTarget.adminProfit;
      sumTarget.cash = 0;
      return sumTarget;
    }
    // Đơn vị cụ thể: revProfit target cũng lấy bằng adminProfit
    const t = safeUnit.target || { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 };
    return { ...t, revProfit: t.adminProfit, cash: 0 };
  }, [safeUnit, rawDistData]);

  // Khi lọc theo tháng/quý: không có kế hoạch KPI, nên ẩn chỉ tiêu + tỷ lệ hoàn thành
  // Chỉ khi xem cả năm (periodFilter rỗng) mới hiển thị kế hoạch năm
  const isFilteringByPeriod = !!periodFilter;
  const effectiveTarget = isFilteringByPeriod
    ? { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 }
    : displayTarget;

  // Chỉ tiêu ĐHCĐ: chỉ hiện khi xem toàn công ty + cả năm (không lọc tháng/quý)
  const effectiveCompanyTarget = (!isFilteringByPeriod && safeUnit.id === 'all' && companyTarget)
    ? CompanyTargetService.toKPIPlan(companyTarget)
    : null;

  if (loadingConfig || !selectedUnit) {
    return <DashboardSkeleton />;
  }

  // Define metric tabs
  const metricTabs = [
    { id: 'signing', label: 'Ký kết' },
    { id: 'revenue', label: 'Doanh thu' },
    { id: 'adminProfit', label: 'LNG QT' },
    { id: 'revProfit', label: 'LNG Doanh thu' },
    { id: 'cash', label: 'Dòng tiền' }
  ];

  return (
    <ErrorBoundary>
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-12">
        {/* HEADER - Title Only */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Tổng quan Quản trị
          </h1>
          <OnlineUsers />
        </div>

        {/* Main KPI Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6">
          <KPIItem title="Ký kết" metric="signing" stats={stats.actual} target={effectiveTarget} companyTarget={effectiveCompanyTarget} yoy={getYoY('signing')} color="indigo" icon={<FileText size={20} />} />
          <KPIItem title="Doanh thu" metric="revenue" stats={stats.actual} target={effectiveTarget} companyTarget={effectiveCompanyTarget} yoy={getYoY('revenue')} color="emerald" icon={<CreditCard size={20} />} />
          <KPIItem title="LNG Quản trị" metric="adminProfit" stats={stats.actual} target={effectiveTarget} companyTarget={effectiveCompanyTarget} yoy={getYoY('adminProfit')} color="purple" icon={<TrendingUp size={20} />} />
          <KPIItem title="LNG Doanh thu" metric="revProfit" stats={stats.actual} target={effectiveTarget} companyTarget={effectiveCompanyTarget} yoy={getYoY('revProfit')} color="amber" icon={<Target size={20} />} />
          <KPIItem title="Dòng tiền" metric="cash" stats={stats.actual} target={effectiveTarget} companyTarget={null} yoy={{ value: '0', isUp: true, lastYearTotal: 0 }} color="cyan" icon={<Wallet size={20} />} />
        </div>

        {/* Status Highlights — 6 contract statuses */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatusCard label="Đang thực hiện" count={stats.statusCounts.processing} icon={<Clock size={18} className="text-orange-600 dark:text-orange-400" />} color="orange" />
          <StatusCard label="Tạm dừng" count={stats.statusCounts.suspended} icon={<AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />} color="amber" />
          <StatusCard label="Hủy" count={stats.statusCounts.cancelled} icon={<XCircle size={18} className="text-rose-600 dark:text-rose-400" />} color="rose" />
          <StatusCard label="Bàn giao" count={stats.statusCounts.handover} icon={<PackageCheck size={18} className="text-cyan-600 dark:text-cyan-400" />} color="cyan" />
          <StatusCard label="Nghiệm thu/TL" count={stats.statusCounts.acceptance} icon={<ClipboardList size={18} className="text-blue-600 dark:text-blue-400" />} color="blue" />
          <StatusCard label="Hoàn thành" count={stats.statusCounts.completed} icon={<CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />} color="emerald" />
        </div>

        {/* STICKY FILTER BAR - Metric Tabs */}
        <div className="sticky top-16 z-20 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md py-4 border-b border-slate-200/50 dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto no-scrollbar min-w-0 max-w-full">
              {metricTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveMetric(tab.id as keyof KPIPlan)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${activeMetric === tab.id
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 dark:shadow-orange-500/10'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* EXPORT BUTTON */}
            {['Admin', 'Leadership', 'Accountant', 'ChiefAccountant'].includes(effectiveProfile?.role || '') && selectedUnit?.id === 'all' && (
              <button
                onClick={handleExportReport}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50"
              >
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Xuất Excel
              </button>
            )}
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm dark-card-glow">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mb-2">Biến động theo tháng</h3>
                <p className="text-sm font-medium text-slate-500">So sánh dữ liệu {activeMetric === 'signing' ? 'Ký kết' : activeMetric === 'revenue' ? 'Doanh thu' : 'Lợi nhuận'} giữa các năm</p>
              </div>
              <div className="flex gap-6 text-xs font-bold uppercase text-slate-400">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-indigo-600 rounded-full shadow-lg shadow-indigo-200"></div> {yearFilter === 'All' ? new Date().getFullYear() : yearFilter}</div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-200"></div>
                  {(yearFilter === 'All' ? new Date().getFullYear() : parseInt(yearFilter)) - 1}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-pink-400 shadow-lg shadow-pink-200"></div>
                  {(yearFilter === 'All' ? new Date().getFullYear() : parseInt(yearFilter)) - 2}
                </div>
              </div>
            </div>
            <div className="h-[300px] md:h-[350px]">
              {/* Chart Component - Same as before */}
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} barGap={0}>
                  <defs>
                    <linearGradient id="colorLastYear" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPrevYear" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f472b6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} dy={10} />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: getCursorFill() }}
                    contentStyle={getTooltipStyle()}
                    itemStyle={{ fontSize: '13px', fontWeight: 600, padding: '4px 0' }}
                    formatter={(value: any, name: any) => [formatCurrency(value as number), name]}
                  />
                  <Area type="monotone" dataKey="prevYearLine" name={`Năm ${(yearFilter === 'All' ? new Date().getFullYear() : parseInt(yearFilter)) - 2}`} stroke="#f472b6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPrevYear)" activeDot={{ r: 5, strokeWidth: 2, fill: '#f472b6' }} connectNulls />
                  <Area type="monotone" dataKey="lastYearLine" name={`Năm ${(yearFilter === 'All' ? new Date().getFullYear() : parseInt(yearFilter)) - 1}`} stroke="#22d3ee" strokeWidth={3} fillOpacity={1} fill="url(#colorLastYear)" activeDot={{ r: 5, strokeWidth: 2, fill: '#22d3ee' }} connectNulls />
                  <Bar dataKey="current" name={yearFilter === 'All' ? 'Năm nay' : `Năm ${yearFilter}`} fill={getAccentColor()} radius={[6, 6, 0, 0]} barSize={32} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-8 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col dark-card-glow">
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mb-2">
              Phân bổ {safeUnit?.id === 'all' ? 'theo Đơn vị' : 'theo Sales'}
            </h3>
            <p className="text-sm font-medium text-slate-500 mb-8">Tỷ trọng đóng góp vào tổng số</p>

            {isViewingForeignUnit ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] text-center">
                <ShieldCheck size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Thông tin chi tiết năng suất cá nhân</p>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">được bảo mật khi xem đơn vị khác</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                  Bạn chỉ có thể xem dữ liệu tổng hợp
                </p>
              </div>
            ) : (
              <>
                <div className="flex-1 relative min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        cornerRadius={6}
                      >
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getChartColors()[index % getChartColors().length]} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ ...getTooltipStyle(), zIndex: 50 }}
                        itemStyle={{ fontSize: '13px', fontWeight: 700, color: isDarkTheme() ? '#f1f5f9' : '#1e293b' }}
                        labelStyle={{ fontSize: '11px', fontWeight: 800, color: isDarkTheme() ? '#94a3b8' : '#64748b', marginBottom: 4 }}
                        formatter={(value: any, name: any) => [formatCurrency(value as number), name]}
                        wrapperStyle={{ zIndex: 50 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] font-black text-slate-300 dark:text-slate-300 uppercase tracking-widest">Tổng số</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatCurrency(distributionData.reduce((sum, item) => sum + item.value, 0) || 0)}</p>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  {/* List Top 4 */}
                  {distributionData.slice(0, 4).map((d, i) => (
                    <div key={i} className="flex items-center justify-between group cursor-default">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-md transition-transform group-hover:scale-125" style={{ backgroundColor: getChartColors()[i % getChartColors().length] }}></div>
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 truncate max-w-[140px]">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">{((d.value / (distributionData.reduce((sum, item) => sum + item.value, 0) || 1)) * 100).toFixed(1)}%</span>
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (d.value / (Math.max(...distributionData.map(x => x.value)) || 1)) * 100)}%`, backgroundColor: getChartColors()[i % getChartColors().length] }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Performance Table — hidden for cross-unit viewers */}
        {isViewingForeignUnit ? (
          <div className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm dark-card-glow">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldCheck size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-2">
                Bảng hiệu suất nhân sự — Giới hạn truy cập
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                Bạn đang xem đơn vị <strong>{selectedUnit?.name}</strong>. Chi tiết năng suất từng cá nhân được bảo mật — chỉ thành viên hoặc lãnh đạo đơn vị này mới xem được.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 p-8 md:p-10 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm dark-card-glow">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-3 mb-2">
                  {safeUnit?.id === 'all' ? <Building2 className="text-indigo-600" size={24} /> : <Users className="text-indigo-600" size={24} />}
                  {safeUnit?.id === 'all' ? 'Hiệu suất thực hiện Đơn vị' : 'Hiệu suất nhân sự kinh doanh'}
                </h3>
                <p className="text-sm font-medium text-slate-500">Bảng xếp hạng hiệu quả hoạt động ({activeMetric})</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-400 font-black">
                    <th className="pb-2">{safeUnit?.id === 'all' ? 'Đơn vị' : 'Nhân sự'}</th>
                    <th className="pb-2 text-right">Mục tiêu</th>
                    <th className="pb-2 text-right">Thực tế</th>
                    <th className="pb-2 text-center w-64">Tiến độ hoàn thành</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceTableData.map((row) => (
                    <tr
                      key={row.id}
                      className="group cursor-pointer transition-colors"
                      onClick={() => {
                        if (safeUnit?.id === 'all') {
                          (onSelectPerformanceUnit || ((id: string) => navigate(`/units/${id}`)))(row.id);
                        } else {
                          (onSelectEmployee || ((id: string) => navigate(`/personnel/${id}`)))(row.slug || row.id);
                        }
                      }}
                    >
                      <td className="py-4 pl-4 rounded-l-3xl bg-slate-50 dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-800 border-y border-l border-transparent transition-colors">
                        <div className="flex items-center gap-4">
                          {row.avatar ? (
                            <img src={row.avatar} alt={row.name} className={`w-12 h-12 rounded-lg object-cover shadow-sm group-hover:scale-105 transition-transform`} referrerPolicy="no-referrer" />
                          ) : (
                            <div className={`w-12 h-12 rounded-lg ${safeUnit?.id === 'all' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'} flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition-transform`}>
                              {row.name.substring(0, 1)}
                            </div>
                          )}
                          <div>
                            <p className="text-base font-black text-slate-900 dark:text-slate-100">{row.name}</p>
                            <p className="text-xs font-bold text-slate-400">{row.subText}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-right bg-slate-50 dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-800 border-y border-transparent transition-colors text-sm font-bold text-slate-500">{Math.round(row.target).toLocaleString('vi-VN')}</td>
                      <td className="py-4 text-right bg-slate-50 dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-800 border-y border-transparent transition-colors text-sm font-black text-slate-900 dark:text-slate-100">{Math.round(row.actual).toLocaleString('vi-VN')}</td>
                      <td className="py-4 px-6 rounded-r-3xl bg-slate-50 dark:bg-slate-900 group-hover:bg-slate-100 dark:group-hover:bg-slate-800 border-y border-r border-transparent transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full rounded-full transition-all duration-1000 ${row.progress >= 90 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : row.progress >= 70 ? 'bg-indigo-600' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, row.progress)}%` }}></div>
                          </div>
                          <span className={`text-xs font-bold w-10 text-right ${row.progress >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>{row.progress.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Task Hub Widget */}
        <TaskDashboardWidget />

      </div>
    </ErrorBoundary >
  );
};

// Reusable Components (Keep same as before or updated)
const KPIItem = ({ title, metric, stats, target, companyTarget, yoy, color, icon }: any) => {
  const actual = stats[metric] || 0;
  const plan = target[metric] || 0;
  const progress = plan > 0 ? Math.round((actual / plan) * 100) : 0;

  // Chỉ tiêu ĐHCĐ
  const dhcdPlan = companyTarget ? (companyTarget[metric] || 0) : 0;
  const dhcdProgress = dhcdPlan > 0 ? Math.round((actual / dhcdPlan) * 100) : 0;

  const colors: any = {
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/30',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30',
    cyan: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-100 dark:border-cyan-900/30',
  };

  const formatValue = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} tỷ`;
    if (abs >= 1e6) return `${sign}${Math.round(abs / 1e6)} triệu`;
    if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}K`;
    return Math.round(val).toString();
  };

  const barColor = color === 'emerald' ? 'bg-emerald-500' : color === 'amber' ? 'bg-amber-500' : color === 'purple' ? 'bg-purple-500' : 'bg-indigo-600';

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-lg group relative overflow-hidden dark-card-glow">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3 rounded-lg ${colors[color]} transition-transform group-hover:rotate-6`}>
          {icon}
        </div>
        <div className="text-right">
          <div className={`flex items-center justify-end gap-1 text-xs font-black ${yoy.isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
            {yoy.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {yoy.value}%
          </div>
          {yoy.lastYearTotal > 0 && (
            <div className="text-[10px] text-slate-400 font-bold mt-0.5">
              {formatValue(yoy.lastYearTotal)}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">{title}</p>
      <div className="mb-4">
        <h4 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{formatValue(actual)}</h4>
      </div>
      {plan > 0 || dhcdPlan > 0 ? (
        <div className="space-y-2">
          {/* Chỉ tiêu Nội bộ */}
          {plan > 0 && (
            <>
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-tighter">
                <span className="text-slate-400">{dhcdPlan > 0 ? 'KH Nội bộ' : 'Hoàn thành KH'}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 normal-case tracking-normal">/ {formatValue(plan)}</span>
                  <span className={progress >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}>{progress.toFixed(1)}%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${barColor}`} style={{ width: `${Math.min(100, progress)}%` }}></div>
              </div>
            </>
          )}
          {/* Chỉ tiêu ĐHCĐ */}
          {dhcdPlan > 0 && (
            <>
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-tighter mt-1">
                <span className="text-orange-500 dark:text-orange-400">KH ĐHCĐ</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 normal-case tracking-normal">/ {formatValue(dhcdPlan)}</span>
                  <span className={dhcdProgress >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}>{dhcdProgress.toFixed(1)}%</span>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000 bg-orange-500" style={{ width: `${Math.min(100, dhcdProgress)}%` }}></div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="h-2" />
      )}
    </div>
  );
};

const StatusCard = ({ label, count, icon, color }: any) => {
  const bgColors: any = {
    orange: 'bg-orange-50 dark:bg-orange-900/25 border border-orange-100 dark:border-orange-800/40',
    rose: 'bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/40',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-100 dark:border-cyan-800/40',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40',
    red: 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/40',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/40',
  };

  return (
    <div className={`p-4 rounded-lg ${bgColors[color]} flex items-center gap-3 shadow-sm hover:shadow-md transition-all`}>
      <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase leading-none mb-1">{label}</p>
        <p className="text-xl font-black text-slate-900 dark:text-slate-100 leading-none">{count}</p>
      </div>
    </div>
  );
};

export default Dashboard;
