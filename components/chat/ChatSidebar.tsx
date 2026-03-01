import React, { useState, useMemo } from 'react';
import { Search, Plus, MessageCircle } from 'lucide-react';
import type { ChatRoomWithDetails } from '../../types';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { parseMentions } from '../../services/mentionService';

interface ChatSidebarProps {
    rooms: ChatRoomWithDetails[];
    activeRoomId: string | null;
    currentUserId: string;
    isOnline?: (userId: string) => boolean;
    onSelectRoom: (roomId: string) => void;
    onNewChat: () => void;
    isLoading?: boolean;
}

function getInitials(name: string): string {
    return name.split(' ').filter(Boolean).map(w => w[0]).slice(-2).join('').toUpperCase();
}

function getAvatarColor(name: string): string {
    const colors = [
        'from-indigo-500 to-purple-500',
        'from-emerald-500 to-teal-500',
        'from-orange-500 to-amber-500',
        'from-rose-500 to-pink-500',
        'from-cyan-500 to-blue-500',
        'from-violet-500 to-fuchsia-500',
    ];
    let hash = 0;
    for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function formatLastTime(dateStr?: string): string {
    if (!dateStr) return '';
    try {
        const date = parseISO(dateStr);
        if (isToday(date)) return format(date, 'HH:mm');
        if (isYesterday(date)) return 'Hôm qua';
        return format(date, 'dd/MM');
    } catch {
        return '';
    }
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
    rooms,
    activeRoomId,
    currentUserId,
    isOnline,
    onSelectRoom,
    onNewChat,
    isLoading,
}) => {
    const [search, setSearch] = useState('');

    const filteredRooms = useMemo(() => {
        if (!search.trim()) return rooms;
        const q = search.toLowerCase();
        return rooms.filter(room => {
            const name = room.type === 'direct'
                ? room.members.find(m => m.user_id !== currentUserId)?.profile?.fullName || ''
                : room.name || '';
            return name.toLowerCase().includes(q);
        });
    }, [rooms, search, currentUserId]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <MessageCircle size={20} className="text-indigo-500" />
                        Tin nhắn
                    </h2>
                    <button
                        onClick={onNewChat}
                        className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                        title="Tạo cuộc trò chuyện mới"
                    >
                        <Plus size={18} />
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm cuộc trò chuyện..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none border border-slate-200 dark:border-slate-700"
                    />
                </div>
            </div>

            {/* Room list */}
            <div className="flex-1 overflow-y-auto py-1">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                        <p className="text-xs text-slate-400">Đang tải...</p>
                    </div>
                ) : filteredRooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mb-3">
                            <MessageCircle size={24} className="text-indigo-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            {search ? 'Không tìm thấy' : 'Chưa có cuộc trò chuyện'}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                            Nhấn + để bắt đầu chat
                        </p>
                    </div>
                ) : (
                    filteredRooms.map(room => {
                        const isActive = room.id === activeRoomId;
                        const otherMember = room.type === 'direct'
                            ? room.members.find(m => m.user_id !== currentUserId)
                            : null;
                        const displayName = room.type === 'direct'
                            ? otherMember?.profile?.fullName || 'Người dùng'
                            : room.name || 'Nhóm';
                        const avatarUrl = room.type === 'direct' ? otherMember?.profile?.avatarUrl : null;
                        const otherIsOnline = otherMember ? isOnline?.(otherMember.user_id) : false;
                        const lastMsg = room.lastMessage;
                        const hasUnread = room.unreadCount > 0;

                        return (
                            <button
                                key={room.id}
                                onClick={() => onSelectRoom(room.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${isActive
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-2 border-l-transparent'
                                    }`}
                            >
                                {/* Avatar */}
                                <div className="relative flex-shrink-0">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={displayName} className="w-11 h-11 rounded-full object-cover" />
                                    ) : (
                                        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarColor(displayName)} flex items-center justify-center text-white text-sm font-bold`}>
                                            {room.type === 'group' ? (
                                                <span className="text-base">👥</span>
                                            ) : (
                                                getInitials(displayName)
                                            )}
                                        </div>
                                    )}
                                    {room.type === 'direct' && otherIsOnline && (
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center justify-between">
                                        <p className={`text-sm truncate ${hasUnread ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                            {displayName}
                                        </p>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-2 whitespace-nowrap">
                                            {formatLastTime(lastMsg?.created_at || room.updated_at)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <p className={`text-xs truncate max-w-[180px] ${hasUnread ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-500'}`}>
                                            {lastMsg?.content
                                                ? parseMentions(lastMsg.content).parts.map(p =>
                                                    p.type === 'mention' && p.mention
                                                        ? `${p.mention.icon}${p.mention.label}`
                                                        : p.content
                                                ).join('')
                                                : 'Chưa có tin nhắn'}
                                        </p>
                                        {hasUnread && (
                                            <span className="flex-shrink-0 ml-2 min-w-[18px] h-[18px] rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center px-1">
                                                {room.unreadCount > 99 ? '99+' : room.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ChatSidebar;
