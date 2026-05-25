/**
 * Centralized route permission map.
 *
 * Every private route must be declared here or in PUBLIC_ROUTES.
 * Anything missing is denied by default by RouteGuard.
 */

import { PermissionAction, PermissionResource } from '../types';

export interface RoutePermissionEntry {
    pattern: string;
    resource: PermissionResource;
    action: PermissionAction;
    label: string;
    module: string;
}

export const PUBLIC_ROUTES: { pattern: string; label: string }[] = [
    { pattern: '/', label: 'Trang chu (Dashboard)' },
    { pattern: '/dashboard', label: 'Dashboard (redirect)' },
    { pattern: '/analytics', label: 'Phan tich va Bao cao' },
    { pattern: '/documents', label: 'Quan ly Tai lieu' },
    { pattern: '/ai-assistant', label: 'Tro ly AI' },
    { pattern: '/agent-manager', label: 'Quan ly AI Agents' },
    { pattern: '/tools/*', label: 'Cong cu noi bo' },
    { pattern: '/chat', label: 'Chat noi bo' },
    { pattern: '/user-guide', label: 'Huong dan su dung' },
];

export const ROUTE_PERMISSION_MAP: RoutePermissionEntry[] = [
    { pattern: '/contracts', resource: 'contracts', action: 'view', label: 'Danh sach hop dong', module: 'Hop dong' },
    { pattern: '/contracts/new', resource: 'contracts', action: 'create', label: 'Tao hop dong moi', module: 'Hop dong' },
    { pattern: '/contracts/:id/:subId', resource: 'contracts', action: 'view', label: 'Chi tiet hop dong', module: 'Hop dong' },
    { pattern: '/contracts/:id', resource: 'contracts', action: 'view', label: 'Chi tiet hop dong', module: 'Hop dong' },
    { pattern: '/contracts/:id/edit', resource: 'contracts', action: 'update', label: 'Chinh sua hop dong', module: 'Hop dong' },

    { pattern: '/payments', resource: 'payments', action: 'view', label: 'Danh sach thanh toan', module: 'Thanh toan' },

    { pattern: '/personnel', resource: 'employees', action: 'view', label: 'Danh sach nhan su', module: 'Nhan su' },
    { pattern: '/personnel/:id', resource: 'employees', action: 'view', label: 'Chi tiet nhan vien', module: 'Nhan su' },

    { pattern: '/customers', resource: 'customers', action: 'view', label: 'Danh sach khach hang', module: 'Khach hang' },
    { pattern: '/customers/:id', resource: 'customers', action: 'view', label: 'Chi tiet khach hang', module: 'Khach hang' },

    { pattern: '/products', resource: 'products', action: 'view', label: 'Danh sach san pham', module: 'San pham' },
    { pattern: '/products/:id', resource: 'products', action: 'view', label: 'Chi tiet san pham', module: 'San pham' },

    { pattern: '/units', resource: 'units', action: 'view', label: 'Danh sach don vi', module: 'Don vi' },
    { pattern: '/units/:id', resource: 'units', action: 'view', label: 'Chi tiet don vi', module: 'Don vi' },

    { pattern: '/settings', resource: 'settings', action: 'view', label: 'Cai dat he thong', module: 'He thong' },

    { pattern: '/reports', resource: 'reports', action: 'view', label: 'Danh sach bao cao', module: 'Bao cao' },
    { pattern: '/reports/:id', resource: 'reports', action: 'view', label: 'Chi tiet bao cao', module: 'Bao cao' },

    { pattern: '/website', resource: 'news', action: 'view', label: 'Quan ly Website', module: 'Website' },

    { pattern: '/hrm/requests', resource: 'requests', action: 'view', label: 'Quan ly De xuat Noi bo', module: 'HRM' },
    { pattern: '/hrm/requests/*', resource: 'requests', action: 'view', label: 'Quan ly De xuat Noi bo', module: 'HRM' },
    { pattern: '/hrm/*', resource: 'employees', action: 'view', label: 'Quan ly Nhan su HRM', module: 'HRM' },
    { pattern: '/hrm', resource: 'employees', action: 'view', label: 'Quan ly Nhan su HRM', module: 'HRM' },

    { pattern: '/tasks', resource: 'tasks', action: 'view', label: 'Danh sach cong viec', module: 'Cong viec' },

    { pattern: '/projects', resource: 'projects', action: 'view', label: 'Danh sach du an', module: 'Du an BIM' },
    { pattern: '/projects/:id', resource: 'projects', action: 'view', label: 'Chi tiet du an', module: 'Du an BIM' },

    { pattern: '/crm/*', resource: 'crm', action: 'view', label: 'Quan ly CRM', module: 'CRM' },
    { pattern: '/crm', resource: 'crm', action: 'view', label: 'Quan ly CRM', module: 'CRM' },
];

function patternToRegex(pattern: string): RegExp {
    if (pattern.endsWith('/*')) {
        const base = pattern.slice(0, -2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^${base}(/.*)?$`);
    }

    const regexStr = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/:[\w]+/g, '[^/]+');

    return new RegExp(`^${regexStr}$`);
}

export function getRoutePermission(pathname: string): RoutePermissionEntry | null {
    const sorted = [...ROUTE_PERMISSION_MAP].sort((a, b) => b.pattern.length - a.pattern.length);
    for (const entry of sorted) {
        if (patternToRegex(entry.pattern).test(pathname)) {
            return entry;
        }
    }
    return null;
}

export function isPublicRoute(pathname: string): boolean {
    for (const route of PUBLIC_ROUTES) {
        if (patternToRegex(route.pattern).test(pathname)) {
            return true;
        }
    }
    return false;
}

export function getRouteStatus(pathname: string): 'public' | 'protected' | 'unregistered' {
    if (isPublicRoute(pathname)) return 'public';
    if (getRoutePermission(pathname)) return 'protected';
    return 'unregistered';
}
