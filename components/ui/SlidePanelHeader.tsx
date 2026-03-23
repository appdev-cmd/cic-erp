import React from 'react';

interface SlidePanelHeaderProps {
  children?: React.ReactNode;
  className?: string;
}

export const SlidePanelHeader: React.FC<SlidePanelHeaderProps> = ({ children, className = '' }) => {
  return (
    <div className={`flex-shrink-0 flex items-center justify-between pl-16 pr-14 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${className}`}>
      {children}
    </div>
  );
};

export default SlidePanelHeader;
