import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Moon, Sun, Shield, ShieldCheck, Settings2, FlaskConical, Users, Palette,
    HardDrive, BarChart3, Bot, Crown, ScanLine, Sparkles, History,
    ChevronRight, AlertTriangle, CheckCircle2, RefreshCw, Loader2, Database, TrendingUp
} from 'lucide-react';
import PilotRunner from './admin/PilotRunner';
import PermissionManager from './settings/PermissionManager';
import RoleDefaultsManager from './settings/RoleDefaultsManager';
import UserImpersonator from './settings/UserImpersonator';
import DriveSettings from './settings/DriveSettings';
import ManagementRankManager from './settings/ManagementRankManager';
import HistoricalProductionManager from './settings/HistoricalProductionManager';
import CompanyTargetManager from './settings/CompanyTargetManager';
import RouteAuditPanel from './settings/RouteAuditPanel';
import PermissionAuditLog from './settings/PermissionAuditLog';
import AnalyticsCardManager from './settings/AnalyticsCardManager';
import AnomalyRuleManager from './settings/AnomalyRuleManager';
import { useLayoutContext } from './layout/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { useEffectiveProfile } from '../contexts/ImpersonationContext';
import { useSlidePanel } from '../contexts/SlidePanelContext';
import { dataClient } from '../lib/dataClient';
import { PermissionService } from '../services/permissionService';
import { toast } from 'sonner';

const AISettingsManager = React.lazy(() => import('./settings/AISettingsManager'));

// ─── Types ───────────────────────────────────────────────────────────────────
type SettingsTab =
    | 'system'
    | 'permissions' | 'role-defaults' | 'task-mgmt' | 'route-audit' | 'perm-audit'
    | 'drive'
    | 'historical' | 'company-target' | 'analytics-cards' | 'anomaly-rules'
    | 'ai-settings'
    | 'testing';

interface SettingsTabItem {
    id: SettingsTab;
    label: string;
    desc: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
}

interface SectionGroup {
    id: string;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
    items: SettingsTabItem[];
}

