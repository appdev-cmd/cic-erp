/**
 * Contract Anomaly Rule Engine — CIC ERP
 *
 * Bộ luật phát hiện hợp đồng bất thường. Hàm THUẦN (không phụ thuộc UI / DB),
 * dễ unit-test. Engine chỉ ĐỌC các chỉ số đã được `services/contract/contractMapper.ts`
 * tính sẵn trên mỗi Contract (margin, adminProfit, receivables, warnings...) —
 * KHÔNG tính lại tài chính.
 *
 * `DEFAULT_ANOMALY_RULES` là nguồn chân lý cho:
 *   - seed migration contract_anomaly_rules
 *   - fallback khi DB chưa load / luật mới chưa có trong DB
 */

import type { Contract } from '../types/contract';
import type {
    AnomalyRuleKey,
    AnomalyCategory,
    AnomalySeverity,
    AnomalyRuleConfig,
    AnomalyFlag,
    ContractAnomalyResult,
    AnomalyRuleMeta,
} from '../types/contractAnomaly';

// ═══════════════════════════════════════════
// Metadata tĩnh từng luật (nhãn, mô tả, tham số)
// ═══════════════════════════════════════════

export const ANOMALY_RULE_META: Record<AnomalyRuleKey, AnomalyRuleMeta> = {
    // ── A. Lợi nhuận ──
    profit_margin_high: {
        ruleKey: 'profit_margin_high', category: 'profit', label: 'Biên LN quá cao',
        description: 'Tỷ suất lợi nhuận gộp quản trị vượt ngưỡng cao — nghi nhập thiếu chi phí, cần rà soát.',
        paramDefs: [{ key: 'high', label: 'Ngưỡng cao', unit: '%', step: 1 }],
    },
    profit_margin_low: {
        ruleKey: 'profit_margin_low', category: 'profit', label: 'Biên LN quá thấp',
        description: 'Tỷ suất lợi nhuận gộp dương nhưng dưới ngưỡng thấp — hiệu quả kém.',
        paramDefs: [{ key: 'low', label: 'Ngưỡng thấp', unit: '%', step: 1 }],
    },
    profit_margin_negative: {
        ruleKey: 'profit_margin_negative', category: 'profit', label: 'Lỗ kế hoạch',
        description: 'Lợi nhuận gộp quản trị âm — chi phí dự kiến lớn hơn doanh thu dự kiến.',
        paramDefs: [],
    },
    cost_missing: {
        ruleKey: 'cost_missing', category: 'profit', label: 'Thiếu chi phí dự kiến',
        description: 'Có giá trị hợp đồng nhưng chi phí dự kiến = 0 → biên lợi nhuận ảo 100%.',
        paramDefs: [],
    },
    // ── B. Doanh thu / Chi phí ──
    expected_revenue_missing: {
        ruleKey: 'expected_revenue_missing', category: 'data', label: 'Thiếu DT dự kiến',
        description: 'Có giá trị hợp đồng nhưng doanh thu dự kiến trước thuế = 0.',
        paramDefs: [],
    },
    value_zero: {
        ruleKey: 'value_zero', category: 'data', label: 'Giá trị HĐ = 0',
        description: 'Hợp đồng không có giá trị ký kết.',
        paramDefs: [],
    },
    actual_revenue_over: {
        ruleKey: 'actual_revenue_over', category: 'data', label: 'DT thực vượt kế hoạch',
        description: 'Doanh thu thực tế vượt doanh thu dự kiến quá ngưỡng — xuất hóa đơn vượt kế hoạch.',
        paramDefs: [{ key: 'overPct', label: 'Vượt quá', unit: '%', step: 1 }],
    },
    actual_cost_over: {
        ruleKey: 'actual_cost_over', category: 'data', label: 'Chi phí thực vượt dự kiến',
        description: 'Chi phí thực tế vượt chi phí dự kiến quá ngưỡng.',
        paramDefs: [{ key: 'overPct', label: 'Vượt quá', unit: '%', step: 1 }],
    },
    line_below_cost: {
        ruleKey: 'line_below_cost', category: 'data', label: 'Bán dưới giá vốn',
        description: 'Tồn tại dòng hàng có giá bán nhỏ hơn giá vốn (đầu ra < đầu vào).',
        paramDefs: [],
    },
    // ── C. Dòng tiền / Công nợ ──
    overdue_payment: {
        ruleKey: 'overdue_payment', category: 'cashflow', label: 'Quá hạn thanh toán',
        description: 'Đã xuất hóa đơn VAT, quá hạn thanh toán mà tiền chưa về đủ.',
        paramDefs: [],
    },
    overdue_advance: {
        ruleKey: 'overdue_advance', category: 'cashflow', label: 'Quá hạn tạm ứng',
        description: 'Kế hoạch tạm ứng đã quá hạn nhưng chưa nhận được tiền.',
        paramDefs: [],
    },
    accepted_no_invoice: {
        ruleKey: 'accepted_no_invoice', category: 'cashflow', label: 'Nghiệm thu chưa xuất HĐ',
        description: 'Hợp đồng đã nghiệm thu nhưng chưa xuất hóa đơn VAT.',
        paramDefs: [],
    },
    receivable_large: {
        ruleKey: 'receivable_large', category: 'cashflow', label: 'Công nợ phải thu lớn',
        description: 'Công nợ phải thu vượt ngưỡng tiền cấu hình.',
        paramDefs: [{ key: 'threshold', label: 'Ngưỡng tiền', unit: 'đ', step: 1_000_000 }],
    },
    cash_over_invoiced: {
        ruleKey: 'cash_over_invoiced', category: 'cashflow', label: 'Thu vượt xuất HĐ',
        description: 'Tiền về thực tế lớn hơn giá trị đã xuất hóa đơn.',
        paramDefs: [{ key: 'tolPct', label: 'Dung sai', unit: '%', step: 1 }],
    },
    // ── D. Tiến độ / Vòng đời ──
    overdue_execution: {
        ruleKey: 'overdue_execution', category: 'lifecycle', label: 'Quá hạn thực hiện',
        description: 'Ngày kết thúc đã qua nhưng hợp đồng chưa nghiệm thu/hoàn thành/hủy.',
        paramDefs: [],
    },
    stale_processing: {
        ruleKey: 'stale_processing', category: 'lifecycle', label: 'Treo lâu chưa xong',
        description: 'Đang thực hiện nhưng đã ký quá số tháng cấu hình mà chưa hoàn thành.',
        paramDefs: [{ key: 'months', label: 'Số tháng', unit: 'tháng', step: 1 }],
    },
    completed_cash_gap: {
        ruleKey: 'completed_cash_gap', category: 'lifecycle', label: 'Xong nhưng tiền chưa về',
        description: 'Đã nghiệm thu/hoàn thành nhưng tiền về thấp hơn ngưỡng % giá trị.',
        paramDefs: [{ key: 'cashPct', label: 'Ngưỡng tiền về', unit: '%', step: 1 }],
    },
    // ── E. Dữ liệu / Phân bổ ──
    missing_salesperson: {
        ruleKey: 'missing_salesperson', category: 'data', label: 'Thiếu nhân sự phụ trách',
        description: 'Hợp đồng chưa gán nhân viên phụ trách.',
        paramDefs: [],
    },
    allocation_mismatch: {
        ruleKey: 'allocation_mismatch', category: 'data', label: 'Phân bổ ĐV ≠ 100%',
        description: 'Có phân bổ đơn vị nhưng tổng tỷ lệ khác 100%.',
        paramDefs: [],
    },
    missing_dates: {
        ruleKey: 'missing_dates', category: 'data', label: 'Thiếu ngày ký/bắt đầu',
        description: 'Hợp đồng thiếu ngày ký hoặc ngày bắt đầu.',
        paramDefs: [],
    },
};

