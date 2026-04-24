import React, { useState, useEffect } from 'react';
import { Bot, ToggleLeft, ToggleRight, Search, Loader2, Server, Key, Zap, Shield } from 'lucide-react';
import { aiPermissionService, AIPermissionWithProfile } from '../../services/aiPermissionService';
import { toast } from 'sonner';

const AIPermissionManager: React.FC = () => {
    const [users, setUsers] = useState<AIPermissionWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await aiPermissionService.getAllPermissions();
            setUsers(data);
        } catch (err: any) {
            toast.error('Lỗi tải danh sách: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleToggle = async (userId: string, current: boolean) => {
        setSaving(userId);
        try {
            const user = users.find(u => u.user_id === userId);
            await aiPermissionService.setPermission(userId, !current, user?.monthly_quota || 100);
            setUsers(prev => prev.map(u =>
                u.user_id === userId ? { ...u, can_use_system_api: !current } : u
            ));
            toast.success(!current ? 'Đã cấp quyền API hệ thống' : 'Đã thu hồi quyền API hệ thống');
        } catch (err: any) {
            toast.error('Lỗi: ' + err.message);
        } finally {
            setSaving(null);
        }
    };

    const filtered = users.filter(u => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            u.profile?.fullName?.toLowerCase().includes(q) ||
            u.profile?.email?.toLowerCase().includes(q) ||
            u.profile?.role?.toLowerCase().includes(q)
        );
    });

    const enabledCount = users.filter(u => u.can_use_system_api).length;
    const totalUsage = users.reduce((sum, u) => sum + u.usage_count, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 size={20} className="animate-spin" />
                Đang tải...
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 text-center border border-indigo-100 dark:border-indigo-800">
                    <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">{enabledCount}</div>
                    <div className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase">Đang dùng HT</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-700">
                    <div className="text-lg font-extrabold text-slate-700 dark:text-slate-300">{users.length}</div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng user</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center border border-amber-100 dark:border-amber-800">
                    <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400">{totalUsage}</div>
                    <div className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase">Tổng request</div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm theo tên, email, role..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
            </div>

            {/* User List */}
            <div className="space-y-1.5">
                {filtered.map(user => (
                    <div
                        key={user.user_id}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Avatar */}
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${user.can_use_system_api
                                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                                }`}>
                                {user.profile?.fullName?.charAt(0) || '?'}
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                        {user.profile?.fullName || 'Unknown'}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${user.profile?.role === 'Admin'
                                            ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                        }`}>
                                        {user.profile?.role}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                        {user.profile?.email}
                                    </span>
                                    {user.usage_count > 0 && (
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                                            <Zap size={10} />
                                            {user.usage_count} req
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Toggle */}
                        <button
                            onClick={() => handleToggle(user.user_id, user.can_use_system_api)}
                            disabled={saving === user.user_id || user.profile?.role === 'Admin'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${user.profile?.role === 'Admin'
                                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 cursor-default'
                                    : user.can_use_system_api
                                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            title={user.profile?.role === 'Admin' ? 'Admin luôn có quyền' : ''}
                        >
                            {saving === user.user_id ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : user.can_use_system_api ? (
                                <>
                                    <ToggleRight size={16} />
                                    <Server size={12} />
                                    HT
                                </>
                            ) : (
                                <>
                                    <ToggleLeft size={16} />
                                    <Key size={12} />
                                    CN
                                </>
                            )}
                        </button>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                    Không tìm thấy người dùng nào
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="flex items-center gap-1"><Server size={10} className="text-indigo-500" /> HT = API Hệ thống</span>
                <span className="flex items-center gap-1"><Key size={10} className="text-amber-500" /> CN = API Cá nhân</span>
                <span className="flex items-center gap-1"><Shield size={10} className="text-red-500" /> Admin luôn có quyền</span>
            </div>
        </div>
    );
};

export default AIPermissionManager;
