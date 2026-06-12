import { dataClient } from '../lib/dataClient';
import type { AnomalyRuleConfig, AnomalySeverity } from '../types/contractAnomaly';
import { mergeRuleConfig, DEFAULT_ANOMALY_RULES } from '../lib/contractAnomalies';

/**
 * ContractAnomalyConfigService — CIC ERP
 *
 * CRUD cấu hình luật rà soát hợp đồng bất thường (bảng `contract_anomaly_rules`).
 * Admin chỉnh ngưỡng/bật-tắt/severity; mọi user đọc để chạy rule engine.
 *
 * Bản ghi DB được merge lên DEFAULT_ANOMALY_RULES (mergeRuleConfig) nên luật
 * mới thêm trong code mà DB chưa có vẫn hoạt động với ngưỡng mặc định.
 */

interface AnomalyRuleRow {
    rule_key: string;
    enabled: boolean;
    severity: string;
    params: Record<string, number> | null;
}

const rowToConfig = (row: AnomalyRuleRow): AnomalyRuleConfig => ({
    ruleKey: row.rule_key as AnomalyRuleConfig['ruleKey'],
    enabled: row.enabled,
    severity: (row.severity as AnomalySeverity) || 'medium',
    params: row.params || {},
});

export const ContractAnomalyConfigService = {
    /** Lấy cấu hình đã merge với mặc định (luôn trả đủ danh mục luật hiện tại). */
    async getRules(): Promise<AnomalyRuleConfig[]> {
        const { data, error } = await dataClient
            .from('contract_anomaly_rules')
            .select('rule_key, enabled, severity, params');

        if (error) {
            console.error('[ContractAnomalyConfigService] getRules error:', error);
            return [...DEFAULT_ANOMALY_RULES];
        }
        const saved = (data || []).map((r: any) => rowToConfig(r as AnomalyRuleRow));
        return mergeRuleConfig(saved);
    },

    /** Ghi hàng loạt cấu hình (Admin lưu cả bảng). */
    async saveRules(rules: AnomalyRuleConfig[], updatedBy?: string): Promise<void> {
        if (rules.length === 0) return;
        const rows = rules.map(r => ({
            rule_key: r.ruleKey,
            enabled: r.enabled,
            severity: r.severity,
            params: r.params || {},
            updated_by: updatedBy || null,
            updated_at: new Date().toISOString(),
        }));
        const { error } = await dataClient
            .from('contract_anomaly_rules')
            .upsert(rows, { onConflict: 'rule_key' });

        if (error) {
            console.error('[ContractAnomalyConfigService] saveRules error:', error);
            throw error;
        }
    },

    /** Khôi phục mặc định: xóa toàn bộ bản ghi (getRules sẽ fallback default). */
    async resetRules(): Promise<void> {
        const { error } = await dataClient
            .from('contract_anomaly_rules')
            .delete()
            .neq('rule_key', '__none__'); // xóa tất cả

        if (error) {
            console.error('[ContractAnomalyConfigService] resetRules error:', error);
            throw error;
        }
    },
};
