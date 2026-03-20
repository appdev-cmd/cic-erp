import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, FileText, Users, Building2, Package,
    LayoutDashboard, BarChart3, Settings, Bot,
    CreditCard, ChevronRight, Command, X
} from 'lucide-react';
import { ROUTES } from '../../routes/routes';
import { ContractService, CustomerService, EmployeeService, ProductService, UnitService } from '../../services';
import { removeDiacritics } from '../../utils/formatters';

interface SearchResult {
    id: string;
    type: 'contract' | 'customer' | 'personnel' | 'product' | 'unit' | 'page';
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    route: string;
}

const staticPages: SearchResult[] = [
    { id: 'dashboard', type: 'page', title: 'Dashboard', icon: <LayoutDashboard size={16} />, route: ROUTES.DASHBOARD },
    { id: 'contracts', type: 'page', title: 'Hợp đồng', icon: <FileText size={16} />, route: ROUTES.CONTRACTS },
    { id: 'payments', type: 'page', title: 'Tài chính', icon: <CreditCard size={16} />, route: ROUTES.PAYMENTS },
    { id: 'analytics', type: 'page', title: 'Phân tích', icon: <BarChart3 size={16} />, route: ROUTES.ANALYTICS },
    { id: 'ai', type: 'page', title: 'AI Assistant', icon: <Bot size={16} />, route: ROUTES.AI_ASSISTANT },
    { id: 'personnel', type: 'page', title: 'Nhân sự', icon: <Users size={16} />, route: ROUTES.PERSONNEL },
    { id: 'customers', type: 'page', title: 'Khách hàng', icon: <Building2 size={16} />, route: ROUTES.CUSTOMERS },
    { id: 'products', type: 'page', title: 'Sản phẩm', icon: <Package size={16} />, route: ROUTES.PRODUCTS },
    { id: 'units', type: 'page', title: 'Đơn vị', icon: <Building2 size={16} />, route: ROUTES.UNITS },
    { id: 'settings', type: 'page', title: 'Cài đặt', icon: <Settings size={16} />, route: ROUTES.SETTINGS },
];

const typeLabels: Record<string, string> = {
    page: 'Trang',
    contract: 'Hợp đồng',
    customer: 'Khách hàng',
    personnel: 'Nhân sự',
    product: 'Sản phẩm',
    unit: 'Đơn vị',
};

