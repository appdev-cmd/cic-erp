import React, { useState, useEffect, useMemo } from 'react';
import {
    X,
    Save,
    CreditCard,
    Calendar,
    DollarSign,
    FileText,
    Building2,
    Hash,
    Receipt,
    ArrowDownCircle,
    ArrowUpCircle,
    Percent,
    Package,
    AlertTriangle
} from 'lucide-react';
import { Payment, PaymentStatus, PaymentMethod, VoucherType, ExpenseCategory, VATInvoiceLineItem, Contract } from '../types';
import { ContractService, CustomerService } from '../services';
import NumberInput from './ui/NumberInput';
import SearchableSelect from './ui/SearchableSelect';
import QuickAddCustomerDialog from './ui/QuickAddCustomerDialog';
import DateInput from './ui/DateInput';
import { formatNumber } from '../lib/utils';
import { SlidePanelHeader } from './ui/SlidePanelHeader';

interface PaymentFormProps {
    payment?: Payment;
    initialVoucherType?: VoucherType;
    initialContractId?: string;
    initialCustomerId?: string;
    onSave: (payment: Omit<Payment, 'id'> | Payment) => void;
    onCancel: () => void;
    // Financial validation limits
    contractValue?: number;           // Giá trị thanh lý HĐ (acceptanceValue || value)
    existingInvoiceTotal?: number;    // Tổng HĐ VAT đã xuất
    existingReceiptTotal?: number;    // Tổng tiền đã thu (Tiền về)
    editingVoucherAmount?: number;    // Giá trị phiếu đang sửa (exclude from total)
    isInsidePanel?: boolean;          // Render without modal wrapper when inside SlidePanel
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['Đặt hàng NCC', 'Công tác phí', 'Lắp đặt', 'Cài đặt', 'Đào tạo', 'Chuyển giao', 'Khác'];

const VOUCHER_CONFIG: Record<VoucherType, { label: string; icon: React.ReactNode; color: string; bgColor: string; description: string }> = {
    VAT_INVOICE: {
        label: 'Phiếu xuất HĐ VAT',
        icon: <FileText size={20} />,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
        description: 'Xuất hoá đơn GTGT theo danh mục SP/DV'
    },
    RECEIPT: {
        label: 'Phiếu thu',
        icon: <ArrowDownCircle size={20} />,
        color: 'text-emerald-600 dark:text-emerald-400',
        bgColor: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
        description: 'Ghi nhận tiền về tài khoản'
    },
    EXPENSE: {
        label: 'Phiếu chi',
        icon: <ArrowUpCircle size={20} />,
        color: 'text-rose-600 dark:text-rose-400',
        bgColor: 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800',
        description: 'Chi phí thực hiện hợp đồng'
    },
};

const PaymentForm: React.FC<PaymentFormProps> = ({ payment, initialVoucherType = 'RECEIPT', initialContractId, initialCustomerId, onSave, onCancel, contractValue, existingInvoiceTotal, existingReceiptTotal, editingVoucherAmount, isInsidePanel }) => {
    // Voucher type
    const [voucherType, setVoucherType] = useState<VoucherType>(payment?.voucherType || initialVoucherType);

    // Common fields
    const today = new Date().toISOString().split('T')[0];
    const plus30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const [contractId, setContractId] = useState(payment?.contractId || initialContractId || '');
    const [customerId, setCustomerId] = useState(payment?.customerId || initialCustomerId || '');
    const [dueDate, setDueDate] = useState(payment?.dueDate || (!payment ? plus30 : ''));
    const [paymentDate, setPaymentDate] = useState(payment?.paymentDate || (!payment ? today : ''));
    const [amount, setAmount] = useState(payment?.amount || 0);
    const [method, setMethod] = useState<PaymentMethod>(payment?.method || 'Chuyển khoản');
    const [invoiceNumber, setInvoiceNumber] = useState(payment?.invoiceNumber || '');
    const [invoiceDate, setInvoiceDate] = useState(payment?.invoiceDate || (!payment ? today : ''));
    const [reference, setReference] = useState(payment?.reference || '');
    const [notes, setNotes] = useState(payment?.notes || '');

    // Status
    const [status, setStatus] = useState<PaymentStatus>(() => {
        if (payment?.status) return payment.status;
        if (voucherType === 'VAT_INVOICE') return 'Đã xuất HĐ';
        if (voucherType === 'EXPENSE') return 'Đề nghị chi';
        return 'Tiền về';
    });

    // Expense-specific
    const [expenseCategory, setExpenseCategory] = useState<string>(payment?.expenseCategory || '');

    // Dynamic PAKD cost categories from contract
    const [pakdCostCategories, setPakdCostCategories] = useState<{ name: string; budgetAmount: number; source: string }[]>([]);

    // VAT Invoice line items
    const [vatInvoiceItems, setVatInvoiceItems] = useState<VATInvoiceLineItem[]>(payment?.vatInvoiceItems || []);
    const [contractLineItems, setContractLineItems] = useState<any[]>([]);

    // Display names
    const [contractDisplayName, setContractDisplayName] = useState<string>('');
    const [customerDisplayName, setCustomerDisplayName] = useState<string>('');
    const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);
    const [contractPaymentTerm, setContractPaymentTerm] = useState<number | undefined>(undefined);

