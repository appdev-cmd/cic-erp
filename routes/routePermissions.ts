/**
 * Centralized Route Permission Map — CIC ERP
 * 
 * ── Cơ chế Deny-by-Default ──
 * - Mọi URL PHẢI được khai báo trong PUBLIC_ROUTES hoặc ROUTE_PERMISSION_MAP.
 * - Nếu URL không nằm trong cả 2 danh sách → TỰ ĐỘNG CHẶN (deny by default).
 * - Khi thêm phân hệ mới: chỉ cần thêm entry vào đây — không cần sửa logic guard.
 * 
 * ── Cách thêm phân hệ mới ──
 * 1. Thêm resource mới vào PermissionResource trong types.ts
 * 2. Thêm route pattern vào ROUTE_PERMISSION_MAP (bên dưới)
 * 3. Route tự động được bảo vệ — không cần bọc RequirePermission thủ công
 */

import { PermissionResource, PermissionAction } from '../types';

// ═══════════════════════════════════════════
// Route Permission Entry
// ═══════════════════════════════════════════

export interface RoutePermissionEntry {
    /** Route pattern (supports :param wildcards, e.g. '/contracts/:id') */
    pattern: string;
    /** Permission resource to check */
    resource: PermissionResource;
    /** Permission action (default: 'view') */
    action: PermissionAction;
    /** Vietnamese label for audit display */
    label: string;
    /** Module/group name for visual grouping */
    module: string;
}

// ═══════════════════════════════════════════
// Public Routes — Không cần quyền (ai đăng nhập cũng vào được)
// ═══════════════════════════════════════════

export const PUBLIC_ROUTES: { pattern: string; label: string }[] = [
    { pattern: '/', label: 'Trang chủ (Dashboard)' },
    { pattern: '/dashboard', label: 'Dashboard (redirect)' },
    { pattern: '/analytics', label: 'Phân tích & Báo cáo' },
    { pattern: '/documents', label: 'Quản lý Tài liệu' },
    { pattern: '/ai-assistant', label: 'Trợ lý AI' },
    { pattern: '/tools/*', label: 'Công cụ nội bộ' },
    { pattern: '/chat', label: 'Chat nội bộ' },
    { pattern: '/tasks', label: 'Công việc' },
    { pattern: '/user-guide', label: 'Hướng dẫn sử dụng' },
];

// ═══════════════════════════════════════════
// Protected Routes — Yêu cầu quyền theo resource
// ═══════════════════════════════════════════

