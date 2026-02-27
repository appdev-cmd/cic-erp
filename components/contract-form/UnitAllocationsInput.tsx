import React, { useEffect } from 'react';
import { Plus, Trash2, Users, Percent, User } from 'lucide-react';
import { Unit, Employee, UnitAllocation } from '../../types';

interface Props {
    units: Unit[];
    employees: Employee[];
    leadUnitId: string;           // Đơn vị thực hiện chính (from parent dropdown)
    allocations: UnitAllocation[];
    onChange: (allocations: UnitAllocation[]) => void;
    onLeadEmployeeChange: (employeeId: string) => void; // Callback to update parent's salespersonId
}

/**
 * Component for managing unit allocations with percentage distribution
 * Per QĐ 09.2024 - Quy chế Phối hợp kinh doanh
 * 
 * Auto-calculates lead % = 100% - sum of support %
 */
export default function UnitAllocationsInput({
    units,
    employees,
    leadUnitId,
    allocations,
    onChange,
    onLeadEmployeeChange
}: Props) {
    // Calculate support total and lead percent (auto-calculated)
    const supportTotalPercent = allocations
        .filter(a => a.role === 'support')
        .reduce((sum, a) => sum + a.percent, 0);
    const leadPercent = 100 - supportTotalPercent;
    const leadAllocation = allocations.find(a => a.role === 'lead');
    const isValid = leadPercent >= 0;

    // Initialize/sync lead allocation when leadUnitId changes
    useEffect(() => {
        if (leadUnitId) {
            const existingLead = allocations.find(a => a.role === 'lead');
            if (!existingLead) {
                // Create new lead allocation
                onChange([{
                    unitId: leadUnitId,
                    employeeId: '',
                    percent: 100,
                    role: 'lead'
                }, ...allocations.filter(a => a.role === 'support')]);
            } else if (existingLead.unitId !== leadUnitId) {
                // Update lead unit if changed from parent dropdown
                const newAllocations = allocations.map(a =>
                    a.role === 'lead' ? { ...a, unitId: leadUnitId, employeeId: '' } : a
                );
                onChange(newAllocations);
            }
        }
    }, [leadUnitId]);

    // Auto-update lead percent when support allocations change
    useEffect(() => {
        if (leadAllocation && leadAllocation.percent !== leadPercent) {
            const newAllocations = allocations.map(a =>
                a.role === 'lead' ? { ...a, percent: leadPercent } : a
            );
            onChange(newAllocations);
        }
    }, [supportTotalPercent]);

    const handleLeadEmployeeChange = (employeeId: string) => {
        // Update in allocations
        const newAllocations = allocations.map(a =>
            a.role === 'lead' ? { ...a, employeeId } : a
        );
        onChange(newAllocations);
        // Notify parent
        onLeadEmployeeChange(employeeId);
    };

    const addSupportUnit = () => {
        const usedUnitIds = allocations.map(a => a.unitId);
        const availableUnit = units.find(u => u.id !== 'all' && !usedUnitIds.includes(u.id));
        if (!availableUnit) return;

        onChange([...allocations, {
            unitId: availableUnit.id,
            employeeId: '',
            percent: 50, // Default 50% for new support unit
            role: 'support'
        }]);
    };

    const removeSupportUnit = (unitId: string) => {
        onChange(allocations.filter(a => a.unitId !== unitId || a.role === 'lead'));
    };

    const updateSupportPercent = (allocationToUpdate: UnitAllocation, newPercent: number) => {
        const clampedPercent = Math.max(0, Math.min(100, newPercent));
        const newAllocations = allocations.map(a =>
            a === allocationToUpdate ? { ...a, percent: clampedPercent } : a
        );
        onChange(newAllocations);
    };

    const updateSupportEmployee = (allocationToUpdate: UnitAllocation, employeeId: string) => {
        const newAllocations = allocations.map(a =>
            a === allocationToUpdate ? { ...a, employeeId } : a
        );
        onChange(newAllocations);
    };

    const updateSupportUnit = (allocationToUpdate: UnitAllocation, newUnitId: string) => {
        const newAllocations = allocations.map(a =>
            a === allocationToUpdate ? { ...a, unitId: newUnitId, employeeId: '' } : a
        );
        onChange(newAllocations);
    };

    const getFilteredEmployees = (unitId: string) => {
        return employees.filter(e => e.unitId === unitId);
    };

    const getUnitName = (unitId: string) => {
        return units.find(u => u.id === unitId)?.name || 'Unknown';
    };

    const supportAllocations = allocations.filter(a => a.role === 'support');
    const canAddMore = supportAllocations.length < 2 && units.filter(u =>
        u.id !== 'all' && !allocations.some(a => a.unitId === u.id)
    ).length > 0;

    return (
        <div className="space-y-4">
            {/* Lead Unit Summary - show when there are support units */}
            {supportAllocations.length > 0 && (
                <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 rounded-lg px-4 py-2.5 border border-indigo-100 dark:border-indigo-800">
                    <div className="flex items-center gap-2">
                        <Users size={14} className="text-indigo-500" />
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                            Đơn vị thực hiện: {getUnitName(leadUnitId)}
                        </span>
                    </div>
                    <div className={`text-sm font-black px-3 py-1 rounded-lg ${isValid ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-800/40' : 'text-red-600 bg-red-100 dark:bg-red-900/40'}`}>
                        {leadPercent}%
                    </div>
                </div>
            )}

            {/* Support Units */}
            {supportAllocations.map((allocation, index) => (
                <div
                    key={`support-${allocation.unitId}-${index}`}
                    className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-800"
                >
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase flex items-center gap-1">
                            <Users size={12} /> Đơn vị phối hợp {index + 1}
                        </p>
                        <button
                            type="button"
                            onClick={() => removeSupportUnit(allocation.unitId)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Unit Select */}
                        <select
                            value={allocation.unitId}
                            onChange={(e) => updateSupportUnit(allocation, e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium"
                        >
                            {units.filter(u => u.id !== 'all' && (u.id === allocation.unitId || !allocations.some(a => a.unitId === u.id))).map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>

                        {/* Employee Select */}
                        <select
                            value={allocation.employeeId}
                            onChange={(e) => updateSupportEmployee(allocation, e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium"
                        >
                            <option value="">-- Chọn NV --</option>
                            {getFilteredEmployees(allocation.unitId).map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                        </select>

                        {/* Percent Input */}
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={allocation.percent}
                                onChange={(e) => updateSupportPercent(allocation, parseInt(e.target.value) || 0)}
                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-center"
                            />
                            <Percent size={14} className="text-slate-400" />
                        </div>
                    </div>
                </div>
            ))}

            {/* Add Button */}
            {canAddMore && (
                <button
                    type="button"
                    onClick={addSupportUnit}
                    className="w-full py-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-500 dark:text-slate-400 hover:border-orange-400 hover:text-orange-500 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={16} /> Thêm đơn vị phối hợp
                </button>
            )}

            {/* Validation Message */}
            {!isValid && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-medium bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                    <span>⚠️ Tổng % đơn vị phối hợp vượt quá 100%!</span>
                </div>
            )}
        </div>
    );
}
