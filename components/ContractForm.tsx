import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  X, Save, Plus, Users, Hash, ArrowLeft, ArrowRight, Loader2
} from 'lucide-react';
import {
  ContractType, ContractClassification, LineItem, UnitAllocation, EmployeeAllocation,
  ContractContact, PaymentSchedule,
  RevenueSchedule, AdministrativeCosts,
  Contract, ExecutionCostItem,
  ContractWorkflowSteps, DEFAULT_WORKFLOW_STEPS
} from '../types';
import { RESERVE_FUND_COST_ID, RESERVE_FUND_COST_NAME, RESERVE_FUND_COST_PERCENTAGE } from '../constants';
import { UnitService, CustomerService, ProductService, ContractService, EmployeeService, ExecutionCostService, ExecutionCostType } from '../services';
import { summarizeContractContent } from '../services/ai';
import QuickAddCustomerDialog from './ui/QuickAddCustomerDialog';
import QuickAddProductDialog from './ui/QuickAddProductDialog';
import QuickAddSupplierDialog from './ui/QuickAddSupplierDialog';

// Contract Form Sub-components
import { useAuth } from '../contexts/AuthContext';
import { useFinancialCalculations } from '../hooks/useFinancialCalculations';
import { recalculateAutoCostsForList } from '../hooks/useLineItems';
import {
  StepIndicator,
  FinancialSummary,
  ContractFormStep1,
  ContractFormStep2,
  ContractFormStep3,
  ContractFormStep4,
  DirectCostModal,
  formatVND as formatVNDUtil,
} from './contract-form';

import type { Unit, Employee, Customer, Product } from '../types';

interface ContractFormProps {
  contract?: Contract;
  isCloning?: boolean;
  onSave: (contract: any) => void;
  onCancel: () => void;
  /** Called when form dirty state changes (true = has unsaved modifications) */
  onDirtyChange?: (isDirty: boolean) => void;
  /** When true, form fills the panel without its own border/shadow/close button */
  isInsidePanel?: boolean;
}

