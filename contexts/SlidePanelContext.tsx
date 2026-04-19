import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PanelEntry {
    id: string;
    component: React.ReactNode;
    title?: string;
    icon?: React.ReactNode;
    url?: string;
    width?: string;
}

interface SlidePanelContextType {
    /** Current stack of open panels (bottom → top) */
    panels: PanelEntry[];
    /** Push a new panel onto the stack. Returns its unique ID. */
    openPanel: (entry: Omit<PanelEntry, 'id'>) => string;
    /** Close a specific panel by ID, or close the top-most panel if no ID given. Returns false if blocked. */
    closePanel: (id?: string) => boolean | undefined;
    /** Close ALL panels at once */
    closeAllPanels: () => void;
    /** Focus a panel by closing all panels above it in the stack */
    focusPanel: (id: string) => void;
    /** Whether any panel is currently open */
    hasOpenPanels: boolean;
    /** Set of panel IDs currently playing their exit animation */
    closingPanels: Set<string>;
    /** Lock panel to prevent accidental closure (e.g. when a form is open) */
    lockPanel: (id?: string) => void;
    /** Unlock panel to allow closure again */
    unlockPanel: (id?: string) => void;
    /** Whether the top-most panel is currently locked */
    isTopPanelLocked: boolean;
    /** Register a callback for when close is blocked on a locked panel */
    setOnCloseBlocked: (id: string | undefined, callback: (() => void) | null) => void;
    /** Force-close a panel (bypasses lock — used by discard/save handlers) */
    forceClosePanel: (id?: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SlidePanelContext = createContext<SlidePanelContextType | null>(null);

let panelCounter = 0;

// ─── Provider ────────────────────────────────────────────────────────────────

export const SlidePanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [panels, setPanels] = useState<PanelEntry[]>([]);
    const [closingPanels, setClosingPanels] = useState<Set<string>>(new Set());
    const [lockedPanels, setLockedPanels] = useState<Set<string>>(new Set());
    const panelsRef = useRef(panels);
    const lockedRef = useRef(lockedPanels);
    const closeBlockedCallbacksRef = useRef<Map<string, () => void>>(new Map());
    const [baseUrl, setBaseUrl] = useState<string>('');

    useEffect(() => {
        lockedRef.current = lockedPanels;
    }, [lockedPanels]);

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
        // If locked, invoke onCloseBlocked callback instead of closing
        if (lockedRef.current.has(targetId)) {
            const cb = closeBlockedCallbacksRef.current.get(targetId);
            if (cb) cb();
            return false;
        }
        triggerCloseAnimation(targetId);
        return true;
    }, [triggerCloseAnimation]);

    /** Force-close bypasses lock (used by save/discard handlers) */
    const forceClosePanel = useCallback((id?: string) => {
        const currentPanels = panelsRef.current;
        if (currentPanels.length === 0) return;
        const targetId = id || currentPanels[currentPanels.length - 1].id;
        // Remove lock first
        setLockedPanels(prev => {
            const next = new Set(prev);
            next.delete(targetId);
            return next;
        });
        closeBlockedCallbacksRef.current.delete(targetId);
        triggerCloseAnimation(targetId);
    }, [triggerCloseAnimation]);

    const lockPanel = useCallback((id?: string) => {
        const currentPanels = panelsRef.current;
        if (currentPanels.length === 0) return;
        const targetId = id || currentPanels[currentPanels.length - 1].id;
        setLockedPanels(prev => new Set(prev).add(targetId));
    }, []);

    const unlockPanel = useCallback((id?: string) => {
        const currentPanels = panelsRef.current;
        if (currentPanels.length === 0) return;
        const targetId = id || currentPanels[currentPanels.length - 1].id;
        setLockedPanels(prev => {
            const next = new Set(prev);
            next.delete(targetId);
            return next;
        });
    }, []);

    const closeAllPanels = useCallback(() => {
        const currentPanels = panelsRef.current;
        if (currentPanels.length === 0) return;
        // Block if any panel is locked
        const hasLocked = currentPanels.some(p => lockedRef.current.has(p.id));
        if (hasLocked) return;
        
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
        // Block if any panel to be closed is locked
        const hasLocked = panelsToClose.some(p => lockedRef.current.has(p.id));
        if (hasLocked) return;
        
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
    const isTopPanelLocked = useMemo(() => {
        if (panels.length === 0) return false;
        return lockedPanels.has(panels[panels.length - 1].id);
    }, [panels, lockedPanels]);

    // Clean up locks and callbacks for panels that no longer exist
    useEffect(() => {
        const panelIds = new Set(panels.map(p => p.id));
        setLockedPanels(prev => {
            const next = new Set<string>();
            prev.forEach(id => { if (panelIds.has(id)) next.add(id); });
            return next.size === prev.size ? prev : next;
        });
        // Clean up stale callbacks
        closeBlockedCallbacksRef.current.forEach((_, id) => {
            if (!panelIds.has(id)) closeBlockedCallbacksRef.current.delete(id);
        });
    }, [panels]);

    const setOnCloseBlocked = useCallback((id: string | undefined, callback: (() => void) | null) => {
        const currentPanels = panelsRef.current;
        if (currentPanels.length === 0) return;
        const targetId = id || currentPanels[currentPanels.length - 1].id;
        if (callback) {
            closeBlockedCallbacksRef.current.set(targetId, callback);
        } else {
            closeBlockedCallbacksRef.current.delete(targetId);
        }
    }, []);

    const value = useMemo(() => ({
        panels,
        openPanel,
        closePanel,
        closeAllPanels,
        focusPanel,
        hasOpenPanels,
        closingPanels,
        lockPanel,
        unlockPanel,
        isTopPanelLocked,
        setOnCloseBlocked,
        forceClosePanel,
    }), [panels, openPanel, closePanel, closeAllPanels, focusPanel, hasOpenPanels, closingPanels, lockPanel, unlockPanel, isTopPanelLocked, setOnCloseBlocked, forceClosePanel]);

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

/** Safe version — returns null (instead of throwing) when used outside a SlidePanelProvider */
export function useSlidePanelSafe() {
    return useContext(SlidePanelContext);
}

export default SlidePanelContext;
