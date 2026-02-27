import React, { useState, useEffect } from 'react';
import { Users, UserCheck, X, Search, Shield, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { dataClient as supabase } from '../../lib/dataClient';
import { UserProfile, UserRole, DEFAULT_ROLE_PERMISSIONS, PermissionResource } from '../../types';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { ROLE_LABELS } from '../../constants';

const RESOURCES: PermissionResource[] = ['contracts', 'employees', 'units', 'customers', 'products', 'payments', 'settings', 'permissions'];
const RESOURCE_LABELS: Record<PermissionResource, string> = {
    contracts: 'Hợp đồng',
    employees: 'Nhân sự',
    units: 'Đơn vị',
    customers: 'Khách hàng',
    products: 'Sản phẩm',
    payments: 'Thanh toán',
    settings: 'Cài đặt',
    permissions: 'Phân quyền',
};

// Map position/title to UserRole for permission lookup
function mapPositionToRole(position: string | null): UserRole {
    if (!position) return 'NVKD';
    const pos = position.toLowerCase();
    if (pos.includes('tổng giám đốc')) return 'Leadership';
    if (pos.includes('phó tổng giám đốc')) return 'Leadership';
    if (pos.includes('giám đốc')) return 'UnitLeader';
    if (pos.includes('trưởng phòng') || pos.includes('trưởng tt')) return 'UnitLeader';
    if (pos.includes('kế toán trưởng')) return 'ChiefAccountant';
    if (pos.includes('kế toán')) return 'Accountant';
    if (pos.includes('ban lãnh đạo')) return 'Leadership';
    if (pos.includes('pháp lý') || pos.includes('pháp chế')) return 'Legal';
    if (pos.includes('admin')) return 'Admin';
    return 'NVKD';
}

// Extended user profile with employee info
interface EmployeeUser extends UserProfile {
    position?: string;
    unitName?: string;
}

const UserImpersonator: React.FC = () => {
    const [users, setUsers] = useState<EmployeeUser[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const { impersonatedUser, isImpersonating, startImpersonation, stopImpersonation } = useImpersonation();

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                // First fetch employees without join to avoid FK constraint errors
                const { data: employeesData, error: empError } = await supabase
                    .from('employees')
                    .select('id, email, name, position, unit_id, role_code')
                    .order('name');

                if (empError) {
                    console.error('[UserImpersonator] Error fetching employees:', empError);
                    toast.error('Không thể tải danh sách nhân viên');
                    setLoading(false);
                    return;
                }

                // Then fetch units separately
                const { data: unitsData } = await supabase
                    .from('units')
                    .select('id, name, code');

                const unitsMap = new Map(unitsData?.map(u => [u.id, u.name]) || []);
                const unitsCodeMap = new Map(unitsData?.map(u => [u.id, u.code]) || []);

                if (employeesData) {
                    console.log('[UserImpersonator] Loaded', employeesData.length, 'employees');
                    setUsers(employeesData.map(u => ({
                        id: u.id,
                        email: u.email || '',
                        fullName: u.name,
                        role: (u.role_code as UserRole) || mapPositionToRole(u.position),
                        unitId: u.unit_id,
                        unitCode: u.unit_id ? unitsCodeMap.get(u.unit_id) : undefined,
                        position: u.position,
                        unitName: u.unit_id ? unitsMap.get(u.unit_id) : undefined,
                    })));
                } else {
                    setUsers([]);
                }
            } catch (err) {
                console.error('[UserImpersonator] Unexpected error:', err);
                toast.error('Lỗi không xác định khi tải dữ liệu');
            }
            setLoading(false);
        };
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(user =>
        user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.unitName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectUser = (user: EmployeeUser) => {
        startImpersonation(user);
        setIsDropdownOpen(false);
        setSearchTerm('');
        toast.success(
            <div className="flex items-center gap-2">
                <UserCheck size={18} />
                <div>
                    <p className="font-semibold">Đã chuyển sang: {user.fullName}</p>
                    <p className="text-xs opacity-80">{user.position || 'Nhân viên'}</p>
                </div>
            </div>,
            { duration: 3000 }
        );
    };

    const handleStopImpersonation = () => {
        const previousUser = impersonatedUser?.fullName;
        stopImpersonation();
        toast.info(`Đã quay về tài khoản Admin (thoát khỏi ${previousUser})`, { duration: 2000 });
    };

    // Get permissions for impersonated user
    const permissions = impersonatedUser?.role ? DEFAULT_ROLE_PERMISSIONS[impersonatedUser.role] || {} : null;

    return (
        <div className="space-y-6">
            {/* Active Impersonation Banner */}
            {isImpersonating && impersonatedUser && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-400 rounded-lg p-5 animate-pulse-once">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                                {impersonatedUser.fullName?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                                        <UserCheck size={12} />
                                        ĐANG GIẢ LÀM
                                    </span>
                                </div>
                                <p className="font-bold text-lg text-slate-800 dark:text-slate-200">{impersonatedUser.fullName}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {(impersonatedUser as EmployeeUser).position || ROLE_LABELS[impersonatedUser.role] || impersonatedUser.role}
                                    {(impersonatedUser as EmployeeUser).unitName && ` • ${(impersonatedUser as EmployeeUser).unitName}`}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleStopImpersonation}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-all shadow-md hover:shadow-lg"
                        >
                            <X size={18} />
                            Dừng giả làm
                        </button>
                    </div>

                    {/* Permissions Preview */}
                    {permissions && (
                        <div className="mt-5 pt-4 border-t border-amber-200 dark:border-amber-700">
                            <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1">
                                <Shield size={14} />
                                QUYỀN CỦA NGƯỜI NÀY:
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {RESOURCES.map(resource => {
                                    const actions = permissions[resource] || [];
                                    return (
                                        <div key={resource} className={`rounded-lg p-2 text-xs ${actions.length > 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-900 opacity-50'}`}>
                                            <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                                                {RESOURCE_LABELS[resource]}
                                            </span>
                                            <span className="text-slate-500">
                                                {actions.length > 0 ? actions.map(a => a.charAt(0).toUpperCase()).join(' ') : '—'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* User Selection Dropdown */}
            <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Chọn nhân viên để giả làm
                </label>

                <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    disabled={loading}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-indigo-400 transition-all"
                >
                    <span className={loading ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}>
                        {loading ? 'Đang tải danh sách...' : `${users.length} nhân viên có sẵn`}
                    </span>
                    <ChevronDown size={20} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Content */}
                {isDropdownOpen && !loading && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl overflow-hidden">
                        {/* Search inside dropdown */}
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Tìm theo tên, chức vụ, đơn vị..."
                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* User List */}
                        <div className="max-h-80 overflow-y-auto">
                            {filteredUsers.length === 0 ? (
                                <div className="p-4 text-center text-slate-400">Không tìm thấy nhân viên</div>
                            ) : (
                                filteredUsers.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => handleSelectUser(user)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-left border-b border-slate-50 dark:border-slate-800 last:border-b-0"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                                            {user.fullName?.charAt(0) || 'U'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{user.fullName}</p>
                                            <p className="text-xs text-slate-500 truncate">
                                                {user.position || ROLE_LABELS[user.role]}
                                                {user.unitName && ` • ${user.unitName}`}
                                            </p>
                                        </div>
                                        {impersonatedUser?.id === user.id && (
                                            <Check size={18} className="text-green-500 flex-shrink-0" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Close dropdown when clicking outside */}
            {isDropdownOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                />
            )}

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm">
                <p className="font-semibold text-blue-700 dark:text-blue-400 mb-2">💡 Hướng dẫn:</p>
                <ol className="text-blue-600 dark:text-blue-300 space-y-1 text-xs list-decimal list-inside">
                    <li>Click vào dropdown để mở danh sách nhân viên</li>
                    <li>Tìm kiếm theo tên, chức vụ hoặc đơn vị</li>
                    <li>Click chọn nhân viên → Hệ thống sẽ thông báo xác nhận</li>
                    <li>Điều hướng qua các trang để xem quyền của họ</li>
                    <li>Click "Dừng giả làm" để quay về Admin</li>
                </ol>
            </div>
        </div>
    );
};

export default UserImpersonator;
