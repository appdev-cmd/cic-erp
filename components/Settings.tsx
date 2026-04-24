import React, { useState, useEffect, useCallback } from 'react';
import {
    Moon, Sun, Shield, ShieldCheck, Settings2, FlaskConical, Users, Palette,
    HardDrive, BarChart3, Bot, Crown, ScanLine, Sparkles, History,
    ChevronRight, AlertTriangle, CheckCircle2, RefreshCw, Loader2, Database
} from 'lucide-react';
import PilotRunner from './admin/PilotRunner';
import PermissionManager from './settings/PermissionManager';
import RoleDefaultsManager from './settings/RoleDefaultsManager';
import UserImpersonator from './settings/UserImpersonator';
import DriveSettings from './settings/DriveSettings';
import AIPermissionManager from './settings/AIPermissionManager';
import ManagementRankManager from './settings/ManagementRankManager';
import HistoricalProductionManager from './settings/HistoricalProductionManager';
import RouteAuditPanel from './settings/RouteAuditPanel';
import EmbeddingSettings from './settings/EmbeddingSettings';
import PermissionAuditLog from './settings/PermissionAuditLog';
import { useLayoutContext } from './layout/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { dataClient } from '../lib/dataClient';
import { PermissionService } from '../services/permissionService';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────
type SettingsTab =
    | 'system'
    | 'permissions' | 'role-defaults' | 'task-mgmt' | 'route-audit' | 'perm-audit'
    | 'ai-api' | 'ai-embedding' | 'drive'
    | 'historical'
    | 'testing';

interface SectionGroup {
    id: string;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
    items: {
        id: SettingsTab;
        label: string;
        icon: React.ReactNode;
        adminOnly?: boolean;
    }[];
}

