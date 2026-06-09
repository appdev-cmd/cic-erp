import React, { useState, useEffect } from 'react';
import { ContractExtraction } from '../../services/aiExtractService';
import { Building2, CheckCircle2, User, Save, Edit3, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { UnitService } from '../../services/unitService';
import { EmployeeService } from '../../services/employeeService';

// Extended row type with per-row salespersonId
interface ContractRow extends ContractExtraction {
    salespersonId?: string;
}

export const ContractExtractionTable: React.FC<{
    data: ContractExtraction[];
    onSave: (rows: ContractRow[], unitId: string, salespersonId: string) => void;
    saving: boolean;
}> = ({ data, onSave, saving }) => {
    const [selected, setSelected] = useState<Set<number>>(new Set(data.map((_, i) => i)));
    const [editRows, setEditRows] = useState<ContractRow[]>([...data]);
    const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
    const [unitId, setUnitId] = useState('');
    const [globalSalespersonId, setGlobalSalespersonId] = useState('');
    const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
    const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

    // Load units on mount
    useEffect(() => {
        UnitService.getAll().then(u => {
            const filtered = u.filter(x => x.id !== 'all').map(x => ({ id: x.id, name: x.name }));
            setUnits(filtered);

            // Auto-match unit from first row's unitName
            const firstUnitName = (data[0] as any)?.unitName;
            if (firstUnitName && !unitId) {
                const matched = filtered.find(unit =>
                    unit.name.toLowerCase() === firstUnitName.toLowerCase() ||
                    unit.name.toLowerCase().includes(firstUnitName.toLowerCase()) ||
                    firstUnitName.toLowerCase().includes(unit.name.toLowerCase())
                );
                if (matched) setUnitId(matched.id);
            }
        });
    }, []);

    // Load employees when unit changes, then auto-match salesperson from row data
    useEffect(() => {
        setGlobalSalespersonId('');
        const promise = unitId
            ? EmployeeService.getByUnitId(unitId)
            : EmployeeService.getAll();
        promise.then(e => {
            const empList = e.map(x => ({ id: x.id, name: x.name }));
            setEmployees(empList);

            // Auto-match salesperson from row-level salespersonName
            setEditRows(prev => prev.map(r => {
                if (r.salespersonId) return r; // Already set, skip
                const spName = (r as any).salespersonName;
                if (!spName) return r;
                const matched = empList.find(emp =>
                    emp.name.toLowerCase() === spName.toLowerCase() ||
                    emp.name.toLowerCase().includes(spName.toLowerCase()) ||
                    spName.toLowerCase().includes(emp.name.toLowerCase())
                );
                return matched ? { ...r, salespersonId: matched.id } : r;
            }));
        });
    }, [unitId]);

    // When global salesperson changes, apply to all rows that don't have one set
    const applyGlobalSalesperson = (spId: string) => {
        setGlobalSalespersonId(spId);
        if (spId) {
            setEditRows(prev => prev.map(r => ({ ...r, salespersonId: r.salespersonId || spId })));
        }
    };

    const toggleRow = (idx: number) => {
        setSelected(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
    };
    const toggleAll = () => {
        setSelected(prev => prev.size === editRows.length ? new Set() : new Set(editRows.map((_, i) => i)));
    };

    const updateCell = (idx: number, col: string, value: any) => {
        setEditRows(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [col]: value } as any;
            return next;
        });
    };

    const fmtMoney = (v?: number) => v != null ? v.toLocaleString('vi-VN') : '—';

    const selectedRows = editRows.filter((_, i) => selected.has(i));
    // Check all selected rows have salespersonId OR salespersonName (will be resolved on save)
    const allSelectedHaveSalesperson = selectedRows.every(r => r.salespersonId || (r as any).salespersonName);
    const canSave = selectedRows.length > 0 && (unitId || selectedRows.every(r => (r as any).unitName));

    // Editable cell component
    const EditableText = ({ row, col, value, className }: { row: number; col: string; value: string; className?: string }) => {
        const isEditing = editingCell?.row === row && editingCell?.col === col;
        if (isEditing) {
            return (
                <input
                    autoFocus
                    defaultValue={value}
                    onBlur={e => { updateCell(row, col, e.target.value); setEditingCell(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-full bg-white dark:bg-slate-700 border border-indigo-400 dark:border-indigo-500 rounded px-1.5 py-0.5 text-xs outline-none text-slate-800 dark:text-slate-100"
                />
            );
        }
        return (
            <span
                onClick={() => setEditingCell({ row, col })}
                className={cn("cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded px-1 py-0.5 -mx-1 transition-colors", className)}
                title="Click để sửa"
            >
                {value || '—'}
            </span>
        );
    };

    const EditableNumber = ({ row, col, value, className }: { row: number; col: string; value?: number; className?: string }) => {
        const isEditing = editingCell?.row === row && editingCell?.col === col;
        if (isEditing) {
            return (
                <input
                    autoFocus
                    type="number"
                    defaultValue={value ?? ''}
                    onBlur={e => { updateCell(row, col, e.target.value ? parseFloat(e.target.value) : undefined); setEditingCell(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-full bg-white dark:bg-slate-700 border border-indigo-400 dark:border-indigo-500 rounded px-1.5 py-0.5 text-xs outline-none text-right text-slate-800 dark:text-slate-100"
                />
            );
        }
        return (
            <span
                onClick={() => setEditingCell({ row, col })}
                className={cn("cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded px-1 py-0.5 -mx-1 transition-colors font-mono", className)}
                title="Click để sửa"
            >
                {fmtMoney(value)}
            </span>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                        Trích xuất: {data.length} hợp đồng
                    </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                    Đã chọn: {selected.size}/{editRows.length} • <Edit3 size={10} className="inline" /> Click vào ô để sửa
                </span>
            </div>

            {/* Unit & Global Employee Selectors */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4 bg-slate-50/50 dark:bg-slate-800">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Building2 size={14} className="text-indigo-500 shrink-0" />
                    <select
                        value={unitId}
                        onChange={e => setUnitId(e.target.value)}
                        className={cn(
                            "flex-1 text-xs rounded-lg px-3 py-2 border bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer",
                            unitId ? "border-indigo-300 dark:border-indigo-600" : "border-rose-300 dark:border-rose-600"
                        )}
                    >
                        <option value="">— Chọn đơn vị (*) —</option>
                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <User size={14} className="text-violet-500 shrink-0" />
                    <select
                        value={globalSalespersonId}
                        onChange={e => applyGlobalSalesperson(e.target.value)}
                        className={cn(
                            "flex-1 text-xs rounded-lg px-3 py-2 border bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer",
                            "border-violet-300 dark:border-violet-600"
                        )}
                    >
                        <option value="">— Áp dụng cho tất cả —</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">Gán tất cả</span>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                            <th className="px-3 py-2 text-left">
                                <input type="checkbox" checked={selected.size === editRows.length} onChange={toggleAll} className="rounded cursor-pointer" />
                            </th>
                            <th className="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-300">Số HĐ</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-300">Khách hàng</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-300">MST</th>
                            <th className="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-300">Nội dung</th>
                            <th className="px-3 py-2 text-right font-bold text-slate-600 dark:text-slate-300">Giá trị ký</th>
                            <th className="px-3 py-2 text-center font-bold text-slate-600 dark:text-slate-300">Ngày ký</th>
                            <th className="px-3 py-2 text-right font-bold text-blue-600 dark:text-blue-400">Nghiệm thu</th>
                            <th className="px-3 py-2 text-left font-bold text-violet-600 dark:text-violet-400">
                                <div className="flex items-center gap-1">
                                    <User size={12} />
                                    Người thực hiện
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {editRows.map((row, idx) => (
                            <tr
                                key={idx}
                                className={cn(
                                    "border-b border-slate-100 dark:border-slate-700/50 transition-colors",
                                    selected.has(idx) ? "bg-emerald-50/50 dark:bg-emerald-900/10" : "opacity-40"
                                )}
                            >
                                <td className="px-3 py-2">
                                    <input type="checkbox" checked={selected.has(idx)} onChange={() => toggleRow(idx)} className="rounded cursor-pointer" />
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <EditableText row={idx} col="contractCode" value={row.contractCode} className="font-bold text-slate-800 dark:text-slate-200" />
                                </td>
                                <td className="px-3 py-2 max-w-[200px]">
                                    <EditableText row={idx} col="customerName" value={row.customerName} className="text-slate-700 dark:text-slate-300" />
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <EditableText row={idx} col="customerTaxCode" value={(row as any).customerTaxCode || ''} className="text-slate-500 dark:text-slate-400 font-mono text-[10px]" />
                                </td>
                                <td className="px-3 py-2">
                                    <EditableText row={idx} col="content" value={row.content || ''} className="text-slate-600 dark:text-slate-400" />
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <EditableNumber row={idx} col="signedValue" value={row.signedValue} className="font-bold text-slate-800 dark:text-slate-200" />
                                </td>
                                <td className="px-3 py-2 text-center">
                                    <EditableText row={idx} col="signedDate" value={row.signedDate || ''} className="text-slate-500 dark:text-slate-400" />
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <EditableNumber row={idx} col="acceptanceValue" value={row.acceptanceValue} className="text-blue-600 dark:text-blue-400" />
                                </td>
                                <td className="px-3 py-2">
                                    <select
                                        value={row.salespersonId || ''}
                                        onChange={e => updateCell(idx, 'salespersonId', e.target.value)}
                                        className={cn(
                                            "w-full text-xs rounded-lg px-2 py-1.5 border bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer focus:outline-none",
                                            row.salespersonId
                                                ? "border-violet-300 dark:border-violet-600"
                                                : "border-rose-300 dark:border-rose-600 bg-rose-50 dark:bg-rose-900/10"
                                        )}
                                        disabled={employees.length === 0}
                                    >
                                        <option value="">— Chọn —</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Save Button */}
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                {!unitId && !selectedRows.every(r => (r as any).unitName) && (
                    <p className="text-xs text-rose-500 dark:text-rose-400 mb-2 text-center">
                        ⚠️ Vui lòng chọn <b>Đơn vị</b> trước khi nạp (hoặc đảm bảo dữ liệu có cột Đơn vị)
                    </p>
                )}
                {!allSelectedHaveSalesperson && (
                    <p className="text-xs text-amber-500 dark:text-amber-400 mb-2 text-center">
                        ℹ️ Một số HĐ chưa có <b>Người thực hiện</b>. Chọn thủ công hoặc dùng {'"'}Gán tất cả{'"'}
                    </p>
                )}
                <button
                    onClick={() => onSave(selectedRows, unitId, globalSalespersonId)}
                    disabled={saving || !canSave}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                    {saving ? (
                        <><Loader2 size={14} className="animate-spin" /> Đang nạp...</>
                    ) : (
                        <><Save size={14} /> Nạp {selectedRows.length} hợp đồng vào hệ thống</>
                    )}
                </button>
            </div>
        </div>
    );
};
