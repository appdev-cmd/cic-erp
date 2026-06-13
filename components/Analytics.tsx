import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Download, FileText, BarChart3, Activity, Wallet,
    Users, Package, Check, MousePointerClick,
    GripVertical, Eye, EyeOff, PencilRuler
} from 'lucide-react';
import { useSlidePanel } from '../contexts/SlidePanelContext';
import ContractDetail from './ContractDetail';
import {
    ContractService, UnitService, EmployeeService,
    PaymentService, HistoricalProductionService,
    CustomerService, BrandService, ProductService,
    EmployeeTargetService, CompanyTargetService
} from '../services';
import {
    Unit, Contract, Employee, Payment, HistoricalProduction,
    Customer, Brand, Product
} from '../types';
import { toast } from 'sonner';
import { getTooltipStyle } from '../lib/themeColors';
import { useCurrentUserVisibleUnits, useAnalyticsCards } from '../hooks';
import { DetailPageSkeleton } from './ui';
import { useLayoutContext } from './layout/MainLayout';
import { CARD_BY_ID, TAB_GRID_COLS, TAB_ORDER, AnalyticsTab } from './analytics/cardRegistry';
import AnalyticsCustomizer from './analytics/AnalyticsCustomizer';
import ExportReportDialog, { ExportDialogOptions } from './analytics/ExportReportDialog';
import { useReportCapture } from './analytics/useReportCapture';
import { useAuth } from '../contexts/AuthContext';
import type { ManagementReportOptions, ReportKpiRow } from '../utils/managementReportPdf';
import {
    AnalyticsSkeleton, EmptyState, SearchableSelect,
    getContractRevenueInPeriod, lineItemRevenue, contractLineTotal,
    segmentOf, labelBrandSegments,
} from './analytics/shared';
import type { ProductSegment } from './analytics/shared';
import { buildOverviewCards } from './analytics/cards/overviewCards';
import { buildCashflowCards } from './analytics/cards/cashflowCards';
import { buildProductBrandCards } from './analytics/cards/productBrandCards';
import { buildEmployeeCustomerCards } from './analytics/cards/employeeCustomerCards';
import type { AnalyticsCardContext } from './analytics/cards/types';

interface AnalyticsProps {
    selectedUnit: Unit;
    onSelectUnit: (unit: Unit) => void;
}

/* ═══════════════════════════════════════ MAIN COMPONENT ═══════════════════════════════════════
 * Các component trình bày dùng chung: ./analytics/shared.tsx
 * JSX của từng card (theo tab):       ./analytics/cards/*.tsx
 * File này giữ: state, fetch, tính toán dữ liệu (useMemo), drill-down, export PDF, render khung.
 */
