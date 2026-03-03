// Custom hook that encapsulates ContractForm state management and business logic
import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Unit, Employee, Customer, Product, Contract, ContractType,
    LineItem, ContractContact, PaymentSchedule, RevenueSchedule,
    AdministrativeCosts, DirectCostDetail, ExecutionCostItem
} from '../types';
import { UnitService, CustomerService, ProductService, EmployeeService } from '../services';
import { useFinancialCalculations } from './useFinancialCalculations';

interface UseContractFormProps {
    contract?: Contract;
    isCloning?: boolean;
}

export function useContractForm({ contract, isCloning = false }: UseContractFormProps) {
    const isEditing = !!contract && !isCloning;

    // ==================== DATA OPTIONS ====================
    const [units, setUnits] = useState<Unit[]>([]);
    const [salespeople, setSalespeople] = useState<Employee[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [suppliers, setSuppliers] = useState<Customer[]>([]);

    // ==================== STEP 1: IDENTIFICATION ====================
    const [contractType, setContractType] = useState<ContractType>(contract?.contractType || 'HĐ');
    const [unitId, setUnitId] = useState(contract?.unitId || '');
    const [coordinatingUnitId, setCoordinatingUnitId] = useState(contract?.coordinatingUnitId || '');
    const [salespersonId, setSalespersonId] = useState(contract?.salespersonId || '');
    const [customerId, setCustomerId] = useState(contract?.customerId || null);
    const [title, setTitle] = useState(contract?.title || '');
    const [clientName, setClientName] = useState(contract?.partyA || '');
    const [signedDate, setSignedDate] = useState(contract?.signedDate || new Date().toISOString().split('T')[0]);
    const [contacts, setContacts] = useState<ContractContact[]>(
        contract?.contacts || [{ id: '1', name: '', role: 'Mua sắm' }]
    );

    // ==================== STEP 2: LINE ITEMS ====================
    const [lineItems, setLineItems] = useState<LineItem[]>(
        contract?.lineItems || [{ id: '1', name: '', quantity: 1, supplier: '', inputPrice: 0, outputPrice: 0, directCosts: 0, vatRate: 0 }]
    );

    // ==================== STEP 2: EXECUTION COSTS ====================
    const [executionCosts, setExecutionCosts] = useState<ExecutionCostItem[]>(
        contract?.executionCosts || []
    );

    // ==================== STEP 3: SCHEDULES ====================
    const [revenueSchedules, setRevenueSchedules] = useState<RevenueSchedule[]>(
        [{ id: '1', date: '', amount: 0, description: 'Đợt 1' }]
    );
    const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>(
        [{ id: '1', date: '', amount: 0, description: 'Tạm ứng', type: 'Revenue' }]
    );
    const [supplierSchedules, setSupplierSchedules] = useState<PaymentSchedule[]>(
        [{ id: '1', date: '', amount: 0, description: 'Thanh toán đợt 1', type: 'Expense' }]
    );

    // ==================== MODAL STATE ====================
    const [activeCostModalIndex, setActiveCostModalIndex] = useState<number | null>(null);
    const [tempCostDetails, setTempCostDetails] = useState<DirectCostDetail[]>([]);

    // ==================== WIZARD STATE ====================
    const [currentStep, setCurrentStep] = useState(1);

    // ==================== FETCH OPTIONS ====================
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const [unitsData, peopleData, productsData, suppliersRes] = await Promise.all([
                    UnitService.getAll(),
                    EmployeeService.getAll(),
                    ProductService.getAll(),
                    CustomerService.getAll({ pageSize: 100, type: 'Supplier' })
                ]);
                setUnits(unitsData);
                setSalespeople(peopleData);
                setProducts(productsData);
                setSuppliers(suppliersRes.data?.filter(c => c.type === 'Supplier' || c.type === 'Both') || []);

                if (!isEditing && !unitId && unitsData.length > 0) {
                    setUnitId(unitsData[0].id);
                }
            } catch (error) {
                console.error('Failed to fetch options:', error);
            }
        };
        fetchOptions();
    }, []);

    // Load existing payment phases from contract
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

    // ==================== COMPUTED VALUES (delegated to shared hook) ====================
    const financials = useFinancialCalculations(lineItems, executionCosts);

    const totals = useMemo(() => {
        const totalCashIn = paymentSchedules.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalCashOut = supplierSchedules.reduce((sum, p) => sum + (p.amount || 0), 0);
        const netCashFlow = totalCashIn - totalCashOut;

        return {
            ...financials,
            totalInputCosts: financials.totalInput,
            totalDirectCosts: financials.totalDirectCosts,

            totalCashIn,
            totalCashOut,
            netCashFlow,
        };
    }, [financials, paymentSchedules, supplierSchedules]);

    // Generate Contract ID
    const formContractId = useMemo(() => {
        if (contract?.id) return contract.id;
        const unit = units.find(u => u.id === unitId);
        const code = unit?.code || 'XX';
        const year = new Date().getFullYear().toString().slice(-2);
        const random = Math.floor(Math.random() * 900 + 100);
        return `${contractType.replace('HĐ', 'HD').replace('HĐK', 'HDK')}-${code}-${year}-${random}`;
    }, [contract, units, unitId, contractType]);

    // ==================== HANDLERS ====================
    const addContact = useCallback(() => {
        setContacts(prev => [...prev, { id: Date.now().toString(), name: '', role: '' }]);
    }, []);

    const removeContact = useCallback((id: string) => {
        setContacts(prev => prev.filter(c => c.id !== id));
    }, []);

    const addLineItem = useCallback(() => {
        setLineItems(prev => [...prev, {
            id: Date.now().toString(),
            name: '', quantity: 1, supplier: '', inputPrice: 0, outputPrice: 0, directCosts: 0, vatRate: 0
        }]);
    }, []);

    const removeLineItem = useCallback((id: string) => {
        setLineItems(prev => prev.filter(item => item.id !== id));
    }, []);

    const openCostModal = useCallback((index: number) => {
        setActiveCostModalIndex(index);
        setTempCostDetails(lineItems[index].directCostDetails || []);
    }, [lineItems]);

    const saveCostModal = useCallback(() => {
        if (activeCostModalIndex === null) return;
        const totalCost = tempCostDetails.reduce((sum, d) => sum + d.amount, 0);
        const newItems = [...lineItems];
        newItems[activeCostModalIndex] = {
            ...newItems[activeCostModalIndex],
            directCosts: totalCost,
            directCostDetails: tempCostDetails
        };
        setLineItems(newItems);
        setActiveCostModalIndex(null);
    }, [activeCostModalIndex, tempCostDetails, lineItems]);

    const handleNext = useCallback(() => {
        if (currentStep === 1) {
            if (!unitId || !customerId || !title) {
                toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
                return;
            }
        }
        setCurrentStep(prev => Math.min(prev + 1, 3));
    }, [currentStep, unitId, customerId, title]);

    const handleBack = useCallback(() => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    }, []);

    const generateSupplierSchedules = useCallback(() => {
        const grouped: Record<string, number> = {};
        lineItems.forEach(item => {
            if (!item.supplier) return;
            const key = item.supplier;
            const cost = item.inputPrice * item.quantity + (item.directCosts || 0);
            grouped[key] = (grouped[key] || 0) + cost;
        });

        const newSchedules: PaymentSchedule[] = Object.entries(grouped).map(([supplier, amount], i) => ({
            id: `auto-${i}`,
            date: '',
            amount,
            description: `Thanh toán ${supplier}`,
            type: 'Expense'
        }));

        if (newSchedules.length > 0) {
            setSupplierSchedules(newSchedules);
            toast.success(`Đã tạo ${newSchedules.length} lịch thanh toán NCC`);
        } else {
            toast.info('Không có NCC nào trong danh sách sản phẩm');
        }
    }, [lineItems]);

    const formatVND = useCallback((val: number): string => {
        return new Intl.NumberFormat('vi-VN').format(val);
    }, []);

    // ==================== BUILD SAVE DATA ====================
    const buildSaveData = useCallback(() => {
        // Combine schedules into paymentPhases
        const allPhases = [
            ...paymentSchedules.map(p => ({
                ...p,
                name: p.description,
                dueDate: p.date,
                type: 'Revenue' as const
            })),
            ...supplierSchedules.map(p => ({
                ...p,
                name: p.description,
                dueDate: p.date,
                type: 'Expense' as const
            }))
        ];

        return {
            contractId: formContractId,
            contractType,
            title,
            partyA: clientName,
            customerId,
            signedDate,
            unitId,
            coordinatingUnitId: coordinatingUnitId || null,
            salespersonId: salespersonId || null,
            value: totals.signingValue,
            lineItems,
            paymentPhases: allPhases,
            contacts,

            executionCosts,
            status: 'Draft' as const,
        };
    }, [
        formContractId, contractType, title, clientName, customerId, signedDate,
        unitId, coordinatingUnitId, salespersonId, totals.signingValue,
        lineItems, paymentSchedules, supplierSchedules, contacts, executionCosts
    ]);

    return {
        // Data options
        units, salespeople, products, suppliers,

        // Step 1
        contractType, setContractType,
        unitId, setUnitId,
        coordinatingUnitId, setCoordinatingUnitId,
        salespersonId, setSalespersonId,
        customerId, setCustomerId,
        title, setTitle,
        clientName, setClientName,
        signedDate, setSignedDate,
        contacts, setContacts,
        addContact, removeContact,

        // Step 2
        lineItems, setLineItems,
        addLineItem, removeLineItem,

        executionCosts, setExecutionCosts,

        // Step 3
        paymentSchedules, setPaymentSchedules,
        supplierSchedules, setSupplierSchedules,
        generateSupplierSchedules,

        // Modal
        activeCostModalIndex, setActiveCostModalIndex,
        tempCostDetails, setTempCostDetails,
        openCostModal, saveCostModal,

        // Wizard
        currentStep, setCurrentStep,
        handleNext, handleBack,

        // Computed
        totals,
        formContractId,
        isEditing,

        // Helpers
        formatVND,
        buildSaveData,
    };
}
