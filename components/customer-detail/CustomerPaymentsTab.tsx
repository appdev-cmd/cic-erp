// CustomerDetail — Payments Tab
import React from 'react';
import { Calendar, CheckCircle, Clock, Banknote } from 'lucide-react';
import { Payment } from '../../types';
import { formatDate } from '../../utils/formatters';

interface CustomerPaymentsTabProps {
    payments: Payment[];
    paymentStats: { totalAmount: number; paidAmount: number; pendingAmount: number };
    formatCurrency: (val: number) => string;
    onViewContract: (contractId: string) => void;
}

const CustomerPaymentsTab: React.FC<CustomerPaymentsTabProps> = React.memo(({
    payments, paymentStats, formatCurrency, onViewContract
}) => (
    <div className="space-y-4">
        {/* Payment Summary */}
        <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">{formatCurrency(paymentStats.totalAmount)}</p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Tổng phải thu</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(paymentStats.paidAmount)}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Đã thu</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                <p className="text-lg font-black text-amber-600 dark:text-amber-400">{formatCurrency(paymentStats.pendingAmount)}</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">Công nợ</p>
            </div>
        </div>

        {/* Payments List */}
        {payments.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                            <th className="text-left py-3 px-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">Ngày</th>
                            <th className="text-left py-3 px-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase hidden md:table-cell">Mã HĐ</th>
                            <th className="text-left py-3 px-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase hidden lg:table-cell">Số HĐ/CT</th>
                            <th className="text-right py-3 px-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">Số tiền</th>
                            <th className="text-center py-3 px-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase hidden sm:table-cell">PT thanh toán</th>
                            <th className="text-center py-3 px-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...payments].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()).map(payment => (
                            <tr key={payment.id} className="border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={13} className="text-slate-400" />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">
                                            {formatDate(payment.paymentDate)}
                                        </span>
                                    </div>
                                </td>
                                <td className="py-3 px-4 hidden md:table-cell">
                                    <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline"
                                        onClick={() => onViewContract(payment.contractId)}
                                    >
                                        {payment.contractId}
                                    </span>
                                </td>
                                <td className="py-3 px-4 hidden lg:table-cell">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">{payment.invoiceNumber || payment.reference || '—'}</span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{formatCurrency(payment.amount)}</span>
                                </td>
                                <td className="py-3 px-4 text-center hidden sm:table-cell">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        {payment.method}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold ${payment.status === 'Tiền về'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                        }`}>
                                        {payment.status === 'Tiền về' ? <CheckCircle size={10} /> : <Clock size={10} />}
                                        {payment.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <div className="text-center py-12">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Banknote size={24} className="text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Chưa có thanh toán</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Chưa có lần thanh toán nào được ghi nhận</p>
            </div>
        )}
    </div>
));

CustomerPaymentsTab.displayName = 'CustomerPaymentsTab';
export default CustomerPaymentsTab;
