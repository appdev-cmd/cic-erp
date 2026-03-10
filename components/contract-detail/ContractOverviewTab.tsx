// ContractDetail — Overview Tab (Financial Summary + Vouchers + Milestones + Payments + Sidebar)
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
    Calendar, DollarSign, FileText, Paperclip, ShieldCheck, AlertCircle,
    CheckCircle2, Clock, TrendingUp, ReceiptText, ShieldAlert, Wallet,
    Trash2, Plus, Loader2, ExternalLink, HardDrive,
    History as HistoryIcon, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';
import { Contract, PaymentPhase, ContractDocument, Payment, VoucherType } from '../../types';
import { AuditLogService, AuditLog, PaymentService } from '../../services';
import { formatVND } from '../../utils/contractHelpers';
import { formatNumber } from '../../lib/utils';
import PaymentForm from '../PaymentForm';
import { usePermissionCheck } from '../../hooks/usePermissions';
import { useSlidePanelSafe } from '../../contexts/SlidePanelContext';

interface ContractOverviewTabProps {
    contract: Contract;
    financials: {
        totalOutput: number;
        totalRevenue: number;
        totalCosts: number;
        grossProfit: number;
        margin: number;
        totalExecution: number;
    };
    documents: ContractDocument[];
    auditLogs: AuditLog[];
    driveFolderUrl: string | null;
    aiAnalysisResult: string | null;
    isAnalyzing: boolean;
    handleAnalyzeContract: () => void;
    setAiAnalysisResult: (v: string | null) => void;
    handleDownloadDoc: (doc: ContractDocument) => void;
    handleDeleteDoc: (doc: ContractDocument, e: React.MouseEvent) => void;
    setShowDocLinkDialog: (v: boolean) => void;
    getPaymentStatusBadge: (status: PaymentPhase['status']) => React.ReactNode;
}

