// ============================================================
// Payslip Viewer UI — CIC ERP
// Chi tiết phiếu lương (Electronic Payslip)
// ============================================================

import React from 'react';
import { Download, Printer, CheckCircle, Clock } from 'lucide-react';
import type { Payslip } from '../../types/payrollTypes';
import { formatCurrency } from '../../utils/formatters';

interface Props {
    payslip: Payslip;
}

export const PayslipViewer: React.FC<Props> = ({ payslip }) => {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 font-serif">PHIẾU LƯƠNG ĐIỆN TỬ</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide text-xs">Mã nhân viên: {payslip.employee_code}</p>
                </div>
                <div className="flex gap-2">
                    <button className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded transition"><Printer size={16} /></button>
                    <button className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded transition"><Download size={16} /></button>
                </div>
            </div>

            <div className="p-6 space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg flex items-center justify-between border border-slate-100 dark:border-slate-800">
                    <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{payslip.employee_name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{payslip.department_name}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Ngày công thực tế: <span className="font-bold text-slate-700 dark:text-slate-300">{payslip.work_days}đ</span></p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Giờ làm thêm: <span className="font-bold text-slate-700 dark:text-slate-300">{payslip.ot_hours}h</span></p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Thu nhập */}
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                            Thu nhập (Earnings)
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">Lương cơ bản</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(payslip.basic_salary)}</span>
                            </div>
                            {payslip.earnings?.map((e, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">{e.name}</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(e.amount)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-800">
                                <span className="font-black text-slate-800 dark:text-slate-200">Tổng Gross</span>
                                <span className="font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(payslip.gross_salary)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Khấu trừ */}
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest mb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                            Khấu trừ (Deductions)
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">Bảo hiểm trích theo lương</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(payslip.insurance_employee)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400 font-medium">Thuế TNCN tạm khấu trừ</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(payslip.tax_amount)}</span>
                            </div>
                            {payslip.deductions?.map((d, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">{d.name}</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(d.amount)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-800">
                                <span className="font-black text-slate-800 dark:text-slate-200">Tổng khấu trừ</span>
                                <span className="font-black text-rose-600 dark:text-rose-400">{formatCurrency(payslip.insurance_employee + payslip.tax_amount + payslip.deductions?.reduce((sum, item) => sum + item.amount, 0))}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-5 flex flex-col md:flex-row justify-between items-center sm:items-start gap-4 border border-emerald-100 dark:border-emerald-800">
                    <div>
                        <p className="text-emerald-800 dark:text-emerald-400 font-bold mb-1">THỰC LĨNH CHUYỂN KHOẢN (NET)</p>
                        <p className="text-xs text-emerald-600/80 dark:text-emerald-500">Đã bao gồm phụ cấp và trừ thuế, bảo hiểm</p>
                    </div>
                    <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(payslip.net_salary)}
                    </div>
                </div>
            </div>
        </div>
    );
};
