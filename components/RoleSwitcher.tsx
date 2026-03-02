import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { UserRole } from '../types';
import { toast } from 'sonner';
import { Shield, RefreshCw } from 'lucide-react';

const ROLES: { value: UserRole; label: string }[] = [
    { value: 'Leadership', label: 'Lãnh đạo' },
    { value: 'NVKD', label: 'NVKD' },
    { value: 'NVKT', label: 'NV Kỹ thuật' },
    { value: 'UnitLeader', label: 'Lãnh đạo Đơn vị' },
    { value: 'AdminUnit', label: 'Admin Đơn vị' },
    { value: 'Accountant', label: 'Kế toán' },
    { value: 'ChiefAccountant', label: 'Kế toán trưởng' },
    { value: 'Legal', label: 'Pháp chế' },
];

export const RoleSwitcher: React.FC = () => {
    const { user, profile, refreshProfile } = useAuth();
    const [isUpdating, setIsUpdating] = useState(false);
    const [units, setUnits] = useState<any[]>([]);

    // Only show for Admin or Leadership roles
    if (!profile || (profile.role !== 'Admin' && profile.role !== 'Leadership')) return null;

    return null; // FORCE HIDE FOR DEV MODE - remove this line to enable

    // Fetch units on mount
    React.useEffect(() => {
        const fetchUnits = async () => {
            const { data } = await supabase.from('units').select('id, name');
            if (data) setUnits(data);
        };
        fetchUnits();
    }, []);

    const handleRoleChange = async (newRole: UserRole, newUnitId?: string) => {
        if (!user || isUpdating) return;
        setIsUpdating(true);
        try {
            const updatePayload: any = { role: newRole };
            if (newUnitId !== undefined) {
                updatePayload.unit_id = newUnitId;
            }

            const { error } = await supabase
                .from('profiles')
                .update(updatePayload)
                .eq('id', user.id);

            if (error) throw error;

            toast.success(`Đã chuyển vai trò: ${newRole}${newUnitId ? ` - Unit: ${units.find(u => u.id === newUnitId)?.name}` : ''}`);
            await refreshProfile();
            window.location.reload();

        } catch (error: any) {
            toast.error("Lỗi: " + error.message);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="fixed top-20 right-4 z-[100] bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 flex flex-col gap-2 text-xs opacity-75 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2">
                <Shield size={14} className="text-amber-400" />
                <span className="font-bold text-slate-300 uppercase">Test Mode</span>
            </div>

            <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400">Vai trò:</label>
                <select
                    value={profile?.role}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1 outline-none focus:border-indigo-500 w-full"
                    disabled={isUpdating}
                >
                    {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                            {r.label}
                        </option>
                    ))}
                </select>
            </div>

            {['NVKD', 'NVKT', 'UnitLeader', 'AdminUnit'].includes(profile?.role || '') && (
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400">Đơn vị:</label>
                    <select
                        value={profile?.unitId || ''}
                        onChange={(e) => handleRoleChange(profile!.role, e.target.value)}
                        className="bg-slate-800 border border-slate-600 rounded px-2 py-1 outline-none focus:border-indigo-500 w-full"
                        disabled={isUpdating}
                    >
                        <option value="">-- Chọn Đơn vị --</option>
                        {units.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}


            {isUpdating && <div className="text-center text-[10px] text-indigo-400 animate-pulse">Đang cập nhật...</div>}
        </div>
    );
};
