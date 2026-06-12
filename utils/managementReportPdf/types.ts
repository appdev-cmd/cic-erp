/**
 * Kiểu dữ liệu cho bộ sinh PDF "Báo cáo Quản trị Kinh doanh".
 */
import type { AnalyticsTab } from '../../components/analytics/cardRegistry';

/** Ảnh chụp 1 card biểu đồ (PNG dataURL, kích thước px gốc). */
export interface ChartImage {
    dataUrl: string;
    width: number;
    height: number;
}

/** Một dòng KPI trong bảng Tóm tắt điều hành. */
export interface ReportKpiRow {
    key: 'signing' | 'revenue' | 'adminProfit' | 'revProfit' | 'cash';
    label: string;
    actual: number;
    /** Kế hoạch nội bộ (0 = không có). */
    target: number;
    /** Chỉ tiêu ĐHCĐ (0 = không có). */
    companyTarget: number;
    /** % tăng trưởng so cùng kỳ — null nếu không có dữ liệu năm trước. */
    yoyPct: number | null;
    yoyUp: boolean;
}

/** Dataset thô của từng card, key = cardId trong cardRegistry. */
export type ReportDatasets = Record<string, any[]>;

export interface ReportFilterItem {
    label: string;
    value: string;
}

export interface ManagementReportOptions {
    /** Các tab (phần nội dung) đưa vào báo cáo, theo thứ tự TAB_ORDER. */
    sections: AnalyticsTab[];
    /** true = bản Đầy đủ (chart + bảng ưu tiên); false = bản Rút gọn (chỉ bảng). */
    includeCharts: boolean;
    /** VD: "Năm 2026" / "Quý 2 · Năm 2026". */
    periodLabel: string;
    /** Tên đơn vị hoặc "Toàn công ty". */
    unitName: string;
    /** Bộ lọc Hãng/Sản phẩm/Khách hàng đang áp dụng (hiện trên trang bìa). */
    filterSummary: ReportFilterItem[];
    /** Tên người xuất báo cáo. */
    exportedBy: string;
    /** Card hiển thị theo quyền + cá nhân hoá, đúng thứ tự user sắp xếp. */
    visibleCardIds: string[];
    /** KPI cho Phần I — đã gating theo quyền (bỏ chỉ tiêu lợi nhuận nếu không có quyền). */
    kpis: ReportKpiRow[];
    datasets: ReportDatasets;
    /** Ảnh chart đã chụp, key = cardId. Rỗng nếu bản Rút gọn. */
    charts: Map<string, ChartImage>;
    fileName: string;
}
