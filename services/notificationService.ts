/**
 * Notification Service
 * ====================
 * CRUD operations for in-app notifications.
 * Works alongside TelegramNotificationService for dual-channel notifications.
 *
 * RECIPIENT RULES:
 * - Only users DIRECTLY related to the contract receive notifications:
 *   1. NV phụ trách chính (employee_id)
 *   2. NV phân bổ (employee_allocations)
 *   3. Trưởng phòng (UnitLeader) of the contract's unit
 * - The user who performed the action does NOT receive a notification.
 * - Leadership/Admin do NOT receive all notifications (only if they're related).
 */

import { dataClient as supabase } from '../lib/dataClient';
import { NotificationType, NotificationItem } from '../types';

const PAGE_SIZE = 20;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Resolve user IDs (auth.users) from employee IDs.
 * employees → profiles.employee_id → profiles.id (= auth user id)
 */
async function resolveUserIdsFromEmployeeIds(employeeIds: string[]): Promise<string[]> {
    if (employeeIds.length === 0) return [];

    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .in('employee_id', employeeIds);

    if (error) {
        console.warn('[NotificationService] resolveUserIds error:', error.message);
        return [];
    }

    return data?.map(p => p.id) || [];
}

/**
 * Get user IDs for UnitLeaders of a specific unit.
 */
async function getUnitLeaderUserIds(unitId: string): Promise<string[]> {
    if (!unitId || unitId === 'all') return [];

    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('unit_id', unitId)
        .eq('role', 'UnitLeader');

    if (error) {
        console.warn('[NotificationService] getUnitLeaderUserIds error:', error.message);
        return [];
    }

    return data?.map(p => p.id) || [];
}

/**
 * Resolve all recipient user IDs for a contract notification.
 * Only users DIRECTLY related to the contract:
 * 1. NV phụ trách chính
 * 2. NV phân bổ
 * 3. Trưởng phòng (UnitLeader) of the contract's unit
 */
async function getContractRecipientUserIds(contractId: string): Promise<string[]> {
    try {
        const userIds = new Set<string>();

        // 1. Get contract employee info and unit
        const { data: contract, error } = await supabase
            .from('contracts')
            .select('employee_id, employee_allocations, unit_id')
            .eq('id', contractId)
            .single();

        if (error || !contract) {
            console.warn('[NotificationService] Contract not found:', contractId, error?.message);
            return [];
        }

        const employeeIds: string[] = [];

        // NV phụ trách chính
        if (contract.employee_id) {
            employeeIds.push(contract.employee_id);
        }

        // NV phân bổ
        if (contract.employee_allocations) {
            const allocations = typeof contract.employee_allocations === 'string'
                ? JSON.parse(contract.employee_allocations)
                : contract.employee_allocations;
            if (Array.isArray(allocations)) {
                for (const alloc of allocations) {
                    if (alloc.employeeId) employeeIds.push(alloc.employeeId);
                }
            }
        }

        // 2. Resolve employee IDs → user IDs
        const relatedUserIds = await resolveUserIdsFromEmployeeIds(employeeIds);
        relatedUserIds.forEach(id => userIds.add(id));

        // 3. Add UnitLeader(s) of the contract's unit
        const leaderIds = await getUnitLeaderUserIds(contract.unit_id);
        leaderIds.forEach(id => userIds.add(id));

        console.log(`[NotificationService] Recipients for ${contractId}: ${userIds.size} users (${employeeIds.length} employees + ${leaderIds.length} leaders)`);

        return Array.from(userIds);
    } catch (err) {
        console.error('[NotificationService] Error resolving recipients:', err);
        return [];
    }
}

// ============================================================================
// CRUD
// ============================================================================

