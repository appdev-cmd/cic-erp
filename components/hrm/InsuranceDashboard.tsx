// ============================================================
// Insurance Dashboard — CIC ERP
// Bảng tổng hợp Bảo hiểm (BHXH, BHYT, BHTN)
// ============================================================

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Download, Search, Loader2 } from 'lucide-react';
import { dataClient as supabase } from '../../lib/dataClient';
import { formatCurrency } from '../../utils/formatters';
import type { InsuranceRecord } from '../../types/payrollTypes';

export const InsuranceDashboard: React.FC = () => {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);

    useEffect(() => {
        const fetchRecords = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('insurance_records')
                    .select(`
                        *,
                        employee:employees!employee_id(name, employee_code, departments!department_id(name))
                    `)
                    .eq('year', year)
                    .eq('month', month)
                    .order('employee_id');

                if (error) throw error;
                setRecords(data || []);
            } catch (e) {
                console.error("Failed to load insurance:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchRecords();
    }, [year, month]);

    const totalBhxhEmp = records.reduce((sum, r) => sum + r.bhxh_employee, 0);
    const totalBhytEmp = records.reduce((sum, r) => sum + r.bhyt_employee, 0);
    const totalBhtnEmp = records.reduce((sum, r) => sum + r.bhtn_employee, 0);

    const totalBhxhComp = records.reduce((sum, r) => sum + r.bhxh_employer, 0);
    const totalBhytComp = records.reduce((sum, r) => sum + r.bhyt_employer, 0);
    const totalBhtnComp = records.reduce((sum, r) => sum + r.bhtn_employer, 0);

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <ShieldAlert className="text-blue-600 dark:text-blue-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Báo cáo Bảo hiểm</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">BHXH, BHYT, BHTN tháng {month}/{year}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <input type="number" min="1" max="12" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-16 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100" />
                    <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100">
                        <option value={2026}>2026</option>
                        <option value={2025}>2025</option>
                    </select>
                    <button className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition">
                        <Download size={16} /> Xuất Excel
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">Trích từ Lương Nhân viên (10.5%)</p>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">BHXH (8%)</span><span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalBhxhEmp)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">BHYT (1.5%)</span><span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalBhytEmp)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">BHTN (1%)</span><span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalBhtnEmp)}</span></div>
                        <div className="flex justify-between text-base font-black pt-2 border-t border-slate-100 dark:border-slate-800 text-indigo-600 dark:text-indigo-400">
                            <span>Tổng cộng</span><span>{formatCurrency(totalBhxhEmp + totalBhytEmp + totalBhtnEmp)}</span>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">Công ty đóng thêm (21.5%)</p>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">BHXH (17.5%)</span><span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalBhxhComp)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">BHYT (3%)</span><span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalBhytComp)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">BHTN (1%)</span><span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalBhtnComp)}</span></div>
                        <div className="flex justify-between text-base font-black pt-2 border-t border-slate-100 dark:border-slate-800 text-rose-600 dark:text-rose-400">
                            <span>Tổng cộng</span><span>{formatCurrency(totalBhxhComp + totalBhytComp + totalBhtnComp)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detail Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
                            <th className="p-3 pl-4">Nhân viên</th>
                            <th className="p-3 text-right">Mức lương đóng BH</th>
                            <th className="p-3 text-right">Trừ Cấp NV</th>
                            <th className="p-3 text-right">Cty Đóng</th>
                            <th className="p-3 pr-4 text-right bg-slate-100 dark:bg-slate-800/80">Tổng Nộp</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin text-indigo-500 inline" size={24} /></td></tr>
                        ) : records.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">Chưa có dữ liệu bảo hiểm tháng này. Vui lòng chạy tính lương.</td></tr>
                        ) : records.map(r => {
                            const empTotal = r.bhxh_employee + r.bhyt_employee + r.bhtn_employee;
                            const compTotal = r.bhxh_employer + r.bhyt_employer + r.bhtn_employer;
                            return (
                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                    <td className="p-3 pl-4">
                                        <p className="font-bold text-slate-900 dark:text-slate-100">{r.employee?.name}</p>
                                        <p className="text-[10px] text-slate-500 font-normal">{r.employee?.employee_code} • {r.employee?.departments?.name}</p>
                                    </td>
                                    <td className="p-3 text-right">{formatCurrency(r.bhxh_base)}</td>
                                    <td className="p-3 text-right text-indigo-600 dark:text-indigo-400">{formatCurrency(empTotal)}</td>
                                    <td className="p-3 text-right text-rose-600 dark:text-rose-400">{formatCurrency(compTotal)}</td>
                                    <td className="p-3 pr-4 text-right bg-slate-50/50 dark:bg-slate-800/20 font-black">{formatCurrency(empTotal + compTotal)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