const VOUCHER_COLORS: Record<VoucherType, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    VAT_INVOICE: { bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', text: 'text-blue-600 dark:text-blue-400', icon: <FileText size={14} />, label: 'HĐ VAT' },
    RECEIPT: { bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-600 dark:text-emerald-400', icon: <ArrowDownCircle size={14} />, label: 'Phiếu thu' },
    EXPENSE: { bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800', text: 'text-rose-600 dark:text-rose-400', icon: <ArrowUpCircle size={14} />, label: 'Phiếu chi' },
};

const ContractOverviewTab: React.FC<ContractOverviewTabProps> = ({
    contract, financials, documents, auditLogs, driveFolderUrl,
    aiAnalysisResult, isAnalyzing, handleAnalyzeContract, setAiAnalysisResult,
    handleDownloadDoc, handleDeleteDoc, setShowDocLinkDialog, getPaymentStatusBadge
}) => {
    // === Voucher state ===
    const { can } = usePermissionCheck();
    const [vouchers, setVouchers] = useState<Payment[]>([]);
    const [loadingVouchers, setLoadingVouchers] = useState(true);
    const [showVoucherForm, setShowVoucherForm] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState<Payment | undefined>(undefined);
    const [voucherFormType, setVoucherFormType] = useState<VoucherType>('VAT_INVOICE');

    // Panel lock: prevent accidental closure when form is open
    const slidePanelCtx = useSlidePanelSafe();

    useEffect(() => {
        if (!slidePanelCtx) return;
        if (showVoucherForm) {
            slidePanelCtx.lockPanel();
        } else {
            slidePanelCtx.unlockPanel();
        }
    }, [showVoucherForm]);

    const canCreatePayment = can('payments', 'create');
    const canDeletePayment = can('payments', 'delete');

    // Fetch vouchers for this contract
    useEffect(() => {
        if (contract.id) {
            setLoadingVouchers(true);
            PaymentService.getByContractId(contract.id)
                .then(setVouchers)
                .catch(e => console.error('Load vouchers error', e))
                .finally(() => setLoadingVouchers(false));
        }
    }, [contract.id]);

    const handleAddVoucher = (type: VoucherType) => {
        setVoucherFormType(type);
        setEditingVoucher(undefined);
        setShowVoucherForm(true);
    };

    const handleEditVoucher = (payment: Payment) => {
        setEditingVoucher(payment);
        setVoucherFormType(payment.voucherType || 'RECEIPT');
        setShowVoucherForm(true);
    };

    const handleSaveVoucher = async (data: any) => {
        try {
            // Pre-fill contractId and customerId
            const payload = { ...data, contractId: contract.id, customerId: contract.customerId || data.customerId };
            if (data.id) {
                const updated = await PaymentService.update(data.id, payload);
                if (updated) setVouchers(prev => prev.map(v => v.id === data.id ? updated : v));
                toast.success('Cập nhật phiếu thành công');
            } else {
                const created = await PaymentService.create(payload);
                setVouchers(prev => [created, ...prev]);
                toast.success('Tạo phiếu thành công');
            }
            setShowVoucherForm(false);
            setEditingVoucher(undefined);
        } catch (error) {
            console.error('Save voucher error', error);
            toast.error('Lưu phiếu thất bại');
        }
    };

    const handleDeleteVoucher = async (id: string) => {
        if (!window.confirm('Xóa phiếu này?')) return;
        try {
            await PaymentService.delete(id);
            setVouchers(prev => prev.filter(v => v.id !== id));
            toast.success('Đã xóa phiếu');
        } catch (error) {
            toast.error('Xóa thất bại');
        }
    };

    // Group vouchers by type
    const vatInvoices = vouchers.filter(v => v.voucherType === 'VAT_INVOICE');
    const receipts = vouchers.filter(v => v.voucherType === 'RECEIPT');
    const expenses = vouchers.filter(v => v.voucherType === 'EXPENSE');

    const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <>
                        {/* 1. FINANCIAL SUMMARY */}
                        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <Wallet size={20} className="text-orange-500" />
                                Tổng quan Tài chính
                            </h3>

                            <div className="space-y-6">
                                {/* Row 1: Plan */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giá trị Ký kết</p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
                                            {formatVND(financials.totalOutput || contract.value)} <span className="text-xs font-medium text-slate-400">đ</span>
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Doanh thu (-VAT)</p>
                                        <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                                            {formatVND(financials.totalRevenue || contract.value)} <span className="text-xs font-medium text-slate-400">đ</span>
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tổng chi phí dự kiến</p>
                                        <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                                            {formatVND(financials.totalCosts)}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lợi nhuận gộp</p>
                                        <div className="flex items-center gap-2">
                                            <p className={`text-2xl font-black ${financials.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {formatVND(financials.grossProfit)}
                                            </p>
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${financials.grossProfit >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'}`}>
                                                {financials.margin.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: Actual Cashflow — computed from voucher records */}
                                {(() => {
                                    // Đã xuất HĐ = tổng giá trị sau VAT của phiếu VAT_INVOICE
                                    const totalInvoiced = vouchers
                                        .filter(v => v.voucherType === 'VAT_INVOICE')
                                        .reduce((sum, v) => sum + (v.amount || 0), 0);
                                    // Doanh thu = tổng giá trị trước VAT từ line items (mỗi SP có VAT khác nhau)
                                    const totalRevenuePreVAT = vouchers
                                        .filter(v => v.voucherType === 'VAT_INVOICE')
                                        .reduce((sum, v) => {
                                            const items = v.vatInvoiceItems || [];
                                            if (items.length > 0) {
                                                return sum + items.reduce((s, item) => s + (item.amountBeforeVAT || 0), 0);
                                            }
                                            // Fallback: nếu chưa có line items, chia theo vatRate hợp đồng
                                            const rate = contract.vatRate ?? 10;
                                            const divisor = contract.hasVat !== false && rate > 0 ? (1 + rate / 100) : 1;
                                            return sum + Math.round((v.amount || 0) / divisor);
                                        }, 0);
                                    // Tiền về = tổng phiếu RECEIPT có status 'Tiền về'
                                    const totalCashReceived = vouchers
                                        .filter(v => v.voucherType === 'RECEIPT' && v.status === 'Tiền về')
                                        .reduce((sum, v) => sum + (v.amount || 0), 0);
                                    // Công nợ = Đã xuất HĐ (sau VAT) - Tiền về
                                    const totalReceivable = totalInvoiced - totalCashReceived;
                                    return (
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                            {(contract.advanceAmount || 0) > 0 && (
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1">
                                                        <Wallet size={12} /> Tạm ứng
                                                    </p>
                                                    <p className="text-xl font-black text-amber-600 dark:text-amber-400">
                                                        {formatVND(contract.advanceAmount || 0)}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">Chưa xuất HĐ</p>
                                                </div>
                                            )}
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1">
                                                    <FileText size={12} /> Đã xuất Hóa đơn
                                                </p>
                                                <p className="text-xl font-black text-blue-600 dark:text-blue-400">
                                                    {formatVND(totalInvoiced)}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {totalInvoiced > 0 ? `${(totalInvoiced / (contract.value || 1) * 100).toFixed(1)}% giá trị HĐ` : 'Chưa xuất'}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                                                    <TrendingUp size={12} /> Doanh thu (−VAT)
                                                </p>
                                                <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                                                    {formatVND(totalRevenuePreVAT)}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {totalRevenuePreVAT > 0 ? 'Tổng trước thuế' : 'Chưa có'}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                                                    <DollarSign size={12} /> Tiền về (Đã thu)
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                                        {formatVND(totalCashReceived)}
                                                    </p>
                                                    {totalCashReceived > 0 && (
                                                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                                                            {(totalCashReceived / (contract.value || 1) * 100).toFixed(1)}%
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1">
                                                    <AlertCircle size={12} /> Công nợ phải thu
                                                </p>
                                                <p className="text-xl font-black text-rose-600 dark:text-rose-400">
                                                    {formatVND(totalReceivable > 0 ? totalReceivable : 0)}
                                                </p>
                                                <p className="text-[10px] text-slate-400">
                                                    {totalInvoiced > 0 ? 'HĐ VAT - Tiền về' : 'Chưa xuất HĐ'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* === 2. VOUCHERS SECTION (NEW) === */}
                        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <ReceiptText size={20} className="text-orange-500" />
                                    Phiếu Tài chính
                                </h3>
                                {canCreatePayment && (
                                    <div className="flex gap-2">
                                        <button onClick={() => handleAddVoucher('VAT_INVOICE')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 hover:bg-blue-700 transition-colors">
                                            <Plus size={13} /> HĐ VAT
                                        </button>
                                        <button onClick={() => handleAddVoucher('RECEIPT')} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition-colors">
                                            <Plus size={13} /> Thu
                                        </button>
                                        <button onClick={() => handleAddVoucher('EXPENSE')} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 hover:bg-rose-700 transition-colors">
                                            <Plus size={13} /> Chi
                                        </button>
                                    </div>
                                )}
                            </div>

                            {loadingVouchers ? (
                                <div className="text-center py-6 text-slate-400"><Loader2 size={20} className="animate-spin inline mr-2" /> Đang tải...</div>
                            ) : vouchers.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <ReceiptText size={20} className="text-slate-400" />
                                    </div>
                                    <p className="text-xs text-slate-400 italic">Chưa có phiếu tài chính nào cho hợp đồng này</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* VAT Invoices */}
                                    {vatInvoices.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1"><FileText size={11} /> Phiếu xuất HĐ VAT ({vatInvoices.length})</p>
                                            <div className="space-y-2">
                                                {vatInvoices.map(v => (
                                                    <div key={v.id} onClick={() => handleEditVoucher(v)}
                                                        className="flex items-center justify-between p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer group">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center"><FileText size={14} /></div>
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{v.invoiceNumber || 'Chưa có số HĐ'}</p>
                                                                <p className="text-[10px] text-slate-400">{formatDate(v.invoiceDate || v.dueDate)} • {v.status}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-black text-blue-600 dark:text-blue-400">{formatNumber(v.amount)} ₫</span>
                                                            {canDeletePayment && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteVoucher(v.id); }}
                                                                    className="p-1 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Receipts */}
                                    {receipts.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1"><ArrowDownCircle size={11} /> Phiếu thu ({receipts.length})</p>
                                            <div className="space-y-2">
                                                {receipts.map(v => (
                                                    <div key={v.id} onClick={() => handleEditVoucher(v)}
                                                        className="flex items-center justify-between p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer group">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center"><ArrowDownCircle size={14} /></div>
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{v.reference || v.method || 'Phiếu thu'}</p>
                                                                <p className="text-[10px] text-slate-400">{formatDate(v.paymentDate)} • {v.status}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatNumber(v.amount)} ₫</span>
                                                            {canDeletePayment && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteVoucher(v.id); }}
                                                                    className="p-1 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Expenses */}
                                    {expenses.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-1"><ArrowUpCircle size={11} /> Phiếu chi ({expenses.length})</p>
                                            <div className="space-y-2">
                                                {expenses.map(v => (
                                                    <div key={v.id} onClick={() => handleEditVoucher(v)}
                                                        className="flex items-center justify-between p-3 bg-rose-50/50 dark:bg-rose-900/10 rounded-lg border border-rose-100 dark:border-rose-800 hover:border-rose-300 dark:hover:border-rose-700 transition-colors cursor-pointer group">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg flex items-center justify-center"><ArrowUpCircle size={14} /></div>
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{v.expenseCategory || v.notes || 'Phiếu chi'}</p>
                                                                <p className="text-[10px] text-slate-400">{formatDate(v.paymentDate)} • {v.status}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm font-black text-rose-600 dark:text-rose-400">{formatNumber(v.amount)} ₫</span>
                                                            {canDeletePayment && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteVoucher(v.id); }}
                                                                    className="p-1 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Totals */}
                                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-4">
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-blue-500 uppercase">Xuất HĐ</p>
                                            <p className="text-sm font-black text-blue-600 dark:text-blue-400">{formatNumber(vatInvoices.reduce((s, v) => s + v.amount, 0))} ₫</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-emerald-500 uppercase">Đã thu</p>
                                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatNumber(receipts.reduce((s, v) => s + v.amount, 0))} ₫</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-bold text-rose-500 uppercase">Đã chi</p>
                                            <p className="text-sm font-black text-rose-600 dark:text-rose-400">{formatNumber(expenses.reduce((s, v) => s + v.amount, 0))} ₫</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* INVOICE SCHEDULE */}
                        {contract.revenueSchedules && contract.revenueSchedules.length > 0 && (
                            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                    <FileText size={20} className="text-blue-500" />
                                    Lịch xuất Hóa đơn Doanh thu
                                </h3>
                                <div className="space-y-3">
                                    {contract.revenueSchedules.map((rev, idx) => (
                                        <div key={rev.id || idx} className="flex items-center justify-between p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800 hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center text-xs font-black">{idx + 1}</div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{rev.description || `Đợt ${idx + 1}`}</p>
                                                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                        <Calendar size={10} />
                                                        {rev.date ? new Date(rev.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa xác định'}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-black text-blue-600 dark:text-blue-400">{formatVND(rev.amount || 0)}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-blue-100 dark:border-blue-800">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng giá trị xuất HĐ</span>
                                        <span className="text-sm font-black text-blue-700 dark:text-blue-300">
                                            {formatVND(contract.revenueSchedules.reduce((sum, r) => sum + (r.amount || 0), 0))}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. MILESTONES */}
                        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                            <div className="p-6 md:p-8">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                    <TrendingUp size={20} className="text-orange-500" />
                                    Tiến độ thực hiện & Triển khai
                                </h3>
                                <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
                                    {contract.milestones && contract.milestones.length > 0 ? (
                                        contract.milestones.map((m) => (
                                            <div key={m.id} className="flex gap-4 relative">
                                                <div className={`w-6 h-6 rounded-full border-4 border-white dark:border-slate-900 z-10 flex-shrink-0 flex items-center justify-center shadow-sm ${m.status === 'Completed' ? 'bg-orange-500' : m.status === 'Ongoing' ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                                    {m.status === 'Completed' ? <CheckCircle2 size={10} className="text-white" /> : m.status === 'Ongoing' ? <Clock size={10} className="text-white" /> : null}
                                                </div>
                                                <div className="flex-1 p-4 bg-slate-50/50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-orange-100 dark:hover:border-orange-900 transition-colors">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{m.name}</p>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{m.date}</span>
                                                    </div>
                                                    {m.description && <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-1">{m.description}</p>}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs text-slate-500 dark:text-slate-400 italic">Chưa có thông tin các mốc triển khai chi tiết.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 4. PAYMENT PHASES */}
                        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6 md:p-8">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                                <ReceiptText size={20} className="text-orange-500" />
                                Lộ trình thanh toán & Công nợ
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Revenue (In) */}
                                <div className="space-y-4">
                                    <p className="text-[11px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-100 dark:border-emerald-900 pb-2">Kế hoạch Tiền về</p>
                                    {contract.paymentPhases?.filter(p => !p.type || p.type === 'Revenue').map((p, idx) => (
                                        <div key={p.id} className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                            <div className="flex justify-between mb-2">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{p.name || `Đợt ${idx + 1}`}</span>
                                                {getPaymentStatusBadge(p.status)}
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] text-slate-400">
                                                    {p.dueDate ? new Date(p.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa xác định'}
                                                </span>
                                                <span className="text-sm font-black text-emerald-600">{formatVND(p.amount)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {(!contract.paymentPhases || contract.paymentPhases.filter(p => !p.type || p.type === 'Revenue').length === 0) && (
                                        <p className="text-xs text-slate-400 italic">Chưa có kế hoạch thu tiền</p>
                                    )}
                                </div>

                                {/* Expense (Out) */}
                                <div className="space-y-4">
                                    <p className="text-[11px] font-black text-rose-600 uppercase tracking-widest border-b border-rose-100 dark:border-rose-900 pb-2">Kế hoạch Chi trả</p>
                                    {contract.paymentPhases?.filter(p => p.type === 'Expense').map((p, idx) => (
                                        <div key={p.id} className="p-4 bg-rose-50/50 dark:bg-rose-900/10 rounded-lg border border-rose-100 dark:border-rose-800">
                                            <div className="flex justify-between mb-2">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{p.name || `Thanh toán NCC ${idx + 1}`}</span>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">DỰ CHI</span>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] text-slate-400">
                                                    {p.dueDate ? new Date(p.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa xác định'}
                                                </span>
                                                <span className="text-sm font-black text-rose-500">{formatVND(p.amount)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {(!contract.paymentPhases || contract.paymentPhases.filter(p => p.type === 'Expense').length === 0) && (
                                        <p className="text-xs text-slate-400 italic">Chưa có kế hoạch chi trả NCC</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                </div>

                {/* SIDEBAR RIGHT */}
                <div className="space-y-6">
                    {/* AI Risk Check */}
                    <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg p-6 text-white shadow-xl shadow-orange-200 dark:shadow-none relative overflow-hidden transition-all">
                        <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck size={20} />
                            <h4 className="font-bold">AI Risk Check</h4>
                        </div>

                        {!aiAnalysisResult ? (
                            <div className="space-y-3">
                                <p className="text-sm text-orange-100 leading-relaxed">
                                    Sử dụng <b>DeepSeek AI</b> để phân tích rủi ro hợp đồng dựa trên các điều khoản tài chính và tiến độ.
                                </p>
                                <button onClick={handleAnalyzeContract} disabled={isAnalyzing}
                                    className="w-full mt-2 py-2 bg-white/20 hover:bg-white/30 transition-colors rounded-lg text-xs font-bold backdrop-blur-md border border-white/10 flex items-center justify-center gap-2">
                                    {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <ShieldAlert size={14} />}
                                    {isAnalyzing ? 'Đang phân tích...' : 'Qét rủi ro ngay'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                <div className="p-3 bg-white/10 rounded-lg border border-white/10 text-xs text-orange-50 leading-relaxed overflow-y-auto max-h-[300px] whitespace-pre-wrap">
                                    {aiAnalysisResult.replace(/\*\*(.*?)\*\*/g, '$1')}
                                </div>
                                <button onClick={() => setAiAnalysisResult(null)}
                                    className="w-full py-2 text-xs font-bold text-orange-200 hover:text-white transition-colors">
                                    Phân tích lại
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Documents */}
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <Paperclip size={18} className="text-slate-400" />
                                Tài liệu hồ sơ
                            </h4>
                            <div className="flex items-center gap-2">
                                {driveFolderUrl && (
                                    <a href={driveFolderUrl} target="_blank" rel="noopener noreferrer"
                                        className="bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-[11px] font-bold">
                                        <HardDrive size={13} /> Mở Drive <ExternalLink size={11} />
                                    </a>
                                )}
                                <button onClick={() => setShowDocLinkDialog(true)}
                                    className="bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-600 dark:text-orange-400 p-2 rounded-lg transition-colors flex items-center justify-center">
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {/* Draft URL */}
                            {contract.draft_url && (
                                <a href={contract.draft_url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center justify-between p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-all cursor-pointer group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="p-2 bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 rounded-lg"><FileText size={16} /></div>
                                        <div className="overflow-hidden">
                                            <p className="text-xs font-bold text-violet-700 dark:text-violet-300">📝 Dự thảo hợp đồng (Google Doc)</p>
                                            <p className="text-[10px] text-violet-500 dark:text-violet-400 truncate max-w-[180px]">{contract.draft_url}</p>
                                        </div>
                                    </div>
                                    <div className="px-2 py-1 bg-violet-600 text-white rounded-lg text-[10px] font-bold">Mở</div>
                                </a>
                            )}

                            {documents.length === 0 && !contract.draft_url && <p className="text-xs text-slate-400 italic text-center py-4">Chưa có tài liệu nào</p>}
                            {documents.map((file) => {
                                const isExternalLink = file.url && (file.url.includes('google.com') || file.url.includes('drive.google.com') || !file.filePath);
                                const isGoogleDoc = file.url?.includes('docs.google.com/document');
                                const isGoogleSheet = file.url?.includes('docs.google.com/spreadsheets');
                                const isGoogleDrive = file.url?.includes('drive.google.com');
                                const iconBg = isGoogleDoc ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500'
                                    : isGoogleSheet ? 'bg-green-50 dark:bg-green-900/30 text-green-500'
                                        : isGoogleDrive ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-500'
                                            : 'bg-rose-50 dark:bg-rose-900/30 text-rose-500';
                                const typeLabel = isGoogleDoc ? 'Google Doc' : isGoogleSheet ? 'Google Sheet' : isGoogleDrive ? 'Google Drive' : 'Tài liệu';

                                return (
                                    <a key={file.id} href={isExternalLink ? file.url : '#'} target={isExternalLink ? '_blank' : '_self'} rel="noopener noreferrer"
                                        onClick={(e) => !isExternalLink && (e.preventDefault(), handleDownloadDoc(file))}
                                        className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all cursor-pointer group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`p-2 rounded-lg group-hover:opacity-80 transition-colors ${iconBg}`}><FileText size={16} /></div>
                                            <div className="overflow-hidden">
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                                                <p className="text-[10px] text-slate-400 dark:text-slate-500">{typeLabel} • {new Date(file.uploadedAt).toLocaleDateString('vi-VN')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteDoc(file, e); }}
                                                className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                                                <Trash2 size={14} />
                                            </button>
                                            <div className="px-2 py-1 bg-orange-600 text-white rounded-lg text-[10px] font-bold">Mở</div>
                                        </div>
                                    </a>
                                );
                            })}
                        </div>
                    </div>

                    {/* Audit Logs */}
                    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                            <HistoryIcon size={18} className="text-slate-400" />
                            Lịch sử tác động
                        </h4>
                        <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
                            {auditLogs.length > 0 ? (
                                auditLogs.slice(0, 10).map((log) => {
                                    const { date, time } = AuditLogService.formatDateTime(log.created_at);
                                    const eventText = AuditLogService.formatAction(log.action, log.old_data, log.new_data);
                                    const dotColor =
                                        log.action === 'INSERT' ? 'bg-emerald-500' :
                                            log.action === 'DELETE' ? 'bg-rose-500' :
                                                log.action === 'REJECT' ? 'bg-rose-500' :
                                                    (log.action === 'APPROVE_LEGAL' || log.action === 'APPROVE_FINANCE') ? 'bg-emerald-500' :
                                                        log.action === 'SUBMIT_LEGAL' ? 'bg-blue-500' : 'bg-orange-500';

                                    return (
                                        <div key={log.id} className="flex gap-4 relative">
                                            <div className={`w-6 h-6 rounded-full border-4 border-white dark:border-slate-900 z-10 flex-shrink-0 flex items-center justify-center shadow-sm ${dotColor}`}>
                                                <ShieldCheck size={10} className="text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="text-[10px] font-bold text-slate-400">{date}</p>
                                                    <span className="text-[10px] text-slate-300">•</span>
                                                    <p className="text-[10px] text-slate-400">{time}</p>
                                                </div>
                                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{eventText}</p>
                                                <p className="text-[10px] text-orange-500 dark:text-orange-400 font-medium mt-0.5">
                                                    bởi {log.user_name || 'Hệ thống'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-xs text-slate-400 text-center py-4">Chưa có lịch sử tác động</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Voucher Form Modal */}
            {showVoucherForm && (
                <PaymentForm
                    payment={editingVoucher}
                    initialVoucherType={voucherFormType}
                    initialContractId={contract.id}
                    initialCustomerId={contract.customerId}
                    onSave={handleSaveVoucher}
                    onCancel={() => { setShowVoucherForm(false); setEditingVoucher(undefined); }}
                />
            )}
        </>
    );
};

export default React.memo(ContractOverviewTab);