export const NotificationService = {
    /**
     * Create a single in-app notification.
     */
    async create(
        userId: string,
        type: NotificationType,
        title: string,
        message: string,
        metadata: Record<string, any> = {}
    ): Promise<void> {
        try {
            const { error } = await supabase
                .from('notifications')
                .insert({ user_id: userId, type, title, message, metadata });

            if (error) {
                console.warn('[NotificationService] Insert error:', error.message, error.code, error.details);
            }
        } catch (err) {
            console.warn('[NotificationService] Create failed:', err);
        }
    },

    /**
     * Create notifications for multiple users at once.
     */
    async createBulk(
        userIds: string[],
        type: NotificationType,
        title: string,
        message: string,
        metadata: Record<string, any> = {}
    ): Promise<void> {
        if (userIds.length === 0) return;

        try {
            const rows = userIds.map(user_id => ({
                user_id,
                type,
                title,
                message,
                metadata,
            }));

            console.log(`[NotificationService] Inserting ${rows.length} notifications for type: ${type}`);

            const { error } = await supabase
                .from('notifications')
                .insert(rows);

            if (error) {
                console.warn('[NotificationService] Bulk insert error:', error.message, error.code, error.details);
            } else {
                console.log(`[NotificationService] ✅ ${rows.length} notifications created`);
            }
        } catch (err) {
            console.warn('[NotificationService] CreateBulk failed:', err);
        }
    },

    /**
     * Get paginated notifications for a user.
     */
    async getNotifications(userId: string, page: number = 0): Promise<{ data: NotificationItem[]; hasMore: boolean }> {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE;

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('[NotificationService] Fetch error:', error.message);
            return { data: [], hasMore: false };
        }

        // If we got PAGE_SIZE+1 items, there are more
        const hasMore = (data?.length || 0) > PAGE_SIZE;
        const items = hasMore ? data!.slice(0, PAGE_SIZE) : (data || []);

        return { data: items as NotificationItem[], hasMore };
    },

    /**
     * Get unread notification count for a user.
     */
    async getUnreadCount(userId: string): Promise<number> {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        if (error) {
            console.error('[NotificationService] Count error:', error.message);
            return 0;
        }

        return count || 0;
    },

    /**
     * Mark a single notification as read.
     */
    async markAsRead(notificationId: string): Promise<void> {
        await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId);
    },

    /**
     * Mark all notifications as read for a user.
     */
    async markAllAsRead(userId: string): Promise<void> {
        await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('is_read', false);
    },

    /**
     * Delete a notification.
     */
    async deleteNotification(notificationId: string): Promise<void> {
        await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);
    },

    // ========================================================================
    // HIGH-LEVEL DISPATCHERS (used by contract/payment CRUD)
    // ========================================================================

    /**
     * Notify all RELEVANT users about a contract event.
     * Recipients: NV phụ trách + NV phân bổ + Trưởng phòng của đơn vị.
     * The user who triggered the action is excluded.
     */
    async notifyContractEvent(
        contractId: string,
        type: NotificationType,
        title: string,
        message: string,
        excludeUserId?: string
    ): Promise<void> {
        try {
            let userIds = await getContractRecipientUserIds(contractId);

            // Exclude the user who performed the action (they already know)
            if (excludeUserId) {
                userIds = userIds.filter(id => id !== excludeUserId);
            }

            if (userIds.length === 0) {
                console.log('[NotificationService] No recipients for contract event:', contractId);
                return;
            }

            await this.createBulk(userIds, type, title, message, { contractId });
        } catch (err) {
            // Fire-and-forget: never break the main flow
            console.warn('[NotificationService] notifyContractEvent failed:', err);
        }
    },

    /**
     * Notify all RELEVANT users about a payment event.
     */
    async notifyPaymentEvent(
        contractId: string,
        type: NotificationType,
        title: string,
        message: string,
        paymentId?: string,
        excludeUserId?: string
    ): Promise<void> {
        try {
            let userIds = await getContractRecipientUserIds(contractId);

            if (excludeUserId) {
                userIds = userIds.filter(id => id !== excludeUserId);
            }

            if (userIds.length === 0) {
                console.log('[NotificationService] No recipients for payment event:', contractId);
                return;
            }

            await this.createBulk(userIds, type, title, message, { contractId, paymentId });
        } catch (err) {
            console.warn('[NotificationService] notifyPaymentEvent failed:', err);
        }
    },
};
