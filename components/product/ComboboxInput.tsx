import React, { useState, useMemo, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { removeDiacritics } from '../../utils/formatters';

export const ComboboxInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder: string;
    label: string;
    autoFocus?: boolean;
}> = ({ value, onChange, options, placeholder, label, autoFocus }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const filtered = useMemo(() => {
        if (!search) return options;
        const q = removeDiacritics(search.toLowerCase());
        return options.filter(o => removeDiacritics(o.toLowerCase()).includes(q));
    }, [options, search]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setSearch(v);
        onChange(v);
        if (!isOpen) setIsOpen(true);
    };

    const handleSelect = (opt: string) => {
        onChange(opt);
        setSearch('');
        setIsOpen(false);
    };

    return (
        <div className="relative space-y-1">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{label}</label>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className="w-full px-4 py-2.5 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-slate-800 dark:text-slate-200 placeholder-slate-400"
                />
                <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
            </div>
            {isOpen && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-auto animate-in fade-in slide-in-from-top-2 duration-150">
                    {filtered.map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelect(opt)}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${
                                opt === value
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold'
                                    : 'text-slate-700 dark:text-slate-300'
                            }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
