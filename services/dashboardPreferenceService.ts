import { dataClient } from '../lib/dataClient';
import type { AnalyticsCardPref } from '../components/analytics/cardRegistry';

/**
 * DashboardPreferenceService — CIC ERP
 *
 * Quản lý 2 nhóm cấu hình của phân hệ Phân tích kinh doanh:
 *   - analytics_role_cards:       Admin bật/tắt card theo role.
 *   - user_dashboard_preferences: User tự chọn hiện/ẩn & sắp xếp card.
 *
 * user_id = EMPLOYEE ID (nhất quán với user_permissions / cross_unit_visibility).
 */

/** role -> Set(card_id) các card đang được BẬT cho role đó. */
export type RoleCardMap = Map<string, Set<string>>;

export const DashboardPreferenceService = {
    // ─────────────────────────────────────────────
    // Role cards (Admin config)
    // ─────────────────────────────────────────────

    /** Lấy toàn bộ cấu hình role-card → Map<role, Set<enabled card_id>>. */
    async getRoleCards(): Promise<RoleCardMap> {
        const { data, error } = await dataClient
            .from('analytics_role_cards')
            .select('role, card_id, enabled');

        if (error) {
            console.error('[DashboardPreferenceService] getRoleCards error:', error);
            return new Map();
        }

        const map: RoleCardMap = new Map();
        for (const row of data || []) {
            if (!row.enabled) continue;
            if (!map.has(row.role)) map.set(row.role, new Set());
            map.get(row.role)!.add(row.card_id);
        }
        return map;
    },

    /** Lấy raw toàn bộ rows (Admin UI cần cả trạng thái tắt). */
    async getRoleCardsRaw(): Promise<{ role: string; cardId: string; enabled: boolean }[]> {
        const { data, error } = await dataClient
            .from('analytics_role_cards')
            .select('role, card_id, enabled');

        if (error) {
            console.error('[DashboardPreferenceService] getRoleCardsRaw error:', error);
            return [];
        }
        return (data || []).map((r: any) => ({ role: r.role, cardId: r.card_id, enabled: r.enabled }));
    },

    /** Bật/tắt một card cho một role (Admin). */
    async setRoleCard(role: string, cardId: string, enabled: boolean, updatedBy?: string): Promise<void> {
        const { error } = await dataClient
            .from('analytics_role_cards')
            .upsert({
                role,
                card_id: cardId,
                enabled,
                updated_by: updatedBy || null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'role,card_id' });

        if (error) {
            console.error('[DashboardPreferenceService] setRoleCard error:', error);
            throw error;
        }
    },

    /** Ghi hàng loạt cấu hình card cho một role (Admin). */
    async setRoleCardsBulk(
        role: string,
        cards: { cardId: string; enabled: boolean }[],
        updatedBy?: string
    ): Promise<void> {
        if (cards.length === 0) return;
        const rows = cards.map(c => ({
            role,
            card_id: c.cardId,
            enabled: c.enabled,
            updated_by: updatedBy || null,
            updated_at: new Date().toISOString(),
        }));
        const { error } = await dataClient
            .from('analytics_role_cards')
            .upsert(rows, { onConflict: 'role,card_id' });

        if (error) {
            console.error('[DashboardPreferenceService] setRoleCardsBulk error:', error);
            throw error;
        }
    },

    // ─────────────────────────────────────────────
    // User preferences (per-user layout)
    // ─────────────────────────────────────────────

    /** Lấy layout cá nhân của user (mảng {cardId, visible}); null nếu chưa có. */
    async getMyPreferences(userId: string, module = 'analytics'): Promise<AnalyticsCardPref[] | null> {
        if (!userId) return null;
        const { data, error } = await dataClient
            .from('user_dashboard_preferences')
            .select('config')
            .eq('user_id', userId)
            .eq('module', module)
            .maybeSingle();

        if (error) {
            console.error('[DashboardPreferenceService] getMyPreferences error:', error);
            return null;
        }
        if (!data) return null;
        const cfg = data.config;
        return Array.isArray(cfg) ? (cfg as AnalyticsCardPref[]) : null;
    },

    /** Lưu layout cá nhân của user. */
    async saveMyPreferences(userId: string, config: AnalyticsCardPref[], module = 'analytics'): Promise<void> {
        if (!userId) return;
        const { error } = await dataClient
            .from('user_dashboard_preferences')
            .upsert({
                user_id: userId,
                module,
                config,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,module' });

        if (error) {
            console.error('[DashboardPreferenceService] saveMyPreferences error:', error);
            throw error;
        }
    },

    /** Xoá layout cá nhân (khôi phục mặc định theo role). */
    async resetMyPreferences(userId: string, module = 'analytics'): Promise<void> {
        if (!userId) return;
        const { error } = await dataClient
            .from('user_dashboard_preferences')
            .delete()
            .eq('user_id', userId)
            .eq('module', module);

        if (error) {
            console.error('[DashboardPreferenceService] resetMyPreferences error:', error);
            throw error;
        }
    },
};
