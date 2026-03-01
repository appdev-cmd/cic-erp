// BusinessPlanCashflow: Dòng tiền dự kiến (Revenue + Supplier schedules)
import React from 'react';
import { X, Plus, Wallet, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { PaymentSchedule } from '../../types';

interface BusinessPlanCashflowProps {
    isEditing: boolean;
    paymentSchedules: PaymentSchedule[];
    setPaymentSchedules: (v: PaymentSchedule[]) => void;
    supplierSchedules: PaymentSchedule[];
    setSupplierSchedules: (v: PaymentSchedule[]) => void;
    formatVND: (v: number) => string;
}

const BusinessPlanCashflow: React.FC<BusinessPlanCashflowProps> = ({
    isEditing,
    paymentSchedules, setPaymentSchedules,
    supplierSchedules, setSupplierSchedules,
    formatVND,
}) => {
    const updateSchedule = (
        schedules: PaymentSchedule[],
        setter: (v: PaymentSchedule[]) => void,
        idx: number,
        field: 'date' | 'description' | 'amount',
        value: any
    ) => {
        const newSched = [...schedules];
        (newSched[idx] as any)[field] = value;
        setter(newSched);
    };

    const removeSchedule = (
        schedules: PaymentSchedule[],
        setter: (v: PaymentSchedule[]) => void,
        id: string
    ) => {
        setter(schedules.filter(p => p.id !== id));
    };

    const renderScheduleRow = (
        pay: PaymentSchedule,
        idx: number,
        schedules: PaymentSchedule[],
        setter: (v: PaymentSchedule[]) => void,
        colorClass: { bg: string; border: string; label: string; text: string; delete: string }
    ) => (
        <div key={pay.id} className={`grid grid-cols-12 gap-2 ${colorClass.bg} p-3 rounded-lg border ${colorClass.border}`}>
            <div className="col-span-4 space-y-1">
                <label className={`text-[9px] ${colorClass.label} font-bold uppercase`}>
                    {schedules === paymentSchedules ? 'Ngày thanh toán' : 'Hạn thanh toán'}
                </label>
                {isEditing ? (
                    <input
                        type="date"
                        value={pay.date}
                        onChange={(e) => updateSchedule(schedules, setter, idx, 'date', e.target.value)}
                        className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-white"
                    />
                ) : (
                    <p className="text-[11px] font-bold text-slate-800 dark:text-white">{pay.date || '-'}</p>
                )}
            </div>
            <div className="col-span-4 space-y-1">
                <label className={`text-[9px] ${colorClass.label} font-bold uppercase`}>Nội dung</label>
                {isEditing ? (
                    <input
                        placeholder={schedules === paymentSchedules ? 'Tạm ứng, Đợt 1...' : 'Thanh toán NCC...'}
                        value={pay.description}
                        onChange={(e) => updateSchedule(schedules, setter, idx, 'description', e.target.value)}
                        className="w-full bg-transparent text-[11px] font-bold outline-none text-slate-800 dark:text-white"
                    />
                ) : (
                    <p className="text-[11px] font-bold text-slate-800 dark:text-white">{pay.description || '-'}</p>
                )}
            </div>
            <div className="col-span-4 space-y-1 text-right">
                <label className={`text-[9px] ${colorClass.label} font-bold uppercase`}>Số tiền</label>
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
                                    updateSchedule(schedules, setter, idx, 'amount', Number(raw));
                                }}
                                className={`w-full bg-transparent text-[11px] font-bold text-right outline-none ${colorClass.text}`}
                            />
                            {schedules.length > 1 && (
                                <button onClick={() => removeSchedule(schedules, setter, pay.id)} className={colorClass.delete}>
                                    <X size={12} />
                                </button>
                            )}
                        </>
                    ) : (
                        <span className={`text-[11px] font-bold ${colorClass.text}`}>{formatVND(pay.amount)}</span>
                    )}
                </div>
            </div>
        </div>
    );

    const revenueColors = {
        bg: 'bg-emerald-50 dark:bg-emerald-950/60',
        border: 'border-emerald-200 dark:border-emerald-800',
        label: 'text-slate-600 dark:text-emerald-300',
        text: 'text-emerald-600 dark:text-emerald-400',
        delete: 'text-emerald-400 hover:text-emerald-600',
    };

    const expenseColors = {
        bg: 'bg-rose-50 dark:bg-rose-950/60',
        border: 'border-rose-200 dark:border-rose-800',
        label: 'text-slate-600 dark:text-rose-300',
        text: 'text-rose-500 dark:text-rose-400',
        delete: 'text-rose-400 hover:text-rose-600',
    };

    return (
        <div className="bg-gradient-to-br from-slate-50 to-orange-50/30 dark:from-slate-800 dark:to-slate-800 p-6 rounded-lg border border-slate-100 dark:border-slate-800 space-y-6 mb-8">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                <Wallet size={14} /> Dòng tiền dự kiến
            </h4>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue */}
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
                        {paymentSchedules.map((pay, idx) => renderScheduleRow(pay, idx, paymentSchedules, setPaymentSchedules, revenueColors))}
                        <div className="flex justify-end pt-2">
                            <div className="text-right">
                                <p className="text-[9px] text-slate-600 dark:text-emerald-300 uppercase font-bold">Tổng tiền về</p>
                                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatVND(paymentSchedules.reduce((acc, p) => acc + p.amount, 0))}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expenses */}
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
                        {supplierSchedules.map((pay, idx) => renderScheduleRow(pay, idx, supplierSchedules, setSupplierSchedules, expenseColors))}
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
    );
};

export default React.memo(BusinessPlanCashflow);
