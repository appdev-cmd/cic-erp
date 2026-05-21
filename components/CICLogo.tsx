import React from 'react';

interface CICLogoProps {
    /** Logo size variant */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    /** Show full logo with text, or compact icon only */
    variant?: 'full' | 'compact';
    /** Custom className for additional styling */
    className?: string;
}

/**
 * CIC ERP Logo — Uses cic-logo.png image
 * Supports multiple sizes and full/compact variants.
 */
const CICLogo: React.FC<CICLogoProps> = ({
    size = 'md',
    variant = 'full',
    className = ''
}) => {
    const sizeConfig = {
        xs: { imgH: 20, text: 10, sub: 6, gap: 4 },
        sm: { imgH: 27, text: 13, sub: 7.5, gap: 6 },
        md: { imgH: 34, text: 16, sub: 8.5, gap: 8 },
        lg: { imgH: 45, text: 20, sub: 10, gap: 10 },
        xl: { imgH: 63, text: 28, sub: 14, gap: 14 },
    };

    const config = sizeConfig[size];

    return (
        <div className={`inline-flex items-center ${className}`} style={{ gap: config.gap }}>
            <img
                src={variant === 'full' ? "/cic-logo-full.png" : "/cic-logo.png"}
                alt="CIC Logo"
                style={{ height: config.imgH }}
                className="flex-shrink-0 object-contain"
            />

            {variant === 'full' && (
                <div className="flex flex-col leading-none select-none">
                    <span
                        className="font-black tracking-wider text-slate-800 dark:text-slate-100"
                        style={{
                            fontSize: config.text,
                            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                            letterSpacing: '0.08em',
                        }}
                    >
                        CIC ERP
                    </span>
                    {size !== 'xs' && size !== 'sm' && (
                        <span
                            className="font-medium text-slate-400 dark:text-slate-500 tracking-wide"
                            style={{
                                fontSize: config.sub,
                                fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                                letterSpacing: '0.03em',
                                marginTop: 1.5,
                            }}
                        >
                            Contract Management
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default CICLogo;

/**
 * Compact CIC Icon for collapsed sidebar — PNG image only
 */
export const CICLogoIcon: React.FC<{ size?: number; className?: string }> = ({
    size = 36,
    className = ''
}) => (
    <div className={`flex items-center justify-center ${className}`}>
        <img
            src="/cic-logo.png"
            alt="CIC Logo"
            style={{ height: size * 0.43 }}
            className="flex-shrink-0 object-contain"
        />
    </div>
);