/** Thứ tự hiển thị các nhóm. */
export const ANOMALY_CATEGORY_ORDER: AnomalyCategory[] = ['profit', 'data', 'cashflow', 'lifecycle'];

export const ANOMALY_CATEGORY_LABELS: Record<AnomalyCategory, string> = {
    profit: 'Lợi nhuận',
    data: 'Dữ liệu / Doanh thu - Chi phí',
    cashflow: 'Dòng tiền / Công nợ',
    lifecycle: 'Tiến độ / Vòng đời',
};

export const SEVERITY_LABELS: Record<AnomalySeverity, string> = {
    high: 'Cao', medium: 'Trung bình', low: 'Thấp',
};

const SEVERITY_RANK: Record<AnomalySeverity, number> = { high: 3, medium: 2, low: 1 };

// ═══════════════════════════════════════════
// Cấu hình mặc định (nguồn chân lý cho seed + fallback)
// ═══════════════════════════════════════════

export const DEFAULT_ANOMALY_RULES: AnomalyRuleConfig[] = [
    { ruleKey: 'profit_margin_high', enabled: true, severity: 'high', params: { high: 50 } },
    { ruleKey: 'profit_margin_low', enabled: true, severity: 'medium', params: { low: 5 } },
    { ruleKey: 'profit_margin_negative', enabled: true, severity: 'high', params: {} },
    { ruleKey: 'cost_missing', enabled: true, severity: 'high', params: {} },
    { ruleKey: 'expected_revenue_missing', enabled: true, severity: 'medium', params: {} },
    { ruleKey: 'value_zero', enabled: true, severity: 'medium', params: {} },
    { ruleKey: 'actual_revenue_over', enabled: true, severity: 'medium', params: { overPct: 10 } },
    { ruleKey: 'actual_cost_over', enabled: true, severity: 'medium', params: { overPct: 10 } },
    { ruleKey: 'line_below_cost', enabled: true, severity: 'high', params: {} },
    { ruleKey: 'overdue_payment', enabled: true, severity: 'high', params: {} },
    { ruleKey: 'overdue_advance', enabled: true, severity: 'medium', params: {} },
    { ruleKey: 'accepted_no_invoice', enabled: true, severity: 'high', params: {} },
    { ruleKey: 'receivable_large', enabled: true, severity: 'medium', params: { threshold: 500_000_000 } },
    { ruleKey: 'cash_over_invoiced', enabled: true, severity: 'medium', params: { tolPct: 1 } },
    { ruleKey: 'overdue_execution', enabled: true, severity: 'high', params: {} },
    { ruleKey: 'stale_processing', enabled: true, severity: 'medium', params: { months: 12 } },
    { ruleKey: 'completed_cash_gap', enabled: true, severity: 'medium', params: { cashPct: 90 } },
    { ruleKey: 'missing_salesperson', enabled: true, severity: 'low', params: {} },
    { ruleKey: 'allocation_mismatch', enabled: true, severity: 'medium', params: {} },
    { ruleKey: 'missing_dates', enabled: true, severity: 'low', params: {} },
];

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

