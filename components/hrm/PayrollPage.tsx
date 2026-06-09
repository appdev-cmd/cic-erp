// ============================================================
// Payroll Page — CIC ERP
// Quản lý các kỳ tính lương (Payroll Runs)
// ============================================================

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Calculator, Plus, CheckCircle, Search, Filter, Loader2, PlayCircle,
    FileText, User, Users, ChevronRight, Download
} from 'lucide-react';
import { PayrollService } from '../../services/payrollService';
import type { PayrollRun, Payslip } from '../../types/payrollTypes';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import { PayslipViewer } from './PayslipViewer';

export const PayrollPage: React.FC = () => {
    const { openPanel, closePanel } = useSlidePanel();
    const [runs, setRuns] = useState<PayrollRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear());

    // Create new run states
    const [showCreate, setShowCreate] = useState(false);
    const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
    const [newYear, setNewYear] = useState(new Date().getFullYear());
    const [creating, setCreating] = useState(false);

    const fetchRuns = async () => {
        setLoading(true);
        try {
            const data = await PayrollService.getPayrollRuns(yearFilter);
            setRuns(data);
        } catch {
            toast.error('Lỗi tải danh sách kỳ lương');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRuns(); }, [yearFilter]);

    const handleCreateRun = async () => {
        setCreating(true);
        try {
            await PayrollService.createPayrollRun(newMonth, newYear, null);
            toast.success('Đã tạo phiếu lương mới');
            setShowCreate(false);
            fetchRuns();
        } catch (err: any) {
            toast.error('Lỗi tạo kỳ lương: ' + (err.message || 'Phiếu này có thể đã tồn tại'));
        } finally {
            setCreating(false);
        }
    };

    const handleCalculate = async (runId: string, month: number, year: number) => {
        try {
            toast.loading('Đang tính toán lương...', { id: 'calc_payroll' });
            await PayrollService.calculatePayroll(runId, month, year, null);
            toast.success('Đã tính lương thành công', { id: 'calc_payroll' });
            fetchRuns();
        } catch (e: any) {
            toast.error('Lỗi tính toán: ' + e.message, { id: 'calc_payroll' });
        }
    };

    const handleApprove = async (runId: string) => {
        // Mock approver as 1
        if (!confirm('Duyệt kỳ lương này? Sau khi duyệt sẽ không thể tính lại.')) return;
        try {
            await PayrollService.approvePayroll(runId, 'APPROVER_ID_MOCK', false);
            toast.success('Đã duyệt phiếu lương');
            fetchRuns();
        } catch {
            toast.error('Không thể duyệt phiếu');
        }
    };

    const openPayslipDetail = (runId: string, title: string) => {
        openPanel({
            title: `Chi tiết: ${title}`,
            url: `/hrm/payroll/${runId}`,
            component: <PayrollRunDetail runId={runId} onBack={() => closePanel()} />
        });
    };

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'draft': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
            case 'calculating': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'review': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'approved': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'paid': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        }
    };

    const getStatusLabel = (s: string) => {
        switch (s) {
            case 'draft': return 'Nháp';
            case 'calculating': return 'Đang tính...';
            case 'review': return 'Chờ duyệt';
            case 'approved': return 'Đã duyệt';
            case 'paid': return 'Đã chi trả';
            default: return s;
        }
    };

    const inputCls = "px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none";

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                        <Calculator className="text-emerald-600 dark:text-emerald-400" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Bảng lương (Payroll)</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Quản lý kỳ lương, phiếu lương, thuế và bảo hiểm</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={yearFilter}
                        onChange={e => setYearFilter(Number(e.target.value))}
                        className={inputCls}
                    >
                        <option value={2026}>Năm 2026</option>
                        <option value={2025}>Năm 2025</option>
                    </select>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
                    >
                        {showCreate ? 'Đóng' : <><Plus size={16} /> Tạo kỳ lương</>}
                    </button>
                </div>
            </div>

            {showCreate && (
                <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-end gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Tháng</label>
                        <input type="number" min="1" max="12" value={newMonth} onChange={e => setNewMonth(Number(e.target.value))} className={inputCls} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Năm</label>
                        <input type="number" value={newYear} onChange={e => setNewYear(Number(e.target.value))} className={inputCls} />
                    </div>
                    <button
                        onClick={handleCreateRun}
                        disabled={creating}
                        className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                        {creating ? <Loader2 size={16} className="animate-spin" /> : 'Tạo mới'}
                    </button>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
            ) : runs.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {runs.map(run => (
                        <div key={run.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition relative group">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-3">
                                        Tháng {run.month}/{run.year}
                                        <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${getStatusColor(run.status)}`}>
                                            {getStatusLabel(run.status)}
                                        </span>
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                        Phạm vi: {run.unit_name || 'Toàn công ty'}
                                    </p>
                                </div>
                                <div className="flex gap-4 md:gap-8">
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Tổng lương Gross</p>
                                        <p className="text-lg font-black text-slate-900 dark:text-slate-100">{formatCurrency(run.total_gross)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Tổng thuế & BH</p>
                                        <p className="text-lg font-black text-rose-600 dark:text-rose-400">{formatCurrency(run.total_tax + run.total_insurance)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Thực lĩnh (Net)</p>
                                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(run.total_net)}</p>
                                    </div>
                                </div>
                            </div>

                            <hr className="my-4 border-slate-100 dark:border-slate-800" />

                            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 -mx-5 -mb-5 px-5 py-3 rounded-b-xl border-t border-slate-100 dark:border-slate-800 mt-2">
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {run.status === 'draft' ? 'Sẵn sàng tính toán.' : run.status === 'review' ? `Tính toán bởi: ${run.calculator_name || 'Hệ thống'} lúc ${formatDate(run.updated_at)}` : `Duyệt bởi: ${run.approver_name || '—'} lúc ${run.approved_at ? formatDate(run.approved_at) : '—'}`}
                                </div>
                                <div className="flex items-center gap-2">
                                    {(run.status === 'draft' || run.status === 'review') && (
                                        <button
                                            onClick={() => handleCalculate(run.id, run.month, run.year)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-xs font-bold transition"
                                        >
                                            <PlayCircle size={14} /> Chạy tính lương
                                        </button>
                                    )}
                                    {run.status === 'review' && (
                                        <button
                                            onClick={() => handleApprove(run.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs font-bold transition"
                                        >
                                            <CheckCircle size={14} /> Duyệt phiếu
                                        </button>
                                    )}
                                    <button
                                        onClick={() => openPayslipDetail(run.id, `Kỳ lương T${run.month}/${run.year}`)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition"
                                    >
                                        <Users size={14} /> Danh sách phiếu lương
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <Calculator className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
                    <p className="text-slate-500 font-medium">Chưa có kỳ lương nào trong năm {yearFilter}.</p>
                </div>
            )}
        </div>
    );
};

// ── Chi tiết Phiếu lương Component (Slide Panel Content) ──
const PayrollRunDetail: React.FC<{ runId: string, onBack: () => void }> = ({ runId, onBack }) => {
    const { openPanel } = useSlidePanel();
    const [slips, setSlips] = useState<Payslip[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await PayrollService.getPayslips(runId);
                setSlips(data);
            } catch {
                toast.error('Lỗi tải danh sách phiếu lương chi tiết');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [runId]);

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;

    const exportCsv = () => {
        toast.info('Tính năng Export Excel đang phát triển');
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileText size={18} className="text-indigo-500" />
                    Bảng kê chi tiết
                </h3>
                <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded transition">
                    <Download size={14} /> Export CSV
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
                            <th className="p-3 pl-4">Nhân viên</th>
                            <th className="p-3">Công / OT</th>
                            <th className="p-3 text-right">Lương CB</th>
                            <th className="p-3 text-right text-indigo-600 dark:text-indigo-400">Tổng Gross</th>
                            <th className="p-3 text-right text-rose-500">BHXH (NV)</th>
                            <th className="p-3 text-right text-rose-500">Thuế TNCN</th>
                            <th className="p-3 pr-4 text-right text-emerald-600 dark:text-emerald-400">Thực lĩnh</th>
                            <th className="p-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {slips.length === 0 ? (
                            <tr><td colSpan={8} className="p-6 text-center text-sm text-slate-500">Kỳ lương này chưa được tính toán (Nháp). Vui lòng nhấn "Chạy tính lương".</td></tr>
                        ) : slips.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                                <td className="p-3 pl-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                            <User size={12} />
                                        </div>
                                        <div>
                                            <p className="text-slate-900 dark:text-slate-100">{s.employee_name}</p>
                                            <p className="text-[10px] text-slate-500 font-normal">{s.employee_code} • {s.department_name}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-3">
                                    {s.work_days}d / {s.ot_hours}h
                                </td>
                                <td className="p-3 text-right">{formatCurrency(s.basic_salary)}</td>
                                <td className="p-3 text-right text-indigo-700 dark:text-indigo-400 font-bold">{formatCurrency(s.gross_salary)}</td>
                                <td className="p-3 text-right text-rose-600 dark:text-rose-400">{formatCurrency(s.insurance_employee)}</td>
                                <td className="p-3 text-right text-rose-600 dark:text-rose-400">{formatCurrency(s.tax_amount)}</td>
                                <td className="p-3 pr-4 text-right text-emerald-600 dark:text-emerald-400 font-black">{formatCurrency(s.net_salary)}</td>
                                <td className="p-3">
                                    <button onClick={(e) => {
                                        e.stopPropagation();
                                        openPanel({
                                            title: `Phiếu lương: ${s.employee_name}`,
                                            url: `/hrm/payroll/${runId}/${s.employee_id}`,
                                            component: <PayslipViewer payslip={s} />
                                        });
                                    }} className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition">
                                        <ChevronRight size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
