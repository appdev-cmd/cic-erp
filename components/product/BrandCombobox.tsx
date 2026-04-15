import React, { useState, useMemo } from 'react';
import { ChevronDown, X, Plus } from 'lucide-react';
import { Brand } from '../../types';
import { removeDiacritics } from '../../utils/formatters';

export const BrandCombobox: React.FC<{
    value: string;
    brandName: string;
    brands: Brand[];
    onChange: (brandId: string, brandName: string) => void;
    onAddNew: (searchText: string) => void;
}> = ({ value, brandName, brands, onChange, onAddNew }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search) return brands;
        const q = removeDiacritics(search.toLowerCase());
        return brands.filter(b => removeDiacritics(b.name.toLowerCase()).includes(q));
    }, [brands, search]);

    const displayValue = value ? (brandName || brands.find(b => b.id === value)?.name || '') : search;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        if (value) onChange('', '');
        if (!isOpen) setIsOpen(true);
    };

    const handleSelect = (brand: Brand) => {
        onChange(brand.id, brand.name);
        setSearch('');
        setIsOpen(false);
    };

    const handleAddNew = () => {
        if (!search.trim()) return;
        setIsOpen(false);
        onAddNew(search.trim());
    };

    const handleClear = () => {
        onChange('', '');
        setSearch('');
    };

    return (
        <div className="relative space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Hãng / Thương hiệu *</label>
            <div className="relative">
                {value ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                        <span className="flex-1 font-medium text-slate-900 dark:text-slate-100 truncate">{displayValue}</span>
                        <button type="button" onClick={handleClear} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors cursor-pointer">
                            <X size={14} className="text-slate-400" />
                        </button>
                    </div>
                ) : (
                    <>
                        <input
                            type="text"
                            value={search}
                            onChange={handleInputChange}
                            onFocus={() => setIsOpen(true)}
                            onBlur={() => setTimeout(() => setIsOpen(false), 250)}
                            placeholder="Gõ tên hãng hoặc chọn..."
                            className="w-full px-4 py-2.5 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400"
                        />
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </>
                )}
            </div>
            {isOpen && !value && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-auto animate-in fade-in slide-in-from-top-2 duration-150">
                    {filtered.map((brand) => (
                        <button
                            key={brand.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelect(brand)}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-slate-700 dark:text-slate-300"
                        >
                            {brand.name}
                            {brand.country && <span className="ml-2 text-slate-400 text-xs">({brand.country})</span>}
                        </button>
                    ))}
                    {search.trim() && !filtered.some(b => b.name.toLowerCase() === search.trim().toLowerCase()) && (
                        <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleAddNew}
                            className="w-full text-left px-4 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors border-t border-slate-100 dark:border-slate-700 flex items-center gap-2"
                        >
                            <Plus size={14} />
                            Thêm hãng "{search.trim()}"
                        </button>
                    )}
                    {filtered.length === 0 && !search.trim() && (
                        <div className="px-4 py-3 text-sm text-slate-400 text-center">Chưa có hãng nào</div>
                    )}
                </div>
            )}
        </div>
    );
};
