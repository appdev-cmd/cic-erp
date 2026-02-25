import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface ScrollToTopProps {
    /** Scroll threshold in pixels before the button appears */
    threshold?: number;
    /** Custom className for the button */
    className?: string;
}

const ScrollToTop: React.FC<ScrollToTopProps> = ({ threshold = 400, className }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsVisible(window.scrollY > threshold);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Check initial state

        return () => window.removeEventListener('scroll', handleScroll);
    }, [threshold]);

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    return (
        <button
            onClick={scrollToTop}
            aria-label="Cuộn lên đầu trang"
            className={`
        fixed bottom-8 right-8 z-50
        w-12 h-12 rounded-full
        bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800
        text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40
        flex items-center justify-center
        transition-all duration-300 ease-in-out
        ${isVisible
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 translate-y-4 scale-75 pointer-events-none'
                }
        ${className || ''}
      `}
        >
            <ArrowUp size={22} strokeWidth={2.5} />
        </button>
    );
};

export default ScrollToTop;
