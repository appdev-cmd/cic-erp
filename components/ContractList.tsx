import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Search, Filter, Plus, ExternalLink, User, Loader2, DollarSign, Briefcase, TrendingUp, Calendar, Building2, Download, Copy, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Check, Clock, AlertCircle, AlertTriangle, FileText, CheckCircle, PackageCheck, X, RotateCcw, Hash } from 'lucide-react';
import { ContractService, EmployeeService, UnitService } from '../services';
import { ContractTagService } from '../services/contractTagService';
import { ContractStatus, Unit, Contract, Employee, UserRole, ContractClassification } from '../types';
import { CONTRACT_STATUS_LABELS } from '../constants';
import { useImpersonation } from '../contexts/ImpersonationContext';
import ImportContractModal from './ImportContractModal';
import { exportContractsToExcel } from '../services/contractExportService';
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
import DatePromptDialog from './ui/DatePromptDialog';
import { useColumnResize } from '../hooks/useColumnResize';

import { 
  computeDatesFromPeriodYear, 
  CONTRACT_TABLE_COLUMNS, 
  ACTIVE_STATUSES, 
  ContractListStats, 
  ContractListWarningChips,
  TABLE_HEADERS 
} from './ContractListSubComponents';
import { ContractListTableRow, ContractListMobileCard } from './ContractListTableRow';
import { GLOBAL_VIEW_ROLES } from '../lib/permissions';

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
  const { yearFilter, setYearFilter, periodFilter, setPeriodFilter } = useLayoutContext();

  // ── Persisted filter states (survive F5 refresh) ──
  const STORAGE_KEY = 'cic-erp-contract-filters';
  const savedFilters = useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }, []);

  // Params state — initialize from localStorage
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'All'>(savedFilters.statusFilter || 'All');
  
  // Detect mobile viewport to render infinite scroll sentinel in the correct container
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [unitFilter, setUnitFilter] = useState<string>(savedFilters.unitFilter || 'All');
  const [searchTerm, setSearchTerm] = useState(savedFilters.searchTerm || '');
  const [salespersonFilter, setSalespersonFilter] = useState<string>(savedFilters.salespersonFilter || 'All');
  const [classificationFilter, setClassificationFilter] = useState<ContractClassification | 'All'>(savedFilters.classificationFilter || 'All');
  const [warningFilter, setWarningFilter] = useState<'none' | 'overdueAdvance' | 'overduePayment' | 'acceptedNoInvoice'>('none');
  const [debouncedSearch, setDebouncedSearch] = useState(savedFilters.searchTerm || '');

  // Personal tag filter
  const [tagFilter, setTagFilter] = useState<string>('All');
  const [allUserTags, setAllUserTags] = useState<string[]>([]);
  const [tagFilterIds, setTagFilterIds] = useState<string[] | undefined>(undefined);
  const [contractTagsMap, setContractTagsMap] = useState<Map<string, string[]>>(new Map());

  // Helper: compute dateFrom/dateTo from period + year (imported)

  // Date range filter — initialized from period+year (NOT stale localStorage)
  const initialDates = useMemo(() => computeDatesFromPeriodYear(periodFilter, yearFilter), []);
  const [dateFrom, setDateFrom] = useState<string>(initialDates.from);
  const [dateTo, setDateTo] = useState<string>(initialDates.to);

  // Refs to avoid stale closures in fetch callbacks
  const dateFromRef = useRef(initialDates.from);
  const dateToRef = useRef(initialDates.to);

  // Sync: when period or year changes, re-compute date range
  // Refs are updated SYNCHRONOUSLY before setState to avoid race with resetDeps fetch
  useEffect(() => {
    const { from, to } = computeDatesFromPeriodYear(periodFilter, yearFilter);
    dateFromRef.current = from;
    dateToRef.current = to;
    setDateFrom(from);
    setDateTo(to);
  }, [periodFilter, yearFilter]);

  // Infinite scroll batch size
  const PAGE_SIZE = 20;

  // Data state
  const [salespeople, setSalespeople] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [metrics, setMetrics] = useState({ totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0, totalRevenueProfit: 0, totalCash: 0, processingCount: 0, suspendedCount: 0, handoverCount: 0, acceptanceCount: 0, completedCount: 0 });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statsCollapsed, setStatsCollapsed] = useState(() => {
    try { return localStorage.getItem('cic-erp-stats-collapsed') === 'true'; } catch { return false; }
  });
  const [customersData, setCustomersData] = useState<Map<string, {name: string, shortName: string}>>(new Map());
  const [invoiceMap, setInvoiceMap] = useState<Map<string, string[]>>(new Map());

  // Cross-unit visibility
  const { visibleUnits } = useCurrentUserVisibleUnits();
  const canSeeAll = visibleUnits === 'all';

  // Sort state — initialize from localStorage
  const [sortBy, setSortBy] = useState<string | null>(savedFilters.sortBy !== undefined ? savedFilters.sortBy : 'signedDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(savedFilters.sortDir || 'desc');

  // ── Auto-save filters to localStorage ──
  useEffect(() => {
    const filters = { statusFilter, unitFilter, searchTerm, salespersonFilter, classificationFilter, sortBy, sortDir, dateFrom, dateTo };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [statusFilter, unitFilter, searchTerm, salespersonFilter, classificationFilter, sortBy, sortDir, dateFrom, dateTo]);

  // Quick status change state
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [acceptancePendingId, setAcceptancePendingId] = useState<string | null>(null);
  const [datePromptPending, setDatePromptPending] = useState<{
    contractId: string;
    newStatus: string;
    dateField: string;
    title: string;
    colorScheme: 'rose' | 'cyan';
  } | null>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const { columnWidths, onResizeStart, isResizing, resetWidths } = useColumnResize({
    tableId: 'contract-list',
    userId: realProfile?.id,
    columns: CONTRACT_TABLE_COLUMNS,
  });

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
      setDatePromptPending({
        contractId,
        newStatus,
        dateField: dateFieldMap[newStatus],
        title: newStatus === 'Handover' ? 'Ngày bàn giao' : 'Ngày tạm dừng/huỷ',
        colorScheme: newStatus === 'Handover' ? 'cyan' : 'rose',
      });
      setStatusDropdownId(null);
      return;
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

  const handleExportExcel = async () => {
    setIsExporting(true);
    toast.info('Đang tạo file Excel...');
    try {
      const isAdmin = realProfile?.role === 'Admin';
      // Admin: xuất theo bộ lọc hiện tại (có thể toàn công ty)
      // Non-admin: luôn chỉ xuất đơn vị của họ, bất kể bộ lọc đang chọn
      const exportUnitId = isAdmin ? effectiveUnitId : (realProfile?.unitId || 'none');
      const { data } = await ContractService.list({
        page: 1,
        limit: 10000,
        search: debouncedSearch || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        unitId: exportUnitId,
        year: yearFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        salespersonId: salespersonFilter !== 'All' ? salespersonFilter : undefined,
        classification: classificationFilter !== 'All' ? classificationFilter : undefined,
        sortBy: sortBy || undefined,
        sortDir,
        filterByIds: tagFilterIds,
      });
      const employeesMap = new Map(salespeople.map(e => [e.id, e.name]));
      exportContractsToExcel(data, { customersMap: customersData, employeesMap, unitId: exportUnitId });
      toast.success(`Xuất file thành công! (${data.length} hợp đồng)`);
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi xuất file Excel');
    } finally {
      setIsExporting(false);
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

  // Debounce search — ignore # prefix (used for tag suggestions, not text search)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.startsWith('#') ? '' : searchTerm);
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

        // Fetch ALL customer names (paginated — Supabase hard limit is 1000/request)
        const { dataClient } = await import('../lib/dataClient');
        const map = new Map<string, {name: string, shortName: string}>();
        let from = 0;
        const batchSize = 1000;
        while (true) {
          const { data: customers } = await dataClient
            .from('customers')
            .select('id, name, short_name')
            .range(from, from + batchSize - 1);
          if (!customers || customers.length === 0) break;
          customers.forEach((c: any) => {
            map.set(c.id, { name: c.name, shortName: c.short_name || '' });
          });
          if (customers.length < batchSize) break;
          from += batchSize;
        }
        setCustomersData(map);
        console.log('[CustomersData] Loaded', map.size, 'entries in', Math.ceil(from / batchSize) + 1, 'batches');

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

  // Fetch user's personal tags for filter dropdown
  useEffect(() => {
    if (!realProfile?.id) return;
    ContractTagService.getAllUserTags(realProfile.id)
      .then(setAllUserTags)
      .catch(() => {});
  }, [realProfile?.id]);

  // When tag filter changes, fetch matching contract IDs
  useEffect(() => {
    if (tagFilter === 'All') {
      setTagFilterIds(undefined);
      return;
    }
    if (!realProfile?.id) return;
    ContractTagService.getContractIdsByTag(realProfile.id, tagFilter)
      .then(ids => setTagFilterIds(ids.length > 0 ? ids : ['__no_match__']))
      .catch(() => setTagFilterIds(undefined));
  }, [tagFilter, realProfile?.id]);

  // Compute effective unit ID for fetching
  const effectiveUnitId = useMemo(() => {
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

  // Ref to track salesperson for fetch callback (avoids stale closure)
  const salespersonRef = useRef(salespersonFilter);
  useEffect(() => { salespersonRef.current = salespersonFilter; }, [salespersonFilter]);

  // Reset salesperson filter when unit changes (prevent cross-unit empty results)
  const isFirstUnitRender = useRef(true);
  useEffect(() => {
    if (isFirstUnitRender.current) {
      isFirstUnitRender.current = false;
      return; // Don't reset on initial mount
    }
    // Update ref SYNCHRONOUSLY before setState to beat the fetch race
    salespersonRef.current = 'All';
    setSalespersonFilter('All');
  }, [effectiveUnitId]);

  // Fetch unique salesperson IDs from contracts (depends on unit & date range)
  // Also scan employee_allocations JSONB to include support employees
  useEffect(() => {
    const fetchSalespersonIds = async () => {
      try {
        const { dataClient } = await import('../lib/dataClient');
        let query = dataClient.from('contracts').select('employee_id, employee_allocations, unit_id, unit_allocations');
        const isSingleUnit = effectiveUnitId && effectiveUnitId !== 'all' && effectiveUnitId !== 'All' && !effectiveUnitId.includes(',');
        if (effectiveUnitId && effectiveUnitId !== 'all' && effectiveUnitId !== 'All') {
          if (effectiveUnitId.includes(',')) {
            query = query.in('unit_id', effectiveUnitId.split(',').map(id => id.trim()));
          }
          // Single unit: no SQL filter — will filter in JS for allocation-aware matching
        }
        if (dateFrom || dateTo) {
          if (dateFrom) query = query.gte('signed_date', dateFrom);
          if (dateTo) query = query.lte('signed_date', dateTo);
        }
        const { data } = await query;
        // For single unit: only include contracts where this unit has allocation share
        const filtered = isSingleUnit
          ? (data || []).filter((c: any) => {
              // Lead unit
              if (c.unit_id === effectiveUnitId) return true;
              // Support unit via unit_allocations
              const allocs: any[] = c.unit_allocations?.allocations || [];
              return allocs.some((a: any) => a.unitId === effectiveUnitId && (a.percent || 0) > 0);
            })
          : (data || []);
        const ids = new Set<string>();
        filtered.forEach((c: any) => {
          // Primary employee
          if (c.employee_id) ids.add(c.employee_id);
          // Employees from employee_allocations
          const empAllocs: any[] = c.employee_allocations || [];
          empAllocs.forEach((a: any) => {
            if (a.employeeId) ids.add(a.employeeId);
          });
          // Support unit employees from unit_allocations (hợp đồng phối hợp)
          const unitAllocs: any[] = c.unit_allocations?.allocations || [];
          unitAllocs.forEach((a: any) => {
            if (a.role === 'support' && a.employeeId) ids.add(a.employeeId);
          });
        });
        setContractSalespersonIds(ids);
      } catch (e) {
        console.error("Fetch salesperson IDs failed", e);
      }
    };
    fetchSalespersonIds();
  }, [effectiveUnitId, dateFrom, dateTo]);

  // Compute matching customer IDs when search matches customer names or short names
  const matchingCustomerIds = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.trim().length === 0) return undefined;
    const term = removeDiacritics(debouncedSearch.toLowerCase().trim());
    const ids: string[] = [];
    customersData.forEach((data, customerId) => {
      if (
        removeDiacritics(data.name.toLowerCase()).includes(term) ||
        removeDiacritics(data.shortName.toLowerCase()).includes(term)
      ) {
        ids.push(customerId);
      }
    });
    return ids.length > 0 ? ids : undefined;
  }, [debouncedSearch, customersData]);

  // Infinite scroll fetch function
  const fetchContractPage = useCallback(async (page: number) => {
    // Compute dates fresh from period+year to avoid stale closure issues
    const computedDates = computeDatesFromPeriodYear(periodFilter, yearFilter);
    
    // Read salesperson from ref (updated synchronously before resetDeps fires)
    const currentSalesperson = salespersonRef.current;
    
    const params = {
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch,
      status: statusFilter,
      unitId: effectiveUnitId,
      year: 'All', // dates are always computed — no year fallback needed
      dateFrom: computedDates.from || undefined,
      dateTo: computedDates.to || undefined,
      salespersonId: currentSalesperson !== 'All' ? currentSalesperson : undefined,
      classification: classificationFilter !== 'All' ? classificationFilter : undefined,
      sortBy: sortBy || undefined,
      sortDir: sortBy ? sortDir : undefined,
      matchingCustomerIds,
      filterByIds: tagFilterIds
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
  }, [debouncedSearch, statusFilter, effectiveUnitId, periodFilter, yearFilter, classificationFilter, sortBy, sortDir, matchingCustomerIds, tagFilterIds]);

  const {
    items: contracts,
    isLoading: loading,
    isLoadingMore,
    hasMore,
    totalCount,
    sentinelRef,
    reset: resetInfiniteScroll,
    silentRefresh,
    setItems: setContracts
  } = useInfiniteScroll<Contract>({
    fetchFn: fetchContractPage,
    pageSize: PAGE_SIZE,
    resetDeps: [debouncedSearch, statusFilter, salespersonFilter, classificationFilter, effectiveUnitId, periodFilter, yearFilter, sortBy, sortDir, matchingCustomerIds, tagFilterIds]
  });

  // Fetch tags for current page of contracts (for inline display)
  const refetchTags = useCallback(() => {
    if (contracts.length === 0 || !realProfile?.id) return;
    const ids = contracts.map(c => c.id);
    ContractTagService.getTagsForContracts(realProfile.id, ids)
      .then(setContractTagsMap)
      .catch(() => {});
    // Also refresh the allUserTags for the # search dropdown
    ContractTagService.getAllUserTags(realProfile.id)
      .then(setAllUserTags)
      .catch(() => {});
  }, [contracts, realProfile?.id]);

  useEffect(() => { refetchTags(); }, [refetchTags]);

  // Listen for tag changes from ContractDetail
  useEffect(() => {
    const handler = () => refetchTags();
    window.addEventListener('contract-tags-changed', handler);
    return () => window.removeEventListener('contract-tags-changed', handler);
  }, [refetchTags]);

  // Auto-refresh list when contracts are created, updated, or deleted
  useEffect(() => {
    const handleLocalRefresh = () => {
      console.log('[ContractList] local contract event, resetting list...');
      resetInfiniteScroll();
    };
    const handleRealtimeRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // Realtime events from other tabs: silent refresh (preserve scroll/filters)
      if (detail?.source === 'realtime') {
        console.log('[ContractList] realtime event, silent refreshing...');
        silentRefresh();
        return;
      }
      // Local events (same tab): full reset for immediate feedback
      handleLocalRefresh();
    };
    window.addEventListener('contract-created', handleRealtimeRefresh);
    window.addEventListener('contract-updated', handleRealtimeRefresh);
    window.addEventListener('contract-deleted', handleRealtimeRefresh);
    window.addEventListener('payment-changed', handleRealtimeRefresh);
    return () => {
      window.removeEventListener('contract-created', handleRealtimeRefresh);
      window.removeEventListener('contract-updated', handleRealtimeRefresh);
      window.removeEventListener('contract-deleted', handleRealtimeRefresh);
      window.removeEventListener('payment-changed', handleRealtimeRefresh);
    };
  }, [resetInfiniteScroll, silentRefresh]);

  // Tự động sinh danh sách 5 năm gần nhất
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (currentYear + 1 - i).toString());
  }, []);

  const formatCompactNumber = (number: number) => {
    return new Intl.NumberFormat('vi-VN', { notation: "compact", maximumFractionDigits: 1 }).format(number);
  };

  // ── Warning filter: đếm số cảnh báo từ loaded contracts ──
  const warningCounts = useMemo(() => {
    let overdueAdvance = 0, overduePayment = 0, acceptedNoInvoice = 0;
    contracts.forEach(c => {
      if (c.warnings?.isOverdueAdvance) overdueAdvance++;
      if (c.warnings?.isOverduePayment) overduePayment++;
      if (c.warnings?.isAcceptedNoInvoice) acceptedNoInvoice++;
    });
    return { overdueAdvance, overduePayment, acceptedNoInvoice };
  }, [contracts]);

  const hasAnyWarning = warningCounts.overdueAdvance > 0 || warningCounts.overduePayment > 0 || warningCounts.acceptedNoInvoice > 0;

  const displayContracts = useMemo(() => {
    if (warningFilter === 'none') return contracts;
    return contracts.filter(c => {
      if (warningFilter === 'overdueAdvance') return c.warnings?.isOverdueAdvance;
      if (warningFilter === 'overduePayment') return c.warnings?.isOverduePayment;
      if (warningFilter === 'acceptedNoInvoice') return c.warnings?.isAcceptedNoInvoice;
      return true;
    });
  }, [contracts, warningFilter]);


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
              {GLOBAL_VIEW_ROLES.includes(impersonatedUser.role as any)
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
            onClick={handleExportExcel}
            disabled={isExporting}
            title="Xuất danh sách hợp đồng ra Excel"
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm text-sm cursor-pointer"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Xuất Excel
          </button>
          {canCreate && (
            <button
              onClick={onAdd}
              title="Thêm hợp đồng mới (Alt+N)"
              className="flex items-center justify-center gap-2 bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-800 transition-all shadow-xl shadow-indigo-100 dark:shadow-none text-sm cursor-pointer"
            >
              <Plus size={16} /> Thêm mới
            </button>
          )}
          {/* Stats toggle — compact pill in header */}
          <button
            onClick={() => {
              const next = !statsCollapsed;
              setStatsCollapsed(next);
              try { localStorage.setItem('cic-erp-stats-collapsed', String(next)); } catch {}
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-lg bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
          >
            {statsCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            {statsCollapsed ? 'Hiện thống kê' : 'Ẩn thống kê'}
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE STATS SECTION */}
      <ContractListStats
        metrics={metrics}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        statsCollapsed={statsCollapsed}
      />

      <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md flex flex-wrap gap-3 items-center">
        {/* Search + Tag suggestions */}
        <div className="flex-1 min-w-[240px] relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm mã HĐ, tên KH, nội dung... hoặc gõ # để lọc theo tag"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-10 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-900 dark:text-slate-100"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer"
              title="Xoá tìm kiếm"
            >
              <X size={16} />
            </button>
          )}

          {/* Tag suggestions dropdown — shows when input starts with # */}
          {searchTerm.startsWith('#') && allUserTags.length > 0 && (() => {
            const query = searchTerm.slice(1).toLowerCase();
            const filtered = allUserTags.filter(t => !query || t.includes(query));
            if (filtered.length === 0) return null;
            return (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1 max-h-[200px] overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Lọc theo tag cá nhân</div>
                {filtered.map(tag => (
                  <button
                    key={tag}
                    onClick={() => { setTagFilter(tag); setSearchTerm(''); }}
                    className={`w-full text-left px-3 py-2 text-sm font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                      tagFilter === tag
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Hash size={14} className="opacity-50" />
                    {tag}
                    {tagFilter === tag && <Check size={14} className="ml-auto text-indigo-500" />}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Active tag filter badge — shown inline when filtering by tag */}
        {tagFilter !== 'All' && (
          <div className="flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700 rounded-lg px-3 py-2">
            <Hash size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-black text-indigo-700 dark:text-indigo-400">{tagFilter}</span>
            <button
              onClick={() => setTagFilter('All')}
              className="p-0.5 text-indigo-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
              title="Xóa bộ lọc tag"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Classification Filter */}
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-4 border border-slate-200 dark:border-slate-800">
          <Filter size={18} className="text-slate-500" />
          <select
            className="bg-transparent py-3 text-sm font-black text-slate-900 dark:text-slate-100 outline-none max-w-[180px]"
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value as ContractClassification | 'All')}
          >
            <option value="All">Tất cả phân loại</option>
            <option value="Thông thường">Thông thường</option>
            <option value="Bán qua đại lý">Bán qua đại lý</option>
            <option value="Khách bị LC">Khách bị LC</option>
            <option value="Hỗ trợ đối tác">Hỗ trợ đối tác</option>
            <option value="Khác">Khác</option>
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

        {/* Date Range — luôn hiện */}
        <DateInput
          value={dateFrom}
          onChange={(v) => { setDateFrom(v); if (v) { setPeriodFilter(''); setYearFilter('All'); } }}
          placeholder="Từ ngày"
          className="w-[120px] px-2.5 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <span className="text-slate-400 text-xs">→</span>
        <DateInput
          value={dateTo}
          onChange={(v) => { setDateTo(v); if (v) { setPeriodFilter(''); setYearFilter('All'); } }}
          placeholder="Đến ngày"
          className="w-[120px] px-2.5 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); setPeriodFilter(''); setYearFilter(String(new Date().getFullYear())); }}
            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
            title="Xóa bộ lọc ngày"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* WARNING FILTER CHIPS */}
      <ContractListWarningChips
        warningCounts={warningCounts}
        warningFilter={warningFilter}
        setWarningFilter={setWarningFilter}
      />

      {/* TABLE (Desktop) */}
      <div className={`hidden md:block bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg transition-colors overflow-x-auto overflow-y-auto max-h-[calc(100vh-200px)] ${isResizing ? 'select-none' : ''}`}>
        <table className="text-left" style={{ tableLayout: 'fixed', width: Object.values(columnWidths).reduce((a, b) => a + b, 0), minWidth: '100%' }}>
          {/* Colgroup: dynamic widths from useColumnResize */}
          <colgroup>
            {CONTRACT_TABLE_COLUMNS.map(c => (
              <col key={c.key} style={{ width: columnWidths[c.key] }} />
            ))}
          </colgroup>
          <thead>
            <tr className="z-20">
              {TABLE_HEADERS.map((col, idx) => (
                <th
                  key={idx}
                  className={`sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 px-1.5 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 relative group/th
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
                  {/* Drag handle for column resize */}
                  {idx < 10 && (
                    <div
                      className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-30 group/handle flex items-center justify-center"
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
          <tbody className="bg-white dark:bg-slate-900">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={`border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${i % 2 !== 0 ? 'bg-slate-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-900'}`}>
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
            ) : displayContracts.map((contract, index) => (
              <ContractListTableRow
                key={contract.id}
                contract={contract}
                index={index}
                onSelectContract={onSelectContract}
                units={units}
                salespeople={salespeople}
                customersData={customersData}
                contractTagsMap={contractTagsMap}
                invoiceMap={invoiceMap}
                statusDropdownId={statusDropdownId}
                setStatusDropdownId={setStatusDropdownId}
                statusDropdownRef={statusDropdownRef}
                changingStatusId={changingStatusId}
                handleQuickStatusChange={handleQuickStatusChange}
                onClone={onClone}
                isGlobalScope={isGlobalScope}
                profile={profile}
              />
            ))}
          </tbody>
        </table>

        {/* DESKTOP INFINITE SCROLL SENTINEL */}
        {!isMobile && (
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
        )}
      </div>

      {/* MOBILE CARDS */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-lg p-4 shadow-sm border border-slate-200 dark:border-slate-800 animate-pulse h-[200px]"></div>
          ))
        ) : contracts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-lg p-8 text-center text-slate-500 border border-slate-200 dark:border-slate-800 shadow-sm">
            Không tìm thấy hợp đồng nào
          </div>
        ) : (
          displayContracts.map((contract, index) => (
            <ContractListMobileCard
              key={contract.id}
              contract={contract}
              index={index}
              onSelectContract={onSelectContract}
              units={units}
              salespeople={salespeople}
              customersData={customersData}
              contractTagsMap={contractTagsMap}
              invoiceMap={invoiceMap}
              statusDropdownId={statusDropdownId}
              setStatusDropdownId={setStatusDropdownId}
              statusDropdownRef={statusDropdownRef}
              changingStatusId={changingStatusId}
              handleQuickStatusChange={handleQuickStatusChange}
              onClone={onClone}
              isGlobalScope={isGlobalScope}
              profile={profile}
            />
          ))
        )}
        
      </div>

      {/* MOBILE INFINITE SCROLL SENTINEL */}
      {isMobile && (
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
      )}

      {/* STATUS BAR */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
            Hiển thị {displayContracts.length}{warningFilter !== 'none' ? ` (lọc từ ${contracts.length})` : ''} / {totalCount} kết quả
          </div>
          <button
            onClick={resetWidths}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            title="Đặt lại kích thước cột mặc định"
          >
            <RotateCcw size={13} /> Reset cột
          </button>
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
      {/* Date Prompt Dialog (Handover / Suspended) */}
      <DatePromptDialog
        isOpen={!!datePromptPending}
        onClose={() => setDatePromptPending(null)}
        title={datePromptPending?.title || ''}
        colorScheme={datePromptPending?.colorScheme || 'cyan'}
        onConfirm={async (isoDate) => {
          const { contractId, newStatus, dateField } = datePromptPending!;
          setDatePromptPending(null);
          setChangingStatusId(contractId);
          const updateData: Record<string, any> = { status: newStatus, [dateField]: isoDate };
          try {
            await ContractService.update(contractId, updateData as any);
            setContracts(prev => prev.map(c => c.id === contractId ? { ...c, ...updateData } as any : c));
            toast.success(`Đã chuyển trạng thái → ${CONTRACT_STATUS_LABELS[newStatus]}`);
          } catch (err: any) {
            toast.error('Lỗi cập nhật trạng thái: ' + (err.message || err));
          } finally {
            setChangingStatusId(null);
          }
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
