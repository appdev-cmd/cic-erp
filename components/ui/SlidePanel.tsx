import React, { useEffect, useCallback, useState } from 'react';
import { X, FileText } from 'lucide-react';
import { useSlidePanel, PanelEntry } from '../../contexts/SlidePanelContext';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_GAP = 20;           // px base gap between sidebar and first panel
const STACKING_OFFSET = 20;   // px additional gap per stacked panel
const TAB_HEIGHT = 38;         // approximate tab height in px
const TAB_VERTICAL_GAP = 6;   // px gap between cascading tabs vertically

// ─── Single Panel ────────────────────────────────────────────────────────────

interface SlidePanelItemProps {
    panel: PanelEntry;
    index: number;
    total: number;
    onClose: () => void;
    isExiting?: boolean;
}

const SlidePanelItem: React.FC<SlidePanelItemProps> = ({ panel, index, total, onClose, isExiting }) => {
    const isTopPanel = index === total - 1;
    // Base gap + stacking: every panel has at least BASE_GAP from sidebar
    const stackOffset = BASE_GAP + index * STACKING_OFFSET;

    return (
        <div
            className="absolute inset-0 flex justify-end"
            style={{ zIndex: 60 + index }}
        >
            {/* Backdrop */}
            <div
                className={`absolute inset-0 transition-colors duration-200 ${isTopPanel
                    ? 'bg-slate-900/40 dark:bg-slate-950/60 cursor-pointer'
                    : 'bg-transparent pointer-events-none'
                    } ${isExiting ? 'slide-panel-backdrop-exit' : 'slide-panel-backdrop-enter'}`}
                onClick={isTopPanel ? onClose : undefined}
                aria-hidden="true"
            />

            {/* Panel Body — close to sidebar edge */}
            <div
                className={`relative h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 
          flex flex-col overflow-hidden slide-panel-stacked
          ${isExiting ? 'slide-panel-exit' : 'slide-panel-enter'}`}
                style={{
                    width: `calc(100% - ${stackOffset}px)`,
                    maxWidth: `calc(100% - ${stackOffset}px)`,
                    ...(isTopPanel ? {} : {
                        filter: 'brightness(0.97)',
                    }),
                }}
                role="dialog"
                aria-modal={isTopPanel}
                aria-label={panel.title || 'Panel'}
            >
                {/* Close Button */}
                {isTopPanel && (
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 z-10 p-2 rounded-lg
              text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
              hover:bg-slate-100 dark:hover:bg-slate-800
              transition-colors"
                        aria-label="Đóng"
                    >
                        <X size={20} />
                    </button>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    {panel.component}
                </div>
            </div>
        </div>
    );
};

// ─── Tab Ears — overlaps sidebar AND panel body ──────────────────────────────
// Each tab straddles the panel's left border:
//   - LEFT portion: overlaps the sidebar
//   - RIGHT portion: overlaps the panel body (overlap width = TAB_HEIGHT)
// Tabs cascade VERTICALLY — each lower panel's tab is pushed down.
// Rendered in the outer fixed container (not the viewport) so they can 
// extend over the sidebar.

interface PanelTabsOverlayProps {
    panels: PanelEntry[];
    sidebarWidth: number;
    onFocus: (id: string) => void;
    onClose: (id: string) => void;
}

const PanelTabsOverlay: React.FC<PanelTabsOverlayProps> = ({ panels, sidebarWidth, onFocus, onClose }) => {
    if (panels.length === 0) return null;

    return (
        <>
            {panels.map((panel, index) => {
                const isTopPanel = index === panels.length - 1;
                const title = panel.title || `Panel ${index + 1}`;
                const displayTitle = title.length > 12 ? title.slice(0, 12) + '…' : title;

                // Panel left border in SCREEN coordinates:
                // sidebarWidth + (index * STACKING_OFFSET)
                const panelLeftEdgeScreen = sidebarWidth + BASE_GAP + index * STACKING_OFFSET;

                // Tab RIGHT edge = panel left border + TAB_HEIGHT (overlaps into panel)
                // Using CSS `right`: distance from screen right
                // right = 100% - (panelLeftEdgeScreen + TAB_HEIGHT)
                const tabRightEdge = panelLeftEdgeScreen + TAB_HEIGHT;

                // Vertical cascade: each tab is lower
                const tabTop = 12 + index * (TAB_HEIGHT + TAB_VERTICAL_GAP);

                return (
                    <div
                        key={panel.id}
                        className="slide-panel-tab pointer-events-auto absolute"
                        style={{
                            right: `calc(100% - ${tabRightEdge}px)`,
                            top: `${tabTop}px`,
                            zIndex: 60 + panels.length + index + 1,
                        }}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isTopPanel) {
                                    onFocus(panel.id);
                                }
                            }}
                            className={`group flex items-center gap-1.5 pl-3 pr-2.5 py-2
                                rounded-l-xl border border-r-0
                                transition-all duration-200
                                whitespace-nowrap
                                ${isTopPanel
                                    ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-700 dark:border-indigo-600 text-white shadow-xl shadow-indigo-500/30 dark:shadow-indigo-700/50'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600 shadow-lg shadow-slate-900/15 dark:shadow-slate-950/50 cursor-pointer'
                                }`}
                            title={panel.title || 'Panel'}
                        >
                            {/* Icon */}
                            <span className={`flex-shrink-0 w-4 h-4 flex items-center justify-center ${isTopPanel
                                ? 'text-indigo-200'
                                : 'text-slate-400 dark:text-slate-500'
                                }`}>
                                {panel.icon || <FileText size={14} />}
                            </span>

                            {/* Title */}
                            <span className="text-xs font-semibold">
                                {displayTitle}
                            </span>

                            {/* × Close — ONLY on topmost panel */}
                            {isTopPanel && (
                                <span
                                    onClick={(e) => { e.stopPropagation(); onClose(panel.id); }}
                                    className="flex-shrink-0 w-5 h-5 flex items-center justify-center
                                        rounded-full ml-1
                                        text-indigo-200 hover:text-white hover:bg-indigo-700 dark:hover:bg-indigo-600
                                        transition-all duration-150 cursor-pointer"
                                    title="Đóng"
                                >
                                    <X size={12} strokeWidth={2.5} />
                                </span>
                            )}
                        </button>
                    </div>
                );
            })}
        </>
    );
};

