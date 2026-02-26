import React from 'react';

interface AvatarProps {
    src?: string;
    alt?: string;
    className?: string;
    children?: React.ReactNode;
}

export const Avatar: React.FC<AvatarProps> = ({ src, alt, className = '', children }) => {
    return (
        <div className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className}`}>
            {src ? (
                <img src={src} alt={alt} className="aspect-square h-full w-full object-cover" />
            ) : (
                children
            )}
        </div>
    );
};

export const AvatarImage: React.FC<{ src?: string; alt?: string; className?: string }> = ({ src, alt, className = '' }) => {
    if (!src) return null;
    return <img src={src} alt={alt} className={`aspect-square h-full w-full object-cover ${className}`} />;
};

export const AvatarFallback: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
    return (
        <div className={`flex h-full w-full items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}>
            {children}
        </div>
    );
};
