import React, { useEffect, useCallback, useState } from 'react';
import { X, FileText } from 'lucide-react';
import { useSlidePanel, PanelEntry } from '../../contexts/SlidePanelContext';
import { useIsMobile } from '../../hooks';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_GAP = 20;           // px base gap between sidebar and first panel (expanded)
const COLLAPSED_BASE_GAP = 60; // px base gap when sidebar collapsed (larger to prevent tab clipping)
const STACKING_OFFSET = 20;   // px additional gap per stacked panel
const TAB_WIDTH = 34;          // px tab thickness (protrudes left of panel edge)
const TAB_LENGTH = 148;        // px fixed tab length (vertical)
const TAB_GAP = 3;             // px gap between adjacent tabs

// ─── Single Panel ────────────────────────────────────────────────────────────

interface SlidePanelItemProps {
    panel: PanelEntry;
    index: number;
    total: number;
    onClose: () => void;
    isExiting?: boolean;
    isSidebarCollapsed: boolean;
    isMobile: boolean;
}

const SlidePanelItem: React.FC<SlidePanelItemProps> = ({ panel, index, total, onClose, isExiting, isSidebarCollapsed, isMobile }) => {
    const isTopPanel = index === total - 1;
    // Larger base gap when collapsed pushes panel right, preventing tab from being clipped
    const baseGap = isSidebarCollapsed ? COLLAPSED_BASE_GAP : BASE_GAP;
    // Mobile: panel chiếm trọn màn hình (không chừa khe xếp chồng, không có tab-ear).
    const stackOffset = isMobile ? 0 : baseGap + index * STACKING_OFFSET;

    return (
        <div
            className="absolute inset-0 flex justify-end"
            style={{ zIndex: 60 + index }}
        >
            {/* Backdrop */}
            <div
                className={`absolute inset-0 transition-colors duration-200 ${isTopPanel
                    ? 'bg-gray-900/30 dark:bg-gray-900/40 cursor-pointer'
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
                {/* Close Button — vùng chạm ≥44px trên mobile (full-screen) */}
                {isTopPanel && (
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 z-10 p-2.5 md:p-2 rounded-lg
              text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
              hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700
              transition-colors"
                        aria-label="Đóng"
                    >
                        <X size={22} className="md:w-5 md:h-5" />
                    </button>
                )}

                {/* Content */}
                <div className="flex flex-col flex-1 h-full overflow-y-auto overflow-x-hidden">
                    {panel.component}
                </div>
            </div>
        </div>
    );
};

// ─── Folder Tabs — vertical tabs hugging each panel's left edge ──────────────
// Each tab is a vertical "folder tab" whose RIGHT edge sits flush against its
// own panel's left border (1px overlap to hide the seam). Text runs vertically.
// Tabs stack adjacently top-to-bottom with a tiny gap, like file-folder tabs.
// Rendered in the outer fixed container (not the viewport) so they can
// extend over the sidebar.

interface PanelTabsOverlayProps {
    panels: PanelEntry[];
    sidebarWidth: number;
    isSidebarCollapsed: boolean;
    onFocus: (id: string) => void;
    onClose: (id: string) => void;
}

const PanelTabsOverlay: React.FC<PanelTabsOverlayProps> = ({ panels, sidebarWidth, isSidebarCollapsed, onFocus, onClose }) => {
    if (panels.length === 0) return null;

    return (
        <>
            {panels.map((panel, index) => {
                const isTopPanel = index === panels.length - 1;
                const title = panel.title || `Panel ${index + 1}`;
                const displayTitle = title.length > 24 ? title.slice(0, 24) + '…' : title;

                // Adjacent stacking: tabs sit right below each other
                const tabTop = 16 + index * (TAB_LENGTH + TAB_GAP);

                // Tab's right edge hugs its own panel's left edge (1px overlap
                // hides the border seam) — deeper panels step right, so tabs
                // form a folder-tab staircase
                const baseGap = isSidebarCollapsed ? COLLAPSED_BASE_GAP : BASE_GAP;
                const panelLeftEdgeScreen = sidebarWidth + baseGap + index * STACKING_OFFSET;

                const tabPositionStyle: React.CSSProperties = {
                    right: `calc(100% - ${panelLeftEdgeScreen + 1}px)`,
                    top: `${tabTop}px`,
                    zIndex: 60 + panels.length + index + 1,
                };

                return (
                    <div
                        key={panel.id}
                        className="slide-panel-tab pointer-events-auto absolute"
                        style={tabPositionStyle}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isTopPanel) {
                                    onFocus(panel.id);
                                }
                            }}
                            className={`group flex flex-col items-center gap-1.5 pt-2.5 pb-2
                                rounded-l-xl border border-r-0
                                transition-all duration-200
                                ${isTopPanel
                                    ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-700 dark:border-indigo-600 text-white shadow-xl shadow-indigo-500/30 dark:shadow-indigo-700/50'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-600 shadow-lg shadow-slate-900/15 dark:shadow-slate-950/50 cursor-pointer'
                                }`}
                            style={{ width: `${TAB_WIDTH}px`, height: `${TAB_LENGTH}px` }}
                            title={panel.title || 'Panel'}
                        >
                            {/* Icon */}
                            <span className={`flex-shrink-0 w-4 h-4 flex items-center justify-center ${isTopPanel
                                ? 'text-indigo-200'
                                : 'text-slate-400 dark:text-slate-500'
                                }`}>
                                {panel.icon || <FileText size={14} />}
                            </span>

                            {/* Title — vertical, reads bottom-to-top */}
                            <span
                                className="flex-1 min-h-0 overflow-hidden text-xs font-semibold whitespace-nowrap"
                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', textOverflow: 'ellipsis' }}
                            >
                                {displayTitle}
                            </span>

                            {/* × Close — ONLY on topmost panel */}
                            {isTopPanel && (
                                <span
                                    onClick={(e) => { e.stopPropagation(); onClose(panel.id); }}
                                    className="flex-shrink-0 w-5 h-5 flex items-center justify-center
                                        rounded-full
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
    const isMobile = useIsMobile();

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

    const sidebarWidth = isSidebarCollapsed ? 80 : 208;

    const isAllExiting = panels.length > 0 && closingPanels.size === panels.length;

    return (
        <div className="fixed inset-0 z-[60]">
            {/* Full-screen backdrop — frosted glass dims the sidebar */}
            <div
                className={`absolute inset-0 bg-gray-900/20 dark:bg-gray-900/40 backdrop-blur-[2px] transition-colors duration-200 ${isAllExiting ? 'slide-panel-backdrop-exit' : 'slide-panel-backdrop-enter'}`}
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
                        isSidebarCollapsed={isSidebarCollapsed}
                        isMobile={isMobile}
                    />
                ))}
            </div>

            {/* Tab Ears — OUTSIDE viewport, in the fixed container.
                 Cho phép tab tràn lên sidebar (desktop). Trên mobile panel full-screen
                 + sidebar là drawer nên ẩn tab-ear; điều hướng panel bằng nút đóng (X). */}
            {!isMobile && (
                <PanelTabsOverlay
                    panels={panels}
                    sidebarWidth={sidebarWidth}
                    isSidebarCollapsed={isSidebarCollapsed}
                    onFocus={(id) => guardedFocus(id)}
                    onClose={(id) => guardedClose(id)}
                />
            )}
        </div>
    );
};

export default SlidePanelContainer;