// ─── Permission Health Check Widget (Task 3.3) ───────────────────────────────
const PermissionHealthCheck: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        noPermission: 0,
        customized: 0,
        crossUnit: 0,
        noPermissionUsers: [] as { id: string; name: string; role: string }[],
    });
    const [fixing, setFixing] = useState(false);

    const loadStats = useCallback(async () => {
        setLoading(true);
        try {
            // Lấy tất cả profiles
            const { data: profiles } = await dataClient
                .from('profiles')
                .select('id, full_name, role, employee_id')
                .not('role', 'is', null);

            // Lấy tất cả user có ít nhất 1 permission
            const { data: permUsers } = await dataClient
                .from('user_permissions')
                .select('user_id');

            const permSet = new Set((permUsers || []).map((r: any) => r.user_id));

            const noPermList = (profiles || []).filter((p: any) => !permSet.has(p.employee_id || p.id));

            // Cross-unit users
            const { data: crossUnitData } = await dataClient
                .from('cross_unit_visibility')
                .select('employee_id');
            const crossUnitSet = new Set((crossUnitData || []).map((r: any) => r.employee_id));

            setStats({
                noPermission: noPermList.length,
                customized: (permUsers || []).length,
                crossUnit: crossUnitSet.size,
                noPermissionUsers: noPermList.slice(0, 5).map((p: any) => ({
                    id: p.id,
                    name: p.full_name || p.id,
                    role: p.role,
                })),
            });
        } catch (err) {
            console.error('Health check failed:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadStats(); }, [loadStats]);

    const handleFixAll = async () => {
        setFixing(true);
        try {
            const { data: profiles } = await dataClient
                .from('profiles')
                .select('id, role, employee_id')
                .not('role', 'is', null);

            const { data: permUsers } = await dataClient
                .from('user_permissions')
                .select('user_id');

            const permSet = new Set((permUsers || []).map((r: any) => r.user_id));
            const noPermList = (profiles || []).filter((p: any) => !permSet.has(p.employee_id || p.id));

            await Promise.all(
                noPermList.map((p: any) => PermissionService.initializeForUser(p.employee_id || p.id, p.role))
            );

            toast.success(`Đã khởi tạo quyền cho ${noPermList.length} nhân viên`);
            await loadStats();
        } catch (err) {
            toast.error('Lỗi khi khởi tạo quyền');
        } finally {
            setFixing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                <Loader2 size={16} className="animate-spin" /> Đang kiểm tra...
            </div>
        );
    }

    return (
        <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                    <Database size={15} className="text-orange-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Kiểm tra sức khỏe phân quyền
                    </span>
                </div>
                <button
                    onClick={loadStats}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Làm mới"
                >
                    <RefreshCw size={13} className="text-slate-400" />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700">
                <div className={`p-4 text-center ${stats.noPermission > 0 ? 'bg-red-50 dark:bg-red-900' : 'bg-white dark:bg-slate-900'}`}>
                    {stats.noPermission > 0
                        ? <AlertTriangle size={20} className="mx-auto mb-1 text-red-500" />
                        : <CheckCircle2 size={20} className="mx-auto mb-1 text-emerald-500" />
                    }
                    <div className={`text-2xl font-black ${stats.noPermission > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {stats.noPermission}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">chưa có quyền</div>
                </div>
                <div className="p-4 text-center bg-white dark:bg-slate-900">
                    <Shield size={20} className="mx-auto mb-1 text-indigo-400" />
                    <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{stats.customized}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">đã có quyền</div>
                </div>
                <div className="p-4 text-center bg-white dark:bg-slate-900">
                    <Users size={20} className="mx-auto mb-1 text-amber-400" />
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.crossUnit}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">cross-unit access</div>
                </div>
            </div>

            {/* Users without permissions */}
            {stats.noPermission > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                        Nhân viên chưa có quyền:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {stats.noPermissionUsers.map(u => (
                            <span key={u.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-[11px] font-medium">
                                {u.name} <span className="opacity-60">({u.role})</span>
                            </span>
                        ))}
                        {stats.noPermission > 5 && (
                            <span className="text-[11px] text-slate-400">+{stats.noPermission - 5} khác</span>
                        )}
                    </div>
                    <button
                        onClick={handleFixAll}
                        disabled={fixing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition-colors"
                    >
                        {fixing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {fixing ? 'Đang khởi tạo...' : `Khởi tạo quyền cho ${stats.noPermission} nhân viên`}
                    </button>
                </div>
            )}

            {stats.noPermission === 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900 px-4 py-2.5 flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        Tất cả nhân viên đã được cấu hình quyền đầy đủ
                    </span>
                </div>
            )}
        </div>
    );
};

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; desc: string; gradient: string }> = ({ icon, title, desc, gradient }) => (
    <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
            {icon}
        </div>
        <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
        </div>
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Settings: React.FC = () => {
    const { theme, setTheme, accent, setAccent } = useLayoutContext();
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'Admin';

    const [activeTab, setActiveTabState] = useState<SettingsTab>(() => {
        return (localStorage.getItem('cic-erp-settings-tab') as SettingsTab) || 'system';
    });

    const setActiveTab = (tab: SettingsTab) => {
        setActiveTabState(tab);
        localStorage.setItem('cic-erp-settings-tab', tab);
    };

    // ─── Section Groups ───────────────────────────────────────────────────────
    const GROUPS: SectionGroup[] = [
        {
            id: 'display',
            label: 'Hiển thị',
            icon: <Palette size={14} />,
            items: [
                { id: 'system', label: 'Giao diện', icon: <Settings2 size={15} /> },
            ],
        },
        {
            id: 'security',
            label: 'Phân quyền',
            icon: <Shield size={14} />,
            adminOnly: true,
            items: [
                { id: 'role-defaults', label: 'Quyền theo Role', icon: <ShieldCheck size={15} />, adminOnly: true },
                { id: 'permissions', label: 'Phân quyền User', icon: <Shield size={15} />, adminOnly: true },
                { id: 'task-mgmt', label: 'Cấp quản lý', icon: <Crown size={15} />, adminOnly: true },
                { id: 'route-audit', label: 'Route & Phân quyền', icon: <ScanLine size={15} />, adminOnly: true },
                { id: 'perm-audit', label: 'Nhật ký phân quyền', icon: <History size={15} />, adminOnly: true },
            ],
        },
        {
            id: 'integrations',
            label: 'Tích hợp',
            icon: <Bot size={14} />,
            adminOnly: true,
            items: [
                { id: 'ai-api', label: 'AI API', icon: <Bot size={15} />, adminOnly: true },
                { id: 'ai-embedding', label: 'AI Embedding', icon: <Sparkles size={15} />, adminOnly: true },
                { id: 'drive', label: 'Google Drive', icon: <HardDrive size={15} />, adminOnly: true },
            ],
        },
        {
            id: 'data',
            label: 'Dữ liệu',
            icon: <BarChart3 size={14} />,
            adminOnly: true,
            items: [
                { id: 'historical', label: 'Sản lượng lịch sử', icon: <BarChart3 size={15} />, adminOnly: true },
            ],
        },
        {
            id: 'testing',
            label: 'Kiểm thử',
            icon: <FlaskConical size={14} />,
            items: [
                { id: 'testing', label: 'Kiểm thử & Debug', icon: <FlaskConical size={15} /> },
            ],
        },
    ];

    const visibleGroups = GROUPS.map(g => ({
        ...g,
        items: g.items.filter(item => !item.adminOnly || isAdmin),
    })).filter(g => (!g.adminOnly || isAdmin) && g.items.length > 0);

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cài đặt</h1>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500">v2.5.0</span>
            </div>

            <div className="flex gap-5">
                {/* ─── Left Sidebar Navigation ─────────────────────────────── */}
                <div className="w-52 flex-shrink-0">
                    <nav className="space-y-0.5 sticky top-6">
                        {visibleGroups.map(group => (
                            <div key={group.id} className="mb-4">
                                {/* Group label */}
                                <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
                                    <span className="text-slate-400 dark:text-slate-500 w-5 flex justify-center">{group.icon}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        {group.label}
                                    </span>
                                </div>
                                {/* Items */}
                                {group.items.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id)}
                                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${activeTab === item.id
                                            ? 'bg-orange-50 dark:bg-orange-900 text-orange-700 dark:text-orange-400 font-semibold'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
                                            }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className={`${activeTab === item.id ? 'text-orange-500' : 'text-slate-400 dark:text-slate-500'} w-5 flex justify-center`}>
                                                {item.icon}
                                            </span>
                                            {item.label}
                                        </span>
                                        {activeTab === item.id && (
                                            <ChevronRight size={13} className="text-orange-400 flex-shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </nav>
                </div>

                {/* ─── Right Content Area ───────────────────────────────────── */}
                <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">

                    {/* SYSTEM */}
                    {activeTab === 'system' && (
                        <div className="space-y-6">
                            <SectionHeader
                                icon={<Settings2 size={20} className="text-white" />}
                                title="Giao diện hệ thống"
                                desc="Tùy chỉnh chủ đề và màu sắc hiển thị"
                                gradient="from-slate-500 to-slate-700"
                            />
                            {/* Theme Mode */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Chế độ hiển thị</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`flex items-center justify-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer ${theme === 'light'
                                            ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-900 dark:border-orange-500 dark:text-orange-400'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                                            }`}
                                    >
                                        <Sun size={20} />
                                        <span className="font-bold text-sm">Chế độ Sáng</span>
                                    </button>
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`flex items-center justify-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer ${theme === 'dark'
                                            ? 'bg-orange-900/30 border-orange-500 text-orange-400'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                                            }`}
                                    >
                                        <Moon size={20} />
                                        <span className="font-bold text-sm">Chế độ Tối</span>
                                    </button>
                                </div>
                            </div>
                            {/* Accent Color */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Màu chủ đạo</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setAccent('orange')}
                                        className={`flex items-center justify-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer ${accent === 'orange'
                                            ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-900 dark:border-orange-500 dark:text-orange-400'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                                            }`}
                                    >
                                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#f97316' }} />
                                        <span className="font-bold text-sm">Cam (Mặc định)</span>
                                    </button>
                                    <button
                                        onClick={() => setAccent('blue')}
                                        className={`flex items-center justify-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer ${accent === 'blue'
                                            ? 'bg-sky-50 border-sky-500 text-sky-700 dark:bg-sky-900/20 dark:border-sky-500 dark:text-sky-400'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                                            }`}
                                    >
                                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#0ea5e9' }} />
                                        <span className="font-bold text-sm">CIC Blue</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ROLE DEFAULTS */}
                    {activeTab === 'role-defaults' && isAdmin && (
                        <div>
                            <SectionHeader
                                icon={<ShieldCheck size={20} className="text-white" />}
                                title="Quyền mặc định theo Role"
                                desc="Cấu hình quyền cơ bản cho từng vai trò — lưu vào database"
                                gradient="from-emerald-500 to-teal-600"
                            />
                            <RoleDefaultsManager />
                        </div>
                    )}

                    {/* PERMISSIONS (User-level) — with Health Check */}
                    {activeTab === 'permissions' && isAdmin && (
                        <div>
                            <SectionHeader
                                icon={<Shield size={20} className="text-white" />}
                                title="Phân quyền người dùng"
                                desc="Quản lý quyền truy cập chi tiết cho từng nhân viên"
                                gradient="from-purple-500 to-orange-600"
                            />
                            {/* Task 3.3: Health Check Widget */}
                            <PermissionHealthCheck />
                            <PermissionManager />
                        </div>
                    )}

                    {/* TASK MANAGEMENT */}
                    {activeTab === 'task-mgmt' && isAdmin && (
                        <div>
                            <SectionHeader
                                icon={<Crown size={20} className="text-white" />}
                                title="Cấp quản lý & Phạm vi"
                                desc="Thiết lập cấp quản lý và đơn vị phụ trách cho mỗi nhân viên"
                                gradient="from-amber-500 to-yellow-600"
                            />
                            <ManagementRankManager />
                        </div>
                    )}

                    {/* ROUTE AUDIT */}
                    {activeTab === 'route-audit' && isAdmin && (
                        <div>
                            <SectionHeader
                                icon={<ScanLine size={20} className="text-white" />}
                                title="Kiểm tra Route & Phân quyền"
                                desc="Rà soát trực quan tất cả URL và trạng thái bảo vệ phân quyền"
                                gradient="from-rose-500 to-pink-600"
                            />
                            <RouteAuditPanel />
                        </div>
                    )}

                    {/* PERMISSION AUDIT LOG */}
                    {activeTab === 'perm-audit' && isAdmin && (
                        <div>
                            <SectionHeader
                                icon={<History size={20} className="text-white" />}
                                title="Nhật ký phân quyền"
                                desc="Lịch sử thay đổi quyền truy cập, vai trò và quyền xem đơn vị"
                                gradient="from-slate-500 to-slate-700"
                            />
                            <PermissionAuditLog />
                        </div>
                    )}

                    {/* AI API */}
                    {activeTab === 'ai-api' && isAdmin && (
                        <div>
                            <SectionHeader
                                icon={<Bot size={20} className="text-white" />}
                                title="Phân quyền AI API"
                                desc="Quản lý quyền sử dụng API hệ thống cho tính năng AI"
                                gradient="from-violet-500 to-indigo-600"
                            />
                            <AIPermissionManager />
                        </div>
                    )}

                    {/* AI EMBEDDING */}
                    {activeTab === 'ai-embedding' && isAdmin && (
                        <div>
                            <SectionHeader
                                icon={<Sparkles size={20} className="text-white" />}
                                title="AI Embedding Provider"
                                desc="Cấu hình engine nhúng vector cho tài liệu (RAG)"
                                gradient="from-amber-500 to-orange-600"
                            />
                            <EmbeddingSettings />
                        </div>
                    )}

                    {/* GOOGLE DRIVE */}
                    {activeTab === 'drive' && isAdmin && (
                        <DriveSettings />
                    )}

                    {/* HISTORICAL PRODUCTION */}
                    {activeTab === 'historical' && isAdmin && (
                        <HistoricalProductionManager />
                    )}

                    {/* TESTING */}
                    {activeTab === 'testing' && (
                        <div className="space-y-8">
                            {isAdmin && (
                                <div>
                                    <SectionHeader
                                        icon={<Users size={20} className="text-white" />}
                                        title="Giả làm người dùng"
                                        desc="Test phân quyền bằng cách đóng vai user khác"
                                        gradient="from-amber-500 to-orange-600"
                                    />
                                    <UserImpersonator />
                                </div>
                            )}
                            {isAdmin && <div className="border-t border-slate-200 dark:border-slate-700" />}
                            <div>
                                <SectionHeader
                                    icon={<FlaskConical size={20} className="text-white" />}
                                    title="Kiểm thử tự động"
                                    desc="Chạy các bài test hệ thống"
                                    gradient="from-emerald-500 to-teal-600"
                                />
                                <PilotRunner />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
