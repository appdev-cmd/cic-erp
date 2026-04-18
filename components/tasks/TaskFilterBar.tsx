import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, X, Tag, Filter, Check, ChevronDown, Calendar, Users, ListTodo 
} from 'lucide-react';
import type { TaskStatus } from '../../types/taskTypes';
import PeoplePickerPopover from './PeoplePickerPopover';

export interface DateRange {
  start?: string;
  end?: string;
}

interface TaskFilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  availableTags: string[];
  
  // Status filter
  statuses: TaskStatus[];
  selectedStatusIds: string[];
  onStatusChange: (ids: string[]) => void;
  
  // Assignee filter
  selectedAssigneeIds: string[];
  onAssigneeChange: (ids: string[]) => void;
  
  // Date range filter
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export const TaskFilterBar: React.FC<TaskFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  availableTags,
  statuses,
  selectedStatusIds,
  onStatusChange,
  selectedAssigneeIds,
  onAssigneeChange,
  dateRange,
  onDateRangeChange
}) => {
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  
  const [openDropdown, setOpenDropdown] = useState<'status' | 'assignee' | 'date' | null>(null);

  // --- Search & Tags Autocomplete Logic ---
  const getTagFragment = (): string | null => {
    const input = searchInputRef.current;
    if (!input) return null;
    const pos = input.selectionStart ?? searchQuery.length;
    const match = searchQuery.substring(0, pos).match(/#(\S*)$/);
    return match ? match[1] : null;
  };

  const tagFragment = getTagFragment();
  const tagSuggestions = tagFragment !== null
    ? availableTags.filter(t => t.toLowerCase().includes(tagFragment.toLowerCase()) && !searchQuery.includes(`#${t}`)).slice(0, 20)
    : [];

  const handleSelectSuggestedTag = (tag: string) => {
    const input = searchInputRef.current;
    if (!input) return;
    const pos = input.selectionStart ?? searchQuery.length;
    const textBefore = searchQuery.substring(0, pos);
    const textAfter = searchQuery.substring(pos);
    const newBefore = textBefore.replace(/#\S*$/, `#${tag}`);
    const newValue = newBefore + (textAfter.startsWith(' ') ? textAfter : ' ' + textAfter);
    onSearchChange(newValue.trimEnd());
    setShowTagSuggestions(false);
    setTimeout(() => {
      if (searchInputRef.current) {
        const newPos = newBefore.length + 1;
        searchInputRef.current.setSelectionRange(newPos, newPos);
        searchInputRef.current.focus();
      }
    }, 0);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowTagSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Check if any advanced filters are active
  const hasAdvancedFilters = selectedStatusIds.length > 0 || selectedAssigneeIds.length > 0 || dateRange.start || dateRange.end;

  return (
    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-stretch sm:items-center">
      {/* Search Input width Tags */}
      <div ref={searchWrapperRef} className="relative flex-1 sm:w-64 md:w-80 lg:w-96">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={e => {
            onSearchChange(e.target.value);
            setShowTagSuggestions(true);
          }}
          onFocus={() => setShowTagSuggestions(true)}
          placeholder="Tìm kiếm... (gõ #tag để lọc)"
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
            <X size={14} />
          </button>
        )}
        
        {showTagSuggestions && tagSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto animate-in fade-in">
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
              Tags gợi ý
            </div>
            {tagSuggestions.map(tag => (
              <button
                key={tag}
                onClick={() => handleSelectSuggestedTag(tag)}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer flex items-center gap-2"
              >
                <Tag size={12} className="text-indigo-400 dark:text-indigo-500 flex-shrink-0" />
                <span className="font-medium">#{tag}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Separator icon */}
        <Filter size={16} className={`hidden sm:block ${hasAdvancedFilters ? 'text-indigo-500' : 'text-slate-300 dark:text-slate-600'}`} />

        {/* Status Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer
              ${selectedStatusIds.length > 0
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/50'
              }`}
          >
            <ListTodo size={14} />
            <span>Trạng thái {selectedStatusIds.length > 0 && `(${selectedStatusIds.length})`}</span>
            <ChevronDown size={12} className={openDropdown === 'status' ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          
          {openDropdown === 'status' && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpenDropdown(null)} />
              <div className="absolute mt-1 w-56 right-0 sm:left-0 sm:right-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-40 animate-in fade-in zoom-in-95 origin-top-left p-2">
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {statuses.map(status => {
                    const isSelected = selectedStatusIds.includes(status.id);
                    return (
                      <button
                        key={status.id}
                        onClick={() => {
                          if (isSelected) onStatusChange(selectedStatusIds.filter(id => id !== status.id));
                          else onStatusChange([...selectedStatusIds, status.id]);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors cursor-pointer
                          ${isSelected ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color || '#94a3b8' }} />
                          {status.name}
                        </div>
                        {isSelected && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
                {selectedStatusIds.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-center">
                    <button onClick={() => onStatusChange([])} className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium w-full py-1 cursor-pointer">
                      Xóa lựa chọn
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Assignee Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer
              ${selectedAssigneeIds.length > 0
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/50'
              }`}
          >
            <Users size={14} />
            <span>Người TH {selectedAssigneeIds.length > 0 && `(${selectedAssigneeIds.length})`}</span>
            <ChevronDown size={12} className={openDropdown === 'assignee' ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          
          {openDropdown === 'assignee' && (
            <div className="absolute top-full mt-1 right-0 sm:left-0 sm:right-auto z-40 w-[280px]">
              <PeoplePickerPopover
                currentIds={selectedAssigneeIds}
                onChange={onAssigneeChange}
                onClose={() => setOpenDropdown(null)}
                align="left"
                minSelections={0}
                singleSelect={false}
              />
            </div>
          )}
        </div>

        {/* Date Filter */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'date' ? null : 'date')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer
              ${dateRange.start || dateRange.end
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/50'
              }`}
          >
            <Calendar size={14} />
            <span>Hạn TG {(dateRange.start || dateRange.end) && '*'}</span>
            <ChevronDown size={12} className={openDropdown === 'date' ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          
          {openDropdown === 'date' && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpenDropdown(null)} />
              <div className="absolute mt-1 w-64 right-0 sm:left-0 sm:right-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-40 p-3 pt-4 animate-in fade-in origin-top-left">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Từ ngày</label>
                    <input
                      type="date"
                      value={dateRange.start || ''}
                      onChange={e => onDateRangeChange({ ...dateRange, start: e.target.value })}
                      className="w-full text-sm px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Đến ngày</label>
                    <input
                      type="date"
                      value={dateRange.end || ''}
                      onChange={e => onDateRangeChange({ ...dateRange, end: e.target.value })}
                      className="w-full text-sm px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                    />
                  </div>
                </div>
                {(dateRange.start || dateRange.end) && (
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 text-center">
                    <button 
                      onClick={() => onDateRangeChange({ start: undefined, end: undefined })} 
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium w-full py-1 cursor-pointer"
                    >
                      Bỏ lọc thời gian
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
