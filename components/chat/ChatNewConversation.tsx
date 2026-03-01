import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Users, User, Loader2 } from 'lucide-react';
import * as chatService from '../../services/chatService';

interface UserOption {
    id: string;
    fullName: string;
    avatarUrl?: string;
    email?: string;
}

interface ChatNewConversationProps {
    currentUserId: string;
    onCreateDirect: (userId: string) => void;
    onCreateGroup: (name: string, memberIds: string[]) => void;
    onClose: () => void;
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

const ChatNewConversation: React.FC<ChatNewConversationProps> = ({
    currentUserId,
    onCreateDirect,
    onCreateGroup,
    onClose,
}) => {
    const [mode, setMode] = useState<'direct' | 'group'>('direct');
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState<UserOption[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);

    // Load users
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const results = search.trim()
                ? await chatService.searchUsers(search, currentUserId)
                : await chatService.getAllUsers(currentUserId);
            setUsers(results);
            setLoading(false);
        };
        const debounce = setTimeout(load, 300);
        return () => clearTimeout(debounce);
    }, [search, currentUserId]);

    const handleSelectUser = (user: UserOption) => {
        if (mode === 'direct') {
            setCreating(true);
            onCreateDirect(user.id);
        } else {
            if (selectedUsers.find(u => u.id === user.id)) {
                setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
            } else {
                setSelectedUsers(prev => [...prev, user]);
            }
        }
    };

    const handleCreateGroup = () => {
        if (selectedUsers.length < 2 || !groupName.trim()) return;
        setCreating(true);
        onCreateGroup(groupName.trim(), selectedUsers.map(u => u.id));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Cuộc trò chuyện mới</h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Mode toggle */}
                <div className="flex gap-1 px-5 pt-3">
                    <button
                        onClick={() => { setMode('direct'); setSelectedUsers([]); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'direct'
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <User size={16} /> Cá nhân
                    </button>
                    <button
                        onClick={() => setMode('group')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'group'
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                    >
                        <Users size={16} /> Nhóm
                    </button>
                </div>

                {/* Group name input */}
                {mode === 'group' && (
                    <div className="px-5 pt-3">
                        <input
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            placeholder="Tên nhóm..."
                            className="w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none border-none"
                        />
                    </div>
                )}

                {/* Search */}
                <div className="px-5 pt-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm nhân viên..."
                            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none border-none"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Selected chips (group mode) */}
                {mode === 'group' && selectedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-5 pt-3">
                        {selectedUsers.map(u => (
                            <span
                                key={u.id}
                                onClick={() => handleSelectUser(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                            >
                                {u.fullName}
                                <X size={12} />
                            </span>
                        ))}
                    </div>
                )}

                {/* User list */}
                <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                        </div>
                    ) : users.length === 0 ? (
                        <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">
                            Không tìm thấy nhân viên
                        </p>
                    ) : (
                        users.map(user => {
                            const isSelected = selectedUsers.some(u => u.id === user.id);
                            return (
                                <button
                                    key={user.id}
                                    onClick={() => handleSelectUser(user)}
                                    disabled={creating}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isSelected
                                            ? 'bg-indigo-50 dark:bg-indigo-900/20'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                        } disabled:opacity-50`}
                                >
                                    {user.avatarUrl ? (
                                        <img src={user.avatarUrl} alt={user.fullName} className="w-9 h-9 rounded-full object-cover" />
                                    ) : (
                                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(user.fullName)} flex items-center justify-center text-white text-xs font-bold`}>
                                            {getInitials(user.fullName)}
                                        </div>
                                    )}
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{user.fullName}</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{user.email}</p>
                                    </div>
                                    {isSelected && (
                                        <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Create group button */}
                {mode === 'group' && (
                    <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800">
                        <button
                            onClick={handleCreateGroup}
                            disabled={selectedUsers.length < 2 || !groupName.trim() || creating}
                            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            {creating ? (
                                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                            ) : (
                                `Tạo nhóm (${selectedUsers.length} thành viên)`
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatNewConversation;