    // When voucher type changes, update default status
    useEffect(() => {
        if (!payment) {
            if (voucherType === 'VAT_INVOICE') setStatus('Đã xuất HĐ');
            else if (voucherType === 'EXPENSE') setStatus('Đề nghị chi');
            else setStatus('Tiền về');
        }
    }, [voucherType, payment]);

    // Format dueDate based on contract payment term and invoiceDate (for VAT_INVOICE)
    useEffect(() => {
        if (!payment && voucherType === 'VAT_INVOICE' && contractPaymentTerm !== undefined) {
             const baseDateStr = invoiceDate || paymentDate || today;
             if (baseDateStr) {
                 const dateStart = new Date(baseDateStr);
                 dateStart.setDate(dateStart.getDate() + contractPaymentTerm);
                 setDueDate(dateStart.toISOString().split('T')[0]);
             }
        }
    }, [invoiceDate, paymentDate, contractPaymentTerm, voucherType, payment, today]);

    // Helper: extract cost categories from contract data
    const extractPakdCategories = (contract: any) => {
        const categories: { name: string; budgetAmount: number; source: string }[] = [];

        // 1. Direct costs from line items
        if (contract.lineItems) {
            contract.lineItems.forEach((li: any) => {
                if (li.directCostDetails && li.directCostDetails.length > 0) {
                    li.directCostDetails.forEach((detail: any) => {
                        const existing = categories.find(c => c.name === detail.name);
                        if (existing) {
                            existing.budgetAmount += (detail.amount || 0);
                        } else {
                            categories.push({
                                name: detail.name,
                                budgetAmount: detail.amount || 0,
                                source: `CP trực tiếp - ${li.name}`
                            });
                        }
                    });
                }
                // Also add total input cost as "Đặt hàng NCC" if there's an input price
                if (li.inputPrice > 0 && li.quantity > 0) {
                    const inputTotal = li.inputPrice * li.quantity;
                    const existing = categories.find(c => c.name === 'Đặt hàng NCC');
                    if (existing) {
                        existing.budgetAmount += inputTotal;
                    } else {
                        categories.push({
                            name: 'Đặt hàng NCC',
                            budgetAmount: inputTotal,
                            source: 'Giá vốn hàng hóa'
                        });
                    }
                }
            });
        }

        // 2. Execution costs (management fees, etc.)
        if (contract.executionCosts) {
            contract.executionCosts.forEach((ec: any) => {
                if (ec.name && ec.amount > 0) {
                    categories.push({
                        name: ec.name,
                        budgetAmount: ec.amount,
                        source: 'CP quản lý & thực hiện'
                    });
                }
            });
        }

        return categories;
    };

