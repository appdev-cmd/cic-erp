// ============================================================
// CoreHR Tabs — Sub-tabs inside PersonnelDetail
// Renders: HĐ Lao động, Lịch sử lương, Tài sản
// ============================================================

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
    FileText, DollarSign, Package, Plus, Pencil, Trash2, X,
    Calendar, Building, TrendingUp, CheckCircle, AlertCircle,
    Laptop, Phone, Car, Key, CreditCard, Monitor, Cpu, MoreHorizontal,
    ArrowUpRight, ArrowDownRight, Clock,
} from 'lucide-react';
import { CoreHrService } from '../../services/coreHrService';
import { formatDate } from '../../utils/formatters';
import DateInput from '../ui/DateInput';
import type {
    EmployeeContract, CreateContractInput, ContractType, ContractStatus,
    SalaryHistory, CreateSalaryHistoryInput, SalaryChangeType,
    EmployeeAsset, CreateAssetInput, AssetType, AssetCondition,
} from '../../types/coreHrTypes';

// ── Constants ──

const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
    indefinite: 'Không xác định thời hạn',
    definite: 'Xác định thời hạn',
    seasonal: 'Thời vụ',
    probation: 'Thử việc',
    appendix: 'Phụ lục hợp đồng',
};

const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    expired: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    terminated: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    renewed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
    active: 'Hiệu lực', expired: 'Hết hạn', terminated: 'Đã chấm dứt', renewed: 'Đã gia hạn',
};

const CHANGE_TYPE_LABELS: Record<SalaryChangeType, { label: string; icon: any; color: string }> = {
    initial: { label: 'Lương ban đầu', icon: CheckCircle, color: 'text-blue-600 dark:text-blue-400' },
    promotion: { label: 'Thăng chức', icon: ArrowUpRight, color: 'text-emerald-600 dark:text-emerald-400' },
    adjust: { label: 'Điều chỉnh', icon: TrendingUp, color: 'text-amber-600 dark:text-amber-400' },
    demotion: { label: 'Giảm chức', icon: ArrowDownRight, color: 'text-rose-600 dark:text-rose-400' },
    review: { label: 'Đánh giá định kỳ', icon: Clock, color: 'text-indigo-600 dark:text-indigo-400' },
};