const Analytics: React.FC<AnalyticsProps> = ({ selectedUnit: propSelectedUnit, onSelectUnit: propOnSelectUnit }) => {
    const { yearFilter, periodFilter, setYearFilter, selectedUnit: ctxSelectedUnit, setSelectedUnit: ctxSetSelectedUnit } = useLayoutContext();
    const selectedUnit = propSelectedUnit || ctxSelectedUnit;
    const onSelectUnit = propOnSelectUnit || ctxSetSelectedUnit;

    const [showUnitSelector, setShowUnitSelector] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'cashflow' | 'product_brand' | 'employee_customer'>('overview');
    const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

    const { openPanel, closePanel, hasOpenPanels } = useSlidePanel();

    // Khi mở slide panel (vd: danh sách HĐ drill-down) → ẩn tooltip recharts còn "dính"
    // lại trên biểu đồ, tránh đè lên panel.
    useEffect(() => {
        document.body.classList.toggle('analytics-panel-open', hasOpenPanels);
        return () => document.body.classList.remove('analytics-panel-open');
    }, [hasOpenPanels]);

    const handleOpenContractDetail = useCallback((id: string, code: string) => {
        openPanel({
            title: `Chi tiết Hợp đồng ${code}`,
            component: (
                <div className="p-4 md:p-6 lg:p-8">
                    <ContractDetail
                        contractId={id}
                        onBack={() => closePanel()}
                        onEdit={(contract) => {
                            import('./ContractForm').then(({ default: ContractFormComponent }) => {
                                openPanel({
                                    title: `Chỉnh sửa ${contract.contractCode}`,
                                    component: (
                                        <ContractFormComponent
                                            contract={contract}
                                            isInsidePanel={true}
                                            onSave={async (data: any) => {
                                                const { ContractService: service } = await import('../services');
                                                await service.update(contract.id, data);
                                                toast.success('Cập nhật hợp đồng thành công!');
                                                closePanel();
                                                window.dispatchEvent(new CustomEvent('contract-updated', { detail: contract.id }));
                                            }}
                                            onCancel={() => closePanel()}
                                        />
                                    )
                                });
                            });
                        }}
                        onDelete={async () => {
                            const { ContractService: service } = await import('../services');
                            await service.delete(id);
                            closePanel();
                            toast.success('Đã xóa hợp đồng');
                        }}
                    />
                </div>
            ),
        });
    }, [openPanel, closePanel]);

    const handleOpenPersonnelDetail = useCallback((id: string) => {
        openPanel({
            title: 'Chi tiết Nhân viên',
            component: (
                <React.Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        {React.createElement(
                            React.lazy(() => import('./PersonnelDetail')),
                            {
                                personnelId: id,
                                onBack: () => closePanel(),
                                onViewContract: (contractId: string) => handleOpenContractDetail(contractId, contractId)
                            }
                        )}
                    </div>
                </React.Suspense>
            )
        });
    }, [openPanel, closePanel, handleOpenContractDetail]);

    const handleOpenUnitDetail = useCallback((id: string) => {
        openPanel({
            title: 'Chi tiết Đơn vị',
            component: (
                <React.Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        {React.createElement(
                            React.lazy(() => import('./UnitDetail')),
                            {
                                unitId: id,
                                onBack: () => closePanel(),
                                onViewContract: (contractId: string) => handleOpenContractDetail(contractId, contractId),
                                onViewPersonnel: handleOpenPersonnelDetail,
                                yearFilter: yearFilter
                            }
                        )}
                    </div>
                </React.Suspense>
            )
        });
    }, [openPanel, closePanel, yearFilter, handleOpenContractDetail, handleOpenPersonnelDetail]);

    const handleOpenProductDetail = useCallback((id: string) => {
        openPanel({
            title: 'Chi tiết Sản phẩm/DV',
            component: (
                <React.Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        {React.createElement(
                            React.lazy(() => import('./ProductDetail')),
                            {
                                productId: id,
                                onBack: () => closePanel(),
                                onViewContract: (contractId: string) => handleOpenContractDetail(contractId, contractId)
                            }
                        )}
                    </div>
                </React.Suspense>
            )
        });
    }, [openPanel, closePanel, handleOpenContractDetail]);

    const handleOpenBrandDetail = useCallback((id: string) => {
        openPanel({
            title: 'Chi tiết Hãng sản xuất',
            component: (
                <React.Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        {React.createElement(
                            React.lazy(() => import('./BrandDetail')),
                            {
                                brandId: id,
                                onBack: () => closePanel(),
                                onSelectProduct: handleOpenProductDetail
                            }
                        )}
                    </div>
                </React.Suspense>
            )
        });
    }, [openPanel, closePanel, handleOpenProductDetail]);

    const handleOpenCustomerDetail = useCallback((id: string) => {
        openPanel({
            title: 'Chi tiết Khách hàng',
            component: (
                <React.Suspense fallback={<DetailPageSkeleton />}>
                    <div className="p-4 md:p-6 lg:p-8">
                        {React.createElement(
                            React.lazy(() => import('./CustomerDetail')),
                            {
                                customerId: id,
                                onBack: () => closePanel(),
                                onViewContract: (contractId: string) => handleOpenContractDetail(contractId, contractId)
                            }
                        )}
                    </div>
                </React.Suspense>
            )
        });
    }, [openPanel, closePanel, handleOpenContractDetail]);

    const [drillDown, setDrillDown] = useState<{
        isOpen: boolean;
        title: string;
        contracts: Contract[];
    } | null>(null);

    const { visibleUnits } = useCurrentUserVisibleUnits();

    // Phân quyền + cá nhân hoá card (allowed theo role ∩ user chọn, theo thứ tự).
    const { visibleOrderedIds, layout, allowedIds, saveLayout, resetLayout, isSaving } = useAnalyticsCards();
    const [showCustomizer, setShowCustomizer] = useState(false);

    // ── Chế độ chỉnh sửa bố cục trực tiếp trên giao diện ──
    const [editMode, setEditMode] = useState(false);
    const [dragCardId, setDragCardId] = useState<string | null>(null);

    /** Bật/tắt hiển thị 1 card ngay trên giao diện (lưu optimistic + DB). */
    const toggleCardVisible = (cardId: string) => {
        saveLayout(layout.map(p => p.cardId === cardId ? { ...p, visible: !p.visible } : p));
    };

    /** Kéo-thả sắp xếp: đưa dragCardId vào trước targetId (chỉ trong cùng tab). */
    const reorderCard = (targetId: string) => {
        if (!dragCardId || dragCardId === targetId) { setDragCardId(null); return; }
        const dragMeta = CARD_BY_ID[dragCardId];
        const targetMeta = CARD_BY_ID[targetId];
        if (!dragMeta || !targetMeta || dragMeta.tab !== targetMeta.tab) { setDragCardId(null); return; }
        const arr = [...layout];
        const from = arr.findIndex(p => p.cardId === dragCardId);
        if (from === -1) { setDragCardId(null); return; }
        const [moved] = arr.splice(from, 1);
        const to = arr.findIndex(p => p.cardId === targetId);
        if (to === -1) { setDragCardId(null); return; }
        arr.splice(to, 0, moved);
        saveLayout(arr);
        setDragCardId(null);
    };

    // Contracts fetched WITH payments join (via list) for accurate revenue
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [historicalData, setHistoricalData] = useState<HistoricalProduction[]>([]);

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [employeeTargets, setEmployeeTargets] = useState<any[]>([]);

    // KPI data from getStats RPC (same source as Dashboard)
    const [statsData, setStatsData] = useState<{
        totalRevenue: number; totalProfit: number; totalSigningProfit: number;
        totalRevenueProfit: number; totalCash: number; totalValue: number; totalContracts: number;
    } | null>(null);

    const [rawDistData, setRawDistData] = useState<any[]>([]);
    const [companyTarget, setCompanyTarget] = useState<any | null>(null);
    const [monthlyHistLast, setMonthlyHistLast] = useState<any[]>([]);

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

    // Fetch employee targets when unit/year changes
    useEffect(() => {
        let cancelled = false;
        const fetchTargets = async () => {
            const yearParam = (yearFilter && yearFilter !== 'All') ? parseInt(yearFilter) : new Date().getFullYear();
            try {
                let targets: any[] = [];
                if (selectedUnit?.id === 'all') {
                    targets = await EmployeeTargetService.getByYear(yearParam);
                } else {
                    targets = await EmployeeTargetService.getByUnitAndYear(selectedUnit.id, yearParam);
                }
                if (!cancelled) {
                    setEmployeeTargets(targets);
                }
            } catch (err) {
                console.error("Lỗi tải chỉ tiêu nhân sự:", err);
            }
        };
        fetchTargets();
        return () => { cancelled = true; };
    }, [selectedUnit, yearFilter]);

    // Fetch contracts & stats when unit/year changes — uses list() with payments join
    useEffect(() => {
        let cancelled = false;
        const fetchFilteredData = async () => {
            setIsLoading(true);
            try {
                // ── Siết phạm vi dữ liệu theo đơn vị được phép ──
                // Global-scope (visibleUnits === 'all') → 'all'.
                // User bị giới hạn mà chọn "Tất cả" → chỉ kéo dữ liệu các đơn vị họ được xem.
                let unitId: string;
                if (selectedUnit?.id === 'all') {
                    unitId = visibleUnits === 'all'
                        ? 'all'
                        : (visibleUnits.length > 0 ? visibleUnits.join(',') : 'all');
                } else if (visibleUnits !== 'all' && selectedUnit?.id && !visibleUnits.includes(selectedUnit.id)) {
                    // Đơn vị đang chọn nằm ngoài phạm vi → fallback về tập được phép.
                    unitId = visibleUnits.length > 0 ? visibleUnits.join(',') : 'all';
                } else {
                    unitId = selectedUnit?.id;
                }

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

                // Parallel: getStats (KPI) + list (contracts with payments) + payments + distribution stats
                const yearParam = yearFilter === 'All' ? null : parseInt(yearFilter);
                const [stats, contractsRes, payRes, distData] = await Promise.all([
                    ContractService.getStats({ unitId, dateFrom, dateTo }),
                    ContractService.list({ page: 1, limit: 10000, unitId }),
                    PaymentService.list({ page: 1, limit: 10000 }),
                    (async () => {
                        try {
                            return selectedUnit?.id === 'all'
                                ? await UnitService.getWithStats(yearParam, periodFilter)
                                : await EmployeeService.getWithStats(selectedUnit.id, undefined, yearParam, periodFilter);
                        } catch (e) {
                            console.warn("Lỗi tải phân phối:", e);
                            return [];
                        }
                    })()
                ]);

                let ct: any = null;
                if (selectedUnit?.id === 'all' && yearFilter !== 'All') {
                    try {
                        ct = await CompanyTargetService.getByYear(parseInt(yearFilter));
                    } catch (e) {
                        console.warn("Lỗi tải mục tiêu ĐHCĐ:", e);
                    }
                }

                let mLast: any[] = [];
                try {
                    const currentYearNum = yearFilter === 'All' ? new Date().getFullYear() : parseInt(yearFilter);
                    const lastYearNum = currentYearNum - 1;
                    const histUnitId = selectedUnit?.id || 'all';

                    if (histUnitId === 'all') {
                        const all = await HistoricalProductionService.getMonthlyByYear(lastYearNum);
                        const monthMap: Record<number, any> = {};
                        all.forEach(h => {
                            const m = h.month!;
                            if (!monthMap[m]) {
                                monthMap[m] = { unitId: 'all', year: lastYearNum, month: m, signing: 0, revenue: 0, adminProfit: 0, revProfit: 0 };
                            }
                            monthMap[m].signing += h.signing;
                            monthMap[m].revenue += h.revenue;
                            monthMap[m].adminProfit += h.adminProfit;
                            monthMap[m].revProfit += h.revProfit;
                        });
                        mLast = Object.values(monthMap);
                    } else {
                        mLast = await HistoricalProductionService.getMonthlyByYearAndUnit(lastYearNum, histUnitId);
                    }
                } catch (e) {
                    console.warn("Lỗi tải lịch sử cùng kỳ:", e);
                }

                if (!cancelled) {
                    setStatsData(stats as any);
                    setContracts(contractsRes.data);
                    setPayments(payRes.data);
                    setRawDistData(distData || []);
                    setCompanyTarget(ct);
                    setMonthlyHistLast(mLast);
                }
            } catch (error) {
                toast.error("Lỗi tải dữ liệu thống kê");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        fetchFilteredData();
        return () => { cancelled = true; };
    }, [selectedUnit, yearFilter, periodFilter, visibleUnits]);

    const safeUnit = units.find(u => u.id === selectedUnit.id) || selectedUnit;

    const availableYears = useMemo(() => {
        const years = new Set(contracts.map(c => c.signedDate ? c.signedDate.split('-')[0] : new Date().getFullYear().toString()));
        return Array.from(years).sort().reverse();
    }, [contracts]);

    // Client-side filtering logic for Brand, Product, Customer
    const processedContracts = useMemo(() => {
        return contracts.map(c => {
            let filteredLineItems = c.lineItems || [];
            if (selectedBrandIds.length > 0) {
                filteredLineItems = filteredLineItems.filter((li: any) => {
                    const prod = products.find(p => p.id === li.productId);
                    return prod?.brandId && selectedBrandIds.includes(prod.brandId);
                });
            }
            if (selectedProductIds.length > 0) {
                filteredLineItems = filteredLineItems.filter((li: any) => selectedProductIds.includes(li.productId));
            }

            const hasMatchingLineItems = (selectedBrandIds.length === 0 && selectedProductIds.length === 0) || filteredLineItems.length > 0;
            const matchesCustomer = selectedCustomerIds.length === 0 || selectedCustomerIds.includes(c.customerId);

            if (!hasMatchingLineItems || !matchesCustomer) {
                return null;
            }

            if (selectedBrandIds.length > 0 || selectedProductIds.length > 0) {
                const totalLineValue = filteredLineItems.reduce((sum: number, li: any) => sum + (li.outputPrice || 0) * (li.quantity || 1), 0);
                const proportion = c.value > 0 ? totalLineValue / c.value : 0;
                
                const allocatedRevenue = (c.actualRevenue || 0) * proportion;
                const allocatedAdminProfit = (c.adminProfit || 0) * proportion;
                const allocatedRevProfit = (c.revProfit || 0) * proportion;

                return {
                    ...c,
                    actualRevenue: allocatedRevenue,
                    adminProfit: allocatedAdminProfit,
                    revProfit: allocatedRevProfit,
                    value: totalLineValue,
                    lineItems: filteredLineItems
                };
            }

            return c;
        }).filter((c): c is Contract => c !== null);
    }, [contracts, selectedBrandIds, selectedProductIds, selectedCustomerIds, products]);

    // Contracts are already filtered by unit+year from the API call
    const filteredContracts = processedContracts;

    // Active contracts only — nhất quán với SQL RPC get_brands_with_stats:
    // chỉ lấy hợp đồng đang hoạt động (không tính Draft, Cancelled...)
    const activeContracts = useMemo(
        () => filteredContracts.filter(c =>
            ['Processing', 'Suspended', 'Handover', 'Acceptance', 'Completed'].includes(c.status)
        ),
        [filteredContracts]
    );

    /* ─── KPI Calculations (from getStats RPC — same as Dashboard) ─── */
    const kpiData = useMemo(() => {
        const hasActiveFilters = selectedBrandIds.length > 0 || selectedProductIds.length > 0 || selectedCustomerIds.length > 0;
        
        let totalRevenue = 0;
        let totalProfit = 0;
        let contractCount = 0;

        if (hasActiveFilters) {
            totalRevenue = filteredContracts.reduce((sum, c) => sum + (c.actualRevenue || 0), 0);
            totalProfit = filteredContracts.reduce((sum, c) => sum + (c.adminProfit || 0), 0);
            contractCount = filteredContracts.length;
        } else {
            if (!statsData) return { totalRevenue: 0, totalProfit: 0, contractCount: 0, completionRate: 0 };
            totalRevenue = statsData.totalRevenue || 0;
            totalProfit = statsData.totalSigningProfit || 0;
            contractCount = statsData.totalContracts || 0;
        }

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
    }, [statsData, safeUnit, selectedUnit, units, filteredContracts, selectedBrandIds, selectedProductIds, selectedCustomerIds]);

    // 1. Structure Pie Chart Data
    const structureData = useMemo(() => {
        const allowedUnits = units.filter(u => {
            if (u.id === 'all') return false;
            if (visibleUnits === 'all') return true;
            return visibleUnits.includes(u.id);
        });

        if (selectedUnit.id === 'all') {
            return allowedUnits.map(u => ({
                id: u.id,
                name: u.name,
                value: contracts
                    .filter(c => c.unitId === u.id && c.status !== 'Cancelled')
                    .reduce((sum, c) => {
                        const revInPeriod = getContractRevenueInPeriod(c, yearFilter, payments);
                        return sum + revInPeriod;
                    }, 0)
            })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
        } else {
            return employees
                .filter(e => e.unitId === selectedUnit.id)
                .map(e => ({
                    id: e.id,
                    name: e.name,
                    value: filteredContracts
                        .filter(c => c.salespersonId === e.id && c.status !== 'Cancelled')
                        .reduce((sum, c) => {
                            const revInPeriod = getContractRevenueInPeriod(c, yearFilter, payments);
                            const empFraction = ((c as any)._employeePct || 100) / 100;
                            const unitFraction = (((c as any)._allocationPct || 100) / 100);
                            return sum + revInPeriod * empFraction * unitFraction;
                        }, 0)
                }))
                .filter(d => d.value > 0)
                .sort((a, b) => b.value - a.value);
        }
    }, [units, contracts, selectedUnit, yearFilter, employees, filteredContracts, payments, visibleUnits]);

    // 2. Plan vs Actual Bar Chart
    const planVsActualData = useMemo(() => {
        const allowedUnits = units.filter(u => {
            if (u.id === 'all') return false;
            if (visibleUnits === 'all') return true;
            return visibleUnits.includes(u.id);
        });

        return allowedUnits.filter(u => selectedUnit.id === 'all' || u.id === selectedUnit.id).map(u => {
            const unitContracts = contracts.filter(c => c.unitId === u.id && c.status !== 'Cancelled');
            const actualRev = unitContracts.reduce((sum, c) => {
                const revInPeriod = getContractRevenueInPeriod(c, yearFilter, payments);
                const allocations = c.unitAllocations || [];
                const isLeadUnit = c.unitId === u.id;
                const supportAlloc = allocations.find((a: any) => a.unitId === u.id && a.role === 'support');
                let fraction = 1;
                if (isLeadUnit && allocations.length > 0) {
                    const leadAlloc = allocations.find((a: any) => a.unitId === u.id && a.role === 'lead');
                    fraction = leadAlloc ? (leadAlloc.percent || 100) / 100 : 1;
                } else if (supportAlloc) {
                    fraction = (supportAlloc.percent || 0) / 100;
                } else if (!isLeadUnit) {
                    fraction = 0;
                }
                return sum + revInPeriod * fraction;
            }, 0);
            const targetRev = u.target?.revenue || 0;
            return {
                name: u.name,
                Target: targetRev,
                Actual: actualRev,
            };
        }).sort((a, b) => b.Actual - a.Actual);
    }, [units, contracts, selectedUnit, yearFilter, payments, visibleUnits]);

    // 2b. Unit Performance (Hiệu suất theo Đơn vị)
    const unitPerformanceData = useMemo(() => {
        const allowedUnits = units.filter(u => {
            if (u.id === 'all') return false;
            if (visibleUnits === 'all') return true;
            return visibleUnits.includes(u.id);
        });

        return allowedUnits.filter(u => selectedUnit.id === 'all' || u.id === selectedUnit.id).map(u => {
            const unitContracts = contracts.filter(c => c.unitId === u.id && c.status !== 'Cancelled');
            const actualRev = unitContracts.reduce((sum, c) => {
                const revInPeriod = getContractRevenueInPeriod(c, yearFilter, payments);
                const allocations = c.unitAllocations || [];
                const isLeadUnit = c.unitId === u.id;
                const supportAlloc = allocations.find((a: any) => a.unitId === u.id && a.role === 'support');
                let fraction = 1;
                if (isLeadUnit && allocations.length > 0) {
                    const leadAlloc = allocations.find((a: any) => a.unitId === u.id && a.role === 'lead');
                    fraction = leadAlloc ? (leadAlloc.percent || 100) / 100 : 1;
                } else if (supportAlloc) {
                    fraction = (supportAlloc.percent || 0) / 100;
                } else if (!isLeadUnit) {
                    fraction = 0;
                }
                return sum + revInPeriod * fraction;
            }, 0);
            const targetRev = u.target?.revenue || 0;
            const completion = targetRev > 0 ? (actualRev / targetRev) * 100 : 0;
            return {
                id: u.id,
                name: u.name,
                Actual: actualRev,
                Target: targetRev,
                completion,
            };
        }).sort((a, b) => b.Actual - a.Actual);
    }, [units, contracts, selectedUnit, yearFilter, payments, visibleUnits]);

    // 3. Monthly Trend
    const monthlyTrendData = useMemo(() => {
        const months = Array.from({ length: 12 }, (_, i) => `Th.${i + 1}`);
        const targetYear = yearFilter && yearFilter !== 'All' && yearFilter !== 'all' ? parseInt(yearFilter) : null;

        const isInMonth = (dateStr: string | null | undefined, monthNum: number): boolean => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            const yearMatch = targetYear ? d.getFullYear() === targetYear : true;
            return yearMatch && (d.getMonth() + 1) === monthNum;
        };

        return months.map((m, i) => {
            const monthNum = i + 1;
            let monthlyRevenue = 0;
            let monthlyProfit = 0;

            filteredContracts.forEach(c => {
                const unitFraction = selectedUnit.id === 'all' ? 1 : (((c as any)._allocationPct || 100) / 100);
                const contractPayments = payments.filter(p => p.contractId === c.id);

                const revenuePayments = contractPayments.filter(p =>
                    p.voucherType === 'VAT_INVOICE' &&
                    ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'].includes(p.status) &&
                    isInMonth(p.invoiceDate || p.paymentDate, monthNum)
                );

                let revenueInMonth = 0;
                revenuePayments.forEach(p => {
                    const hasVat = c.hasVat !== false;
                    const vatRate = c.vatRate ?? 10;
                    if (p.vatInvoiceItems && p.vatInvoiceItems.length > 0) {
                        revenueInMonth += p.vatInvoiceItems.reduce((s, item) => s + (Number(item.amountBeforeVAT) || 0), 0);
                    } else {
                        const gross = Number(p.amount) || 0;
                        const vatDivisor = hasVat && vatRate > 0 ? (1 + vatRate / 100) : 1;
                        revenueInMonth += Math.round(gross / vatDivisor);
                    }
                });

                let profitInMonth = 0;
                const expectedRevenue = c.expectedRevenue || 0;
                const expectedProfit = c.adminProfit || 0;
                if (expectedRevenue > 0) {
                    const profitRatio = expectedProfit / expectedRevenue;
                    profitInMonth = revenueInMonth * profitRatio;
                }

                monthlyRevenue += revenueInMonth * unitFraction;
                monthlyProfit += profitInMonth * unitFraction;
            });

            return { name: m, DoanhThu: Math.round(monthlyRevenue), LoiNhuan: Math.round(monthlyProfit) };
        });
    }, [filteredContracts, payments, yearFilter, selectedUnit]);

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
        
        // 1. Nạp dữ liệu lịch sử từ DB
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

        // 2. Tính toán real-time cho năm hiện tại (2026) và tương lai từ contracts & payments thực tế
        const currentYear = new Date().getFullYear();
        const activeYears = new Set<number>();
        activeYears.add(currentYear);

        contracts.forEach(c => {
            if (c.signedDate && c.signedDate.includes('-')) {
                const y = parseInt(c.signedDate.split('-')[0]);
                if (!isNaN(y) && y >= currentYear) activeYears.add(y);
            }
        });
        
        payments.forEach(p => {
            const dateStr = p.invoiceDate || p.paymentDate;
            if (dateStr && dateStr.includes('-')) {
                const y = parseInt(dateStr.split('-')[0]);
                if (!isNaN(y) && y >= currentYear) activeYears.add(y);
            }
        });

        activeYears.forEach(y => {
            let signingYear = 0;
            let revenueYear = 0;
            let adminProfitYear = 0;
            let revProfitYear = 0;

            contracts.forEach(c => {
                const contractYear = (c.signedDate && c.signedDate.includes('-')) ? parseInt(c.signedDate.split('-')[0]) : null;
                if (contractYear === y) {
                    signingYear += (c.value || 0);
                    adminProfitYear += (c.adminProfit || 0);
                }

                const rev = getContractRevenueInPeriod(c, y.toString(), payments);
                revenueYear += rev;
                
                const ratio = c.value > 0 ? ((c.adminProfit || 0) / c.value) : 0;
                revProfitYear += rev * ratio;
            });

            yearMap.set(y, {
                name: y.toString(),
                'Ký kết': signingYear,
                'Doanh thu': revenueYear,
                'LNG QT': adminProfitYear,
                'LNG DT': revProfitYear
            });
        });

        return Array.from(yearMap.values()).sort((a, b) => parseInt(a.name) - parseInt(b.name));
    }, [historicalData, selectedUnit, contracts, payments]);

    // 6. Top Customers by Revenue (Top 5) — dùng VAT invoice revenue nhất quán với Monthly Trend
    const topCustomersData = useMemo(() => {
        const customerMap = new Map<string, number>();
        filteredContracts.forEach(c => {
            if (c.customerId) {
                const rev = getContractRevenueInPeriod(c, yearFilter, payments);
                customerMap.set(c.customerId, (customerMap.get(c.customerId) || 0) + rev);
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
    }, [filteredContracts, customers, yearFilter, payments]);

    // 7. Top Brands by Revenue
    // Dùng outputPrice × quantity trực tiếp (nhất quán với vw_products_with_stats trong module Đối tác)
    const topBrandsData = useMemo(() => {
        const brandMap = new Map<string, number>(); // brandId -> revenue
        activeContracts.forEach(c => {
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
    }, [activeContracts, products, brands]);

    // 8. Product Category Distribution
    // Dùng outputPrice × quantity nhất quán với module Đối tác (get_brands_with_stats)
    const productCategoryData = useMemo(() => {
        const catMap = new Map<string, number>();
        activeContracts.forEach(c => {
            if (c.lineItems && Array.isArray(c.lineItems)) {
                c.lineItems.forEach((li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    const cat = product?.category || 'Chưa phân loại';
                    const lineRevenue = (li.outputPrice || 0) * (li.quantity || 1);
                    catMap.set(cat, (catMap.get(cat) || 0) + lineRevenue);
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
    }, [activeContracts, products]);

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

    // 10. Top Employees (Sales Performance) — dùng VAT invoice revenue nhất quán với Monthly Trend
    const topEmployeesData = useMemo(() => {
        const empMap = new Map<string, number>();
        filteredContracts.forEach(c => {
            const rev = getContractRevenueInPeriod(c, yearFilter, payments);
            if (rev > 0) {
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
            .slice(0, 5);
    }, [filteredContracts, employees, yearFilter, payments]);

    // 11. Brand Profitability Margin
    // Doanh thu dùng outputPrice × quantity nhất quán với module Đối tác.
    // Lợi nhuận phân bổ theo tỷ lệ line item / contract_value vì profit chỉ có ở cấp hợp đồng.
    const brandProfitabilityData = useMemo(() => {
        // Khoá gộp = brandId|segment → tách 1 hãng thành nhiều dòng theo phân khúc.
        const brandMap = new Map<string, { brandId: string, segment: ProductSegment, rev: number, profit: number }>();
        activeContracts.forEach(c => {
            if (c.lineItems && Array.isArray(c.lineItems)) {
                const clt = contractLineTotal(c); // base pre-VAT để tỷ lệ phân bổ cộng dồn = 1
                c.lineItems.forEach((li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    if (product && product.brandId) {
                        const segment = segmentOf(product.category);
                        const key = `${product.brandId}|${segment}`;
                        const lineRevenue = lineItemRevenue(li);
                        const proportion = clt > 0 ? lineRevenue / clt : 0;
                        // Chỉ dùng LNG quản trị (adminProfit) — KHÔNG cộng revProfit (2 cơ sở khác nhau,
                        // cộng lại làm biên LN vượt 100%).
                        const allocatedProfit = (c.adminProfit || 0) * proportion;

                        const current = brandMap.get(key) || { brandId: product.brandId, segment, rev: 0, profit: 0 };
                        brandMap.set(key, {
                            brandId: product.brandId,
                            segment,
                            rev: current.rev + lineRevenue,
                            profit: current.profit + allocatedProfit
                        });
                    }
                });
            }
        });
        const rows = Array.from(brandMap.entries())
            .map(([key, data]) => {
                const margin = data.rev > 0 ? (data.profit / data.rev) * 100 : 0;
                return {
                    id: key,
                    brandId: data.brandId,
                    segment: data.segment,
                    brandName: brands.find(b => b.id === data.brandId)?.name || 'Hãng khác',
                    type: 'BRAND',
                    value: margin,
                    revenue: data.rev // keep revenue for tooltip info
                };
            })
            .filter(d => d.revenue > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        return labelBrandSegments(rows);
    }, [activeContracts, products, brands]);

    // 12. Top Sold Products by Quantity — gom theo HỌ SẢN PHẨM (productLine), không tách biến thể.
    const productQuantityData = useMemo(() => {
        const familyMap = new Map<string, number>(); // họ SP (productLine) -> tổng số lượng
        activeContracts.forEach(c => {
            if (c.lineItems && Array.isArray(c.lineItems)) {
                c.lineItems.forEach((li: any) => {
                    if (li.productId) {
                        const p = products.find(pp => pp.id === li.productId);
                        // Ưu tiên họ SP; thiếu thì lùi về tên SP để vẫn hiện 1 dòng riêng.
                        const family = p?.productLine?.trim() || p?.name || li.productName || 'Sản phẩm ẩn';
                        const qty = li.quantity || 1;
                        familyMap.set(family, (familyMap.get(family) || 0) + qty);
                    }
                });
            }
        });
        return Array.from(familyMap.entries())
            .map(([family, qty]) => ({
                id: family,
                type: 'PRODUCT_QTY',
                name: family,
                value: qty
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [activeContracts, products]);

    // 13. Top Brands by Sold Quantity
    const brandQuantityData = useMemo(() => {
        const brandMap = new Map<string, number>();
        activeContracts.forEach(c => {
            if (c.lineItems && Array.isArray(c.lineItems)) {
                c.lineItems.forEach((li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    if (product && product.brandId) {
                        const qty = li.quantity || 1;
                        brandMap.set(product.brandId, (brandMap.get(product.brandId) || 0) + qty);
                    }
                });
            }
        });
        return Array.from(brandMap.entries())
            .map(([id, qty]) => ({
                id,
                type: 'BRAND_QTY',
                name: brands.find(b => b.id === id)?.name || 'Hãng khác',
                value: qty
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [activeContracts, products, brands]);

    // 14. Brand Profit Structure
    const brandProfitStructureData = useMemo(() => {
        // Khoá gộp = brandId|segment → tách 1 hãng thành nhiều lát theo phân khúc.
        const brandMap = new Map<string, { brandId: string, segment: ProductSegment, profit: number }>();
        activeContracts.forEach(c => {
            if (c.lineItems && Array.isArray(c.lineItems)) {
                const clt = contractLineTotal(c);
                c.lineItems.forEach((li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    if (product && product.brandId) {
                        const segment = segmentOf(product.category);
                        const key = `${product.brandId}|${segment}`;
                        const lineRevenue = lineItemRevenue(li);
                        const proportion = clt > 0 ? lineRevenue / clt : 0;
                        const allocatedProfit = (c.adminProfit || 0) * proportion; // LNG quản trị
                        const cur = brandMap.get(key) || { brandId: product.brandId, segment, profit: 0 };
                        brandMap.set(key, { brandId: product.brandId, segment, profit: cur.profit + allocatedProfit });
                    }
                });
            }
        });
        const sortedBrands = Array.from(brandMap.entries())
            .map(([key, d]) => ({
                id: key,
                brandId: d.brandId,
                segment: d.segment,
                brandName: brands.find(b => b.id === d.brandId)?.name || 'Hãng khác',
                type: 'BRAND_PROFIT_STRUCTURE',
                value: d.profit
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);

        if (sortedBrands.length <= 10) {
            return labelBrandSegments(sortedBrands);
        }

        const top10 = sortedBrands.slice(0, 10);
        const otherProfit = sortedBrands.slice(10).reduce((sum, d) => sum + d.value, 0);

        return [
            ...labelBrandSegments(top10),
            {
                id: 'other_brands',
                brandId: '',
                segment: 'other' as ProductSegment,
                brandName: 'Hãng khác',
                type: 'BRAND_PROFIT_STRUCTURE_OTHER',
                name: 'Hãng khác',
                value: otherProfit
            }
        ];
    }, [activeContracts, products, brands]);

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

    const getContractMatches = (data: any): { contract: Contract; displayValue: number }[] => {
        // Chỉ dùng activeContracts (loại Suspended) để nhất quán với bar chart
        let matches: { contract: Contract; displayValue: number }[] = [];

        if (data.type === 'CUSTOMER') {
            matches = activeContracts
                .filter(c => c.customerId === data.id)
                .map(c => ({ contract: c, displayValue: c.actualRevenue || 0 }));
        } else if (data.type === 'BRAND') {
            // Dùng outputPrice × quantity của line item thuộc hãng này (nhất quán với bar chart).
            // Card "Tỷ suất LN" tách theo phân khúc (có data.segment) → lọc thêm theo nhóm;
            // card "Top Hãng" không có segment (id = brandId) → lọc theo hãng.
            const brandId = data.brandId || data.id;
            activeContracts.forEach(c => {
                const brandRevenue = (c.lineItems || []).reduce((sum: number, li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    if (product?.brandId === brandId && (!data.segment || segmentOf(product?.category) === data.segment)) {
                        return sum + (li.outputPrice || 0) * (li.quantity || 1);
                    }
                    return sum;
                }, 0);
                if (brandRevenue > 0) matches.push({ contract: c, displayValue: brandRevenue });
            });
            matches.sort((a, b) => b.displayValue - a.displayValue);
        } else if (data.type === 'EMPLOYEE') {
            matches = activeContracts
                .filter(c => c.salespersonId === data.id)
                .map(c => ({ contract: c, displayValue: c.actualRevenue || 0 }));
        } else if (data.type === 'CATEGORY') {
            activeContracts.forEach(c => {
                const catRevenue = (c.lineItems || []).reduce((sum: number, li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    if ((product?.category || 'Chưa phân loại') === data.name) {
                        return sum + (li.outputPrice || 0) * (li.quantity || 1);
                    }
                    return sum;
                }, 0);
                if (catRevenue > 0) matches.push({ contract: c, displayValue: catRevenue });
            });
            matches.sort((a, b) => b.displayValue - a.displayValue);
        } else if (data.type === 'PRODUCT_QTY') {
            // data.id = họ sản phẩm (productLine) → khớp mọi line item cùng họ.
            activeContracts.forEach(c => {
                const prodQty = (c.lineItems || []).reduce((sum: number, li: any) => {
                    if (!li.productId) return sum;
                    const p = products.find(pp => pp.id === li.productId);
                    const family = p?.productLine?.trim() || p?.name || li.productName || 'Sản phẩm ẩn';
                    return family === data.id ? sum + (li.quantity || 1) : sum;
                }, 0);
                if (prodQty > 0) matches.push({ contract: c, displayValue: prodQty });
            });
            matches.sort((a, b) => b.displayValue - a.displayValue);
        } else if (data.type === 'BRAND_QTY') {
            activeContracts.forEach(c => {
                const brandQty = (c.lineItems || []).reduce((sum: number, li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    if (product?.brandId === data.id) {
                        return sum + (li.quantity || 1);
                    }
                    return sum;
                }, 0);
                if (brandQty > 0) matches.push({ contract: c, displayValue: brandQty });
            });
            matches.sort((a, b) => b.displayValue - a.displayValue);
        } else if (data.type === 'BRAND_PROFIT_STRUCTURE') {
            activeContracts.forEach(c => {
                const brandRevenue = (c.lineItems || []).reduce((sum: number, li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    if (product?.brandId === data.brandId && segmentOf(product?.category) === data.segment) {
                        return sum + (li.outputPrice || 0) * (li.quantity || 1);
                    }
                    return sum;
                }, 0);
                if (brandRevenue > 0) {
                    const clt = contractLineTotal(c);
                    const proportion = clt > 0 ? brandRevenue / clt : 0;
                    const allocatedProfit = (c.adminProfit || 0) * proportion;
                    if (allocatedProfit > 0) {
                        matches.push({ contract: c, displayValue: allocatedProfit });
                    }
                }
            });
            matches.sort((a, b) => b.displayValue - a.displayValue);
        } else if (data.type === 'BRAND_PROFIT_STRUCTURE_OTHER') {
            // Đuôi "Hãng khác" = các tổ hợp brand|segment ngoài top 10 (id là khoá gộp brandId|segment).
            const topKeys = new Set(brandProfitStructureData.slice(0, 10).map(b => b.id));
            activeContracts.forEach(c => {
                const otherBrandRevenue = (c.lineItems || []).reduce((sum: number, li: any) => {
                    const product = products.find(p => p.id === li.productId);
                    if (product?.brandId && !topKeys.has(`${product.brandId}|${segmentOf(product.category)}`)) {
                        return sum + (li.outputPrice || 0) * (li.quantity || 1);
                    }
                    return sum;
                }, 0);
                if (otherBrandRevenue > 0) {
                    const clt = contractLineTotal(c);
                    const proportion = clt > 0 ? otherBrandRevenue / clt : 0;
                    const allocatedProfit = (c.adminProfit || 0) * proportion;
                    if (allocatedProfit > 0) {
                        matches.push({ contract: c, displayValue: allocatedProfit });
                    }
                }
            });
            matches.sort((a, b) => b.displayValue - a.displayValue);
        }

        return matches;
    };

    /**
     * Mở slide panel liệt kê hợp đồng liên quan khi BẤM vào cột/lát của biểu đồ.
     * Thay cho việc nhồi bảng vào tooltip (vốn khó thao tác vì tooltip bám chuột).
     */
    /**
     * Recharts giữ tooltip "dính" lại khi chuột vẫn nằm trên biểu đồ sau khi bấm.
     * Chủ động blur element đang focus (svg surface) + phát sự kiện rời chuột để
     * recharts ẩn tooltip ngay, không chờ chuột rời chart. Bổ trợ cho CSS ẩn theo
     * class `analytics-panel-open`.
     */
    const dismissChartTooltips = () => {
        if (typeof document === 'undefined') return;
        (document.activeElement as HTMLElement | null)?.blur?.();
        document.querySelectorAll('.recharts-wrapper, .recharts-surface').forEach((el) => {
            ['pointerleave', 'pointerout', 'mouseleave', 'mouseout'].forEach((type) => {
                el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, relatedTarget: document.body }));
            });
        });
    };

    const openContractDrillDown = (data: any) => {
        if (!data || !data.type) return;
        dismissChartTooltips();
        const matches = getContractMatches(data);
        if (matches.length === 0) {
            toast.info('Không có hợp đồng liên quan');
            return;
        }
        const isQty = data.type === 'PRODUCT_QTY' || data.type === 'BRAND_QTY';
        const total = matches.reduce((s, m) => s + m.displayValue, 0);
        openPanel({
            title: `Hợp đồng liên quan · ${data.name}`,
            component: (
                <div className="px-4 md:px-6 lg:px-8 pt-14 pb-8">
                    {/* Summary header — pt-14 đẩy nội dung xuống dưới tab nổi để không bị che */}
                    <div className="flex items-end justify-between gap-4 mb-5 pb-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                {isQty ? 'Tổng số lượng' : 'Tổng giá trị'}
                            </p>
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-50 mt-0.5 tabular-nums">
                                {isQty ? `${total} SP` : formatCurrencyCompact(total)}
                            </p>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-300">
                            <FileText size={14} />
                            {matches.length} hợp đồng
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        {matches.map(({ contract: c, displayValue }, idx) => {
                            const rank = idx + 1;
                            const isTop = rank <= 3;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => handleOpenContractDetail(c.id, c.contractCode)}
                                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all border border-transparent hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                >
                                    {/* Số thứ tự — top 3 được tô nổi bật */}
                                    <span className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black tabular-nums ${isTop
                                        ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-500/30'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                        }`}>
                                        {rank}
                                    </span>

                                    {/* Mã + tên hợp đồng */}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                                            {c.contractCode}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate" title={c.title}>
                                            {c.title}
                                        </p>
                                    </div>

                                    {/* Giá trị */}
                                    <span className="shrink-0 text-sm font-black text-slate-900 dark:text-slate-50 tabular-nums">
                                        {isQty ? `${displayValue} SP` : formatCurrencyCompact(displayValue)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ),
        });
    };


    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        const data = payload[0].payload;
        const matchCount = data?.type ? getContractMatches(data).length : 0;
        return (
            <div
                style={getTooltipStyle()}
                className="rounded-xl shadow-xl px-4 py-3 border min-w-[180px] max-w-[300px] z-50"
            >
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 truncate">{label || data.name}</p>
                <div className="space-y-1.5">
                    {payload.map((entry: any, index: number) => {
                        const isQty = entry.dataKey === 'value' && (data.type === 'PRODUCT_QTY' || data.type === 'BRAND_QTY');
                        return (
                            <div key={index} className="flex items-center justify-between gap-4 text-sm">
                                <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium truncate">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                    {entry.name}
                                </span>
                                <span className="font-black text-slate-800 dark:text-slate-100 shrink-0">
                                    {isQty ? `${entry.value} SP` : formatCurrency(entry.value)}
                                </span>
                            </div>
                        );
                    })}
                </div>
                {matchCount > 0 && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
                        <MousePointerClick size={11} /> Bấm để xem {matchCount} hợp đồng
                    </p>
                )}
            </div>
        );
    };


    const pieTotal = useMemo(() => structureData.reduce((s, d) => s + d.value, 0), [structureData]);

    /* ═══════════ Dữ liệu cho các card BỔ SUNG ═══════════ */

    // Mục tiêu doanh thu (cho lũy kế vs target)
    const targetRevenueTotal = useMemo(() => {
        if (selectedUnit.id === 'all') {
            const businessUnits = units.filter(u => u.id !== 'all' && (u.type === 'Center' || u.type === 'Branch'));
            return businessUnits.reduce((s, u) => s + (u.target?.revenue || 0), 0);
        }
        return safeUnit.target?.revenue || 0;
    }, [selectedUnit, units, safeUnit]);

    // Phễu trạng thái hợp đồng
    const contractStatusFunnelData = useMemo(() => {
        const flow: { key: string; label: string }[] = [
            { key: 'Draft', label: 'Nháp/Chờ duyệt' },
            { key: 'Processing', label: 'Đang thực hiện' },
            { key: 'Handover', label: 'Bàn giao' },
            { key: 'Acceptance', label: 'Nghiệm thu' },
            { key: 'Completed', label: 'Hoàn thành' },
        ];
        return flow.map(s => {
            const cs = filteredContracts.filter(c => c.status === s.key);
            return { name: s.label, count: cs.length, value: cs.reduce((a, c) => a + (c.value || 0), 0) };
        }).filter(d => d.count > 0);
    }, [filteredContracts]);

    // Cơ cấu phân loại hợp đồng
    const contractClassificationData = useMemo(() => {
        const m = new Map<string, number>();
        filteredContracts.forEach(c => {
            const k = (c as any).classification || 'Chưa phân loại';
            m.set(k, (m.get(k) || 0) + (c.actualRevenue || 0));
        });
        return Array.from(m.entries())
            .map(([name, value]) => ({ name, value }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [filteredContracts]);

    // Doanh thu lũy kế vs mục tiêu
    const cumulativeVsTargetData = useMemo(() => {
        let run = 0;
        return monthlyTrendData.map((m, i) => {
            run += m.DoanhThu;
            return { name: m.name, 'Lũy kế': run, 'Mục tiêu': targetRevenueTotal * ((i + 1) / 12) };
        });
    }, [monthlyTrendData, targetRevenueTotal]);

    // Công nợ phải thu theo tuổi nợ
    const arAgingData = useMemo(() => {
        const buckets = [
            { name: 'Trong hạn', color: '#10b981', value: 0 },
            { name: '1–30 ngày', color: '#f59e0b', value: 0 },
            { name: '31–60 ngày', color: '#fb923c', value: 0 },
            { name: '61–90 ngày', color: '#f43f5e', value: 0 },
            { name: '>90 ngày', color: '#dc2626', value: 0 },
        ];
        const now = Date.now();
        filteredContracts.forEach(c => {
            const outstanding = Math.max(0, (c.invoicedAmount || 0) - (c.cashReceived || 0));
            if (outstanding <= 0) return;
            let overdue = 0;
            if (c.signedDate) {
                const due = new Date(c.signedDate);
                due.setDate(due.getDate() + ((c as any).paymentTermDays || 30));
                overdue = Math.floor((now - due.getTime()) / 86400000);
            }
            if (overdue <= 0) buckets[0].value += outstanding;
            else if (overdue <= 30) buckets[1].value += outstanding;
            else if (overdue <= 60) buckets[2].value += outstanding;
            else if (overdue <= 90) buckets[3].value += outstanding;
            else buckets[4].value += outstanding;
        });
        return buckets.filter(b => b.value > 0);
    }, [filteredContracts]);

    // Top hợp đồng tồn đọng công nợ
    const topReceivablesData = useMemo(() => {
        return filteredContracts
            .map(c => ({
                id: c.id,
                code: c.contractCode,
                title: c.title,
                value: Math.max(0, (c.invoicedAmount || 0) - (c.cashReceived || 0)),
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [filteredContracts]);

    // Tỷ lệ thu hồi theo tháng
    const collectionRateData = useMemo(() => {
        return monthlyTrendData.map((m, i) => {
            const thu = cashflowData[i]?.Thu || 0;
            const dt = m.DoanhThu || 0;
            return { name: m.name, 'Tiền về': thu, 'Doanh thu': dt, 'Tỷ lệ': dt > 0 ? Math.min(150, (thu / dt) * 100) : 0 };
        });
    }, [monthlyTrendData, cashflowData]);

    // Số dư dòng tiền lũy kế
    const cumulativeCashflowData = useMemo(() => {
        let run = 0;
        return cashflowData.map(m => { run += m.Rong; return { name: m.name, 'Số dư': run }; });
    }, [cashflowData]);

    // Ma trận hãng BCG (doanh thu × biên LN × số lượng)
    const brandMatrixData = useMemo(() => {
        // Khoá gộp = brandId|segment → mỗi hãng tách thành nhiều điểm theo phân khúc.
        const m = new Map<string, { brandId: string; segment: ProductSegment; rev: number; profit: number; qty: number }>();
        activeContracts.forEach(c => {
            const clt = contractLineTotal(c);
            (c.lineItems || []).forEach((li: any) => {
                const p = products.find(pp => pp.id === li.productId);
                if (p && p.brandId) {
                    const segment = segmentOf(p.category);
                    const key = `${p.brandId}|${segment}`;
                    const rev = lineItemRevenue(li);
                    const prop = clt > 0 ? rev / clt : 0;
                    const profit = (c.adminProfit || 0) * prop; // LNG quản trị (không cộng revProfit)
                    const cur = m.get(key) || { brandId: p.brandId, segment, rev: 0, profit: 0, qty: 0 };
                    m.set(key, { brandId: p.brandId, segment, rev: cur.rev + rev, profit: cur.profit + profit, qty: cur.qty + (li.quantity || 1) });
                }
            });
        });
        const rows = Array.from(m.entries())
            .map(([key, d]) => ({
                id: key,
                brandId: d.brandId,
                segment: d.segment,
                brandName: brands.find(b => b.id === d.brandId)?.name || 'Hãng khác',
                x: d.rev,
                y: d.rev > 0 ? (d.profit / d.rev) * 100 : 0,
                z: d.qty,
            }))
            .filter(d => d.x > 0)
            .sort((a, b) => b.x - a.x)
            .slice(0, 12);
        return labelBrandSegments(rows);
    }, [activeContracts, products, brands]);

    // Pareto doanh thu theo hãng
    const brandParetoData = useMemo(() => {
        const m = new Map<string, number>();
        activeContracts.forEach(c => {
            (c.lineItems || []).forEach((li: any) => {
                const p = products.find(pp => pp.id === li.productId);
                if (p && p.brandId) {
                    const rev = (li.outputPrice || 0) * (li.quantity || 1);
                    m.set(p.brandId, (m.get(p.brandId) || 0) + rev);
                }
            });
        });
        const arr = Array.from(m.entries())
            .map(([id, rev]) => ({ brandId: id, name: brands.find(b => b.id === id)?.name || 'Khác', value: rev }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 15);
        const total = arr.reduce((s, d) => s + d.value, 0);
        let run = 0;
        return arr.map(d => { run += d.value; return { ...d, cum: total > 0 ? (run / total) * 100 : 0 }; });
    }, [activeContracts, products, brands]);

    // Hoàn thành KPI theo nhân sự
    const employeeCompletionData = useMemo(() => {
        const actual = new Map<string, number>();

        // Tính doanh thu thực tế phân bổ cho từng nhân viên dựa trên tỷ lệ phân bổ của hợp đồng
        employees.forEach(emp => {
            let totalActualRev = 0;
            filteredContracts.forEach(c => {
                if (c.status === 'Cancelled') return;
                let fraction = 0;

                const primaryEmpId = c.salespersonId;
                
                if (primaryEmpId === emp.id) {
                    // Nếu là salesperson chính
                    const allocs: any[] = (c as any).employeeAllocations || [];
                    if (allocs.length > 0) {
                        const myAlloc = allocs.find((a: any) => a.employeeId === emp.id);
                        fraction = myAlloc ? (myAlloc.percent || 0) / 100 : 0;
                    } else {
                        fraction = 1; // 100% nếu không cấu hình phân bổ
                    }
                } else {
                    // Nếu là nhân sự phụ trợ được phân bổ doanh số
                    const allocs: any[] = (c as any).employeeAllocations || [];
                    const myAlloc = allocs.find((a: any) => a.employeeId === emp.id);
                    if (myAlloc) {
                        fraction = (myAlloc.percent || 0) / 100;
                    }
                }

                if (fraction > 0) {
                    totalActualRev += (c.actualRevenue || 0) * fraction;
                }
            });
            actual.set(emp.id, totalActualRev);
        });

        return employees
            .filter(e =>
                (visibleUnits === 'all' || (e.unitId && visibleUnits.includes(e.unitId))) &&
                (selectedUnit.id === 'all' || e.unitId === selectedUnit.id)
            )
            .map(e => {
                // Lấy chỉ tiêu năm từ employeeTargets được fetch theo năm hiện tại
                const tRecord = employeeTargets.find(t => t.employeeId === e.id);
                const target = tRecord?.revenue || 0;
                const act = actual.get(e.id) || 0;
                // Nếu không giao target (target = 0) thì pct = 0 để tránh hiển thị 100% giả tạo
                return { id: e.id, name: e.name, actual: act, target, pct: target > 0 ? (act / target) * 100 : 0 };
            })
            .filter(d => d.target > 0 || d.actual > 0)
            .sort((a, b) => {
                if (b.pct !== a.pct) {
                    return b.pct - a.pct; // Sắp xếp theo tỷ lệ hoàn thành giảm dần
                }
                return b.actual - a.actual; // Nếu tỷ lệ hoàn thành bằng nhau, sắp xếp theo doanh số thực tế giảm dần
            })
            .slice(0, 8);
    }, [filteredContracts, employees, visibleUnits, selectedUnit, employeeTargets]);

    // Khách hàng mới vs quay lại (theo tháng, trong kỳ)
    const newVsReturningData = useMemo(() => {
        const firstMonth = new Map<string, string>();
        filteredContracts.forEach(c => {
            if (!c.customerId || !c.signedDate) return;
            const mo = c.signedDate.slice(0, 7);
            if (!firstMonth.has(c.customerId) || mo < firstMonth.get(c.customerId)!) firstMonth.set(c.customerId, mo);
        });
        const months = Array.from({ length: 12 }, (_, i) => `Th.${i + 1}`);
        return months.map((label, i) => {
            const mm = (i + 1).toString().padStart(2, '0');
            const custs = new Set(
                filteredContracts.filter(c => c.signedDate && c.signedDate.split('-')[1] === mm && c.customerId).map(c => c.customerId)
            );
            let moi = 0, lai = 0;
            custs.forEach(cid => {
                const fm = firstMonth.get(cid as string);
                if (fm && fm.split('-')[1] === mm) moi++; else lai++;
            });
            return { name: label, 'Mới': moi, 'Quay lại': lai };
        });
    }, [filteredContracts]);

    // Phân bố quy mô hợp đồng
    const dealSizeData = useMemo(() => {
        const buckets = [
            { name: '<100tr', min: 0, max: 1e8, count: 0 },
            { name: '100–500tr', min: 1e8, max: 5e8, count: 0 },
            { name: '500tr–1 tỷ', min: 5e8, max: 1e9, count: 0 },
            { name: '1–5 tỷ', min: 1e9, max: 5e9, count: 0 },
            { name: '>5 tỷ', min: 5e9, max: Infinity, count: 0 },
        ];
        filteredContracts.forEach(c => {
            const v = c.value || 0;
            const b = buckets.find(bk => v >= bk.min && v < bk.max);
            if (b) b.count++;
        });
        return buckets.map(({ name, count }) => ({ name, count }));
    }, [filteredContracts]);

    // Thời gian xử lý hợp đồng (trung bình các mốc)
    const cycleTimeData = useMemo(() => {
        const diffs = { a: [] as number[], b: [] as number[], c: [] as number[] };
        const dd = (x?: string, y?: string) => (x && y) ? Math.max(0, (new Date(y).getTime() - new Date(x).getTime()) / 86400000) : null;
        filteredContracts.forEach(c => {
            const d1 = dd(c.signedDate, (c as any).handoverDate); if (d1 != null) diffs.a.push(d1);
            const d2 = dd((c as any).handoverDate, (c as any).acceptanceDate); if (d2 != null) diffs.b.push(d2);
            const d3 = dd((c as any).acceptanceDate, (c as any).completedDate); if (d3 != null) diffs.c.push(d3);
        });
        const avg = (a: number[]) => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0;
        return [
            { name: 'Ký → Bàn giao', value: avg(diffs.a) },
            { name: 'Bàn giao → Nghiệm thu', value: avg(diffs.b) },
            { name: 'Nghiệm thu → Hoàn thành', value: avg(diffs.c) },
        ].filter(d => d.value > 0);
    }, [filteredContracts]);

    // ─── Tính toán chỉ tiêu và tăng trưởng YoY (y nguyên từ Dashboard) ───
    const actualStats = useMemo(() => ({
        signing: statsData?.totalValue || 0,
        revenue: statsData?.totalRevenue || 0,
        adminProfit: statsData?.totalSigningProfit || 0,
        revProfit: statsData?.totalRevenueProfit || 0,
        cash: statsData?.totalCash || 0
    }), [statsData]);

    const displayTarget = useMemo(() => {
        if (selectedUnit.id === 'all' && rawDistData.length > 0) {
            const sumTarget: any = { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 };
            rawDistData.forEach((u: any) => {
                if (u.id === 'all') return;
                sumTarget.signing += u.target?.signing || 0;
                sumTarget.revenue += u.target?.revenue || 0;
                sumTarget.adminProfit += u.target?.adminProfit || 0;
                sumTarget.cash += u.target?.cash || 0;
            });
            sumTarget.revProfit = sumTarget.adminProfit;
            sumTarget.cash = 0;
            return sumTarget;
        }
        const t = safeUnit.target || { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 };
        return { ...t, revProfit: t.adminProfit, cash: 0 };
    }, [safeUnit, rawDistData, selectedUnit]);

    const isFilteringByPeriod = !!periodFilter;
    const effectiveTarget = isFilteringByPeriod
        ? { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 }
        : displayTarget;

    const effectiveCompanyTarget = (!isFilteringByPeriod && selectedUnit.id === 'all' && companyTarget)
        ? CompanyTargetService.toKPIPlan(companyTarget)
        : null;

    const getYoY = useCallback((metric: string) => {
        const curr = actualStats[metric as keyof typeof actualStats] || 0;
        if (yearFilter === 'All') return { value: '0.0', isUp: true, lastYearTotal: 0 };

        let startMonth = 1;
        let endMonth = new Date().getMonth() + 1;

        if (periodFilter) {
            if (periodFilter.startsWith('M')) {
                const m = parseInt(periodFilter.substring(1));
                startMonth = m;
                endMonth = m;
            } else if (periodFilter.startsWith('Q')) {
                const q = parseInt(periodFilter.substring(1));
                startMonth = (q - 1) * 3 + 1;
                endMonth = q * 3;
            }
        }

        const samePeriodData = monthlyHistLast.filter(
            h => h.month != null && h.month >= startMonth && h.month <= endMonth
        );

        let lastYearVal = 0;
        if (samePeriodData.length > 0) {
            lastYearVal = samePeriodData.reduce((sum, h) => sum + Number(h[metric as keyof typeof h] || 0), 0);
        } else {
            if (!periodFilter) {
                const currentYear = parseInt(yearFilter);
                const lastYear = currentYear - 1;
                const lastYearAnnual = historicalData.find(h => h.year === lastYear);
                if (lastYearAnnual) {
                    lastYearVal = Number(lastYearAnnual[metric as keyof HistoricalProduction] || 0);
                }
            }
        }

        if (lastYearVal === 0) return { value: '0.0', isUp: true, lastYearTotal: 0 };

        const trueLastYearVal = lastYearVal * 1_000_000;
        const growth = ((curr - trueLastYearVal) / trueLastYearVal) * 100;

        return { value: Math.abs(growth).toFixed(1), isUp: growth >= 0, lastYearTotal: trueLastYearVal };
    }, [actualStats, yearFilter, periodFilter, monthlyHistLast, historicalData]);

    // ─── Card render registry: id → JSX. Gắn với cardRegistry để gating + sắp xếp ───
    // JSX của từng card được tách theo tab tại components/analytics/cards/*.tsx;
    // dữ liệu/handler truyền xuống qua AnalyticsCardContext.
    const cardCtx: AnalyticsCardContext = {
        actualStats, effectiveTarget, effectiveCompanyTarget, getYoY,
        structureData, pieTotal, planVsActualData, contractStatusFunnelData,
        contractClassificationData, monthlyTrendData, cumulativeVsTargetData, historicalComparisonData,
        cashflowData, cumulativeCashflowData, paymentStatusData, arAgingData,
        topReceivablesData, collectionRateData,
        topBrandsData, productCategoryData, brandProfitabilityData, productQuantityData,
        brandQuantityData, brandProfitStructureData, brandMatrixData, brandParetoData,
        topCustomersData, topEmployeesData, employeeCompletionData, newVsReturningData,
        dealSizeData, cycleTimeData,
        selectedUnit, products,
        formatCurrency, formatCurrencyCompact, CustomTooltip,
        handleOpenContractDetail, handleOpenPersonnelDetail, handleOpenUnitDetail,
        handleOpenProductDetail, handleOpenBrandDetail, handleOpenCustomerDetail,
        openContractDrillDown,
    };
    const cardElements: Record<string, React.ReactNode> = {
        ...buildOverviewCards(cardCtx),
        ...buildCashflowCards(cardCtx),
        ...buildProductBrandCards(cardCtx),
        ...buildEmployeeCustomerCards(cardCtx),
    };

    /* ═══════════ Xuất Báo cáo Quản trị ra PDF ═══════════ */
    const { profile } = useAuth();
    const [showExportDialog, setShowExportDialog] = useState(false);
    const { captureCharts, printLayout } = useReportCapture(cardElements);

    /** Kỳ báo cáo theo filter đang chọn — vd "Quý 2 · Năm 2026". */
    const reportPeriodLabel = useMemo(() => {
        const y = yearFilter === 'All' ? 'Tất cả các năm' : `Năm ${yearFilter}`;
        if (!periodFilter) return y;
        if (periodFilter.startsWith('Q')) return `Quý ${periodFilter.substring(1)} · ${y}`;
        if (periodFilter.startsWith('M')) return `Tháng ${periodFilter.substring(1)} · ${y}`;
        return y;
    }, [yearFilter, periodFilter]);

    const reportUnitName = selectedUnit.id === 'all' ? 'Toàn công ty' : selectedUnit.name;

    /** Bộ lọc Hãng/SP/KH đang áp dụng — in lên trang bìa để minh bạch phạm vi số liệu. */
    const reportFilterSummary = useMemo(() => {
        const out: { label: string; value: string }[] = [];
        const names = (ids: string[], list: any[]) =>
            ids.map(id => { const f = list.find(x => x.id === id); return f?.shortName || f?.name || id; }).join(', ');
        if (selectedBrandIds.length > 0) out.push({ label: 'Lọc theo Hãng', value: names(selectedBrandIds, brands) });
        if (selectedProductIds.length > 0) out.push({ label: 'Lọc theo Sản phẩm', value: names(selectedProductIds, products) });
        if (selectedCustomerIds.length > 0) out.push({ label: 'Lọc theo Khách hàng', value: names(selectedCustomerIds, customers) });
        return out;
    }, [selectedBrandIds, selectedProductIds, selectedCustomerIds, brands, products, customers]);

    /** Tab còn ít nhất 1 card hiển thị (ngoài dải KPI) theo quyền + cá nhân hoá. */
    const reportAvailableTabs = useMemo(
        () => TAB_ORDER.filter(tab => visibleOrderedIds.some(id => CARD_BY_ID[id]?.tab === tab && id !== 'kpi-summary')),
        [visibleOrderedIds],
    );

    const handleExportReport = async (opts: ExportDialogOptions, onProgress: (m: string) => void) => {
        try {
            // Gating phân quyền: chỉ đưa KPI lợi nhuận vào PDF nếu user thấy được card kpi-summary
            const includeProfitKpi = visibleOrderedIds.includes('kpi-summary');
            const kpiDefs: { key: ReportKpiRow['key']; label: string; profit?: boolean }[] = [
                { key: 'signing', label: 'Giá trị ký kết' },
                { key: 'revenue', label: 'Doanh thu' },
                { key: 'adminProfit', label: 'LNG Quản trị', profit: true },
                { key: 'revProfit', label: 'LNG Doanh thu', profit: true },
                { key: 'cash', label: 'Dòng tiền (tiền về)' },
            ];
            const kpis: ReportKpiRow[] = kpiDefs
                .filter(d => includeProfitKpi || !d.profit)
                .map(d => {
                    // Dòng tiền không so cùng kỳ — nhất quán với KPICard trên giao diện
                    const yoy = d.key === 'cash' ? { value: '0', isUp: true, lastYearTotal: 0 } : getYoY(d.key);
                    return {
                        key: d.key,
                        label: d.label,
                        actual: actualStats[d.key] || 0,
                        target: (effectiveTarget as any)[d.key] || 0,
                        companyTarget: effectiveCompanyTarget ? ((effectiveCompanyTarget as any)[d.key] || 0) : 0,
                        yoyPct: yoy.lastYearTotal > 0 ? parseFloat(yoy.value) : null,
                        yoyUp: yoy.isUp,
                    };
                });

            // Dataset thô cho bảng số liệu — key khớp cardId trong cardRegistry
            const datasets: Record<string, any[]> = {
                'revenue-structure': structureData,
                'plan-vs-actual': planVsActualData,
                'contract-status-funnel': contractStatusFunnelData,
                'contract-classification': contractClassificationData,
                'monthly-trend': monthlyTrendData,
                'cumulative-vs-target': cumulativeVsTargetData,
                'historical-yoy': historicalComparisonData,
                'cashflow': cashflowData,
                'cumulative-cashflow': cumulativeCashflowData,
                'payment-status': paymentStatusData,
                'ar-aging': arAgingData,
                'top-receivables': topReceivablesData,
                'collection-rate-trend': collectionRateData,
                'top-brands': topBrandsData,
                'product-category': productCategoryData,
                'brand-margin': brandProfitabilityData,
                'product-qty': productQuantityData,
                'brand-qty': brandQuantityData,
                'brand-profit-structure': brandProfitStructureData,
                'brand-bcg': brandMatrixData,
                'revenue-pareto': brandParetoData,
                'top-customers': topCustomersData,
                'top-employees': topEmployeesData,
                'employee-target-completion': employeeCompletionData,
                'new-vs-returning-customers': newVsReturningData,
                'deal-size-distribution': dealSizeData,
                'cycle-time': cycleTimeData,
            };

            const cardIds = visibleOrderedIds.filter(
                id => opts.sections.includes(CARD_BY_ID[id]?.tab) && id !== 'kpi-summary',
            );
            const charts = opts.includeCharts
                ? await captureCharts(cardIds, onProgress)
                : new Map();

            // Tên file: BaoCaoQuanTri_CIC_<DonVi>_<Ky>_<yyyymmdd>.pdf (bỏ dấu tiếng Việt)
            const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]+/g, '');
            const now = new Date();
            const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            const periodPart = `${periodFilter ? slug(periodFilter) + '-' : ''}${yearFilter === 'All' ? 'TatCa' : yearFilter}`;
            const fileName = `BaoCaoQuanTri_CIC_${slug(reportUnitName)}_${periodPart}_${ymd}.pdf`;

            const reportOpts: ManagementReportOptions = {
                sections: opts.sections,
                includeCharts: opts.includeCharts,
                periodLabel: reportPeriodLabel,
                unitName: reportUnitName,
                filterSummary: reportFilterSummary,
                exportedBy: profile?.fullName || profile?.email || 'Người dùng CIC ERP',
                visibleCardIds: visibleOrderedIds,
                kpis,
                datasets,
                charts,
                fileName,
            };
            // Dynamic import — không kéo jsPDF vào bundle chính của trang
            const { generateManagementReport } = await import('../utils/managementReportPdf');
            await generateManagementReport(reportOpts, onProgress);
            toast.success('Đã xuất Báo cáo Quản trị (PDF)');
        } catch (err) {
            console.error('[Analytics] Xuất báo cáo PDF lỗi:', err);
            toast.error('Xuất báo cáo thất bại. Vui lòng thử lại.');
        }
    };

    /** Render các card của 1 tab: lọc theo quyền+lựa chọn, giữ thứ tự user. */
    const renderTabCards = (tab: AnalyticsTab) => {
        // Chế độ chỉnh sửa: hiện cả card đang ẩn (mờ) để bật/tắt & kéo-thả ngay tại chỗ.
        const ids = editMode
            ? layout
                .filter(p => allowedIds.has(p.cardId) && CARD_BY_ID[p.cardId]?.tab === tab && cardElements[p.cardId])
                .map(p => p.cardId)
            : visibleOrderedIds.filter(id => CARD_BY_ID[id]?.tab === tab && cardElements[id]);

        if (ids.length === 0) {
            return <EmptyState message={editMode ? "Không có thẻ nào trong mục này." : "Không có thẻ nào được hiển thị. Hãy bấm 'Sắp xếp' để thêm thẻ."} />;
        }

        const isVisible = (id: string) => layout.find(p => p.cardId === id)?.visible ?? true;

        return (
            <div className={`grid ${TAB_GRID_COLS[tab]} gap-6`}>
                {ids.map(id => {
                    const fullWidth = CARD_BY_ID[id]?.fullWidth;
                    if (!editMode) {
                        return (
                            <div key={id} className={fullWidth ? 'lg:col-span-full' : ''}>
                                {cardElements[id]}
                            </div>
                        );
                    }
                    const visible = isVisible(id);
                    return (
                        <div
                            key={id}
                            draggable
                            onDragStart={() => setDragCardId(id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => reorderCard(id)}
                            onDragEnd={() => setDragCardId(null)}
                            className={`relative group rounded-2xl transition-all ${fullWidth ? 'lg:col-span-full' : ''} ${
                                dragCardId === id
                                    ? 'ring-2 ring-orange-400 opacity-50'
                                    : 'ring-2 ring-dashed ring-orange-300/60 dark:ring-orange-500/40 hover:ring-orange-400'
                            }`}
                        >
                            {/* Lớp phủ chặn tương tác chart khi đang sắp xếp + làm mờ card ẩn */}
                            <div className={`pointer-events-none ${visible ? '' : 'opacity-40 grayscale'}`}>
                                {cardElements[id]}
                            </div>

                            {/* Thanh điều khiển trên card */}
                            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                                <button
                                    onClick={() => toggleCardVisible(id)}
                                    title={visible ? 'Ẩn thẻ' : 'Hiện thẻ'}
                                    className="p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-md border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                >
                                    {visible
                                        ? <Eye size={16} className="text-orange-500" />
                                        : <EyeOff size={16} className="text-slate-400" />}
                                </button>
                            </div>

                            {/* Tay cầm kéo */}
                            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur shadow-md border border-slate-200 dark:border-slate-700 cursor-grab active:cursor-grabbing">
                                <GripVertical size={16} className="text-slate-400" />
                                {!visible && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Đang ẩn</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (isLoading) return <AnalyticsSkeleton />;

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
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

                <div className="flex flex-nowrap md:flex-wrap items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 md:mx-0 md:px-0 md:overflow-visible">
                    {/* Brand Selector */}
                    <SearchableSelect
                        label="Hãng"
                        value={selectedBrandIds}
                        options={brands.map(b => ({ id: b.id, name: b.name }))}
                        onChange={(val) => {
                            setSelectedBrandIds(val);
                            setSelectedProductIds([]); // Reset products when brand selection changes
                        }}
                        placeholder="Tất cả hãng"
                    />

                    {/* Product Selector */}
                    <SearchableSelect
                        label="Sản phẩm"
                        value={selectedProductIds}
                        options={products
                            .filter(p => selectedBrandIds.length === 0 || (p.brandId && selectedBrandIds.includes(p.brandId)))
                            .map(p => ({ id: p.id, name: p.name }))}
                        onChange={setSelectedProductIds}
                        placeholder="Tất cả sản phẩm"
                    />

                    {/* Customer Selector */}
                    <SearchableSelect
                        label="Khách hàng"
                        value={selectedCustomerIds}
                        options={customers.map(c => ({ id: c.id, name: c.shortName || c.name }))}
                        onChange={setSelectedCustomerIds}
                        placeholder="Tất cả khách hàng"
                    />

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setEditMode(v => !v)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors cursor-pointer border ${
                                editMode
                                    ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                            title={editMode ? 'Xong — thoát chế độ sắp xếp' : 'Sắp xếp & ẩn/hiện thẻ trực tiếp trên giao diện'}
                        >
                            {editMode ? <Check size={18} /> : <PencilRuler size={18} />}
                            <span className="text-sm font-bold hidden sm:inline">{editMode ? 'Xong' : 'Sắp xếp'}</span>
                        </button>

                        <button
                            onClick={() => setShowExportDialog(true)}
                            title="Xuất Báo cáo Quản trị ra PDF"
                            className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 dark:bg-orange-600 text-white rounded-xl hover:bg-orange-700 dark:hover:bg-orange-700 transition-colors cursor-pointer border border-orange-600 dark:border-orange-600 shadow-sm"
                        >
                            <Download size={18} />
                            <span className="text-sm font-bold hidden sm:inline">Xuất báo cáo</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation — cuộn ngang trên mobile (không wrap), nhãn rút gọn trên màn hình hẹp */}
            <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex flex-nowrap lg:flex-wrap gap-1.5 shadow-inner overflow-x-auto no-scrollbar">
                {([
                    { id: 'overview', icon: <BarChart3 size={18} />, label: 'Tổng quan & Doanh thu', short: 'Tổng quan' },
                    { id: 'cashflow', icon: <Wallet size={18} />, label: 'Dòng tiền & Thanh toán', short: 'Dòng tiền' },
                    { id: 'product_brand', icon: <Package size={18} />, label: 'Sản phẩm & Đối tác', short: 'Sản phẩm' },
                    { id: 'employee_customer', icon: <Users size={18} />, label: 'Hiệu suất & Khách hàng', short: 'Hiệu suất' },
                ] as const).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-sm font-black transition-all duration-200 cursor-pointer shrink-0 whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md lg:scale-[1.02]'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700'
                        }`}
                    >
                        {tab.icon}
                        <span className="sm:hidden">{tab.short}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Dải gợi ý chế độ sắp xếp */}
            {editMode && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/40 text-sm">
                    <span className="flex items-center gap-2 font-bold text-orange-700 dark:text-orange-300">
                        <PencilRuler size={16} />
                        Chế độ sắp xếp: kéo thẻ để đổi vị trí, bấm <Eye size={14} className="inline" />/<EyeOff size={14} className="inline" /> để ẩn/hiện. Thay đổi được lưu tự động.
                    </span>
                    <button
                        onClick={() => { resetLayout(); }}
                        className="flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 cursor-pointer transition-colors"
                    >
                        Khôi phục mặc định
                    </button>
                </div>
            )}

            {/* Tabs Content */}
            {activeTab === 'overview' && renderTabCards('overview')}
            {activeTab === 'cashflow' && renderTabCards('cashflow')}
            {activeTab === 'product_brand' && renderTabCards('product_brand')}
            {activeTab === 'employee_customer' && renderTabCards('employee_customer')}

            {/* Drawer tùy chỉnh bố cục */}
            <AnalyticsCustomizer
                isOpen={showCustomizer}
                onClose={() => setShowCustomizer(false)}
                layout={layout}
                allowedIds={allowedIds}
                onSave={saveLayout}
                onReset={resetLayout}
                isSaving={isSaving}
            />

            {/* Hộp thoại xuất Báo cáo Quản trị (PDF) */}
            <ExportReportDialog
                isOpen={showExportDialog}
                onClose={() => setShowExportDialog(false)}
                periodLabel={reportPeriodLabel}
                unitName={reportUnitName}
                filterSummary={reportFilterSummary}
                availableTabs={reportAvailableTabs}
                onExport={handleExportReport}
            />

            {/* Layout ẩn để chụp chart khi đang xuất PDF */}
            {printLayout}
        </div>
    );
};

export default Analytics;