    // Fetch display names on mount for edit mode OR initial contract (from contract detail page)
    useEffect(() => {
        const targetContractId = payment?.contractId || initialContractId;
        const targetCustomerId = payment?.customerId || initialCustomerId;

        if (targetContractId) {
            ContractService.getById(targetContractId).then(c => {
                if (c) {
                    setContractDisplayName(`${c.id} - ${c.title}`);
                    if (c.lineItems) setContractLineItems(c.lineItems);

                    // Auto-fill customer from contract if not set
                    if (!targetCustomerId && c.customerId) {
                        setCustomerId(c.customerId);
                        CustomerService.getById(c.customerId).then(cust => {
                            if (cust) setCustomerDisplayName(cust.name);
                        });
                    }

                    if (c.paymentTermDays !== undefined) {
                        setContractPaymentTerm(c.paymentTermDays);
                    }

                    // For VAT_INVOICE: auto-generate line items from contract if none saved
                    const isVATType = payment?.voucherType === 'VAT_INVOICE' || (!payment && voucherType === 'VAT_INVOICE');
                    const hasNoItems = payment ? (!payment.vatInvoiceItems || payment.vatInvoiceItems.length === 0) : true;
                    if (isVATType && hasNoItems && c.lineItems && c.lineItems.length > 0) {
                        const items: VATInvoiceLineItem[] = c.lineItems.map(li => {
                            const vatRate = li.vatRate ?? 8;
                            // signingValue = giá trị ký kết (bao gồm VAT)
                            const signingValue = (li.outputPrice || 0) * (li.quantity || 1) * (1 + Math.max(0, vatRate) / 100);
                            const revenuePercent = 100;
                            const amountAfterVAT = signingValue * revenuePercent / 100;
                            const amountBeforeVAT = amountAfterVAT / (1 + Math.max(0, vatRate) / 100);
                            return {
                                lineItemId: li.id,
                                name: li.name,
                                signingValue,
                                revenuePercent,
                                amountBeforeVAT,
                                vatRate,
                                amountAfterVAT,
                            };
                        });
                        setVatInvoiceItems(items);
                        // Auto-set total amount
                        const totalAfterVAT = items.reduce((sum, i) => sum + i.amountAfterVAT, 0);
                        setAmount(totalAfterVAT);
                    }

                    // Extract PAKD cost categories for Expense vouchers
                    const categories = extractPakdCategories(c);
                    if (categories.length > 0) {
                        setPakdCostCategories(categories);
                        if (!payment?.expenseCategory) {
                            setExpenseCategory(categories[0].name);
                        }
                    }
                }
            });
        }
        if (targetCustomerId) {
            CustomerService.getById(targetCustomerId).then(c => {
                if (c) setCustomerDisplayName(c.name);
            });
        }
    }, []);

    // When a contract is selected, auto-fill customerId and load line items
    const handleContractChange = async (cId: string | null) => {
        setContractId(cId || '');
        if (cId) {
            const contract = await ContractService.getById(cId);
            if (contract) {
                setContractDisplayName(`${contract.contractCode} - ${contract.title}`);
                if (contract.customerId) setCustomerId(contract.customerId);
                
                if (contract.paymentTermDays !== undefined) {
                    setContractPaymentTerm(contract.paymentTermDays);
                    if (voucherType === 'VAT_INVOICE' && !payment) {
                         const dateStart = new Date(invoiceDate || paymentDate || today);
                         dateStart.setDate(dateStart.getDate() + contract.paymentTermDays);
                         setDueDate(dateStart.toISOString().split('T')[0]);
                    }
                } else {
                    setContractPaymentTerm(undefined);
                }

                if (contract.lineItems && contract.lineItems.length > 0) {
                    setContractLineItems(contract.lineItems);
                    // Auto-generate VAT invoice items from contract line items
                    if (voucherType === 'VAT_INVOICE' && (!vatInvoiceItems || vatInvoiceItems.length === 0)) {
                        const items: VATInvoiceLineItem[] = contract.lineItems.map(li => {
                            const vatRate = li.vatRate ?? 8;
                            // signingValue = giá trị ký kết (bao gồm VAT, vatRate=-1 tính bằng 0)
                            const signingValue = (li.outputPrice || 0) * (li.quantity || 1) * (1 + Math.max(0, vatRate) / 100);
                            const revenuePercent = 100;
                            const amountAfterVAT = signingValue * revenuePercent / 100;
                            const amountBeforeVAT = amountAfterVAT / (1 + Math.max(0, vatRate) / 100);
                            return {
                                lineItemId: li.id,
                                name: li.name,
                                signingValue,
                                revenuePercent,
                                amountBeforeVAT,
                                vatRate,
                                amountAfterVAT,
                            };
                        });
                        setVatInvoiceItems(items);
                        // Auto-calculate total amount
                        const totalAfterVAT = items.reduce((sum, i) => sum + i.amountAfterVAT, 0);
                        setAmount(totalAfterVAT);
                    }
                } else {
                    setContractLineItems([]);
                }

                // Extract PAKD cost categories
                const categories = extractPakdCategories(contract);
                if (categories.length > 0) {
                    setPakdCostCategories(categories);
                    if (!expenseCategory || expenseCategory === 'Khác') {
                        setExpenseCategory(categories[0].name);
                    }
                } else {
                    setPakdCostCategories([]);
                }
            }
        } else {
            setContractDisplayName('');
            setContractLineItems([]);
        }
    };

