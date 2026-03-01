// ContractForm Step 3: Kế hoạch Tài chính (Revenue, Payment, Supplier Schedules)
import React from 'react';
import { DollarSign, Calculator, X, Receipt, CreditCard } from 'lucide-react';
import { PaymentSchedule, RevenueSchedule } from '../../types';

interface ContractFormStep3Props {
    revenueSchedules: RevenueSchedule[];
    setRevenueSchedules: (v: RevenueSchedule[]) => void;
    paymentSchedules: PaymentSchedule[];
    setPaymentSchedules: (v: PaymentSchedule[]) => void;
    supplierSchedules: PaymentSchedule[];
    setSupplierSchedules: (v: PaymentSchedule[]) => void;
    generateSupplierSchedules: () => void;
    formatVND: (val: number) => string;
}

const ContractFormStep3: React.FC<ContractFormStep3Props> = ({
    revenueSchedules, setRevenueSchedules,
    paymentSchedules, setPaymentSchedules,
    supplierSchedules, setSupplierSchedules,
    generateSupplierSchedules,
    formatVND,
}) => {
    return (
        <section className="space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-3 border-l-4 border-emerald-500 pl-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign size={16} /> Kế hoạch Tài chính
                </h3>
            </div>

            <div className="pl-4 border-l border-slate-200 dark:border-slate-800 space-y-8">
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
                                        className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
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
                                    <input
                                        type="date"
                                        value={pay.date}
                                        onChange={(e) => {
                                            const newSched = [...paymentSchedules];
                                            newSched[idx].date = e.target.value;
                                            setPaymentSchedules(newSched);
                                        }}
                                        className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-slate-200"
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
                                        className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
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
                                <input
                                    type="date"
                                    value={pay.date}
                                    onChange={(e) => {
                                        const newSched = [...supplierSchedules];
                                        newSched[idx].date = e.target.value;
                                        setSupplierSchedules(newSched);
                                    }}
                                    className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-slate-200"
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
                                    className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
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
        </section>
    );
};

export default React.memo(ContractFormStep3);
