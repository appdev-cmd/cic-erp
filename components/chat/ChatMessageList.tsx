import React, { useRef, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import ChatMessageItem from './ChatMessageItem';
import type { ChatMessageWithSender } from '../../types';
import { format, parseISO, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ChatMessageListProps {
    messages: ChatMessageWithSender[];
    currentUserId: string;
    isLoading?: boolean;
    onLoadMore?: () => void;
    hasMore?: boolean;
    onReply?: (message: ChatMessageWithSender) => void;
    onReact?: (messageId: string, emoji: string) => void;
    onPin?: (messageId: string, pin: boolean) => void;
    onForward?: (messageId: string) => void;
    onUnsend?: (messageId: string) => void;
    reactions?: Record<string, { emoji: string; users: string[]; count: number }[]>;
    readStatus?: { userId: string; fullName: string; lastReadAt: string }[];
}

function formatDateDivider(dateStr: string): string {
    try {
        const date = parseISO(dateStr);
        const today = new Date();
        if (isSameDay(date, today)) return 'Hôm nay';
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (isSameDay(date, yesterday)) return 'Hôm qua';
        return format(date, 'EEEE, dd/MM/yyyy', { locale: vi });
    } catch {
        return '';
    }
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
    messages,
    currentUserId,
    isLoading,
    onLoadMore,
    hasMore,
    onReply,
    onReact,
    onPin,
    onForward,
    onUnsend,
    reactions = {},
    readStatus = [],
}) => {
    const bottomRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

    // Build reply map
    const messageMap = new Map(messages.map(m => [m.id, m]));

    // Build readBy for each message
    const getReadBy = (msg: ChatMessageWithSender): string[] => {
        return readStatus
            .filter(r => r.userId !== currentUserId && r.lastReadAt && r.lastReadAt >= msg.created_at)
            .map(r => r.fullName);
    };

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (shouldAutoScroll && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length, shouldAutoScroll]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
        setShouldAutoScroll(isNearBottom);

        // Load more when scrolled to top
        if (scrollTop < 100 && hasMore && onLoadMore) {
            onLoadMore();
        }
    };

    // Display messages in chronological order (reversed from DB desc order)
    const sortedMessages = [...messages].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Group by date
    let lastDate = '';

    return (
        <div
            ref={containerRef}
            className="flex-1 overflow-y-auto scroll-smooth"
            onScroll={handleScroll}
        >
            {/* Load more indicator */}
            {hasMore && (
                <button
                    onClick={onLoadMore}
                    className="w-full py-2 text-xs text-indigo-500 dark:text-indigo-400 hover:underline"
                >
                    Tải tin nhắn cũ hơn
                </button>
            )}

            {isLoading && (
                <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                </div>
            )}

            {/* Empty state */}
            {!isLoading && sortedMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center">
                        <span className="text-3xl">💬</span>
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Chưa có tin nhắn</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Hãy bắt đầu cuộc trò chuyện!</p>
                </div>
            )}

            {/* Messages */}
            <div className="py-2 space-y-0.5">
                {sortedMessages.map((msg) => {
                    const msgDate = msg.created_at.split('T')[0];
                    const showDate = msgDate !== lastDate;
                    lastDate = msgDate;

                    return (
                        <React.Fragment key={msg.id}>
                            {showDate && (
                                <div className="flex items-center gap-3 px-8 py-2">
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                        {formatDateDivider(msg.created_at)}
                                    </span>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                </div>
                            )}
                            <ChatMessageItem
                                message={msg}
                                isOwn={msg.sender_id === currentUserId}
                                replyMessage={msg.reply_to ? messageMap.get(msg.reply_to) || null : null}
                                onReply={onReply}
                                onReact={onReact}
                                onPin={onPin}
                                onForward={onForward}
                                onUnsend={onUnsend}
                                reactions={reactions[msg.id] || []}
                                readBy={getReadBy(msg)}
                            />
                        </React.Fragment>
                    );
                })}
            </div>

            <div ref={bottomRef} />
        </div>
    );
};

export default ChatMessageList;
