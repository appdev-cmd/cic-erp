/**
 * Presence hook for tracking online/offline users
 * Uses Supabase Realtime Presence
 */
import { useEffect, useState, useCallback } from 'react';
import { dataClient } from '../lib/dataClient';

interface PresenceState {
    userId: string;
    fullName?: string;
    onlineAt: string;
}

export function useChatPresence(userId: string | null, fullName?: string) {
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!userId) return;

        const channel = dataClient.channel('chat-presence');

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState<PresenceState>();
                const ids = new Set<string>();
                Object.values(state).forEach((presences) => {
                    presences.forEach((p: any) => {
                        if (p.userId) ids.add(p.userId);
                    });
                });
                setOnlineUserIds(ids);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        userId,
                        fullName: fullName || '',
                        onlineAt: new Date().toISOString(),
                    });
                }
            });

        return () => {
            dataClient.removeChannel(channel);
        };
    }, [userId, fullName]);

    const isOnline = useCallback((uid: string) => onlineUserIds.has(uid), [onlineUserIds]);

    return { onlineUserIds, isOnline };
}