const CommandPalette: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>(staticPages);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('recentSearches') || '[]');
        } catch { return []; }
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    // Save recent search
    const saveRecentSearch = (term: string) => {
        if (!term.trim()) return;
        const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
    };

    // Keyboard shortcut to open (Cmd+K or Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
            setQuery('');
            setResults(staticPages);
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Search logic - Optimized with parallel calls
    const performSearch = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults(staticPages);
            return;
        }

        setIsLoading(true);
        const q = removeDiacritics(searchQuery.toLowerCase());

        // Filter static pages (diacritics-insensitive)
        const pageResults = staticPages.filter(p =>
            removeDiacritics(p.title.toLowerCase()).includes(q)
        );

        const dynamicResults: SearchResult[] = [];

        try {
            // Parallel API calls for better performance
            const [contracts, customersRes, personnel, products, units] = await Promise.all([
                ContractService.getAll().catch(() => []),
                CustomerService.getAll().catch(() => ({ data: [] })),
                EmployeeService.getAll().catch(() => []),
                ProductService.getAll().catch(() => []),
                UnitService.getAll().catch(() => []),
            ]);

            // Search contracts
            contracts
                .filter(c => removeDiacritics(c.contractCode?.toLowerCase() || '').includes(q) || removeDiacritics(c.title?.toLowerCase() || '').includes(q) || removeDiacritics(c.partyA?.toLowerCase() || '').includes(q))
                .slice(0, 5)
                .forEach(c => {
                    dynamicResults.push({
                        id: c.id,
                        type: 'contract',
                        title: c.contractCode,
                        subtitle: c.title || c.partyA || '',
                        icon: <FileText size={16} className="text-orange-500" />,
                        route: ROUTES.CONTRACT_DETAIL(encodeURIComponent(c.id)),
                    });
                });

            // Search customers
            (customersRes.data || [])
                .filter(c => removeDiacritics(c.name?.toLowerCase() || '').includes(q) || c.taxCode?.includes(searchQuery))
                .slice(0, 3)
                .forEach(c => {
                    dynamicResults.push({
                        id: c.id,
                        type: 'customer',
                        title: c.name,
                        subtitle: (Array.isArray(c.industry) ? c.industry.join(', ') : c.industry) || c.taxCode || '',
                        icon: <Building2 size={16} className="text-blue-500" />,
                        route: ROUTES.CUSTOMER_DETAIL(c.id),
                    });
                });

            // Search personnel
            personnel
                .filter(p => removeDiacritics(p.name?.toLowerCase() || '').includes(q) || p.employeeCode?.toLowerCase().includes(searchQuery.toLowerCase()))
                .slice(0, 3)
                .forEach(p => {
                    dynamicResults.push({
                        id: p.id,
                        type: 'personnel',
                        title: p.name,
                        subtitle: p.position || p.employeeCode || '',
                        icon: <Users size={16} className="text-emerald-500" />,
                        route: ROUTES.PERSONNEL_DETAIL(p.id),
                    });
                });

            // Search products
            products
                .filter(p => removeDiacritics(p.name?.toLowerCase() || '').includes(q) || p.code?.toLowerCase().includes(searchQuery.toLowerCase()))
                .slice(0, 3)
                .forEach(p => {
                    dynamicResults.push({
                        id: p.id,
                        type: 'product',
                        title: p.name,
                        subtitle: p.code || '',
                        icon: <Package size={16} className="text-purple-500" />,
                        route: ROUTES.PRODUCT_DETAIL(p.id),
                    });
                });

            // Search units
            units
                .filter(u => removeDiacritics(u.name?.toLowerCase() || '').includes(q) || u.code?.toLowerCase().includes(searchQuery.toLowerCase()))
                .slice(0, 3)
                .forEach(u => {
                    dynamicResults.push({
                        id: u.id,
                        type: 'unit',
                        title: u.name,
                        subtitle: u.code || '',
                        icon: <Building2 size={16} className="text-cyan-500" />,
                        route: ROUTES.UNIT_DETAIL(u.id),
                    });
                });

        } catch (error) {
            console.error('Search error:', error);
        }

        setResults([...pageResults, ...dynamicResults]);
        setSelectedIndex(0);
        setIsLoading(false);
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => performSearch(query), 300);
        return () => clearTimeout(timer);
    }, [query, performSearch]);

    // Navigate to result
    const handleSelect = useCallback((result: SearchResult) => {
        saveRecentSearch(result.title);
        navigate(result.route);
        setIsOpen(false);
    }, [navigate, saveRecentSearch]);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
                break;
        }
    };

    // Group results by type
    const groupedResults = useMemo(() => {
        const groups: Record<string, SearchResult[]> = {};
        results.forEach(r => {
            if (!groups[r.type]) groups[r.type] = [];
            groups[r.type].push(r);
        });
        return groups;
    }, [results]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
            />

            {/* Dialog */}
            <div className="relative mx-auto max-w-2xl mt-[15vh]">
                <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {/* Search Input */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <Search size={20} className="text-slate-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Tìm kiếm hợp đồng, khách hàng, nhân sự..."
                            className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                        />
                        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 rounded">
                            ESC
                        </kbd>
                    </div>

                    {/* Results */}
                    <div className="max-h-[400px] overflow-y-auto py-2">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8 text-slate-400">
                                <div className="animate-spin mr-2">⏳</div> Đang tìm kiếm...
                            </div>
                        ) : results.length === 0 ? (
                            <div className="flex items-center justify-center py-8 text-slate-400">
                                Không tìm thấy kết quả
                            </div>
                        ) : (
                            Object.entries(groupedResults).map(([type, items]) => (
                                <div key={type}>
                                    <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {typeLabels[type] || type}
                                    </div>
                                    {items.map((result, idx) => {
                                        const globalIdx = results.indexOf(result);
                                        const isSelected = globalIdx === selectedIndex;
                                        return (
                                            <button
                                                key={result.id}
                                                onClick={() => handleSelect(result)}
                                                onMouseEnter={() => setSelectedIndex(globalIdx)}
                                                className={`
                          w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                          ${isSelected ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}
                        `}
                                            >
                                                <div className={`p-2 rounded-lg ${isSelected ? 'bg-orange-100 dark:bg-orange-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                    {result.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">
                                                        {result.title}
                                                    </div>
                                                    {result.subtitle && (
                                                        <div className="text-xs text-slate-500 truncate">
                                                            {result.subtitle}
                                                        </div>
                                                    )}
                                                </div>
                                                <ChevronRight size={16} className={`text-slate-300 ${isSelected ? 'text-orange-500' : ''}`} />
                                            </button>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">↑</kbd>
                                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">↓</kbd>
                                di chuyển
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">↵</kbd>
                                chọn
                            </span>
                        </div>
                        <span className="flex items-center gap-1">
                            <Command size={10} /> + K để mở
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;

// Hook to trigger command palette from anywhere
export const useCommandPalette = () => {
    const open = useCallback(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    }, []);

    return { open };
};
