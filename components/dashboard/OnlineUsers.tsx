import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePresence } from '../../contexts/PresenceContext';
import Tooltip from '../ui/Tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '../ui';

const OnlineUsers: React.FC = () => {
    const { profile } = useAuth();
    const { onlineUsers } = usePresence();

    const displayUsers = onlineUsers.length > 0
        ? onlineUsers
        : (profile ? [{ id: profile.id, fullName: profile.fullName, avatarUrl: profile.avatarUrl }] : []);

    if (displayUsers.length === 0) return null;

    const maxVisible = 8;
    const visibleUsers = displayUsers.slice(0, maxVisible);
    const remaining = displayUsers.length - maxVisible;

    return (
        <div className="relative group/online flex items-center gap-2">
            {/* Avatar Stack */}
            <div className="flex -space-x-2.5">
                {visibleUsers.map((u) => (
                    <Tooltip
                        key={u.id}
                        content={
                            <div className="bg-slate-900 dark:bg-slate-700 text-white px-3 py-1.5 rounded-lg shadow-xl">
                                <p className="text-xs font-bold">{u.fullName}</p>
                                <p className="text-[10px] text-emerald-400 font-medium">● Đang hoạt động</p>
                            </div>
                        }
                    >
                        <div className="relative inline-block cursor-pointer transition-transform hover:-translate-y-0.5 hover:z-10">
                            <Avatar className="w-8 h-8 ring-2 ring-slate-50 dark:ring-slate-900 shadow-sm transition-all hover:ring-orange-400 dark:hover:ring-orange-500 border-none">
                                <AvatarImage src={u.avatarUrl} alt={u.fullName} />
                                <AvatarFallback className="bg-gradient-to-br from-orange-400 to-amber-500 text-[10px] font-bold text-white uppercase">
                                    {u.fullName.substring(0, 2)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-[1.5px] border-white dark:border-slate-900 rounded-full"></div>
                        </div>
                    </Tooltip>
                ))}

                {remaining > 0 && (
                    <div className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 ring-2 ring-slate-50 dark:ring-slate-900 text-[10px] font-bold text-slate-600 dark:text-slate-300 cursor-default">
                        +{remaining}
                    </div>
                )}
            </div>

            {/* Online Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full">
                <div className="relative">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    <div className="absolute inset-0 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping opacity-50"></div>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {displayUsers.length}
                </span>
            </div>

            {/* ─── Hover Dropdown: full user list ─── */}
            {displayUsers.length > 0 && (
                <div className="absolute top-full right-0 mt-2 w-64 opacity-0 invisible group-hover/online:opacity-100 group-hover/online:visible transition-all duration-200 translate-y-1 group-hover/online:translate-y-0 z-50 pointer-events-none group-hover/online:pointer-events-auto">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {/* Header */}
                        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Đang online</span>
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                    {displayUsers.length} người
                                </span>
                            </div>
                        </div>

                        {/* User list */}
                        <div className="max-h-[280px] overflow-y-auto py-1">
                            {displayUsers.map((u) => (
                                <div
                                    key={u.id}
                                    className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                >
                                    <div className="relative flex-shrink-0">
                                        <Avatar className="w-7 h-7 border-none">
                                            <AvatarImage src={u.avatarUrl} alt={u.fullName} />
                                            <AvatarFallback className="bg-gradient-to-br from-orange-400 to-amber-500 text-[9px] font-bold text-white uppercase">
                                                {u.fullName.substring(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border-[1.5px] border-white dark:border-slate-800 rounded-full"></div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                                            {u.fullName}
                                            {u.id === profile?.id && (
                                                <span className="ml-1 text-[9px] text-slate-400 font-normal">(bạn)</span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0 w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OnlineUsers;
