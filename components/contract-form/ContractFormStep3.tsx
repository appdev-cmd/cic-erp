// ContractForm Step 3: Kế hoạch Tài chính (Revenue, Payment, Supplier Schedules)
import React, { useMemo } from 'react';
import { DollarSign, Calculator, X, Receipt, CreditCard, StickyNote } from 'lucide-react';
import { PaymentSchedule, RevenueSchedule, LineItem } from '../../types';
import DateInput from '../ui/DateInput';

interface ContractFormStep3Props {
    revenueSchedules: RevenueSchedule[];
    setRevenueSchedules: (v: RevenueSchedule[]) => void;
    paymentSchedules: PaymentSchedule[];
    setPaymentSchedules: (v: PaymentSchedule[]) => void;
    supplierSchedules: PaymentSchedule[];
    setSupplierSchedules: (v: PaymentSchedule[]) => void;
    generateSupplierSchedules: () => void;
    paymentTermDays?: number;
    setPaymentTermDays: (v: number | undefined) => void;
    formatVND: (val: number) => string;
    notes?: string;
    setNotes?: (v: string) => void;
    totals?: { signingValue: number; totalCosts: number };
    lineItems?: LineItem[];
}

const ContractFormStep3: React.FC<ContractFormStep3Props> = ({
    revenueSchedules, setRevenueSchedules,
    paymentSchedules, setPaymentSchedules,
    supplierSchedules, setSupplierSchedules,
    generateSupplierSchedules,
    paymentTermDays, setPaymentTermDays,
    formatVND,
    notes, setNotes,
    totals, lineItems,
}) => {
    // Tự động tính tổng chi phí theo từng nhà cung cấp
    const supplierGroups = useMemo(() => {
        const groups: { [key: string]: number } = {};
        if (lineItems) {
            lineItems.forEach(item => {
                if (item.supplier) {
                    const cost = item.quantity * item.inputPrice;
                    groups[item.supplier] = (groups[item.supplier] || 0) + cost;
                }
            });
        }
        return groups;
    }, [lineItems]);

    // Hàm lấy giá trị nhà cung cấp từ mô tả đợt chi
    const getSupplierTotal = (description: string) => {
        const suppliers = Object.keys(supplierGroups);
        const matched = suppliers.filter(s => description.includes(s)).sort((a, b) => b.length - a.length);
        if (matched.length > 0) {
            return supplierGroups[matched[0]];
        }
        return totals?.totalCosts || 0;
    };
    return (
        <section className="space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-3 border-l-4 border-emerald-500 pl-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign size={16} /> Kế hoạch Tài chính
                </h3>
            </div>

            <div className="pl-4 border-l border-slate-200 dark:border-slate-800 space-y-8">
                {/* Payment Term */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Hạn thanh toán</p>
                    </div>
                    <div className="grid grid-cols-12 gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="col-span-12 md:col-span-4 space-y-1">
                            <label className="text-[9px] text-slate-400 font-bold uppercase">Số ngày hạn mức kể từ ngày XHĐ</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="Điền số ngày..."
                                    value={paymentTermDays !== undefined ? paymentTermDays : ''}
                                    onChange={(e) => {
                                        const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                                        setPaymentTermDays(val);
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800 dark:text-slate-200"
                                />
                                <span className="text-[11px] text-slate-400 font-bold shrink-0">Ngày</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Revenue Schedules */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Lịch xuất hóa đơn doanh thu</p>
                        <button
                            onClick={() => setRevenueSchedules([...revenueSchedules, { id: Date.now().toString(), date: '', amount: 0, description: 'Đợt mới' }])}
                            className="text-indigo-600 font-bold text-[10px]"
                        >
                            + Thêm đợt
                        </button>
                    </div>
                    <div className="space-y-3">
                        {revenueSchedules.map((rev, idx) => (
                            <div key={rev.id} className="grid grid-cols-12 gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="col-span-4 space-y-1">
                                    <label className="text-[9px] text-slate-400 font-bold uppercase">Ngày XHĐ</label>
                                    <DateInput
                                        value={rev.date}
                                        onChange={(val) => {
                                            const newSched = [...revenueSchedules];
                                            newSched[idx].date = val;
                                            setRevenueSchedules(newSched);
                                        }}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800 dark:text-slate-200"
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
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                                    />
                                </div>
                                <div className="col-span-4 space-y-1 text-right">
                                    <label className="text-[9px] text-slate-400 font-bold uppercase">Tiền (VAT)</label>
                                    <div className="flex items-center justify-end gap-2">
                                        <input
                                            type="text"
                                            placeholder="Tiền..."
                                            value={rev.amount ? formatVND(rev.amount) : ''}
                                            onChange={(e) => {
                                                const raw = e.target.value.replace(/\./g, '');
                                                if (!/^\d*$/.test(raw)) return;
                                                const newSched = [...revenueSchedules];
                                                newSched[idx].amount = Number(raw);
                                                setRevenueSchedules(newSched);
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-[11px] font-black text-right outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800 dark:text-slate-200"
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
                        <button
                            onClick={() => setPaymentSchedules([...paymentSchedules, { id: Date.now().toString(), date: '', amount: 0, description: '', status: 'Pending', percentage: 0, type: 'Revenue' }])}
                            className="text-emerald-600 font-bold text-[10px]"
                        >
                            + Thêm đợt
                        </button>
                    </div>
                    <div className="space-y-3">
                        {paymentSchedules.map((pay, idx) => (
                            <div key={pay.id} className="grid grid-cols-12 gap-2 bg-emerald-50/50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                <div className="col-span-4 space-y-1">
                                    <label className="text-[9px] text-slate-400 font-bold uppercase">Ngày thanh toán</label>
                                    <DateInput
                                        value={pay.date}
                                        onChange={(val) => {
                                            const newSched = [...paymentSchedules];
                                            newSched[idx].date = val;
                                            setPaymentSchedules(newSched);
                                        }}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-md px-2 py-1.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-slate-800 dark:text-slate-200"
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
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-md px-2 py-1.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                                    />
                                </div>
                                <div className="col-span-4 space-y-1 text-right">
                                    <label className="text-[9px] text-slate-400 font-bold uppercase">Tỷ lệ (%) / Số tiền</label>
                                    <div className="flex items-center justify-end gap-1">
                                        <div className="relative w-16 shrink-0">
                                            <input
                                                type="number"
                                                placeholder="%"
                                                value={pay.percentage || ''}
                                                onChange={(e) => {
                                                    const perc = Number(e.target.value);
                                                    const newSched = [...paymentSchedules];
                                                    newSched[idx].percentage = perc;
                                                    if (totals?.signingValue) {
                                                        newSched[idx].amount = Math.round((totals.signingValue * perc) / 100);
                                                    }
                                                    setPaymentSchedules(newSched);
                                                }}
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-md pl-1.5 pr-4 py-1.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-slate-800 dark:text-slate-200 text-center"
                                            />
                                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">%</span>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Tiền..."
                                            value={pay.amount ? formatVND(pay.amount) : ''}
                                            onChange={(e) => {
                                                const raw = e.target.value.replace(/\./g, '');
                                                if (!/^\d*$/.test(raw)) return;
                                                const newSched = [...paymentSchedules];
                                                const paramAmount = Number(raw);
                                                newSched[idx].amount = paramAmount;
                                                if (totals?.signingValue && totals.signingValue > 0) {
                                                    // Tính lại %
                                                    const newPerc = (paramAmount / totals.signingValue) * 100;
                                                    newSched[idx].percentage = Number(newPerc.toFixed(2));
                                                }
                                                setPaymentSchedules(newSched);
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-md px-2 py-1.5 text-[11px] font-black text-right outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-emerald-600"
                                        />
                                        {paymentSchedules.length > 1 && (
                                            <button onClick={() => setPaymentSchedules(paymentSchedules.filter(p => p.id !== pay.id))} className="text-emerald-400 hover:text-rose-500 transition-colors flex-shrink-0 ml-1">
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

            {/* Supplier Schedules (Outgoing) */}
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
                    <button
                        onClick={() => setSupplierSchedules([...supplierSchedules, { id: Date.now().toString(), date: '', amount: 0, description: '', status: 'Pending', percentage: 0, type: 'Expense' }])}
                        className="text-rose-600 font-bold text-[10px]"
                    >
                        + Thêm đợt chi
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {supplierSchedules.map((pay, idx) => (
                        <div key={pay.id} className="grid grid-cols-12 gap-2 bg-rose-50/50 dark:bg-rose-900/10 p-3 rounded-lg border border-rose-100 dark:border-rose-800">
                            <div className="col-span-4 space-y-1">
                                <label className="text-[9px] text-slate-400 font-bold uppercase">Hạn thanh toán</label>
                                <DateInput
                                    value={pay.date}
                                    onChange={(val) => {
                                        const newSched = [...supplierSchedules];
                                        newSched[idx].date = val;
                                        setSupplierSchedules(newSched);
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-md px-2 py-1.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-rose-500 transition-all text-slate-800 dark:text-slate-200"
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
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-md px-2 py-1.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-rose-500 transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                                />
                            </div>
                            <div className="col-span-4 space-y-1 text-right">
                                <label className="text-[9px] text-slate-400 font-bold uppercase">Tỷ lệ (%) / Số tiền chi</label>
                                <div className="flex items-center justify-end gap-1">
                                    <div className="relative w-16 shrink-0">
                                        <input
                                            type="number"
                                            placeholder="%"
                                            value={pay.percentage || ''}
                                            onChange={(e) => {
                                                const perc = Number(e.target.value);
                                                const newSched = [...supplierSchedules];
                                                newSched[idx].percentage = perc;
                                                // Tính tự động theo value của NCC đó
                                                const totalRef = getSupplierTotal(pay.description);
                                                newSched[idx].amount = Math.round((totalRef * perc) / 100);
                                                setSupplierSchedules(newSched);
                                            }}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-md pl-1.5 pr-4 py-1.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-rose-500 transition-all text-slate-800 dark:text-slate-200 text-center"
                                        />
                                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">%</span>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Tiền..."
                                        value={pay.amount ? formatVND(pay.amount) : ''}
                                        onChange={(e) => {
                                            const raw = e.target.value.replace(/\./g, '');
                                            if (!/^\d*$/.test(raw)) return;
                                            const newSched = [...supplierSchedules];
                                            const paramAmount = Number(raw);
                                            newSched[idx].amount = paramAmount;
                                            const totalRef = getSupplierTotal(pay.description);
                                            if (totalRef && totalRef > 0) {
                                                const newPerc = (paramAmount / totalRef) * 100;
                                                newSched[idx].percentage = Number(newPerc.toFixed(2));
                                            }
                                            setSupplierSchedules(newSched);
                                        }}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-md px-2 py-1.5 text-[11px] font-black text-right outline-none focus:ring-1 focus:ring-rose-500 transition-all text-rose-500"
                                    />
                                    <button onClick={() => setSupplierSchedules(supplierSchedules.filter(p => p.id !== pay.id))} className="text-rose-400 hover:text-rose-600 transition-colors flex-shrink-0 ml-1">
                                        <X size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Contract Notes */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                <div className="flex items-center gap-2 mb-3">
                    <StickyNote size={16} className="text-amber-500" />
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Ghi chú hợp đồng</p>
                </div>
                <textarea
                    value={notes || ''}
                    onChange={(e) => setNotes?.(e.target.value)}
                    placeholder="VD: Điều khoản thanh toán theo đợt, giao hàng theo lô, điều kiện nghiệm thu đặc biệt..."
                    rows={4}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 dark:focus:border-amber-500 transition-all resize-y"
                />
            </div>
        </section>
    );
};

export default React.memo(ContractFormStep3);
