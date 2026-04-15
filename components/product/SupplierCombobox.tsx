import React, { useState, useEffect } from 'react';
import { ChevronDown, X, Plus } from 'lucide-react';
import { Customer } from '../../types';
import { CustomerService } from '../../services';

export const SupplierCombobox: React.FC<{
    value: string;
    supplierName: string;
    onChange: (supplierId: string, supplierName: string) => void;
    onAddNew: (searchText: string) => void;
}> = ({ value, supplierName, onChange, onAddNew }) => {
    const [supplierSearch, setSupplierSearch] = useState('');
    const [supplierResults, setSupplierResults] = useState<Customer[]>([]);
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

    // Supplier search debounce
    useEffect(() => {
        if (supplierSearch.length < 2) {
            setSupplierResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const results = await CustomerService.searchSuppliers(supplierSearch);
                setSupplierResults(results);
                setShowSupplierDropdown(true);
            } catch (err) {
                console.error('Supplier search error:', err);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [supplierSearch]);

    const selectSupplier = (supplier: Customer) => {
        onChange(supplier.id, supplier.name);
        setSupplierSearch('');
        setShowSupplierDropdown(false);
    };

    const clearSupplier = () => {
        onChange('', '');
        setSupplierSearch('');
    };

    return (
        <div className="relative">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Nhà cung cấp chính</label>
            <div className="relative">
                {value ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                        <span className="flex-1 font-medium text-slate-900 dark:text-slate-100 truncate">{supplierName}</span>
                        <button type="button" onClick={clearSupplier} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer">
                            <X size={14} className="text-slate-400" />
                        </button>
                    </div>
                ) : (
                    <>
                        <input
                            type="text"
                            value={supplierSearch}
                            onChange={(e) => {
                                setSupplierSearch(e.target.value);
                                if (!showSupplierDropdown) setShowSupplierDropdown(true);
                            }}
                            onFocus={() => setShowSupplierDropdown(true)}
                            onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 250)}
                            placeholder="Gõ tên NCC hoặc chọn..."
                            className="w-full px-4 py-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-colors text-slate-800 dark:text-slate-200 placeholder-slate-400"
                        />
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </>
                )}
            </div>
            {showSupplierDropdown && !value && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-auto">
                    {supplierResults.map(s => (
                        <button
                            key={s.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectSupplier(s)}
                            className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-slate-800 text-sm transition-colors cursor-pointer"
                        >
                            {s.name}
                            {s.shortName && <span className="ml-2 text-slate-400 text-xs">({s.shortName})</span>}
                        </button>
                    ))}
                    {supplierSearch.trim() && !supplierResults.some(s => s.name.toLowerCase() === supplierSearch.trim().toLowerCase()) && (
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                onAddNew(supplierSearch.trim());
                                setShowSupplierDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors border-t border-slate-100 dark:border-slate-700 flex items-center gap-2"
                        >
                            <Plus size={14} />
                            Thêm NCC "{supplierSearch.trim()}"
                        </button>
                    )}
                    {supplierResults.length === 0 && !supplierSearch.trim() && (
                        <div className="px-4 py-3 text-sm text-slate-400 text-center">Gõ tên để tìm NCC</div>
                    )}
                </div>
            )}
        </div>
    );
};