const ASSET_TYPE_ICONS: Record<AssetType, { icon: any; color: string; bg: string }> = {
    laptop: { icon: Laptop, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    phone: { icon: Phone, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    monitor: { icon: Monitor, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/30' },
    vehicle: { icon: Car, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    key: { icon: Key, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    card: { icon: CreditCard, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30' },
    software: { icon: Cpu, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
    other: { icon: Package, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
};

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
    laptop: 'Laptop', phone: 'Điện thoại', monitor: 'Màn hình', vehicle: 'Xe',
    key: 'Chìa khóa', card: 'Thẻ', software: 'Phần mềm', other: 'Khác',
};

const ASSET_STATUS_COLORS: Record<string, string> = {
    assigned: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    returned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    lost: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    damaged: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    disposed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

const ASSET_STATUS_LABELS: Record<string, string> = {
    assigned: 'Đang sử dụng', returned: 'Đã trả', lost: 'Mất', damaged: 'Hỏng', disposed: 'Thanh lý',
};

const inputCls = "w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none";
const formatCurrency = (val: number) => (val || 0).toLocaleString('vi-VN') + ' ₫';

// ══════════════════════════════════════════
// Tab: Hợp đồng Lao động
// ══════════════════════════════════════════

export const ContractsHRTab: React.FC<{ employeeId: string }> = ({ employeeId }) => {
    const [items, setItems] = useState<EmployeeContract[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<EmployeeContract | null>(null);
    const [form, setForm] = useState<Partial<CreateContractInput>>({
        contract_type: 'definite', basic_salary: 0, insurance_salary: 0, allowances: {},
    });

    const fetchData = async () => {
        try {
            const data = await CoreHrService.getContractsByEmployee(employeeId);
            setItems(data);
        } catch { toast.error('Lỗi tải dữ liệu hợp đồng'); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchData(); }, [employeeId]);

    const resetForm = () => {
        setForm({ contract_type: 'definite', basic_salary: 0, insurance_salary: 0, allowances: {} });
        setEditing(null); setShowForm(false);
    };

    const handleSubmit = async () => {
        if (!form.start_date) { toast.error('Vui lòng nhập ngày bắt đầu'); return; }
        try {
            if (editing) {
                await CoreHrService.updateContract(editing.id, form);
                toast.success('Cập nhật hợp đồng thành công');
            } else {
                await CoreHrService.createContract({ ...form, employee_id: employeeId } as CreateContractInput);
                toast.success('Thêm hợp đồng thành công');
            }
            resetForm(); fetchData();
        } catch { toast.error('Có lỗi xảy ra'); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa hợp đồng này?')) return;
        try { await CoreHrService.deleteContract(id); fetchData(); toast.success('Đã xóa'); }
        catch { toast.error('Lỗi xóa'); }
    };

    const startEdit = (item: EmployeeContract) => {
        setEditing(item);
        setForm({
            contract_number: item.contract_number || '',
            contract_type: item.contract_type,
            start_date: item.start_date, end_date: item.end_date || '',
            basic_salary: item.basic_salary, insurance_salary: item.insurance_salary,
            allowances: item.allowances || {},
            signed_date: item.signed_date || '', notes: item.notes || '',
        });
        setShowForm(true);
    };

    if (loading) return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" /></div>;

    return (
        <div className="space-y-4">
            {/* Form */}
            {showForm && (
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{editing ? 'Sửa hợp đồng' : 'Thêm hợp đồng mới'}</h3>
                        <button onClick={resetForm} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Số hợp đồng</label>
                                <input className={inputCls} value={form.contract_number || ''} onChange={e => setForm(p => ({ ...p, contract_number: e.target.value }))} placeholder="VD: HDLD-2026-001" /></div>
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Loại hợp đồng</label>
                                <select className={inputCls} value={form.contract_type || 'definite'} onChange={e => setForm(p => ({ ...p, contract_type: e.target.value as ContractType }))}>
                                    {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Ngày ký</label>
                                <DateInput value={form.signed_date || ''} onChange={(v: string) => setForm(p => ({ ...p, signed_date: v }))} className={inputCls} /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Ngày bắt đầu <span className="text-red-500">*</span></label>
                                <DateInput value={form.start_date || ''} onChange={(v: string) => setForm(p => ({ ...p, start_date: v }))} className={inputCls} /></div>
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Ngày kết thúc</label>
                                <DateInput value={form.end_date || ''} onChange={(v: string) => setForm(p => ({ ...p, end_date: v }))} className={inputCls} /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Lương cơ bản</label>
                                <input type="number" className={inputCls} value={form.basic_salary || ''} onChange={e => setForm(p => ({ ...p, basic_salary: Number(e.target.value) }))} placeholder="VD: 15000000" /></div>
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Lương đóng BHXH</label>
                                <input type="number" className={inputCls} value={form.insurance_salary || ''} onChange={e => setForm(p => ({ ...p, insurance_salary: Number(e.target.value) }))} placeholder="VD: 10000000" /></div>
                        </div>
                        <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Ghi chú</label>
                            <input className={inputCls} value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={resetForm} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Hủy</button>
                            <button onClick={handleSubmit} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">{editing ? 'Cập nhật' : 'Thêm'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2"><FileText size={18} className="text-indigo-500" /> Hợp đồng Lao động</h3>
                    <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"><Plus size={14} /> Thêm HĐ</button>
                </div>
                {items.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {items.map(item => (
                            <div key={item.id} className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg shrink-0">
                                            <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.contract_number || 'Chưa có số'}</h4>
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${CONTRACT_STATUS_COLORS[item.status]}`}>
                                                    {CONTRACT_STATUS_LABELS[item.status]}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{CONTRACT_TYPE_LABELS[item.contract_type]}</p>
                                            <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-slate-400">
                                                <span className="flex items-center gap-1"><Calendar size={12} /> {formatDate(item.start_date)} → {item.end_date ? formatDate(item.end_date) : 'Vô thời hạn'}</span>
                                                {item.basic_salary > 0 && <span className="flex items-center gap-1"><DollarSign size={12} /> {formatCurrency(item.basic_salary)}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button onClick={() => startEdit(item)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"><Pencil size={14} /></button>
                                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"><FileText size={28} className="text-slate-400" /></div>
                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Chưa có hợp đồng lao động</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Thêm hợp đồng thử việc, chính thức, phụ lục...</p>
                        <button onClick={() => { resetForm(); setShowForm(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"><Plus size={14} /> Thêm hợp đồng</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ══════════════════════════════════════════
// Tab: Lịch sử Lương
// ══════════════════════════════════════════

export const SalaryHistoryTab: React.FC<{ employeeId: string }> = ({ employeeId }) => {
    const [items, setItems] = useState<SalaryHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<SalaryHistory | null>(null);
    const [form, setForm] = useState<Partial<CreateSalaryHistoryInput>>({
        change_type: 'adjust', basic_salary: 0,
    });

    const fetchData = async () => {
        try { setItems(await CoreHrService.getSalaryHistory(employeeId)); }
        catch { toast.error('Lỗi tải lịch sử lương'); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchData(); }, [employeeId]);

    const resetForm = () => { setForm({ change_type: 'adjust', basic_salary: 0 }); setEditing(null); setShowForm(false); };

    const handleSubmit = async () => {
        if (!form.effective_date || !form.basic_salary) { toast.error('Vui lòng nhập ngày hiệu lực và mức lương'); return; }
        try {
            if (editing) {
                await CoreHrService.updateSalaryRecord(editing.id, form);
                toast.success('Cập nhật thành công');
            } else {
                await CoreHrService.createSalaryRecord({ ...form, employee_id: employeeId } as CreateSalaryHistoryInput);
                toast.success('Thêm lịch sử lương thành công');
            }
            resetForm(); fetchData();
        } catch { toast.error('Có lỗi xảy ra'); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa bản ghi lương này?')) return;
        try { await CoreHrService.deleteSalaryRecord(id); fetchData(); toast.success('Đã xóa'); }
        catch { toast.error('Lỗi xóa'); }
    };

    if (loading) return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" /></div>;

    const latestSalary = items[0];

    return (
        <div className="space-y-4">
            {/* Current Salary Card */}
            {latestSalary && (
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-5 text-white">
                    <p className="text-xs font-medium text-emerald-100 uppercase tracking-wider">Lương hiện tại</p>
                    <p className="text-3xl font-black mt-1">{formatCurrency(latestSalary.basic_salary)}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-emerald-100">
                        <span>Từ ngày: {formatDate(latestSalary.effective_date)}</span>
                        {latestSalary.insurance_salary > 0 && <span>BHXH: {formatCurrency(latestSalary.insurance_salary)}</span>}
                    </div>
                </div>
            )}

            {/* Form */}
            {showForm && (
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{editing ? 'Sửa bản ghi' : 'Thêm thay đổi lương'}</h3>
                        <button onClick={resetForm} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Ngày hiệu lực <span className="text-red-500">*</span></label>
                                <DateInput value={form.effective_date || ''} onChange={(v: string) => setForm(p => ({ ...p, effective_date: v }))} className={inputCls} /></div>
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Lương cơ bản <span className="text-red-500">*</span></label>
                                <input type="number" className={inputCls} value={form.basic_salary || ''} onChange={e => setForm(p => ({ ...p, basic_salary: Number(e.target.value) }))} /></div>
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Loại thay đổi</label>
                                <select className={inputCls} value={form.change_type || 'adjust'} onChange={e => setForm(p => ({ ...p, change_type: e.target.value as SalaryChangeType }))}>
                                    {Object.entries(CHANGE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Lương đóng BHXH</label>
                                <input type="number" className={inputCls} value={form.insurance_salary || ''} onChange={e => setForm(p => ({ ...p, insurance_salary: Number(e.target.value) }))} /></div>
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Lý do thay đổi</label>
                                <input className={inputCls} value={form.change_reason || ''} onChange={e => setForm(p => ({ ...p, change_reason: e.target.value }))} /></div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={resetForm} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Hủy</button>
                            <button onClick={handleSubmit} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">{editing ? 'Cập nhật' : 'Thêm'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2"><DollarSign size={18} className="text-emerald-500" /> Lịch sử Lương</h3>
                    <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"><Plus size={14} /> Thêm</button>
                </div>
                {items.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {items.map((item, idx) => {
                            const changeInfo = CHANGE_TYPE_LABELS[item.change_type] || CHANGE_TYPE_LABELS.adjust;
                            const ChangeIcon = changeInfo.icon;
                            const prevSalary = idx < items.length - 1 ? items[idx + 1].basic_salary : 0;
                            const diff = item.basic_salary - prevSalary;
                            return (
                                <div key={item.id} className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className="flex flex-col items-center">
                                                <div className={`p-2 rounded-lg ${changeInfo.color.includes('emerald') ? 'bg-emerald-100 dark:bg-emerald-900/30' : changeInfo.color.includes('rose') ? 'bg-rose-100 dark:bg-rose-900/30' : changeInfo.color.includes('amber') ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                                                    <ChangeIcon size={18} className={changeInfo.color} />
                                                </div>
                                                {idx < items.length - 1 && <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-700 mt-2" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrency(item.basic_salary)}</h4>
                                                    {diff !== 0 && prevSalary > 0 && (
                                                        <span className={`text-xs font-bold ${diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                            {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`text-xs font-medium mt-0.5 ${changeInfo.color}`}>{changeInfo.label}</p>
                                                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                                                    <span>{formatDate(item.effective_date)}</span>
                                                    {item.change_reason && <span>• {item.change_reason}</span>}
                                                    {item.approver_name && <span>• Duyệt: {item.approver_name}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <button onClick={() => { setEditing(item); setForm({ effective_date: item.effective_date, basic_salary: item.basic_salary, insurance_salary: item.insurance_salary, change_type: item.change_type, change_reason: item.change_reason || '' }); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"><Pencil size={14} /></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"><DollarSign size={28} className="text-slate-400" /></div>
                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Chưa có lịch sử lương</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Thêm mức lương ban đầu và các lần điều chỉnh</p>
                        <button onClick={() => { resetForm(); setShowForm(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"><Plus size={14} /> Thêm mức lương</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ══════════════════════════════════════════
// Tab: Tài sản bàn giao
// ══════════════════════════════════════════

export const AssetsTab: React.FC<{ employeeId: string }> = ({ employeeId }) => {
    const [items, setItems] = useState<EmployeeAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<EmployeeAsset | null>(null);
    const [form, setForm] = useState<Partial<CreateAssetInput>>({ asset_type: 'laptop', condition: 'good' });

    const fetchData = async () => {
        try { setItems(await CoreHrService.getAssetsByEmployee(employeeId)); }
        catch { toast.error('Lỗi tải tài sản'); }
        finally { setLoading(false); }
    };
    useEffect(() => { fetchData(); }, [employeeId]);

    const resetForm = () => { setForm({ asset_type: 'laptop', condition: 'good' }); setEditing(null); setShowForm(false); };

    const handleSubmit = async () => {
        if (!form.asset_name) { toast.error('Vui lòng nhập tên tài sản'); return; }
        try {
            if (editing) {
                await CoreHrService.updateAsset(editing.id, form);
                toast.success('Cập nhật tài sản thành công');
            } else {
                await CoreHrService.createAsset({ ...form, employee_id: employeeId } as CreateAssetInput);
                toast.success('Thêm tài sản thành công');
            }
            resetForm(); fetchData();
        } catch { toast.error('Có lỗi xảy ra'); }
    };

    const handleReturn = async (id: string) => {
        if (!confirm('Xác nhận nhân viên đã trả tài sản này?')) return;
        try { await CoreHrService.returnAsset(id); fetchData(); toast.success('Đã ghi nhận trả tài sản'); }
        catch { toast.error('Lỗi'); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa tài sản này?')) return;
        try { await CoreHrService.deleteAsset(id); fetchData(); toast.success('Đã xóa'); }
        catch { toast.error('Lỗi xóa'); }
    };

    if (loading) return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" /></div>;

    const assignedCount = items.filter(i => i.status === 'assigned').length;

    return (
        <div className="space-y-4">
            {/* Stats */}
            {items.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{items.length}</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Tổng tài sản</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{assignedCount}</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Đang sử dụng</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{items.filter(i => i.status === 'returned').length}</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Đã trả</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{formatCurrency(items.reduce((s, i) => s + (i.purchase_value || 0), 0))}</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">Tổng giá trị</p>
                    </div>
                </div>
            )}

            {/* Form */}
            {showForm && (
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{editing ? 'Sửa tài sản' : 'Bàn giao tài sản mới'}</h3>
                        <button onClick={resetForm} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Tên tài sản <span className="text-red-500">*</span></label>
                                <input className={inputCls} value={form.asset_name || ''} onChange={e => setForm(p => ({ ...p, asset_name: e.target.value }))} placeholder="VD: MacBook Pro 14 inch" /></div>
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Loại</label>
                                <select className={inputCls} value={form.asset_type || 'laptop'} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value as AssetType }))}>
                                    {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Mã tài sản</label>
                                <input className={inputCls} value={form.asset_code || ''} onChange={e => setForm(p => ({ ...p, asset_code: e.target.value }))} placeholder="VD: TS-001" /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Serial Number</label>
                                <input className={inputCls} value={form.serial_number || ''} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} /></div>
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Hãng / Model</label>
                                <input className={inputCls} value={form.brand || ''} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} placeholder="VD: Apple" /></div>
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Giá trị (VNĐ)</label>
                                <input type="number" className={inputCls} value={form.purchase_value || ''} onChange={e => setForm(p => ({ ...p, purchase_value: Number(e.target.value) }))} /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Ngày bàn giao</label>
                                <DateInput value={form.handover_date || ''} onChange={(v: string) => setForm(p => ({ ...p, handover_date: v }))} className={inputCls} /></div>
                            <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Tình trạng</label>
                                <select className={inputCls} value={form.condition || 'good'} onChange={e => setForm(p => ({ ...p, condition: e.target.value as AssetCondition }))}>
                                    <option value="new">Mới</option><option value="good">Tốt</option>
                                    <option value="fair">Trung bình</option><option value="poor">Kém</option>
                                </select></div>
                        </div>
                        <div><label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Ghi chú</label>
                            <input className={inputCls} value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={resetForm} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Hủy</button>
                            <button onClick={handleSubmit} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">{editing ? 'Cập nhật' : 'Bàn giao'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2"><Package size={18} className="text-amber-500" /> Tài sản bàn giao</h3>
                    <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"><Plus size={14} /> Bàn giao</button>
                </div>
                {items.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {items.map(item => {
                            const typeInfo = ASSET_TYPE_ICONS[item.asset_type] || ASSET_TYPE_ICONS.other;
                            const TypeIcon = typeInfo.icon;
                            return (
                                <div key={item.id} className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2.5 rounded-lg shrink-0 ${typeInfo.bg}`}>
                                                <TypeIcon size={20} className={typeInfo.color} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.asset_name}</h4>
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${ASSET_STATUS_COLORS[item.status] || ''}`}>
                                                        {ASSET_STATUS_LABELS[item.status] || item.status}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                                                    {item.asset_code && <span>Mã: {item.asset_code}</span>}
                                                    {item.serial_number && <span>SN: {item.serial_number}</span>}
                                                    {item.brand && <span>{item.brand} {item.model || ''}</span>}
                                                    <span>Bàn giao: {formatDate(item.handover_date)}</span>
                                                    {item.purchase_value && item.purchase_value > 0 && <span>{formatCurrency(item.purchase_value)}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            {item.status === 'assigned' && (
                                                <button onClick={() => handleReturn(item.id)} className="px-2.5 py-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">Thu hồi</button>
                                            )}
                                            <button onClick={() => { setEditing(item); setForm({ asset_name: item.asset_name, asset_type: item.asset_type, asset_code: item.asset_code || '', serial_number: item.serial_number || '', brand: item.brand || '', purchase_value: item.purchase_value || 0, handover_date: item.handover_date, condition: item.condition, notes: item.notes || '' }); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"><Pencil size={14} /></button>
                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4"><Package size={28} className="text-slate-400" /></div>
                        <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Chưa có tài sản</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Bàn giao laptop, điện thoại, xe, thẻ cho nhân viên</p>
                        <button onClick={() => { resetForm(); setShowForm(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"><Plus size={14} /> Bàn giao tài sản</button>
                    </div>
                )}
            </div>
        </div>
    );
};
