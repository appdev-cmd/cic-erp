import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PanelEntry {
    id: string;
    component: React.ReactNode;
    title?: string;
    icon?: React.ReactNode;
    url?: string;
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
    /** Set of panel IDs currently playing their exit animation */
    closingPanels: Set<string>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SlidePanelContext = createContext<SlidePanelContextType | null>(null);

let panelCounter = 0;

// ─── Provider ────────────────────────────────────────────────────────────────

export const SlidePanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [panels, setPanels] = useState<PanelEntry[]>([]);
    const [closingPanels, setClosingPanels] = useState<Set<string>>(new Set());
    const panelsRef = useRef(panels);
    const [baseUrl, setBaseUrl] = useState<string>('');

    useEffect(() => {
        panelsRef.current = panels;
    }, [panels]);

    // Track URLs
    useEffect(() => {
        if (panels.length === 0) {
            // Restore base URL when all closed
            if (baseUrl) {
                window.history.replaceState(null, '', baseUrl);
                setBaseUrl('');
            }
        } else {
            // Capture base URL on first open
            if (panels.length === 1 && !baseUrl) {
                setBaseUrl(window.location.pathname + window.location.search);
            }
            
            // Find top-most panel that has not been marked as closing
            const activePanels = panels.filter(p => !closingPanels.has(p.id));
            const topPanel = activePanels[activePanels.length - 1];
            if (topPanel && topPanel.url) {
                window.history.replaceState(null, '', topPanel.url);
            } else if (topPanel && baseUrl) {
                 // If top panel doesn't have a URL, maybe fallback to a safe URL
                 // (or do nothing and wait until one does)
            }
        }
    }, [panels, closingPanels, baseUrl]);

    const openPanel = useCallback((entry: Omit<PanelEntry, 'id'>): string => {
        const id = `panel-${++panelCounter}-${Date.now()}`;
        setPanels(prev => [...prev, { ...entry, id }]);
        return id;
    }, []);

    const triggerCloseAnimation = useCallback((id: string) => {
        setClosingPanels(prev => new Set(prev).add(id));
        setTimeout(() => {
            setPanels(prev => prev.filter(p => p.id !== id));
            setClosingPanels(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }, 220); // 220ms matches CSS animation duration
    }, []);

    const closePanel = useCallback((id?: string) => {
        const currentPanels = panelsRef.current;
        if (currentPanels.length === 0) return;
        const targetId = id || currentPanels[currentPanels.length - 1].id;
        triggerCloseAnimation(targetId);
    }, [triggerCloseAnimation]);

    const closeAllPanels = useCallback(() => {
        const currentPanels = panelsRef.current;
        if (currentPanels.length === 0) return;
        
        // Mark all active panels as closing
        const idsToClose = currentPanels.map(p => p.id);
        setClosingPanels(prev => new Set([...prev, ...idsToClose]));
        
        setTimeout(() => {
            setPanels([]);
            setClosingPanels(new Set());
        }, 220);
    }, []);

    const focusPanel = useCallback((id: string) => {
        const currentPanels = panelsRef.current;
        const idx = currentPanels.findIndex(p => p.id === id);
        if (idx === -1) return;
        
        // All panels ABOVE the focused panel should be closed
        const panelsToClose = currentPanels.slice(idx + 1);
        if (panelsToClose.length === 0) return;
        
        const idsToClose = panelsToClose.map(p => p.id);
        setClosingPanels(prev => new Set([...prev, ...idsToClose]));
        
        setTimeout(() => {
            setPanels(prev => prev.filter(p => !idsToClose.includes(p.id)));
            setClosingPanels(prev => {
                const next = new Set(prev);
                idsToClose.forEach(i => next.delete(i));
                return next;
            });
        }, 220);
    }, []);

    const hasOpenPanels = panels.length > 0;

    const value = useMemo(() => ({
        panels,
        openPanel,
        closePanel,
        closeAllPanels,
        focusPanel,
        hasOpenPanels,
        closingPanels,
    }), [panels, openPanel, closePanel, closeAllPanels, focusPanel, hasOpenPanels, closingPanels]);

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
