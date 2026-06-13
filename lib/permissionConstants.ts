/**
 * Centralized Permission Constants — CIC ERP
 *
 * Single source of truth for labels, colors, and ordered lists
 * used across PermissionManager, RoleDefaultsManager, and other UI.
 *
 * ⚠️ Khi thêm resource/role mới: chỉ cần sửa file này.
 */
import type { PermissionAction, PermissionResource, UserRole } from '../types';

// ─── Resource Labels ─────────────────────────────────────
export const RESOURCE_LABELS: Record<PermissionResource, string> = {
    contracts: 'Hợp đồng',
    customers: 'Khách hàng',
    products: 'Sản phẩm / DV',
    payments: 'Tài chính',
    employees: 'Nhân sự',
    units: 'Đơn vị',
    tasks: 'Công việc',
    settings: 'Cài đặt',
    permissions: 'Phân quyền',
    reports: 'Báo cáo',
    news: 'Tin tức / Website',
    projects: 'Dự án (BIM)',
    requests: 'Đề xuất',
    leaves: 'Nghỉ phép',
    recruitment: 'Tuyển dụng',
    analytics: 'Phân tích kinh doanh',
    crm: 'CRM',
    tools: 'Công cụ nội bộ',
    tech_intel: 'Giám sát Công nghệ',
};

// ─── Action Labels ────────────────────────────────────────
export const ACTION_LABELS: Record<PermissionAction, string> = {
    view: 'Xem',
    create: 'Thêm',
    update: 'Sửa',
    delete: 'Xóa',
};

// ─── Role Labels ──────────────────────────────────────────
export const ROLE_LABELS: Record<UserRole, string> = {
    Admin: 'Quản trị HT',
    Leadership: 'Ban lãnh đạo',
    UnitLeader: 'Lãnh đạo ĐV',
    AdminUnit: 'Admin ĐV',
    NVKD: 'NV Kinh doanh',
    NVKT: 'NV Kỹ thuật',
    Accountant: 'Kế toán',
    ChiefAccountant: 'KT Trưởng',
    Legal: 'Pháp chế',
    Marketing: 'Marketing',
};

// ─── Role Colors (for badges in PermissionManager) ───────
/** Flat badge style: `bg-* text-*` classes */
export const ROLE_BADGE_COLORS: Record<UserRole, string> = {
    Admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Leadership: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    UnitLeader: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    AdminUnit: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    NVKD: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    NVKT: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    Accountant: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    ChiefAccountant: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    Legal: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    Marketing: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
};

// Button/tab style: text-{color} + active bg-{color}/border-{color} classes (for RoleDefaultsManager tabs)
export const ROLE_TAB_COLORS: Record<UserRole, { bg: string; active: string }> = {
    Admin: { bg: 'text-red-500 dark:text-red-400', active: 'bg-red-500/10 border-red-500 dark:bg-red-500/20 text-red-600 dark:text-red-400' },
    Leadership: { bg: 'text-purple-500 dark:text-purple-400', active: 'bg-purple-500/10 border-purple-500 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' },
    UnitLeader: { bg: 'text-blue-500 dark:text-blue-400', active: 'bg-blue-500/10 border-blue-500 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' },
    AdminUnit: { bg: 'text-cyan-500 dark:text-cyan-400', active: 'bg-cyan-500/10 border-cyan-500 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400' },
    NVKD: { bg: 'text-emerald-500 dark:text-emerald-400', active: 'bg-emerald-500/10 border-emerald-500 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
    NVKT: { bg: 'text-teal-500 dark:text-teal-400', active: 'bg-teal-500/10 border-teal-500 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400' },
    Accountant: { bg: 'text-amber-500 dark:text-amber-400', active: 'bg-amber-500/10 border-amber-500 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' },
    ChiefAccountant: { bg: 'text-orange-500 dark:text-orange-400', active: 'bg-orange-500/10 border-orange-500 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' },
    Legal: { bg: 'text-indigo-500 dark:text-indigo-400', active: 'bg-indigo-500/10 border-indigo-500 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' },
    Marketing: { bg: 'text-pink-500 dark:text-pink-400', active: 'bg-pink-500/10 border-pink-500 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400' },
};

// ─── Ordered Lists ────────────────────────────────────────
export const ALL_ROLES: UserRole[] = [
    'Admin', 'Leadership', 'UnitLeader', 'AdminUnit',
    'NVKD', 'NVKT', 'Accountant', 'ChiefAccountant',
    'Legal', 'Marketing',
];

export const ACTIONS: PermissionAction[] = ['view', 'create', 'update', 'delete'];

export const RESOURCES: PermissionResource[] = [
    'contracts', 'customers', 'products', 'payments',
    'employees', 'units', 'tasks', 'settings', 'permissions',
    'reports', 'news', 'projects', 'requests', 'leaves', 'recruitment',
    'analytics', 'crm', 'tools',
];

// ─── Global view roles (xem toàn bộ đơn vị) ──────────────
/** Roles được xem dữ liệu toàn công ty (không bị giới hạn đơn vị) */
export const GLOBAL_VIEW_ROLE_LIST: UserRole[] = [
    'Admin', 'Leadership', 'Legal', 'Accountant', 'ChiefAccountant',
];
