import React, { useState } from 'react';
import { Moon, Sun, Shield, ShieldCheck, Settings2, FlaskConical, Users, Palette, HardDrive, BarChart3, Bot, Crown, ScanLine, Sparkles } from 'lucide-react';
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
import { useLayoutContext } from './layout/MainLayout';
import { useAuth } from '../contexts/AuthContext';

type SettingsTab = 'system' | 'permissions' | 'role-defaults' | 'task-mgmt' | 'ai-api' | 'ai-embedding' | 'historical' | 'drive' | 'route-audit' | 'testing';

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

    const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
        { id: 'system', label: 'Cài đặt hệ thống', icon: <Settings2 size={18} /> },
        { id: 'role-defaults', label: 'Quyền theo Role', icon: <ShieldCheck size={18} />, adminOnly: true },
        { id: 'permissions', label: 'Phân quyền User', icon: <Shield size={18} />, adminOnly: true },
        { id: 'task-mgmt', label: 'Cấp quản lý', icon: <Crown size={18} />, adminOnly: true },
        { id: 'historical', label: 'Sản lượng lịch sử', icon: <BarChart3 size={18} />, adminOnly: true },
        { id: 'ai-api', label: 'AI API', icon: <Bot size={18} />, adminOnly: true },
        { id: 'ai-embedding', label: 'AI Embedding', icon: <Sparkles size={18} />, adminOnly: true },
        { id: 'drive', label: 'Google Drive', icon: <HardDrive size={18} />, adminOnly: true },
        { id: 'route-audit', label: 'Route & Phân quyền', icon: <ScanLine size={18} />, adminOnly: true },
        { id: 'testing', label: 'Kiểm thử', icon: <FlaskConical size={18} /> },
    ];

    const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Cài đặt</h1>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-500">v2.5.0</span>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-transparent dark:border-slate-800">
                {visibleTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex-1 justify-center cursor-pointer min-w-[120px] ${activeTab === tab.id
                            ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm dark:shadow-none border border-transparent dark:border-slate-700'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50 border border-transparent'
                            }`}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none">
                {activeTab === 'system' && (
                    <div className="space-y-6">
                        {/* Theme Mode */}
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
                                <Settings2 size={16} className="text-orange-500" />
                                Chế độ hiển thị
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`flex items-center justify-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer ${theme === 'light'
                                        ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-900/20 dark:border-orange-500 dark:text-orange-400'
                                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                                        }`}
                                >
                                    <Sun size={20} />
                                    <span className="font-bold text-sm">Chế độ Sáng</span>
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`flex items-center justify-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer ${theme === 'dark'
                                        ? 'bg-orange-900/30 border-orange-500 text-orange-400'
                                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                                        }`}
                                >
                                    <Moon size={20} />
                                    <span className="font-bold text-sm">Chế độ Tối</span>
                                </button>
                            </div>
                        </div>

                        {/* Accent Color */}
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
                                <Palette size={16} className="text-orange-500" />
                                Màu chủ đạo
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setAccent('orange')}
                                    className={`flex items-center justify-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer ${accent === 'orange'
                                        ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-900/20 dark:border-orange-500 dark:text-orange-400'
                                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                                        }`}
                                >
                                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#f97316' }} />
                                    <span className="font-bold text-sm">Cam (Mặc định)</span>
                                </button>
                                <button
                                    onClick={() => setAccent('blue')}
                                    className={`flex items-center justify-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer ${accent === 'blue'
                                        ? 'bg-sky-50 border-sky-500 text-sky-700 dark:bg-sky-900/20 dark:border-sky-500 dark:text-sky-400'
                                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                                        }`}
                                >
                                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: '#0ea5e9' }} />
                                    <span className="font-bold text-sm">CIC Blue</span>
                                </button>
                            </div>
                        </div>


                    </div>
                )}

                {activeTab === 'permissions' && isAdmin && (
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-orange-600 flex items-center justify-center">
                                <Shield size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">Phân quyền người dùng</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Quản lý quyền truy cập cho từng nhân viên</p>
                            </div>
                        </div>
                        <PermissionManager />
                    </div>
                )}

                {activeTab === 'role-defaults' && isAdmin && (
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                <ShieldCheck size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">Quyền mặc định theo Role</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Cấu hình quyền cơ bản cho từng vai trò trong hệ thống</p>
                            </div>
                        </div>
                        <RoleDefaultsManager />
                    </div>
                )}

                {activeTab === 'task-mgmt' && isAdmin && (
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                                <Crown size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">Cấp quản lý & Phạm vi</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Thiết lập cấp quản lý và đơn vị phụ trách cho mỗi nhân viên (ảnh hưởng phân quyền xem Công việc)</p>
                            </div>
                        </div>
                        <ManagementRankManager />
                    </div>
                )}

                {activeTab === 'historical' && isAdmin && (
                    <HistoricalProductionManager />
                )}

                {activeTab === 'drive' && isAdmin && (
                    <DriveSettings />
                )}

                {activeTab === 'ai-api' && isAdmin && (
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                                <Bot size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">Phân quyền AI API</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Quản lý quyền sử dụng API hệ thống cho tính năng AI</p>
                            </div>
                        </div>
                        <AIPermissionManager />
                    </div>
                )}

                {activeTab === 'ai-embedding' && isAdmin && (
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                                <Sparkles size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">AI Embedding Provider</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Cấu hình engine nhúng vector cho tài liệu (RAG)</p>
                            </div>
                        </div>
                        <EmbeddingSettings />
                    </div>
                )}

                {activeTab === 'route-audit' && isAdmin && (
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                                <ScanLine size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">Kiểm tra Route & Phân quyền</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Rà soát trực quan tất cả URL và trạng thái bảo vệ phân quyền</p>
                            </div>
                        </div>
                        <RouteAuditPanel />
                    </div>
                )}

                {activeTab === 'testing' && (
                    <div className="space-y-8">
                        {/* User Impersonation - Admin Only */}
                        {isAdmin && (
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                                        <Users size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-slate-200">Giả làm người dùng</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Test phân quyền bằng cách đóng vai user khác</p>
                                    </div>
                                </div>
                                <UserImpersonator />
                            </div>
                        )}

                        {/* Separator if admin */}
                        {isAdmin && <div className="border-t border-slate-200 dark:border-slate-700/50" />}

                        {/* Pilot Runner */}
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                    <FlaskConical size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-200">Kiểm thử tự động</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Chạy các bài test hệ thống</p>
                                </div>
                            </div>
                            <PilotRunner />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
