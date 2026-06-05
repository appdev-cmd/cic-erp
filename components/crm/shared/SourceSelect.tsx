import React, { useState, useRef, useEffect } from 'react';
import {
  Globe, Mail, Phone, Handshake, MessageCircle,
  Calendar, FileSpreadsheet, Link, MoreHorizontal, ChevronDown
} from 'lucide-react';
import { LEAD_SOURCE_LABELS } from '../../../types/crm';
import type { LeadSource } from '../../../types/crm';

const SOURCE_ICON_MAP: Record<LeadSource, React.ElementType> = {
  website: Globe,
  email: Mail,
  phone: Phone,
  referral: Handshake,
  social: MessageCircle,
  event: Calendar,
  import: FileSpreadsheet,
  api: Link,
  other: MoreHorizontal,
};

const SOURCE_COLORS: Record<LeadSource, {
  text: string;
  bg: string;
  darkText: string;
  darkBg: string;
}> = {
  website: { text: 'text-blue-600', bg: 'bg-blue-50', darkText: 'dark:text-blue-400', darkBg: 'dark:bg-blue-900/30' },
  email: { text: 'text-violet-600', bg: 'bg-violet-50', darkText: 'dark:text-violet-400', darkBg: 'dark:bg-violet-900/30' },
  phone: { text: 'text-rose-600', bg: 'bg-rose-50', darkText: 'dark:text-rose-400', darkBg: 'dark:bg-rose-900/30' },
  referral: { text: 'text-amber-600', bg: 'bg-amber-50', darkText: 'dark:text-amber-400', darkBg: 'dark:bg-amber-900/30' },
  social: { text: 'text-pink-600', bg: 'bg-pink-50', darkText: 'dark:text-pink-400', darkBg: 'dark:bg-pink-900/30' },
  event: { text: 'text-indigo-600', bg: 'bg-indigo-50', darkText: 'dark:text-indigo-400', darkBg: 'dark:bg-indigo-900/30' },
  import: { text: 'text-teal-600', bg: 'bg-teal-50', darkText: 'dark:text-teal-400', darkBg: 'dark:bg-teal-900/30' },
  api: { text: 'text-cyan-600', bg: 'bg-cyan-50', darkText: 'dark:text-cyan-400', darkBg: 'dark:bg-cyan-900/30' },
  other: { text: 'text-slate-600', bg: 'bg-slate-50', darkText: 'dark:text-slate-400', darkBg: 'dark:bg-slate-800' },
};

interface SourceSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export default function SourceSelect({
  value,
  onChange,
  className = '',
  placeholder = '-- Chọn nguồn --',
}: SourceSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedKey = value as LeadSource;
  const SelectedIcon = SOURCE_ICON_MAP[selectedKey];
  const selectedLabel = LEAD_SOURCE_LABELS[selectedKey] || value;
  const colors = SOURCE_COLORS[selectedKey];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-left text-sm font-medium hover:border-indigo-300 dark:hover:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all cursor-pointer"
      >
        <span className="flex items-center gap-2">
          {SelectedIcon ? (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText}`}>
              <SelectedIcon size={12} />
              <span>{selectedLabel}</span>
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {placeholder}
          </button>
          {Object.entries(LEAD_SOURCE_LABELS).map(([key, label]) => {
            const sourceKey = key as LeadSource;
            const IconComp = SOURCE_ICON_MAP[sourceKey];
            const itemColors = SOURCE_COLORS[sourceKey];
            const isSelected = value === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onChange(key);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                  isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center p-1 rounded-lg ${itemColors.bg} ${itemColors.text} ${itemColors.darkBg} ${itemColors.darkText}`}>
                    <IconComp size={14} />
                  </span>
                  <span className={`text-sm font-semibold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {label}
                  </span>
                </span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
