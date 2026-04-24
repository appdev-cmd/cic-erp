import React, { useState, useMemo, useCallback } from 'react';
import {
    Shield, Check, X, Loader2, Users, Save, RefreshCw,
    AlertTriangle, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import {
    PermissionAction, PermissionResource, UserRole,
    DEFAULT_ROLE_PERMISSIONS
} from '../../types';
import { PermissionService } from '../../services';
import { dataClient } from '../../lib/dataClient';
import { AuditLogService } from '../../services/auditLogService';
import { useAuth } from '../../contexts/AuthContext';
import {
    RESOURCE_LABELS, ACTION_LABELS, ROLE_LABELS, ROLE_TAB_COLORS as ROLE_COLORS,
    ALL_ROLES, ACTIONS, RESOURCES,
} from '../../lib/permissionConstants';


// ─── Component ─────────────────────────────────────────
const RoleDefaultsManager: React.FC = () => {
    const { profile: adminProfile } = useAuth();
    const isValidUUID = (s?: string | null) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    const safeAdminId = isValidUUID(adminProfile?.id) ? adminProfile!.id : null;

    const [selectedRole, setSelectedRole] = useState<UserRole>('NVKD');
    const [rolePerms, setRolePerms] = useState<Record<UserRole, Record<PermissionResource, PermissionAction[]>>>(() => {
        // Initialize from hardcode defaults (overwritten by DB on mount)
        const initial: any = {};
        ALL_ROLES.forEach(role => {
            initial[role] = {} as any;
            RESOURCES.forEach(resource => {
                initial[role][resource] = [...(DEFAULT_ROLE_PERMISSIONS[role]?.[resource] || [])];
            });
        });
        return initial;
    });
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [showApplyConfirm, setShowApplyConfirm] = useState(false);

    // ─── Load from DB on mount ───────────────────────────
    // Ưu tiên DB (persistent), fallback về DEFAULT_ROLE_PERMISSIONS (hardcode)
    React.useEffect(() => {
        const loadFromDB = async () => {
            try {
                const { data, error } = await dataClient
                    .from('role_permission_defaults')
                    .select('role, resource, actions');

                if (error) throw error;

                if (data && data.length > 0) {
                    setRolePerms(prev => {
                        const merged = { ...prev };
                        data.forEach(row => {
                            const role = row.role as UserRole;
                            const resource = row.resource as PermissionResource;
                            if (merged[role]) {
                                merged[role] = { ...merged[role], [resource]: row.actions || [] };
                            }
                        });
                        return merged;
                    });
                }
            } catch (err) {
                console.warn('role_permission_defaults: fallback to hardcode', err);
            } finally {
                setLoading(false);
            }
        };
        loadFromDB();
    }, []);


    const currentPerms = rolePerms[selectedRole];

    // ─── Toggle a permission ────────────────────────────
    const handleToggle = useCallback((resource: PermissionResource, action: PermissionAction) => {
        setRolePerms(prev => {
            const current = prev[selectedRole][resource] || [];
            const newActions = current.includes(action)
                ? current.filter(a => a !== action)
                : [...current, action];
            return {
                ...prev,
                [selectedRole]: {
                    ...prev[selectedRole],
                    [resource]: newActions,
                }
            };
        });
        setHasChanges(true);
    }, [selectedRole]);

    // ─── Toggle all actions for a resource ──────────────
    const handleToggleRow = useCallback((resource: PermissionResource) => {
        setRolePerms(prev => {
            const current = prev[selectedRole][resource] || [];
            const allEnabled = ACTIONS.every(a => current.includes(a));
            return {
                ...prev,
                [selectedRole]: {
                    ...prev[selectedRole],
                    [resource]: allEnabled ? [] : [...ACTIONS],
                }
            };
        });
        setHasChanges(true);
    }, [selectedRole]);

    // ─── Toggle all resources for an action ─────────────
    const handleToggleColumn = useCallback((action: PermissionAction) => {
        setRolePerms(prev => {
            const allEnabled = RESOURCES.every(r => (prev[selectedRole][r] || []).includes(action));
            const updated = { ...prev[selectedRole] };
            RESOURCES.forEach(resource => {
                const current = updated[resource] || [];
                if (allEnabled) {
                    updated[resource] = current.filter(a => a !== action);
                } else if (!current.includes(action)) {
                    updated[resource] = [...current, action];
                }
            });
            return { ...prev, [selectedRole]: updated };
        });
        setHasChanges(true);
    }, [selectedRole]);

    // ─── Save to DB (persistent) + update in-memory fallback ────────
    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            // Chuẩn bị upsert rows cho tất cả roles
            const rows = ALL_ROLES.flatMap(role =>
                RESOURCES.map(resource => ({
                    role,
                    resource,
                    actions: rolePerms[role][resource] || [],
                    updated_at: new Date().toISOString(),
                }))
            );

            const { error } = await dataClient
                .from('role_permission_defaults')
                .upsert(rows, { onConflict: 'role,resource' });

            if (error) throw error;

            // Cũng cập nhật in-memory để consistent ngay lập tức
            ALL_ROLES.forEach(role => {
                (DEFAULT_ROLE_PERMISSIONS as any)[role] = { ...rolePerms[role] };
            });

            setHasChanges(false);
            toast.success('Đã lưu quyền mặc định theo role vào cơ sở dữ liệu');
        } catch (err) {
            console.error('Error saving role defaults:', err);
            toast.error('Lỗi khi lưu — kiểm tra quyền Admin hoặc kết nối DB');
        } finally {
            setSaving(false);
        }
    }, [rolePerms]);


    // ─── Apply defaults to all users with this role ─────
    const handleApplyToAll = useCallback(async () => {
        setApplying(true);
        try {
            // Get all employees with this role
            const { data: employees, error: empError } = await dataClient
                .from('employees')
                .select('id, name')
                .eq('role_code', selectedRole);

            if (empError) throw empError;

            if (!employees || employees.length === 0) {
                toast.info(`Không có nhân viên nào với role ${ROLE_LABELS[selectedRole]}`);
                setApplying(false);
                setShowApplyConfirm(false);
                return;
            }

            // Initialize permissions for each employee
            let successCount = 0;
            for (const emp of employees) {
                try {
                    await PermissionService.initializeForUser(emp.id, selectedRole);

                    // Audit log
                    await AuditLogService.create({
                        user_id: safeAdminId,
                        table_name: 'employees',
                        record_id: emp.id,
                        action: 'UPDATE',
                        old_data: { role: selectedRole },
                        new_data: { role: selectedRole },
                        comment: `Thay đổi role ${emp.name || 'Nhân viên'}: ${ROLE_LABELS[selectedRole]} → ${ROLE_LABELS[selectedRole]}. Permissions đã reset về mặc định.`,
                    });

                    successCount++;
                } catch (err) {
                    console.error(`Failed to init perms for ${emp.id}:`, err);
                }
            }

            toast.success(`Đã áp dụng quyền mặc định cho ${successCount}/${employees.length} nhân viên role ${ROLE_LABELS[selectedRole]}`);
        } catch (err) {
            console.error('Error applying defaults:', err);
            toast.error('Lỗi khi áp dụng quyền mặc định');
        }
        setApplying(false);
        setShowApplyConfirm(false);
    }, [selectedRole, rolePerms]);

    // ─── Count permissions per role ─────────────────────
    const permCount = useMemo(() => {
        const counts: Record<UserRole, number> = {} as any;
        ALL_ROLES.forEach(role => {
            counts[role] = RESOURCES.reduce((sum, r) => sum + (rolePerms[role][r]?.length || 0), 0);
        });
        return counts;
    }, [rolePerms]);

    return (
        <div className="space-y-5">
            {/* ─── Role Tabs ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ALL_ROLES.map(role => {
                    const isActive = selectedRole === role;
                    const colors = ROLE_COLORS[role];
                    return (
                        <button
                            key={role}
                            onClick={() => setSelectedRole(role)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all ${isActive
                                ? `${colors.active} border-current font-bold`
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                                }`}
                        >
                            <Shield size={14} className={isActive ? '' : colors.bg} />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold truncate">{ROLE_LABELS[role]}</p>
                                <p className="text-[10px] opacity-60">{permCount[role]} quyền</p>
                            </div>
                            {isActive && <ChevronRight size={14} className="flex-shrink-0 opacity-60" />}
                        </button>
                    );
                })}
            </div>

            {/* ─── Selected Role Header ─── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        Quyền mặc định: <span className={ROLE_COLORS[selectedRole].bg}>{ROLE_LABELS[selectedRole]}</span>
                    </h4>
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg transition-colors"
                        >
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            {saving ? 'Đang lưu...' : 'Lưu vào DB'}
                        </button>
                    )}

                    <button
                        onClick={() => setShowApplyConfirm(true)}
                        disabled={applying}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        <RefreshCw size={13} />
                        Áp dụng cho tất cả
                    </button>
                </div>
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
                                <th key={action} className="text-center py-3 px-3">
                                    <button
                                        onClick={() => handleToggleColumn(action)}
                                        className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 transition-colors cursor-pointer"
                                        title={`Toggle tất cả ${ACTION_LABELS[action]}`}
                                    >
                                        {ACTION_LABELS[action]}
                                    </button>
                                </th>
                            ))}
                            <th className="text-center py-3 px-2 w-10">
                                <span className="text-[10px] text-slate-400 uppercase">All</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {RESOURCES.map((resource, idx) => {
                            const actions = currentPerms[resource] || [];
                            const allEnabled = ACTIONS.every(a => actions.includes(a));
                            return (
                                <tr
                                    key={resource}
                                    className={`border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors duration-150 ${idx % 2 === 0
                                        ? 'bg-transparent dark:bg-transparent'
                                        : 'bg-slate-50/50 dark:bg-slate-800'
                                        } hover:bg-orange-50/30 dark:hover:bg-slate-700`}
                                >
                                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                                        {RESOURCE_LABELS[resource]}
                                    </td>
                                    {ACTIONS.map(action => {
                                        const hasAction = actions.includes(action);
                                        return (
                                            <td key={action} className="text-center py-3 px-3">
                                                <button
                                                    onClick={() => handleToggle(resource, action)}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 cursor-pointer ${hasAction
                                                        ? 'bg-emerald-500/20 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/30'
                                                        : 'bg-slate-200/60 text-slate-400 dark:bg-slate-800 dark:text-slate-500 hover:bg-slate-300/60 dark:hover:bg-slate-700'
                                                        }`}
                                                >
                                                    {hasAction ? <Check size={15} strokeWidth={2.5} /> : <X size={15} />}
                                                </button>
                                            </td>
                                        );
                                    })}
                                    <td className="text-center py-3 px-2">
                                        <button
                                            onClick={() => handleToggleRow(resource)}
                                            className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer ${allEnabled
                                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                                                } hover:scale-110`}
                                            title={allEnabled ? 'Bỏ tất cả' : 'Chọn tất cả'}
                                        >
                                            {allEnabled ? '✓' : '—'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ─── Summary ─── */}
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>
                    <strong className="text-slate-700 dark:text-slate-300">{permCount[selectedRole]}</strong> / {RESOURCES.length * ACTIONS.length} quyền đang bật
                </span>
                {hasChanges && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Chưa lưu
                    </span>
                )}
            </div>

            {/* ─── Apply Confirm Dialog ─── */}
            {showApplyConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl dark:shadow-black/40 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-slate-200">Áp dụng quyền mặc định</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Thao tác không thể hoàn tác</p>
                            </div>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200 dark:border-amber-800 mb-5">
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                                Tất cả nhân viên có role{' '}
                                <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[selectedRole].active}`}>
                                    {ROLE_LABELS[selectedRole]}
                                </span>
                                {' '}sẽ được <strong>reset quyền về mặc định</strong>.
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 font-semibold">
                                Mọi quyền tùy chỉnh riêng của các nhân viên này sẽ bị ghi đè!
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowApplyConfirm(false)}
                                className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleApplyToAll}
                                disabled={applying}
                                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                                {applying ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Đang xử lý...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={14} />
                                        Xác nhận
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoleDefaultsManager;
