import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Tooltip from '../ui/Tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '../ui';
import { Users } from 'lucide-react';

const OnlineUsers: React.FC = () => {
    const { onlineUsers, profile } = useAuth();

    // If no one else is online via presence, at least show the current user for feedback
    const displayUsers = onlineUsers.length > 0
        ? onlineUsers
        : (profile ? [{ id: profile.id, fullName: profile.fullName, avatarUrl: profile.avatarUrl }] : []);

    if (displayUsers.length === 0) return null;

    const maxVisible = 5;
    const visibleUsers = displayUsers.slice(0, maxVisible);
    const remaining = displayUsers.length - maxVisible;

    return (
        <div className="flex items-center gap-2">
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
                        <div className="relative inline-block group cursor-pointer transition-transform hover:-translate-y-0.5 hover:z-10">
                            <Avatar className="w-8 h-8 ring-2 ring-slate-50 dark:ring-slate-900 shadow-sm transition-all group-hover:ring-orange-400 dark:group-hover:ring-orange-500 border-none">
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
        </div>
    );
};

export default OnlineUsers;
