import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { usePermissionCheck } from '../../hooks/usePermissions';
import { getRoutePermission, isPublicRoute, RoutePermissionEntry } from '../../routes/routePermissions';

interface RouteGuardProps {
    children: React.ReactNode;
}

/**
 * RouteGuard — Centralized route protection (Deny-by-Default).
 * 
 * Wraps the main content area (Outlet) in MainLayout.
 * For every URL navigation:
 * 1. Public route → allow
 * 2. Protected route in ROUTE_PERMISSION_MAP → check user permission
 * 3. Unknown route (not in any list) → DENY (deny by default)
 */
const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { can, isLoading, role } = usePermissionCheck();
    const [showSpinner, setShowSpinner] = useState(false);

    // Prevent flash of loading spinner for fast permission checks
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (isLoading) {
            timer = setTimeout(() => setShowSpinner(true), 200);
        } else {
            setShowSpinner(false);
        }
        return () => clearTimeout(timer);
    }, [isLoading]);

    const pathname = location.pathname;

    // ── 0. Localhost → bypass all permission checks ──
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
        return <>{children}</>;
    }

    // ── 1. Public route → always allow ──
    if (isPublicRoute(pathname)) {
        return <>{children}</>;
    }

    // ── 2. Still loading permissions → show spinner (after delay) ──
    if (isLoading) {
        if (!showSpinner) return null; // Invisible during initial delay
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Đang kiểm tra quyền truy cập...</p>
                </div>
            </div>
        );
    }

    // ── 3. Find matching permission entry ──
    const permEntry = getRoutePermission(pathname);

    // ── 4. Unknown route (not public, not in map) → DENY by default ──
    //       Admin & Leadership bypass: these roles can access ALL routes
    if (!permEntry) {
        if (role === 'Admin' || role === 'Leadership') {
            return <>{children}</>;
        }
        return <AccessDeniedScreen reason="unregistered" pathname={pathname} />;
    }

    // ── 5. Protected route → check permission ──
    const hasPermission = can(permEntry.resource, permEntry.action);
    if (!hasPermission) {
        return <AccessDeniedScreen reason="forbidden" permEntry={permEntry} />;
    }

    // ── 6. Authorized → render content ──
    return <>{children}</>;
};

// ═══════════════════════════════════════════
// Access Denied Screen
// ═══════════════════════════════════════════

interface AccessDeniedScreenProps {
    reason: 'forbidden' | 'unregistered';
    permEntry?: RoutePermissionEntry;
    pathname?: string;
}

const AccessDeniedScreen: React.FC<AccessDeniedScreenProps> = ({ reason, permEntry, pathname }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 md:p-12 max-w-md w-full text-center">
                {/* Icon */}
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                    reason === 'unregistered' 
                        ? 'bg-amber-100 dark:bg-amber-900/30' 
                        : 'bg-rose-100 dark:bg-rose-900/30'
                }`}>
                    {reason === 'unregistered' 
                        ? <Lock size={40} className="text-amber-600 dark:text-amber-400" />
                        : <ShieldAlert size={40} className="text-rose-600 dark:text-rose-400" />
                    }
                </div>

                {/* Title */}
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-2">
                    {reason === 'unregistered' ? 'Trang không khả dụng' : 'Truy cập bị từ chối'}
                </h2>

                {/* Description */}
                <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm leading-relaxed">
                    {reason === 'unregistered'
                        ? 'Địa chỉ này chưa được đăng ký trong hệ thống phân quyền. Vui lòng liên hệ Admin.'
                        : 'Tài khoản của bạn không được cấp quyền truy cập vào phân hệ này.'
                    }
                </p>

                {/* Detail badge */}
                {permEntry && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-mono mb-6">
                        <Lock size={12} />
                        <span>{permEntry.module} → {permEntry.resource}.{permEntry.action}</span>
                    </div>
                )}
                {pathname && reason === 'unregistered' && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-mono mb-6">
                        <Lock size={12} />
                        <span>{pathname}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <ArrowLeft size={18} />
                        Quay lại trang trước
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors"
                    >
                        Về trang chủ
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RouteGuard;
