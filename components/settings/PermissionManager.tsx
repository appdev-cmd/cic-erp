import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Shield, Users, Check, X, Loader2, Search, Eye, EyeOff, Building2,
    ChevronDown, RefreshCw, AlertTriangle, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import {
    PermissionAction, PermissionResource, UserProfile, UserRole,
    DEFAULT_ROLE_PERMISSIONS
} from '../../types';
import {
    useAllPermissions, useUpdatePermission, useInitializePermissions,
    useEmployeeVisibility, useToggleVisibility
} from '../../hooks';
import { dataClient } from '../../lib/dataClient';
import { AuditLogService } from '../../services/auditLogService';
import { useAuth } from '../../contexts/AuthContext';

// ─── Constants ─────────────────────────────────────────
const RESOURCE_LABELS: Record<PermissionResource, string> = {
    contracts: 'Hợp đồng',
    customers: 'Khách hàng',
    products: 'Sản phẩm / DV',
    tasks: 'Công việc',
    payments: 'Tài chính',
    employees: 'Nhân sự',
    units: 'Đơn vị',
    settings: 'Cài đặt',
    permissions: 'Phân quyền',
    reports: 'Báo cáo',
};

const ACTION_LABELS: Record<PermissionAction, string> = {
    view: 'Xem',
    create: 'Thêm',
    update: 'Sửa',
    delete: 'Xóa',
};

