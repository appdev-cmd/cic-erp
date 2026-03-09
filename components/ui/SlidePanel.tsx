import React, { useEffect, useCallback, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useSlidePanel, PanelEntry } from '../../contexts/SlidePanelContext';

// ─── Single Panel ────────────────────────────────────────────────────────────

interface SlidePanelItemProps {
    panel: PanelEntry;
    index: number;
    total: number;
    onClose: () => void;
}

const STACKING_OFFSET = 24; // px per level

const SlidePanelItem: React.FC<SlidePanelItemProps> = ({ panel, index, total, onClose }) => {
    const isTopPanel = index === total - 1;
    const stackOffset = (total - 1 - index) * STACKING_OFFSET;
    const [isExiting, setIsExiting] = useState(false);

    const handleClose = useCallback(() => {
        setIsExiting(true);
        setTimeout(() => {
            onClose();
        }, 220); // match exit animation duration
    }, [onClose]);

    return (
        <div
            className={`absolute inset-0 flex justify-end`}
            style={{ zIndex: 60 + index }}
        >
            {/* Backdrop — only the top panel's backdrop is clickable */}
            <div
                className={`absolute inset-0 transition-colors duration-200 ${isTopPanel
                    ? 'bg-slate-900/40 dark:bg-slate-950/60 cursor-pointer'
                    : 'bg-transparent pointer-events-none'
                    } ${isExiting ? 'slide-panel-backdrop-exit' : 'slide-panel-backdrop-enter'}`}
                onClick={isTopPanel ? handleClose : undefined}
                aria-hidden="true"
            />

            {/* Panel Body */}
            <div
                className={`relative h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 
          flex flex-col overflow-hidden slide-panel-stacked
          ${isExiting ? 'slide-panel-exit' : 'slide-panel-enter'}`}
                style={{
                    // Full width minus sidebar, with stacking offset
                    width: `calc(100% - ${stackOffset}px)`,
                    maxWidth: `calc(100% - ${stackOffset}px)`,
                    // Slightly scale + dim non-top panels for depth
                    ...(isTopPanel ? {} : {
                        filter: 'brightness(0.97)',
                    }),
                }}
                role="dialog"
                aria-modal={isTopPanel}
                aria-label={panel.title || 'Panel'}
            >
                {/* Close Button — floating top-right */}
                {isTopPanel && (
                    <button
                        onClick={handleClose}
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

// ─── Panel Container (renders all stacked panels) ────────────────────────────

interface SlidePanelContainerProps {
    /** Sidebar collapsed state to calculate left offset */
    isSidebarCollapsed: boolean;
}

export const SlidePanelContainer: React.FC<SlidePanelContainerProps> = ({ isSidebarCollapsed }) => {
    const { panels, closePanel, hasOpenPanels } = useSlidePanel();

    // Escape key closes top panel
    useEffect(() => {
        if (!hasOpenPanels) return;

        const handleEscapeKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closePanel();
            }
        };

        window.addEventListener('keydown', handleEscapeKey, { capture: true });
        return () => window.removeEventListener('keydown', handleEscapeKey, { capture: true });
    }, [hasOpenPanels, closePanel]);

    // Toggle body overflow
    useEffect(() => {
        if (hasOpenPanels) {
            document.body.classList.add('slide-panel-open');
        } else {
            document.body.classList.remove('slide-panel-open');
        }
        return () => document.body.classList.remove('slide-panel-open');
    }, [hasOpenPanels]);

    if (!hasOpenPanels) return null;

    // Sidebar widths: collapsed = 80px (w-20), expanded = 256px (w-64)
    // On mobile (<768px), sidebar is hidden so panel is full width
    const sidebarWidth = isSidebarCollapsed ? 80 : 256;

    return (
        <div
            className="fixed inset-0 z-[60]"
        >
            {/* Full-screen backdrop — blocks sidebar and all content below */}
            <div
                className="absolute inset-0 bg-slate-900/20 dark:bg-slate-950/40 slide-panel-backdrop-enter"
                onClick={() => closePanel()}
                aria-hidden="true"
            />
            <style>{`
        @media (min-width: 768px) {
          .slide-panel-viewport {
            left: ${sidebarWidth}px !important;
          }
        }
      `}</style>
            <div
                className="slide-panel-viewport absolute inset-0"
                style={{ left: 0 }}
            >
                {panels.map((panel, index) => (
                    <SlidePanelItem
                        key={panel.id}
                        panel={panel}
                        index={index}
                        total={panels.length}
                        onClose={() => closePanel(panel.id)}
                    />
                ))}
            </div>
        </div>
    );
};

export default SlidePanelContainer;
