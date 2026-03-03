import { dataClient } from '../lib/dataClient';
import { supabase } from '../lib/supabase';

// ─── Types ───────────────────────────────────────────────
export interface AIPermission {
    id: string;
    user_id: string;
    can_use_system_api: boolean;
    monthly_quota: number;     // 0 = unlimited
    usage_count: number;
    quota_reset_at: string;
    granted_by: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface AIPermissionWithProfile extends AIPermission {
    profile?: {
        fullName: string;
        email: string;
        role: string;
        avatarUrl?: string;
    };
}

// ─── Service ─────────────────────────────────────────────
export const aiPermissionService = {

    /** Lấy permission của user hiện tại */
    async getMyPermission(): Promise<AIPermission | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await dataClient
            .from('ai_permissions')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            console.error('[aiPermission] Error:', error.message);
            return null;
        }
        return data;
    },

    /** Admin: lấy tất cả permissions + profile info */
    async getAllPermissions(): Promise<AIPermissionWithProfile[]> {
        // Get all profiles first
        const { data: profiles, error: profileErr } = await dataClient
            .from('profiles')
            .select('id, full_name, email, role, avatar_url')
            .order('full_name');

        if (profileErr) throw profileErr;

        // Get existing AI permissions
        const { data: permissions, error: permErr } = await dataClient
            .from('ai_permissions')
            .select('*');

        if (permErr) throw permErr;

        const permMap = new Map((permissions || []).map(p => [p.user_id, p]));

        // Merge: mỗi user = 1 record (có hoặc chưa có permission)
        return (profiles || []).map(p => {
            const perm = permMap.get(p.id);
            return {
                id: perm?.id || '',
                user_id: p.id,
                can_use_system_api: perm?.can_use_system_api || false,
                monthly_quota: perm?.monthly_quota || 100,
                usage_count: perm?.usage_count || 0,
                quota_reset_at: perm?.quota_reset_at || '',
                granted_by: perm?.granted_by || null,
                notes: perm?.notes || null,
                created_at: perm?.created_at || '',
                updated_at: perm?.updated_at || '',
                profile: {
                    fullName: p.full_name,
                    email: p.email,
                    role: p.role,
                    avatarUrl: p.avatar_url,
                },
            };
        });
    },

    /** Admin: bật/tắt quyền cho user */
    async setPermission(
        userId: string,
        canUseSystemApi: boolean,
        monthlyQuota = 100,
        notes?: string
    ): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await dataClient
            .from('ai_permissions')
            .upsert({
                user_id: userId,
                can_use_system_api: canUseSystemApi,
                monthly_quota: monthlyQuota,
                granted_by: user?.id,
                notes: notes || null,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

        if (error) throw error;
    },

    /** Admin: batch update permissions */
    async batchSetPermission(
        userIds: string[],
        canUseSystemApi: boolean
    ): Promise<void> {
        const { data: { user } } = await supabase.auth.getUser();

        const records = userIds.map(uid => ({
            user_id: uid,
            can_use_system_api: canUseSystemApi,
            granted_by: user?.id,
            updated_at: new Date().toISOString(),
        }));

        const { error } = await dataClient
            .from('ai_permissions')
            .upsert(records, { onConflict: 'user_id' });

        if (error) throw error;
    },

    /** Tăng usage count (gọi sau mỗi lần dùng system API) */
    async incrementUsage(userId: string): Promise<void> {
        await dataClient.rpc('increment_ai_usage', { p_user_id: userId }).throwOnError();
    },
};
