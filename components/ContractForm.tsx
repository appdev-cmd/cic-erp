import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  X, Save, Plus, Users, Hash, ArrowLeft, ArrowRight
} from 'lucide-react';
import {
  ContractType, LineItem, UnitAllocation, EmployeeAllocation,
  ContractContact, PaymentSchedule,
  RevenueSchedule, AdministrativeCosts,
  Contract, ExecutionCostItem
} from '../types';
import { UnitService, CustomerService, ProductService, ContractService, EmployeeService, ExecutionCostService, ExecutionCostType } from '../services';
import QuickAddCustomerDialog from './ui/QuickAddCustomerDialog';
import QuickAddProductDialog from './ui/QuickAddProductDialog';
import QuickAddSupplierDialog from './ui/QuickAddSupplierDialog';

// Contract Form Sub-components
import { useAuth } from '../contexts/AuthContext';
import { useFinancialCalculations } from '../hooks/useFinancialCalculations';
import {
  StepIndicator,
  FinancialSummary,
  ContractFormStep1,
  ContractFormStep2,
  ContractFormStep3,
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
  const [isDealerSale, setIsDealerSale] = useState(contract?.isDealerSale || false);
  const [endUserId, setEndUserId] = useState<string | null>(contract?.endUserId || null);
  const [endUserName, setEndUserName] = useState(contract?.endUserName || '');
  const [showAddEndUserDialog, setShowAddEndUserDialog] = useState(false);
  const [signedDate, setSignedDate] = useState(contract?.signedDate || new Date().toISOString().split('T')[0]);
  const [hasVat, setHasVat] = useState(contract?.hasVat !== false);
  const [vatRate, setVatRate] = useState(contract?.vatRate ?? 0);

  // ==================== CONTRACT SYNC (Edit/Clone Mode) ====================
  useEffect(() => {
    if (contract) {
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
      setIsDealerSale(contract.isDealerSale || false);
      setEndUserId(contract.endUserId || null);
      setEndUserName(contract.endUserName || '');
      setSignedDate(contract.signedDate || new Date().toISOString().split('T')[0]);
      setHasVat(contract.hasVat !== false);
      setVatRate(contract.vatRate ?? 0);
      // Sync customer contract number
      setHasCustomerContractNumber(!!contract.customerContractNumber);
      setCustomerContractNumber(contract.customerContractNumber || '');
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
  }, [isEditing, contract?.customerId, contract?.endUserId]);

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

  const [executionCosts, setExecutionCosts] = useState<ExecutionCostItem[]>(contract?.executionCosts || []);

  // Execution cost handlers
  const addExecutionCost = () => {
    setExecutionCosts(prev => [...prev, { id: `exec-${Date.now()}`, name: '', amount: 0 }]);
  };
  const removeExecutionCost = (id: string) => {
    setExecutionCosts(prev => prev.filter(c => c.id !== id));
  };
  const updateExecutionCost = (id: string, field: keyof ExecutionCostItem, value: any) => {
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
    setLineItems(newList);
    setActiveCostModalIndex(null);
  };

  // ==================== STEP 3: SCHEDULES & NOTES ====================
  const [revenueSchedules, setRevenueSchedules] = useState<RevenueSchedule[]>(contract?.revenueSchedules || [{ id: '1', date: '', amount: 0, description: 'Đợt 1' }]);
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([{ id: '1', date: '', amount: 0, description: 'Tạm ứng', type: 'Revenue' }]);
  const [supplierSchedules, setSupplierSchedules] = useState<PaymentSchedule[]>([{ id: '1', date: '', amount: 0, description: 'Thanh toán đợt 1', type: 'Expense' }]);
  const [notes, setNotes] = useState(contract?.notes || '');

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
  const [formContractId, setFormContractId] = useState(isCloning ? '' : (contract?.contractCode || contract?.id || ''));
  const [isIdTouched, setIsIdTouched] = useState(isCloning ? false : !!(contract?.contractCode || contract?.id));
  const [hasCustomerContractNumber, setHasCustomerContractNumber] = useState(!!(contract as any)?.customerContractNumber);
  const [customerContractNumber, setCustomerContractNumber] = useState((contract as any)?.customerContractNumber || '');

  useEffect(() => {
    const generateId = async () => {
      try {
        // When cloning, always generate new ID (ignore isIdTouched)
        if (isEditing || (!isCloning && isIdTouched) || !unitId) return;
        const unit = units.find(u => u.id === unitId);
        const unitCode = unit?.code || 'UNIT';
        const year = new Date(signedDate).getFullYear();
        const nextNum = await ContractService.getNextContractNumber(unitId, year, true);
        const stt = nextNum.toString().padStart(3, '0');
        const clientInitial = clientName ? clientName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 5) : 'KH';
        const newId = `${contractType}_${stt}/${unitCode}_${clientInitial}_${year}`;
        setFormContractId(newId);
      } catch (error) {
        console.error("Error generating contract ID:", error);
      }
    };
    const timer = setTimeout(generateId, 500);
    return () => clearTimeout(timer);
  }, [unitId, clientName, signedDate, units, isEditing, isIdTouched, contractType]);

  // ==================== AUTO-SAVE DRAFT ====================
  useEffect(() => {
    if (isEditing) return;
    const timer = setTimeout(() => {
      const draft = {
        contractType, unitId, coordinatingUnitId, salespersonId, customerId, title, clientName,
        signedDate, contacts, lineItems, revenueSchedules, paymentSchedules, supplierSchedules,
      };
      if (title || clientName || lineItems.length > 0) {
        localStorage.setItem('contract_form_draft', JSON.stringify(draft));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    isEditing, contractType, unitId, coordinatingUnitId, salespersonId, customerId, title, clientName,
    signedDate, contacts, lineItems, revenueSchedules, paymentSchedules, supplierSchedules
  ]);

  // ==================== DIRTY STATE TRACKING ====================
  const initialSnapshotRef = useRef<string | null>(null);
  const wasDirtyRef = useRef(false);

  // Key fields that constitute "user data"
  const currentSnapshot = useMemo(() => JSON.stringify({
    contractType, unitId, coordinatingUnitId, salespersonId, customerId,
    title, clientName, signedDate, hasVat, vatRate, isDealerSale,
    endUserId, endUserName, contacts, lineItems, executionCosts,
    revenueSchedules, paymentSchedules, supplierSchedules,
    employeeAllocations, unitAllocations, formContractId,
    customerContractNumber, hasCustomerContractNumber, notes,
  }), [
    contractType, unitId, coordinatingUnitId, salespersonId, customerId,
    title, clientName, signedDate, hasVat, vatRate, isDealerSale,
    endUserId, endUserName, contacts, lineItems, executionCosts,
    revenueSchedules, paymentSchedules, supplierSchedules,
    employeeAllocations, unitAllocations, formContractId,
    customerContractNumber, hasCustomerContractNumber, notes,
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
                  if (draft.contacts) setContacts(draft.contacts);
                  if (draft.lineItems) setLineItems(draft.lineItems);
                  if (draft.revenueSchedules) setRevenueSchedules(draft.revenueSchedules);
                  if (draft.paymentSchedules) setPaymentSchedules(draft.paymentSchedules);
                  if (draft.supplierSchedules) setSupplierSchedules(draft.supplierSchedules);

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
  const removeLineItem = (id: string) => setLineItems(lineItems.filter(i => i.id !== id));

  const handleSave = () => {
    if (!unitId || !salespersonId || !clientName) {
      toast.error("Vui lòng nhập đầy đủ thông tin bắt buộc (Đơn vị, Sale, Khách hàng)");
      return;
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
      hasVat,
      vatRate: hasVat ? vatRate : 0,
      endUserId: isDealerSale ? (endUserId || null) : null,
      endUserName: isDealerSale ? endUserName : null,
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
      endDate: isEditing ? (contract?.endDate || signedDate) : signedDate,
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
      notes: notes?.trim() || null,
    };
    onSave(payload);
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
                isDealerSale={isDealerSale} setIsDealerSale={setIsDealerSale}
                endUserId={endUserId} setEndUserId={setEndUserId}
                endUserName={endUserName} setEndUserName={setEndUserName}
                signedDate={signedDate} setSignedDate={setSignedDate}
                hasVat={hasVat} setHasVat={setHasVat}
                vatRate={vatRate} setVatRate={setVatRate}
                formContractId={formContractId} setFormContractId={setFormContractId}
                isIdTouched={isIdTouched} setIsIdTouched={setIsIdTouched}
                hasCustomerContractNumber={hasCustomerContractNumber} setHasCustomerContractNumber={setHasCustomerContractNumber}
                customerContractNumber={customerContractNumber} setCustomerContractNumber={setCustomerContractNumber}
                contacts={contacts} setContacts={setContacts}
                addContact={addContact}
                removeContact={removeContact}
                setShowAddCustomerDialog={setShowAddCustomerDialog}
                setShowAddEndUserDialog={setShowAddEndUserDialog}
              />
            ) : null}

            {/* Step 2: Phương án kinh doanh */}
            {currentStep === 2 ? (
              <ContractFormStep2
                products={products} setProducts={setProducts}
                suppliers={suppliers} setSuppliers={setSuppliers}
                executionCostTypes={executionCostTypes} setExecutionCostTypes={setExecutionCostTypes}
                lineItems={lineItems} setLineItems={setLineItems}
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
                formatVND={formatVND}
                notes={notes} setNotes={setNotes}
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
        inputTotal={activeCostModalIndex !== null ? (lineItems[activeCostModalIndex]?.quantity || 0) * (lineItems[activeCostModalIndex]?.inputPrice || 0) : 0}
      />

      {/* FOOTER */}
      <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <button onClick={() => { localStorage.removeItem('contract_form_draft'); onCancel(); }} className="px-6 py-3 text-slate-400 hover:text-rose-500 font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2">
            <X size={14} /> Hủy bỏ
          </button>
        </div>
        <div className="flex gap-3">
          {currentStep > 1 ? (
            <button
              onClick={handleBack}
              className="px-8 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Quay lại
            </button>
          ) : null}

          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              className="px-10 py-3 bg-indigo-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none hover:scale-105 active:scale-95"
            >
              Tiếp tục <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => { localStorage.removeItem('contract_form_draft'); handleSave(); }}
              className="px-10 py-3 bg-emerald-500 text-white rounded-[20px] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-200 dark:shadow-none hover:scale-105 active:scale-95"
            >
              <Save size={16} strokeWidth={2.5} />
              Hoàn tất & Lưu
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
