import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { aiPermissionService, AIPermission } from '../services/aiPermissionService';
import type { GeminiApiSource } from '../services/aiExtractService';

interface UseAIPermissionResult {
    /** User được phép dùng API hệ thống? */
    canUseSystemApi: boolean;
    /** User đã cấu hình key cá nhân? */
    hasPersonalKey: boolean;
    /** API source tối ưu: hệ thống nếu có quyền, ngược lại cá nhân */
    defaultApiSource: GeminiApiSource;
    /** Thông tin permission chi tiết */
    permission: AIPermission | null;
    /** Đang loading */
    isLoading: boolean;
    /** Có thể dùng AI? (có ít nhất 1 source) */
    canUseAI: boolean;
    /** Refresh lại permission */
    refresh: () => void;
}

const PERSONAL_GEMINI_KEY = 'cic_custom_gemini_key';

export function useAIPermission(): UseAIPermissionResult {
    const { profile } = useAuth();
    const [permission, setPermission] = useState<AIPermission | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPermission = useCallback(async () => {
        if (!profile) {
            setIsLoading(false);
            return;
        }
        try {
            const perm = await aiPermissionService.getMyPermission();
            setPermission(perm);
        } catch (err) {
            console.error('[useAIPermission] Error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [profile?.id]);

    useEffect(() => {
        fetchPermission();
    }, [fetchPermission]);

    // Admin luôn có quyền
    const isAdmin = profile?.role === 'Admin';
    const canUseSystemApi = isAdmin || (permission?.can_use_system_api === true);

    // Check personal key
    let hasPersonalKey = false;
    try {
        hasPersonalKey = !!localStorage.getItem(PERSONAL_GEMINI_KEY);
    } catch { /* ignore */ }

    // Auto-select source
    const defaultApiSource: GeminiApiSource = canUseSystemApi ? 'system' : (hasPersonalKey ? 'personal' : 'system');

    // Can use AI if has at least one source
    const canUseAI = canUseSystemApi || hasPersonalKey;

    return {
        canUseSystemApi,
        hasPersonalKey,
        defaultApiSource,
        permission,
        isLoading,
        canUseAI,
        refresh: fetchPermission,
    };
}
