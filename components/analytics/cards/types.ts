import React from 'react';
import type { Unit, Product } from '../../../types';

/**
 * Context truyền từ Analytics.tsx xuống các builder card theo tab.
 * Dữ liệu (datasets) được tính bằng useMemo ở Analytics.tsx — builder chỉ render JSX.
 */
export interface AnalyticsCardContext {
    /* ── Dữ liệu KPI ── */
    actualStats: any;
    effectiveTarget: any;
    effectiveCompanyTarget: any;
    getYoY: (metric: string) => { value: string; isUp: boolean; lastYearTotal: number };

    /* ── Datasets theo card (tab Tổng quan) ── */
    structureData: any[];
    pieTotal: number;
    planVsActualData: any[];
    contractStatusFunnelData: any[];
    contractClassificationData: any[];
    monthlyTrendData: any[];
    cumulativeVsTargetData: any[];
    historicalComparisonData: any[];

    /* ── Datasets (tab Dòng tiền) ── */
    cashflowData: any[];
    cumulativeCashflowData: any[];
    paymentStatusData: any[];
    arAgingData: any[];
    topReceivablesData: any[];
    collectionRateData: any[];

    /* ── Datasets (tab Sản phẩm & Đối tác) ── */
    topBrandsData: any[];
    productCategoryData: any[];
    brandProfitabilityData: any[];
    productQuantityData: any[];
    brandQuantityData: any[];
    brandProfitStructureData: any[];
    brandMatrixData: any[];
    brandParetoData: any[];

    /* ── Datasets (tab Hiệu suất & Khách hàng) ── */
    topCustomersData: any[];
    topEmployeesData: any[];
    employeeCompletionData: any[];
    newVsReturningData: any[];
    dealSizeData: any[];
    cycleTimeData: any[];

    /* ── Khác ── */
    selectedUnit: Unit;
    products: Product[];

    /* ── Formatter ── */
    formatCurrency: (val: number) => string;
    formatCurrencyCompact: (val: number) => string;

    /** Tooltip có đếm số HĐ liên quan + gợi ý drill-down (định nghĩa trong Analytics.tsx). */
    CustomTooltip: React.FC<any>;

    /* ── Handler mở slide panel / drill-down ── */
    handleOpenContractDetail: (id: string, code: string) => void;
    handleOpenPersonnelDetail: (id: string) => void;
    handleOpenUnitDetail: (id: string) => void;
    handleOpenProductDetail: (id: string) => void;
    handleOpenBrandDetail: (id: string) => void;
    handleOpenCustomerDetail: (id: string) => void;
    openContractDrillDown: (data: any) => void;
}