const fmtVnd = (n: number): string => {
    try {
        return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
    } catch {
        return Math.round(n) + 'đ';
    }
};

const fmtPct = (n: number): string => `${(Math.round(n * 10) / 10)}%`;

/** Số tháng giữa một ngày (yyyy-mm-dd) và mốc `now`. */
const monthsSince = (dateStr: string, now: Date): number => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 0;
    return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
};

/** Lấy ngưỡng từ config; fallback giá trị mặc định nếu thiếu. */
const param = (rule: AnomalyRuleConfig, key: string, fallback: number): number => {
    const v = rule.params?.[key];
    return typeof v === 'number' && !isNaN(v) ? v : fallback;
};

// ═══════════════════════════════════════════
// Đánh giá một hợp đồng
// ═══════════════════════════════════════════

/**
 * Chạy các luật ĐANG BẬT trên một hợp đồng, trả về danh sách cờ vi phạm.
 * @param now Cho phép tiêm thời điểm để test ổn định (mặc định new Date()).
 */
export function evaluateContract(
    contract: Contract,
    rules: AnomalyRuleConfig[],
    now: Date = new Date()
): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];
    const todayStr = now.toISOString().split('T')[0];

    // Bỏ qua HĐ đã hủy — không phải bất thường cần xử lý.
    if (contract.status === 'Cancelled') return flags;

    const value = contract.value || 0;
    const margin = contract.margin ?? 0;
    const adminProfit = contract.adminProfit ?? 0;
    const estimatedCost = contract.estimatedCost || 0;
    const expectedRevenue = contract.expectedRevenue || 0;
    const actualRevenue = contract.actualRevenue || 0;
    const actualCost = contract.actualCost || 0;
    const invoicedAmount = contract.invoicedAmount || 0;
    const cashReceived = contract.cashReceived || 0;
    const receivables = contract.receivables || 0;
    const warnings = contract.warnings;

    const byKey = new Map(rules.map(r => [r.ruleKey, r]));
    const on = (key: AnomalyRuleKey): AnomalyRuleConfig | null => {
        const r = byKey.get(key);
        return r && r.enabled ? r : null;
    };
    const push = (rule: AnomalyRuleConfig, detail: string) => {
        const meta = ANOMALY_RULE_META[rule.ruleKey];
        flags.push({
            ruleKey: rule.ruleKey,
            category: meta.category,
            severity: rule.severity,
            label: meta.label,
            detail,
        });
    };

    // ── A. Lợi nhuận ──
    let r: AnomalyRuleConfig | null;

    if ((r = on('cost_missing')) && value > 0 && estimatedCost <= 0) {
        push(r, `Chi phí dự kiến = 0 trong khi giá trị HĐ ${fmtVnd(value)}`);
    }
    // margin_high & margin_negative chỉ xét khi có chi phí (tránh trùng cost_missing).
    if ((r = on('profit_margin_negative')) && adminProfit < 0) {
        push(r, `LNG quản trị âm ${fmtVnd(adminProfit)} (biên ${fmtPct(margin)})`);
    }
    if ((r = on('profit_margin_high')) && estimatedCost > 0) {
        const high = param(r, 'high', 50);
        if (margin > high) push(r, `Biên LN ${fmtPct(margin)} > ngưỡng ${fmtPct(high)}`);
    }
    if ((r = on('profit_margin_low'))) {
        const low = param(r, 'low', 5);
        if (margin >= 0 && margin < low) push(r, `Biên LN ${fmtPct(margin)} < ngưỡng ${fmtPct(low)}`);
    }

    // ── B. Doanh thu / Chi phí ──
    if ((r = on('value_zero')) && value <= 0) {
        push(r, 'Giá trị ký kết = 0');
    }
    if ((r = on('expected_revenue_missing')) && value > 0 && expectedRevenue <= 0) {
        push(r, `Doanh thu dự kiến = 0 trong khi giá trị HĐ ${fmtVnd(value)}`);
    }
    if ((r = on('actual_revenue_over')) && expectedRevenue > 0) {
        const overPct = param(r, 'overPct', 10);
        if (actualRevenue > expectedRevenue * (1 + overPct / 100)) {
            const pct = (actualRevenue / expectedRevenue - 1) * 100;
            push(r, `DT thực tế ${fmtVnd(actualRevenue)} vượt DT dự kiến ${fmtPct(pct)}`);
        }
    }
    if ((r = on('actual_cost_over')) && estimatedCost > 0 && actualCost > 0) {
        const overPct = param(r, 'overPct', 10);
        if (actualCost > estimatedCost * (1 + overPct / 100)) {
            const pct = (actualCost / estimatedCost - 1) * 100;
            push(r, `Chi phí thực tế ${fmtVnd(actualCost)} vượt dự kiến ${fmtPct(pct)}`);
        }
    }
    if ((r = on('line_below_cost')) && Array.isArray(contract.lineItems)) {
        const bad = contract.lineItems.find(
            (li) => (li.outputPrice || 0) > 0 && (li.inputPrice || 0) > 0 && li.outputPrice < li.inputPrice
        );
        if (bad) push(r, `Dòng "${bad.name || bad.productName || 'SP'}" bán ${fmtVnd(bad.outputPrice)} < giá vốn ${fmtVnd(bad.inputPrice)}`);
    }

    // ── C. Dòng tiền / Công nợ ──
    if ((r = on('overdue_payment')) && warnings?.isOverduePayment) {
        push(r, `Quá hạn thanh toán, còn phải thu ${fmtVnd(receivables)}`);
    }
    if ((r = on('overdue_advance')) && warnings?.isOverdueAdvance) {
        push(r, 'Kế hoạch tạm ứng quá hạn, chưa nhận tiền');
    }
    if ((r = on('accepted_no_invoice')) && warnings?.isAcceptedNoInvoice) {
        push(r, 'Đã nghiệm thu nhưng chưa xuất hóa đơn VAT');
    }
    if ((r = on('receivable_large'))) {
        const threshold = param(r, 'threshold', 500_000_000);
        if (receivables > threshold) push(r, `Công nợ phải thu ${fmtVnd(receivables)} > ngưỡng ${fmtVnd(threshold)}`);
    }
    if ((r = on('cash_over_invoiced')) && invoicedAmount > 0) {
        const tolPct = param(r, 'tolPct', 1);
        if (cashReceived > invoicedAmount * (1 + tolPct / 100)) {
            push(r, `Tiền về ${fmtVnd(cashReceived)} > đã xuất HĐ ${fmtVnd(invoicedAmount)}`);
        }
    }

    // ── D. Tiến độ / Vòng đời ──
    if ((r = on('overdue_execution')) && contract.endDate) {
        const settled = ['Completed', 'Cancelled', 'Acceptance'];
        if (contract.endDate < todayStr && !settled.includes(contract.status)) {
            push(r, `Hết hạn ${contract.endDate} mà trạng thái vẫn "${contract.status}"`);
        }
    }
    if ((r = on('stale_processing')) && contract.status === 'Processing' && contract.signedDate) {
        const months = param(r, 'months', 12);
        const elapsed = monthsSince(contract.signedDate, now);
        if (elapsed >= months) push(r, `Đã ký ${elapsed} tháng vẫn đang thực hiện (ngưỡng ${months} tháng)`);
    }
    if ((r = on('completed_cash_gap')) && ['Acceptance', 'Completed'].includes(contract.status) && value > 0) {
        const cashPct = param(r, 'cashPct', 90);
        if (cashReceived < value * (cashPct / 100)) {
            const got = (cashReceived / value) * 100;
            push(r, `Đã ${contract.status} nhưng mới về ${fmtPct(got)} giá trị (ngưỡng ${cashPct}%)`);
        }
    }

    // ── E. Dữ liệu / Phân bổ ──
    if ((r = on('missing_salesperson')) && !contract.salespersonId) {
        push(r, 'Chưa gán nhân viên phụ trách');
    }
    if ((r = on('allocation_mismatch')) && Array.isArray(contract.unitAllocations) && contract.unitAllocations.length > 0) {
        const total = contract.unitAllocations.reduce((s, a) => s + (a.percent || 0), 0);
        if (Math.abs(total - 100) > 0.01) push(r, `Tổng phân bổ đơn vị = ${fmtPct(total)} (≠ 100%)`);
    }
    if ((r = on('missing_dates')) && (!contract.signedDate || !contract.startDate)) {
        const miss = [!contract.signedDate && 'ngày ký', !contract.startDate && 'ngày bắt đầu'].filter(Boolean).join(', ');
        push(r, `Thiếu ${miss}`);
    }

    return flags;
}

