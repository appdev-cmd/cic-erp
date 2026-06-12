import { describe, it, expect } from 'vitest';
import {
    evaluateContract,
    evaluateContracts,
    DEFAULT_ANOMALY_RULES,
    mergeRuleConfig,
} from '../../lib/contractAnomalies';
import type { Contract } from '../../types/contract';
import type { AnomalyRuleKey } from '../../types/contractAnomaly';

const NOW = new Date('2026-06-12T00:00:00Z');

/** Hợp đồng "sạch" — không vi phạm luật nào. */
const baseContract = (over: Partial<Contract> = {}): Contract => ({
    id: 'c1',
    contractCode: 'HD001',
    title: 'Test',
    contractType: 'HĐ',
    customerId: 'cust1',
    partyA: 'A', partyB: 'B', clientInitials: 'AB',
    contacts: [], content: '',
    signedDate: '2026-05-01', startDate: '2026-05-01', endDate: '2026-12-31',
    value: 1_000_000_000,
    estimatedCost: 800_000_000,
    actualRevenue: 900_000_000,
    expectedRevenue: 900_000_000,
    margin: 11.1,
    adminProfit: 100_000_000,
    actualCost: 0,
    invoicedAmount: 0,
    cashReceived: 0,
    receivables: 0,
    status: 'Processing',
    stage: 'Signed',
    category: 'Mới',
    unitId: 'u1',
    salespersonId: 'e1',
    lineItems: [],
    warnings: { isOverdueAdvance: false, isOverduePayment: false, isAcceptedNoInvoice: false },
    ...over,
} as Contract);

const keys = (c: Contract): AnomalyRuleKey[] =>
    evaluateContract(c, DEFAULT_ANOMALY_RULES, NOW).map(f => f.ruleKey);

describe('contractAnomalies — rule engine', () => {
    it('hợp đồng sạch không sinh cờ nào', () => {
        expect(keys(baseContract())).toEqual([]);
    });

    it('A1: biên LN quá cao (>50%) — ngưỡng biên', () => {
        expect(keys(baseContract({ margin: 50 }))).not.toContain('profit_margin_high');
        expect(keys(baseContract({ margin: 51 }))).toContain('profit_margin_high');
    });

    it('A2: biên LN quá thấp (<5%, không âm)', () => {
        expect(keys(baseContract({ margin: 3 }))).toContain('profit_margin_low');
        expect(keys(baseContract({ margin: 5 }))).not.toContain('profit_margin_low');
    });

    it('A3: lỗ kế hoạch (adminProfit < 0)', () => {
        expect(keys(baseContract({ adminProfit: -10, margin: -1 }))).toContain('profit_margin_negative');
    });

    it('A4: thiếu chi phí dự kiến', () => {
        const f = keys(baseContract({ estimatedCost: 0, margin: 100 }));
        expect(f).toContain('cost_missing');
        // margin_high không kích hoạt vì estimatedCost <= 0 (tránh trùng)
        expect(f).not.toContain('profit_margin_high');
    });

    it('B5: dòng hàng bán dưới giá vốn', () => {
        const c = baseContract({
            lineItems: [{ id: 'l1', name: 'X', quantity: 1, supplier: '', inputPrice: 100, outputPrice: 80, directCosts: 0, vatRate: 10 }] as any,
        });
        expect(keys(c)).toContain('line_below_cost');
    });

    it('C: đọc đúng cờ warnings', () => {
        expect(keys(baseContract({ warnings: { isOverduePayment: true, isOverdueAdvance: false, isAcceptedNoInvoice: false } }))).toContain('overdue_payment');
        expect(keys(baseContract({ warnings: { isOverduePayment: false, isOverdueAdvance: false, isAcceptedNoInvoice: true } }))).toContain('accepted_no_invoice');
    });

    it('C4: công nợ phải thu lớn (>500tr mặc định)', () => {
        expect(keys(baseContract({ receivables: 600_000_000 }))).toContain('receivable_large');
        expect(keys(baseContract({ receivables: 400_000_000 }))).not.toContain('receivable_large');
    });

    it('D1: quá hạn thực hiện', () => {
        expect(keys(baseContract({ endDate: '2026-01-01', status: 'Processing' }))).toContain('overdue_execution');
        expect(keys(baseContract({ endDate: '2026-01-01', status: 'Completed' }))).not.toContain('overdue_execution');
    });

    it('D2: hợp đồng treo lâu (>12 tháng)', () => {
        expect(keys(baseContract({ signedDate: '2024-01-01', status: 'Processing' }))).toContain('stale_processing');
    });

    it('E1/E3: thiếu nhân sự & ngày', () => {
        expect(keys(baseContract({ salespersonId: '' }))).toContain('missing_salesperson');
        expect(keys(baseContract({ signedDate: '' }))).toContain('missing_dates');
    });

    it('E2: phân bổ đơn vị ≠ 100%', () => {
        const c = baseContract({ unitAllocations: [{ unitId: 'u1', employeeId: 'e1', percent: 60, role: 'lead' }] as any });
        expect(keys(c)).toContain('allocation_mismatch');
    });

    it('HĐ đã hủy bị bỏ qua hoàn toàn', () => {
        expect(keys(baseContract({ status: 'Cancelled', margin: 99, salespersonId: '' }))).toEqual([]);
    });

    it('luật bị tắt thì không kích hoạt', () => {
        const rules = DEFAULT_ANOMALY_RULES.map(r =>
            r.ruleKey === 'profit_margin_high' ? { ...r, enabled: false } : r
        );
        const flags = evaluateContract(baseContract({ margin: 80 }), rules, NOW).map(f => f.ruleKey);
        expect(flags).not.toContain('profit_margin_high');
    });

    it('evaluateContracts lọc HĐ sạch & sắp xếp theo severity', () => {
        const dirty = baseContract({ id: 'dirty', warnings: { isOverduePayment: true, isOverdueAdvance: false, isAcceptedNoInvoice: false } });
        const clean = baseContract({ id: 'clean' });
        const res = evaluateContracts([clean, dirty], DEFAULT_ANOMALY_RULES, NOW);
        expect(res).toHaveLength(1);
        expect(res[0].contract.id).toBe('dirty');
        expect(res[0].maxSeverity).toBe('high');
    });
});

describe('mergeRuleConfig', () => {
    it('giữ default khi DB rỗng', () => {
        expect(mergeRuleConfig(null)).toHaveLength(DEFAULT_ANOMALY_RULES.length);
    });

    it('ghi đè enabled/severity/params từ DB', () => {
        const merged = mergeRuleConfig([
            { ruleKey: 'profit_margin_high', enabled: false, severity: 'low', params: { high: 70 } },
        ]);
        const rule = merged.find(r => r.ruleKey === 'profit_margin_high')!;
        expect(rule.enabled).toBe(false);
        expect(rule.severity).toBe('low');
        expect(rule.params.high).toBe(70);
    });
});