    // Fetch customer name when customerId changes
    useEffect(() => {
        if (customerId) {
            CustomerService.getById(customerId).then(c => {
                if (c) setCustomerDisplayName(c.name);
            });
        } else {
            setCustomerDisplayName('');
        }
    }, [customerId]);

    // Update VAT line item
    // revenuePercent = -1 means "Khác" (custom mode: both amountBeforeVAT and amountAfterVAT are editable independently)
    const updateVatItem = (index: number, field: 'revenuePercent' | 'vatRate' | 'amountBeforeVAT' | 'amountAfterVAT', value: number) => {
        setVatInvoiceItems(prev => {
            const updated = [...prev];
            const item = { ...updated[index] };

            if (field === 'amountBeforeVAT') {
                // Custom mode: only update amountBeforeVAT, DON'T auto-calculate amountAfterVAT
                item.amountBeforeVAT = value;
                item.revenuePercent = -1;
            } else if (field === 'amountAfterVAT') {
                // Custom mode: only update amountAfterVAT, DON'T auto-calculate amountBeforeVAT
                item.amountAfterVAT = value;
                item.revenuePercent = -1;
            } else if (field === 'revenuePercent') {
                item.revenuePercent = value;
                if (value >= 0) {
                    // Auto-calculate from signing value
                    item.amountAfterVAT = item.signingValue * value / 100;
                    item.amountBeforeVAT = item.amountAfterVAT / (1 + Math.max(0, item.vatRate) / 100);
                }
                // if -1 (switching to custom), keep current values for manual editing
            } else {
                // vatRate change
                item.vatRate = value;
                if (item.revenuePercent >= 0) {
                    item.amountAfterVAT = item.signingValue * item.revenuePercent / 100;
                    item.amountBeforeVAT = item.amountAfterVAT / (1 + Math.max(0, item.vatRate) / 100);
                }
                // In custom mode: don't recalculate — user controls both values
            }

            updated[index] = item;
            const total = updated.reduce((sum, i) => sum + i.amountAfterVAT, 0);
            setAmount(total);
            return updated;
        });
    };

    // Computed totals for VAT table
    const vatTotals = useMemo(() => {
        const totalSigning = vatInvoiceItems.reduce((sum, i) => sum + i.signingValue, 0);
        const totalBeforeVAT = vatInvoiceItems.reduce((sum, i) => sum + i.amountBeforeVAT, 0);
        const totalAfterVAT = vatInvoiceItems.reduce((sum, i) => sum + i.amountAfterVAT, 0);
        const totalVAT = totalAfterVAT - totalBeforeVAT;
        return { totalSigning, totalBeforeVAT, totalAfterVAT, totalVAT };
    }, [vatInvoiceItems]);

    const handleSubmit = () => {
        const paymentData = {
            ...(payment?.id && { id: payment.id }),
            contractId,
            customerId,
            dueDate: dueDate || paymentDate || new Date().toISOString().split('T')[0],
            paymentDate: paymentDate || (voucherType !== 'VAT_INVOICE' ? new Date().toISOString().split('T')[0] : ''),
            amount,
            paidAmount: (status === 'Tiền về' || status === 'Tạm ứng' || status === 'Đã chi') ? amount : 0,
            status,
            method,
            invoiceNumber,
            invoiceDate,
            reference,
            notes,
            paymentType: voucherType === 'EXPENSE' ? 'Expense' as const : 'Revenue' as const,
            voucherType,
            expenseCategory: voucherType === 'EXPENSE' ? expenseCategory : undefined,
            vatAmount: voucherType === 'VAT_INVOICE' ? vatTotals.totalVAT : 0,
            vatInvoiceItems: voucherType === 'VAT_INVOICE' ? vatInvoiceItems : undefined,
        };
        onSave(paymentData as any);
    };

    const formatCurrency = (val: number) => formatNumber(val);
    const methods: PaymentMethod[] = ['Chuyển khoản', 'Tiền mặt', 'LC', 'Khác'];

    // Status options per voucher type
    const statusOptions: PaymentStatus[] = useMemo(() => {
        switch (voucherType) {
            case 'VAT_INVOICE': return ['Đã xuất HĐ', 'Đã giao KH'];
            case 'RECEIPT': return ['Tạm ứng', 'Tiền về'];
            case 'EXPENSE': return ['Đề nghị chi', 'Đã chi'];
            default: return ['Tạm ứng', 'Đã xuất HĐ', 'Tiền về'];
        }
    }, [voucherType]);

