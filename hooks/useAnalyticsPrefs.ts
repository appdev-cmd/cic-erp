import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardPreferenceService } from '../services/dashboardPreferenceService';
import { usePermissionCheck } from './usePermissions';
import {
    AnalyticsCardPref,
    ALL_CARD_IDS,
    reconcileLayout,
    defaultLayout,
} from '../components/analytics/cardRegistry';

const MODULE = 'analytics';
const cacheKey = (userId: string) => `cic-analytics-layout-${userId}`;

function readCache(userId: string): AnalyticsCardPref[] | null {
    if (!userId) return null;
    try {
        const raw = localStorage.getItem(cacheKey(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function writeCache(userId: string, config: AnalyticsCardPref[]) {
    if (!userId) return;
    try {
        localStorage.setItem(cacheKey(userId), JSON.stringify(config));
    } catch {
        /* ignore quota errors */
    }
}

/**
 * Cấu hình card theo role (Admin) → Set card_id được phép cho từng role.
 * Fallback: nếu DB chưa load / rỗng → coi như tất cả card đều được phép (không ẩn).
 */
export function useAnalyticsRoleCards() {
    return useQuery({
        queryKey: ['analytics-role-cards'],
        queryFn: () => DashboardPreferenceService.getRoleCards(),
        staleTime: 10 * 60 * 1000,
    });
}

/**
 * Hook tổng hợp cho phân hệ Phân tích kinh doanh:
 *  - layout: thứ tự + hiện/ẩn card do user chọn (hybrid DB + cache local).
 *  - allowedIds: tập card role của user được phép xem (Admin config).
 *  - visibleOrderedIds: card cuối cùng để render (allowed ∩ visible, theo thứ tự).
 */
export function useAnalyticsCards() {
    const { employeeId, role } = usePermissionCheck();
    const userId = employeeId || '';
    const queryClient = useQueryClient();

    const { data: roleCards } = useAnalyticsRoleCards();

    // ── Layout cá nhân: khởi tạo từ cache để render tức thì ──
    const [layout, setLayout] = useState<AnalyticsCardPref[]>(() =>
        reconcileLayout(readCache(userId))
    );

    // Khi đổi user (đăng nhập / impersonate) → nạp lại từ cache của user đó.
    useEffect(() => {
        setLayout(reconcileLayout(readCache(userId)));
    }, [userId]);

    // ── Fetch DB rồi reconcile + ghi cache ──
    const { isLoading } = useQuery({
        queryKey: ['analytics-user-prefs', userId],
        queryFn: async () => {
            const cfg = await DashboardPreferenceService.getMyPreferences(userId, MODULE);
            const reconciled = reconcileLayout(cfg);
            setLayout(reconciled);
            writeCache(userId, reconciled);
            return reconciled;
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000,
    });

    const saveMutation = useMutation({
        mutationFn: (config: AnalyticsCardPref[]) =>
            DashboardPreferenceService.saveMyPreferences(userId, config, MODULE),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analytics-user-prefs', userId] });
        },
    });

    const resetMutation = useMutation({
        mutationFn: () => DashboardPreferenceService.resetMyPreferences(userId, MODULE),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['analytics-user-prefs', userId] });
        },
    });

    /** Lưu layout mới: cập nhật state + cache ngay (optimistic), rồi đẩy lên DB. */
    const saveLayout = useCallback((next: AnalyticsCardPref[]) => {
        const reconciled = reconcileLayout(next);
        setLayout(reconciled);
        writeCache(userId, reconciled);
        saveMutation.mutate(reconciled);
    }, [userId, saveMutation]);

    /** Khôi phục mặc định (xoá bản ghi DB + cache). */
    const resetLayout = useCallback(() => {
        const def = defaultLayout();
        setLayout(def);
        writeCache(userId, def);
        resetMutation.mutate();
    }, [userId, resetMutation]);

    // ── Tập card role được phép ──
    const allowedIds = useMemo(() => {
        // DB chưa load → không ẩn gì (fallback an toàn cho UX).
        if (!roleCards || roleCards.size === 0) return new Set(ALL_CARD_IDS);
        if (role === 'Admin') return new Set(ALL_CARD_IDS); // Admin luôn xem hết.
        const set = roleCards.get(role || '');
        // Role không có cấu hình nào trong DB → coi như chưa thiết lập → cho xem hết.
        return set && set.size > 0 ? set : new Set(ALL_CARD_IDS);
    }, [roleCards, role]);

    /** Card cuối cùng để render: được phép (role) ∩ user bật, giữ thứ tự user. */
    const visibleOrderedIds = useMemo(
        () => layout.filter(p => p.visible && allowedIds.has(p.cardId)).map(p => p.cardId),
        [layout, allowedIds]
    );

    return {
        layout,
        allowedIds,
        visibleOrderedIds,
        saveLayout,
        resetLayout,
        isSaving: saveMutation.isPending,
        isLoading,
        role,
    };
}
