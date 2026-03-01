import React from 'react';
import { ArrowLeft, Users, Pin, Sparkles, FileDown } from 'lucide-react';
import type { ChatRoomWithDetails } from '../../types';

interface ChatHeaderProps {
    room: ChatRoomWithDetails | null;
    currentUserId: string;
    isOnline?: (userId: string) => boolean;
    onBack?: () => void;
    typingUsers?: string[];
    pinnedCount?: number;
    onShowPinned?: () => void;
    onSearch?: () => void;
    onShowAI?: () => void;
    onExport?: () => void;
    onShowOnline?: () => void;
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
    ];
    let hash = 0;
    for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ room, currentUserId, isOnline, onBack, typingUsers = [], pinnedCount = 0, onShowPinned, onSearch, onShowAI, onExport, onShowOnline }) => {
    if (!room) return null;

    const otherMember = room.type === 'direct'
        ? room.members.find(m => m.user_id !== currentUserId)
        : null;

    const displayName = room.type === 'direct'
        ? otherMember?.profile?.fullName || 'Người dùng'
        : room.name || 'Nhóm chat';

    const memberCount = room.members.length;
    const otherIsOnline = otherMember ? isOnline?.(otherMember.user_id) : false;

    const statusText = typingUsers.length > 0
        ? 'đang nhập...'
        : room.type === 'direct'
            ? (otherIsOnline ? 'Đang hoạt động' : 'Ngoại tuyến')
            : `${memberCount} thành viên`;

    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 min-h-[64px]">
            {/* Back button (mobile) */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
            )}

            {/* Avatar */}
            <div className="relative flex-shrink-0">
                {room.type === 'direct' ? (
                    <>
                        {otherMember?.profile?.avatarUrl ? (
                            <img
                                src={otherMember.profile.avatarUrl}
                                alt={displayName}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        ) : (
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(displayName)} flex items-center justify-center text-white text-sm font-bold`}>
                                {getInitials(displayName)}
                            </div>
                        )}
                        {otherIsOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                        )}
                    </>
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white">
                        <Users size={18} />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {displayName}
                </h3>
                <p className={`text-xs ${typingUsers.length > 0 ? 'text-indigo-500 dark:text-indigo-400' : otherIsOnline ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {statusText}
                </p>
            </div>

            <div className="flex items-center gap-1">
                {onShowAI && (
                    <button
                        onClick={onShowAI}
                        className="p-2 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                        title="AI Tóm tắt"
                    >
                        <Sparkles size={16} />
                    </button>
                )}
                {pinnedCount > 0 && (
                    <button
                        onClick={onShowPinned}
                        className="relative p-2 rounded-lg text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        title={`${pinnedCount} tin nhắn đã ghim`}
                    >
                        <Pin size={16} />
                        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5">
                            {pinnedCount}
                        </span>
                    </button>
                )}
                {onExport && (
                    <button
                        onClick={onExport}
                        className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Xuất PDF"
                    >
                        <FileDown size={16} />
                    </button>
                )}
                {onShowOnline && (
                    <button
                        onClick={onShowOnline}
                        className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Nhân viên online"
                    >
                        <Users size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default ChatHeader;