// ─── Permission Health Check Widget ──────────────────────────────────────────
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
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-4">
                <Loader2 size={16} className="animate-spin" /> Đang kiểm tra...
            </div>
        );
    }

    return (
        <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <Database size={15} className="text-orange-500 dark:text-orange-400" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Kiểm tra sức khỏe phân quyền
                    </span>
                </div>
                <button
                    onClick={loadStats}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    title="Làm mới"
                >
                    <RefreshCw size={13} className="text-slate-400 dark:text-slate-500" />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800">
                <div className={`p-4 text-center ${stats.noPermission > 0 ? 'bg-red-50/50 dark:bg-red-950/20' : 'bg-white dark:bg-slate-900'}`}>
                    {stats.noPermission > 0
                        ? <AlertTriangle size={20} className="mx-auto mb-1 text-red-500 dark:text-red-400" />
                        : <CheckCircle2 size={20} className="mx-auto mb-1 text-emerald-500 dark:text-emerald-400" />
                    }
                    <div className={`text-2xl font-black ${stats.noPermission > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {stats.noPermission}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">chưa có quyền</div>
                </div>
                <div className="p-4 text-center bg-white dark:bg-slate-900">
                    <Shield size={20} className="mx-auto mb-1 text-indigo-400 dark:text-indigo-500" />
                    <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{stats.customized}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">đã có quyền</div>
                </div>
                <div className="p-4 text-center bg-white dark:bg-slate-900">
                    <Users size={20} className="mx-auto mb-1 text-amber-400 dark:text-amber-500" />
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.crossUnit}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">cross-unit access</div>
                </div>
            </div>

            {/* Users without permissions */}
            {stats.noPermission > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                        Nhân viên chưa có quyền:
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {stats.noPermissionUsers.map(u => (
                            <span key={u.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 rounded text-[11px] font-medium border border-red-100 dark:border-red-900/50">
                                {u.name} <span className="opacity-60">({u.role})</span>
                            </span>
                        ))}
                        {stats.noPermission > 5 && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">+{stats.noPermission - 5} khác</span>
                        )}
                    </div>
                    <button
                        onClick={handleFixAll}
                        disabled={fixing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                    >
                        {fixing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {fixing ? 'Đang khởi tạo...' : `Khởi tạo quyền cho ${stats.noPermission} nhân viên`}
                    </button>
                </div>
            )}

            {stats.noPermission === 0 && (
                <div className="border-t border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-2.5 flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
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

// ─── Component Cài Đặt Giao Diện Hệ Thống ───────────────────────────────────────
const SystemSettingsPanel: React.FC = () => {
    const { theme, setTheme, accent, setAccent } = useLayoutContext();
    return (
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
                            ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-950 dark:border-orange-500 dark:text-orange-400'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                    >
                        <Sun size={20} />
                        <span className="font-bold text-sm">Chế độ Sáng</span>
                    </button>
                    <button
                        onClick={() => setTheme('dark')}
                        className={`flex items-center justify-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer ${theme === 'dark'
                            ? 'bg-orange-950/30 border-orange-500 text-orange-400 dark:bg-orange-950/40 dark:border-orange-500'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
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
                            ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-950 dark:border-orange-500 dark:text-orange-400'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                    >
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#f97316' }} />
                        <span className="font-bold text-sm">Cam (Mặc định)</span>
                    </button>
                    <button
                        onClick={() => setAccent('blue')}
                        className={`flex items-center justify-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer ${accent === 'blue'
                            ? 'bg-sky-50 border-sky-500 text-sky-700 dark:bg-sky-950/20 dark:border-sky-500 dark:text-sky-400'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                    >
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#0ea5e9' }} />
                        <span className="font-bold text-sm">CIC Blue</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Settings: React.FC = () => {
    const { openPanel } = useSlidePanel();
    const { profile: effectiveProfile } = useEffectiveProfile();
    // Impersonation-aware: hide admin tabs when impersonating non-admin
    const isAdmin = effectiveProfile?.role === 'Admin';

    // ─── Section Groups ───────────────────────────────────────────────────────
    const GROUPS: SectionGroup[] = [
        {
            id: 'display',
            label: 'Hiển thị',
            icon: <Palette size={14} />,
            items: [
                {
                    id: 'system',
                    label: 'Giao diện',
                    desc: 'Tùy chỉnh chủ đề sáng/tối và màu sắc hiển thị chủ đạo của hệ thống',
                    icon: <Settings2 size={16} />
                },
            ],
        },
        {
            id: 'security',
            label: 'Phân quyền',
            icon: <Shield size={14} />,
            adminOnly: true,
            items: [
                {
                    id: 'role-defaults',
                    label: 'Quyền theo Role',
                    desc: 'Cấu hình quyền cơ bản mặc định áp dụng cho từng vai trò',
                    icon: <ShieldCheck size={16} />,
                    adminOnly: true
                },
                {
                    id: 'permissions',
                    label: 'Phân quyền User',
                    desc: 'Quản lý và cấp quyền chi tiết cho từng tài khoản nhân viên',
                    icon: <Shield size={16} />,
                    adminOnly: true
                },
                {
                    id: 'analytics-cards',
                    label: 'Thẻ Phân tích KD',
                    desc: 'Phân quyền hiển thị các thẻ phân tích trong BI theo vai trò',
                    icon: <BarChart3 size={16} />,
                    adminOnly: true
                },
                {
                    id: 'task-mgmt',
                    label: 'Cấp quản lý',
                    desc: 'Thiết lập cấp quản lý trực tiếp và phạm vi phụ trách của nhân viên',
                    icon: <Crown size={16} />,
                    adminOnly: true
                },
                {
                    id: 'route-audit',
                    label: 'Route & Phân quyền',
                    desc: 'Rà soát trạng thái bảo vệ và phân quyền cho tất cả đường dẫn URL',
                    icon: <ScanLine size={16} />,
                    adminOnly: true
                },
                {
                    id: 'perm-audit',
                    label: 'Nhật ký phân quyền',
                    desc: 'Xem lịch sử thay đổi phân quyền, vai trò của nhân viên',
                    icon: <History size={16} />,
                    adminOnly: true
                },
            ],
        },
        {
            id: 'integrations',
            label: 'Tích hợp',
            icon: <HardDrive size={14} />,
            adminOnly: true,
            items: [
                {
                    id: 'drive',
                    label: 'Google Drive',
                    desc: 'Kết nối, xác thực và cấu hình thư mục lưu trữ tài liệu Google Drive',
                    icon: <HardDrive size={16} />,
                    adminOnly: true
                },
            ],
        },
        {
            id: 'data',
            label: 'Dữ liệu',
            icon: <BarChart3 size={14} />,
            adminOnly: true,
            items: [
                {
                    id: 'historical',
                    label: 'Sản lượng lịch sử',
                    desc: 'Quản lý số liệu sản lượng, doanh thu lịch sử từ các năm trước',
                    icon: <BarChart3 size={16} />,
                    adminOnly: true
                },
                {
                    id: 'company-target',
                    label: 'Chỉ tiêu ĐHCĐ',
                    desc: 'Thiết lập chỉ tiêu kế hoạch năm do Đại hội cổ đông giao phó',
                    icon: <TrendingUp size={16} />,
                    adminOnly: true
                },
                {
                    id: 'anomaly-rules',
                    label: 'Ngưỡng rà soát HĐ',
                    desc: 'Thiết lập quy tắc và ngưỡng để phát hiện hợp đồng bất thường',
                    icon: <AlertTriangle size={16} />,
                    adminOnly: true
                },
            ],
        },
        {
            id: 'ai',
            label: 'Trí tuệ nhân tạo',
            icon: <Bot size={14} />,
            adminOnly: true,
            items: [
                {
                    id: 'ai-settings',
                    label: 'Thiết lập AI',
                    desc: 'Cấu hình các khóa API Google Gemini và cài đặt AI Assistant',
                    icon: <Bot size={16} />,
                    adminOnly: true
                },
            ],
        },
        {
            id: 'testing',
            label: 'Kiểm thử',
            icon: <FlaskConical size={14} />,
            items: [
                {
                    id: 'testing',
                    label: 'Kiểm thử & Debug',
                    desc: 'Công cụ chạy test hệ thống tự động và giả lập vai trò người dùng',
                    icon: <FlaskConical size={16} />
                },
            ],
        },
    ];

    const visibleGroups = useMemo(() => {
        return GROUPS.map(g => ({
            ...g,
            items: g.items.filter(item => !item.adminOnly || isAdmin),
        })).filter(g => (!g.adminOnly || isAdmin) && g.items.length > 0);
    }, [isAdmin]);

    const handleOpenPanel = useCallback((tabId: SettingsTab, title: string, itemIcon: React.ReactNode) => {
        let component: React.ReactNode = null;

        switch (tabId) {
            case 'system':
                component = <SystemSettingsPanel />;
                break;
            case 'role-defaults':
                component = (
                    <div>
                        <SectionHeader
                            icon={<ShieldCheck size={20} className="text-white" />}
                            title="Quyền mặc định theo Role"
                            desc="Cấu hình quyền cơ bản cho từng vai trò — lưu vào database"
                            gradient="from-emerald-500 to-teal-600"
                        />
                        <RoleDefaultsManager />
                    </div>
                );
                break;
            case 'permissions':
                component = (
                    <div>
                        <SectionHeader
                            icon={<Shield size={20} className="text-white" />}
                            title="Phân quyền người dùng"
                            desc="Quản lý quyền truy cập chi tiết cho từng nhân viên"
                            gradient="from-purple-500 to-orange-600"
                        />
                        <PermissionHealthCheck />
                        <PermissionManager />
                    </div>
                );
                break;
            case 'analytics-cards':
                component = (
                    <div>
                        <SectionHeader
                            icon={<BarChart3 size={20} className="text-white" />}
                            title="Thẻ Phân tích kinh doanh theo Role"
                            desc="Cấu hình mỗi vai trò được phép xem những thẻ (card) nào trong phân hệ BI"
                            gradient="from-sky-500 to-indigo-600"
                        />
                        <AnalyticsCardManager />
                    </div>
                );
                break;
            case 'task-mgmt':
                component = (
                    <div>
                        <SectionHeader
                            icon={<Crown size={20} className="text-white" />}
                            title="Cấp quản lý & Phạm vi"
                            desc="Thiết lập cấp quản lý và đơn vị phụ trách cho mỗi nhân viên"
                            gradient="from-amber-500 to-yellow-600"
                        />
                        <ManagementRankManager />
                    </div>
                );
                break;
            case 'route-audit':
                component = (
                    <div>
                        <SectionHeader
                            icon={<ScanLine size={20} className="text-white" />}
                            title="Kiểm tra Route & Phân quyền"
                            desc="Rà soát trực quan tất cả URL và trạng thái bảo vệ phân quyền"
                            gradient="from-rose-500 to-pink-600"
                        />
                        <RouteAuditPanel />
                    </div>
                );
                break;
            case 'perm-audit':
                component = (
                    <div>
                        <SectionHeader
                            icon={<History size={20} className="text-white" />}
                            title="Nhật ký phân quyền"
                            desc="Lịch sử thay đổi quyền truy cập, vai trò và quyền xem đơn vị"
                            gradient="from-slate-500 to-slate-700"
                        />
                        <PermissionAuditLog />
                    </div>
                );
                break;
            case 'drive':
                component = <DriveSettings />;
                break;
            case 'historical':
                component = <HistoricalProductionManager />;
                break;
            case 'company-target':
                component = (
                    <div>
                        <SectionHeader
                            icon={<TrendingUp size={20} className="text-white" />}
                            title="Chỉ tiêu ĐHCĐ"
                            desc="Chỉ tiêu Đại hội cổ đông giao theo năm (Ký kết, Doanh thu, Lợi nhuận)"
                            gradient="from-orange-500 to-amber-600"
                        />
                        <CompanyTargetManager />
                    </div>
                );
                break;
            case 'anomaly-rules':
                component = (
                    <div>
                        <SectionHeader
                            icon={<AlertTriangle size={20} className="text-white" />}
                            title="Ngưỡng rà soát Hợp đồng bất thường"
                            desc="Bật/tắt luật, đặt mức độ và ngưỡng phát hiện cho báo cáo rà soát hợp đồng"
                            gradient="from-red-500 to-rose-600"
                        />
                        <AnomalyRuleManager />
                    </div>
                );
                break;
            case 'ai-settings':
                component = (
                    <div className="space-y-6">
                        <React.Suspense fallback={
                            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-4">
                                <Loader2 size={16} className="animate-spin" /> Đang tải thiết lập AI...
                            </div>
                        }>
                            <AISettingsManager />
                        </React.Suspense>
                    </div>
                );
                break;
            case 'testing':
                component = (
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
                        {isAdmin && <div className="border-t border-slate-200 dark:border-slate-800" />}
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
                );
                break;
            default:
                component = <div className="text-slate-500 dark:text-slate-400">Không tìm thấy tính năng</div>;
        }

        openPanel({
            title: title,
            icon: itemIcon,
            component: (
                <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900 min-h-full">
                    <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm dark:shadow-none">
                        {component}
                    </div>
                </div>
            ),
            url: `/settings?panel=${tabId}`
        });
    }, [openPanel, isAdmin]);

    const initialOpenRef = useRef(false);

    useEffect(() => {
        if (!effectiveProfile || initialOpenRef.current) return;

        const params = new URLSearchParams(window.location.search);
        const panelParam = params.get('panel') as SettingsTab | null;
        if (panelParam) {
            const foundItem = visibleGroups
                .flatMap(g => g.items)
                .find(item => item.id === panelParam);

            if (foundItem) {
                initialOpenRef.current = true;
                handleOpenPanel(foundItem.id, foundItem.label, foundItem.icon);
            }
        }
    }, [effectiveProfile, visibleGroups, handleOpenPanel]);

    const col1GroupIds = ['display', 'integrations', 'ai'];
    const col2GroupIds = ['security'];
    const col3GroupIds = ['data', 'testing'];

    const col1Groups = visibleGroups.filter(g => col1GroupIds.includes(g.id));
    const col2Groups = visibleGroups.filter(g => col2GroupIds.includes(g.id));
    const col3Groups = visibleGroups.filter(g => col3GroupIds.includes(g.id));

    const renderGroupCard = (group: any) => {
        return (
            <div
                key={group.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm dark:shadow-none overflow-hidden flex flex-col"
            >
                {/* Group Header */}
                <div className="flex items-center gap-2.5 px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-orange-500 dark:text-orange-400 w-5 flex justify-center">{group.icon}</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        {group.label}
                    </span>
                </div>

                {/* Group Items */}
                <div className="p-3 space-y-1.5 flex-1">
                    {group.items.map((item: any) => (
                        <div
                            key={item.id}
                            onClick={() => handleOpenPanel(item.id, item.label, item.icon)}
                            className="group w-full flex items-center justify-between gap-3 p-3 rounded-xl text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                            <div className="flex items-start gap-3 min-w-0">
                                {/* Item Icon */}
                                <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-950/35 flex items-center justify-center flex-shrink-0 text-orange-600 dark:text-orange-400 transition-colors duration-200 group-hover:bg-orange-100 dark:group-hover:bg-orange-950/60">
                                    {item.icon}
                                </div>

                                {/* Text Info */}
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                        {item.label}
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5 whitespace-pre-wrap">
                                        {item.desc}
                                    </div>
                                </div>
                            </div>

                            {/* Arrow Action */}
                            <ChevronRight
                                size={15}
                                className="text-slate-400 dark:text-slate-600 group-hover:text-orange-500 dark:group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all flex-shrink-0"
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cài đặt</h1>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500 dark:text-slate-400">v2.5.0</span>
            </div>

            {/* Grid of Group Cards - Customized to 3 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {/* Column 1: Hiển thị, Tích hợp, Trí tuệ nhân tạo, Kiểm thử */}
                <div className="space-y-6">
                    {col1Groups.map(group => renderGroupCard(group))}
                </div>

                {/* Column 2: Phân quyền */}
                <div className="space-y-6">
                    {col2Groups.map(group => renderGroupCard(group))}
                </div>

                {/* Column 3: Dữ liệu */}
                <div className="space-y-6">
                    {col3Groups.map(group => renderGroupCard(group))}
                </div>
            </div>
        </div>
    );
};

export default Settings;



