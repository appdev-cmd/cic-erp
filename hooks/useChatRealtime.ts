/**
 * Realtime hook for chat messages and typing indicators
 * Uses Supabase Realtime Postgres Changes + Broadcast
 */
import { useEffect, useRef, useCallback } from 'react';
import { dataClient } from '../lib/dataClient';
import type { ChatMessage } from '../types';

interface UseChatRealtimeOptions {
    roomId: string | null;
    onNewMessage: (message: ChatMessage) => void;
    onTyping?: (userId: string, isTyping: boolean) => void;
    onMessageDeleted?: (messageId: string) => void;
}

export function useChatRealtime({ roomId, onNewMessage, onTyping, onMessageDeleted }: UseChatRealtimeOptions) {
    const channelRef = useRef<ReturnType<typeof dataClient.channel> | null>(null);

    useEffect(() => {
        if (!roomId) return;

        const channel = dataClient
            .channel(`chat-room:${roomId}`)
            // Listen for new messages via Postgres Changes
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `room_id=eq.${roomId}`,
            }, (payload) => {
                onNewMessage(payload.new as ChatMessage);
            })
            // Listen for deleted messages
            .on('postgres_changes', {
                event: 'DELETE',
                schema: 'public',
                table: 'chat_messages',
                filter: `room_id=eq.${roomId}`,
            }, (payload) => {
                onMessageDeleted?.((payload.old as any).id);
            })
            // Typing indicator via Broadcast
            .on('broadcast', { event: 'typing' }, (payload) => {
                const { userId, isTyping } = payload.payload as { userId: string; isTyping: boolean };
                onTyping?.(userId, isTyping);
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            dataClient.removeChannel(channel);
            channelRef.current = null;
        };
    }, [roomId, onNewMessage, onTyping, onMessageDeleted]);

    // Broadcast typing status
    const sendTyping = useCallback((userId: string, isTyping: boolean) => {
        if (channelRef.current) {
            channelRef.current.send({
                type: 'broadcast',
                event: 'typing',
                payload: { userId, isTyping },
            });
        }
    }, []);

    return { sendTyping };
}

/**
 * Hook to listen for new messages across ALL rooms (for unread badges)
 */
export function useChatGlobalRealtime(
    userId: string | null,
    roomIds: string[],
    onNewMessageInRoom: (roomId: string, message: ChatMessage) => void
) {
    useEffect(() => {
        if (!userId || roomIds.length === 0) return;

        const channel = dataClient
            .channel('chat-global')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
            }, (payload) => {
                const msg = payload.new as ChatMessage;
                if (msg.sender_id !== userId && roomIds.includes(msg.room_id)) {
                    onNewMessageInRoom(msg.room_id, msg);
                }
            })
            .subscribe();

        return () => { dataClient.removeChannel(channel); };
    }, [userId, roomIds.join(','), onNewMessageInRoom]);
}