const ContractForm: React.FC<ContractFormProps> = ({ contract, isCloning = false, onSave, onCancel, onDirtyChange, isInsidePanel = false }) => {
  const { profile } = useAuth();
  const isEditing = !!contract && !isCloning;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==================== DATA OPTIONS ====================
  const [units, setUnits] = useState<Unit[]>([]);
  const [salespeople, setSalespeople] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Customer[]>([]);
  const [executionCostTypes, setExecutionCostTypes] = useState<ExecutionCostType[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [unitsData, peopleData, productsData, suppliersRes, executionCostTypesRes] = await Promise.all([
          UnitService.getAll(),
          EmployeeService.getAll(),
          ProductService.getAll(),
          CustomerService.getAll({ pageSize: 200 }),
          ExecutionCostService.getAll()
        ]);
        setUnits(unitsData);
        setSalespeople(peopleData);
        setProducts(productsData);
        setSuppliers(suppliersRes.data?.filter(c => c.type === 'Supplier' || c.type === 'Both') || []);
        setExecutionCostTypes(executionCostTypesRes);

        if (!isEditing && !unitId && unitsData.length > 0) {
          const operationalUnits = unitsData.filter(u => u.id !== 'all' && u.type !== 'Company' && u.type !== 'BackOffice');
          if (profile?.unitId) {
            // Nếu profile.unitId là operational unit thì dùng, nếu không thì fallback
            const profileUnit = unitsData.find(u => u.id === profile.unitId);
            const isOperational = profileUnit && profileUnit.id !== 'all' && profileUnit.type !== 'Company' && profileUnit.type !== 'BackOffice';
            if (isOperational) {
              setUnitId(profile.unitId);
            } else if (operationalUnits.length > 0) {
              setUnitId(operationalUnits[0].id);
            }
          } else {
            if (operationalUnits.length > 0) setUnitId(operationalUnits[0].id);
          }
          // Khởi tạo employeeAllocations: nếu profile match employee thì set luôn, nếu không thì tạo row rỗng
          if (profile?.id) {
            const isEmployee = peopleData.some(p => p.id === profile.id);
            if (isEmployee) {
              setSalespersonId(profile.id);
              setEmployeeAllocations([{ employeeId: profile.id, percent: 100, role: 'lead' }]);
            } else {
              // Admin/Leadership: tạo row rỗng để dropdown hiện danh sách
              setEmployeeAllocations([{ employeeId: '', percent: 100, role: 'lead' }]);
            }
          } else {
            setEmployeeAllocations([{ employeeId: '', percent: 100, role: 'lead' }]);
          }
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchOptions();
  }, []);

  // ==================== STEP 1: IDENTIFICATION ====================
  const [contractType, setContractType] = useState<ContractType>(contract?.contractType || 'HĐ');
  const [unitId, setUnitId] = useState(contract?.unitId || '');
  const [coordinatingUnitId, setCoordinatingUnitId] = useState(contract?.coordinatingUnitId || '');
  const [unitAllocations, setUnitAllocations] = useState<UnitAllocation[]>(contract?.unitAllocations || []);
  const [salespersonId, setSalespersonId] = useState(contract?.salespersonId || '');
  const [employeeAllocations, setEmployeeAllocations] = useState<EmployeeAllocation[]>(
    contract?.employeeAllocations || []
  );
  const [customerId, setCustomerId] = useState(contract?.customerId || null);
  const [title, setTitle] = useState(contract?.title || '');
  const [clientName, setClientName] = useState(contract?.partyA || '');
  const [classification, setClassification] = useState<ContractClassification>(contract?.classification || (contract?.isDealerSale ? 'Bán qua đại lý' : 'Thông thường'));
  const isDealerSale = classification === 'Bán qua đại lý';
  const [endUserId, setEndUserId] = useState<string | null>(contract?.endUserId || null);
  const [endUserName, setEndUserName] = useState(contract?.endUserName || '');
  const [endUser2Id, setEndUser2Id] = useState<string | null>(contract?.endUser2Id || null);
  const [endUser2Name, setEndUser2Name] = useState(contract?.endUser2Name || '');
  const [showAddEndUserDialog, setShowAddEndUserDialog] = useState(false);
  const [showAddEndUser2Dialog, setShowAddEndUser2Dialog] = useState(false);
  const [signedDate, setSignedDate] = useState(contract?.signedDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(contract?.endDate || '');
  const [hasVat, setHasVat] = useState(contract?.hasVat !== false);
  const [vatRate, setVatRate] = useState(contract?.vatRate ?? 0);

  // ==================== CONTRACT SYNC (Edit/Clone Mode) ====================
  const syncedContractIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (contract) {
      const syncKey = isCloning ? `${contract.id}_clone` : contract.id;
      if (syncedContractIdRef.current === syncKey) return;
      syncedContractIdRef.current = syncKey;

      setContractType(contract.contractType || 'HĐ');
      setUnitId(contract.unitId || '');
      setCoordinatingUnitId(contract.coordinatingUnitId || '');
      setSalespersonId(contract.salespersonId || '');
      if (contract.employeeAllocations && contract.employeeAllocations.length > 0) {
        setEmployeeAllocations(contract.employeeAllocations);
      } else if (contract.salespersonId) {
        setEmployeeAllocations([{ employeeId: contract.salespersonId, percent: 100, role: 'lead' }]);
      }
      setCustomerId(contract.customerId || null);
      setTitle(contract.title || '');
      setClientName(contract.partyA || '');
      setClassification(contract.classification || (contract.isDealerSale ? 'Bán qua đại lý' : 'Thông thường'));
      setEndUserId(contract.endUserId || null);
      setEndUserName(contract.endUserName || '');
      setEndUser2Id(contract.endUser2Id || null);
      setEndUser2Name(contract.endUser2Name || '');
      setSignedDate(contract.signedDate || new Date().toISOString().split('T')[0]);
      setEndDate(contract.endDate || '');
      setHasVat(contract.hasVat !== false);
      setVatRate(contract.vatRate ?? 0);
      // Sync customer contract number
      setHasCustomerContractNumber(!!contract.customerContractNumber);
      setCustomerContractNumber(contract.customerContractNumber || '');
      setPaymentTermDays(contract.paymentTermDays);
      setNotes(contract.notes || '');
      if (contract.contacts && contract.contacts.length > 0) setContacts(contract.contacts);
      if (contract.lineItems && contract.lineItems.length > 0) {
        const contractVat = contract.vatRate ?? 0;
        setLineItems(contract.lineItems.map(item => ({
          ...item,
          vatRate: item.vatRate ?? contractVat,
          inputPriceFormula: item.inputPriceFormula || (item.inputPrice ? String(item.inputPrice) : undefined),
          outputPriceFormula: item.outputPriceFormula || (item.outputPrice ? String(item.outputPrice) : undefined),
        })));
      }
      setSelectedTaskTemplateId(contract.selectedTaskTemplateId || null);
      setCustomTasks(contract.customTasks || []);
      if (contract.workflowSteps) setWorkflowSteps(contract.workflowSteps);

      // When cloning: reset ID to empty so generateId can auto-create a new one
      if (isCloning) {
        setFormContractId('');
        setIsIdTouched(false);
      }
    }
  }, [contract]);

  // Fetch customer name on edit
  useEffect(() => {
    if (isEditing && contract?.customerId && !clientName) {
      CustomerService.getById(contract.customerId).then(cust => {
        if (cust) setClientName(cust.name);
      }).catch(err => console.error('Failed to fetch customer:', err));
    }
    if (isEditing && contract?.endUserId && !endUserName) {
      CustomerService.getById(contract.endUserId).then(cust => {
        if (cust) setEndUserName(cust.name);
      }).catch(err => console.error('Failed to fetch end user:', err));
    }
    if (isEditing && contract?.endUser2Id && !endUser2Name) {
      CustomerService.getById(contract.endUser2Id).then(cust => {
        if (cust) setEndUser2Name(cust.name);
      }).catch(err => console.error('Failed to fetch end user 2:', err));
    }
  }, [isEditing, contract?.customerId, contract?.endUserId, contract?.endUser2Id]);

  // ==================== QUICK ADD DIALOGS ====================
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [addProductForIndex, setAddProductForIndex] = useState<number | null>(null);
  const [showAddSupplierDialog, setShowAddSupplierDialog] = useState(false);
  const [addSupplierForIndex, setAddSupplierForIndex] = useState<number | null>(null);

  // ==================== STEP 2: LINE ITEMS & COSTS ====================
  const [contacts, setContacts] = useState<ContractContact[]>(contract?.contacts || [{ id: '1', name: '', role: 'Mua sắm' }]);
  const [lineItems, setLineItems] = useState<LineItem[]>(contract?.lineItems || [{
    id: '1', name: '', quantity: 1, supplier: '', inputPrice: 0, outputPrice: 0, directCosts: 0, vatRate: 0
  }]);

  const updateLineItemsAndRecalculate = useCallback((newItems: LineItem[]) => {
    setLineItems(recalculateAutoCostsForList(newItems));
  }, []);

  const [executionCosts, setExecutionCosts] = useState<ExecutionCostItem[]>(contract?.executionCosts || []);

  // Execution cost handlers
  const addExecutionCost = () => {
    setExecutionCosts(prev => [...prev, { id: `exec-${Date.now()}`, name: '', amount: 0 }]);
  };
  const removeExecutionCost = (id: string) => {
    if (id === RESERVE_FUND_COST_ID) return;
    setExecutionCosts(prev => prev.filter(c => c.id !== id));
  };
  const updateExecutionCost = (id: string, field: keyof ExecutionCostItem, value: any) => {
    if (id === RESERVE_FUND_COST_ID) return;
    setExecutionCosts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // Direct Cost Modal State
  const [activeCostModalIndex, setActiveCostModalIndex] = useState<number | null>(null);
  const [tempCostDetails, setTempCostDetails] = useState<import('../types').DirectCostDetail[]>([]);

  const openCostModal = (index: number) => {
    setActiveCostModalIndex(index);
    setTempCostDetails(lineItems[index].directCostDetails || []);
  };
  const saveCostModal = () => {
    if (activeCostModalIndex === null) return;
    const newList = [...lineItems];
    const totalAmount = tempCostDetails.reduce((acc, item) => acc + item.amount, 0);
    newList[activeCostModalIndex].directCostDetails = tempCostDetails;
    newList[activeCostModalIndex].directCosts = totalAmount;
    setLineItems(recalculateAutoCostsForList(newList));
    setActiveCostModalIndex(null);
  };

  // ==================== STEP 3: SCHEDULES & NOTES ====================
  const [revenueSchedules, setRevenueSchedules] = useState<RevenueSchedule[]>(contract?.revenueSchedules || [{ id: '1', date: '', amount: 0, description: 'Đợt 1' }]);
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([{ id: '1', date: '', amount: 0, description: 'Tạm ứng', type: 'Revenue' }]);
  const [supplierSchedules, setSupplierSchedules] = useState<PaymentSchedule[]>([{ id: '1', date: '', amount: 0, description: 'Thanh toán đợt 1', type: 'Expense' }]);
  const [paymentTermDays, setPaymentTermDays] = useState<number | undefined>(contract?.paymentTermDays);
  const [notes, setNotes] = useState(contract?.notes || '');
  const [selectedTaskTemplateId, setSelectedTaskTemplateId] = useState<string | null>(contract?.selectedTaskTemplateId || null);
  const [customTasks, setCustomTasks] = useState<any[]>(contract?.customTasks || []);
  const [workflowSteps, setWorkflowSteps] = useState<ContractWorkflowSteps>(contract?.workflowSteps || { ...DEFAULT_WORKFLOW_STEPS });

  useEffect(() => {
    if (contract?.paymentPhases && Array.isArray(contract.paymentPhases)) {
      try {
        const revenue = contract.paymentPhases
          .filter(p => p && (!p.type || p.type === 'Revenue'))
          .map(p => ({ ...p, date: p.dueDate || '', description: p.name || '' })) as PaymentSchedule[];
        const expense = contract.paymentPhases
          .filter(p => p && p.type === 'Expense')
          .map(p => ({ ...p, date: p.dueDate || '', description: p.name || '' })) as PaymentSchedule[];
        if (revenue.length > 0) setPaymentSchedules(revenue);
        if (expense.length > 0) setSupplierSchedules(expense);
      } catch (error) {
        console.error("Error loading payment phases:", error);
      }
    }
  }, [contract]);

  // ==================== WIZARD ====================
  const [currentStep, setCurrentStep] = useState(1);

  const handleNext = () => {
    if (currentStep === 1) {
      if (!unitId || !salespersonId) {
        toast.error("Vui lòng chọn Đơn vị và Nhân viên phụ trách trước khi tiếp tục!");
        return;
      }
      if (!title && !customerId) {
        toast.warning("Lưu ý: Bạn chưa nhập thông tin Khách hàng hoặc Tiêu đề hợp đồng.");
      }
    }
    setCurrentStep(prev => prev + 1);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleBack = () => setCurrentStep(prev => prev - 1);

  // ==================== COMPUTED VALUES ====================
  const totals = useFinancialCalculations(lineItems, executionCosts);

  // Hợp đồng ký từ 2026 trở đi: tự động bổ sung "Quỹ dự phòng chi phí chờ quyết toán" = 0.5% Doanh thu
  useEffect(() => {
    const year = new Date(signedDate).getFullYear();
    if (!year || year < 2026) return;
    const expectedAmount = Math.round(totals.estimatedRevenue * 0.005);
    setExecutionCosts(prev => {
      const idx = prev.findIndex(c => c.id === RESERVE_FUND_COST_ID);
      if (idx === -1) {
        return [...prev, { id: RESERVE_FUND_COST_ID, name: RESERVE_FUND_COST_NAME, amount: expectedAmount, percentage: RESERVE_FUND_COST_PERCENTAGE }];
      }
      if (prev[idx].amount === expectedAmount && prev[idx].percentage === RESERVE_FUND_COST_PERCENTAGE) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], amount: expectedAmount, percentage: RESERVE_FUND_COST_PERCENTAGE };
      return next;
    });
  }, [signedDate, totals.estimatedRevenue]);
  const formatVND = (val: number) => new Intl.NumberFormat('vi-VN').format(Math.round(val));

  const filteredSales = useMemo(() => {
    if (!unitId) return salespeople;
    const filtered = salespeople.filter(s => s.unitId === unitId);
    if (salespersonId && !filtered.some(s => s.id === salespersonId)) {
      const currentSalesperson = salespeople.find(s => s.id === salespersonId);
      if (currentSalesperson) filtered.unshift(currentSalesperson);
    }
    return filtered;
  }, [salespeople, unitId, salespersonId]);

  // ==================== CONTRACT ID ====================
  // Parse initial STT from existing contract code (e.g. "HĐ_008/CSS_2026" → "008")
  const parseInitialStt = () => {
    const code = contract?.contractCode || contract?.id || '';
    const match = code.match(/^(?:HĐ|VV)_(\d+)\//); 
    return match ? match[1] : '';
  };
  const [formContractId, setFormContractId] = useState(isCloning ? '' : (contract?.contractCode || contract?.id || ''));
  const [contractNumberStt, setContractNumberStt] = useState(isCloning ? '' : parseInitialStt());
  const [isIdTouched, setIsIdTouched] = useState(isCloning ? false : !!(contract?.contractCode || contract?.id));
  const [hasCustomerContractNumber, setHasCustomerContractNumber] = useState(!!(contract as any)?.customerContractNumber);
  const [customerContractNumber, setCustomerContractNumber] = useState((contract as any)?.customerContractNumber || '');

  // Auto-fetch next STT when unit/year changes (only for new/clone contracts)
  useEffect(() => {
    const fetchStt = async () => {
      try {
        if (isEditing || !unitId) return;
        // Don't auto-fetch if user has manually touched STT
        if (isIdTouched) return;
        const year = new Date(signedDate).getFullYear();
        const nextNum = await ContractService.getNextContractNumber(unitId, year, true);
        const stt = nextNum.toString().padStart(3, '0');
        setContractNumberStt(stt);
      } catch (error) {
        console.error("Error fetching next STT:", error);
      }
    };
    const timer = setTimeout(fetchStt, 500);
    return () => clearTimeout(timer);
  }, [unitId, signedDate, units, isEditing, isIdTouched, contractType]);

  // Reassemble formContractId whenever segments change
  useEffect(() => {
    if (!unitId || !contractNumberStt) return;
    const unit = units.find(u => u.id === unitId);
    const unitCode = unit?.code || 'UNIT';
    const year = new Date(signedDate).getFullYear();
    const suffix = contractType === 'VV' ? `${unitCode}_${year}` : `${unitCode}_CIC_${year}`;
    const newId = `${contractType}_${contractNumberStt}/${suffix}`;
    setFormContractId(newId);
  }, [contractType, contractNumberStt, unitId, signedDate, units]);

  // Duplicate contract number check (debounced)
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  useEffect(() => {
    if (!formContractId || isEditing) {
      setDuplicateWarning(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const exists = await ContractService.exists(formContractId);
        setDuplicateWarning(exists);
      } catch {
        setDuplicateWarning(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [formContractId, isEditing]);

  // ==================== AUTO-SAVE DRAFT ====================
  useEffect(() => {
    if (isEditing) return;
    const timer = setTimeout(() => {
      const draft = {
        contractType, unitId, coordinatingUnitId, salespersonId, customerId, title, clientName,
        signedDate, endDate, contacts, lineItems, revenueSchedules, paymentSchedules, supplierSchedules,
        selectedTaskTemplateId, customTasks,
      };
      if (title || clientName || lineItems.length > 0) {
        localStorage.setItem('contract_form_draft', JSON.stringify(draft));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    isEditing, contractType, unitId, coordinatingUnitId, salespersonId, customerId, title, clientName,
    signedDate, endDate, contacts, lineItems, revenueSchedules, paymentSchedules, supplierSchedules,
    selectedTaskTemplateId, customTasks,
  ]);

  // ==================== DIRTY STATE TRACKING ====================
  const initialSnapshotRef = useRef<string | null>(null);
  const wasDirtyRef = useRef(false);

  // Key fields that constitute "user data"
  const currentSnapshot = useMemo(() => JSON.stringify({
    contractType, unitId, coordinatingUnitId, salespersonId, customerId,
    title, clientName, signedDate, endDate, hasVat, vatRate, classification,
    endUserId, endUserName, endUser2Id, endUser2Name, contacts, lineItems, executionCosts,
    revenueSchedules, paymentSchedules, supplierSchedules,
    employeeAllocations, unitAllocations, formContractId,
    customerContractNumber, hasCustomerContractNumber, notes,
    selectedTaskTemplateId, customTasks,
  }), [
    contractType, unitId, coordinatingUnitId, salespersonId, customerId,
    title, clientName, signedDate, endDate, hasVat, vatRate, classification,
    endUserId, endUserName, endUser2Id, endUser2Name, contacts, lineItems, executionCosts,
    revenueSchedules, paymentSchedules, supplierSchedules,
    employeeAllocations, unitAllocations, formContractId,
    customerContractNumber, hasCustomerContractNumber, notes,
    selectedTaskTemplateId, customTasks,
  ]);

  // Capture initial snapshot after first render (delay to let sync effects settle)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialSnapshotRef.current === null) {
        initialSnapshotRef.current = currentSnapshot;
      }
    }, 800);
    return () => clearTimeout(timer);
  }, []); // only once

  // Compare and notify dirty state
  useEffect(() => {
    if (!onDirtyChange || initialSnapshotRef.current === null) return;
    const isDirty = currentSnapshot !== initialSnapshotRef.current;
    if (isDirty !== wasDirtyRef.current) {
      wasDirtyRef.current = isDirty;
      onDirtyChange(isDirty);
    }
  }, [currentSnapshot, onDirtyChange]);

  // Restore Draft
  useEffect(() => {
    if (!isEditing && !isCloning) {
      const saved = localStorage.getItem('contract_form_draft');
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          if (draft.title || draft.clientName) {
            toast("Tìm thấy bản nháp chưa lưu!", {
              description: "Bạn có muốn khôi phục dữ liệu đang nhập dở không?",
              action: {
                label: "Khôi phục",
                onClick: () => {
                  if (draft.contractType) setContractType(draft.contractType);
                  if (draft.unitId) setUnitId(draft.unitId);
                  if (draft.coordinatingUnitId) setCoordinatingUnitId(draft.coordinatingUnitId);
                  if (draft.salespersonId) setSalespersonId(draft.salespersonId);
                  if (draft.customerId) setCustomerId(draft.customerId);
                  if (draft.title) setTitle(draft.title);
                  if (draft.clientName) setClientName(draft.clientName);
                  if (draft.signedDate) setSignedDate(draft.signedDate);
                  if (draft.endDate) setEndDate(draft.endDate);
                  if (draft.contacts) setContacts(draft.contacts);
                  if (draft.lineItems) setLineItems(draft.lineItems);
                  if (draft.revenueSchedules) setRevenueSchedules(draft.revenueSchedules);
                  if (draft.paymentSchedules) setPaymentSchedules(draft.paymentSchedules);
                  if (draft.supplierSchedules) setSupplierSchedules(draft.supplierSchedules);
                  if (draft.selectedTaskTemplateId) setSelectedTaskTemplateId(draft.selectedTaskTemplateId);
                  if (draft.customTasks) setCustomTasks(draft.customTasks);

                  toast.success("Đã khôi phục bản nháp!");
                }
              }
            });
          }
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      }
    }
  }, []);

  // ==================== SUPPLIER SCHEDULE AUTO-GENERATE ====================
  const generateSupplierSchedules = () => {
    const supplierGroups: { [key: string]: number } = {};
    lineItems.forEach(item => {
      if (item.supplier) {
        const cost = item.quantity * item.inputPrice;
        supplierGroups[item.supplier] = (supplierGroups[item.supplier] || 0) + cost;
      }
    });
    const newSchedules: PaymentSchedule[] = Object.keys(supplierGroups).map((supplierName, index) => {
      const existing = supplierSchedules.find(s => s.description.includes(supplierName));
      return {
        id: existing?.id || `sup-${Date.now()}-${index}`,
        date: existing?.date || '',
        amount: supplierGroups[supplierName],
        description: `Thanh toán cho ${supplierName}`,
        status: 'Pending',
        percentage: 0,
        type: 'Expense'
      };
    });
    if (newSchedules.length > 0) {
      setSupplierSchedules(newSchedules);
      toast.info("Đã cập nhật lịch thanh toán cho Nhà cung cấp");
    } else {
      toast.warning("Chưa có thông tin Nhà cung cấp trong mục chi tiết sản phẩm!");
    }
  };

  // ==================== HANDLERS ====================
  const addContact = () => setContacts([...contacts, { id: Date.now().toString(), name: '', role: '' }]);
  const removeContact = (id: string) => setContacts(contacts.filter(c => c.id !== id));
  const addLineItem = () => setLineItems([...lineItems, { id: Date.now().toString(), name: '', productId: undefined, productName: '', quantity: 1, supplier: '', manufacturer: '', manufacturerId: undefined, inputPrice: 0, outputPrice: 0, directCosts: 0, vatRate: 0 }]);
  const removeLineItem = (id: string) => setLineItems(recalculateAutoCostsForList(lineItems.filter(i => i.id !== id)));

  // AI Auto-Generate Title from line items
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const generateContractTitle = useCallback(async () => {
    const itemsWithContent = lineItems.filter(li => li.name || li.productName);
    if (itemsWithContent.length === 0) {
      toast.warning('Chưa có sản phẩm/dịch vụ nào để tóm tắt.');
      return;
    }
    setIsGeneratingTitle(true);
    try {
      const summary = await summarizeContractContent(itemsWithContent);
      if (summary) {
        setTitle(summary);
        toast.success('Đã tạo nội dung hợp đồng từ AI!');
      } else {
        toast.error('AI không thể tạo tóm tắt. Vui lòng kiểm tra API Key.');
      }
    } catch (err) {
      console.error('[AI Summary] Failed:', err);
      toast.error('Lỗi khi gọi AI. Vui lòng thử lại.');
    } finally {
      setIsGeneratingTitle(false);
    }
  }, [lineItems]);

  const handleSave = async () => {
    if (!unitId || !salespersonId || !clientName) {
      toast.error("Vui lòng nhập đầy đủ thông tin bắt buộc (Đơn vị, Sale, Khách hàng)");
      return;
    }
    if (isSubmitting) return;

    // Check duplicate contract number before saving
    if (!isEditing && formContractId) {
      try {
        setIsSubmitting(true);
        const exists = await ContractService.exists(formContractId);
        if (exists) {
          toast.error(`Số hiệu HĐ "${formContractId}" đã tồn tại! Vui lòng đổi STT.`);
          setDuplicateWarning(true);
          setIsSubmitting(false);
          return;
        }
      } catch (err) {
        console.error('Duplicate check failed:', err);
        setIsSubmitting(false);
        return;
      }
    } else {
      setIsSubmitting(true);
    }
    const payload = {
      id: isEditing ? contract?.id : undefined, // PK: preserved on edit, auto-set from contractCode on create
      contractCode: formContractId,
      title: title || 'Hợp đồng chưa đặt tên',
      contractType,
      partyA: clientName,
      partyB: 'CIC',
      clientInitials: clientName ? clientName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 5) : 'KH',
      customerId: customerId || null,
      isDealerSale,
      classification,
      hasVat,
      vatRate: hasVat ? vatRate : 0,
      endUserId: isDealerSale ? (endUserId || null) : null,
      endUserName: isDealerSale ? endUserName : null,
      endUser2Id: isDealerSale ? (endUser2Id || null) : null,
      endUser2Name: isDealerSale ? endUser2Name : null,
      unitId,
      coordinatingUnitId: coordinatingUnitId || null,
      unitAllocations: unitAllocations.length > 0 ? unitAllocations : null,
      salespersonId: salespersonId || (employeeAllocations.length > 0 ? employeeAllocations[0].employeeId : ''),
      employeeAllocations: employeeAllocations.length > 0 ? employeeAllocations : undefined,
      value: totals.signingValue,
      estimatedCost: totals.totalCosts,
      actualRevenue: isEditing ? (contract?.actualRevenue ?? 0) : 0,
      actualCost: totals.totalCosts,
      status: isEditing ? (contract?.status || 'Processing') : 'Processing',
      stage: isEditing ? (contract?.stage || 'Signed') : 'Signed',
      category: isEditing ? (contract?.category || 'Project') : 'Project',
      signedDate,
      startDate: isEditing ? (contract?.startDate || signedDate) : signedDate,
      endDate: endDate || null,
      content: title,
      contacts,
      milestones: isEditing ? (contract?.milestones || []) : [],
      paymentPhases: [...paymentSchedules, ...supplierSchedules].map(p => ({
        id: p.id, name: p.description || '', dueDate: p.date || '',
        amount: p.amount || 0, status: p.status || 'Pending',
        percentage: p.percentage || 0, type: p.type
      })),
      lineItems,
      executionCosts,
      revenueSchedules,
      customerContractNumber: customerContractNumber?.trim() || null,
      paymentTermDays: paymentTermDays || null,
      notes: notes?.trim() || null,
      workflowSteps,
      selectedTaskTemplateId,
      customTasks,
    };
    
    try {
      await onSave(payload);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== RENDER ====================
  // When inside a slide panel: no border, no shadow, no max-width, fill height
  const outerClasses = isInsidePanel
    ? 'bg-white dark:bg-slate-900 overflow-hidden flex flex-col h-full w-full'
    : 'bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-w-[1600px] w-full mx-auto flex flex-col h-[92vh]';

  return (
    <div className={outerClasses}>

      {/* HEADER + STEPPER (merged) */}
      <div className="pl-14 pr-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800">
        {/* Left: Title */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 dark:shadow-none">
            <Plus size={20} strokeWidth={3} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {isEditing ? 'Chỉnh sửa hợp đồng' : isCloning ? 'Nhân bản hợp đồng' : 'Khai báo hồ sơ hợp đồng'}
              </h2>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[9px] font-black rounded-md uppercase tracking-wider">
                <Hash size={9} /> {formContractId}
              </div>
            </div>
          </div>
        </div>

        {/* Center: Inline Step Indicator */}
        <div className="flex items-center gap-0 flex-1 max-w-md mx-auto">
          {[
            { label: 'Thông tin chung', num: 1 },
            { label: 'Kinh doanh & Chi phí', num: 2 },
            { label: 'Tài chính & Hoàn tất', num: 3 },
            { label: 'Giao việc', num: 4 },
          ].map((step, idx) => {
            const isActive = currentStep >= step.num;
            const isCurrent = currentStep === step.num;
            return (
              <React.Fragment key={step.num}>
                {idx > 0 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors duration-300 ${
                    currentStep > idx ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`} />
                )}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all duration-300
                    ${isActive
                      ? 'bg-indigo-600 border-indigo-300 dark:border-indigo-800 text-white'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                    }
                    ${isCurrent ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-800 scale-110' : ''}
                  `}>
                    {step.num}
                  </div>
                  <span className={`text-[8px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                    isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Right: Close button (only in overlay mode) */}
        {!isInsidePanel && (
          <div className="shrink-0">
            <button onClick={onCancel} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-slate-400 hover:text-rose-500 transition-all">
              <X size={20} />
            </button>
          </div>
        )}
      </div>

      {/* FINANCIAL SUMMARY */}
      {currentStep > 1 ? (
        <FinancialSummary totals={totals} formatVND={formatVND} />
      ) : null}

      {/* BODY */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 pb-6 pt-2 custom-scrollbar space-y-8 scroll-smooth">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="col-span-12 space-y-12">

            {/* Step 1: Đơn vị & Nhân sự + Thông tin KH */}
            {currentStep === 1 ? (
              <ContractFormStep1
                profile={profile}
                units={units}
                salespeople={salespeople}
                filteredSales={filteredSales}
                contractType={contractType} setContractType={setContractType}
                unitId={unitId} setUnitId={setUnitId}
                coordinatingUnitId={coordinatingUnitId} setCoordinatingUnitId={setCoordinatingUnitId}
                salespersonId={salespersonId} setSalespersonId={setSalespersonId}
                employeeAllocations={employeeAllocations} setEmployeeAllocations={setEmployeeAllocations}
                unitAllocations={unitAllocations} setUnitAllocations={setUnitAllocations}
                customerId={customerId} setCustomerId={setCustomerId}
                clientName={clientName} setClientName={setClientName}
                title={title} setTitle={setTitle}
                lineItems={lineItems}
                onGenerateTitle={generateContractTitle}
                isGeneratingTitle={isGeneratingTitle}
                classification={classification} setClassification={setClassification}
                endUserId={endUserId} setEndUserId={setEndUserId}
                endUserName={endUserName} setEndUserName={setEndUserName}
                endUser2Id={endUser2Id} setEndUser2Id={setEndUser2Id}
                endUser2Name={endUser2Name} setEndUser2Name={setEndUser2Name}
                signedDate={signedDate} setSignedDate={setSignedDate}
                endDate={endDate} setEndDate={setEndDate}
                hasVat={hasVat} setHasVat={setHasVat}
                vatRate={vatRate} setVatRate={setVatRate}
                formContractId={formContractId} setFormContractId={setFormContractId}
                contractNumberStt={contractNumberStt} setContractNumberStt={setContractNumberStt}
                isIdTouched={isIdTouched} setIsIdTouched={setIsIdTouched}
                duplicateWarning={duplicateWarning}
                hasCustomerContractNumber={hasCustomerContractNumber} setHasCustomerContractNumber={setHasCustomerContractNumber}
                customerContractNumber={customerContractNumber} setCustomerContractNumber={setCustomerContractNumber}
                contacts={contacts} setContacts={setContacts}
                addContact={addContact}
                removeContact={removeContact}
                setShowAddCustomerDialog={setShowAddCustomerDialog}
                setShowAddEndUserDialog={setShowAddEndUserDialog}
                setShowAddEndUser2Dialog={setShowAddEndUser2Dialog}
              />
            ) : null}

            {/* Step 2: Phương án kinh doanh */}
            {currentStep === 2 ? (
              <ContractFormStep2
                products={products} setProducts={setProducts}
                suppliers={suppliers} setSuppliers={setSuppliers}
                executionCostTypes={executionCostTypes} setExecutionCostTypes={setExecutionCostTypes}
                lineItems={lineItems} setLineItems={updateLineItemsAndRecalculate}
                addLineItem={addLineItem} removeLineItem={removeLineItem}
                openCostModal={openCostModal}
                executionCosts={executionCosts} setExecutionCosts={setExecutionCosts}
                addExecutionCost={addExecutionCost}
                removeExecutionCost={removeExecutionCost}
                updateExecutionCost={updateExecutionCost}
                totals={totals}
                formatVND={formatVND}
                setAddProductForIndex={setAddProductForIndex}
                setShowAddProductDialog={setShowAddProductDialog}
                setAddSupplierForIndex={setAddSupplierForIndex}
                setShowAddSupplierDialog={setShowAddSupplierDialog}
              />
            ) : null}

            {/* Step 3: Kế hoạch tài chính */}
            {currentStep === 3 ? (
              <ContractFormStep3
                revenueSchedules={revenueSchedules} setRevenueSchedules={setRevenueSchedules}
                paymentSchedules={paymentSchedules} setPaymentSchedules={setPaymentSchedules}
                supplierSchedules={supplierSchedules} setSupplierSchedules={setSupplierSchedules}
                generateSupplierSchedules={generateSupplierSchedules}
                paymentTermDays={paymentTermDays} setPaymentTermDays={setPaymentTermDays}
                formatVND={formatVND}
                notes={notes} setNotes={setNotes}
                totals={totals}
                lineItems={lineItems}
              />
            ) : null}

            {/* Step 4: Giao việc & Phân công */}
            {currentStep === 4 ? (
              <ContractFormStep4
                workflowSteps={workflowSteps}
                setWorkflowSteps={setWorkflowSteps}
                lineItems={lineItems}
                customTasks={customTasks}
                setCustomTasks={setCustomTasks}
              />
            ) : null}

          </div>
        </div>
      </div>

      {/* DIRECT COST MODAL */}
      <DirectCostModal
        isOpen={activeCostModalIndex !== null}
        onClose={() => setActiveCostModalIndex(null)}
        lineItem={activeCostModalIndex !== null ? lineItems[activeCostModalIndex] : null}
        tempCostDetails={tempCostDetails}
        setTempCostDetails={setTempCostDetails}
        onSave={saveCostModal}
        formatVND={formatVND}
        inputTotal={
          activeCostModalIndex !== null 
            ? (lineItems[activeCostModalIndex]?.quantity || 0) * (lineItems[activeCostModalIndex]?.inputPrice || 0) 
            : 0
        }
        supplierShareCount={(() => {
          if (activeCostModalIndex === null) return 1;
          const s = lineItems[activeCostModalIndex]?.supplier;
          if (!s) return 1;
          return lineItems.filter(li => li.supplier === s).length;
        })()}
        supplierTotalValue={(() => {
          if (activeCostModalIndex === null) return 0;
          const s = lineItems[activeCostModalIndex]?.supplier;
          if (!s) return 0;
          return lineItems
            .filter(li => li.supplier === s)
            .reduce((acc, li) => acc + (li.quantity || 0) * (li.inputPrice || 0), 0);
        })()}
        onApplyToAllSupplierItems={async (tax, transferType, rate) => {
          if (activeCostModalIndex === null) return;
          const s = lineItems[activeCostModalIndex]?.supplier;
          if (!s) return;

          // 1. Calculate supplier-level metrics
          const supplierItems = lineItems.filter(item => item.supplier === s);
          const supplierTotalValue = supplierItems.reduce((acc, item) => acc + (item.quantity || 0) * (item.inputPrice || 0), 0);

          const AUTO_TAX_ID = '__auto_contractor_tax__';
          const AUTO_TRANSFER_ID = '__auto_transfer_fee__';
          const TAX_NAMES = ['thuế nhà thầu', 'thue nha thau'];
          const TRANSFER_NAMES = ['phí chuyển tiền', 'phi chuyen tien'];
          const isAutoTaxEntry = (d: any) => d.id === AUTO_TAX_ID || TAX_NAMES.some((n: string) => d.name.toLowerCase().includes(n));
          const isAutoTransferEntry = (d: any) => d.id === AUTO_TRANSFER_ID || TRANSFER_NAMES.some((n: string) => d.name.toLowerCase().includes(n));

          // 2. Update lineItems in parent
          setLineItems(prev => {
            return prev.map(item => {
              if (item.supplier !== s) return item;

              const itemValue = (item.quantity || 0) * (item.inputPrice || 0);
              
              // Filter out current auto costs
              let newDetails = (item.directCostDetails || []).filter(d => !isAutoTaxEntry(d) && !isAutoTransferEntry(d));

              // Add tax if checked
              if (tax) {
                const taxAmount = Math.round(itemValue / 0.9 * 0.1);
                newDetails = [
                  { id: AUTO_TAX_ID, name: 'Thuế nhà thầu', amount: taxAmount, formula: `${itemValue}/0.9*0.1` },
                  ...newDetails
                ];
              }

              // Add transfer fee if checked
              if (transferType !== 'none') {
                let fee = 0;
                let formula = '';
                if (transferType === 'domestic') {
                  const stv = Math.max(supplierTotalValue, itemValue, 1);
                  const totalSupplierFee = Math.max(Math.round(stv * 0.0007), 22000);
                  fee = Math.round(totalSupplierFee * (itemValue / stv));
                  formula = stv > itemValue
                    ? `Max(${stv}*0.07%,22k)*(${itemValue}/${stv})`
                    : `Max(${itemValue}*0.07%,22k)`;
                } else if (transferType === 'international') {
                  const stv = Math.max(supplierTotalValue, itemValue, 1);
                  fee = Math.round(itemValue * 0.005 + 10 * rate * (itemValue / stv));
                  formula = stv > itemValue
                    ? `${itemValue}*0.5%+10*${rate}*(${itemValue}/${stv})`
                    : `${itemValue}*0.5%+10*${rate}`;
                }

                const label = transferType === 'domestic'
                  ? 'Phí chuyển tiền trong nước'
                  : 'Phí chuyển tiền nước ngoài';

                // Insert after tax if present
                const insertIdx = newDetails.findIndex(d => d.id === AUTO_TAX_ID);
                const transferEntry = { id: AUTO_TRANSFER_ID, name: label, amount: fee, formula };
                if (insertIdx >= 0) {
                  newDetails.splice(insertIdx + 1, 0, transferEntry);
                } else {
                  newDetails = [transferEntry, ...newDetails];
                }
              }

              const totalAmount = newDetails.reduce((acc, d) => acc + d.amount, 0);

              return {
                ...item,
                directCostDetails: newDetails,
                directCosts: totalAmount
              };
            });
          });

          // 3. Sync visual state of currently opened item in the modal
          const itemValue = (lineItems[activeCostModalIndex]?.quantity || 0) * (lineItems[activeCostModalIndex]?.inputPrice || 0);
          setTempCostDetails(prev => {
            let newDetails = prev.filter(d => !isAutoTaxEntry(d) && !isAutoTransferEntry(d));
            if (tax) {
              const taxAmount = Math.round(itemValue / 0.9 * 0.1);
              newDetails = [
                { id: AUTO_TAX_ID, name: 'Thuế nhà thầu', amount: taxAmount, formula: `${itemValue}/0.9*0.1` },
                ...newDetails
              ];
            }
            if (transferType !== 'none') {
              let fee = 0;
              let formula = '';
              if (transferType === 'domestic') {
                const stv = Math.max(supplierTotalValue, itemValue, 1);
                const totalSupplierFee = Math.max(Math.round(stv * 0.0007), 22000);
                fee = Math.round(totalSupplierFee * (itemValue / stv));
                formula = stv > itemValue
                  ? `Max(${stv}*0.07%,22k)*(${itemValue}/${stv})`
                  : `Max(${itemValue}*0.07%,22k)`;
              } else if (transferType === 'international') {
                const stv = Math.max(supplierTotalValue, itemValue, 1);
                fee = Math.round(itemValue * 0.005 + 10 * rate * (itemValue / stv));
                formula = stv > itemValue
                  ? `${itemValue}*0.5%+10*${rate}*(${itemValue}/${stv})`
                  : `${itemValue}*0.5%+10*${rate}`;
              }
              const label = transferType === 'domestic'
                ? 'Phí chuyển tiền trong nước'
                : 'Phí chuyển tiền nước ngoài';
              const insertIdx = newDetails.findIndex(d => d.id === AUTO_TAX_ID);
              const transferEntry = { id: AUTO_TRANSFER_ID, name: label, amount: fee, formula };
              if (insertIdx >= 0) {
                newDetails.splice(insertIdx + 1, 0, transferEntry);
              } else {
                newDetails = [transferEntry, ...newDetails];
              }
            }
            return newDetails;
          });

          toast.success(`Đã áp dụng cấu hình phí cho toàn bộ SP của NCC: ${s}`);
        }}
      />

      {/* FOOTER */}
      <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <button type="button" disabled={isSubmitting} onClick={() => { localStorage.removeItem('contract_form_draft'); onCancel(); }} className="px-6 py-3 text-slate-400 hover:text-rose-500 font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <X size={14} /> Hủy bỏ
          </button>
        </div>
        <div className="flex gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleBack}
              className="px-8 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft size={16} /> Quay lại
            </button>
          ) : null}

          {currentStep < 4 ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleNext}
              className="px-10 py-3 bg-indigo-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Tiếp tục <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => { localStorage.removeItem('contract_form_draft'); handleSave(); }}
              className="px-10 py-3 bg-emerald-500 text-white rounded-[20px] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-200 dark:shadow-none hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Save size={16} strokeWidth={2.5} />
                  Hoàn tất & Lưu
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Data lists for suggestions */}
      <datalist id="execution-cost-names">
        {executionCostTypes.map(type => (
          <option key={type.id} value={type.name} />
        ))}
      </datalist>

      {/* Quick Add Dialogs */}
      <QuickAddCustomerDialog
        isOpen={showAddCustomerDialog}
        onClose={() => setShowAddCustomerDialog(false)}
        onCreated={(customer) => {
          setCustomerId(customer.id);
          setClientName(customer.name);
          toast.success(`Đã thêm khách hàng: ${customer.name}`);
        }}
      />
      <QuickAddCustomerDialog
        isOpen={showAddEndUserDialog}
        onClose={() => setShowAddEndUserDialog(false)}
        onCreated={(customer) => {
          setEndUserId(customer.id);
          setEndUserName(customer.name);
          toast.success(`Đã thêm End User: ${customer.name}`);
        }}
      />
      <QuickAddCustomerDialog
        isOpen={showAddEndUser2Dialog}
        onClose={() => setShowAddEndUser2Dialog(false)}
        onCreated={(customer) => {
          setEndUser2Id(customer.id);
          setEndUser2Name(customer.name);
          toast.success(`Đã thêm End User 2: ${customer.name}`);
        }}
      />
      <QuickAddProductDialog
        isOpen={showAddProductDialog}
        onClose={() => { setShowAddProductDialog(false); setAddProductForIndex(null); }}
        onCreated={async (product) => {
          if (addProductForIndex !== null) {
            const newList = [...lineItems];
            newList[addProductForIndex].name = product.name;
            newList[addProductForIndex].inputPrice = product.costPrice || 0;
            newList[addProductForIndex].outputPrice = product.basePrice;
            setLineItems(newList);
          }
          const allProducts = await ProductService.getAll();
          setProducts(allProducts);
          toast.success(`Đã thêm SP: ${product.name}`);
        }}
      />
      <QuickAddSupplierDialog
        isOpen={showAddSupplierDialog}
        onClose={() => { setShowAddSupplierDialog(false); setAddSupplierForIndex(null); }}
        onCreated={async (supplier) => {
          if (addSupplierForIndex !== null) {
            const newList = [...lineItems];
            newList[addSupplierForIndex].supplier = supplier.shortName || supplier.name;
            setLineItems(newList);
          }
          const suppliersRes = await CustomerService.getAll({ pageSize: 200 });
          setSuppliers(suppliersRes.data?.filter(c => c.type === 'Supplier' || c.type === 'Both') || []);
          toast.success(`Đã thêm NCC: ${supplier.shortName || supplier.name}`);
        }}
      />
    </div>
  );
};

export default ContractForm;
