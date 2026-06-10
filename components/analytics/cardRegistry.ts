/**
 * Analytics Card Registry — CIC ERP
 *
 * Khai báo tập trung toàn bộ "card" của phân hệ Phân tích kinh doanh (BI).
 * Dùng chung cho 3 mục đích:
 *   1. Phân quyền theo role  (analytics_role_cards)  — Admin bật/tắt card cho mỗi role.
 *   2. Cá nhân hoá           (user_dashboard_preferences) — user chọn hiện/ẩn & sắp xếp.
 *   3. Render động trong Analytics.tsx theo thứ tự đã chọn.
 *
 * ⚠️ `id` phải KHỚP với card_id trong migration 20260609120000_analytics_card_config.sql.
 */

export type AnalyticsTab = 'overview' | 'cashflow' | 'product_brand' | 'employee_customer';

/** Mức độ nhạy cảm — chỉ dùng làm gợi ý/nhóm hiển thị (mặc định thực tế nằm ở DB seed). */
export type CardSensitivity = 'general' | 'profit';

export interface AnalyticsCardMeta {
    id: string;
    /** Nhãn hiển thị trong panel cấu hình. */
    title: string;
    /** Mô tả ngắn. */
    subtitle?: string;
    /** Tab chứa card. */
    tab: AnalyticsTab;
    /** Card chiếm full chiều ngang của lưới. */
    fullWidth?: boolean;
    /** Phân loại nhạy cảm (general / profit). */
    sensitivity: CardSensitivity;
}

export const TAB_LABELS: Record<AnalyticsTab, string> = {
    overview: 'Tổng quan & Doanh thu',
    cashflow: 'Dòng tiền & Thanh toán',
    product_brand: 'Sản phẩm & Đối tác',
    employee_customer: 'Hiệu suất & Khách hàng',
};

export const TAB_ORDER: AnalyticsTab[] = ['overview', 'cashflow', 'product_brand', 'employee_customer'];

/** Số cột lưới mỗi tab (lg breakpoint). */
export const TAB_GRID_COLS: Record<AnalyticsTab, string> = {
    overview: 'grid-cols-1 lg:grid-cols-2',
    cashflow: 'grid-cols-1 lg:grid-cols-3',
    product_brand: 'grid-cols-1 lg:grid-cols-3',
    employee_customer: 'grid-cols-1 lg:grid-cols-2',
};

