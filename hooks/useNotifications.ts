/**
 * useNotifications — Real-time notification hook
 * ================================================
 * Subscribes to Supabase Realtime for instant notification updates.
 * Provides unread count, pagination, and mark-as-read functionality.
 *
 * NOTE: In Dev Bypass mode (no auth session), Realtime subscription
 * won't work because RLS requires auth.uid(). Notifications will still
 * be created in DB and will show up once the user logs in with Google OAuth.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { dataClient as supabase } from '../lib/dataClient';
import { NotificationItem } from '../types';
import { NotificationService } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';

const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 30_000; // Poll every 30s as fallback

interface UseNotificationsReturn {
    notifications: NotificationItem[];
    unreadCount: number;
    isLoading: boolean;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    loadMore: () => Promise<void>;
    hasMore: boolean;
    refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
    const { profile } = useAuth();
    const userId = profile?.id;

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [hasAuthSession, setHasAuthSession] = useState(false);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Check if we have a real auth session (needed for RLS queries)
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setHasAuthSession(!!data?.session);
            if (!data?.session && userId) {
                console.warn('[useNotifications] No auth session — Realtime disabled. Notifications will work with Google OAuth login.');
            }
        });
    }, [userId]);

    // Initial fetch
    const fetchNotifications = useCallback(async () => {
        if (!userId || !hasAuthSession) return;
        setIsLoading(true);
        try {
            const [notifResult, count] = await Promise.all([
                NotificationService.getNotifications(userId, 0),
                NotificationService.getUnreadCount(userId),
            ]);

            setNotifications(notifResult.data);
            setHasMore(notifResult.hasMore);
            setUnreadCount(count);
            setPage(0);
        } catch (err) {
            console.error('[useNotifications] Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [userId, hasAuthSession]);

    // Load more (pagination)
    const loadMore = useCallback(async () => {
        if (!userId || !hasMore || !hasAuthSession) return;
        const nextPage = page + 1;

        const result = await NotificationService.getNotifications(userId, nextPage);
        setNotifications(prev => [...prev, ...result.data]);
        setHasMore(result.hasMore);
        setPage(nextPage);
    }, [userId, page, hasMore, hasAuthSession]);

    // Mark single as read
    const markAsRead = useCallback(async (id: string) => {
        await NotificationService.markAsRead(id);
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    }, []);

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        if (!userId) return;
        await NotificationService.markAllAsRead(userId);
        setNotifications(prev =>
            prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
    }, [userId]);

    // Delete notification
    const deleteNotification = useCallback(async (id: string) => {
        const target = notifications.find(n => n.id === id);
        await NotificationService.deleteNotification(id);
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (target && !target.is_read) {
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    }, [notifications]);

    // Setup Realtime subscription OR polling fallback
    useEffect(() => {
        if (!userId) {
            setIsLoading(false);
            return;
        }

        if (!hasAuthSession) {
            setIsLoading(false);
            return;
        }

        fetchNotifications();

        // Subscribe to INSERT events on notifications table for this user
        const channel = supabase
            .channel(`notifications:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const newNotif = payload.new as NotificationItem;
                    // Prepend to list
                    setNotifications(prev => [newNotif, ...prev]);
                    setUnreadCount(prev => prev + 1);
                }
            )
            .subscribe();

        channelRef.current = channel;

        // Also set up polling as a reliable fallback
        pollRef.current = setInterval(() => {
            fetchNotifications();
        }, POLL_INTERVAL_MS);

        return () => {
            channel.unsubscribe();
            channelRef.current = null;
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [userId, hasAuthSession, fetchNotifications]);

    return {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        loadMore,
        hasMore,
        refresh: fetchNotifications,
    };
}
