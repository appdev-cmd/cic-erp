import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Search, Filter, Plus, ExternalLink, User, Loader2, DollarSign, Briefcase, TrendingUp, Calendar, Building2, Download, Upload, Copy, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Check } from 'lucide-react';
import { ContractService, EmployeeService, UnitService } from '../services';
import { ContractStatus, Unit, Contract, Employee, UserRole } from '../types';
import { CONTRACT_STATUS_LABELS } from '../constants';
import { useImpersonation } from '../contexts/ImpersonationContext';
import ImportContractModal from './ImportContractModal';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useCurrentUserVisibleUnits } from '../hooks';
import { useAuth } from '../contexts/AuthContext';
import ScrollToTop from './ui/ScrollToTop';
import { usePermissionCheck } from '../hooks/usePermissions';
import { formatVND as formatCurrency, getStatusColor } from '../utils/contractHelpers';
import { useLayoutContext } from './layout/MainLayout';

// Inline debounce hook if not exists, but better to check. 
// For now, I'll use a simple useEffect debounce logic.

interface ContractListProps {
  selectedUnit: Unit;
  onSelectContract: (id: string) => void;
  onAdd: () => void;
  onClone?: (contract: Contract) => void;
  onEdit?: (id: string) => void;  // New: Quick edit
}

