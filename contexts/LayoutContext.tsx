import { useOutletContext } from 'react-router-dom';
import { Unit } from '../types';

export interface LayoutContextType {
    selectedUnit: Unit;
    setSelectedUnit: (unit: Unit) => void;
    yearFilter: string;
    setYearFilter: (year: string) => void;
    periodFilter: string;
    setPeriodFilter: (period: string) => void;
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    accent: 'orange' | 'blue';
    setAccent: (accent: 'orange' | 'blue') => void;
}

export function useLayoutContext(): LayoutContextType {
    const ctx = useOutletContext<LayoutContextType>();
    if (ctx) return ctx;

    // Fallback for components rendered outside of <Outlet /> (e.g. inside SlidePanel)
    console.warn('useLayoutContext called outside of MainLayout Outlet. Using fallback values.');
    return {
        selectedUnit: { 
            id: 'all', name: 'Toàn công ty', code: 'ALL', type: 'Company', 
            target: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 }, 
            lastYearActual: { signing: 0, revenue: 0, adminProfit: 0, revProfit: 0, cash: 0 } 
        },
        setSelectedUnit: () => {},
        yearFilter: new Date().getFullYear().toString(),
        setYearFilter: () => {},
        periodFilter: '',
        setPeriodFilter: () => {},
        theme: 'light',
        setTheme: () => {},
        accent: 'blue',
        setAccent: () => {},
    };
}
