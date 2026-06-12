-- Migration: 20260612090000_contract_anomaly_rules.sql
-- Description: Cấu hình ngưỡng cho phân hệ "Rà soát hợp đồng bất thường".
--   Admin chỉnh bật/tắt, mức độ (severity) và ngưỡng (params) cho từng luật.
--   Mọi user đọc để chạy rule engine phía client (lib/contractAnomalies.ts).
-- Quy ước: rule_key KHỚP AnomalyRuleKey trong types/contractAnomaly.ts.

CREATE TABLE IF NOT EXISTS contract_anomaly_rules (
    rule_key   TEXT PRIMARY KEY,
    enabled    BOOLEAN NOT NULL DEFAULT true,
    severity   TEXT NOT NULL DEFAULT 'medium',   -- 'high' | 'medium' | 'low'
    params     JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contract_anomaly_rules ENABLE ROW LEVEL SECURITY;

-- Đọc: mọi user đã đăng nhập (client cần ngưỡng để chạy rule engine).
DROP POLICY IF EXISTS "ContractAnomalyRules_read" ON contract_anomaly_rules;
CREATE POLICY "ContractAnomalyRules_read" ON contract_anomaly_rules
    FOR SELECT USING (auth.role() = 'authenticated');

-- Ghi: chỉ Admin (theo profiles.role).
DROP POLICY IF EXISTS "ContractAnomalyRules_admin_write" ON contract_anomaly_rules;
CREATE POLICY "ContractAnomalyRules_admin_write" ON contract_anomaly_rules
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'Admin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'Admin')
    );

-- ═══════════════════════════════════════════════════════════
-- Seed mặc định — khớp DEFAULT_ANOMALY_RULES trong lib/contractAnomalies.ts.
-- ON CONFLICT DO NOTHING: không ghi đè cấu hình Admin đã chỉnh.
-- ═══════════════════════════════════════════════════════════
INSERT INTO contract_anomaly_rules (rule_key, enabled, severity, params) VALUES
    ('profit_margin_high',       true, 'high',   '{"high": 50}'::jsonb),
    ('profit_margin_low',        true, 'medium', '{"low": 5}'::jsonb),
    ('profit_margin_negative',   true, 'high',   '{}'::jsonb),
    ('cost_missing',             true, 'high',   '{}'::jsonb),
    ('expected_revenue_missing', true, 'medium', '{}'::jsonb),
    ('value_zero',               true, 'medium', '{}'::jsonb),
    ('actual_revenue_over',      true, 'medium', '{"overPct": 10}'::jsonb),
    ('actual_cost_over',         true, 'medium', '{"overPct": 10}'::jsonb),
    ('line_below_cost',          true, 'high',   '{}'::jsonb),
    ('overdue_payment',          true, 'high',   '{}'::jsonb),
    ('overdue_advance',          true, 'medium', '{}'::jsonb),
    ('accepted_no_invoice',      true, 'high',   '{}'::jsonb),
    ('receivable_large',         true, 'medium', '{"threshold": 500000000}'::jsonb),
    ('cash_over_invoiced',       true, 'medium', '{"tolPct": 1}'::jsonb),
    ('overdue_execution',        true, 'high',   '{}'::jsonb),
    ('stale_processing',         true, 'medium', '{"months": 12}'::jsonb),
    ('completed_cash_gap',       true, 'medium', '{"cashPct": 90}'::jsonb),
    ('missing_salesperson',      true, 'low',    '{}'::jsonb),
    ('allocation_mismatch',      true, 'medium', '{}'::jsonb),
    ('missing_dates',            true, 'low',    '{}'::jsonb)
ON CONFLICT (rule_key) DO NOTHING;
