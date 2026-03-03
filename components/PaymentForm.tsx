import React, { useState, useEffect } from 'react';
import {
    X,
    Save,
    CreditCard,
    Calendar,
    DollarSign,
    FileText,
    Building2,
    Hash
} from 'lucide-react';
import { Payment, PaymentStatus, PaymentMethod } from '../types';
import { ContractService, CustomerService } from '../services';
import NumberInput from './ui/NumberInput';
import SearchableSelect from './ui/SearchableSelect';
import QuickAddCustomerDialog from './ui/QuickAddCustomerDialog';
import { formatNumber } from '../lib/utils';

interface PaymentFormProps {
    payment?: Payment;
    initialPaymentType?: 'Revenue' | 'Expense'; // Default for new payments
    onSave: (payment: Omit<Payment, 'id'> | Payment) => void;
    onCancel: () => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ payment, initialPaymentType = 'Revenue', onSave, onCancel }) => {
    const [contractId, setContractId] = useState(payment?.contractId || '');
    const [customerId, setCustomerId] = useState(payment?.customerId || '');
    const [dueDate, setDueDate] = useState(payment?.dueDate || '');
    const [paymentDate, setPaymentDate] = useState(payment?.paymentDate || '');
    const [amount, setAmount] = useState(payment?.amount || 0);
    const [paidAmount, setPaidAmount] = useState(payment?.paidAmount || 0);
    const [status, setStatus] = useState<PaymentStatus>(payment?.status || 'Đã xuất HĐ');
    const [method, setMethod] = useState<PaymentMethod>(payment?.method || 'Chuyển khoản');
    const [paymentType, setPaymentType] = useState<'Revenue' | 'Expense'>(payment?.paymentType || initialPaymentType);
    const [invoiceNumber, setInvoiceNumber] = useState(payment?.invoiceNumber || '');
    const [invoiceDate, setInvoiceDate] = useState(payment?.invoiceDate || '');
    const [reference, setReference] = useState(payment?.reference || '');
    const [notes, setNotes] = useState(payment?.notes || '');

    // Display names for SearchableSelect
    const [contractDisplayName, setContractDisplayName] = useState<string>('');
    const [customerDisplayName, setCustomerDisplayName] = useState<string>('');
    const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);

    // Fetch display names on mount for edit mode
    useEffect(() => {
        if (payment?.contractId) {
            ContractService.getById(payment.contractId).then(c => {
                if (c) setContractDisplayName(`${c.id} - ${c.title}`);
            });
        }
        if (payment?.customerId) {
            CustomerService.getById(payment.customerId).then(c => {
                if (c) setCustomerDisplayName(c.name);
            });
        }
    }, []);

    // When a contract is selected, auto-fill customerId from that contract
    const handleContractChange = async (cId: string | null) => {
        setContractId(cId || '');
        if (cId) {
            const contract = await ContractService.getById(cId);
            if (contract) {
                setContractDisplayName(`${contract.id} - ${contract.title}`);
                if (contract.customerId) {
                    setCustomerId(contract.customerId);
                }
            }
        } else {
            setContractDisplayName('');
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

    const handleSubmit = () => {
        const paymentData = {
            ...(payment?.id && { id: payment.id }),
            contractId,
            customerId,
            dueDate,
            paymentDate: (status === 'Tiền về' || status === 'Tạm ứng') && !paymentDate ? new Date().toISOString().split('T')[0] : paymentDate,
            amount,
            paidAmount: (status === 'Tiền về' || status === 'Tạm ứng') ? amount : 0,
            status,
            method,
            invoiceNumber,
            invoiceDate,
            reference,
            notes,
            paymentType,
        };
        onSave(paymentData as any);
    };

    const formatCurrency = (val: number) => formatNumber(val);

    const statuses: PaymentStatus[] = ['Tạm ứng', 'Đã xuất HĐ', 'Tiền về'];
    const methods: PaymentMethod[] = ['Chuyển khoản', 'Tiền mặt', 'LC', 'Khác'];

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg">
                            <CreditCard size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                                {payment ? 'Sửa phiếu tài chính' : 'Thêm phiếu tài chính'}
                            </h2>
                            <p className="text-xs text-slate-500">Quản lý phiếu tài chính hợp đồng</p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {/* Contract & Customer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
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
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Building2 size={12} /> Khách hàng
                            </label>
                            <SearchableSelect
                                value={customerId || null}
                                placeholder="Gõ để tìm khách hàng..."
                                getDisplayValue={(id) => id === customerId ? customerDisplayName : undefined}
                                onChange={(cId) => {
                                    setCustomerId(cId || '');
                                }}
                                onSearch={async (query) => {
                                    const results = await CustomerService.search(query, 20);
                                    return results.map(c => ({
                                        id: c.id,
                                        name: c.name,
                                        subText: c.industry || c.type
                                    }));
                                }}
                                onAddNew={() => setShowAddCustomerDialog(true)}
                                addNewLabel="+ Thêm khách hàng mới"
                            />
                        </div>
                    </div>

                    {/* Payment Type */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Loại thanh toán</label>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
                            <button
                                type="button"
                                onClick={() => setPaymentType('Revenue')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${paymentType === 'Revenue' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Khoản Thu
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentType('Expense')}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${paymentType === 'Expense' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Khoản Chi
                            </button>
                        </div>
                    </div>

                    {/* Invoice & Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Hash size={12} /> Số hóa đơn
                            </label>
                            <input
                                type="text"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                placeholder="VD: HĐ001-1"
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Calendar size={12} /> Hạn thanh toán *
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <Calendar size={12} /> Ngày thanh toán
                            </label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setPaymentDate(val);
                                    if (val && !dueDate) {
                                        setDueDate(val); // Auto-fill Due Date if empty
                                    }
                                }}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                            <DollarSign size={12} /> Số tiền *
                        </label>
                        <NumberInput
                            value={amount}
                            onChange={(value) => setAmount(value)}
                            placeholder="0"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {amount > 0 && (
                            <p className="text-xs text-slate-400">{formatCurrency(amount)} VND</p>
                        )}
                    </div>

                    {/* Status & Method */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Trạng thái *</label>
                            <div className="grid grid-cols-3 gap-2">
                                {statuses.map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => {
                                            setStatus(s);
                                            if ((s === 'Tiền về' || s === 'Tạm ứng') && !paymentDate) {
                                                setPaymentDate(new Date().toISOString().split('T')[0]);
                                            }
                                        }}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${status === s
                                            ? s === 'Tiền về' ? 'bg-emerald-600 text-white'
                                                : s === 'Tạm ứng' ? 'bg-amber-600 text-white'
                                                    : 'bg-blue-600 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                            }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Phương thức</label>
                            <div className="grid grid-cols-2 gap-2">
                                {methods.map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => setMethod(m)}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${method === m
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                            }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Reference & Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Số UNC/Chứng từ</label>
                            <input
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="Số UNC..."
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Ghi chú</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Ghi chú..."
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2.5 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        // disabled={!contractId || !dueDate || !amount} // Disabled condition removed for better UX
                        className={`px-8 py-2.5 font-bold text-sm rounded-lg transition-colors flex items-center gap-2 ${(!contractId || !dueDate || !amount)
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                        onClick={(e) => {
                            if (!contractId || !dueDate || !amount) {
                                e.preventDefault();
                                import('sonner').then(({ toast }) => {
                                    if (!contractId) toast.error("Vui lòng chọn Hợp đồng");
                                    else if (!amount) toast.error("Vui lòng nhập Số tiền");
                                    else if (!dueDate) toast.error("Vui lòng chọn Hạn thanh toán");
                                });
                                return;
                            }
                            handleSubmit();
                        }}
                    >
                        <Save size={16} />
                        {payment ? 'Cập nhật' : 'Thêm mới'}
                    </button>
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
        </div>
    );
};

export default PaymentForm;
