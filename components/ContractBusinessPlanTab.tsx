import React, { useState, useEffect } from 'react';
import { ApprovalStepper } from './workflow/ApprovalStepper';
import { ActionPanel } from './workflow/ActionPanel';
import { ReviewLog } from './workflow/ReviewLog';
import { RejectDialog } from './workflow/RejectDialog';
import { PLAN_STATUS_LABELS } from '../constants';
import { Contract, BusinessPlan, PaymentPhase, UserProfile, LineItem, AdministrativeCosts, Product, Customer, DirectCostDetail, PaymentSchedule, ExecutionCostItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { WorkflowService, ProductService, CustomerService } from '../services';
import { toast } from 'sonner';
import { Check, X, AlertTriangle, Send, FileText, Lock, Plus, Trash2, Percent, DollarSign, Calculator, RotateCcw, Wallet, ArrowDownCircle, ArrowUpCircle, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import Modal from './ui/Modal';
import SearchableSelect from './ui/SearchableSelect';
import QuickAddProductDialog from './ui/QuickAddProductDialog';

interface Props {
    contract: Contract;
    onUpdate: () => void;
}

const ContractBusinessPlanTab: React.FC<Props> = ({ contract, onUpdate }) => {
    // ... (keep hooks and state)
    const { profile, canEdit: canEditResource, canApprove } = useAuth();
    const [plan, setPlan] = useState<BusinessPlan | null>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);

    // Data Options State (for dropdowns)
    const [products, setProducts] = useState<Product[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);

    // Editable Local State
    const [lineItems, setLineItems] = useState<LineItem[]>(contract.lineItems || []);
    // Form State for dynamic execution costs
    const [executionCosts, setExecutionCosts] = useState<ExecutionCostItem[]>(contract.executionCosts || []);

    // Payment Schedules State (Dòng tiền)
    const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>(
        (contract.paymentPhases?.filter(p => !p.type || p.type === 'Revenue') || []).map(p => ({
            id: p.id || Date.now().toString(),
            date: p.dueDate || '',
            amount: p.amount || 0,
            description: p.name || '',
            status: 'Pending',
            type: 'Revenue'
        })) || [{ id: '1', date: '', amount: 0, description: 'Tạm ứng', type: 'Revenue' }]
    );
    const [supplierSchedules, setSupplierSchedules] = useState<PaymentSchedule[]>(
        (contract.paymentPhases?.filter(p => p.type === 'Expense') || []).map(p => ({
            id: p.id || Date.now().toString(),
            date: p.dueDate || '',
            amount: p.amount || 0,
            description: p.name || '',
            status: 'Pending',
            type: 'Expense'
        })) || [{ id: '1', date: '', amount: 0, description: 'Thanh toán NCC đợt 1', type: 'Expense' }]
    );

    // Direct Costs Modal State
    const [activeCostModalIndex, setActiveCostModalIndex] = useState<number | null>(null);
    const [tempCostDetails, setTempCostDetails] = useState<DirectCostDetail[]>([]);

    // Quick Add Product Dialog State
    const [showAddProductDialog, setShowAddProductDialog] = useState(false);
    const [addProductForIndex, setAddProductForIndex] = useState<number | null>(null);

    // Fetch products and customers for dropdowns
    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const [productsData, customersRes] = await Promise.all([
                    ProductService.getAll(),
                    CustomerService.getAll({ pageSize: 200 }) // TODO: Optimize - only fetch suppliers with type filter
                ]);
                setProducts(productsData);
                setCustomers(customersRes.data || []);
            } catch (error) {
                console.error('Error fetching dropdown options:', error);
            }
        };
        fetchOptions();
    }, []);

    // Sync from contract when contract changes
    useEffect(() => {
        setLineItems(contract.lineItems || []);
        setExecutionCosts(contract.executionCosts || []);
    }, [contract.id]);

    // Form State - Auto-calculated from lineItems and adminCosts
    const [financials, setFinancials] = useState({
        signingValue: contract.value || 0,
        estimatedRevenue: 0,
        revenue: contract.value || 0,
        costs: contract.estimatedCost || 0,
        margin: 0,
        grossProfit: 0
    });

    useEffect(() => {
        const signingValue = lineItems.reduce((acc, item) => acc + (item.quantity * item.outputPrice * (1 + (item.vatRate ?? 10) / 100)), 0);
        const estimatedRevenue = lineItems.reduce((acc, item) => acc + (item.quantity * item.outputPrice), 0);
        const totalInput = lineItems.reduce((acc, item) => acc + (item.quantity * item.inputPrice), 0);
        const totalDirectCosts = lineItems.reduce((acc, item) => acc + (item.directCosts || 0), 0);
        const executionSum = executionCosts.reduce((acc, cost) => acc + (cost.amount || 0), 0);

        // Note: executionCosts already includes diverse fees
        // So totalDirectCosts is NOT added separately to avoid double-counting
        const costs = totalInput + executionSum;
        // Lợi nhuận gộp = Doanh thu (chưa VAT) - Chi phí
        const grossProfit = estimatedRevenue - costs;
        // Margin = Lợi nhuận / Doanh thu (chưa VAT)
        const margin = estimatedRevenue > 0 ? (grossProfit / estimatedRevenue) * 100 : 0;

        setFinancials({
            signingValue: signingValue,
            estimatedRevenue: estimatedRevenue,
            revenue: signingValue,
            costs: costs,
            margin: margin,
            grossProfit: grossProfit
        });
    }, [lineItems, executionCosts]);

    // Format VND helper
    const formatVND = (value: number) => new Intl.NumberFormat('vi-VN').format(Math.round(value / 1000) * 1000);

    const addLineItem = () => {
        setLineItems([...lineItems, {
            id: Date.now().toString(),
            name: '',
            quantity: 1,
            supplier: '',
            inputPrice: 0,
            outputPrice: 0,
            directCosts: 0,
            directCostDetails: [],
            vatRate: 10,
            supplierDiscount: 0
        }]);
    };

    const removeLineItem = (id: string) => {
        if (lineItems.length > 1) {
            setLineItems(lineItems.filter(item => item.id !== id));
        }
    };

    const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
        const newItems = [...lineItems];
        (newItems[index] as any)[field] = value;
        setLineItems(newItems);
    };

    // Direct Cost Modal functions
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

    const addExecutionCost = () => {
        setExecutionCosts([...executionCosts, {
            id: crypto.randomUUID(),
            name: '',
            amount: 0,
            percentage: 0
        }]);
    };

    const removeExecutionCost = (id: string) => {
        setExecutionCosts(executionCosts.filter(c => c.id !== id));
    };

    const updateExecutionCost = (id: string, field: keyof ExecutionCostItem, value: any) => {
        const newList = executionCosts.map(cost => {
            if (cost.id !== id) return cost;
            const newCost = { ...cost, [field]: value };

            // Auto calc percentage if amount changes
            if (field === 'amount' && financials.revenue > 0) {
                newCost.percentage = Number(((value / financials.revenue) * 100).toFixed(2));
            }
            // Auto calc amount if percentage changes
            if (field === 'percentage' && financials.revenue > 0) {
                newCost.amount = Math.round((value / 100) * financials.revenue);
            }
            return newCost;
        });
        setExecutionCosts(newList);
    };

    // Reset to original contract data
    const resetToOriginal = () => {
        setLineItems(contract.lineItems || []);
        setExecutionCosts(contract.executionCosts || []);
        toast.info('Đã khôi phục dữ liệu từ Hợp đồng gốc');
    };

    // ... (keep useEffect and fetchPlan)
    useEffect(() => {
        fetchPlan();
    }, [contract.id]);

    const fetchPlan = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('contract_business_plans')
            .select('*')
            .eq('contract_id', contract.id)
            .eq('is_active', true)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error("Error fetching plan:", error);
        }

        if (data) {
            setPlan({
                id: data.id,
                contractId: data.contract_id,
                version: data.version,
                status: data.status,
                financials: data.financials,
                isActive: data.is_active,
                createdBy: data.created_by,
                createdAt: data.created_at,
                approvedBy: data.approved_by,
                approvedAt: data.approved_at,
                notes: data.notes
            });

            // Fetch reviews
            const { data: reviewsData } = await supabase
                .from('contract_reviews')
                .select('*')
                .eq('plan_id', data.id)
                .order('created_at', { ascending: false });

            // Manually fetch reviewer profiles
            if (reviewsData && reviewsData.length > 0) {
                const reviewerIds = [...new Set(reviewsData.map(r => r.reviewer_id).filter(Boolean))];
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', reviewerIds);

                const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);
                const enrichedReviews = reviewsData.map(r => ({
                    ...r,
                    reviewer_profile: profileMap.get(r.reviewer_id)
                }));
                setReviews(enrichedReviews);
            } else {
                setReviews([]);
            }

            setFinancials({
                signingValue: data.financials.signingValue || contract.value || 0,
                estimatedRevenue: data.financials.estimatedRevenue || data.financials.revenue || 0,
                revenue: data.financials.revenue || contract.value || 0,
                costs: data.financials.costs || contract.estimatedCost || 0,
                margin: data.financials.margin || 0,
                grossProfit: data.financials.grossProfit || 0
            });
        } else {
            setFinancials({
                signingValue: contract.value || 0,
                estimatedRevenue: contract.value || 0,
                revenue: contract.value || 0,
                costs: contract.estimatedCost || 0,
                margin: contract.value ? ((contract.value - (contract.estimatedCost || 0)) / contract.value) * 100 : 0,
                grossProfit: (contract.value || 0) - (contract.estimatedCost || 0)
            });
        }
        setIsLoading(false);
    };

    const calculateMargin = (rev: number, cost: number) => {
        const profit = rev - cost;
        const margin = rev > 0 ? (profit / rev) * 100 : 0;
        return { profit, margin };
    };

    const handleSave = async () => {
        const { profit, margin } = calculateMargin(financials.revenue, financials.costs);

        // Combine payment schedules into paymentPhases format
        const allPaymentPhases = [
            ...paymentSchedules.map(p => ({ id: p.id, name: p.description, dueDate: p.date, amount: p.amount, type: 'Revenue' as const })),
            ...supplierSchedules.map(p => ({ id: p.id, name: p.description, dueDate: p.date, amount: p.amount, type: 'Expense' as const }))
        ];

        // 1. Update Contract with lineItems, executionCosts, paymentPhases
        const { error: contractError } = await supabase
            .from('contracts')
            .update({
                line_items: lineItems,
                execution_costs: executionCosts,
                payment_phases: allPaymentPhases,
                value: financials.revenue,
                estimated_cost: financials.costs
            })
            .eq('id', contract.id);

        if (contractError) {
            toast.error("Lỗi lưu Contract: " + contractError.message);
            return;
        }

        // 2. Save/Update PAKD
        const payload = {
            contract_id: contract.id,
            version: plan ? plan.version + 1 : 1,
            status: 'Approved', // Auto-approved - PAKD workflow temporarily disabled
            financials: {
                revenue: financials.revenue,
                costs: financials.costs,
                grossProfit: profit,
                margin: margin,
                lineItems: lineItems,
                executionCosts: executionCosts,
                cashflow: allPaymentPhases
            },
            is_active: true,
            created_by: profile?.id,
            notes: 'Updated manual plan'
        };

        if (plan && plan.status !== 'Draft') {
            // Create new version if current plan is not Draft
            const { error } = await supabase.from('contract_business_plans').insert(payload);
            if (error) { toast.error("Lỗi tạo phiên bản mới: " + error.message); return; }
        } else {
            if (plan?.id) {
                const { error } = await supabase.from('contract_business_plans')
                    .update({ financials: payload.financials, updated_at: new Date().toISOString() })
                    .eq('id', plan.id);
                if (error) { toast.error(error.message); return; }
            } else {
                const { error } = await supabase.from('contract_business_plans').insert(payload);
                if (error) { toast.error(error.message); return; }
            }
        }

        toast.success("Đã lưu PAKD!");
        setIsEditing(false);
        fetchPlan();
        onUpdate();
    };

    const handleAction = async (action: 'Submit' | 'Approve' | 'Reject') => {
        if (!plan) return;

        // Handle Reject via dialog
        if (action === 'Reject') {
            setShowRejectDialog(true);
            return;
        }

        try {
            let result;
            if (action === 'Submit') {
                result = await WorkflowService.submitPAKD(plan.id);
            } else if (action === 'Approve') {
                // Profile role check handled in service mostly
                if (!profile?.role && !profile?.email) return;
                result = await WorkflowService.approvePAKD(plan.id, profile?.role || 'NVKD');
            }

            if (result && result.success) {
                toast.success(`Đã thực hiện: ${action}`);
                fetchPlan();
                onUpdate();
            } else {
                toast.error(`Lỗi: ${result?.error?.message || 'Không xác định'}`);
            }

        } catch (err: any) {
            toast.error("Lỗi cập nhật trạng thái: " + err.message);
        }
    };

    const handleReject = async (reason: string) => {
        if (!plan) return;
        setIsRejecting(true);

        try {
            const result = await WorkflowService.rejectPAKD(plan.id, reason);
            if (result.success) {
                toast.success('Đã từ chối PAKD');
                setShowRejectDialog(false);
                fetchPlan();
                onUpdate();
            } else {
                toast.error(`Lỗi: ${result.error?.message || 'Không xác định'}`);
            }
        } catch (err: any) {
            toast.error("Lỗi từ chối: " + err.message);
        } finally {
            setIsRejecting(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-slate-500">Đang tải phương án kinh doanh...</div>;

    // Permissions - PAKD is read-only in contract module
    const canEditPlan = false; // Disabled - PAKD comes pre-approved

    // TEMPORARILY DISABLED: PAKD approval workflow
    // Will be moved to CRM module later
    const showSubmit = false;
    const showApproveUnit = false;
    const showApproveFinance = false;
    const showApproveBoard = false;

    // Editing disabled - PAKD is read-only
    const canAdjustCost = false;

    return (
        <>
            <div className="bg-white dark:bg-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <FileText className="text-orange-500" />
                            Phương án Kinh doanh (PAKD)
                            {plan && (
                                <span className={`text-xs px-2 py-1 rounded-full ${plan.status === 'Approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                    plan.status === 'Draft' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' :
                                        'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                    }`}>
                                    {PLAN_STATUS_LABELS[plan.status]} v{plan.version}
                                </span>
                            )}
                        </h3>
                        <p className="text-slate-500 text-sm mt-1">Quản lý dòng tiền và lợi nhuận dự kiến</p>
                    </div>

                    <ActionPanel
                        isEditing={isEditing}
                        setIsEditing={setIsEditing}
                        onSave={handleSave}
                        onAction={handleAction}
                        canEditPlan={canEditPlan}
                        showSubmit={showSubmit}
                        showApproveUnit={showApproveUnit}
                        showApproveFinance={showApproveFinance}
                        showApproveBoard={showApproveBoard}
                        canAdjustCost={canAdjustCost}
                        planExists={!!plan}
                    />
                </div>

                {/* 1. FINANCIAL SUMMARY - Giống FinancialSummary trong ContractForm */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-xl px-6 py-4 text-white shadow-lg mb-8 relative overflow-hidden">
                    {/* Decorative */}
                    <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-5">
                        <TrendingUp size={80} />
                    </div>

                    <div className="flex items-center justify-between gap-6 relative z-10">
                        <div className="flex items-center gap-8 flex-1">
                            {/* Giá trị Ký kết */}
                            <div className="flex items-center gap-2">
                                <DollarSign size={14} className="text-slate-400" />
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Giá trị Ký kết</p>
                                    <p className="text-sm font-black text-white leading-tight">
                                        {formatVND(financials.signingValue)} <span className="text-[10px] text-slate-500">đ</span>
                                    </p>
                                </div>
                            </div>

                            {/* Doanh thu (-VAT) */}
                            <div className="flex items-center gap-2">
                                <ArrowUpRight size={14} className="text-slate-400" />
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Doanh thu (−VAT)</p>
                                    <p className="text-sm font-black text-slate-200 leading-tight">
                                        {formatVND(financials.estimatedRevenue)}
                                    </p>
                                </div>
                            </div>

                            {/* Chi phí & Giá vốn */}
                            <div className="flex items-center gap-2">
                                <ArrowDownRight size={14} className="text-rose-400" />
                                <div>
                                    <p className="text-[9px] font-bold text-rose-400/80 uppercase tracking-tight">Chi phí & Giá vốn</p>
                                    <p className="text-sm font-black text-rose-400 leading-tight">
                                        {formatVND(financials.costs)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Lợi nhuận gộp */}
                        <div className="flex items-center gap-3 pl-6 border-l border-white/10">
                            <div className="text-right">
                                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-wide">Lợi nhuận gộp</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-lg font-black text-emerald-400 leading-none">
                                        {formatVND(financials.grossProfit)}
                                    </p>
                                    <span className="text-xs font-bold text-emerald-600">
                                        ({financials.margin.toFixed(1)}%)
                                    </span>
                                </div>
                            </div>
                            {/* Mini Progress */}
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, financials.margin)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. BUSINESS PLAN DETAILS */}
                <div className="mb-8">
                    {/* 2.1 Products Table */}
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                            Sản phẩm/Dịch vụ
                        </h4>
                        <div className="flex gap-2">
                            {isEditing && (
                                <>
                                    <button
                                        onClick={resetToOriginal}
                                        className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 transition-colors"
                                    >
                                        <RotateCcw size={12} /> Reset từ HĐ
                                    </button>
                                    <button
                                        onClick={addLineItem}
                                        className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                                    >
                                        <Plus size={12} /> Thêm hạng mục
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="mb-8 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-left text-xs min-w-[1200px]">
                            <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                    <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-300 uppercase tracking-tighter text-xs w-[320px]">Sản phẩm/Dịch vụ</th>
                                    <th className="px-2 py-3 font-bold text-slate-500 dark:text-slate-300 uppercase tracking-tighter text-xs text-center w-10">SL</th>
                                    <th className="px-4 py-3 font-bold text-slate-500 dark:text-slate-300 uppercase tracking-tighter text-xs w-[180px]">Nhà cung cấp</th>
                                    <th className="px-3 py-3 font-bold text-slate-500 dark:text-slate-300 uppercase tracking-tighter text-xs text-right w-[120px] whitespace-nowrap">Giá Đầu vào</th>
                                    <th className="px-3 py-3 font-bold text-cyan-500 uppercase tracking-tighter text-xs text-right w-[120px] whitespace-nowrap">TT Đầu vào</th>
                                    <th className="px-3 py-3 font-bold text-slate-500 dark:text-slate-300 uppercase tracking-tighter text-xs text-right w-[120px] whitespace-nowrap">Giá Đầu ra</th>
                                    <th className="px-2 py-3 font-bold text-slate-500 dark:text-slate-300 uppercase tracking-tighter text-xs text-center w-[80px]">VAT</th>
                                    <th className="px-3 py-3 font-bold text-indigo-400 uppercase tracking-tighter text-xs text-right w-[120px] whitespace-nowrap">TT Đầu ra</th>
                                    <th className="px-3 py-3 font-bold text-slate-500 dark:text-slate-300 uppercase tracking-tighter text-xs text-right w-[110px] whitespace-nowrap">CP Trực tiếp</th>
                                    <th className="px-3 py-3 font-bold text-slate-500 dark:text-slate-300 uppercase tracking-tighter text-xs text-right w-[110px] whitespace-nowrap">Chênh lệch</th>
                                    {isEditing && <th className="px-2 py-3 w-10"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {lineItems.map((item, idx) => {
                                    const inputTotal = item.quantity * item.inputPrice;
                                    const outputTotal = item.quantity * item.outputPrice * (1 + (item.vatRate ?? 10) / 100);
                                    const lineMargin = outputTotal - inputTotal - (item.directCosts || 0);
                                    const lineMarginRate = outputTotal > 0 ? (lineMargin / outputTotal) * 100 : 0;

                                    return (
                                        <tr key={item.id || idx} className="group hover:bg-slate-50 dark:hover:bg-slate-700">
                                            {/* Product Dropdown */}
                                            <td className="px-4 py-3">
                                                {isEditing ? (
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
                                                                newList[idx].name = prod.name;
                                                                newList[idx].inputPrice = prod.costPrice || 0;
                                                                newList[idx].outputPrice = prod.basePrice;
                                                            } else {
                                                                newList[idx].name = '';
                                                            }
                                                            setLineItems(newList);
                                                        }}
                                                        onSearch={async (query) => {
                                                            const results = await ProductService.search(query, 20);
                                                            return results.map(p => ({ id: p.id, name: p.name, subText: p.category }));
                                                        }}
                                                        onAddNew={() => {
                                                            setAddProductForIndex(idx);
                                                            setShowAddProductDialog(true);
                                                        }}
                                                        addNewLabel="+ Thêm sản phẩm mới"
                                                    />
                                                ) : (
                                                    <span className="font-bold text-slate-700 dark:text-slate-200">{item.name}</span>
                                                )}
                                            </td>
                                            {/* Quantity */}
                                            <td className="px-2 py-3 text-center">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value) || 1)}
                                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-center text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    />
                                                ) : (
                                                    item.quantity
                                                )}
                                            </td>
                                            {/* Supplier Dropdown */}
                                            <td className="px-4 py-3">
                                                {isEditing ? (
                                                    <select
                                                        value={item.supplier || ''}
                                                        onChange={(e) => updateLineItem(idx, 'supplier', e.target.value)}
                                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-slate-500 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    >
                                                        <option value="">-- Chọn NCC --</option>
                                                        {customers.filter(c => c.type === 'Supplier' || c.type === 'Both').map(s => (
                                                            <option key={s.id} value={s.shortName}>{s.shortName}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="text-slate-500 dark:text-slate-400">{item.supplier || '-'}</span>
                                                )}
                                            </td>
                                            {/* Input Price */}
                                            <td className="px-4 py-3 text-right">
                                                <div className="relative group/currency">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={formatVND(item.inputPrice)}
                                                            onChange={(e) => {
                                                                const raw = e.target.value.replace(/\./g, '');
                                                                if (!/^\d*$/.test(raw)) return;
                                                                updateLineItem(idx, 'inputPrice', Number(raw) || 0);
                                                            }}
                                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-right text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                        />
                                                    ) : (
                                                        <span className="text-slate-500 dark:text-slate-400">{formatVND(item.inputPrice)}</span>
                                                    )}
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
                                            {/* TT Đầu vào */}
                                            <td className="px-3 py-3 text-right">
                                                <span className="font-bold text-cyan-600 dark:text-cyan-400">{formatVND(inputTotal)}</span>
                                            </td>
                                            {/* Output Price */}
                                            <td className="px-4 py-3 text-right">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={formatVND(item.outputPrice)}
                                                        onChange={(e) => {
                                                            const raw = e.target.value.replace(/\./g, '');
                                                            if (!/^\d*$/.test(raw)) return;
                                                            updateLineItem(idx, 'outputPrice', Number(raw) || 0);
                                                        }}
                                                        className="w-full bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-600 rounded-lg px-2 py-1 text-right font-bold text-orange-600 dark:text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    />
                                                ) : (
                                                    <span className="font-bold text-orange-600 dark:text-orange-400">{formatVND(item.outputPrice)}</span>
                                                )}
                                            </td>
                                            {/* VAT Rate */}
                                            <td className="px-2 py-3 text-center">
                                                {isEditing ? (
                                                    <div className="relative">
                                                        <select
                                                            value={item.vatRate ?? 10}
                                                            onChange={(e) => updateLineItem(idx, 'vatRate', Number(e.target.value))}
                                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-1 py-1 text-center text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none"
                                                        >
                                                            <option value="0">0%</option>
                                                            <option value="5">5%</option>
                                                            <option value="8">8%</option>
                                                            <option value="10">10%</option>
                                                        </select>
                                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-500">
                                                            <ArrowDownCircle size={10} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 dark:text-slate-400">{item.vatRate ?? 10}%</span>
                                                )}
                                            </td>
                                            {/* TT Đầu ra */}
                                            <td className="px-3 py-3 text-right">
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatVND(outputTotal)}</span>
                                            </td>
                                            {/* Direct Costs (Modal trigger) */}
                                            <td className="px-4 py-3 text-right">
                                                {isEditing ? (
                                                    <div className="relative group/costs">
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            onClick={() => openCostModal(idx)}
                                                            value={formatVND(item.directCosts || 0)}
                                                            className="w-full bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-600 rounded-lg px-2 py-1 text-right text-rose-500 font-bold cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-900/20 focus:outline-none"
                                                            title="Nhấn để thêm chi phí trực tiếp"
                                                        />
                                                        {item.directCostDetails && item.directCostDetails.length > 0 && (
                                                            <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 opacity-0 group-hover/costs:opacity-100 transition-opacity pointer-events-none">
                                                                <div className="space-y-1">
                                                                    {item.directCostDetails.map((detail, i) => (
                                                                        <div key={i} className="flex justify-between items-center border-b border-slate-700 pb-1 last:border-0 last:pb-0">
                                                                            <span className="font-medium">{detail.name}</span>
                                                                            <span className="font-bold">{formatVND(detail.amount)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="relative group/costs inline-block">
                                                        <span className="text-rose-500 dark:text-rose-400 font-bold cursor-help">{formatVND(item.directCosts || 0)}</span>
                                                        {item.directCostDetails && item.directCostDetails.length > 0 && (
                                                            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl z-50 opacity-0 group-hover/costs:opacity-100 transition-opacity pointer-events-none">
                                                                <div className="font-semibold text-[11px] mb-1.5 text-rose-300 border-b border-slate-700 pb-1">Chi tiết CP trực tiếp</div>
                                                                <div className="space-y-1">
                                                                    {item.directCostDetails.map((detail, i) => (
                                                                        <div key={i} className="flex justify-between items-center border-b border-slate-700 pb-1 last:border-0 last:pb-0">
                                                                            <span className="font-medium">{detail.name}</span>
                                                                            <span className="font-bold">{formatVND(detail.amount)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="absolute bottom-0 right-4 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            {/* Margin */}
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`font-bold ${lineMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatVND(lineMargin)}</span>
                                                    <span className="text-[9px] font-bold text-slate-400">{lineMarginRate.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                            {/* Delete */}
                                            {isEditing && (
                                                <td className="px-2 py-3 text-center">
                                                    {lineItems.length > 1 && (
                                                        <button
                                                            onClick={() => removeLineItem(item.id)}
                                                            className="text-slate-300 hover:text-rose-500 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                                {/* Totals Row */}
                                <tr className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 border-t-2 border-slate-200 dark:border-slate-600">
                                    <td className="px-4 py-3" colSpan={3}>TỔNG CỘNG</td>
                                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                                        {formatVND(lineItems.reduce((acc, item) => acc + item.inputPrice, 0))}
                                    </td>
                                    <td className="px-3 py-3 text-right text-cyan-600 dark:text-cyan-400 font-black">
                                        {formatVND(lineItems.reduce((acc, item) => acc + (item.quantity * item.inputPrice), 0))}
                                    </td>
                                    <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400">
                                        {formatVND(lineItems.reduce((acc, item) => acc + item.outputPrice, 0))}
                                    </td>
                                    <td></td>
                                    <td className="px-3 py-3 text-right text-indigo-600 dark:text-indigo-400 font-black">
                                        {formatVND(lineItems.reduce((acc, item) => acc + (item.quantity * item.outputPrice * (1 + (item.vatRate ?? 10) / 100)), 0))}
                                    </td>
                                    <td className="px-4 py-3 text-right text-rose-500 dark:text-rose-400">
                                        {formatVND(lineItems.reduce((acc, item) => acc + (item.directCosts || 0), 0))}
                                    </td>
                                    <td className={`px-4 py-3 text-right ${(() => {
                                        const totalMargin = lineItems.reduce((acc, item) => {
                                            const out = item.quantity * item.outputPrice * (1 + (item.vatRate ?? 10) / 100);
                                            const inp = item.quantity * item.inputPrice;
                                            return acc + (out - inp - (item.directCosts || 0));
                                        }, 0);
                                        return totalMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
                                    })()}`}>
                                        {formatVND(lineItems.reduce((acc, item) => {
                                            const out = item.quantity * item.outputPrice * (1 + (item.vatRate ?? 10) / 100);
                                            const inp = item.quantity * item.inputPrice;
                                            return acc + (out - inp - (item.directCosts || 0));
                                        }, 0))}
                                    </td>
                                    {isEditing && <td></td>}
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 2.2 Execution Costs with % */}
                    <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-lg border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                <Calculator size={14} /> Chi phí quản lý & thực hiện khác
                            </h4>
                            {isEditing && (
                                <button
                                    onClick={addExecutionCost}
                                    className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                                >
                                    <Plus size={12} /> Thêm chi phí
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            {executionCosts.length === 0 && !isEditing && (
                                <p className="text-xs text-slate-400 italic">Chưa có chi phí phụ.</p>
                            )}
                            {executionCosts.map((item, idx) => (
                                <div key={item.id} className="space-y-1.5 bg-white dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50">
                                    {isEditing ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Tên chi phí..."
                                                    value={item.name}
                                                    onChange={(e) => updateExecutionCost(item.id, 'name', e.target.value)}
                                                    className="w-full bg-transparent text-xs font-bold text-slate-600 dark:text-slate-300 focus:outline-none border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-amber-500 pb-1 uppercase tracking-widest"
                                                />
                                                <button onClick={() => removeExecutionCost(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={12} /></button>
                                            </div>
                                            <div className="grid grid-cols-12 gap-2">
                                                <div className="col-span-4 relative">
                                                    <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-slate-400 text-[10px] font-bold">%</div>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={item.percentage || ''}
                                                        onChange={(e) => updateExecutionCost(item.id, 'percentage', Number(e.target.value))}
                                                        className="w-full pl-6 pr-1 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-orange-500 outline-none text-center"
                                                    />
                                                </div>
                                                <div className="col-span-8 relative">
                                                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" size={10} />
                                                    <input
                                                        type="text"
                                                        value={item.amount ? formatVND(item.amount) : '0'}
                                                        onChange={(e) => {
                                                            const raw = e.target.value.replace(/\./g, '');
                                                            if (!/^\d*$/.test(raw)) return;
                                                            updateExecutionCost(item.id, 'amount', Number(raw));
                                                        }}
                                                        className="w-full pl-6 pr-2 py-1.5 bg-rose-50 dark:bg-rose-900/20 border border-slate-200 dark:border-slate-700 rounded text-xs font-black focus:ring-1 focus:ring-rose-500 outline-none text-right text-rose-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pt-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1 truncate" title={item.name}>{item.name}</label>
                                            <p className="text-sm font-bold text-rose-500 dark:text-rose-400">
                                                {formatVND(item.amount || 0)}
                                                {(item.percentage || 0) > 0 && (
                                                    <span className="text-xs text-slate-400 font-medium ml-2">({item.percentage}%)</span>
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {/* Total Execution Costs */}
                        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Tổng CP khác</p>
                                <p className="text-lg font-bold text-rose-500 dark:text-rose-400">
                                    {formatVND(executionCosts.reduce((acc, cost) => acc + (cost.amount || 0), 0))}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2.3 Payment Schedules - Dòng tiền dự kiến */}
                <div className="bg-gradient-to-br from-slate-50 to-orange-50/30 dark:from-slate-800 dark:to-slate-800 p-6 rounded-lg border border-slate-100 dark:border-slate-800 space-y-6 mb-8">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                        <Wallet size={14} /> Dòng tiền dự kiến
                    </h4>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* 2.3.1 Thu từ Khách hàng (Tiền vào) */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <ArrowDownCircle size={12} /> Tiền về từ Khách hàng
                                </p>
                                {isEditing && (
                                    <button
                                        onClick={() => setPaymentSchedules([...paymentSchedules, { id: Date.now().toString(), date: '', amount: 0, description: '', status: 'Pending', type: 'Revenue' }])}
                                        className="text-emerald-600 font-bold text-[10px]"
                                    >+ Thêm đợt</button>
                                )}
                            </div>
                            <div className="space-y-3">
                                {paymentSchedules.map((pay, idx) => (
                                    <div key={pay.id} className="grid grid-cols-12 gap-2 bg-emerald-50 dark:bg-emerald-950/60 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                        <div className="col-span-4 space-y-1">
                                            <label className="text-[9px] text-slate-600 dark:text-emerald-300 font-bold uppercase">Ngày thanh toán</label>
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={pay.date}
                                                    onChange={(e) => {
                                                        const newSched = [...paymentSchedules];
                                                        newSched[idx].date = e.target.value;
                                                        setPaymentSchedules(newSched);
                                                    }}
                                                    className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-white"
                                                />
                                            ) : (
                                                <p className="text-[11px] font-bold text-slate-800 dark:text-white">{pay.date || '-'}</p>
                                            )}
                                        </div>
                                        <div className="col-span-4 space-y-1">
                                            <label className="text-[9px] text-slate-600 dark:text-emerald-300 font-bold uppercase">Nội dung</label>
                                            {isEditing ? (
                                                <input
                                                    placeholder="Tạm ứng, Đợt 1..."
                                                    value={pay.description}
                                                    onChange={(e) => {
                                                        const newSched = [...paymentSchedules];
                                                        newSched[idx].description = e.target.value;
                                                        setPaymentSchedules(newSched);
                                                    }}
                                                    className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-white"
                                                />
                                            ) : (
                                                <p className="text-[11px] font-bold text-slate-800 dark:text-white">{pay.description || '-'}</p>
                                            )}
                                        </div>
                                        <div className="col-span-4 space-y-1 text-right">
                                            <label className="text-[9px] text-slate-600 dark:text-emerald-300 font-bold uppercase">Số tiền</label>
                                            <div className="flex items-center justify-end gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <input
                                                            type="text"
                                                            placeholder="Tiền..."
                                                            value={pay.amount ? formatVND(pay.amount) : ''}
                                                            onChange={(e) => {
                                                                const raw = e.target.value.replace(/\./g, '');
                                                                if (!/^\d*$/.test(raw)) return;
                                                                const newSched = [...paymentSchedules];
                                                                newSched[idx].amount = Number(raw);
                                                                setPaymentSchedules(newSched);
                                                            }}
                                                            className="w-full bg-transparent text-[11px] font-bold text-right outline-none text-emerald-600 dark:text-emerald-400"
                                                        />
                                                        {paymentSchedules.length > 1 && (
                                                            <button onClick={() => setPaymentSchedules(paymentSchedules.filter(p => p.id !== pay.id))} className="text-emerald-400 hover:text-emerald-600">
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{formatVND(pay.amount)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {/* Total Thu */}
                                <div className="flex justify-end pt-2">
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-600 dark:text-emerald-300 uppercase font-bold">Tổng tiền về</p>
                                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatVND(paymentSchedules.reduce((acc, p) => acc + p.amount, 0))}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2.3.2 Chi ra cho NCC/Thầu phụ */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <ArrowUpCircle size={12} /> Chi trả NCC / Thầu phụ
                                </p>
                                {isEditing && (
                                    <button
                                        onClick={() => setSupplierSchedules([...supplierSchedules, { id: Date.now().toString(), date: '', amount: 0, description: '', status: 'Pending', type: 'Expense' }])}
                                        className="text-rose-600 font-bold text-[10px]"
                                    >+ Thêm đợt chi</button>
                                )}
                            </div>
                            <div className="space-y-3">
                                {supplierSchedules.map((pay, idx) => (
                                    <div key={pay.id} className="grid grid-cols-12 gap-2 bg-rose-50 dark:bg-rose-950/60 p-3 rounded-lg border border-rose-200 dark:border-rose-800">
                                        <div className="col-span-4 space-y-1">
                                            <label className="text-[9px] text-slate-600 dark:text-rose-300 font-bold uppercase">Hạn thanh toán</label>
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={pay.date}
                                                    onChange={(e) => {
                                                        const newSched = [...supplierSchedules];
                                                        newSched[idx].date = e.target.value;
                                                        setSupplierSchedules(newSched);
                                                    }}
                                                    className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-white"
                                                />
                                            ) : (
                                                <p className="text-[11px] font-bold text-slate-800 dark:text-white">{pay.date || '-'}</p>
                                            )}
                                        </div>
                                        <div className="col-span-4 space-y-1">
                                            <label className="text-[9px] text-slate-600 dark:text-rose-300 font-bold uppercase">Nội dung</label>
                                            {isEditing ? (
                                                <input
                                                    placeholder="Thanh toán NCC..."
                                                    value={pay.description}
                                                    onChange={(e) => {
                                                        const newSched = [...supplierSchedules];
                                                        newSched[idx].description = e.target.value;
                                                        setSupplierSchedules(newSched);
                                                    }}
                                                    className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-white"
                                                />
                                            ) : (
                                                <p className="text-[11px] font-bold text-slate-800 dark:text-white">{pay.description || '-'}</p>
                                            )}
                                        </div>
                                        <div className="col-span-4 space-y-1 text-right">
                                            <label className="text-[9px] text-slate-600 dark:text-rose-300 font-bold uppercase">Số tiền</label>
                                            <div className="flex items-center justify-end gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <input
                                                            type="text"
                                                            placeholder="Tiền..."
                                                            value={pay.amount ? formatVND(pay.amount) : ''}
                                                            onChange={(e) => {
                                                                const raw = e.target.value.replace(/\./g, '');
                                                                if (!/^\d*$/.test(raw)) return;
                                                                const newSched = [...supplierSchedules];
                                                                newSched[idx].amount = Number(raw);
                                                                setSupplierSchedules(newSched);
                                                            }}
                                                            className="w-full bg-transparent text-[11px] font-bold text-right outline-none text-rose-500 dark:text-rose-400"
                                                        />
                                                        {supplierSchedules.length > 1 && (
                                                            <button onClick={() => setSupplierSchedules(supplierSchedules.filter(p => p.id !== pay.id))} className="text-rose-400 hover:text-rose-600">
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-[11px] font-bold text-rose-500 dark:text-rose-400">{formatVND(pay.amount)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {/* Total Chi */}
                                <div className="flex justify-end pt-2">
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-600 dark:text-rose-300 uppercase font-bold">Tổng chi NCC</p>
                                        <p className="text-sm font-bold text-rose-500 dark:text-rose-400">{formatVND(supplierSchedules.reduce((acc, p) => acc + p.amount, 0))}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Warning if Margin < 30% */}
                {financials.margin < 30 && (
                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 rounded-lg mb-6 border border-amber-100 dark:border-amber-800">
                        <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                        <div className="text-sm">
                            <strong className="block mb-1">Cảnh báo Hiệu quả thấp</strong>
                            Tỷ suất lợi nhuận dưới 30% (KPI chuẩn). Cần lưu ý khi triển khai hợp đồng.
                        </div>
                    </div>
                )}

                {/* TEMPORARILY HIDDEN: PAKD Workflow Steps & History */}
                {/* Will be re-enabled when PAKD approval moves to CRM module */}
                {/* <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Tiến độ Phê duyệt</h4>
                {plan && <ApprovalStepper currentStatus={plan.status} reviews={reviews} />}
                <div className="mt-6">
                    <ReviewLog reviews={reviews} />
                </div>
            </div> */}

                {/* Reject Dialog */}
                <RejectDialog
                    isOpen={showRejectDialog}
                    onClose={() => setShowRejectDialog(false)}
                    onConfirm={handleReject}
                    isLoading={isRejecting}
                />

                {/* Direct Costs Modal */}
                {activeCostModalIndex !== null && (
                    <Modal
                        isOpen={true}
                        onClose={() => setActiveCostModalIndex(null)}
                        title={`Chi phí trực tiếp - ${lineItems[activeCostModalIndex]?.name || 'Hạng mục'}`}
                    >
                        <div className="space-y-4">
                            <p className="text-xs text-slate-500">Thêm các khoản chi phí trực tiếp cho hạng mục này:</p>

                            {tempCostDetails.map((detail, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={detail.name}
                                        onChange={(e) => {
                                            const updated = [...tempCostDetails];
                                            updated[i].name = e.target.value;
                                            setTempCostDetails(updated);
                                        }}
                                        placeholder="Tên chi phí..."
                                        className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                    <input
                                        type="text"
                                        value={formatVND(detail.amount)}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/\./g, '');
                                            if (!/^\d*$/.test(raw)) return;
                                            const updated = [...tempCostDetails];
                                            updated[i].amount = Number(raw);
                                            setTempCostDetails(updated);
                                        }}
                                        placeholder="Số tiền"
                                        className="w-32 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-right font-bold text-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    />
                                    <button
                                        onClick={() => setTempCostDetails(tempCostDetails.filter((_, idx) => idx !== i))}
                                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            <button
                                onClick={() => setTempCostDetails([...tempCostDetails, { id: Date.now().toString(), name: '', amount: 0 }])}
                                className="flex items-center gap-2 text-xs font-bold text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 transition-colors"
                            >
                                <Plus size={14} /> Thêm chi phí
                            </button>

                            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Tổng cộng</p>
                                    <p className="text-lg font-black text-rose-500">
                                        {formatVND(tempCostDetails.reduce((acc, d) => acc + d.amount, 0))}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActiveCostModalIndex(null)}
                                        className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={saveCostModal}
                                        className="px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-colors"
                                    >
                                        Lưu
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>

            {/* Quick Add Product Dialog */}
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
        </>
    );
};

export default ContractBusinessPlanTab;