/**
 * Đánh giá danh sách hợp đồng → chỉ giữ HĐ có ≥1 cờ, kèm mức nghiêm trọng cao nhất.
 * Sắp xếp: severity giảm dần, rồi số cờ giảm dần.
 */
export function evaluateContracts(
    contracts: Contract[],
    rules: AnomalyRuleConfig[],
    now: Date = new Date()
): ContractAnomalyResult[] {
    const results: ContractAnomalyResult[] = [];
    for (const contract of contracts) {
        const flags = evaluateContract(contract, rules, now);
        if (flags.length === 0) continue;
        const maxSeverity = flags.reduce<AnomalySeverity>(
            (acc, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[acc] ? f.severity : acc),
            'low'
        );
        results.push({ contract, flags, maxSeverity });
    }
    results.sort((a, b) => {
        const s = SEVERITY_RANK[b.maxSeverity] - SEVERITY_RANK[a.maxSeverity];
        if (s !== 0) return s;
        return b.flags.length - a.flags.length;
    });
    return results;
}

/**
 * Hợp nhất cấu hình DB lên mặc định:
 *  - Luật có trong DB → dùng enabled/severity/params của DB (merge params lên default).
 *  - Luật chưa có trong DB → giữ default (an toàn khi thêm luật mới trong code).
 */
export function mergeRuleConfig(saved: AnomalyRuleConfig[] | null | undefined): AnomalyRuleConfig[] {
    const savedMap = new Map((saved || []).map(r => [r.ruleKey, r]));
    return DEFAULT_ANOMALY_RULES.map(def => {
        const s = savedMap.get(def.ruleKey);
        if (!s) return def;
        return {
            ruleKey: def.ruleKey,
            enabled: s.enabled,
            severity: s.severity,
            params: { ...def.params, ...(s.params || {}) },
        };
    });
}
