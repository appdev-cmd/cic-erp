import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Search, User, Building, ChevronDown, Loader2, Plus, Pencil, Trash2, MoreVertical, Phone, Mail, Calendar, GraduationCap, MapPin, CreditCard, Eye, Upload, Download, FileSpreadsheet, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { EmployeeService, UnitService } from '../services';
import { Employee, Unit } from '../types';
import PersonnelForm from './PersonnelForm';
import EmployeeDetailModal from './EmployeeDetailModal';
import ImportEmployeeModal from './ImportEmployeeModal';
import { useCurrentUserVisibleUnits } from '../hooks';
import { useAuth } from '../contexts/AuthContext';
import { usePermissionCheck } from '../hooks/usePermissions';
import { useImpersonation } from '../contexts/ImpersonationContext';
import { formatDate } from '../utils/formatters';
import { useColumnResize } from '../hooks/useColumnResize';

interface PersonnelListProps {
    selectedUnit: Unit;
    onSelectPersonnel: (id: string) => void;
}

const PersonnelList: React.FC<PersonnelListProps> = ({ selectedUnit, onSelectPersonnel }) => {
    const { profile: realProfile } = useAuth();
    const { impersonatedUser, isImpersonating } = useImpersonation();
    const profile = isImpersonating && impersonatedUser ? impersonatedUser : realProfile;
    const { can } = usePermissionCheck();
    const { visibleUnits: baseVisibleUnits, isLoading: loadingVisibility } = useCurrentUserVisibleUnits();

    // HR managers with employees.view permission see all employees across all units
    const hasEmployeesView = can('employees', 'view');
    const visibleUnits = hasEmployeesView ? 'all' as const : baseVisibleUnits;

    const [searchQuery, setSearchQuery] = useState('');
    const [unitFilter, setUnitFilter] = useState<string>('all');
    const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'probation' | 'resigned' | 'working'>('working');

    // Data state
    const [allPersonnel, setAllPersonnel] = useState<Employee[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Infinite Scroll
    const [visibleCount, setVisibleCount] = useState(15);
    const sentinelRef = React.useRef<HTMLDivElement | null>(null);

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState<Employee | undefined>(undefined);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);

    // Detail modal state
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Import modal state
    const [isImportOpen, setIsImportOpen] = useState(false);

    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // View mode: 'table' (Web) or 'grid' (Mobile/Tablet friendly)
    const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
        const saved = localStorage.getItem('personnel-view-mode');
        return (saved as 'table' | 'grid') || 'table';
    });

    const toggleViewMode = (mode: 'table' | 'grid') => {
        setViewMode(mode);
        localStorage.setItem('personnel-view-mode', mode);
    };

    // === Resizable columns ===
    const PERSONNEL_TABLE_COLUMNS = useMemo(() => [
        { key: 'employee', defaultWidth: 280, minWidth: 150 },
        { key: 'unit', defaultWidth: 120, minWidth: 60 },
        { key: 'contact', defaultWidth: 220, minWidth: 100 },
        { key: 'dob', defaultWidth: 120, minWidth: 70 },
        { key: 'joined', defaultWidth: 120, minWidth: 70 },
        { key: 'actions', defaultWidth: 55, minWidth: 40 },
    ], []);

    const { columnWidths, onResizeStart, isResizing, resetWidths } = useColumnResize({
        tableId: 'personnel-list',
        userId: realProfile?.id,
        columns: PERSONNEL_TABLE_COLUMNS,
    });

    // Fetch data
    useEffect(() => {
        const timeoutId = setTimeout(() => setIsLoading(false), 10000);

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [employeesData, unitsData] = await Promise.all([
                    EmployeeService.getAll(),
                    UnitService.getAll()
                ]);
                setAllPersonnel(employeesData);
                setUnits(unitsData);
            } catch (error) {
                toast.error('Lỗi tải dữ liệu nhân sự');
            } finally {
                setIsLoading(false);
                clearTimeout(timeoutId);
            }
        };
        fetchData();

        return () => clearTimeout(timeoutId);
    }, []);

    // Realtime: silently refetch when employee data changes from another tab
    useEffect(() => {
        const handleRealtimeRefresh = () => {
            EmployeeService.getAll()
                .then(setAllPersonnel)
                .catch(e => console.error('[PersonnelList] Realtime refetch error:', e));
        };
        window.addEventListener('employee-changed', handleRealtimeRefresh);
        return () => window.removeEventListener('employee-changed', handleRealtimeRefresh);
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

    // Filter and sort personnel (compute full filtered list for accurate count)
    const filteredAll = useMemo(() => {
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

        // Filter by status
        if (statusFilter === 'working') {
            filtered = filtered.filter(p => {
                const s = p.status || 'active';
                return s === 'active' || s === 'probation';
            });
        } else if (statusFilter !== 'all') {
            filtered = filtered.filter(p => (p.status || 'active') === statusFilter);
        }

        // Sort by position priority, then unit, then name
        return [...filtered].sort((a, b) => {
            const priorityA = getPositionPriority(a.position, a.roleCode);
            const priorityB = getPositionPriority(b.position, b.roleCode);
            if (priorityB !== priorityA) return priorityB - priorityA;
            const unitA = units.find(u => u.id === a.unitId)?.code || 'ZZZ';
            const unitB = units.find(u => u.id === b.unitId)?.code || 'ZZZ';
            if (unitA !== unitB) return unitA.localeCompare(unitB);
            return a.name.localeCompare(b.name);
        });
    }, [allPersonnel, unitFilter, searchQuery, units, visibleUnits, statusFilter]);

    // Total personnel count (based on filtered results)
    const totalCount = filteredAll.length;

    // Dynamic stats calculated from filtered list
    const activeUnitsCount = useMemo(() => {
        return new Set(filteredAll.map(p => p.unitId)).size;
    }, [filteredAll]);

    const maleCount = useMemo(() => {
        return filteredAll.filter(p => p.gender === 'male').length;
    }, [filteredAll]);

    const femaleCount = useMemo(() => {
        return filteredAll.filter(p => p.gender === 'female').length;
    }, [filteredAll]);

    const newThisYearCount = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return filteredAll.filter(p => {
            if (!p.dateJoined) return false;
            try {
                return new Date(p.dateJoined).getFullYear() === currentYear;
            } catch (e) {
                return false;
            }
        }).length;
    }, [filteredAll]);

    // Slice personnel for infinite scroll
    const filteredPersonnel = useMemo(() => {
        return filteredAll.slice(0, visibleCount);
    }, [filteredAll, visibleCount]);

    // Reset visibleCount on filter change
    useEffect(() => {
        setVisibleCount(15);
    }, [unitFilter, searchQuery, statusFilter]);

    // IntersectionObserver to auto-load more
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && visibleCount < filteredAll.length) {
                    setVisibleCount(prev => prev + 15);
                }
            },
            {
                rootMargin: '200px',
                threshold: 0.1
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [visibleCount, filteredAll.length]);

    const handleSave = async (data: any) => {
        try {
            if (data.id) {
                await EmployeeService.update(data.id, data);
            } else {
                await EmployeeService.create(data);
            }
            const employeesData = await EmployeeService.getAll();
            setAllPersonnel(employeesData);
            toast.success("Lưu thông tin nhân viên thành công!");
            setIsFormOpen(false);
            setEditingPerson(undefined);
        } catch (error) {
            toast.error('Lỗi lưu dữ liệu');
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirmId) return;
        setIsDeleting(true);
        try {
            await EmployeeService.delete(deleteConfirmId);
            setAllPersonnel(prev => prev.filter(p => p.id !== deleteConfirmId));
            toast.success("Đã xóa nhân viên");
        } catch (error) {
            toast.error('Không thể xóa nhân viên này.');
        } finally {
            setIsDeleting(false);
            setDeleteConfirmId(null);
            setActionMenuId(null);
        }
    };

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id);
        setActionMenuId(null);
    };

    // Handle view detail
    const handleViewDetail = (employee: Employee) => {
        setSelectedEmployee(employee);
        setIsDetailOpen(true);
    };



    // Export to Excel
    const handleExport = () => {
        try {
            const exportData = filteredAll.map(p => ({
                'Mã NV': p.employeeCode || '',
                'Họ và tên': p.name,
                'Đơn vị': units.find(u => u.id === p.unitId)?.name || '',
                'Chức vụ': p.position || '',
                'Email': p.email || '',
                'SĐT': p.phone || '',
                'Telegram': p.telegram || '',
                'Ngày sinh': p.dateOfBirth ? formatDate(p.dateOfBirth) : '',
                'Giới tính': p.gender === 'male' ? 'Nam' : p.gender === 'female' ? 'Nữ' : '',
                'Địa chỉ': p.address || '',
                'Ngày vào làm': p.dateJoined ? formatDate(p.dateJoined) : '',
                'Loại HĐ': p.contractType || '',
                'Ngày hết HĐ': p.contractEndDate ? formatDate(p.contractEndDate) : '',
                'Học vấn': p.education || '',
                'Chuyên ngành': p.specialization || '',
                'Số CCCD': p.idNumber || '',
                'STK ngân hàng': p.bankAccount || '',
                'Ngân hàng': p.bankName || '',
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Nhân sự');

            // Auto-width columns
            const colWidths = Object.keys(exportData[0] || {}).map(key => ({
                wch: Math.max(key.length, ...exportData.map(row => String((row as any)[key] || '').length)) + 2
            }));
            ws['!cols'] = colWidths;

            const fileName = `nhan_su_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            toast.success(`Đã xuất ${exportData.length} nhân viên ra file ${fileName}`);
        } catch (error) {
            toast.error('Lỗi khi xuất file Excel');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100">
                        Quản lý Nhân sự
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {totalCount} nhân viên
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Import & Template & Export — only Admin/Leadership */}
                    {can('employees', 'create') && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsImportOpen(true)}
                                className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer"
                            >
                                <Upload size={16} />
                                <span>Import</span>
                            </button>
                            <a
                                href="/templates/employeeImportTemplate.xlsx"
                                download
                                className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:border-emerald-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
                            >
                                <Download size={16} />
                                <span>Template</span>
                            </a>
                            <button
                                onClick={handleExport}
                                disabled={filteredAll.length === 0}
                                className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:border-emerald-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all disabled:opacity-50 cursor-pointer"
                            >
                                <FileSpreadsheet size={16} />
                                <span>Export</span>
                            </button>
                        </div>
                    )}

                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => toggleViewMode('table')}
                            className={`p-2 rounded-md transition-all cursor-pointer ${viewMode === 'table' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                            title="Chế độ bảng (Web)"
                        >
                            <FileSpreadsheet size={16} />
                        </button>
                        <button
                            onClick={() => toggleViewMode('grid')}
                            className={`p-2 rounded-md transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                            title="Chế độ thẻ (Mobile/Tablet)"
                        >
                            <User size={16} />
                        </button>
                    </div>

                    {/* Add Button — Spec §6.5: only Admin/Leadership */}
                    {can('employees', 'create') && (
                        <button
                            onClick={() => { setEditingPerson(undefined); setIsFormOpen(true); }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg text-sm font-bold shadow-md shadow-indigo-200/50 hover:shadow-lg transition-all cursor-pointer active:scale-95 text-nowrap"
                        >
                            <Plus size={16} />
                            <span>Thêm NV</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filters Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/10 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Unit Filter */}
                    <div className="relative">
                        <button
                            onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                            className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-indigo-300 transition-all min-w-[180px] cursor-pointer"
                        >
                            <Building size={16} className="text-slate-400" />
                            <span className="flex-1 text-left truncate">{selectedUnitName}</span>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform ${isUnitDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isUnitDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsUnitDropdownOpen(false)} />
                                <div className="absolute top-full left-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-20 overflow-hidden">
                                    <div className="max-h-80 overflow-y-auto">
                                        {filterUnits.map(unit => (
                                            <button
                                                key={unit.id}
                                                onClick={() => { setUnitFilter(unit.id); setIsUnitDropdownOpen(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors cursor-pointer ${unitFilter === unit.id
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

                    {/* Status Filter */}
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:border-indigo-300 outline-none transition-all cursor-pointer"
                        >
                            <option value="working">Đang làm việc & Thử việc</option>
                            <option value="active">Chính thức</option>
                            <option value="probation">Đang thử việc</option>
                            <option value="resigned">Đã nghỉ việc</option>
                            <option value="all">Tất cả trạng thái</option>
                        </select>
                    </div>
                </div>

                {/* Search */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm nhân viên..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
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
                            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{activeUnitsCount}</p>
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
                                {maleCount}/{femaleCount}
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
                                {newThisYearCount}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Mới năm nay</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Personnel Content - Table or Grid View */}
            {isLoading ? (
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-16 flex items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                </div>
            ) : viewMode === 'table' ? (
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className={`overflow-x-auto ${isResizing ? 'select-none' : ''}`}>
                        <table className="hidden md:table text-left" style={{ tableLayout: 'fixed', width: Object.values(columnWidths).reduce((a, b) => a + b, 0), minWidth: '100%' }}>
                            <colgroup>
                                {PERSONNEL_TABLE_COLUMNS.map(c => (
                                    <col key={c.key} style={{ width: columnWidths[c.key] }} />
                                ))}
                            </colgroup>
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                                    {[
                                        { key: 'employee', label: 'Nhân viên', align: 'left' },
                                        { key: 'unit', label: 'Đơn vị', align: 'left' },
                                        { key: 'contact', label: 'Liên hệ', align: 'left' },
                                        { key: 'dob', label: 'Ngày sinh', align: 'left' },
                                        { key: 'joined', label: 'Ngày vào', align: 'left' },
                                        { key: 'actions', label: '', align: 'center' },
                                    ].map((col, idx, arr) => (
                                        <th key={col.key} className={`py-4 px-6 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/th ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}>
                                            {col.label}
                                            {idx < arr.length - 1 && (
                                                <div
                                                    className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-30 flex items-center justify-center"
                                                    onMouseDown={(e) => onResizeStart(col.key, e)}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="w-[2px] h-4 bg-slate-300 dark:bg-slate-600 rounded-full opacity-0 group-hover/th:opacity-100 transition-opacity" />
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPersonnel.map((person) => (
                                    <tr
                                        key={person.id}
                                        onClick={() => onSelectPersonnel(person.slug || person.id)}
                                        className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group cursor-pointer bg-white dark:bg-slate-900"
                                    >
                                        {/* Name & Position */}
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-200/50 dark:shadow-none overflow-hidden flex-shrink-0">
                                                    {person.avatar ? (
                                                        <img src={person.avatar} alt={person.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        person.name.split(' ').pop()?.charAt(0) || '?'
                                                    )}
                                                </div>
                                                <div className="truncate">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{person.name}</h3>
                                                        {(person.status || 'active') === 'resigned' ? (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 shrink-0">
                                                                Đã nghỉ
                                                            </span>
                                                        ) : person.status === 'probation' ? (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 shrink-0">
                                                                Thử việc
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{person.position || person.roleCode || '—'}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Unit */}
                                        <td className="py-4 px-6">
                                            <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                                                {units.find(u => u.id === person.unitId)?.code || '—'}
                                            </span>
                                        </td>

                                        {/* Contact */}
                                        <td className="py-4 px-6">
                                            <div className="space-y-1">
                                                {person.email && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Mail size={12} className="flex-shrink-0" />
                                                        <span className="truncate">{person.email}</span>
                                                    </div>
                                                )}
                                                {person.phone && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Phone size={12} className="flex-shrink-0" />
                                                        <span>{person.phone}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* DOB */}
                                        <td className="py-4 px-6">
                                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                                {formatDate(person.dateOfBirth)}
                                            </span>
                                        </td>

                                        {/* Join Date */}
                                        <td className="py-4 px-6">
                                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                                {formatDate(person.dateJoined)}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="py-4 px-6">
                                            {(() => {
                                                const showEdit = can('employees', 'update');
                                                const showDelete = can('employees', 'delete');

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
                                        <td colSpan={6} className="py-16 text-center text-slate-500 dark:text-slate-400">
                                            Không tìm thấy nhân viên nào
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* MOBILE CARDS */}
                        <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredPersonnel.length === 0 ? (
                                <div className="py-16 text-center text-slate-500 dark:text-slate-400">
                                    Không tìm thấy nhân viên nào
                                </div>
                            ) : (
                                filteredPersonnel.map((person) => (
                                    <div
                                        key={person.id}
                                        onClick={() => onSelectPersonnel(person.slug || person.id)}
                                        className="p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex flex-col gap-3 relative group"
                                    >
                                        {/* Header: Name, Position, Action */}
                                        <div className="flex items-start justify-between gap-3 pr-8">
                                            <div className="flex items-start gap-3">
                                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow-sm flex-shrink-0 overflow-hidden">
                                                    {person.avatar ? (
                                                        <img src={person.avatar} alt={person.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        person.name.split(' ').pop()?.charAt(0) || '?'
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight">
                                                            {person.name}
                                                        </h3>
                                                        {(person.status || 'active') === 'resigned' ? (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 shrink-0">
                                                                Đã nghỉ
                                                            </span>
                                                        ) : person.status === 'probation' ? (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 shrink-0">
                                                                Thử việc
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                                        {person.position || person.roleCode || 'Nhân viên'}
                                                    </p>
                                                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-black text-slate-500 dark:text-slate-400">
                                                        <Building size={10} />
                                                        {units.find(u => u.id === person.unitId)?.code || 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Menu */}
                                        {(() => {
                                            const showEdit = can('employees', 'update');
                                            const showDelete = can('employees', 'delete');

                                            if (!showEdit && !showDelete) return null;

                                            return (
                                                <div className="absolute top-4 right-4">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === person.id ? null : person.id); }}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {actionMenuId === person.id && (
                                                        <>
                                                            <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
                                                            <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-20 overflow-hidden">
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

                                        {/* Contact & Info */}
                                        <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 mt-1">
                                            {(person.phone || person.email) && (
                                                <div className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
                                                    {person.phone && (
                                                        <div className="flex items-center gap-2">
                                                            <Phone size={12} className="text-slate-400" />
                                                            <span>{person.phone}</span>
                                                        </div>
                                                    )}
                                                    {person.email && (
                                                        <div className="flex items-center gap-2">
                                                            <Mail size={12} className="text-slate-400" />
                                                            <span className="truncate">{person.email}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-medium text-slate-400">NS:</span>
                                                    <span>{formatDate(person.dateOfBirth)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-medium text-slate-400">Vào làm:</span>
                                                    <span>{formatDate(person.dateJoined)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Grid View (Mobile/Tablet optimized) */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredPersonnel.map((person) => (
                        <div
                            key={person.id}
                            onClick={() => onSelectPersonnel(person.slug || person.id)}
                            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer group relative overflow-hidden"
                        >
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200/50 dark:shadow-none overflow-hidden flex-shrink-0">
                                    {person.avatar ? (
                                        <img src={person.avatar} alt={person.name} className="w-full h-full object-cover" />
                                    ) : (
                                        person.name.split(' ').pop()?.charAt(0) || '?'
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-black text-slate-900 dark:text-slate-100 text-base truncate group-hover:text-indigo-600 transition-colors">{person.name}</h3>
                                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mt-0.5">{person.position || 'Nhân viên'}</p>
                                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-black text-slate-500 dark:text-slate-400">
                                        <Building size={10} />
                                        {units.find(u => u.id === person.unitId)?.code || 'N/A'}
                                    </div>
                                </div>
                                <div className="absolute top-4 right-4">
                                    {(() => {
                                        const showEdit = can('employees', 'update');
                                        const showDelete = can('employees', 'delete');
                                        if (!showEdit && !showDelete) return null;

                                        return (
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === person.id ? null : person.id); }}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400"
                                                >
                                                    <MoreVertical size={16} />
                                                </button>
                                                {actionMenuId === person.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setActionMenuId(null)} />
                                                        <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-20 overflow-hidden">
                                                            {showEdit && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setEditingPerson(person); setIsFormOpen(true); setActionMenuId(null); }}
                                                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
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
                                </div>
                            </div>

                            <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                                {person.email && (
                                    <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                                        <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                            <Mail size={12} />
                                        </div>
                                        <span className="truncate">{person.email}</span>
                                    </div>
                                )}
                                {person.phone && (
                                    <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                                        <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                            <Phone size={12} />
                                        </div>
                                        <span>{person.phone}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                                    <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                        <Calendar size={12} />
                                    </div>
                                    <span>Vào làm: {formatDate(person.dateJoined)}</span>
                                </div>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); onSelectPersonnel(person.slug || person.id); }}
                                className="w-full mt-4 py-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg text-xs font-bold transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50"
                            >
                                Xem chi tiết
                            </button>
                        </div>
                    ))}
                    {filteredPersonnel.length === 0 && (
                        <div className="col-span-full py-16 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                            Không tìm thấy nhân viên nào
                        </div>
                    )}
                </div>
            )}

            {/* Infinite Scroll Sentinel */}
            {visibleCount < totalCount && (
                <div ref={sentinelRef} className="py-6 flex justify-center items-center gap-2 text-slate-400">
                    <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={20} />
                    <span className="text-xs font-semibold">Đang tải thêm...</span>
                </div>
            )}

            {/* Footer Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                    Hiển thị {filteredPersonnel.length} / {totalCount} nhân viên
                </p>
                <div className="flex items-center gap-2">
                    <button
                        onClick={resetWidths}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                        title="Đặt lại kích thước cột mặc định"
                    >
                        <RotateCcw size={13} /> Reset cột
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
                        <div className="text-center">
                            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 size={24} className="text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Xác nhận xóa</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                Bạn có chắc chắn muốn xóa nhân viên <strong className="text-slate-700 dark:text-slate-300">{allPersonnel.find(p => p.id === deleteConfirmId)?.name}</strong>? Hành động này không thể hoàn tác.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    Xóa
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default PersonnelList;
