import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    content: React.ReactNode;
    children: React.ReactNode;
    placement?: 'top' | 'bottom';
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, placement = 'top' }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            if (placement === 'bottom') {
                setCoords({
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX,
                });
            } else {
                setCoords({
                    top: rect.top + window.scrollY,
                    left: rect.left + window.scrollX + rect.width / 2,
                });
            }
            setIsVisible(true);
        }
    };

    const handleMouseLeave = () => {
        setIsVisible(false);
    };

    const transformStyle = placement === 'bottom'
        ? 'translateY(8px)'
        : 'translate(-50%, calc(-100% - 8px))';

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="inline-block"
            >
                {children}
            </div>
            {isVisible && createPortal(
                <div
                    className="fixed z-[9999] pointer-events-none animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        transform: transformStyle,
                    }}
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    );
};

export default Tooltip;