const ContractList: React.FC<ContractListProps> = ({ selectedUnit, onSelectContract, onAdd, onClone, onEdit }) => {
  const { profile: realProfile } = useAuth();
  // Impersonation - để filter theo đơn vị của user đang giả làm
  const { impersonatedUser, isImpersonating } = useImpersonation();
  // Use impersonated profile for permission checks
  const profile = isImpersonating && impersonatedUser ? impersonatedUser : realProfile;
  const { can, isGlobalScope } = usePermissionCheck();

  // Year filter from Layout context (synced with Header)
  const { yearFilter, setYearFilter } = useLayoutContext();

  // Params state
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'All'>('All');
  const [unitFilter, setUnitFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Infinite scroll batch size
  const PAGE_SIZE = 20;

  // Data state
  const [salespeople, setSalespeople] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [metrics, setMetrics] = useState({ totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0 });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Cross-unit visibility
  const { visibleUnits } = useCurrentUserVisibleUnits();
  const canSeeAll = visibleUnits === 'all';

  // Sort state
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Quick status change state
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const ACTIVE_STATUSES = [
    { value: 'Processing', label: 'Đang thực hiện', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
    { value: 'Suspended', label: 'Tạm dừng', color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800' },
    { value: 'Acceptance', label: 'Nghiệm thu', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
    { value: 'Liquidated', label: 'Thanh lý', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' },
    { value: 'Completed', label: 'Hoàn thành', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownId(null);
      }
    };
    if (statusDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [statusDropdownId]);

  const handleQuickStatusChange = async (contractId: string, newStatus: string, oldStatus: string) => {
    if (newStatus === oldStatus) {
      setStatusDropdownId(null);
      return;
    }
    setChangingStatusId(contractId);
    setStatusDropdownId(null);
    try {
      await ContractService.update(contractId, { status: newStatus as any });
      // Update inline without refetching entire list
      setContracts(prev => prev.map(c => c.id === contractId ? { ...c, status: newStatus as any } : c));
      toast.success(`Đã chuyển trạng thái → ${CONTRACT_STATUS_LABELS[newStatus]}`);
    } catch (err: any) {
      toast.error('Lỗi cập nhật trạng thái: ' + (err.message || err));
    } finally {
      setChangingStatusId(null);
    }
  };

  // Can create: check DB permission + scope, with role fallback for impersonation
  const canCreate = useMemo(() => {
    if (!profile) return false;
    // DB permission check with role fallback (for impersonated users without DB records)
    const hasCreatePermission = can('contracts', 'create') ||
      (['Admin', 'Leadership', 'UnitLeader', 'AdminUnit', 'NVKD'].includes(profile.role || ''));
    if (!hasCreatePermission) return false;
    // Global roles (Leadership/Admin) can always create
    if (isGlobalScope) return true;
    // Unit-scoped roles: can only create when viewing their own unit
    return unitFilter === profile.unitId || (unitFilter === 'All' && !isImpersonating && profile.unitId !== 'all');
  }, [profile, isGlobalScope, unitFilter, isImpersonating, can]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Keyboard shortcuts
  const [gKeyPressed, setGKeyPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input fields
      const inInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      // Alt+N: Add new contract (changed from Ctrl+N to avoid browser conflict)
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        if (canCreate) onAdd();
        return;
      }

      // / : Focus search (like GitHub)
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !inInput) {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        searchInput?.focus();
        return;
      }

      // G-key navigation (GitHub style: press G then another key)
      if (!inInput) {
        if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          setGKeyPressed(true);
          // Reset after 1 second
          setTimeout(() => setGKeyPressed(false), 1000);
          return;
        }

        if (gKeyPressed) {
          setGKeyPressed(false);
          switch (e.key) {
            case 'd':
              e.preventDefault();
              window.location.href = '/dashboard';
              break;
            case 'c':
              e.preventDefault();
              window.location.href = '/contracts';
              break;
            case 'p':
              e.preventDefault();
              window.location.href = '/personnel';
              break;
            case 'h':
              e.preventDefault();
              window.location.href = '/guide';
              break;
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAdd, gKeyPressed]);

  // Initial lookup data fetch (Run once)
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [personnelData, unitsData] = await Promise.all([
          EmployeeService.getAll(),
          UnitService.getAll()
        ]);
        setSalespeople(personnelData);
        setUnits(unitsData);
      } catch (e) {
        console.error("Fetch lookups failed", e);
        toast.error("Không thể tải dữ liệu danh mục");
      }
    };
    fetchLookups();
  }, []);

  // Compute effective unit ID for fetching
  const effectiveUnitId = useMemo(() => {
    const GLOBAL_VIEW_ROLES: UserRole[] = ['Legal', 'Accountant', 'ChiefAccountant', 'Leadership', 'Admin'];

    // Helper: check if current visibility allows a specific unit
    const isUnitAllowed = (unitId: string) => {
      if (canSeeAll) return true;
      if (Array.isArray(visibleUnits) && visibleUnits.includes(unitId)) return true;
      return false;
    };

    // If a specific unit is selected from the header dropdown, use it only if allowed
    if (selectedUnit && selectedUnit.id !== 'all') {
      if (isUnitAllowed(selectedUnit.id)) return selectedUnit.id;
      // Not allowed → fall through to default scope
    }
    // If a specific unit is selected from the local filter, use it only if allowed
    if (unitFilter !== 'All') {
      if (isUnitAllowed(unitFilter)) return unitFilter;
    }

    // No specific unit selected → determine full scope
    // Global-view roles can see everything
    const effectiveRole = profile?.role;
    if (effectiveRole && GLOBAL_VIEW_ROLES.includes(effectiveRole)) return 'All';

    // For non-global roles: pass ALL visible units (own + granted) as comma-separated
    if (Array.isArray(visibleUnits) && visibleUnits.length > 0) {
      return visibleUnits.join(',');
    }

    return canSeeAll ? 'All' : 'All';
  }, [profile, selectedUnit, unitFilter, canSeeAll, visibleUnits]);

  // Infinite scroll fetch function
  const fetchContractPage = useCallback(async (page: number) => {
    const params = {
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch,
      status: statusFilter,
      unitId: effectiveUnitId,
      year: yearFilter,
      sortBy: sortBy || undefined,
      sortDir: sortBy ? sortDir : undefined
    };

    const [listRes, statsRes] = await Promise.all([
      ContractService.list(params),
      page === 1 ? ContractService.getStats(params) : Promise.resolve(null)
    ]);

    if (statsRes) setMetrics(statsRes);

    return {
      data: listRes.data,
      hasMore: listRes.data.length >= PAGE_SIZE,
      totalCount: listRes.count
    };
  }, [debouncedSearch, statusFilter, effectiveUnitId, yearFilter, sortBy, sortDir]);

  const {
    items: contracts,
    isLoading: loading,
    isLoadingMore,
    hasMore,
    totalCount,
    sentinelRef,
    reset: resetInfiniteScroll,
    setItems: setContracts
  } = useInfiniteScroll<Contract>({
    fetchFn: fetchContractPage,
    pageSize: PAGE_SIZE,
    resetDeps: [debouncedSearch, statusFilter, effectiveUnitId, yearFilter, sortBy, sortDir]
  });

  // Tự động sinh danh sách 5 năm gần nhất
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear + 1 - i).toString());
  }, []);

  const formatCompactNumber = (number: number) => {
    return new Intl.NumberFormat('vi-VN', { notation: "compact", maximumFractionDigits: 1 }).format(number);
  };


  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Impersonation Warning Banner */}
      {isImpersonating && impersonatedUser && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white">
            <User size={20} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-amber-800 dark:text-amber-300">
              🔒 Đang xem với quyền: {impersonatedUser.fullName}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {(['Legal', 'Accountant', 'ChiefAccountant', 'Leadership', 'Admin'] as UserRole[]).includes(impersonatedUser.role)
                ? 'Hiển thị TẤT CẢ hợp đồng của toàn công ty'
                : 'Hiển thị hợp đồng thuộc đơn vị của nhân viên này và đơn vị được cấp quyền xem'
              }
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Hợp đồng & Vụ việc</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm font-bold mt-1">
            Đơn vị: <span className="text-indigo-700 dark:text-indigo-400 font-black uppercase">{selectedUnit?.name || 'Toàn công ty'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-5 py-3 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <Upload size={20} /> Nhập Excel
          </button>
          <button
            onClick={async () => {
              try {
                toast.info("Đang tạo file Excel...");
                // Resolve effective unit ID (Global > Local > All)
                let effectiveUnitId = 'All';
                if (selectedUnit && selectedUnit.id !== 'all') {
                  effectiveUnitId = selectedUnit.id;
                } else if (unitFilter !== 'All') {
                  effectiveUnitId = unitFilter;
                }

                const { data } = await ContractService.list({
                  page: 1, limit: 10000,
                  search: debouncedSearch,
                  status: statusFilter,
                  unitId: effectiveUnitId,
                  year: yearFilter
                });

                // Map to export format
                const exportData = data.map((c, idx) => ({
                  'STT': idx + 1,
                  'Mã HĐ': c.id,
                  'Tên HĐ': c.title,
                  'Khách hàng': c.partyA,
                  'Giá trị': c.value,
                  'Doanh thu': c.actualRevenue,
                  'Ngày ký': c.signedDate,
                  'Trạng thái': c.status
                }));

                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Danh sách HĐ");
                XLSX.writeFile(wb, `Danh_sach_Hop_dong_${new Date().toISOString().split('T')[0]}.xlsx`);

                toast.success("Xuất file thành công!");
              } catch (e) {
                console.error(e);
                toast.error("Lỗi khi xuất file");
              }
            }}
            className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-5 py-3 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <Download size={20} /> Xuất Excel
          </button>
          {canCreate && (
            <button
              onClick={onAdd}
              title="Thêm hợp đồng mới (Alt+N)"
              className="flex items-center justify-center gap-2 bg-indigo-700 text-white px-6 py-3 rounded-lg font-black hover:bg-indigo-800 transition-all shadow-xl shadow-indigo-100 dark:shadow-none"
            >
              <Plus size={22} /> Thêm mới
            </button>
          )}
        </div>
      </div>

      {/* SCORE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Contracts */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 dark-card-glow">
          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Briefcase size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng số hồ sơ</p>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{metrics.totalContracts}</p>
          </div>
        </div>

        {/* Total Value */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 dark-card-glow">
          <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng giá trị ký</p>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400" title={formatCurrency(metrics.totalValue)}>
              {formatCompactNumber(metrics.totalValue)}
            </p>
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 dark-card-glow">
          <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Doanh thu thực tế</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400" title={formatCurrency(metrics.totalRevenue)}>
              {formatCompactNumber(metrics.totalRevenue)}
            </p>
          </div>
        </div>

        {/* Profit */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 dark-card-glow">
          <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lợi nhuận gộp</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400" title={formatCurrency(metrics.totalProfit)}>
              {formatCompactNumber(metrics.totalProfit)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md flex flex-wrap gap-4 items-center">
        {/* Search */}
        <div className="flex-1 min-w-[240px] relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm mã HĐ, tên khách hàng hoặc dự án..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-900 dark:text-slate-100"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-4 border border-slate-200 dark:border-slate-800">
          <Filter size={18} className="text-slate-500" />
          <select
            className="bg-transparent py-3 text-sm font-black text-slate-900 dark:text-slate-100 outline-none"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
            }}
          >
            <option value="All">Tất cả trạng thái</option>
            <option value="Processing">Đang thực hiện</option>
            <option value="Suspended">Tạm dừng</option>
            <option value="Acceptance">Nghiệm thu</option>
            <option value="Liquidated">Thanh lý</option>
            <option value="Completed">Hoàn thành</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg transition-colors overflow-x-auto overflow-y-auto max-h-[calc(100vh-360px)]">
        <table className="w-full text-left">
          <thead>
            <tr className="z-20">
              {[
                { label: 'STT', align: 'center', width: 'w-12' },
                { label: 'Số hợp đồng', align: 'left', sortKey: 'signedDate' },
                { label: 'Nội dung hợp đồng', align: 'left', sortKey: 'title' },
                { label: 'Phụ trách KD', align: 'left' },
                { label: 'Ký kết', align: 'right', sortKey: 'value' },
                { label: 'Doanh thu TT', align: 'right', sortKey: 'actualRevenue' },
                { label: 'Lợi nhuận gộp', align: 'right', color: 'text-emerald-700 dark:text-emerald-400', sortKey: 'estimatedCost' },
                { label: 'Tiền về', align: 'right' },
                { label: 'Tỷ suất LN/DT', align: 'center' },
                { label: 'Trạng thái', align: 'center', sortKey: 'status' },
              ].map((col, idx) => (
                <th
                  key={idx}
                  className={`sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-3 py-4 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700
                    ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}
                    ${col.color || 'text-slate-700 dark:text-slate-300'}
                    ${col.width || ''}
                    ${col.sortKey ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none transition-colors' : ''}`}
                  onClick={() => {
                    if (!col.sortKey) return;
                    if (sortBy === col.sortKey) {
                      if (sortDir === 'desc') {
                        setSortDir('asc');
                      } else {
                        setSortBy(null); // Reset sort
                      }
                    } else {
                      setSortBy(col.sortKey);
                      setSortDir('desc');
                    }
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortKey && (
                      sortBy === col.sortKey ? (
                        sortDir === 'desc'
                          ? <ArrowDown size={12} className="text-indigo-500" />
                          : <ArrowUp size={12} className="text-indigo-500" />
                      ) : (
                        <ArrowUpDown size={12} className="opacity-30" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={`border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${i % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : ''}`}>
                  <td className="px-3 py-4"><div className="flex justify-center"><div className="w-8 h-6 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div></div></td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
                      <div className="space-y-2">
                        <div className="w-24 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                        <div className="w-16 h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-5"><div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div><div className="w-1/2 h-4 mt-2 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div></td>
                  <td className="px-4 py-5"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse"></div><div className="w-20 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse"></div></div></td>
                  <td className="px-4 py-5 text-right"><div className="w-24 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto"></div></td>
                  <td className="px-4 py-5 text-right"><div className="w-24 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto"></div></td>
                  <td className="px-4 py-5 text-right"><div className="w-24 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto"></div></td>
                  <td className="px-4 py-5 text-right"><div className="w-24 h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto"></div></td>
                  <td className="px-4 py-5 text-center"><div className="w-12 h-6 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse mx-auto"></div></td>
                  <td className="px-4 py-5 text-center"><div className="w-20 h-6 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse mx-auto"></div></td>
                  <td className="px-4 py-5"><div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse ml-auto"></div></td>
                </tr>
              ))
            ) : contracts.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-slate-500">
                  Không tìm thấy hợp đồng nào
                </td>
              </tr>
            ) : contracts.map((contract, index) => {
              const profit = (contract.value || 0) - (contract.estimatedCost || 0);
              // Doanh thu thực tế: chỉ hiển thị actual_revenue (ghi nhận sau xuất hóa đơn), không fallback
              const revenue = contract.actualRevenue || 0;
              const cashReceived = contract.cashReceived || 0;
              const margin = revenue > 0 ? (profit / revenue) * 100 : ((contract.value || 0) > 0 ? (profit / contract.value) * 100 : 0);
              const salesperson = salespeople.find(s => s.id === contract.salespersonId);

              // Allocation info (tagged by ContractService.list for collaborative contracts)
              const allocationRole = (contract as any)._allocationRole as 'lead' | 'support' | undefined;
              const allocationPct = (contract as any)._allocationPct as number | undefined;
              const isCollaborative = allocationRole === 'support';

              // STT - sequential across infinite scroll
              const stt = index + 1;

              return (
                <tr
                  key={contract.id}
                  onClick={() => onSelectContract(contract.id)}
                  className={`group transition-all cursor-pointer hover:bg-orange-50/30 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${isCollaborative ? 'bg-blue-50/40 dark:bg-blue-900/10' : index % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'bg-transparent dark:bg-transparent'}`}
                  title={isCollaborative ? `HĐ phối hợp — Phân bổ ${allocationPct}%` : 'Click để xem chi tiết'}
                >
                  <td className="px-3 py-4 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {stt.toString().padStart(2, '0')}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${contract.contractType === 'HĐ' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'}`}>
                        {contract.contractType}
                      </div>
                      <div>
                        <p
                          className="text-sm font-black text-slate-900 dark:text-slate-100 leading-none hover:text-indigo-600 cursor-pointer transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(contract.id);
                            toast.success(`Đã copy: ${contract.id}`);
                          }}
                          title="Click để copy mã hợp đồng"
                        >{contract.id}</p>
                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-tighter">
                          {contract.signedDate ? new Date(contract.signedDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa ký'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-2">
                      <p className="line-clamp-2" title={contract.title}>{contract.title}</p>
                      {isCollaborative && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 whitespace-nowrap flex-shrink-0" title={`Đơn vị phối hợp — Phân bổ ${allocationPct}%`}>
                          Phối hợp {allocationPct}%
                        </span>
                      )}
                      {!isCollaborative && allocationRole === 'lead' && allocationPct !== undefined && allocationPct < 100 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 whitespace-nowrap flex-shrink-0" title={`Đơn vị chủ trì — Phân bổ ${allocationPct}%`}>
                          Chủ trì {allocationPct}%
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1">{contract.partyA}</p>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400">
                        {salesperson?.name ? salesperson.name[0] : '?'}
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{salesperson?.name || 'Chưa gán'}</span>
                    </div>
                  </td>
                  {/* Ký kết (Giá trị ký) */}
                  <td className="px-3 py-4 text-right">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(contract.value || 0)}
                    </span>
                  </td>
                  {/* Doanh thu */}
                  <td className="px-3 py-4 text-right">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(revenue)}
                    </span>
                  </td>
                  {/* Lợi nhuận gộp */}
                  <td className="px-3 py-4 text-right">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(profit)}
                    </span>
                  </td>
                  {/* Tiền về */}
                  <td className="px-3 py-4 text-right">
                    <span className={`text-[11px] font-bold ${cashReceived > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'}`}>
                      {formatCurrency(cashReceived)}
                    </span>
                  </td>
                  {/* Tỷ suất LN/DT */}
                  <td className="px-3 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${margin > 50 ? 'bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                      {margin.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <div className="relative inline-block" ref={statusDropdownId === contract.id ? statusDropdownRef : undefined}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusDropdownId(statusDropdownId === contract.id ? null : contract.id);
                        }}
                        disabled={changingStatusId === contract.id}
                        className={`group/status w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold shadow-sm transition-all focus:ring-2 focus:ring-orange-500 cursor-pointer ${contract.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/20' :
                          contract.status === 'Processing' ? 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 hover:bg-orange-500/20' :
                            contract.status === 'Suspended' ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 hover:bg-rose-500/20' :
                              contract.status === 'Liquidated' ? 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 hover:bg-purple-500/20' :
                                contract.status === 'Acceptance' ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-500/20' :
                                  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        title="Click để đổi trạng thái"
                      >
                        {changingStatusId === contract.id ? (
                          <Loader2 size={12} className="animate-spin shrink-0" />
                        ) : (
                          <>
                            <span className="truncate">{CONTRACT_STATUS_LABELS[contract.status] || contract.status}</span>
                            <ChevronDown size={12} className="opacity-0 group-hover/status:opacity-50 transition-opacity shrink-0" />
                          </>
                        )}
                      </button>
                      {statusDropdownId === contract.id && (
                        <div className="absolute z-50 top-full mt-1 right-0 w-44 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="px-3 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Chuyển trạng thái</div>
                          {ACTIVE_STATUSES.map(s => (
                            <button
                              key={s.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickStatusChange(contract.id, s.value, contract.status);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-bold flex items-center gap-2 transition-colors ${contract.status === s.value
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${s.value === 'Processing' ? 'bg-orange-500' :
                                s.value === 'Suspended' ? 'bg-rose-500' :
                                  s.value === 'Acceptance' ? 'bg-blue-500' :
                                    s.value === 'Liquidated' ? 'bg-purple-500' : 'bg-emerald-500'
                                }`} />
                              {s.label}
                              {contract.status === s.value && <Check size={14} className="ml-auto text-indigo-500" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4 text-right">
                    {(onClone && (isGlobalScope || contract.unitId === profile?.unitId)) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClone(contract);
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title="Nhân bản hợp đồng"
                      >
                        <Copy size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>


      </div>

      {/* INFINITE SCROLL SENTINEL INSIDE SCROLL AREA */}
      <div className="p-4 flex flex-col items-center justify-center">
        <div ref={sentinelRef} className="h-4 w-full" />
        {isLoadingMore && (
          <div className="flex items-center justify-center py-4 gap-2 text-indigo-600 dark:text-indigo-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">Đang tải thêm...</span>
          </div>
        )}
        {!hasMore && contracts.length > 0 && !loading && (
          <div className="text-center py-4 text-sm text-slate-400 dark:text-slate-500">
            Đã hiển thị tất cả {totalCount} kết quả
          </div>
        )}
      </div>

      {/* STATUS BAR */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-500">
            Hiển thị {contracts.length} / {totalCount} kết quả
          </div>
        </div>
      </div>

      <ScrollToTop />

      {/* Import Modal */}
      <ImportContractModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          resetInfiniteScroll();
          setIsImportModalOpen(false);
        }}
      />
    </div>
  );
};

export default ContractList;
