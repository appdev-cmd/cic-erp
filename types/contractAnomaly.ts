/**
 * Contract Anomaly Review — Types
 *
 * Khai báo kiểu cho phân hệ "Rà soát hợp đồng bất thường".
 * Rule engine (lib/contractAnomalies.ts) đọc các chỉ số đã được contractMapper
 * tính sẵn trên mỗi Contract và sinh ra danh sách cờ (flags) bất thường.
 */

import type { Contract } from './contract';

/** Mã định danh từng luật phát hiện. Phải KHỚP rule_key trong migration & seed. */
export type AnomalyRuleKey =
    // A. Lợi nhuận (margin)
    | 'profit_margin_high'
    | 'profit_margin_low'
    | 'profit_margin_negative'
    | 'cost_missing'
    // B. Doanh thu / Chi phí (toàn vẹn dữ liệu)
    | 'expected_revenue_missing'
    | 'value_zero'
    | 'actual_revenue_over'
    | 'actual_cost_over'
    | 'line_below_cost'
    // C. Dòng tiền / Công nợ
    | 'overdue_payment'
    | 'overdue_advance'
    | 'accepted_no_invoice'
    | 'receivable_large'
    | 'cash_over_invoiced'
    // D. Tiến độ / Vòng đời
    | 'overdue_execution'
    | 'stale_processing'
    | 'completed_cash_gap'
    // E. Dữ liệu / Phân bổ
    | 'missing_salesperson'
    | 'allocation_mismatch'
    | 'missing_dates';

/** Nhóm phân loại để gom & tô màu trên báo cáo. */
export type AnomalyCategory = 'profit' | 'data' | 'cashflow' | 'lifecycle';

/** Mức độ nghiêm trọng. */
export type AnomalySeverity = 'high' | 'medium' | 'low';

/**
 * Cấu hình một luật (lưu DB contract_anomaly_rules; fallback DEFAULT_ANOMALY_RULES).
 * `params` chứa các ngưỡng số tuỳ luật (vd { high: 50 } cho profit_margin_high).
 */
export interface AnomalyRuleConfig {
    ruleKey: AnomalyRuleKey;
    enabled: boolean;
    severity: AnomalySeverity;
    params: Record<string, number>;
}

/** Một cờ bất thường gắn với hợp đồng. */
export interface AnomalyFlag {
    ruleKey: AnomalyRuleKey;
    category: AnomalyCategory;
    severity: AnomalySeverity;
    /** Nhãn ngắn hiển thị trên badge (vd "Biên LN quá cao"). */
    label: string;
    /** Mô tả chi tiết, đã format số liệu (vd "Biên LN 73% > ngưỡng 50%"). */
    detail: string;
}

/** Kết quả rà soát của một hợp đồng (chỉ trả về HĐ có ≥1 cờ). */
export interface ContractAnomalyResult {
    contract: Contract;
    flags: AnomalyFlag[];
    /** Mức nghiêm trọng cao nhất trong các cờ — để sắp xếp & lọc nhanh. */
    maxSeverity: AnomalySeverity;
}

/** Metadata tĩnh của luật — dùng cho Settings UI & engine (không lưu DB). */
export interface AnomalyRuleMeta {
    ruleKey: AnomalyRuleKey;
    category: AnomalyCategory;
    /** Nhãn ngắn (badge). */
    label: string;
    /** Giải thích cho Admin trong Settings. */
    description: string;
    /** Khai báo các tham số ngưỡng có thể chỉnh + đơn vị hiển thị. */
    paramDefs: AnomalyParamDef[];
}

export interface AnomalyParamDef {
    key: string;
    label: string;
    /** Đơn vị hiển thị cạnh input: '%' | 'đ' | 'tháng' | 'ngày'... */
    unit?: string;
    /** Gợi ý bước nhảy cho input number. */
    step?: number;
}
