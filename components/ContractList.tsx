import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Search, Filter, Plus, ExternalLink, User, Loader2, DollarSign, Briefcase, TrendingUp, Calendar, Building2, Download, Upload, Copy, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, Check, Clock, AlertCircle, FileText, CheckCircle, PackageCheck, X } from 'lucide-react';
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
import { formatVND as formatCurrency, formatCompactVND, getStatusColor, getWarningBadges } from '../utils/contractHelpers';
import { formatDate, removeDiacritics } from '../utils/formatters';
import { useLayoutContext } from './layout/MainLayout';
import DateInput from './ui/DateInput';
import AcceptanceDialog from './ui/AcceptanceDialog';

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
  const [salespersonFilter, setSalespersonFilter] = useState<string>('All');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Date range filter (overrides year filter when set)
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Sync: when user picks a specific year in Header, clear the date range
  useEffect(() => {
    if (yearFilter && yearFilter !== 'All') {
      setDateFrom('');
      setDateTo('');
    }
  }, [yearFilter]);

  // Infinite scroll batch size
  const PAGE_SIZE = 20;

  // Data state
  const [salespeople, setSalespeople] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [metrics, setMetrics] = useState({ totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0, totalRevenueProfit: 0, totalCash: 0, processingCount: 0, suspendedCount: 0, handoverCount: 0, acceptanceCount: 0, completedCount: 0 });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [customerShortNames, setCustomerShortNames] = useState<Map<string, string>>(new Map());
  const [invoiceMap, setInvoiceMap] = useState<Map<string, string[]>>(new Map());

  // Cross-unit visibility
  const { visibleUnits } = useCurrentUserVisibleUnits();
  const canSeeAll = visibleUnits === 'all';

  // Sort state
  const [sortBy, setSortBy] = useState<string | null>('signedDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Quick status change state
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [acceptancePendingId, setAcceptancePendingId] = useState<string | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const ACTIVE_STATUSES = [
    { value: 'Processing', label: 'Đang thực hiện', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800' },
    { value: 'Suspended', label: 'Tạm dừng/Huỷ', color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800' },
    { value: 'Handover', label: 'Bàn giao', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800' },
    { value: 'Acceptance', label: 'Nghiệm thu/TL', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
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

    const datePromptMap: Record<string, string> = {
      'Handover': 'Nhập ngày bàn giao (dd/mm/yyyy):',
      'Suspended': 'Nhập ngày tạm dừng/huỷ (dd/mm/yyyy):',
    };
    const dateFieldMap: Record<string, string> = {
      'Handover': 'handoverDate',
      'Suspended': 'suspendedDate',
    };

    // Acceptance: mở dialog thay vì prompt
    if (newStatus === 'Acceptance') {
      setAcceptancePendingId(contractId);
      setStatusDropdownId(null);
      return;
    }

    let updateData: Record<string, any> = { status: newStatus as any };

    if (datePromptMap[newStatus]) {
      const today = new Date();
      const defaultDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
      const inputDate = prompt(datePromptMap[newStatus], defaultDate);
      if (!inputDate) {
        setStatusDropdownId(null);
        return; // User cancelled
      }
      // Parse dd/mm/yyyy -> yyyy-mm-dd
      const parts = inputDate.split('/');
      if (parts.length === 3) {
        const isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        (updateData as any)[dateFieldMap[newStatus]] = isoDate;
      }
    }

    setChangingStatusId(contractId);
    setStatusDropdownId(null);
    try {
      await ContractService.update(contractId, updateData as any);
      setContracts(prev => prev.map(c => c.id === contractId ? { ...c, ...updateData } as any : c));
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

  // Filtered salespeople list — only those who have contracts in current view
  const [contractSalespersonIds, setContractSalespersonIds] = useState<Set<string>>(new Set());

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

        // Fetch ALL customer shortNames (paginated — Supabase hard limit is 1000/request)
        const { dataClient } = await import('../lib/dataClient');
        const map = new Map<string, string>();
        let from = 0;
        const batchSize = 1000;
        while (true) {
          const { data: customers } = await dataClient
            .from('customers')
            .select('id, short_name')
            .not('short_name', 'is', null)
            .neq('short_name', '')
            .range(from, from + batchSize - 1);
          if (!customers || customers.length === 0) break;
          customers.forEach((c: any) => { if (c.short_name) map.set(c.id, c.short_name); });
          if (customers.length < batchSize) break;
          from += batchSize;
        }
        setCustomerShortNames(map);
        console.log('[CustomerShortNames] Loaded', map.size, 'entries in', Math.ceil(from / batchSize) + 1, 'batches');

        // Fetch VAT invoice numbers for display in Doanh thu column
        const { data: invoices } = await dataClient
          .from('payments')
          .select('contract_id, invoice_number')
          .eq('voucher_type', 'VAT_INVOICE')
          .not('invoice_number', 'is', null);
        if (invoices) {
          const iMap = new Map<string, string[]>();
          invoices.forEach((inv: any) => {
            if (inv.invoice_number) {
              const existing = iMap.get(inv.contract_id) || [];
              existing.push(inv.invoice_number);
              iMap.set(inv.contract_id, existing);
            }
          });
          setInvoiceMap(iMap);
        }
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

  // Fetch unique salesperson IDs from contracts (depends on unit & year)
  useEffect(() => {
    const fetchSalespersonIds = async () => {
      try {
        const { dataClient } = await import('../lib/dataClient');
        let query = dataClient.from('contracts').select('employee_id');
        if (effectiveUnitId && effectiveUnitId !== 'all' && effectiveUnitId !== 'All') {
          if (effectiveUnitId.includes(',')) {
            query = query.in('unit_id', effectiveUnitId.split(',').map(id => id.trim()));
          } else {
            query = query.eq('unit_id', effectiveUnitId);
          }
        }
        if (dateFrom || dateTo) {
          if (dateFrom) query = query.gte('signed_date', dateFrom);
          if (dateTo) query = query.lte('signed_date', dateTo);
        } else if (yearFilter && yearFilter !== 'All') {
          query = query.gte('signed_date', `${yearFilter}-01-01`).lte('signed_date', `${yearFilter}-12-31`);
        }
        const { data } = await query;
        const ids = new Set((data || []).map((c: any) => c.employee_id).filter(Boolean));
        setContractSalespersonIds(ids as Set<string>);
      } catch (e) {
        console.error("Fetch salesperson IDs failed", e);
      }
    };
    fetchSalespersonIds();
  }, [effectiveUnitId, yearFilter, dateFrom, dateTo]);

  // Compute matching customer IDs when search matches customer short names (tên viết tắt)
  const matchingCustomerIds = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.trim().length === 0) return undefined;
    const term = removeDiacritics(debouncedSearch.toLowerCase().trim());
    const ids: string[] = [];
    customerShortNames.forEach((shortName, customerId) => {
      if (removeDiacritics(shortName.toLowerCase()).includes(term)) {
        ids.push(customerId);
      }
    });
    return ids.length > 0 ? ids : undefined;
  }, [debouncedSearch, customerShortNames]);

  // Infinite scroll fetch function
  const fetchContractPage = useCallback(async (page: number) => {
    const params = {
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch,
      status: statusFilter,
      unitId: effectiveUnitId,
      year: yearFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      salespersonId: salespersonFilter !== 'All' ? salespersonFilter : undefined,
      sortBy: sortBy || undefined,
      sortDir: sortBy ? sortDir : undefined,
      matchingCustomerIds
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
  }, [debouncedSearch, statusFilter, salespersonFilter, effectiveUnitId, yearFilter, dateFrom, dateTo, sortBy, sortDir, matchingCustomerIds]);

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
    resetDeps: [debouncedSearch, statusFilter, salespersonFilter, effectiveUnitId, yearFilter, dateFrom, dateTo, sortBy, sortDir, matchingCustomerIds]
  });

  // Auto-refresh list when contracts are created, updated, or deleted
  useEffect(() => {
    const handleRefresh = () => {
      console.log('[ContractList] contract created/updated/deleted, refreshing list...');
      resetInfiniteScroll();
    };
    window.addEventListener('contract-created', handleRefresh);
    window.addEventListener('contract-updated', handleRefresh);
    window.addEventListener('contract-deleted', handleRefresh);
    return () => {
      window.removeEventListener('contract-created', handleRefresh);
      window.removeEventListener('contract-updated', handleRefresh);
      window.removeEventListener('contract-deleted', handleRefresh);
    };
  }, [resetInfiniteScroll]);

  // Tự động sinh danh sách 5 năm gần nhất
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear + 1 - i).toString());
  }, []);

  const formatCompactNumber = (number: number) => {
    return new Intl.NumberFormat('vi-VN', { notation: "compact", maximumFractionDigits: 1 }).format(number);
  };


  return (
    <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500 pb-4">
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
                  year: yearFilter,
                  dateFrom: dateFrom || undefined,
                  dateTo: dateTo || undefined,
                });

                // Map to export format
                const exportData = data.map((c, idx) => ({
                  'STT': idx + 1,
                  'Mã HĐ': c.contractCode,
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Contracts */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 dark-card-glow">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Briefcase size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng số hồ sơ</p>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{metrics.totalContracts}</p>
          </div>
        </div>

        {/* Total Value */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 dark-card-glow">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng giá trị ký</p>
            <p className="text-base font-black text-indigo-600 dark:text-indigo-400">
              {formatCurrency(metrics.totalValue)}
            </p>
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 dark-card-glow">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doanh thu thực tế</p>
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(metrics.totalRevenue)}
            </p>
          </div>
        </div>

        {/* LNG Quản trị */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 dark-card-glow">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LNG Quản trị</p>
            <p className="text-base font-black text-amber-600 dark:text-amber-400">
              {formatCurrency(metrics.totalProfit)}
            </p>
          </div>
        </div>

        {/* LNG Doanh thu */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 dark-card-glow">
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LNG Doanh thu</p>
            <p className="text-base font-black text-purple-600 dark:text-purple-400">
              {formatCurrency(metrics.totalRevenueProfit)}
            </p>
          </div>
        </div>
      </div>

      {/* STATUS FILTER CARDS */}
      {(() => {
        const statusCards: { status: ContractStatus; label: string; count: number; icon: React.ReactNode; color: string; bgColor: string }[] = [
          { status: 'Processing', label: 'Đang thực hiện', count: metrics.processingCount, icon: <Clock size={16} />, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/25 border border-orange-100 dark:border-orange-800/40' },
          { status: 'Suspended', label: 'Tạm dừng/Huỷ', count: metrics.suspendedCount, icon: <AlertCircle size={16} />, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/25 border border-red-100 dark:border-red-800/40' },
          { status: 'Handover', label: 'Bàn giao', count: metrics.handoverCount, icon: <PackageCheck size={16} />, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-50 dark:bg-cyan-900/25 border border-cyan-100 dark:border-cyan-800/40' },
          { status: 'Acceptance', label: 'Nghiệm thu/TL', count: metrics.acceptanceCount, icon: <FileText size={16} />, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/25 border border-blue-100 dark:border-blue-800/40' },
          { status: 'Completed', label: 'Hoàn thành', count: metrics.completedCount, icon: <CheckCircle size={16} />, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-100 dark:border-emerald-800/40' },
        ];
        return (
          <div className="grid grid-cols-5 gap-2">
            {statusCards.map(sc => (
              <button
                key={sc.status}
                onClick={() => setStatusFilter(statusFilter === sc.status ? 'All' : sc.status)}
                className={`${sc.bgColor} rounded-lg px-2 py-2 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] ${statusFilter === sc.status ? 'ring-2 ring-indigo-500 shadow-lg' : ''
                  }`}
              >
                <div className={sc.color}>{sc.icon}</div>
                <div>
                  <p className={`text-[9px] font-bold ${sc.color} uppercase`}>{sc.label}</p>
                  <p className={`text-lg font-black ${sc.color}`}>{sc.count}</p>
                </div>
              </button>
            ))}
          </div>
        );
      })()}

      <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="flex-1 min-w-[240px] relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm mã HĐ, tên khách hàng, tên viết tắt KH, nội dung, end user, số HĐ KH..."
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
            <option value="Suspended">Tạm dừng/Huỷ</option>
            <option value="Handover">Bàn giao</option>
            <option value="Acceptance">Nghiệm thu/TL</option>
            <option value="Completed">Hoàn thành</option>
          </select>
        </div>

        {/* Salesperson Filter */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-4 border border-slate-200 dark:border-slate-800">
          <User size={18} className="text-slate-500" />
          <select
            className="bg-transparent py-3 text-sm font-black text-slate-900 dark:text-slate-100 outline-none max-w-[180px]"
            value={salespersonFilter}
            onChange={(e) => setSalespersonFilter(e.target.value)}
          >
            <option value="All">Tất cả nhân sự</option>
            {salespeople
              .filter(sp => contractSalespersonIds.has(sp.id))
              .map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-1.5">
          <Calendar size={15} className="text-slate-400 flex-shrink-0" />
          <DateInput
            value={dateFrom}
            onChange={(v) => { setDateFrom(v); if (v) setYearFilter('All'); }}
            placeholder="Từ ngày"
            className="w-[120px] px-2.5 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-slate-400 text-xs">→</span>
          <DateInput
            value={dateTo}
            onChange={(v) => { setDateTo(v); if (v) setYearFilter('All'); }}
            placeholder="Đến ngày"
            className="w-[120px] px-2.5 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
              title="Xóa bộ lọc ngày"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg transition-colors overflow-x-hidden overflow-y-auto max-h-[calc(100vh-200px)]">
        <table className="w-full text-left" style={{ tableLayout: 'fixed' }}>
          {/* Colgroup: controls column widths proportionally */}
          <colgroup>
            <col style={{ width: '2%' }} />     {/* STT */}
            <col style={{ width: '9%' }} />     {/* Số HĐ */}
            <col />                              {/* Nội dung HĐ — auto fills remaining */}
            <col style={{ width: '8%' }} />     {/* Ký kết */}
            <col style={{ width: '7.5%' }} />   {/* Doanh thu */}
            <col style={{ width: '7.5%' }} />   {/* Tiền về */}
            <col style={{ width: '8%' }} />     {/* LNG quản trị */}
            <col style={{ width: '7.5%' }} />   {/* LNG theo DT */}
            <col style={{ width: '3%' }} />     {/* Tỷ suất */}
            <col style={{ width: '9%' }} />     {/* Trạng thái */}
            <col style={{ width: '3%' }} />     {/* Actions */}
          </colgroup>
          <thead>
            <tr className="z-20">
              {[
                { label: 'STT', align: 'center' },
                { label: 'Số HĐ', align: 'center', sortKey: 'signedDate' },
                { label: 'Nội dung hợp đồng', align: 'center', sortKey: 'title' },
                { label: 'Ký kết', align: 'center', sortKey: 'value' },
                { label: 'Doanh thu', align: 'center', sortKey: 'actualRevenue' },
                { label: 'Tiền về', align: 'center' },
                { label: 'LNG quản trị', align: 'center', color: 'text-amber-700 dark:text-amber-400', sortKey: 'adminProfit' },
                { label: 'LNG theo DT', align: 'center', color: 'text-purple-700 dark:text-purple-400', sortKey: 'revProfit' },
                { label: 'Tỷ suất', align: 'center' },
                { label: 'Trạng thái', align: 'center', sortKey: 'status' },
                { label: '', align: 'center' },
              ].map((col, idx) => (
                <th
                  key={idx}
                  className={`sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-1.5 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700
                    ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}
                    ${col.color || 'text-slate-700 dark:text-slate-300'}
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
              const adminProfit = contract.adminProfit || 0;
              // Doanh thu thực tế: chỉ hiển thị actual_revenue (ghi nhận sau xuất hóa đơn), không fallback
              const revenue = contract.actualRevenue || 0;
              const cashReceived = contract.cashReceived || 0;
              const advanceAmount = contract.advanceAmount || 0;
              // Tỷ suất LN = LNG Quản trị / Doanh thu dự kiến (Sum outputPrice * quantity)
              const expectedRevenue = (contract.lineItems || []).reduce((sum: number, li: any) => sum + (li.outputPrice || 0) * (li.quantity || 1), 0);
              const margin = expectedRevenue > 0 ? (adminProfit / expectedRevenue) * 100 : 0;
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
                  title={isCollaborative ? `HĐ phối hợp — Phân bổ ${allocationPct}% — Giá trị: ${formatCurrency(Math.round((contract.value || 0) * (allocationPct || 100) / 100))}` : allocationRole === 'lead' && allocationPct !== undefined && allocationPct < 100 ? `HĐ chủ trì — Phân bổ ${allocationPct}% — Giá trị: ${formatCurrency(Math.round((contract.value || 0) * allocationPct / 100))}` : undefined}
                >
                  <td className="px-1.5 py-2 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {stt.toString().padStart(2, '0')}
                  </td>
                  {/* Số HĐ + Phụ trách KD */}
                  <td className="px-2 py-2 overflow-hidden" title={`${contract.id}\n${contract.signedDate ? formatDate(contract.signedDate) : 'Chưa ký'}\n${salesperson?.name || 'Chưa gán'}${contract.customerContractNumber ? '\nSố HĐ KH: ' + contract.customerContractNumber : ''}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-black flex-shrink-0 ${contract.contractType === 'HĐ' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'}`}>
                        {contract.contractType}
                      </div>
                      <div>
                        <p
                          className="text-xs font-black text-slate-900 dark:text-slate-100 leading-none hover:text-indigo-600 cursor-pointer transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(contract.contractCode);
                            toast.success(`Đã copy: ${contract.contractCode}`);
                          }}
                        >{contract.contractCode}</p>
                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-tighter">
                          {contract.signedDate ? formatDate(contract.signedDate) : 'Chưa ký'}
                        </p>
                        {contract.customerContractNumber && (
                          <p className="text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 truncate">
                            📋 {contract.customerContractNumber}
                          </p>
                        )}
                        <p className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 mt-0.5 truncate">
                          {salesperson?.name || 'Chưa gán'}
                        </p>
                      </div>
                    </div>
                  </td>
                  {/* Nội dung HĐ + Khách hàng */}
                  <td className="px-3 py-2 text-[11px] font-bold text-slate-800 dark:text-slate-200" title={`${contract.title}\n${contract.partyA}${contract.endUserName ? '\nEnd User: ' + contract.endUserName : ''}`}>
                    <div className="flex items-center gap-2">
                      <p className="line-clamp-2">{contract.title}</p>
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
                    <div>
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1" title={contract.endUserName ? `End User: ${contract.endUserName}` : undefined}>
                        {contract.partyA}
                        {contract.customerId && customerShortNames.get(contract.customerId) && !contract.partyA?.includes(customerShortNames.get(contract.customerId)!) && (
                          <span className="text-cyan-600 dark:text-cyan-400 font-bold"> ({customerShortNames.get(contract.customerId)})</span>
                        )}
                      </p>
                      {contract.endUserName && (
                        <p className="text-[9px] font-bold text-teal-600 dark:text-teal-400 mt-0.5 truncate max-w-[220px]" title={`End User: ${contract.endUserName}`}>
                          👤 {contract.endUserName}
                        </p>
                      )}
                    </div>
                  </td>
                  {/* Ký kết — hiển thị giá trị phân bổ, hover xem giá trị ký kết gốc */}
                  <td className="px-1.5 py-2 text-right overflow-hidden">
                    {(() => {
                      const fullValue = contract.value || 0;
                      const allocatedValue = allocationPct !== undefined && allocationPct < 100
                        ? Math.round(fullValue * allocationPct / 100)
                        : fullValue;
                      const hasAllocation = allocationPct !== undefined && allocationPct < 100;
                      return (
                        <span
                          className={`text-[11px] font-bold ${hasAllocation ? 'text-indigo-700 dark:text-indigo-400 cursor-help' : 'text-slate-900 dark:text-slate-100'}`}
                          title={hasAllocation ? `Giá trị ký kết: ${formatCurrency(fullValue)} — Phân bổ ${allocationPct}%` : `Giá trị ký kết: ${formatCurrency(fullValue)}`}
                        >
                          {formatCurrency(allocatedValue)}
                        </span>
                      );
                    })()}
                  </td>
                  {/* Doanh thu */}
                  <td className="px-1.5 py-2 text-right overflow-hidden">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100" title={formatCurrency(revenue)}>
                      {formatCurrency(revenue)}
                    </span>
                    {invoiceMap.get(contract.id) && invoiceMap.get(contract.id)!.length > 0 && (
                      <p className="text-[8px] font-bold text-blue-500 dark:text-blue-400 mt-0.5 truncate max-w-[120px]" title={`Số HĐ: ${invoiceMap.get(contract.id)!.join(', ')}`}>
                        HĐ: {invoiceMap.get(contract.id)!.join(', ')}
                      </p>
                    )}
                  </td>
                  {/* Tiền về */}
                  <td className="px-1.5 py-2 text-right overflow-hidden">
                    {cashReceived > 0 ? (
                      advanceAmount > 0 && advanceAmount >= cashReceived ? (
                        // All cash is from advance payments
                        <span
                          className="text-[11px] font-bold text-amber-600 dark:text-amber-400 cursor-help"
                          title={`💰 Tạm ứng: ${formatCurrency(advanceAmount)} (chưa xuất HĐ)`}
                        >
                          {formatCurrency(cashReceived)}
                          <span className="block text-[8px] font-bold text-amber-500/70 dark:text-amber-500/60 uppercase tracking-wider mt-0.5">Tạm ứng</span>
                        </span>
                      ) : advanceAmount > 0 ? (
                        // Mixed: some advance + some regular
                        <span className="cursor-help" title={`Tiền về: ${formatCurrency(cashReceived - advanceAmount)} + Tạm ứng: ${formatCurrency(advanceAmount)}`}>
                          <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">{formatCurrency(cashReceived - advanceAmount)}</span>
                          <span className="block text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">+ TU: {formatCurrency(advanceAmount)}</span>
                        </span>
                      ) : (
                        // Normal cash received
                        <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400" title={formatCurrency(cashReceived)}>
                          {formatCurrency(cashReceived)}
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-600">
                        {formatCurrency(0)}
                      </span>
                    )}
                    {/* Còn thiếu = Tổng giá trị xuất HĐ sau VAT - Tổng tiền về */}
                    {(() => {
                      const invoiced = contract.invoicedAmount || 0;
                      const outstanding = invoiced - cashReceived;
                      if (invoiced > 0 && outstanding > 0) {
                        return (
                          <p className="text-[9px] font-bold text-rose-600 dark:text-rose-400 mt-0.5" title={`Còn thiếu: ${formatCurrency(outstanding)} = Đã xuất HĐ ${formatCurrency(invoiced)} − Tiền về ${formatCurrency(cashReceived)}`}>
                            −{formatCurrency(outstanding)}
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </td>
                  {/* LNG Quản trị */}
                  <td className="px-1.5 py-2 text-right overflow-hidden">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400" title={formatCurrency(contract.adminProfit || 0)}>
                      {formatCurrency(contract.adminProfit || 0)}
                    </span>
                  </td>
                  {/* LNG theo DT */}
                  <td className="px-1.5 py-2 text-right overflow-hidden">
                    <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400" title={formatCurrency(contract.revProfit || 0)}>
                      {formatCurrency(contract.revProfit || 0)}
                    </span>
                  </td>
                  {/* Tỷ suất LN/DT */}
                  <td className="px-1.5 py-2 text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${margin > 50 ? 'bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                      {margin.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-1.5 py-2 text-left">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <div className="relative inline-block" ref={statusDropdownId === contract.id ? statusDropdownRef : undefined}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusDropdownId(statusDropdownId === contract.id ? null : contract.id);
                            }}
                            disabled={changingStatusId === contract.id}
                            className={`group/status flex items-center justify-start gap-1 px-2 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold shadow-sm transition-all focus:ring-2 focus:ring-orange-500 cursor-pointer whitespace-nowrap ${contract.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/20' :
                              contract.status === 'Processing' ? 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 hover:bg-orange-500/20' :
                                contract.status === 'Suspended' ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 hover:bg-rose-500/20' :
                                  contract.status === 'Handover' ? 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 hover:bg-cyan-500/20' :
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
                                      s.value === 'Handover' ? 'bg-cyan-500' :
                                        s.value === 'Acceptance' ? 'bg-blue-500' : 'bg-emerald-500'
                                    }`} />
                                  {s.label}
                                  {contract.status === s.value && <Check size={14} className="ml-auto text-indigo-500" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Warning badges — shown below status for visibility */}
                      {getWarningBadges(contract.warnings).length > 0 && (
                        <div className="flex flex-wrap gap-0.5">
                          {getWarningBadges(contract.warnings).map((badge, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold whitespace-nowrap ${badge.color}`}
                              title={badge.label}
                            >
                              {badge.icon} {badge.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-1 py-2 text-center">
                    {(onClone && (isGlobalScope || contract.unitId === profile?.unitId)) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClone(contract);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        title="Nhân bản hợp đồng"
                      >
                        <Copy size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* INFINITE SCROLL SENTINEL — must be INSIDE scroll container */}
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
      {/* Acceptance Dialog */}
      <AcceptanceDialog
        isOpen={!!acceptancePendingId}
        onClose={() => setAcceptancePendingId(null)}
        defaultValue={contracts.find(c => c.id === acceptancePendingId)?.value || 0}
        onConfirm={async ({ date, value }) => {
          const contractId = acceptancePendingId!;
          setAcceptancePendingId(null);
          setChangingStatusId(contractId);
          const updateData: Record<string, any> = {
            status: 'Acceptance',
            acceptanceDate: date,
            acceptanceValue: value,
          };
          try {
            await ContractService.update(contractId, updateData as any);
            setContracts(prev => prev.map(c => c.id === contractId ? { ...c, ...updateData } as any : c));
            toast.success('Đã chuyển trạng thái → Nghiệm thu/TL');
          } catch (err: any) {
            toast.error('Lỗi cập nhật trạng thái: ' + (err.message || err));
          } finally {
            setChangingStatusId(null);
          }
        }}
      />
    </div>
  );
};

export default ContractList;
