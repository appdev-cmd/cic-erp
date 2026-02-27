import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Search, User, Building, ChevronDown, Loader2, Plus, Pencil, Trash2, MoreVertical, Phone, Mail, Calendar, GraduationCap, MapPin, CreditCard, Eye, Upload, Download } from 'lucide-react';
import { EmployeeService, UnitService } from '../services';
import { Employee, Unit } from '../types';
import PersonnelForm from './PersonnelForm';
import EmployeeDetailModal from './EmployeeDetailModal';
import ImportEmployeeModal from './ImportEmployeeModal';
import { useCurrentUserVisibleUnits } from '../hooks';
import { useAuth } from '../contexts/AuthContext';
import { canCreateEmployee, canEditEmployee, canDeleteEmployee } from '../lib/permissions';
import { useImpersonation } from '../contexts/ImpersonationContext';

interface PersonnelListProps {
    selectedUnit: Unit;
    onSelectPersonnel: (id: string) => void;
}

const PersonnelList: React.FC<PersonnelListProps> = ({ selectedUnit, onSelectPersonnel }) => {
    const { profile: realProfile } = useAuth();
    const { impersonatedUser, isImpersonating } = useImpersonation();
    const profile = isImpersonating && impersonatedUser ? impersonatedUser : realProfile;
    const { visibleUnits, isLoading: loadingVisibility } = useCurrentUserVisibleUnits();

    const [searchQuery, setSearchQuery] = useState('');
    const [unitFilter, setUnitFilter] = useState<string>('all');
    const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);

    // Data state
    const [allPersonnel, setAllPersonnel] = useState<Employee[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 12;

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Employee | undefined>(undefined);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);

    // Detail modal state
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Import modal state
    const [isImportOpen, setIsImportOpen] = useState(false);

    // Fetch data
    useEffect(() => {
        console.log('[PersonnelList] Fetch effect triggered');

        // Safety timeout
        const timeoutId = setTimeout(() => {
            console.warn('[PersonnelList] Safety timeout - forcing loading to false');
            setIsLoading(false);
        }, 10000);

        const fetchData = async () => {
            setIsLoading(true);
            try {
                console.log('[PersonnelList] Starting data fetch...');
                const [employeesData, unitsData] = await Promise.all([
                    EmployeeService.getAll(),
                    UnitService.getAll()
                ]);
                console.log('[PersonnelList] Data received:', { employees: employeesData.length, units: unitsData.length });
                setAllPersonnel(employeesData);
                setUnits(unitsData);
            } catch (error) {
                console.error('[PersonnelList] Error fetching data:', error);
                toast.error('Lỗi tải dữ liệu nhân sự');
            } finally {
                console.log('[PersonnelList] Setting loading to false');
                setIsLoading(false);
                clearTimeout(timeoutId);
            }
        };
        fetchData();

        return () => clearTimeout(timeoutId);
    }, []);

    // Filter units for dropdown
    const filterUnits = useMemo(() => {
        const allowedUnits = units.filter(u =>
            u.id !== 'all' &&
            (visibleUnits === 'all' || visibleUnits.includes(u.id))
        );

        const companyOption = {
            id: 'all',
            name: 'Tất cả đơn vị',
            code: 'ALL',
            type: 'Company' as const,
            target: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 }
        };

        if (visibleUnits === 'all' || visibleUnits.length > 1) {
            return [companyOption, ...allowedUnits];
        }
        return allowedUnits;
    }, [units, visibleUnits]);

    // Selected unit name for display
    const selectedUnitName = useMemo(() => {
        const unit = filterUnits.find(u => u.id === unitFilter);
        return unit?.name || 'Tất cả đơn vị';
    }, [filterUnits, unitFilter]);

    // Position priority for sorting
    const getPositionPriority = (position?: string, roleCode?: string): number => {
        const pos = position?.toLowerCase() || '';
        if (pos.includes('tổng giám đốc') && !pos.includes('phó')) return 100;
        if (pos.includes('phó tổng')) return 90;
        if (pos.includes('giám đốc tt') || pos.includes('giám đốc cn')) return 80;
        if (roleCode === 'UnitLeader') return 75;
        if (pos.includes('trưởng phòng') || pos.includes('kế toán trưởng')) return 70;
        if (roleCode === 'ChiefAccountant') return 65;
        if (pos.includes('chuyên viên') || roleCode === 'NVKD') return 50;
        return 30;
    };

    // Total and pagination
    const totalCount = allPersonnel.length;
    const totalPages = Math.ceil(totalCount / pageSize);

    // Filter and sort personnel
    const filteredPersonnel = useMemo(() => {
        let filtered = allPersonnel;

        // Filter by visibility first
        if (visibleUnits !== 'all') {
            filtered = filtered.filter(p => visibleUnits.includes(p.unitId));
        }

        // Filter by unit select
        if (unitFilter !== 'all') {
            filtered = filtered.filter(p => p.unitId === unitFilter);
        }

        // Filter by search query
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.email?.toLowerCase().includes(q) ||
                p.phone?.includes(q) ||
                p.employeeCode?.toLowerCase().includes(q)
            );
        }

        // Sort by position priority, then unit, then name
        const sorted = [...filtered].sort((a, b) => {
            const priorityA = getPositionPriority(a.position, a.roleCode);
            const priorityB = getPositionPriority(b.position, b.roleCode);
            if (priorityB !== priorityA) return priorityB - priorityA;
            const unitA = units.find(u => u.id === a.unitId)?.code || 'ZZZ';
            const unitB = units.find(u => u.id === b.unitId)?.code || 'ZZZ';
            if (unitA !== unitB) return unitA.localeCompare(unitB);
            return a.name.localeCompare(b.name);
        });

        const from = (currentPage - 1) * pageSize;
        return sorted.slice(from, from + pageSize);
    }, [allPersonnel, unitFilter, searchQuery, currentPage, units]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [unitFilter, searchQuery]);

    const handleSave = async (data: any) => {
        console.log('[PersonnelList.handleSave] Starting...', { id: data.id });
        try {
            if (data.id) {
                console.log('[PersonnelList.handleSave] Calling update...');
                await EmployeeService.update(data.id, data);
                console.log('[PersonnelList.handleSave] Update completed');
            } else {
                console.log('[PersonnelList.handleSave] Calling create...');
                await EmployeeService.create(data);
                console.log('[PersonnelList.handleSave] Create completed');
            }
            // Refresh data
            console.log('[PersonnelList.handleSave] Refreshing data...');
            const employeesData = await EmployeeService.getAll();
            console.log('[PersonnelList.handleSave] Refresh completed, count:', employeesData.length);
            setAllPersonnel(employeesData);
            toast.success("Lưu thông tin nhân viên thành công!");
            setIsFormOpen(false);
            setEditingPerson(undefined);
        } catch (error) {
            console.error('[PersonnelList.handleSave] Failed:', error);
            toast.error('Lỗi lưu dữ liệu');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa nhân sự này?')) {
            try {
                await EmployeeService.delete(id);
                setAllPersonnel(prev => prev.filter(p => p.id !== id));
                toast.success("Đã xóa nhân viên");
            } catch (error) {
                console.error('Lỗi khi xóa nhân viên:', error);
                toast.error('Không thể xóa nhân viên này.');
            }
        }
        setActionMenuId(null);
    };

    // Handle view detail
    const handleViewDetail = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsDetailOpen(true);
    };

    // Format date for display
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('vi-VN');
        } catch { return '—'; }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">
                        Quản lý Nhân sự
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {totalCount} nhân viên • Trang {currentPage}/{totalPages || 1}
                    </p>
                </div>

                <div className="flex gap-3">
                    {/* Unit Filter */}
                    <div className="relative">
                        <button
                            onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-300 transition-all min-w-[180px]"
                        >
                            <Building size={18} className="text-slate-400" />
                            <span className="flex-1 text-left truncate">{selectedUnitName}</span>
                            <ChevronDown size={16} className={`text-slate-400 transition-transform ${isUnitDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isUnitDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsUnitDropdownOpen(false)} />
                                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-20 overflow-hidden">
                                    <div className="max-h-80 overflow-y-auto">
                                        {filterUnits.map(unit => (
                                            <button
                                                key={unit.id}
                                                onClick={() => { setUnitFilter(unit.id); setIsUnitDropdownOpen(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${unitFilter === unit.id
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                            >
                                                <span className="w-10 text-xs font-bold text-slate-400">{unit.code}</span>
                                                <span className="flex-1">{unit.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm nhân viên..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Import & Template — only Admin/Leadership */}
                    {profile && canCreateEmployee(profile.role) && (
                        <>
                            <button
                                onClick={() => setIsImportOpen(true)}
                                className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:border-indigo-300 transition-all"
                            >
                                <Upload size={18} />
                                <span className="hidden sm:inline">Import</span>
                            </button>
                            <a
                                href="/templates/employeeImportTemplate.xlsx"
                                download
                                className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:border-emerald-300 transition-all"
                            >
                                <Download size={18} />
                                <span className="hidden sm:inline">Template</span>
                            </a>
                        </>
                    )}

                    {/* Add Button — Spec §6.5: only Admin/Leadership */}
                    {(() => {
                        const canAdd = profile ? canCreateEmployee(profile.role) : false;

                        if (!canAdd) return null;

                        return (
                            <button
                                onClick={() => { setEditingPerson(undefined); setIsFormOpen(true); }}
                                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200/50 hover:shadow-xl transition-all"
                            >
                                <Plus size={18} />
                                <span className="hidden sm:inline">Thêm NV</span>
                            </button>
                        );
                    })()}
                </div>
            </div>

            {/* Personnel Form Modal */}
            <PersonnelForm
                isOpen={isFormOpen}
                onClose={() => { setIsFormOpen(false); setEditingPerson(undefined); }}
                onSubmit={handleSave}
                initialData={editingPerson}
            />

            {/* Employee Detail Modal */}
            <EmployeeDetailModal
                isOpen={isDetailOpen}
                onClose={() => { setIsDetailOpen(false); setSelectedEmployee(null); }}
                employee={selectedEmployee}
                unit={units.find(u => u.id === selectedEmployee?.unitId)}
                onEdit={(emp) => { setEditingPerson(emp); setIsFormOpen(true); }}
                onDelete={handleDelete}
            />

            {/* Import Employee Modal */}
            <ImportEmployeeModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                units={units}
                onSuccess={async () => {
                    const employeesData = await EmployeeService.getAll();
                    setAllPersonnel(employeesData);
                    toast.success('Import nhân sự thành công!');
                }}
            />

            {/* Summary Stats - HR focused */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <User size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{totalCount}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng nhân viên</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <Building size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{units.length}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đơn vị</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-pink-100 dark:bg-pink-900/30 rounded-lg text-pink-600 dark:text-pink-400">
                            <User size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                                {allPersonnel.filter(p => p.gender === 'male').length}/{allPersonnel.filter(p => p.gender === 'female').length}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Nam / Nữ</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                                {allPersonnel.filter(p => p.dateJoined && new Date(p.dateJoined).getFullYear() === new Date().getFullYear()).length}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mới năm nay</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Personnel Table - HR focused */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={32} className="animate-spin text-indigo-500" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                                    <th className="text-left py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nhân viên</th>
                                    <th className="text-left py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Đơn vị</th>
                                    <th className="text-left py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Liên hệ</th>
                                    <th className="text-left py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden xl:table-cell">Ngày sinh</th>
                                    <th className="text-left py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden xl:table-cell">Ngày vào</th>
                                    <th className="py-4 px-6"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPersonnel.map((person) => (
                                    <tr
                                        key={person.id}
                                        onClick={() => handleViewDetail(person)}
                                        className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors group cursor-pointer"
                                    >
                                        {/* Name & Position */}
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-200/50 dark:shadow-none overflow-hidden">
                                                    {person.avatar ? (
                                                        <img src={person.avatar} alt={person.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        person.name.split(' ').pop()?.charAt(0) || '?'
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{person.name}</h3>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{person.position || person.roleCode || '—'}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Unit */}
                                        <td className="py-4 px-6 hidden md:table-cell">
                                            <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                                                {units.find(u => u.id === person.unitId)?.code || '—'}
                                            </span>
                                        </td>

                                        {/* Contact */}
                                        <td className="py-4 px-6 hidden lg:table-cell">
                                            <div className="space-y-1">
                                                {person.email && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Mail size={12} />
                                                        <span className="truncate max-w-[180px]">{person.email}</span>
                                                    </div>
                                                )}
                                                {person.phone && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Phone size={12} />
                                                        <span>{person.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* DOB */}
                                        <td className="py-4 px-6 hidden xl:table-cell">
                                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                                {formatDate(person.dateOfBirth)}
                                            </span>
                                        </td>

                                        {/* Join Date */}
                                        <td className="py-4 px-6 hidden xl:table-cell">
                                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                                {formatDate(person.dateJoined)}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="py-4 px-6">
                                            {(() => {
                                                const showEdit = profile ? canEditEmployee(profile.role, person.unitId, profile.unitId) : false;
                                                const showDelete = profile ? canDeleteEmployee(profile.role) : false;

                                                if (!showEdit && !showDelete) return null;

                                                return (
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === person.id ? null : person.id); }}
                                                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <MoreVertical size={16} className="text-slate-400" />
                                                        </button>
                                                        {actionMenuId === person.id && (
                                                            <>
                                                                <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
                                                                <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-20 overflow-hidden">
                                                                    {showEdit && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setEditingPerson(person); setIsFormOpen(true); setActionMenuId(null); }}
                                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                                        >
                                                                            <Pencil size={14} /> Chỉnh sửa
                                                                        </button>
                                                                    )}
                                                                    {showDelete && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleDelete(person.id); }}
                                                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                                        >
                                                                            <Trash2 size={14} /> Xóa
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                                {filteredPersonnel.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-16 text-center text-slate-400">
                                            Không tìm thấy nhân viên nào
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-sm text-slate-500">
                            Hiển thị {filteredPersonnel.length} trên tổng số {totalCount} nhân viên
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Trước
                            </button>
                            <span className="text-sm text-slate-600">Trang {currentPage} / {totalPages}</span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonnelList;
