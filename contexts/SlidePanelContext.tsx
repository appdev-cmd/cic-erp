import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PanelEntry {
    id: string;
    component: React.ReactNode;
    title?: string;
    icon?: React.ReactNode;
}

interface SlidePanelContextType {
    /** Current stack of open panels (bottom → top) */
    panels: PanelEntry[];
    /** Push a new panel onto the stack. Returns its unique ID. */
    openPanel: (entry: Omit<PanelEntry, 'id'>) => string;
    /** Close a specific panel by ID, or close the top-most panel if no ID given */
    closePanel: (id?: string) => void;
    /** Close ALL panels at once */
    closeAllPanels: () => void;
    /** Focus a panel by closing all panels above it in the stack */
    focusPanel: (id: string) => void;
    /** Whether any panel is currently open */
    hasOpenPanels: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SlidePanelContext = createContext<SlidePanelContextType | null>(null);

let panelCounter = 0;

// ─── Provider ────────────────────────────────────────────────────────────────

export const SlidePanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [panels, setPanels] = useState<PanelEntry[]>([]);

    const openPanel = useCallback((entry: Omit<PanelEntry, 'id'>): string => {
        const id = `panel-${++panelCounter}-${Date.now()}`;
        setPanels(prev => [...prev, { ...entry, id }]);
        return id;
    }, []);

    const closePanel = useCallback((id?: string) => {
        setPanels(prev => {
            if (prev.length === 0) return prev;
            if (id) {
                return prev.filter(p => p.id !== id);
            }
            // Close top-most panel
            return prev.slice(0, -1);
        });
    }, []);

    const closeAllPanels = useCallback(() => {
        setPanels([]);
    }, []);

    const focusPanel = useCallback((id: string) => {
        setPanels(prev => {
            const idx = prev.findIndex(p => p.id === id);
            if (idx === -1) return prev;
            // Remove all panels above the target
            return prev.slice(0, idx + 1);
        });
    }, []);

    const hasOpenPanels = panels.length > 0;

    const value = useMemo(() => ({
        panels,
        openPanel,
        closePanel,
        closeAllPanels,
        focusPanel,
        hasOpenPanels,
    }), [panels, openPanel, closePanel, closeAllPanels, focusPanel, hasOpenPanels]);

    return (
        <SlidePanelContext.Provider value={value}>
            {children}
        </SlidePanelContext.Provider>
    );
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSlidePanel() {
    const ctx = useContext(SlidePanelContext);
    if (!ctx) {
        throw new Error('useSlidePanel must be used within a SlidePanelProvider');
    }
    return ctx;
}

export default SlidePanelContext;