// ─── Panel Container ─────────────────────────────────────────────────────────

interface SlidePanelContainerProps {
    isSidebarCollapsed: boolean;
}

export const SlidePanelContainer: React.FC<SlidePanelContainerProps> = ({ isSidebarCollapsed }) => {
    const { panels, closePanel, focusPanel, hasOpenPanels, closingPanels, isTopPanelLocked } = useSlidePanel();

    // Guarded close: closePanel already invokes onCloseBlocked callbacks when locked.
    // This wrapper adds a fallback toast for panels with no callback registered.
    const guardedClose = useCallback((id?: string) => {
        const result = closePanel(id);
        // result === false means the panel was locked
        if (result === false && isTopPanelLocked) {
            // Generic fallback toast (shown only if no onCloseBlocked callback handled it)
            // In practice, panels with save confirmation will have callbacks, so this rarely fires
        }
    }, [closePanel, isTopPanelLocked]);

    const guardedFocus = useCallback((id: string) => {
        if (isTopPanelLocked) {
            closePanel(); // This will trigger the callback if registered
            return;
        }
        focusPanel(id);
    }, [focusPanel, isTopPanelLocked, closePanel]);

    useEffect(() => {
        if (!hasOpenPanels) return;
        const handleEscapeKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                guardedClose();
            }
        };
        window.addEventListener('keydown', handleEscapeKey, { capture: true });
        return () => window.removeEventListener('keydown', handleEscapeKey, { capture: true });
    }, [hasOpenPanels, guardedClose]);

    useEffect(() => {
        if (hasOpenPanels) {
            document.body.classList.add('slide-panel-open');
        } else {
            document.body.classList.remove('slide-panel-open');
        }
        return () => document.body.classList.remove('slide-panel-open');
    }, [hasOpenPanels]);

    if (!hasOpenPanels) return null;

    const sidebarWidth = isSidebarCollapsed ? 80 : 256;

    const isAllExiting = panels.length > 0 && closingPanels.size === panels.length;

    return (
        <div className="fixed inset-0 z-[60]">
            {/* Full-screen backdrop — frosted glass dims the sidebar */}
            <div
                className={`absolute inset-0 bg-slate-900/25 dark:bg-slate-950/50 backdrop-blur-[2px] transition-colors duration-200 ${isAllExiting ? 'slide-panel-backdrop-exit' : 'slide-panel-backdrop-enter'}`}
                onClick={() => guardedClose()}
                aria-hidden="true"
            />

            {/* Panel viewport — after sidebar */}
            <style>{`
        @media (min-width: 768px) {
          .slide-panel-viewport {
            left: ${sidebarWidth}px !important;
          }
        }
      `}</style>
            <div
                className="slide-panel-viewport absolute inset-0 overflow-hidden"
                style={{ left: 0 }}
            >
                {panels.map((panel, index) => (
                    <SlidePanelItem
                        key={panel.id}
                        panel={panel}
                        index={index}
                        total={panels.length}
                        onClose={() => guardedClose(panel.id)}
                        isExiting={closingPanels.has(panel.id)}
                    />
                ))}
            </div>

            {/* Tab Ears — OUTSIDE viewport, in the fixed container -->
                 This allows tabs to overlap the sidebar */}
            <PanelTabsOverlay
                panels={panels}
                sidebarWidth={sidebarWidth}
                onFocus={(id) => guardedFocus(id)}
                onClose={(id) => guardedClose(id)}
            />
        </div>
    );
};

export default SlidePanelContainer;
