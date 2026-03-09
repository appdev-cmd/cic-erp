import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Moon, Sun, UserX, ShieldAlert } from 'lucide-react';
import Sidebar from '../Sidebar';
import Header from '../Header';
import { RoleSwitcher } from '../RoleSwitcher';
import DebugPanel from '../DebugPanel';
import CommandPalette from '../ui/CommandPalette';
import { useAuth } from '../../contexts/AuthContext';
import Auth from '../Auth';
import ErrorBoundary from '../ErrorBoundary';
import { Unit, UserRole } from '../../types';
import { UnitService } from '../../services';
import { NON_BUSINESS_UNIT_CODES } from '../../constants';
import { useCurrentUserVisibleUnits } from '../../hooks';
import { useImpersonation } from '../../contexts/ImpersonationContext';

const MainLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { session, isLoading: isLoadingSession, profile } = useAuth();
    const { visibleUnits } = useCurrentUserVisibleUnits();
    const { impersonatedUser, isImpersonating, stopImpersonation } = useImpersonation();

    // Sidebar state
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Unit selection (shared across dashboard/analytics)
    const ALL_UNIT: Unit = {
        id: 'all',
        name: 'Toàn công ty',
        code: 'ALL',
        type: 'Company',
        target: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 },
        lastYearActual: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 }
    };
    const [selectedUnit, setSelectedUnit] = useState<Unit>(ALL_UNIT);

    // Year filter (shared with Dashboard)
    const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());

    // All business units (for Header filter dropdown)
    const [allUnits, setAllUnits] = useState<Unit[]>([]);

    useEffect(() => {
        UnitService.getAll()
            .then(units => setAllUnits(units.filter(u => !NON_BUSINESS_UNIT_CODES.includes(u.code))))
            .catch(e => console.error('[MainLayout] Failed to fetch units:', e));
    }, []);

    // Theme management — 2 axes: mode (light/dark) + accent (orange/blue)
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('contract-pro-theme');
        // Migrate legacy 'blue' theme: convert to dark mode + blue accent
        if (saved === 'blue') {
            localStorage.setItem('contract-pro-theme', 'dark');
            localStorage.setItem('contract-pro-accent', 'blue');
            return 'dark';
        }
        if (saved === 'light' || saved === 'dark') return saved;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    });

    const [accent, setAccent] = useState<'orange' | 'blue'>(() => {
        const saved = localStorage.getItem('contract-pro-accent');
        if (saved === 'orange' || saved === 'blue') return saved;
        return 'orange';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('dark');
        if (theme === 'dark') root.classList.add('dark');
        localStorage.setItem('contract-pro-theme', theme);
    }, [theme]);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('accent-blue');
        if (accent === 'blue') root.classList.add('accent-blue');
        localStorage.setItem('contract-pro-accent', accent);
    }, [accent]);

    // Responsive sidebar
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Derive activeTab from location for Sidebar highlighting
    const getActiveTab = () => {
        const path = location.pathname;
        if (path === '/' || path === '/dashboard') return 'dashboard';
        if (path.startsWith('/contracts')) return 'contracts';
        if (path.startsWith('/payments')) return 'payments';
        if (path.startsWith('/analytics')) return 'analytics';
        if (path.startsWith('/ai-assistant')) return 'ai-assistant';
        if (path.startsWith('/tools')) return 'tools';
        if (path.startsWith('/personnel')) return 'personnel';
        if (path.startsWith('/customers')) return 'customers';
        if (path.startsWith('/products')) return 'products';
        if (path.startsWith('/units')) return 'units';
        if (path.startsWith('/settings')) return 'settings';
        if (path.startsWith('/tasks')) return 'tasks';
        if (path.startsWith('/my-tasks')) return 'my-tasks';
        return 'dashboard';
    };

    // Dev bypass auth mode
    const isDevBypass = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';

    // Loading state (skip if dev bypass)
    if (!isDevBypass && isLoadingSession) {
        return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400">Loading...</div>;
    }

    // Auth required: must have BOTH a session AND a valid profile
    // If session exists but profile is null, the user was rejected by security checks
    // (non-CIC email, no matching employee, etc.)
    if (!isDevBypass && (!session || !profile)) {
        return (
            <ErrorBoundary>
                <Auth />
            </ErrorBoundary>
        );
    }

    const mainMarginClass = isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64';
    const contentMaxWidthClass = isSidebarCollapsed ? 'max-w-[1920px]' : 'max-w-[1600px]';

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 antialiased">
                <Toaster position="top-center" richColors closeButton />

                {/* Sidebar */}
                <Sidebar
                    activeTab={getActiveTab()}
                    setActiveTab={(tab) => navigate(`/${tab === 'dashboard' ? '' : tab}`)}
                    isOpen={isSidebarOpen}
                    isCollapsed={isSidebarCollapsed}
                    setIsCollapsed={setIsSidebarCollapsed}
                    onClose={() => setIsSidebarOpen(false)}
                />

                {/* Main Content */}
                <div className={`transition-all duration-300 ${mainMarginClass}`}>
                    {/* Header */}
                    <Header
                        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        isSidebarCollapsed={isSidebarCollapsed}
                        selectedUnit={selectedUnit}
                        onSelectUnit={setSelectedUnit}
                        yearFilter={yearFilter}
                        onYearChange={setYearFilter}
                        allUnits={allUnits}
                    />

                    {/* Page Content */}
                    <main className={`mt-16 p-4 md:p-6 lg:p-8 ${isImpersonating ? 'pb-20' : ''}`}>
                        <div className={`${contentMaxWidthClass} mx-auto`}>
                            {/* Pass context to child routes via Outlet */}
                            <Outlet context={{ selectedUnit, setSelectedUnit, yearFilter, setYearFilter, theme, setTheme, accent, setAccent }} />
                        </div>
                    </main>
                </div>

                {/* Development Tools */}
                {profile?.role === 'Admin' && !isImpersonating && <RoleSwitcher />}
                {/* <DebugPanel /> */}

                {/* Global Search (Cmd+K) */}
                <CommandPalette />

                {/* ═══ Floating Impersonation Banner ═══ */}
                {isImpersonating && impersonatedUser && (
                    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300">
                        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-2xl shadow-orange-500/30">
                            <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <ShieldAlert size={18} className="text-white/80 flex-shrink-0" />
                                    <div className="text-sm">
                                        <span className="font-medium opacity-90">Đang đóng vai: </span>
                                        <span className="font-black">{impersonatedUser.fullName}</span>
                                        <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-[11px] font-bold backdrop-blur-sm">
                                            {impersonatedUser.role}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        stopImpersonation();
                                        // Navigate to dashboard in case current page is restricted
                                        navigate('/');
                                    }}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-white text-orange-700 rounded-lg text-sm font-black hover:bg-orange-50 transition-all shadow-lg flex-shrink-0"
                                >
                                    <UserX size={16} />
                                    Thoát đóng vai
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
};

export default MainLayout;

// Hook to access layout context in child routes
import { useOutletContext } from 'react-router-dom';

interface LayoutContext {
    selectedUnit: Unit;
    setSelectedUnit: (unit: Unit) => void;
    yearFilter: string;
    setYearFilter: (year: string) => void;
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    accent: 'orange' | 'blue';
    setAccent: (accent: 'orange' | 'blue') => void;
}

export function useLayoutContext() {
    return useOutletContext<LayoutContext>();
}