    const statusColors: Record<string, string> = {
        'Đã xuất HĐ': 'bg-blue-600 text-white',
        'Đã giao KH': 'bg-indigo-600 text-white',
        'Tiền về': 'bg-emerald-600 text-white',
        'Tạm ứng': 'bg-amber-600 text-white',
        'Đề nghị chi': 'bg-orange-600 text-white',
        'Đã chi': 'bg-rose-600 text-white',
    };

    const config = VOUCHER_CONFIG[voucherType];

    // === Financial validation: remaining capacity ===
    const financialLimit = useMemo(() => {
        if (contractValue === undefined || contractValue <= 0) return null;
        if (voucherType === 'VAT_INVOICE') {
            const existing = (existingInvoiceTotal || 0) - (editingVoucherAmount || 0);
            const remaining = contractValue - existing;
            return { existing, remaining, label: 'Đã xuất HĐ', remainLabel: 'Còn xuất được' };
        }
        if (voucherType === 'RECEIPT') {
            const existing = (existingReceiptTotal || 0) - (editingVoucherAmount || 0);
            const remaining = contractValue - existing;
            return { existing, remaining, label: 'Đã thu', remainLabel: 'Còn thu được' };
        }
        return null; // EXPENSE không giới hạn
    }, [contractValue, existingInvoiceTotal, existingReceiptTotal, editingVoucherAmount, voucherType]);

    const isExceedingLimit = financialLimit ? amount > financialLimit.remaining : false;