const ROLE_LABELS: Record<UserRole, string> = {
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

const ROLE_COLORS: Record<UserRole, string> = {
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

const ALL_ROLES: UserRole[] = ['Admin', 'Leadership', 'UnitLeader', 'AdminUnit', 'NVKD', 'NVKT', 'Accountant', 'ChiefAccountant', 'Legal', 'Marketing'];
const ACTIONS: PermissionAction[] = ['view', 'create', 'update', 'delete'];
const RESOURCES: PermissionResource[] = ['contracts', 'customers', 'products', 'tasks', 'payments', 'employees', 'units', 'settings', 'permissions', 'reports'];

// Global view roles
const GLOBAL_ROLES: UserRole[] = ['Admin', 'Leadership', 'Legal', 'Accountant', 'ChiefAccountant'];

// ─── Types ─────────────────────────────────────────────
interface EmployeeUser extends UserProfile {
    position?: string;
    unitName?: string;
}

// ─── Component ─────────────────────────────────────────
const PermissionManager: React.FC = () => {
    const { profile: adminProfile } = useAuth();
    // audit_logs.user_id is UUID — dev IDs like "dev-admin-000" are invalid
    const isValidUUID = (s?: string | null) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    const safeAdminId = isValidUUID(adminProfile?.id) ? adminProfile!.id : null;
    const [users, setUsers] = useState<EmployeeUser[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [userPermissions, setUserPermissions] = useState<Record<PermissionResource, PermissionAction[]>>({} as any);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [unitFilter, setUnitFilter] = useState<string>('all');
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [pendingRole, setPendingRole] = useState<UserRole | null>(null);

    const { data: allPermissions, isLoading: permLoading } = useAllPermissions();
    const updatePermission = useUpdatePermission();
    const initializePermissions = useInitializePermissions();

    // Cross-unit visibility
    const [allUnits, setAllUnits] = useState<{ id: string; name: string }[]>([]);
    const { data: grantedUnits, isLoading: visLoading } = useEmployeeVisibility(selectedUserId);
    const toggleVisibility = useToggleVisibility();

    // ─── Fetch users ────────────────────────────────────
    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const { data: employeesData, error: empError } = await dataClient
                    .from('employees')
                    .select('id, email, name, position, unit_id, role_code')
                    .order('name');

                if (empError) {
                    toast.error('Không thể tải danh sách nhân viên');
                    setLoading(false);
                    return;
                }

                const { data: unitsData } = await dataClient
                    .from('units')
                    .select('id, name')
                    .order('name');

                const unitsMap = new Map(unitsData?.map(u => [u.id, u.name]) || []);
                if (unitsData) setAllUnits(unitsData);

                if (employeesData) {
                    setUsers(employeesData.map(u => ({
                        id: u.id,
                        email: u.email || '',
                        fullName: u.name,
                        role: (u.role_code as UserRole) || 'NVKD',
                        unitId: u.unit_id,
                        position: u.position,
                        unitName: u.unit_id ? unitsMap.get(u.unit_id) : undefined,
                    })));
                }
            } catch {
                toast.error('Lỗi không xác định khi tải dữ liệu');
            }
            setLoading(false);
        };
        fetchUsers();
    }, []);

    // ─── Update permissions when user selected ──────────
    useEffect(() => {
        if (!selectedUserId || !allPermissions) {
            setUserPermissions({} as any);
            return;
        }

        const userPerms = allPermissions.filter(p => p.userId === selectedUserId);
        const permMap: Record<PermissionResource, PermissionAction[]> = {} as any;

        RESOURCES.forEach(resource => {
            const found = userPerms.find(p => p.resource === resource);
            permMap[resource] = found ? found.actions : [];
        });

        setUserPermissions(permMap);
    }, [selectedUserId, allPermissions]);

    const selectedUser = users.find(u => u.id === selectedUserId);

    // ─── Filter users ───────────────────────────────────
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const matchSearch = !searchTerm ||
                user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.unitName?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchRole = roleFilter === 'all' || user.role === roleFilter;
            const matchUnit = unitFilter === 'all' || user.unitId === unitFilter;
            return matchSearch && matchRole && matchUnit;
        });
    }, [users, searchTerm, roleFilter, unitFilter]);

    // ─── Self-protection ────────────────────────────────
    const isSelf = selectedUserId === adminProfile?.employeeId || selectedUserId === adminProfile?.id;

    // ─── Toggle permission ──────────────────────────────
    const handleToggle = useCallback(async (resource: PermissionResource, action: PermissionAction) => {
        if (!selectedUserId || !selectedUser) return;

        // Prevent admin from removing their own admin role or permissions/settings access
        if (isSelf && (resource === 'permissions' || resource === 'settings') && action === 'view') {
            toast.error('Không thể tắt quyền này cho chính mình');
            return;
        }

        const currentActions = userPermissions[resource] || [];
        const newActions = currentActions.includes(action)
            ? currentActions.filter(a => a !== action)
            : [...currentActions, action];

        // Optimistic update
        setUserPermissions(prev => ({ ...prev, [resource]: newActions }));

        try {
            await updatePermission.mutateAsync({
                userId: selectedUserId,
                resource,
                actions: newActions,
            });

            // Audit log
            await AuditLogService.create({
                user_id: safeAdminId,
                table_name: 'user_permissions',
                record_id: selectedUserId,
                action: 'UPDATE',
                old_data: { resource, actions: currentActions },
                new_data: { resource, actions: newActions },
                comment: `${currentActions.includes(action) ? 'Tắt' : 'Bật'} quyền ${ACTION_LABELS[action]} ${RESOURCE_LABELS[resource]} cho ${selectedUser.fullName}`,
            });

            toast.success(`Đã ${currentActions.includes(action) ? 'tắt' : 'bật'} quyền ${ACTION_LABELS[action]} ${RESOURCE_LABELS[resource]}`);
        } catch {
            setUserPermissions(prev => ({ ...prev, [resource]: currentActions }));
            toast.error('Lỗi khi cập nhật quyền');
        }
    }, [selectedUserId, selectedUser, userPermissions, isSelf, adminProfile, updatePermission]);

    // ─── Change role ────────────────────────────────────
    const handleRoleChange = useCallback(async (newRole: UserRole) => {
        if (!selectedUserId || !selectedUser) return;

        // Prevent admin from demoting themselves
        if (isSelf && newRole !== 'Admin') {
            toast.error('Không thể thay đổi role của chính mình');
            return;
        }

        const oldRole = selectedUser.role;

        try {
            // Update role in employees table
            const { error } = await dataClient
                .from('employees')
                .update({ role_code: newRole })
                .eq('id', selectedUserId);

            if (error) throw error;

            // Also update profiles table if exists
            await dataClient
                .from('profiles')
                .update({ role: newRole })
                .eq('id', selectedUserId);

            // Reset permissions to new role defaults
            await initializePermissions.mutateAsync({ userId: selectedUserId, role: newRole });

            // Update local state
            setUsers(prev => prev.map(u =>
                u.id === selectedUserId ? { ...u, role: newRole } : u
            ));

            // Audit log
            await AuditLogService.create({
                user_id: safeAdminId,
                table_name: 'employees',
                record_id: selectedUserId,
                action: 'UPDATE',
                old_data: { role: oldRole },
                new_data: { role: newRole },
                comment: `Thay đổi role ${selectedUser.fullName}: ${ROLE_LABELS[oldRole]} → ${ROLE_LABELS[newRole]}. Permissions đã reset về mặc định.`,
            });

            toast.success(`Đã chuyển ${selectedUser.fullName} sang role ${ROLE_LABELS[newRole]}. Permissions đã reset.`);
        } catch (err) {
            console.error('Error updating role:', err);
            toast.error('Không thể cập nhật role');
        }

        setShowResetConfirm(false);
        setPendingRole(null);
    }, [selectedUserId, selectedUser, isSelf, adminProfile, initializePermissions]);

    // ─── Render ─────────────────────────────────────────
    if (loading || permLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-indigo-500" size={24} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ─── Filters ─── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Search */}
                <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Tìm kiếm</label>
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Tên, email..."
                            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 dark:border-slate-600 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                    </div>
                </div>
                {/* Role filter */}
                <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Vai trò</label>
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 dark:border-slate-600 focus:ring-2 focus:ring-orange-500"
                    >
                        <option value="all">Tất cả vai trò</option>
                        {ALL_ROLES.map(role => (
                            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                        ))}
                    </select>
                </div>
                {/* Unit filter */}
                <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Đơn vị</label>
                    <select
                        value={unitFilter}
                        onChange={e => setUnitFilter(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 dark:border-slate-600 focus:ring-2 focus:ring-orange-500"
                    >
                        <option value="all">Tất cả đơn vị</option>
                        {allUnits.map(unit => (
                            <option key={unit.id} value={unit.id}>{unit.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ─── User List ─── */}
            <div className="border border-slate-200 rounded-xl dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 max-h-[300px] overflow-y-auto bg-white dark:bg-slate-900">
                {filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <Users size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Không tìm thấy nhân viên nào</p>
                    </div>
                ) : (
                    filteredUsers.map(user => (
                        <button
                            key={user.id}
                            onClick={() => setSelectedUserId(user.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedUserId === user.id
                                ? 'bg-orange-50 dark:bg-orange-950/30 border-l-[3px] border-l-orange-500'
                                : ''
                                }`}
                        >
                            {/* Avatar */}
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${selectedUserId === user.id ? 'bg-orange-500' : 'bg-slate-400 dark:bg-slate-600'}`}>
                                {user.fullName?.charAt(0) || '?'}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                                    {user.fullName}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {user.unitName || user.email}
                                </p>
                            </div>
                            {/* Role badge */}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${ROLE_COLORS[user.role] || 'bg-slate-100 text-slate-600'}`}>
                                {ROLE_LABELS[user.role] || user.role}
                            </span>
                        </button>
                    ))
                )}
            </div>

            {/* ─── Selected User Panel ─── */}
            {selectedUser && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                    {/* User header */}
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-lg">
                            {selectedUser.fullName?.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{selectedUser.fullName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {selectedUser.position || 'Nhân viên'} • {selectedUser.unitName || selectedUser.email}
                            </p>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${ROLE_COLORS[selectedUser.role]}`}>
                            {ROLE_LABELS[selectedUser.role]}
                        </span>
                    </div>

                    {/* Role selector */}
                    <div className="flex items-center gap-3 py-3 px-4 bg-slate-100/70 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 mb-5">
                        <Shield size={16} className="text-orange-500 flex-shrink-0" />
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            Vai trò:
                        </label>
                        <select
                            value={selectedUser.role || ''}
                            onChange={(e) => {
                                const newRole = e.target.value as UserRole;
                                if (newRole === selectedUser.role) return;
                                setPendingRole(newRole);
                                setShowResetConfirm(true);
                            }}
                            disabled={isSelf}
                            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white dark:bg-slate-700 dark:border-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {ALL_ROLES.map(role => (
                                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                            ))}
                        </select>
                        {isSelf && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">
                                (Bạn)
                            </span>
                        )}
                    </div>

                    {/* ─── Permission Matrix ─── */}
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                                    <th className="text-left py-3 px-4 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                                        Module
                                    </th>
                                    {ACTIONS.map(action => (
                                        <th key={action} className="text-center py-3 px-3 font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                                            {ACTION_LABELS[action]}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {RESOURCES.map((resource, idx) => (
                                    <tr key={resource} className={`border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors duration-150 ${idx % 2 === 0 ? 'bg-transparent dark:bg-transparent' : 'bg-slate-50/50 dark:bg-slate-800'} hover:bg-orange-50/30 dark:hover:bg-slate-700`}>
                                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                                            {RESOURCE_LABELS[resource]}
                                        </td>
                                        {ACTIONS.map(action => {
                                            const hasAction = userPermissions[resource]?.includes(action);
                                            const isProtected = isSelf && (resource === 'permissions' || resource === 'settings') && action === 'view';
                                            return (
                                                <td key={action} className="text-center py-3 px-3">
                                                    <button
                                                        onClick={() => handleToggle(resource, action)}
                                                        disabled={updatePermission.isPending || isProtected}
                                                        title={isProtected ? 'Không thể tắt quyền này cho chính mình' : `${hasAction ? 'Tắt' : 'Bật'} ${ACTION_LABELS[action]} ${RESOURCE_LABELS[resource]}`}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${hasAction
                                                            ? 'bg-emerald-500/20 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/30 dark:hover:bg-emerald-500/30'
                                                            : 'bg-slate-200/60 text-slate-400 dark:bg-slate-700/60 dark:text-slate-500 hover:bg-slate-300/60 dark:hover:bg-slate-600/60'
                                                            } ${isProtected ? 'opacity-40 cursor-not-allowed' : 'hover:scale-110 cursor-pointer'}`}
                                                    >
                                                        {hasAction ? <Check size={15} strokeWidth={2.5} /> : <X size={15} />}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ─── Cross-Unit Visibility ─── */}
                    <div className="mt-5 p-4 bg-slate-100/50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-1">
                            <Building2 size={16} className="text-orange-500" />
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                Quyền xem đơn vị khác
                            </h4>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 ml-6">
                            Cho phép xem hợp đồng, sản lượng của đơn vị khác.
                        </p>

                        {selectedUser.role && GLOBAL_ROLES.includes(selectedUser.role) ? (
                            <div className="flex items-center gap-2 py-2 px-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <Eye size={14} className="text-emerald-600 dark:text-emerald-400" />
                                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                    Role <strong>{ROLE_LABELS[selectedUser.role]}</strong> luôn xem được tất cả đơn vị
                                </span>
                            </div>
                        ) : (
                            <div>
                                {visLoading ? (
                                    <div className="flex items-center gap-2 py-4 justify-center text-slate-400">
                                        <Loader2 size={14} className="animate-spin" />
                                        <span className="text-xs">Đang tải...</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {allUnits.filter(u => u.id !== selectedUser.unitId).map(unit => {
                                            const isGranted = grantedUnits?.includes(unit.id) || false;
                                            return (
                                                <button
                                                    key={unit.id}
                                                    onClick={async () => {
                                                        try {
                                                            await toggleVisibility.mutateAsync({
                                                                employeeId: selectedUserId,
                                                                unitId: unit.id,
                                                                enabled: !isGranted,
                                                            });

                                                            // Audit log
                                                            await AuditLogService.create({
                                                                user_id: safeAdminId,
                                                                table_name: 'cross_unit_visibility',
                                                                record_id: selectedUserId,
                                                                action: isGranted ? 'DELETE' : 'INSERT',
                                                                old_data: isGranted ? { unit_id: unit.id, unit_name: unit.name } : null,
                                                                new_data: !isGranted ? { unit_id: unit.id, unit_name: unit.name } : null,
                                                                comment: `${isGranted ? 'Thu hồi' : 'Cấp'} quyền xem ${unit.name} cho ${selectedUser.fullName}`,
                                                            });

                                                            toast.success(isGranted
                                                                ? `Đã thu hồi quyền xem ${unit.name}`
                                                                : `Đã cấp quyền xem ${unit.name}`);
                                                        } catch {
                                                            toast.error('Lỗi khi cập nhật quyền xem đơn vị');
                                                        }
                                                    }}
                                                    disabled={toggleVisibility.isPending}
                                                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 text-left cursor-pointer ${isGranted
                                                        ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50'
                                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-700'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Building2 size={13} className={isGranted ? 'text-orange-500' : 'text-slate-400'} />
                                                        <span className={`text-xs font-medium truncate ${isGranted ? 'text-orange-700 dark:text-orange-300' : 'text-slate-600 dark:text-slate-300'}`}>
                                                            {unit.name}
                                                        </span>
                                                    </div>
                                                    <div className={`flex-shrink-0 w-8 h-4 rounded-full relative transition-colors ${isGranted ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                                        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${isGranted ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── Empty state ─── */}
            {!selectedUserId && users.length > 0 && (
                <div className="text-center py-12 text-slate-400">
                    <Users size={48} className="mx-auto mb-4 opacity-40" />
                    <p className="font-medium text-slate-600 dark:text-slate-300">Chọn một nhân viên để phân quyền</p>
                    <p className="text-sm mt-1 text-slate-400 dark:text-slate-500">Click vào tên nhân viên trong danh sách bên trên</p>
                </div>
            )}

            {/* ─── Confirm Role Change Dialog ─── */}
            {showResetConfirm && pendingRole && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl dark:shadow-black/40 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">Thay đổi vai trò</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Xác nhận thay đổi role</p>
                            </div>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200 dark:border-amber-800 mb-5">
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                                Bạn đang thay đổi role của <strong>{selectedUser.fullName}</strong> từ{' '}
                                <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[selectedUser.role]}`}>
                                    {ROLE_LABELS[selectedUser.role]}
                                </span>
                                {' '}sang{' '}
                                <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[pendingRole]}`}>
                                    {ROLE_LABELS[pendingRole]}
                                </span>
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 font-semibold flex items-center gap-1">
                                <RefreshCw size={12} />
                                Tất cả quyền sẽ được reset về mặc định của role mới!
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowResetConfirm(false);
                                    setPendingRole(null);
                                }}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => pendingRole && handleRoleChange(pendingRole)}
                                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
                            >
                                Xác nhận & Reset
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PermissionManager;
