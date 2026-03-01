import React from 'react';
import { X, Circle } from 'lucide-react';

interface OnlineUser {
    userId: string;
    fullName: string;
    avatarUrl?: string;
    isOnline: boolean;
}

interface ChatOnlinePanelProps {
    users: OnlineUser[];
    onClose: () => void;
    onStartChat?: (userId: string) => void;
}

function getInitials(name: string): string {
    return name.split(' ').filter(Boolean).map(w => w[0]).slice(-2).join('').toUpperCase();
}

function getAvatarColor(name: string): string {
    const colors = [
        'from-indigo-500 to-purple-500', 'from-emerald-500 to-teal-500',
        'from-orange-500 to-amber-500', 'from-rose-500 to-pink-500',
        'from-cyan-500 to-blue-500',
    ];
    let hash = 0;
    for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

const ChatOnlinePanel: React.FC<ChatOnlinePanelProps> = ({ users, onClose, onStartChat }) => {
    const onlineUsers = users.filter(u => u.isOnline);
    const offlineUsers = users.filter(u => !u.isOnline);

    return (
        <div className="w-64 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Nhân viên ({users.length})
                </h3>
                <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <X size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
                {/* Online */}
                {onlineUsers.length > 0 && (
                    <div className="mb-3">
                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider px-4 mb-1.5">
                            🟢 Đang hoạt động ({onlineUsers.length})
                        </p>
                        {onlineUsers.map(u => (
                            <button
                                key={u.userId}
                                onClick={() => onStartChat?.(u.userId)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div className="relative flex-shrink-0">
                                    {u.avatarUrl ? (
                                        <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                    ) : (
                                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(u.fullName)} flex items-center justify-center text-white text-[10px] font-bold`}>
                                            {getInitials(u.fullName)}
                                        </div>
                                    )}
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                                </div>
                                <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{u.fullName}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Offline */}
                {offlineUsers.length > 0 && (
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-4 mb-1.5">
                            Ngoại tuyến ({offlineUsers.length})
                        </p>
                        {offlineUsers.map(u => (
                            <button
                                key={u.userId}
                                onClick={() => onStartChat?.(u.userId)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors opacity-60"
                            >
                                <div className="relative flex-shrink-0">
                                    {u.avatarUrl ? (
                                        <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                    ) : (
                                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(u.fullName)} flex items-center justify-center text-white text-[10px] font-bold`}>
                                            {getInitials(u.fullName)}
                                        </div>
                                    )}
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{u.fullName}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatOnlinePanel;
