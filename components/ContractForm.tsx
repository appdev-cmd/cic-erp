import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  X, Save, Calendar, User, FileText,
  DollarSign, Calculator, Building2,
  Plus, Trash2, Users, Briefcase,
  TrendingUp, TrendingDown, CreditCard, Receipt,
  Info, Package, ShieldCheck, Wallet,
  MapPin, UserCheck, Hash, Percent
} from 'lucide-react';
import {
  Unit, ContractType, LineItem, UnitAllocation, EmployeeAllocation,
  ContractContact, PaymentSchedule,
  RevenueSchedule, AdministrativeCosts,
  Contract, Employee, Customer, Product, DirectCostDetail
} from '../types';
import { UnitService, CustomerService, ProductService, ContractService, EmployeeService, ExecutionCostService, ExecutionCostType } from '../services';
import Modal from './ui/Modal';
import SearchableSelect from './ui/SearchableSelect';
import QuickAddCustomerDialog from './ui/QuickAddCustomerDialog';
import QuickAddProductDialog from './ui/QuickAddProductDialog';
import QuickAddSupplierDialog from './ui/QuickAddSupplierDialog';

// Contract Form Sub-components
import { useAuth } from '../contexts/AuthContext';
import { useFinancialCalculations } from '../hooks/useFinancialCalculations';
import { StepIndicator, FinancialSummary, FormHeader, formatVND as formatVNDUtil, PAKDImportButton } from './contract-form';
import UnitAllocationsInput from './contract-form/UnitAllocationsInput';

interface ContractFormProps {
  contract?: Contract; // For edit mode
  isCloning?: boolean; // For clone mode
  onSave: (contract: any) => void;
  onCancel: () => void;
}

