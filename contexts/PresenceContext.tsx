/**
 * PresenceContext — Online Users Tracker
 *
 * Extracted from AuthContext to isolate the Supabase Realtime presence logic.
 * When online users join/leave, ONLY components consuming usePresence() re-render
 * instead of every AuthContext consumer re-rendering.
 *
 * Usage:
 *   const { onlineUsers } = usePresence();
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface OnlineUser {
    id: string;
    fullName: string;
    avatarUrl?: string;
}

interface PresenceContextType {
    onlineUsers: OnlineUser[];
}

const PresenceContext = createContext<PresenceContextType>({ onlineUsers: [] });

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

    const isDevBypass = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'
        && typeof window !== 'undefined'
        && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    useEffect(() => {
        // Only subscribe when we have a real user ID — not in dev bypass mode.
        // Using user?.id and profile?.id as deps so we only re-subscribe on actual identity change,
        // not when profile details (name, avatar) update.
        const userId = user?.id;
        if (!userId || !profile || isDevBypass) return;

        const channel = supabase.channel('online_users', {
            config: { presence: { key: userId } },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const users: OnlineUser[] = [];
                Object.keys(state).forEach(key => {
                    const presence = state[key][0] as { user_info?: { fullName?: string; avatarUrl?: string } };
                    if (presence?.user_info) {
                        users.push({
                            id: key,
                            fullName: presence.user_info.fullName ?? key,
                            avatarUrl: presence.user_info.avatarUrl,
                        });
                    }
                });
                setOnlineUsers(users);
            })
            .on('presence', { event: 'join' }, ({ key }) => {
                console.log('[Presence] User joined:', key);
            })
            .on('presence', { event: 'leave' }, ({ key }) => {
                console.log('[Presence] User left:', key);
            })
            .subscribe(async status => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_info: {
                            fullName: profile.fullName,
                            avatarUrl: profile.avatarUrl,
                        },
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            channel.unsubscribe();
        };
    // Stable deps: only re-subscribe when the actual user identity changes
    }, [user?.id, profile?.id, isDevBypass]);  // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <PresenceContext.Provider value={{ onlineUsers }}>
            {children}
        </PresenceContext.Provider>
    );
};

export const usePresence = (): PresenceContextType => useContext(PresenceContext);
