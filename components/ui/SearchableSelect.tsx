import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, ChevronDown, Plus } from 'lucide-react';

interface Option {
    id: string;
    name: string;
    subText?: string;
}

interface SearchableSelectProps {
    value: string | null;
    onChange: (id: string | null, option?: Option) => void;
    onSearch: (query: string) => Promise<Option[]>;
    placeholder?: string;
    label?: string;
    disabled?: boolean;
    initialOptions?: Option[];
    getDisplayValue?: (id: string) => string | undefined;
    onAddNew?: () => void;
    addNewLabel?: string;
    size?: 'sm' | 'md';
}

/**
 * Async searchable select with debounce.
 * Use for large datasets (customers, products, employees).
 */
const SearchableSelect: React.FC<SearchableSelectProps> = ({
    value,
    onChange,
    onSearch,
    placeholder = 'Tìm kiếm...',
    label,
    disabled = false,
    initialOptions = [],
    getDisplayValue,
    onAddNew,
    addNewLabel = 'Thêm mới',
    size = 'md',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState<Option[]>(initialOptions);
    const [isLoading, setIsLoading] = useState(false);
    const [displayValue, setDisplayValue] = useState<string>('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<any>(null);

    // Update display value when value changes
    useEffect(() => {
        if (value) {
            if (getDisplayValue) {
                setDisplayValue(getDisplayValue(value) || '');
            } else {
                const found = options.find(o => o.id === value);
                if (found) setDisplayValue(found.name);
            }
        } else {
            setDisplayValue('');
        }
    }, [value, options, getDisplayValue]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search
    const handleQueryChange = useCallback((newQuery: string) => {
        setQuery(newQuery);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (newQuery.length < 2) {
            setOptions(initialOptions);
            return;
        }

        setIsLoading(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const results = await onSearch(newQuery);
                setOptions(results);
            } catch (err) {
                console.error('[SearchableSelect] Search error:', err);
                setOptions([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);
    }, [onSearch, initialOptions]);

    const handleSelect = (option: Option) => {
        onChange(option.id, option);
        setDisplayValue(option.name);
        setIsOpen(false);
        setQuery('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setDisplayValue('');
        setQuery('');
    };

    return (
        <div ref={containerRef} className="relative">
            {label && (
                <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                    {label}
                </label>
            )}

            {/* Display Button */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    setIsOpen(!isOpen);
                    setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className={`w-full flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-left text-sm font-medium transition-all ${size === 'sm' ? 'px-3 py-2' : 'px-4 py-3'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-300 dark:hover:border-indigo-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30'
                    } ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900/30' : ''}`}
            >
                <span className={displayValue ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}>
                    {displayValue || placeholder}
                </span>
                <div className="flex items-center gap-1">
                    {value && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <X size={14} className="text-slate-400" />
                        </button>
                    )}
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    {/* Search Input */}
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => handleQueryChange(e.target.value)}
                                placeholder="Gõ ít nhất 2 ký tự..."
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:border-indigo-500 focus:outline-none transition-colors"
                            />
                            {isLoading && (
                                <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
                            )}
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-60 overflow-y-auto">
                        {options.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-slate-400">
                                {query.length < 2 ? 'Nhập để tìm kiếm...' : 'Không tìm thấy kết quả'}
                            </div>
                        ) : (
                            options.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => handleSelect(option)}
                                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${value === option.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                                        }`}
                                >
                                    <p className={`text-sm font-bold ${value === option.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                        {option.name}
                                    </p>
                                    {option.subText && (
                                        <p className="text-xs text-slate-400 mt-0.5">{option.subText}</p>
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Add New Button */}
                    {onAddNew && (
                        <div className="border-t border-slate-100 dark:border-slate-800 p-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsOpen(false);
                                    onAddNew();
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold text-sm rounded-lg transition-colors"
                            >
                                <Plus size={16} />
                                {addNewLabel}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