const ContractForm: React.FC<ContractFormProps> = ({ contract, isCloning = false, onSave, onCancel }) => {
  const { profile } = useAuth();
  const isEditing = !!contract && !isCloning;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Data Options State
  const [units, setUnits] = useState<Unit[]>([]);
  const [salespeople, setSalespeople] = useState<Employee[]>([]);
  // Removed: const [customers, setCustomers] = useState<Customer[]>([]);
  // Now using SearchableSelect with async search
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Customer[]>([]); // Only for supplier dropdown
  const [executionCostTypes, setExecutionCostTypes] = useState<ExecutionCostType[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [unitsData, peopleData, productsData, suppliersRes, executionCostTypesRes] = await Promise.all([
          UnitService.getAll(),
          EmployeeService.getAll(),
          // CustomerService removed - now using SearchableSelect
          ProductService.getAll(),
          CustomerService.getAll({ pageSize: 100, type: 'Supplier' }), // Only suppliers for dropdown
          ExecutionCostService.getAll()
        ]);
        setUnits(unitsData);
        setSalespeople(peopleData);
        setProducts(productsData);
        setSuppliers(suppliersRes.data?.filter(c => c.type === 'Supplier' || c.type === 'Both') || []);
        setExecutionCostTypes(executionCostTypesRes);

        // Set default unit if creating new and no unit selected yet
        if (!isEditing && !unitId && unitsData.length > 0) {
          // Always default to user's unit if possible
          if (profile?.unitId) {
            setUnitId(profile.unitId);
          } else {
            const operationalUnits = unitsData.filter(u => u.id !== 'all' && u.type !== 'Company' && u.type !== 'BackOffice');
            if (operationalUnits.length > 0) setUnitId(operationalUnits[0].id);
          }

          // Also set default salesperson to current user
          if (profile?.id) {
            const isEmployee = peopleData.some(p => p.id === profile.id);
            if (isEmployee) {
              setSalespersonId(profile.id);
            }
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
    fetchOptions();
  }, []);

  // 1. Identification & Responsibility
  const [contractType, setContractType] = useState<ContractType>(contract?.contractType || 'HĐ');
  const [unitId, setUnitId] = useState(contract?.unitId || '');
  const [coordinatingUnitId, setCoordinatingUnitId] = useState(contract?.coordinatingUnitId || '');
  // Unit Allocations for QĐ 09.2024 coordination
  const [unitAllocations, setUnitAllocations] = useState<UnitAllocation[]>(
    contract?.unitAllocations || []
  );
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
  const [hasVat, setHasVat] = useState(contract?.hasVat !== false); // default true
  const [vatRate, setVatRate] = useState(contract?.vatRate ?? 10); // 8 or 10

  // CRITICAL FIX: Sync state when contract prop changes (for edit mode)
  // useState only reads initial value once on mount, so we need useEffect to update
  useEffect(() => {
    if (contract) {
      // Step 1 fields
      setContractType(contract.contractType || 'HĐ');
      setUnitId(contract.unitId || '');
      setCoordinatingUnitId(contract.coordinatingUnitId || '');
      setSalespersonId(contract.salespersonId || '');
      // Load employee allocations (backward compat: if no allocations, create from salespersonId)
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
      setVatRate(contract.vatRate ?? 10);

      // Contacts
      if (contract.contacts && contract.contacts.length > 0) {
        setContacts(contract.contacts);
      }

      // Step 2 fields - Line Items (backward compat: add vatRate/supplierDiscount if missing)
      if (contract.lineItems && contract.lineItems.length > 0) {
        const contractVat = contract.vatRate ?? 10;
        setLineItems(contract.lineItems.map(item => ({
          ...item,
          vatRate: item.vatRate ?? contractVat,
          supplierDiscount: item.supplierDiscount ?? 0,
        })));
      }

      // Admin Costs
      if (contract.adminCosts) {
        setAdminCosts(contract.adminCosts);
      }
    }
  }, [contract]);

  // Fetch customer name on edit mode (so SearchableSelect shows correct display value)
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

  // Quick Add Customer Dialog
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [addProductForIndex, setAddProductForIndex] = useState<number | null>(null);
  const [showAddSupplierDialog, setShowAddSupplierDialog] = useState(false);
  const [addSupplierForIndex, setAddSupplierForIndex] = useState<number | null>(null);

  // const [manualValue, setManualValue] = useState<number>(contract?.value || 0); // Removed per request

  // 2. Client Contacts (Multi-entry)
  const [contacts, setContacts] = useState<ContractContact[]>(contract?.contacts || [{ id: '1', name: '', role: 'Mua sắm' }]);

  // 3. Line Items (Sản phẩm/Dịch vụ chi tiết)
  const [lineItems, setLineItems] = useState<LineItem[]>(contract?.lineItems || [{
    id: '1', name: '', quantity: 1, supplier: '', inputPrice: 0, outputPrice: 0, directCosts: 0, vatRate: 10, supplierDiscount: 0
  }]);

  // 4. Financial Schedules (Hóa đơn & Tiền về & Chi trả NCC)
  const [revenueSchedules, setRevenueSchedules] = useState<RevenueSchedule[]>(contract?.revenueSchedules || [{ id: '1', date: '', amount: 0, description: 'Đợt 1' }]);
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([{ id: '1', date: '', amount: 0, description: 'Tạm ứng', type: 'Revenue' }]);
  const [supplierSchedules, setSupplierSchedules] = useState<PaymentSchedule[]>([{ id: '1', date: '', amount: 0, description: 'Thanh toán đợt 1', type: 'Expense' }]);

  // Load existing phases
  useEffect(() => {
    if (contract?.paymentPhases && Array.isArray(contract.paymentPhases)) {
      try {
        const revenue = contract.paymentPhases
          .filter(p => p && (!p.type || p.type === 'Revenue'))
          .map(p => ({
            ...p,
            date: p.dueDate || '',
            description: p.name || ''
          })) as PaymentSchedule[];

        const expense = contract.paymentPhases
          .filter(p => p && p.type === 'Expense')
          .map(p => ({
            ...p,
            date: p.dueDate || '',
            description: p.name || ''
          })) as PaymentSchedule[];

        if (revenue.length > 0) setPaymentSchedules(revenue);
        if (expense.length > 0) setSupplierSchedules(expense);
      } catch (error) {
        console.error("Error loading payment phases:", error);
      }
    }
  }, [contract]);

  // 5. Overhead Costs (Legacy - kept for backward compatibility)
  const [adminCosts, setAdminCosts] = useState<AdministrativeCosts>(contract?.adminCosts || {
    transferFee: 0, contractorTax: 0, importFee: 0, expertHiring: 0, documentProcessing: 0
  });

  const [adminCostPercentages, setAdminCostPercentages] = useState<AdministrativeCosts>({
    transferFee: 0, contractorTax: 0, importFee: 0, expertHiring: 0, documentProcessing: 0
  });

  // 5.1 Execution Costs (New - Dynamic list)
  type ExecutionCostItem = { id: string; name: string; amount: number; percentage?: number; note?: string; };
  const [executionCosts, setExecutionCosts] = useState<ExecutionCostItem[]>(
    contract?.executionCosts || []
  );

  // Add execution cost item
  const addExecutionCost = () => {
    setExecutionCosts([
      ...executionCosts,
      { id: `exec-${Date.now()}`, name: '', amount: 0 }
    ]);
  };

  // Remove execution cost item
  const removeExecutionCost = (id: string) => {
    setExecutionCosts(executionCosts.filter(c => c.id !== id));
  };

  // Update execution cost item (functional update to avoid stale state)
  const updateExecutionCost = (id: string, field: keyof ExecutionCostItem, value: any) => {
    setExecutionCosts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // Supplier Discount is now per-line-item (no contract-level state needed)

  // 6. Direct Costs Modal State
  const [activeCostModalIndex, setActiveCostModalIndex] = useState<number | null>(null);
  const [tempCostDetails, setTempCostDetails] = useState<DirectCostDetail[]>([]);

  // Function to open modal
  const openCostModal = (index: number) => {
    setActiveCostModalIndex(index);
    setTempCostDetails(lineItems[index].directCostDetails || []);
  };

  // Auto-save Logic
  const [currentStep, setCurrentStep] = useState(1);

  // Wizard Navigation
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
    // Scroll to top using ref
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  // Function to save modal
  const saveCostModal = () => {
    if (activeCostModalIndex === null) return;

    const newList = [...lineItems];
    const totalAmount = tempCostDetails.reduce((acc, item) => acc + item.amount, 0);

    newList[activeCostModalIndex].directCostDetails = tempCostDetails;
    newList[activeCostModalIndex].directCosts = totalAmount;

    setLineItems(newList);
    setActiveCostModalIndex(null);
  };

  // Auto-save Logic
  useEffect(() => {
    if (isEditing) return; // Only auto-save for new contracts

    const timer = setTimeout(() => {
      const draft = {
        contractType, unitId, coordinatingUnitId, salespersonId, customerId, title, clientName,
        signedDate, contacts, lineItems, revenueSchedules, paymentSchedules, supplierSchedules,
        adminCosts, adminCostPercentages
      };

      // Only save if there's some data
      if (title || clientName || lineItems.length > 0) {
        localStorage.setItem('contract_form_draft', JSON.stringify(draft));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    isEditing,
    contractType, unitId, coordinatingUnitId, salespersonId, customerId, title, clientName,
    signedDate, contacts, lineItems, revenueSchedules, paymentSchedules, supplierSchedules,
    adminCosts, adminCostPercentages
  ]);

  // Restore Draft Hook
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
                  if (draft.adminCosts) setAdminCosts(draft.adminCosts);
                  if (draft.adminCostPercentages) setAdminCostPercentages(draft.adminCostPercentages);
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

  // Filter sales based on selected unit, but always include current salesperson in edit mode
  const filteredSales = useMemo(() => {
    if (!unitId) return salespeople;
    const filtered = salespeople.filter(s => s.unitId === unitId);
    // Always include current salesperson even if from different unit (for edit mode)
    if (salespersonId && !filtered.some(s => s.id === salespersonId)) {
      const currentSalesperson = salespeople.find(s => s.id === salespersonId);
      if (currentSalesperson) {
        filtered.unshift(currentSalesperson);
      }
    }
    return filtered;
  }, [salespeople, unitId, salespersonId]);

  // Auto-generate Supplier Schedules from Line Items
  const generateSupplierSchedules = () => {
    const supplierGroups: { [key: string]: number } = {};

    lineItems.forEach(item => {
      if (item.supplier) {
        const cost = item.quantity * item.inputPrice;
        if (supplierGroups[item.supplier]) {
          supplierGroups[item.supplier] += cost;
        } else {
          supplierGroups[item.supplier] = cost;
        }
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

  // Auto-generate Contract ID: HĐ_STT/Đơn vị_Khách hàng_Năm
  const [formContractId, setFormContractId] = useState(isCloning ? '' : (contract?.id || ''));
  const [isIdTouched, setIsIdTouched] = useState(isCloning ? false : !!contract?.id);

  // Customer Contract Number (Số HĐ KH)
  const [hasCustomerContractNumber, setHasCustomerContractNumber] = useState(!!(contract as any)?.customerContractNumber);
  const [customerContractNumber, setCustomerContractNumber] = useState((contract as any)?.customerContractNumber || '');

  useEffect(() => {
    const generateId = async () => {
      try {
        // Only auto-generate if NOT editing, ID NOT touched, and we have enough info
        if (isEditing || isIdTouched || !unitId) return;

        const unit = units.find(u => u.id === unitId);
        const unitCode = unit?.code || 'UNIT';
        const year = new Date(signedDate).getFullYear();

        // Get next number from API
        const nextNum = await ContractService.getNextContractNumber(unitId, year);
        const stt = nextNum.toString().padStart(3, '0');

        const clientInitial = clientName ? clientName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 5) : 'KH';

        const newId = `HĐ_${stt}/${unitCode}_${clientInitial}_${year}`;
        setFormContractId(newId);
      } catch (error) {
        console.error("Error generating contract ID:", error);
      }
    };

    const timer = setTimeout(generateId, 500); // Debounce
    return () => clearTimeout(timer);
  }, [unitId, clientName, signedDate, units, isEditing, isIdTouched]);

  // Logic tính toán chuyên sâu (VAT & CK NCC per line item)
  const totals = useFinancialCalculations(lineItems, adminCosts, executionCosts);

  const formatVND = (val: number) => new Intl.NumberFormat('vi-VN').format(Math.round(val));

  // Handlers for dynamic lists
  const addContact = () => setContacts([...contacts, { id: Date.now().toString(), name: '', role: '' }]);
  const removeContact = (id: string) => setContacts(contacts.filter(c => c.id !== id));

  const addLineItem = () => setLineItems([...lineItems, { id: Date.now().toString(), name: '', quantity: 1, supplier: '', inputPrice: 0, outputPrice: 0, directCosts: 0, vatRate: 10, supplierDiscount: 0 }]);
  const removeLineItem = (id: string) => setLineItems(lineItems.filter(i => i.id !== id));

  const handleSave = () => {
    // Validate
    if (!unitId || !salespersonId || !clientName) {
      toast.error("Vui lòng nhập đầy đủ thông tin bắt buộc (Đơn vị, Sale, Khách hàng)");
      return;
    }

    const payload = {
      id: formContractId, // Use form ID
      title: title || 'Hợp đồng chưa đặt tên',
      contractType,
      partyA: clientName,
      partyB: 'CIC', // Default
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
      // Edit mode: preserve existing values; New mode: set defaults
      actualRevenue: isEditing ? (contract?.actualRevenue ?? 0) : 0,
      actualCost: totals.totalCosts,
      status: isEditing ? (contract?.status || 'Pending') : 'Pending',
      stage: isEditing ? (contract?.stage || 'Signed') : 'Signed',
      category: isEditing ? (contract?.category || 'Project') : 'Project',
      signedDate,
      startDate: isEditing ? (contract?.startDate || signedDate) : signedDate,
      endDate: isEditing ? (contract?.endDate || signedDate) : signedDate,
      content: title, // Simplified
      contacts: contacts,
      milestones: isEditing ? (contract?.milestones || []) : [],
      // Map PaymentSchedule (date, description) → PaymentPhase (dueDate, name)
      paymentPhases: [...paymentSchedules, ...supplierSchedules].map(p => ({
        id: p.id,
        name: p.description || '',
        dueDate: p.date || '',
        amount: p.amount || 0,
        status: p.status || 'Pending',
        percentage: p.percentage || 0,
        type: p.type
      })),
      lineItems: lineItems,
      adminCosts: adminCosts,
      revenueSchedules: revenueSchedules,
      customerContractNumber: hasCustomerContractNumber ? customerContractNumber : null,
    };

    onSave(payload);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-w-[1600px] w-full mx-auto flex flex-col h-[92vh]">

      {/* HEADER */}
      <div className="px-10 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-indigo-600 rounded-[20px] flex items-center justify-center text-white shadow-xl shadow-indigo-100 dark:shadow-none">
            <Plus size={28} strokeWidth={3} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {isEditing ? 'Chỉnh sửa hợp đồng' : isCloning ? 'Nhân bản hợp đồng' : 'Khai báo hồ sơ hợp đồng'}
              </h2>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black rounded-lg uppercase tracking-wider">
                <Hash size={10} /> {formContractId}
              </div>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Nghiệp vụ Quản trị & Theo dõi KPI mục tiêu</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={() => {
                // === STEP 1: Đơn vị & Nhân sự ===
                if (units.length > 0) setUnitId(units[0].id);
                if (units.length > 1) setCoordinatingUnitId(units[1].id);
                if (salespeople.length > 0) {
                  setSalespersonId(salespeople[0].id);
                  setEmployeeAllocations([{ employeeId: salespeople[0].id, percent: 100, role: 'lead' }]);
                }

                // Tiêu đề và ngày ký
                setTitle('Hợp đồng Tư vấn Giải pháp chuyển đổi số BIM - Dự án Trụ sở ABC');
                setSignedDate(new Date().toISOString().split('T')[0]);

                // Liên hệ khách hàng
                setContacts([
                  { id: 'c1', name: 'Nguyễn Văn An', role: 'Giám đốc dự án' },
                  { id: 'c2', name: 'Trần Thị Bình', role: 'Phòng Mua sắm' }
                ]);

                // === STEP 2: Kinh doanh & Chi phí ===
                // Sản phẩm/Dịch vụ chi tiết
                setLineItems([
                  {
                    id: 'item-1',
                    name: 'Tư vấn BIM Execution Plan',
                    quantity: 1,
                    supplier: '',
                    inputPrice: 0,
                    outputPrice: 50000000,
                    directCosts: 0,
                    vatRate: 10,
                    supplierDiscount: 0
                  },
                  {
                    id: 'item-2',
                    name: 'Phần mềm Autodesk Revit (Bản quyền 1 năm)',
                    quantity: 5,
                    supplier: 'Autodesk',
                    inputPrice: 8000000,
                    outputPrice: 12000000,
                    directCosts: 0,
                    vatRate: 8,
                    supplierDiscount: 5
                  },
                  {
                    id: 'item-3',
                    name: 'Đào tạo BIM cho đội ngũ kỹ sư',
                    quantity: 2,
                    supplier: 'CTV_GiangVien',
                    inputPrice: 5000000,
                    outputPrice: 15000000,
                    directCosts: 10000000,
                    directCostDetails: [
                      { id: 'd1', name: 'Thuê giảng viên', amount: 8000000 },
                      { id: 'd2', name: 'Tài liệu đào tạo', amount: 2000000 }
                    ],
                    vatRate: 10,
                    supplierDiscount: 0
                  }
                ]);

                // Chi phí quản lý
                setAdminCosts({
                  transferFee: 50000,
                  contractorTax: 0,
                  importFee: 500000,
                  expertHiring: 3000000,
                  documentProcessing: 150000
                });

                // Supplier discount removed from contract level (now per line item)

                // === STEP 3: Tài chính & Hoàn tất ===
                const today = new Date();
                const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
                const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

                // Lịch xuất hóa đơn doanh thu
                setRevenueSchedules([
                  { id: 'rev-1', date: today.toISOString().split('T')[0], amount: 40000000, description: 'Đợt 1 - Tạm ứng' },
                  { id: 'rev-2', date: in60Days.toISOString().split('T')[0], amount: 60000000, description: 'Đợt 2 - Nghiệm thu' },
                  { id: 'rev-3', date: in90Days.toISOString().split('T')[0], amount: 40000000, description: 'Đợt 3 - Hoàn tất' }
                ]);

                // Lịch thu tiền từ khách hàng
                setPaymentSchedules([
                  { id: 'pay-1', date: today.toISOString().split('T')[0], amount: 40000000, description: 'Tạm ứng 30%', type: 'Revenue', status: 'Pending' },
                  { id: 'pay-2', date: in30Days.toISOString().split('T')[0], amount: 50000000, description: 'Thanh toán đợt 2', type: 'Revenue', status: 'Pending' },
                  { id: 'pay-3', date: in90Days.toISOString().split('T')[0], amount: 50000000, description: 'Thanh toán nghiệm thu', type: 'Revenue', status: 'Pending' }
                ]);

                // Lịch thanh toán cho NCC
                setSupplierSchedules([
                  { id: 'sup-1', date: in30Days.toISOString().split('T')[0], amount: 40000000, description: 'Thanh toán Autodesk', type: 'Expense', status: 'Pending' },
                  { id: 'sup-2', date: in60Days.toISOString().split('T')[0], amount: 10000000, description: 'Thanh toán giảng viên', type: 'Expense', status: 'Pending' }
                ]);

                toast.success('Đã điền dữ liệu mẫu đầy đủ cho tất cả các bước!');
              }}
              className="p-3 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-bold text-xs uppercase transition-all flex items-center gap-2"
              title="Điền dữ liệu mẫu"
            >
              <Users size={16} /> Data Mẫu
            </button>
          )}
          <button onClick={onCancel} className="p-3 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg text-slate-400 hover:text-rose-500 transition-all">
            <X size={24} />
          </button>
        </div>
      </div>

      {/* STEPPER PROGRESS */}
      <StepIndicator currentStep={currentStep} />

      {/* FINANCIAL SUMMARY (Only show in Step 2 & 3) */}
      {currentStep > 1 && (
        <FinancialSummary totals={totals} formatVND={formatVND} />
      )}

      {/* BODY */}
      <div className="flex-1 overflow-y-auto px-10 pb-10 pt-2 custom-scrollbar space-y-8 scroll-smooth">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* MAIN CONTENT (Now Full Width) */}
          <div className="col-span-12 space-y-12">

            {/* 1. ĐƠN VỊ & NHÂN SỰ */}
            {currentStep === 1 && (
              <section className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                <div className="flex items-center gap-3 border-l-4 border-indigo-600 pl-4">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <UserCheck size={16} /> Đơn vị & Nhân sự thực hiện
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Unit Dropdown */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                      <MapPin size={10} /> Đơn vị thực hiện
                    </label>
                    <select
                      value={unitId}
                      onChange={(e) => { setUnitId(e.target.value); setSalespersonId(''); setEmployeeAllocations([]); }}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                    >
                      {(() => {
                        const GLOBAL_ROLES = ['Leadership', 'Admin', 'Legal', 'Accountant', 'ChiefAccountant'];
                        const isGlobal = profile && GLOBAL_ROLES.includes(profile.role);
                        const availableUnits = units.filter(u => {
                          if (u.id === 'all' || u.type === 'Company' || u.type === 'BackOffice') return false;
                          if (isGlobal || !profile?.unitId) return true;
                          return u.id === profile.unitId;
                        });

                        return availableUnits.map(u => <option key={u.id} value={u.id}>{u.name}</option>);
                      })()}
                    </select>
                  </div>

                  {/* Employee Allocations - Multi-employee with % */}
                  <div className="col-span-2 space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                      <User size={10} /> Nhân viên thực hiện
                    </label>
                    <div className="space-y-1.5">
                      {employeeAllocations.map((alloc, idx) => {
                        const isLead = idx === 0;
                        const othersTotal = employeeAllocations.filter((_, i) => i !== 0).reduce((s, a) => s + a.percent, 0);
                        const displayPercent = isLead ? (100 - othersTotal) : alloc.percent;

                        // Calculate effective % when unit allocations exist
                        const supportUnitsTotal = unitAllocations.filter(a => a.role === 'support').reduce((s, a) => s + a.percent, 0);
                        const leadUnitPercent = supportUnitsTotal > 0 ? (100 - supportUnitsTotal) : 100;
                        const effectivePercent = Math.round((displayPercent * leadUnitPercent) / 100);
                        const hasUnitSplit = supportUnitsTotal > 0;

                        return (
                          <div key={idx} className="grid items-center gap-2" style={{ gridTemplateColumns: hasUnitSplit ? '1fr 80px 60px 36px 48px' : '1fr 80px 36px 48px' }}>
                            {/* Employee Name */}
                            <select
                              value={alloc.employeeId}
                              onChange={(e) => {
                                const newAllocs = [...employeeAllocations];
                                newAllocs[idx].employeeId = e.target.value;
                                if (isLead) newAllocs[idx].percent = 100 - othersTotal;
                                setEmployeeAllocations(newAllocs);
                                if (isLead) setSalespersonId(e.target.value);
                              }}
                              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                            >
                              <option value="">-- Chọn NV --</option>
                              {filteredSales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>

                            {/* Percentage */}
                            <div className="relative">
                              {isLead ? (
                                <div className="w-full px-2 py-2.5 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm font-black text-indigo-600 dark:text-indigo-300 text-center">
                                  {displayPercent}
                                  <span className="text-[10px] font-bold text-indigo-400 ml-0.5">%</span>
                                </div>
                              ) : (
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="1"
                                    max={99}
                                    value={alloc.percent || ''}
                                    onChange={(e) => {
                                      const val = Math.min(99, Math.max(0, Number(e.target.value)));
                                      const newAllocs = [...employeeAllocations];
                                      newAllocs[idx].percent = val;
                                      const newOthersTotal = newAllocs.filter((_, i) => i !== 0).reduce((s, a) => s + a.percent, 0);
                                      newAllocs[0].percent = Math.max(0, 100 - newOthersTotal);
                                      setEmployeeAllocations(newAllocs);
                                    }}
                                    className="w-full px-2 py-2.5 bg-indigo-50 dark:bg-indigo-800/40 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm font-black text-indigo-600 dark:text-indigo-300 text-center outline-none focus:border-indigo-500"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-400">%</span>
                                </div>
                              )}
                            </div>

                            {/* Effective % - only when unit split exists */}
                            {hasUnitSplit && (
                              <div className="text-center">
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-1 rounded whitespace-nowrap">
                                  → {effectivePercent}%
                                </span>
                              </div>
                            )}

                            {/* Delete Button */}
                            <div className="flex items-center justify-center">
                              {employeeAllocations.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newAllocs = employeeAllocations.filter((_, i) => i !== idx);
                                    const newOthersTotal = newAllocs.filter((_, i) => i !== 0).reduce((s, a) => s + a.percent, 0);
                                    if (newAllocs.length > 0) newAllocs[0].percent = Math.max(0, 100 - newOthersTotal);
                                    setEmployeeAllocations(newAllocs);
                                    if (idx === 0 && newAllocs.length > 0) {
                                      setSalespersonId(newAllocs[0].employeeId);
                                    }
                                  }}
                                  className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : <div className="w-[14px]" />}
                            </div>

                            {/* Role Badge */}
                            <div className="flex items-center justify-center">
                              {isLead ? (
                                <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-1 rounded whitespace-nowrap">CHÍNH</span>
                              ) : (
                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-1.5 py-1 rounded whitespace-nowrap">PHỤ</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {employeeAllocations.length === 0 && (
                        <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr 80px 36px 48px' }}>
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                setEmployeeAllocations([{ employeeId: e.target.value, percent: 100, role: 'lead' }]);
                                setSalespersonId(e.target.value);
                              }
                            }}
                            className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold outline-none"
                          >
                            <option value="">-- Chọn NV --</option>
                            {filteredSales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <div /><div /><div />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (employeeAllocations.length === 0) {
                            setEmployeeAllocations([{ employeeId: '', percent: 100, role: 'lead' }]);
                          } else {
                            const newAllocs = [...employeeAllocations];
                            const currentOthersTotal = newAllocs.filter((_, i) => i !== 0).reduce((s, a) => s + a.percent, 0);
                            const defaultPercent = Math.min(30, Math.max(1, 100 - currentOthersTotal - 1));
                            newAllocs.push({ employeeId: '', percent: defaultPercent, role: 'member' });
                            newAllocs[0].percent = Math.max(0, 100 - currentOthersTotal - defaultPercent);
                            setEmployeeAllocations(newAllocs);
                          }
                        }}
                        className="text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center gap-1 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors mt-1"
                      >
                        <Plus size={10} /> Thêm nhân viên
                      </button>
                    </div>
                  </div>
                </div>

                {/* Support Allocations */}
                <div className="mt-4">
                  <UnitAllocationsInput
                    units={units}
                    employees={salespeople}
                    leadUnitId={unitId}
                    allocations={unitAllocations}
                    onChange={setUnitAllocations}
                    onLeadEmployeeChange={setSalespersonId}
                  />
                </div>
              </section>

            )}

            {/* 2. THÔNG TIN KHÁCH HÀNG & NỘI DUNG (Part of Step 1) */}
            {currentStep === 1 && (
              <section className="space-y-6 animate-in slide-in-from-right-8 duration-500 delay-100">
                <div className="flex items-center gap-3 border-l-4 border-slate-600 pl-4">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <Building2 size={16} /> Thông tin Khách hàng & Nội dung
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Loại hồ sơ</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setContractType('HĐ')}
                        className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all border ${contractType === 'HĐ'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-none'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                          }`}
                      >
                        📋 Hợp đồng
                      </button>
                      <button
                        type="button"
                        onClick={() => setContractType('VV')}
                        className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all border ${contractType === 'VV'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-200 dark:shadow-none'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                          }`}
                      >
                        📁 Vụ việc
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Số hợp đồng (ID)</label>
                    <input
                      value={formContractId}
                      onChange={(e) => {
                        setFormContractId(e.target.value);
                        setIsIdTouched(true);
                      }}
                      placeholder="Nhập số hợp đồng..."
                      className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-sm font-bold focus:border-indigo-500 outline-none"
                    />
                    {/* Checkbox: Số HĐ KH */}
                    <label className="flex items-center gap-2 mt-2 cursor-pointer group">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${hasCustomerContractNumber
                        ? 'bg-indigo-500 border-indigo-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'
                        }`}
                        onClick={() => setHasCustomerContractNumber(!hasCustomerContractNumber)}
                      >
                        {hasCustomerContractNumber && (
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-500">Có số HĐ theo KH</span>
                    </label>
                    {hasCustomerContractNumber && (
                      <input
                        value={customerContractNumber}
                        onChange={(e) => setCustomerContractNumber(e.target.value)}
                        placeholder="Nhập số HĐ theo khách hàng..."
                        className="w-full px-5 py-2.5 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-bold focus:border-indigo-500 outline-none mt-1"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <SearchableSelect
                      label="Tên khách hàng"
                      value={customerId}
                      placeholder="Gõ để tìm khách hàng..."
                      getDisplayValue={(id) => id === customerId ? clientName : undefined}
                      onChange={(cId) => {
                        setCustomerId(cId);
                        // Fetch customer name when selected
                        if (cId) {
                          CustomerService.getById(cId).then(cust => {
                            if (cust) setClientName(cust.name);
                          });
                        } else {
                          setClientName('');
                        }
                      }}
                      onSearch={async (query) => {
                        const results = await CustomerService.search(query, 20);
                        return results
                          .filter(c => !c.type || c.type === 'Customer' || c.type === 'Both')
                          .map(c => ({ id: c.id, name: c.name, subText: c.industry }));
                      }}
                      onAddNew={() => setShowAddCustomerDialog(true)}
                      addNewLabel="+ Thêm khách hàng mới"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Ngày ký kết</label>
                    <input
                      type="date"
                      value={signedDate}
                      onChange={(e) => setSignedDate(e.target.value)}
                      className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-sm font-bold focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
                {/* Options Row: VAT Toggle + Dealer Sale */}
                <div className="flex flex-wrap items-start gap-6 mt-2">
                  {/* VAT note - now per line item in Step 2 */}
                  <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-bold flex items-center gap-1.5">
                    <Percent size={10} /> VAT được thiết lập riêng cho từng SP/DV ở Bước 2
                  </span>

                  {/* Dealer Sale Checkbox + End User */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isDealerSale
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'border-slate-300 dark:border-slate-600 group-hover:border-amber-400'
                        }`}
                        onClick={() => {
                          setIsDealerSale(!isDealerSale);
                          if (isDealerSale) {
                            setEndUserId(null);
                            setEndUserName('');
                          }
                        }}
                      >
                        {isDealerSale && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Bán qua đại lý</span>
                      {isDealerSale && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black rounded-full uppercase">
                          Khách hàng ở trên = Đại lý
                        </span>
                      )}
                    </label>

                    {isDealerSale && (
                      <div className="ml-8 space-y-2 animate-in slide-in-from-top-2 duration-300">
                        <SearchableSelect
                          label="Người dùng cuối (End User)"
                          value={endUserId}
                          placeholder="Gõ để tìm End User..."
                          getDisplayValue={(id) => id === endUserId ? endUserName : undefined}
                          onChange={(euId) => {
                            setEndUserId(euId);
                            if (euId) {
                              CustomerService.getById(euId).then(cust => {
                                if (cust) setEndUserName(cust.name);
                              });
                            } else {
                              setEndUserName('');
                            }
                          }}
                          onSearch={async (query) => {
                            const results = await CustomerService.search(query, 20);
                            return results
                              .filter(c => !c.type || c.type === 'Customer' || c.type === 'Both')
                              .map(c => ({ id: c.id, name: c.name, subText: c.industry }));
                          }}
                          onAddNew={() => setShowAddEndUserDialog(true)}
                          addNewLabel="+ Thêm End User mới"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Removed Manual Value Input per request */}


                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Nội dung hợp đồng</label>
                  <textarea
                    placeholder="VD: Tư vấn giải pháp BIM, Đào tạo chuyên sâu phần mềm Plaxis 3D..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-sm font-bold focus:border-indigo-500 outline-none h-20"
                  ></textarea>
                </div>

                {/* Multi-contact List */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Đầu mối liên hệ phía khách hàng</label>
                    <button onClick={addContact} className="flex items-center gap-1 text-indigo-600 font-black text-[10px] uppercase">
                      <Plus size={12} /> Thêm đầu mối
                    </button>
                  </div>
                  <div className="space-y-3">
                    {contacts.map((contact, index) => (
                      <div key={contact.id} className="grid grid-cols-12 gap-3 items-center animate-in slide-in-from-left-2 duration-300">
                        <div className="col-span-5">
                          <input placeholder="Họ tên..." className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-xs font-bold" />
                        </div>
                        <div className="col-span-6">
                          <input placeholder="Vai trò (Mua sắm, Kế toán, Kỹ thuật...)" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg text-xs font-bold" />
                        </div>
                        <div className="col-span-1 text-center">
                          {contacts.length > 1 && (
                            <button onClick={() => removeContact(contact.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

            )}

            {/* 3. PHƯƠNG ÁN KINH DOANH */}
            {currentStep === 2 && (
              <section className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-4">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <Briefcase size={16} /> Phương án kinh doanh
                  </h3>
                </div>

                <div className="pl-4 border-l border-slate-200 dark:border-slate-800 space-y-8">
                  {/* 3.1 CHI TIẾT SẢN PHẨM & DỊCH VỤ CUNG CẤP */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Package size={14} /> Chi tiết Sản phẩm & Dịch vụ
                      </h4>
                      <div className="flex items-center gap-2">
                        <PAKDImportButton
                          onImport={async (data) => {
                            toast.loading('Đang xử lý import PAKD...');

                            try {
                              // Detect VAT rate from PAKD (Sản lượng / Doanh thu ratio)
                              const detectedVat = data.financials?.vatRate ?? 10;
                              console.log(`[PAKD Import] VAT rate: ${detectedVat}%`);

                              // Process each line item - findOrCreate products and suppliers
                              const processedItems: LineItem[] = [];

                              for (let i = 0; i < data.lineItems.length; i++) {
                                const item = data.lineItems[i];

                                // Find or create product
                                let productName = item.name;
                                if (item.name && item.name.trim() !== '') {
                                  try {
                                    const product = await ProductService.findOrCreate(
                                      item.name,
                                      item.unitCost,
                                      item.unitPrice
                                    );
                                    productName = product.name;
                                    // Refresh products list
                                    const allProducts = await ProductService.getAll();
                                    setProducts(allProducts);
                                  } catch (e) {
                                    console.warn('[PAKD Import] Could not create product:', e);
                                  }
                                }

                                // Find or create supplier
                                let supplierName = item.supplier || '';
                                if (item.supplier && item.supplier.trim() !== '') {
                                  try {
                                    const supplier = await CustomerService.findOrCreateSupplier(item.supplier);
                                    supplierName = supplier.name;
                                    // Refresh suppliers list  
                                    const allSuppliers = await CustomerService.getAll({ type: 'Supplier' });
                                    setSuppliers(allSuppliers.data);
                                  } catch (e) {
                                    console.warn('[PAKD Import] Could not create supplier:', e);
                                  }
                                }

                                // Calculate direct costs from individual fees
                                const directCostsTotal = item.importFee + item.contractorTax + item.transferFee;

                                processedItems.push({
                                  id: `imported-${Date.now()}-${i}`,
                                  name: productName,
                                  supplier: supplierName,
                                  quantity: item.quantity,
                                  inputPrice: item.unitCost,
                                  outputPrice: item.unitPrice,
                                  directCosts: directCostsTotal,
                                  directCostDetails: [
                                    { id: `dc-import-${i}`, name: 'Nhập khẩu', amount: item.importFee },
                                    { id: `dc-tax-${i}`, name: 'Thuế nhà thầu', amount: item.contractorTax },
                                    { id: `dc-transfer-${i}`, name: 'Chuyển tiền', amount: item.transferFee },
                                  ],
                                  foreignCurrency: item.foreignCurrency ? {
                                    amount: item.foreignCurrency.amount,
                                    rate: item.foreignCurrency.rate,
                                    currency: item.foreignCurrency.currency,
                                  } : undefined,
                                  vatRate: detectedVat,
                                  supplierDiscount: 0,
                                });
                              }

                              setLineItems(processedItems);

                              // Map admin costs (without supplierDiscount)
                              setAdminCosts({
                                transferFee: data.adminCosts.bankFee || 0,
                                contractorTax: data.adminCosts.subcontractorFee || 0,
                                importFee: data.adminCosts.importLogistics || 0,
                                expertHiring: data.adminCosts.expertFee || 0,
                                documentProcessing: data.adminCosts.documentFee || 0,
                              });

                              // Supplier discount from Excel - now stored per line item
                              const supplierDiscountFromExcel = data.adminCosts.supplierDiscount || 0;
                              const importedTotalInput = processedItems.reduce(
                                (acc, item) => acc + (item.quantity * item.inputPrice), 0
                              );
                              if (supplierDiscountFromExcel > 0) {
                                const discountPct = importedTotalInput > 0
                                  ? Number(((supplierDiscountFromExcel / importedTotalInput) * 100).toFixed(2))
                                  : 0;
                                // Apply same discount % to all items
                                processedItems.forEach(item => { item.supplierDiscount = discountPct; });
                                setLineItems([...processedItems]); // trigger re-render
                              }

                              // Import execution costs from PAKD
                              if (data.executionCosts && data.executionCosts.length > 0) {
                                const importedExecutionCosts = data.executionCosts.map((cost, idx) => ({
                                  id: `pakd-exec-${Date.now()}-${idx}`,
                                  name: cost.name,
                                  amount: cost.amount,
                                  percentage: importedTotalInput > 0
                                    ? Number(((cost.amount / importedTotalInput) * 100).toFixed(2))
                                    : 0,
                                }));
                                setExecutionCosts(importedExecutionCosts);
                                console.log('[PAKD Import] Execution costs imported:', importedExecutionCosts);

                                // Save names for future suggestions
                                const costNames = importedExecutionCosts.map(c => c.name);
                                ExecutionCostService.bulkAdd(costNames).then(() => {
                                  ExecutionCostService.getAll().then(setExecutionCostTypes);
                                });
                              }

                              toast.dismiss();
                              toast.success(`Đã import ${processedItems.length} hạng mục + ${data.executionCosts?.length || 0} chi phí thực hiện!`);
                            } catch (error: any) {
                              toast.dismiss();
                              toast.error('Lỗi import PAKD: ' + (error.message || 'Unknown error'));
                              console.error('[PAKD Import] Error:', error);
                            }
                          }}
                        />
                        <button onClick={addLineItem} className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 transition-colors">
                          <Plus size={12} /> Thêm hạng mục
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                          <tr>
                            <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-tighter w-[320px]">Sản phẩm/Dịch vụ</th>
                            <th className="px-2 py-4 font-black text-slate-400 uppercase tracking-tighter w-10">SL</th>
                            <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-tighter w-[180px]">Nhà cung cấp</th>
                            <th className="px-3 py-4 font-black text-slate-400 uppercase tracking-tighter text-right w-[120px] whitespace-nowrap">Giá Đầu vào</th>
                            <th className="px-3 py-4 font-black text-cyan-500 uppercase tracking-tighter text-right w-[120px] whitespace-nowrap">TT Đầu vào</th>
                            <th className="px-3 py-4 font-black text-slate-400 uppercase tracking-tighter text-right w-[120px] whitespace-nowrap">Giá Đầu ra</th>
                            <th className="px-2 py-4 font-black text-emerald-500 uppercase tracking-tighter text-center w-14 whitespace-nowrap">VAT</th>
                            <th className="px-3 py-4 font-black text-indigo-400 uppercase tracking-tighter text-right w-[120px] whitespace-nowrap">TT Đầu ra</th>
                            <th className="px-3 py-4 font-black text-slate-400 uppercase tracking-tighter text-right w-[110px] whitespace-nowrap">CP Trực tiếp</th>
                            <th className="px-3 py-4 font-black text-slate-400 uppercase tracking-tighter text-right w-[110px] whitespace-nowrap">Chênh lệch</th>
                            <th className="px-4 py-4 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                          {lineItems.map((item, index) => {
                            const inputTotal = item.quantity * item.inputPrice;
                            const outputTotal = item.quantity * item.outputPrice;
                            const lineMargin = outputTotal - inputTotal - item.directCosts;
                            const lineMarginRate = outputTotal > 0 ? (lineMargin / outputTotal) * 100 : 0;

                            return (
                              <tr key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <td className="px-4 py-3">
                                  <SearchableSelect
                                    value={products.find(p => p.name === item.name)?.id || null}
                                    placeholder="Gõ để tìm SP..."
                                    getDisplayValue={(id) => {
                                      const prod = products.find(p => p.id === id);
                                      return prod?.name || item.name || undefined;
                                    }}
                                    onChange={(pId) => {
                                      const prod = pId ? products.find(p => p.id === pId) : null;
                                      const newList = [...lineItems];
                                      if (prod) {
                                        newList[index].name = prod.name;
                                        newList[index].inputPrice = prod.costPrice || 0;
                                        newList[index].outputPrice = prod.basePrice;
                                      } else {
                                        newList[index].name = '';
                                      }
                                      setLineItems(newList);
                                    }}
                                    onSearch={async (query) => {
                                      const results = await ProductService.search(query, 20);
                                      return results.map(p => ({ id: p.id, name: p.name, subText: p.category }));
                                    }}
                                    onAddNew={() => {
                                      setAddProductForIndex(index);
                                      setShowAddProductDialog(true);
                                    }}
                                    addNewLabel="+ Thêm sản phẩm mới"
                                  />
                                </td>
                                <td className="px-2 py-3">
                                  <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const newList = [...lineItems];
                                      newList[index].quantity = Number(e.target.value);
                                      setLineItems(newList);
                                    }}
                                    className="w-full bg-transparent font-black outline-none text-slate-800 dark:text-slate-200 dark:bg-slate-800"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <SearchableSelect
                                    value={suppliers.find(s => (s.shortName || s.name) === item.supplier)?.id || null}
                                    placeholder="Gõ để tìm NCC..."
                                    getDisplayValue={(id) => {
                                      const sup = suppliers.find(s => s.id === id);
                                      return sup ? (sup.shortName || sup.name) : item.supplier || undefined;
                                    }}
                                    onChange={(sId) => {
                                      const sup = sId ? suppliers.find(s => s.id === sId) : null;
                                      const newList = [...lineItems];
                                      newList[index].supplier = sup ? (sup.shortName || sup.name) : '';
                                      setLineItems(newList);
                                    }}
                                    onSearch={async (query) => {
                                      const results = await CustomerService.search(query, 20);
                                      return results
                                        .filter(c => c.type === 'Supplier' || c.type === 'Both')
                                        .map(c => ({ id: c.id, name: c.shortName || c.name, subText: c.industry }));
                                    }}
                                    onAddNew={() => {
                                      setAddSupplierForIndex(index);
                                      setShowAddSupplierDialog(true);
                                    }}
                                    addNewLabel="+ Thêm NCC mới"
                                  />
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="relative group/currency">
                                    <input
                                      type="text"
                                      value={item.inputPrice ? formatVND(item.inputPrice) : '0'}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/\./g, '');
                                        if (!/^\d*$/.test(raw)) return;
                                        const newList = [...lineItems];
                                        newList[index].inputPrice = Number(raw);
                                        setLineItems(newList);
                                      }}
                                      className="w-full bg-transparent font-bold text-slate-500 text-right outline-none"
                                    />
                                    {item.foreignCurrency && (
                                      <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 opacity-0 group-hover/currency:opacity-100 transition-opacity pointer-events-none">
                                        <div className="space-y-1.5">
                                          <div className="flex justify-between items-center">
                                            <span className="font-medium">&#x1F4B1; Đơn giá ngoại tệ</span>
                                            <span className="font-bold text-cyan-400">
                                              {new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(item.foreignCurrency.amount)} {item.foreignCurrency.currency}
                                            </span>
                                          </div>
                                          <div className="flex justify-between items-center border-t border-slate-700 pt-1.5">
                                            <span className="font-medium">&#x1F4CA; Tỷ giá</span>
                                            <span className="font-bold text-amber-400">
                                              {new Intl.NumberFormat('vi-VN').format(item.foreignCurrency.rate)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-3 text-right">
                                  <span className="font-bold text-cyan-600 dark:text-cyan-400">{formatVND(inputTotal)}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <input
                                    type="text"
                                    value={item.outputPrice ? formatVND(item.outputPrice) : '0'}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/\./g, '');
                                      if (!/^\d*$/.test(raw)) return;
                                      const newList = [...lineItems];
                                      newList[index].outputPrice = Number(raw);
                                      setLineItems(newList);
                                    }}
                                    className="w-full bg-transparent font-bold text-indigo-600 text-right outline-none"
                                  />
                                </td>
                                {/* VAT % dropdown */}
                                <td className="px-2 py-3 text-center">
                                  <select
                                    value={item.vatRate ?? 10}
                                    onChange={(e) => {
                                      const newList = [...lineItems];
                                      newList[index].vatRate = Number(e.target.value);
                                      setLineItems(newList);
                                    }}
                                    className="w-full bg-transparent text-center font-bold text-emerald-600 dark:text-emerald-400 text-[11px] outline-none cursor-pointer border border-transparent hover:border-emerald-300 dark:hover:border-emerald-600 rounded px-0.5 py-0.5"
                                  >
                                    <option value={0}>0%</option>
                                    <option value={8}>8%</option>
                                    <option value={10}>10%</option>
                                  </select>
                                </td>
                                <td className="px-3 py-3 text-right">
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatVND(outputTotal)}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="relative group/costs">
                                    <input
                                      type="text"
                                      readOnly
                                      onClick={() => openCostModal(index)}
                                      value={item.directCosts ? formatVND(item.directCosts) : '0'}
                                      className="w-full bg-transparent font-bold text-rose-500 text-right outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1"
                                    />
                                    {/* Hover Tooltip */}
                                    {item.directCostDetails && item.directCostDetails.length > 0 && (
                                      <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 opacity-0 group-hover/costs:opacity-100 transition-opacity pointer-events-none">
                                        <div className="space-y-1">
                                          {item.directCostDetails.map((detail, i) => (
                                            <div key={i} className="flex justify-between items-center border-b border-slate-700 pb-1 last:border-0 last:pb-0">
                                              <span className="font-medium">{detail.name}</span>
                                              <span className="font-bold">{formatVND(detail.amount)}</span>
                                            </div>
                                          ))}
                                          <div className="pt-2 mt-1 border-t border-slate-700 flex justify-between">
                                            <span className="font-bold uppercase opacity-70">Tổng</span>
                                            <span className="font-black text-emerald-400">{formatVND(item.directCosts)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex flex-col items-end">
                                    <span className={`font-black ${lineMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatVND(lineMargin)}</span>
                                    <span className="text-[9px] font-bold text-slate-400">{lineMarginRate.toFixed(1)}%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {lineItems.length > 1 && (
                                    <button onClick={() => removeLineItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {/* TOTALS FOOTER */}
                        <tfoot className="bg-slate-100 dark:bg-slate-800 font-black text-slate-700 dark:text-slate-200 border-t-2 border-slate-200 dark:border-slate-800">
                          <tr>
                            <td colSpan={3} className="px-4 py-4 text-left uppercase text-xs tracking-widest text-slate-500">
                              Tổng cộng
                            </td>
                            <td className="px-4 py-4 text-right text-slate-600 dark:text-slate-400">
                              {formatVND(totals.totalInput)}
                            </td>
                            <td className="px-3 py-4 text-right text-cyan-600 font-black">
                              {formatVND(lineItems.reduce((acc, item) => acc + (item.quantity * item.inputPrice), 0))}
                            </td>
                            <td className="px-4 py-4 text-right text-indigo-600">
                              {formatVND(totals.signingValue)}
                            </td>
                            <td className="px-2 py-4"></td>{/* VAT spacer */}
                            <td className="px-3 py-4 text-right text-indigo-600 font-black">
                              {formatVND(lineItems.reduce((acc, item) => acc + (item.quantity * item.outputPrice), 0))}
                            </td>
                            <td className="px-4 py-4 text-right text-rose-500">
                              {formatVND(totals.totalDirectCosts)}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className={totals.signingValue - totals.totalInput - totals.totalDirectCosts >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                {formatVND(totals.signingValue - totals.totalInput - totals.totalDirectCosts)}
                              </span>
                            </td>
                            <td className="px-4 py-4"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>


                  {/* 3.2 CHI PHÍ THỰC HIỆN & CHIẾT KHẤU */}
                  <div className="flex flex-wrap items-start gap-6 mt-10">
                    {/* Chi phí thực hiện HĐ */}
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2 flex-1 min-w-[320px] max-w-xl">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Calculator size={14} /> Chi phí thực hiện hợp đồng
                        </h4>
                        <button
                          onClick={addExecutionCost}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                        >
                          <Plus size={12} /> Thêm hạng mục
                        </button>
                      </div>

                      {executionCosts.length === 0 ? (
                        <div className="text-center py-3 text-slate-400 dark:text-slate-500 text-xs">
                          <p>Chưa có chi phí thực hiện. Nhấn "Thêm hạng mục" để bắt đầu.</p>
                        </div>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-400 text-[10px] uppercase">
                              <th className="text-left py-1 px-1 w-6">#</th>
                              <th className="text-left py-1 px-1">Hạng mục</th>
                              <th className="text-right py-1 px-1 w-24">%</th>
                              <th className="text-right py-1 px-1 w-28">Số tiền</th>
                              <th className="w-6"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {executionCosts.map((cost, idx) => (
                              <tr key={cost.id} className="group border-b border-slate-100 dark:border-slate-800 last:border-0">
                                <td className="py-1 px-1 text-slate-400 font-medium">{idx + 1}</td>
                                <td className="py-2 px-2">
                                  <input
                                    type="text"
                                    list="execution-cost-names"
                                    placeholder="Tên chi phí..."
                                    value={cost.name}
                                    onChange={(e) => updateExecutionCost(cost.id, 'name', e.target.value)}
                                    onBlur={(e) => {
                                      const name = e.target.value;
                                      if (name && name.trim() !== '') {
                                        ExecutionCostService.findOrCreate(name).then(() => {
                                          ExecutionCostService.getAll().then(setExecutionCostTypes);
                                        });
                                      }
                                    }}
                                    className="w-full px-2 py-1 bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 text-xs font-medium outline-none transition-colors"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="0"
                                      value={cost.percentage || ''}
                                      onChange={(e) => {
                                        const pct = Number(e.target.value);
                                        const amount = Math.round((pct / 100) * totals.totalInput);
                                        setExecutionCosts(prev => prev.map(c => c.id === cost.id ? { ...c, percentage: pct, amount } : c));
                                      }}
                                      className="w-full px-1 py-1 bg-transparent border-0 text-xs font-bold text-right outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400 font-bold flex-shrink-0">%</span>
                                  </div>
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="text"
                                    value={cost.amount ? formatVND(cost.amount) : '0'}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/\./g, '');
                                      if (!/^\d*$/.test(raw)) return;
                                      const val = Number(raw);
                                      const pct = totals.totalInput > 0 ? Number(((val / totals.totalInput) * 100).toFixed(2)) : 0;
                                      setExecutionCosts(prev => prev.map(c => c.id === cost.id ? { ...c, amount: val, percentage: pct } : c));
                                    }}
                                    className="w-full px-2 py-1 bg-transparent border-0 text-xs font-black text-right outline-none"
                                  />
                                </td>
                                <td className="py-2 px-1">
                                  <button
                                    onClick={() => removeExecutionCost(cost.id)}
                                    className="p-1 text-slate-300 hover:text-rose-500 rounded opacity-0 group-hover:opacity-100 transition-all"
                                    title="Xóa"
                                  >
                                    <X size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200 dark:border-slate-600">
                              <td colSpan={3} className="py-2 px-2 text-right text-[10px] font-bold text-slate-400 uppercase">Tổng chi phí thực hiện:</td>
                              <td className="py-2 px-2 text-right text-sm font-black text-rose-600 dark:text-rose-400">
                                {formatVND(executionCosts.reduce((sum, c) => sum + (c.amount || 0), 0))}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>

                  </div>
                </div>
              </section >
            )}

            {/* 4. Financial Schedules (Hóa đơn & Tiền về & Chi trả NCC) */}
            {
              currentStep === 3 && (
                <section className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                  <div className="flex items-center gap-3 border-l-4 border-amber-500 pl-4">
                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                      <Wallet size={16} /> Kế hoạch Doanh thu & Tiền về
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Revenue Schedules */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Lịch xuất hóa đơn doanh thu</p>
                        <button onClick={() => setRevenueSchedules([...revenueSchedules, { id: Date.now().toString(), date: '', amount: 0, description: 'Đợt mới' }])} className="text-indigo-600 font-bold text-[10px]">+ Thêm đợt</button>
                      </div>
                      <div className="space-y-3">
                        {revenueSchedules.map((rev, idx) => (
                          <div key={rev.id} className="grid grid-cols-12 gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <div className="col-span-4 space-y-1">
                              <label className="text-[9px] text-slate-400 font-bold uppercase">Ngày XHĐ</label>
                              <input
                                type="date"
                                value={rev.date}
                                onChange={(e) => {
                                  const newSched = [...revenueSchedules];
                                  newSched[idx].date = e.target.value;
                                  setRevenueSchedules(newSched);
                                }}
                                className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-slate-200"
                              />
                            </div>
                            <div className="col-span-4 space-y-1">
                              <label className="text-[9px] text-slate-400 font-bold uppercase">Giai đoạn</label>
                              <input
                                placeholder="Giai đoạn..."
                                value={rev.description}
                                onChange={(e) => {
                                  const newSched = [...revenueSchedules];
                                  newSched[idx].description = e.target.value;
                                  setRevenueSchedules(newSched);
                                }}
                                className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-slate-200"
                              />
                            </div>
                            <div className="col-span-4 space-y-1 text-right">
                              <label className="text-[9px] text-slate-400 font-bold uppercase">Tiền (VAT)</label>
                              <div className="flex items-center justify-end gap-2">
                                <input
                                  type="number"
                                  placeholder="Tiền..."
                                  value={rev.amount}
                                  onChange={(e) => {
                                    const newSched = [...revenueSchedules];
                                    newSched[idx].amount = Number(e.target.value);
                                    setRevenueSchedules(newSched);
                                  }}
                                  className="w-full bg-transparent text-[11px] font-black text-right outline-none text-slate-800 dark:text-slate-200"
                                />
                                {revenueSchedules.length > 1 && (
                                  <button onClick={() => setRevenueSchedules(revenueSchedules.filter(r => r.id !== rev.id))} className="text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0">
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Schedules (Incoming) */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Kế hoạch Tiền về (Từ Khách hàng)</p>
                        <button onClick={() => setPaymentSchedules([...paymentSchedules, { id: Date.now().toString(), date: '', amount: 0, description: '', status: 'Pending', percentage: 0, type: 'Revenue' }])} className="text-emerald-600 font-bold text-[10px]">+ Thêm đợt</button>
                      </div>
                      <div className="space-y-3">
                        {paymentSchedules.map((pay, idx) => (
                          <div key={pay.id} className="grid grid-cols-12 gap-2 bg-emerald-50/50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800">
                            <div className="col-span-4 space-y-1">
                              <label className="text-[9px] text-slate-400 font-bold uppercase">Ngày thanh toán</label>
                              <input
                                type="date"
                                value={pay.date}
                                onChange={(e) => {
                                  const newSched = [...paymentSchedules];
                                  newSched[idx].date = e.target.value;
                                  setPaymentSchedules(newSched);
                                }}
                                className="w-full bg-transparent text-[11px] font-bold outline-none"
                              />
                            </div>
                            <div className="col-span-4 space-y-1">
                              <label className="text-[9px] text-slate-400 font-bold uppercase">Nội dung</label>
                              <input
                                placeholder="Nội dung..."
                                value={pay.description}
                                onChange={(e) => {
                                  const newSched = [...paymentSchedules];
                                  newSched[idx].description = e.target.value;
                                  setPaymentSchedules(newSched);
                                }}
                                className="w-full bg-transparent text-[11px] font-bold outline-none"
                              />
                            </div>
                            <div className="col-span-4 space-y-1 text-right">
                              <label className="text-[9px] text-slate-400 font-bold uppercase">Số tiền</label>
                              <div className="flex items-center justify-end gap-2">
                                <input
                                  type="number"
                                  placeholder="Tiền..."
                                  value={pay.amount}
                                  onChange={(e) => {
                                    const newSched = [...paymentSchedules];
                                    newSched[idx].amount = Number(e.target.value);
                                    setPaymentSchedules(newSched);
                                  }}
                                  className="w-full bg-transparent text-[11px] font-black text-right outline-none text-emerald-600"
                                />
                                {paymentSchedules.length > 1 && (
                                  <button onClick={() => setPaymentSchedules(paymentSchedules.filter(p => p.id !== pay.id))} className="text-emerald-400 hover:text-rose-500 transition-colors flex-shrink-0">
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest">Kế hoạch Chi trả Nhà cung cấp</p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={generateSupplierSchedules}
                          className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-bold flex items-center gap-1.5 hover:bg-indigo-100 transition-colors"
                        >
                          <Calculator size={10} /> Tự động tính từ SP
                        </button>
                      </div>
                      <button onClick={() => setSupplierSchedules([...supplierSchedules, { id: Date.now().toString(), date: '', amount: 0, description: '', status: 'Pending', percentage: 0, type: 'Expense' }])} className="text-rose-600 font-bold text-[10px]">+ Thêm đợt chi</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {supplierSchedules.map((pay, idx) => (
                        <div key={pay.id} className="grid grid-cols-12 gap-2 bg-rose-50/50 dark:bg-rose-900/10 p-3 rounded-lg border border-rose-100 dark:border-rose-800">
                          <div className="col-span-4 space-y-1">
                            <label className="text-[9px] text-slate-400 font-bold uppercase">Hạn thanh toán</label>
                            <input
                              type="date"
                              value={pay.date}
                              onChange={(e) => {
                                const newSched = [...supplierSchedules];
                                newSched[idx].date = e.target.value;
                                setSupplierSchedules(newSched);
                              }}
                              className="w-full bg-transparent text-[11px] font-bold outline-none"
                            />
                          </div>
                          <div className="col-span-4 space-y-1">
                            <label className="text-[9px] text-slate-400 font-bold uppercase">Nhà cung cấp / Nội dung</label>
                            <input
                              placeholder="Chi cho..."
                              value={pay.description}
                              onChange={(e) => {
                                const newSched = [...supplierSchedules];
                                newSched[idx].description = e.target.value;
                                setSupplierSchedules(newSched);
                              }}
                              className="w-full bg-transparent text-[11px] font-bold outline-none"
                            />
                          </div>
                          <div className="col-span-4 space-y-1 text-right">
                            <label className="text-[9px] text-slate-400 font-bold uppercase">Số tiền chi</label>
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number"
                                placeholder="Tiền..."
                                value={pay.amount}
                                onChange={(e) => {
                                  const newSched = [...supplierSchedules];
                                  newSched[idx].amount = Number(e.target.value);
                                  setSupplierSchedules(newSched);
                                }}
                                className="w-full bg-transparent text-[11px] font-black text-right outline-none text-rose-500"
                              />
                              <button onClick={() => setSupplierSchedules(supplierSchedules.filter(p => p.id !== pay.id))} className="text-rose-400 hover:text-rose-600 transition-colors flex-shrink-0">
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section >
              )
            }
          </div >
        </div >
      </div >

      {/* Direct Costs Modal */}
      < Modal
        isOpen={activeCostModalIndex !== null}
        onClose={() => setActiveCostModalIndex(null)}
        title="Chi tiết Chi phí Trực tiếp"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-bold text-indigo-600 mb-2">
              {activeCostModalIndex !== null && lineItems[activeCostModalIndex]?.name
                ? `Sản phẩm: ${lineItems[activeCostModalIndex].name}`
                : 'Chi tiết chi phí'}
            </h4>
            <p className="text-xs text-slate-500">Thêm các khoản chi phí trực tiếp liên quan đến sản phẩm/dịch vụ này.</p>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {tempCostDetails.map((detail, index) => (
              <div key={index} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <input
                  type="text"
                  placeholder="Tên chi phí (VD: Tiếp khách, Vận chuyển...)"
                  value={detail.name}
                  onChange={(e) => {
                    const newDetails = [...tempCostDetails];
                    newDetails[index].name = e.target.value;
                    setTempCostDetails(newDetails);
                  }}
                  className="flex-1 bg-transparent px-3 py-2 text-sm font-medium outline-none border-b border-transparent focus:border-indigo-500 transition-colors"
                  autoFocus
                />
                <div className="w-32 relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">₫</span>
                  <input
                    type="text"
                    value={detail.amount ? formatVND(detail.amount) : '0'}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\./g, '');
                      if (!/^\d*$/.test(raw)) return;
                      const newDetails = [...tempCostDetails];
                      newDetails[index].amount = Number(raw);
                      setTempCostDetails(newDetails);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-lg px-3 pl-6 py-2 text-sm font-bold text-right outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={() => {
                    const newDetails = tempCostDetails.filter((_, i) => i !== index);
                    setTempCostDetails(newDetails);
                  }}
                  className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setTempCostDetails([...tempCostDetails, { id: Date.now().toString(), name: '', amount: 0 }]);
            }}
            className="w-full py-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 font-bold text-sm hover:border-indigo-500 hover:text-indigo-500 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Thêm khoản chi phí
          </button>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase font-bold">Tổng chi phí</p>
              <p className="text-xl font-black text-rose-500">
                {formatVND(tempCostDetails.reduce((acc, item) => acc + item.amount, 0))}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setActiveCostModalIndex(null)}
                className="px-5 py-2.5 rounded-lg font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={saveCostModal}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center gap-2"
              >
                <Save size={16} /> Lưu cập nhật
              </button>
            </div>
          </div>
        </div>
      </Modal >

      {/* FOOTER */}
      < div className="px-10 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800 flex justify-between items-center" >
        <div className="flex items-center gap-6">
          <button onClick={() => { localStorage.removeItem('contract_form_draft'); onCancel(); }} className="px-6 py-3 text-slate-400 hover:text-rose-500 font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2">
            <X size={14} /> Hủy bỏ
          </button>
        </div>

        <div className="flex gap-3">
          {currentStep > 1 && (
            <button
              onClick={handleBack}
              className="px-8 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-[20px] font-black text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
            >
              Quay lại
            </button>
          )}

          {currentStep < 3 ? (
            <button
              onClick={handleNext}
              className="px-10 py-3 bg-indigo-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none hover:scale-105 active:scale-95"
            >
              Tiếp tục <Users size={16} />
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
      </div >

      {/* Data lists for suggestions */}
      <datalist id="execution-cost-names">
        {executionCostTypes.map(type => (
          <option key={type.id} value={type.name} />
        ))}
      </datalist>

      {/* Quick Add Customer Dialog */}
      <QuickAddCustomerDialog
        isOpen={showAddCustomerDialog}
        onClose={() => setShowAddCustomerDialog(false)}
        onCreated={(customer) => {
          setCustomerId(customer.id);
          setClientName(customer.name);
          toast.success(`Đã thêm khách hàng: ${customer.name}`);
        }}
      />

      {/* Quick Add End User Dialog (for dealer sales) */}
      <QuickAddCustomerDialog
        isOpen={showAddEndUserDialog}
        onClose={() => setShowAddEndUserDialog(false)}
        onCreated={(customer) => {
          setEndUserId(customer.id);
          setEndUserName(customer.name);
          toast.success(`Đã thêm End User: ${customer.name}`);
        }}
      />

      {/* Quick Add Product Dialog */}
      <QuickAddProductDialog
        isOpen={showAddProductDialog}
        onClose={() => { setShowAddProductDialog(false); setAddProductForIndex(null); }}
        onCreated={async (product) => {
          // Update line item with new product
          if (addProductForIndex !== null) {
            const newList = [...lineItems];
            newList[addProductForIndex].name = product.name;
            newList[addProductForIndex].inputPrice = product.costPrice || 0;
            newList[addProductForIndex].outputPrice = product.basePrice;
            setLineItems(newList);
          }
          // Refresh products list so it appears in dropdown
          const allProducts = await ProductService.getAll();
          setProducts(allProducts);
          toast.success(`Đã thêm SP: ${product.name}`);
        }}
      />

      {/* Quick Add Supplier Dialog */}
      <QuickAddSupplierDialog
        isOpen={showAddSupplierDialog}
        onClose={() => { setShowAddSupplierDialog(false); setAddSupplierForIndex(null); }}
        onCreated={async (supplier) => {
          // Update line item with new supplier
          if (addSupplierForIndex !== null) {
            const newList = [...lineItems];
            newList[addSupplierForIndex].supplier = supplier.shortName || supplier.name;
            setLineItems(newList);
          }
          // Refresh suppliers list
          const suppliersRes = await CustomerService.getAll({ pageSize: 100, type: 'Supplier' });
          setSuppliers(suppliersRes.data?.filter(c => c.type === 'Supplier' || c.type === 'Both') || []);
          toast.success(`Đã thêm NCC: ${supplier.shortName || supplier.name}`);
        }}
      />
    </div >
  );
};

export default ContractForm;
