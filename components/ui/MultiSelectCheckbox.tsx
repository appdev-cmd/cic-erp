import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

export interface Option {
  id: string;
  label: string;
}

interface MultiSelectCheckboxProps {
  options: Option[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MultiSelectCheckbox: React.FC<MultiSelectCheckboxProps> = ({
  options,
  selectedIds,
  onChange,
  placeholder = 'Chọn...',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 200 });

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const top = rect.bottom + 4;
      setDropdownPos({ top, left: rect.left, width: rect.width });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeOption = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onChange(selectedIds.filter(selectedId => selectedId !== id));
  };

  const selectedOptions = options.filter(opt => selectedIds.includes(opt.id));

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-left text-sm font-medium transition-all min-h-[42px]
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-sky-400 dark:hover:border-sky-500 focus:outline-none focus:border-sky-500'}
          ${isOpen ? 'border-sky-500 dark:border-sky-500' : ''}
        `}
      >
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0 pr-2">
          {selectedOptions.length === 0 ? (
            <span className="text-slate-400 mt-0.5">{placeholder}</span>
          ) : (
            selectedOptions.map(opt => (
              <div 
                key={opt.id}
                className="flex items-center gap-1 pl-2 pr-1.5 py-0.5 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 rounded-sm text-xs font-normal"
              >
                <span>{opt.label}</span>
                <div 
                  onClick={(e) => removeOption(e, opt.id)}
                  className="hover:bg-sky-200 dark:hover:bg-sky-800 rounded-sm p-0.5 transition-colors cursor-pointer"
                >
                  <X size={12} />
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedIds.length > 0 && !disabled && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
            >
              <X size={14} className="text-slate-400" />
            </div>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          data-portal-dropdown="true"
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-60 overflow-y-auto"
        >
          {options.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400 text-center">Không có dữ liệu</div>
          ) : (
            options.map(option => (
              <label
                key={option.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(option.id)}
                  onChange={() => toggleOption(option.id)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-sky-500 focus:ring-sky-500 focus:ring-offset-0 dark:bg-slate-800"
                />
                <span className="text-sm text-slate-700 dark:text-slate-200">{option.label}</span>
              </label>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default MultiSelectCheckbox;