export const ANALYTICS_CARDS: AnalyticsCardMeta[] = [
    // ── Tab: Tổng quan ──
    { id: 'kpi-summary', title: 'Dải KPI điều hành', subtitle: 'Ký kết · Doanh thu · LNG QT · LNG DT · Dòng tiền', tab: 'overview', fullWidth: true, sensitivity: 'profit' },
    { id: 'revenue-structure', title: 'Cơ cấu Doanh thu', subtitle: 'Tỷ trọng đóng góp doanh thu', tab: 'overview', sensitivity: 'general' },
    { id: 'plan-vs-actual', title: 'Kế hoạch vs Thực tế', subtitle: 'So sánh doanh thu với mục tiêu', tab: 'overview', sensitivity: 'general' },
    { id: 'contract-status-funnel', title: 'Phễu trạng thái Hợp đồng', subtitle: 'Số lượng & giá trị theo giai đoạn', tab: 'overview', sensitivity: 'general' },
    { id: 'contract-classification', title: 'Cơ cấu Phân loại HĐ', subtitle: 'Tỷ trọng doanh thu theo phân loại', tab: 'overview', sensitivity: 'general' },
    { id: 'monthly-trend', title: 'Xu hướng theo tháng', subtitle: 'Biến động Doanh thu & Lợi nhuận', tab: 'overview', fullWidth: true, sensitivity: 'general' },
    { id: 'cumulative-vs-target', title: 'Doanh thu Lũy kế vs Mục tiêu', subtitle: 'Tiến độ tích lũy so kế hoạch', tab: 'overview', fullWidth: true, sensitivity: 'general' },
    { id: 'historical-yoy', title: 'So sánh Cùng kỳ (Lịch sử)', subtitle: 'Tăng trưởng qua các năm (gồm LNG)', tab: 'overview', fullWidth: true, sensitivity: 'profit' },

    // ── Tab: Dòng tiền ──
    { id: 'cashflow', title: 'Dòng tiền Thu – Chi', subtitle: 'Luồng tiền vào/ra hàng tháng', tab: 'cashflow', fullWidth: true, sensitivity: 'general' },
    { id: 'cumulative-cashflow', title: 'Số dư Dòng tiền Lũy kế', subtitle: 'Tích lũy dòng tiền ròng', tab: 'cashflow', fullWidth: true, sensitivity: 'general' },
    { id: 'payment-status', title: 'Tiến độ Thanh toán', subtitle: 'Tình trạng thu hồi doanh thu', tab: 'cashflow', sensitivity: 'general' },
    { id: 'ar-aging', title: 'Công nợ theo tuổi nợ', subtitle: 'Số tiền chưa thu theo ngày quá hạn', tab: 'cashflow', sensitivity: 'general' },
    { id: 'top-receivables', title: 'Top HĐ tồn đọng công nợ', subtitle: 'Giá trị chưa thu lớn nhất', tab: 'cashflow', sensitivity: 'general' },
    { id: 'collection-rate-trend', title: 'Tỷ lệ Thu hồi theo tháng', subtitle: 'Tiền về so với doanh thu', tab: 'cashflow', fullWidth: true, sensitivity: 'general' },

    // ── Tab: Sản phẩm & Đối tác ──
    { id: 'top-brands', title: 'Top Hãng / Đối tác', subtitle: 'Đóng góp doanh thu nhiều nhất', tab: 'product_brand', sensitivity: 'general' },
    { id: 'product-category', title: 'Nhóm Sản Phẩm', subtitle: 'Tỷ trọng doanh thu theo nhóm', tab: 'product_brand', sensitivity: 'general' },
    { id: 'brand-margin', title: 'Tỷ suất Lợi nhuận', subtitle: 'Top biên lợi nhuận (%) theo Hãng', tab: 'product_brand', sensitivity: 'profit' },
    { id: 'product-qty', title: 'Số lượng Sản phẩm đã bán', subtitle: 'Top họ sản phẩm bán chạy theo SL', tab: 'product_brand', sensitivity: 'general' },
    { id: 'brand-qty', title: 'Số lượng Hãng đã bán', subtitle: 'Top hãng bán chạy theo SL', tab: 'product_brand', sensitivity: 'general' },
    { id: 'brand-profit-structure', title: 'Cơ cấu Lợi nhuận Hãng', subtitle: 'Tỷ trọng đóng góp lợi nhuận gộp', tab: 'product_brand', sensitivity: 'profit' },
    { id: 'brand-bcg', title: 'Ma trận Hãng (DT × Biên LN)', subtitle: 'Định vị hãng theo DT và biên LN', tab: 'product_brand', fullWidth: true, sensitivity: 'profit' },
    { id: 'revenue-pareto', title: 'Pareto Doanh thu theo Hãng', subtitle: 'Mức độ tập trung doanh thu (80/20)', tab: 'product_brand', fullWidth: true, sensitivity: 'general' },

    // ── Tab: Hiệu suất & Khách hàng ──
    { id: 'top-customers', title: 'Top Khách hàng', subtitle: 'Hàng đầu theo doanh thu', tab: 'employee_customer', sensitivity: 'general' },
    { id: 'top-employees', title: 'Hiệu suất Nhân sự', subtitle: 'Top doanh số theo nhân viên', tab: 'employee_customer', sensitivity: 'general' },
    { id: 'unit-performance', title: 'Hiệu suất theo Đơn vị', subtitle: 'Doanh thu thực tế so với chỉ tiêu theo đơn vị', tab: 'employee_customer', fullWidth: true, sensitivity: 'general' },
    { id: 'employee-target-completion', title: 'Hoàn thành KPI Nhân sự', subtitle: 'Thực tế so với chỉ tiêu', tab: 'employee_customer', fullWidth: true, sensitivity: 'general' },
    { id: 'new-vs-returning-customers', title: 'Khách hàng Mới vs Quay lại', subtitle: 'Khách phát sinh HĐ theo tháng', tab: 'employee_customer', fullWidth: true, sensitivity: 'general' },
    { id: 'deal-size-distribution', title: 'Phân bố Quy mô Hợp đồng', subtitle: 'Số lượng HĐ theo khoảng giá trị', tab: 'employee_customer', sensitivity: 'general' },
    { id: 'cycle-time', title: 'Thời gian xử lý Hợp đồng', subtitle: 'Số ngày trung bình giữa các mốc', tab: 'employee_customer', sensitivity: 'general' },
];

export const ALL_CARD_IDS = ANALYTICS_CARDS.map(c => c.id);
export const CARD_BY_ID: Record<string, AnalyticsCardMeta> = Object.fromEntries(
    ANALYTICS_CARDS.map(c => [c.id, c])
);

/** Một mục cấu hình layout cá nhân của user. */
export interface AnalyticsCardPref {
    cardId: string;
    visible: boolean;
}

/** Layout mặc định: tất cả card theo thứ tự registry, đều hiện. */
export function defaultLayout(): AnalyticsCardPref[] {
    return ANALYTICS_CARDS.map(c => ({ cardId: c.id, visible: true }));
}

/**
 * Hợp nhất config đã lưu với registry hiện tại:
 *  - Bỏ card không còn tồn tại.
 *  - Thêm card mới (chưa có trong config) vào cuối, mặc định hiện.
 * Giữ nguyên thứ tự & trạng thái visible mà user đã chọn.
 */
export function reconcileLayout(saved: AnalyticsCardPref[] | null | undefined): AnalyticsCardPref[] {
    const validSaved = (saved || []).filter(p => CARD_BY_ID[p.cardId]);
    const seen = new Set(validSaved.map(p => p.cardId));
    const appended = ANALYTICS_CARDS
        .filter(c => !seen.has(c.id))
        .map(c => ({ cardId: c.id, visible: true }));
    const merged = [...validSaved, ...appended];
    // Nếu rỗng hoàn toàn → layout mặc định.
    return merged.length > 0 ? merged : defaultLayout();
}