export const ROUTE_PERMISSION_MAP: RoutePermissionEntry[] = [
    // ── Hợp đồng ──
    { pattern: '/contracts', resource: 'contracts', action: 'view', label: 'Danh sách hợp đồng', module: 'Hợp đồng' },
    { pattern: '/contracts/new', resource: 'contracts', action: 'create', label: 'Tạo hợp đồng mới', module: 'Hợp đồng' },
    { pattern: '/contracts/:id/:subId', resource: 'contracts', action: 'view', label: 'Chi tiết hợp đồng', module: 'Hợp đồng' },
    { pattern: '/contracts/:id', resource: 'contracts', action: 'view', label: 'Chi tiết hợp đồng', module: 'Hợp đồng' },
    { pattern: '/contracts/:id/edit', resource: 'contracts', action: 'update', label: 'Chỉnh sửa hợp đồng', module: 'Hợp đồng' },

    // ── Thanh toán ──
    { pattern: '/payments', resource: 'payments', action: 'view', label: 'Danh sách thanh toán', module: 'Thanh toán' },

    // ── Nhân sự ──
    { pattern: '/personnel', resource: 'employees', action: 'view', label: 'Danh sách nhân sự', module: 'Nhân sự' },
    { pattern: '/personnel/:id', resource: 'employees', action: 'view', label: 'Chi tiết nhân viên', module: 'Nhân sự' },

    // ── Khách hàng ──
    { pattern: '/customers', resource: 'customers', action: 'view', label: 'Danh sách khách hàng', module: 'Khách hàng' },
    { pattern: '/customers/:id', resource: 'customers', action: 'view', label: 'Chi tiết khách hàng', module: 'Khách hàng' },

    // ── Sản phẩm ──
    { pattern: '/products', resource: 'products', action: 'view', label: 'Danh sách sản phẩm', module: 'Sản phẩm' },
    { pattern: '/products/:id', resource: 'products', action: 'view', label: 'Chi tiết sản phẩm', module: 'Sản phẩm' },

    // ── Đơn vị ──
    { pattern: '/units', resource: 'units', action: 'view', label: 'Danh sách đơn vị', module: 'Đơn vị' },
    { pattern: '/units/:id', resource: 'units', action: 'view', label: 'Chi tiết đơn vị', module: 'Đơn vị' },

    // ── Cài đặt ──
    { pattern: '/settings', resource: 'settings', action: 'view', label: 'Cài đặt hệ thống', module: 'Hệ thống' },

    // ── Báo cáo ──
    { pattern: '/reports', resource: 'reports', action: 'view', label: 'Danh sách báo cáo', module: 'Báo cáo' },
    { pattern: '/reports/:id', resource: 'reports', action: 'view', label: 'Chi tiết báo cáo', module: 'Báo cáo' },

    // ═══════════════════════════════════════════
    // 🔽 THÊM PHÂN HỆ MỚI Ở ĐÂY 🔽
    // Ví dụ:
    // { pattern: '/inventory', resource: 'inventory', action: 'view', label: 'Quản lý kho', module: 'Kho hàng' },
    // { pattern: '/inventory/:id', resource: 'inventory', action: 'view', label: 'Chi tiết kho', module: 'Kho hàng' },
    // ═══════════════════════════════════════════
];

// ═══════════════════════════════════════════
// Route Matching Utility
// ═══════════════════════════════════════════

/**
 * Convert route pattern (e.g. '/contracts/:id/edit') to a regex
 * that matches actual URLs (e.g. '/contracts/abc-123/edit')
 */
function patternToRegex(pattern: string): RegExp {
    // Handle wildcard routes like '/tools/*'
    if (pattern.endsWith('/*')) {
        const base = pattern.slice(0, -2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^${base}(/.*)?$`);
    }
    // Replace :param with a wildcard that matches any segment
    const regexStr = pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/:[\w]+/g, '[^/]+');
    return new RegExp(`^${regexStr}$`);
}

/**
 * Find the matching permission entry for a given pathname.
 * Matches more specific patterns first (longer patterns checked first).
 * 
 * @returns The matched entry, or null if no match
 */
export function getRoutePermission(pathname: string): RoutePermissionEntry | null {
    // Sort by pattern length descending so more specific patterns match first
    // e.g. '/contracts/:id/edit' should match before '/contracts/:id'
    const sorted = [...ROUTE_PERMISSION_MAP].sort((a, b) => b.pattern.length - a.pattern.length);
    for (const entry of sorted) {
        const regex = patternToRegex(entry.pattern);
        if (regex.test(pathname)) {
            return entry;
        }
    }
    return null;
}

/**
 * Check if a pathname is a public route (no permission needed).
 */
export function isPublicRoute(pathname: string): boolean {
    for (const route of PUBLIC_ROUTES) {
        const regex = patternToRegex(route.pattern);
        if (regex.test(pathname)) return true;
    }
    return false;
}

/**
 * Determine the protection status of a route:
 * - 'public': anyone logged in can access
 * - 'protected': requires specific permission
 * - 'unregistered': not in any list → DENIED by default
 */
export function getRouteStatus(pathname: string): 'public' | 'protected' | 'unregistered' {
    if (isPublicRoute(pathname)) return 'public';
    if (getRoutePermission(pathname)) return 'protected';
    return 'unregistered';
}