    // Panel mode: render form content directly (no modal wrapper)
    const formContent = (
        <>
            <div className={isInsidePanel ? 'bg-white dark:bg-slate-900 flex flex-col h-full' : 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-300'}>
                {/* Header */}
                {isInsidePanel ? (
                    <SlidePanelHeader>
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${voucherType === 'VAT_INVOICE' ? 'bg-blue-600 text-white' : voucherType === 'RECEIPT' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                                {config.icon}
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                                    {payment ? 'Sửa phiếu' : 'Thêm phiếu tài chính'}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{config.description}</p>
                            </div>
                        </div>
                    </SlidePanelHeader>
                ) : (
                    <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${voucherType === 'VAT_INVOICE' ? 'bg-blue-600 text-white' : voucherType === 'RECEIPT' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                                {config.icon}
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                                    {payment ? 'Sửa phiếu' : 'Thêm phiếu tài chính'}
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{config.description}</p>
                            </div>
                        </div>
                        <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>
                )}

                {/* Financial Limit Banner */}
                {financialLimit && (
                    <div className={`mx-6 mt-4 px-4 py-3 rounded-lg border flex items-center gap-3 text-xs transition-colors ${
                        financialLimit.remaining <= 0
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                            : isExceedingLimit
                                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                        {(isExceedingLimit || financialLimit.remaining <= 0) && <AlertTriangle size={16} className="flex-shrink-0" />}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 flex-1">
                            <span>Giá trị thanh lý: <b className="text-slate-900 dark:text-slate-100">{formatCurrency(contractValue || 0)}</b></span>
                            <span>{financialLimit.label}: <b>{formatCurrency(financialLimit.existing)}</b></span>
                            <span className={financialLimit.remaining <= 0 ? 'text-red-600 dark:text-red-400 font-black' : isExceedingLimit ? 'text-amber-600 dark:text-amber-400 font-black' : 'font-bold'}>
                                {financialLimit.remainLabel}: {formatCurrency(Math.max(0, financialLimit.remaining))}
                            </span>
                        </div>
                        {financialLimit.remaining <= 0 && (
                            <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded font-black uppercase whitespace-nowrap">Đã đủ</span>
                        )}
                    </div>
                )}

                {/* Form */}
                <div className={`p-6 space-y-6 overflow-y-auto ${isInsidePanel ? 'flex-1' : 'max-h-[calc(92vh-180px)]'}`}>
                    {/* Voucher Type Selector (only for new) — compact pills */}
                    {!payment && (
                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                            {(['VAT_INVOICE', 'RECEIPT', 'EXPENSE'] as VoucherType[]).map(vt => {
                                const cfg = VOUCHER_CONFIG[vt];
                                const isActive = voucherType === vt;
                                return (
                                    <button
                                        key={vt}
                                        type="button"
                                        onClick={() => setVoucherType(vt)}
                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${isActive
                                            ? `bg-white dark:bg-slate-900 shadow-sm ${cfg.color} ring-1 ${vt === 'VAT_INVOICE' ? 'ring-blue-200 dark:ring-blue-800' : vt === 'RECEIPT' ? 'ring-emerald-200 dark:ring-emerald-800' : 'ring-rose-200 dark:ring-rose-800'}`
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        <span className="flex-shrink-0">{cfg.icon}</span>
                                        <span className="truncate">{cfg.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Contract & Customer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                <FileText size={12} /> Hợp đồng *
                            </label>
                            <SearchableSelect
                                value={contractId || null}
                                placeholder="Gõ mã HĐ hoặc tên hợp đồng..."
                                getDisplayValue={(id) => id === contractId ? contractDisplayName : undefined}
                                onChange={handleContractChange}
                                onSearch={async (query) => {
                                    const results = await ContractService.search(query, 20);
                                    return results.map(c => ({
                                        id: c.id,
                                        name: `${c.id} - ${c.title}`,
                                        subText: c.partyA || undefined
                                    }));
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                <Building2 size={12} /> Khách hàng
                            </label>
                            <SearchableSelect
                                value={customerId || null}
                                placeholder="Gõ để tìm khách hàng..."
                                getDisplayValue={(id) => id === customerId ? customerDisplayName : undefined}
                                onChange={(cId) => setCustomerId(cId || '')}
                                onSearch={async (query) => {
                                    const results = await CustomerService.search(query, 20);
                                    return results.map(c => ({
                                        id: c.id,
                                        name: c.name,
                                        subText: Array.isArray(c.industry) ? c.industry.join(', ') : (c.type || '')
                                    }));
                                }}
                                onAddNew={() => setShowAddCustomerDialog(true)}
                                addNewLabel="+ Thêm khách hàng mới"
                            />
                        </div>
                    </div>

                    {/* === VAT INVOICE: Line Items Table === */}
                    {voucherType === 'VAT_INVOICE' && vatInvoiceItems.length > 0 && (
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                <Package size={12} /> Danh mục sản phẩm / dịch vụ
                            </label>
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800">
                                                <th className="text-left py-2.5 px-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] min-w-[200px]">SP / Dịch vụ</th>
                                                <th className="text-right py-2.5 px-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] whitespace-nowrap">Giá trị ký kết</th>
                                                <th className="text-center py-2.5 px-2 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] w-24">% Xuất DT</th>
                                                <th className="text-right py-2.5 px-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] whitespace-nowrap">Trước VAT</th>
                                                <th className="text-center py-2.5 px-2 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] w-16">% VAT</th>
                                                <th className="text-right py-2.5 px-3 font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px] whitespace-nowrap">Sau VAT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vatInvoiceItems.map((item, idx) => (
                                                <tr key={item.lineItemId} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                                    <td className="py-2.5 px-3">
                                                        <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">{item.name}</span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                        {formatCurrency(item.signingValue)}
                                                    </td>
                                                    <td className="py-2.5 px-2">
                                                        <div className="flex items-center gap-1">
                                                            {item.revenuePercent >= 0 ? (
                                                                <input
                                                                    type="number"
                                                                    value={item.revenuePercent}
                                                                    onChange={(e) => updateVatItem(idx, 'revenuePercent', Number(e.target.value) || 0)}
                                                                    className="w-14 px-1.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-center text-xs font-bold text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    min={0}
                                                                />
                                                            ) : (
                                                                <span className="w-14 px-1.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-center text-[10px] font-bold text-amber-700 dark:text-amber-300 block">Khác</span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => updateVatItem(idx, 'revenuePercent', item.revenuePercent >= 0 ? -1 : 100)}
                                                                title={item.revenuePercent >= 0 ? 'Chuyển sang nhập tự do' : 'Quay về nhập %'}
                                                                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500"
                                                            >
                                                                {item.revenuePercent >= 0 ? '⇄' : '%'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        {item.revenuePercent < 0 ? (
                                                            <NumberInput
                                                                value={item.amountBeforeVAT}
                                                                onChange={(val) => updateVatItem(idx, 'amountBeforeVAT', val)}
                                                                className="w-full px-2 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-right text-xs font-bold text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                            />
                                                        ) : (
                                                            <span className="text-right font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap block">{formatCurrency(item.amountBeforeVAT)}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-2">
                                                        <select
                                                            value={item.vatRate}
                                                            onChange={(e) => updateVatItem(idx, 'vatRate', Number(e.target.value))}
                                                            className="w-full px-1.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-center text-xs font-bold text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                        >
                                                            <option value={0}>0%</option>
                                                            <option value={5}>5%</option>
                                                            <option value={8}>8%</option>
                                                            <option value={10}>10%</option>
                                                            <option value={-1}>Không chịu thuế</option>
                                                        </select>
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        {item.revenuePercent < 0 ? (
                                                            <NumberInput
                                                                value={item.amountAfterVAT}
                                                                onChange={(val) => updateVatItem(idx, 'amountAfterVAT', val)}
                                                                className="w-full px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-right text-xs font-bold text-blue-700 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        ) : (
                                                            <span className="text-right font-black text-blue-600 dark:text-blue-400 whitespace-nowrap block">{formatCurrency(item.amountAfterVAT)}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                <td className="py-3 px-3 font-black text-slate-700 dark:text-slate-300 text-xs uppercase" colSpan={3}>Tổng cộng</td>
                                                <td className="py-3 px-3 text-right font-black text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatCurrency(vatTotals.totalBeforeVAT)}</td>
                                                <td className="py-3 px-2 text-center font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">{formatCurrency(vatTotals.totalVAT)}</td>
                                                <td className="py-3 px-3 text-right font-black text-blue-600 dark:text-blue-400 text-sm whitespace-nowrap">{formatCurrency(vatTotals.totalAfterVAT)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === VAT INVOICE: Invoice Number & Date === */}
                    {voucherType === 'VAT_INVOICE' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                    <Hash size={12} /> Số hóa đơn *
                                </label>
                                <input
                                    type="text"
                                    value={invoiceNumber}
                                    onChange={(e) => setInvoiceNumber(e.target.value)}
                                    placeholder="VD: 0001234"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                    <Calendar size={12} /> Ngày xuất HĐ *
                                </label>
                                <DateInput
                                    value={invoiceDate}
                                    onChange={(val) => {
                                        setInvoiceDate(val);
                                        if (!dueDate) setDueDate(val);
                                    }}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                    <Calendar size={12} /> Hạn thanh toán
                                </label>
                                <DateInput
                                    value={dueDate}
                                    onChange={(val) => setDueDate(val)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* === RECEIPT: Amount + Date + Method === */}
                    {voucherType === 'RECEIPT' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                        <DollarSign size={12} /> Số tiền *
                                    </label>
                                    <NumberInput
                                        value={amount}
                                        onChange={(value) => setAmount(value)}
                                        placeholder="0"
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    {amount > 0 && <p className="text-xs text-slate-400">{formatCurrency(amount)} VND</p>}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                        <Calendar size={12} /> Ngày thu *
                                    </label>
                                    <DateInput
                                        value={paymentDate}
                                        onChange={(val) => {
                                            setPaymentDate(val);
                                            if (!dueDate) setDueDate(val);
                                        }}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                        Phương thức *
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {methods.map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setMethod(m)}
                                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${method === m
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Số UNC / Chứng từ</label>
                                    <input
                                        type="text"
                                        value={reference}
                                        onChange={(e) => setReference(e.target.value)}
                                        placeholder="Số UNC..."
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Ghi chú</label>
                                    <input
                                        type="text"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Ghi chú..."
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* === EXPENSE: Category + Amount + Date === */}
                    {voucherType === 'EXPENSE' && (
                        <>
                            {/* PAKD Cost Categories or fallback */}
                            {pakdCostCategories.length > 0 ? (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                        <Package size={12} /> Hạng mục chi theo PAKD
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {pakdCostCategories.map((cat, idx) => {
                                            const isActive = expenseCategory === cat.name;
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        setExpenseCategory(cat.name);
                                                        if (!amount) setAmount(cat.budgetAmount);
                                                    }}
                                                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left text-xs transition-all ${isActive
                                                        ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 ring-1 ring-rose-400'
                                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                        }`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <span className={`font-bold truncate block ${isActive ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                            {cat.name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 truncate block">{cat.source}</span>
                                                    </div>
                                                    <span className={`ml-2 font-black text-xs whitespace-nowrap ${isActive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {formatCurrency(cat.budgetAmount)}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                        {/* Always show "Khác" option */}
                                        <button
                                            type="button"
                                            onClick={() => setExpenseCategory('Khác')}
                                            className={`flex items-center justify-center px-3 py-2.5 rounded-lg border text-xs font-bold transition-all ${expenseCategory === 'Khác'
                                                ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 ring-1 ring-rose-400 text-rose-700 dark:text-rose-400'
                                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                                                }`}
                                        >
                                            + Khác
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Hạng mục chi *</label>
                                        <select
                                            value={expenseCategory}
                                            onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        >
                                            {EXPENSE_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                            <DollarSign size={12} /> Số tiền *
                                        </label>
                                        <NumberInput
                                            value={amount}
                                            onChange={(value) => setAmount(value)}
                                            placeholder="0"
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                        {amount > 0 && <p className="text-xs text-slate-400">{formatCurrency(amount)} VND</p>}
                                    </div>
                                </div>
                            )}

                            {/* Amount + Date row (only when PAKD categories are shown, since amount is separate) */}
                            {pakdCostCategories.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                            <DollarSign size={12} /> Số tiền *
                                        </label>
                                        <NumberInput
                                            value={amount}
                                            onChange={(value) => setAmount(value)}
                                            placeholder="0"
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                        {amount > 0 && <p className="text-xs text-slate-400">{formatCurrency(amount)} VND</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                            <Calendar size={12} /> Ngày chi *
                                        </label>
                                        <DateInput
                                            value={paymentDate}
                                            onChange={(val) => setPaymentDate(val)}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                    </div>
                                </div>
                            )}
                            {/* Notes field (always, but Date only for non-PAKD) */}
                            {pakdCostCategories.length > 0 ? (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Nội dung chi / Ghi chú</label>
                                    <input
                                        type="text"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Nội dung chi tiết..."
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                            <Calendar size={12} /> Ngày chi *
                                        </label>
                                        <DateInput
                                            value={paymentDate}
                                            onChange={(val) => {
                                                setPaymentDate(val);
                                                if (!dueDate) setDueDate(val);
                                            }}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Nội dung chi / Ghi chú</label>
                                        <input
                                            type="text"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Nội dung chi tiết..."
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* === VAT INVOICE: Total (read-only computed) === */}
                    {voucherType === 'VAT_INVOICE' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Ghi chú</label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Ghi chú..."
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Tổng giá trị HĐ (sau VAT)</label>
                                <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-lg font-black text-blue-600 dark:text-blue-400">
                                    {formatCurrency(amount)} <span className="text-xs font-medium text-slate-400">VND</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Status is auto-set per voucher type — no manual selection needed */}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div className="text-xs text-slate-400">
                        {config.label}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="px-6 py-2.5 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            className={`px-8 py-2.5 font-bold text-sm rounded-lg transition-colors flex items-center gap-2 ${(!contractId || !amount || isExceedingLimit)
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
                                : voucherType === 'VAT_INVOICE' ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : voucherType === 'RECEIPT' ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-rose-600 text-white hover:bg-rose-700'
                                }`}
                            onClick={(e) => {
                                if (!contractId || !amount) {
                                    e.preventDefault();
                                    import('sonner').then(({ toast }) => {
                                        if (!contractId) toast.error("Vui lòng chọn Hợp đồng");
                                        else if (!amount) toast.error("Vui lòng nhập Số tiền");
                                    });
                                    return;
                                }
                                if (isExceedingLimit && financialLimit) {
                                    e.preventDefault();
                                    import('sonner').then(({ toast }) => {
                                        toast.error(
                                            `Vượt giới hạn! ${financialLimit.remainLabel}: ${formatCurrency(Math.max(0, financialLimit.remaining))} VND. Số tiền nhập: ${formatCurrency(amount)} VND.`,
                                            { duration: 5000 }
                                        );
                                    });
                                    return;
                                }
                                handleSubmit();
                            }}
                        >
                            {isExceedingLimit ? <AlertTriangle size={16} /> : <Save size={16} />}
                            {isExceedingLimit ? 'Vượt giới hạn' : payment ? 'Cập nhật' : 'Thêm mới'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Add Customer Dialog */}
            {showAddCustomerDialog && (
                <QuickAddCustomerDialog
                    isOpen={showAddCustomerDialog}
                    onClose={() => setShowAddCustomerDialog(false)}
                    onCreated={(newCustomer) => {
                        setCustomerId(newCustomer.id);
                        setCustomerDisplayName(newCustomer.name);
                        setShowAddCustomerDialog(false);
                    }}
                />
            )}
        </>
    );

    // If inside panel, render form directly without modal wrapper
    if (isInsidePanel) {
        return formContent;
    }

    // Modal mode: wrap in backdrop
    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            {formContent}
        </div>
    );
};

export default PaymentForm;
