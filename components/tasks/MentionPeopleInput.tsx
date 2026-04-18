import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, UserPlus } from 'lucide-react';
import { dataClient } from '../../lib/dataClient';

export interface PersonOption {
  id: string;
  name: string;
  avatar: string | null;
  department?: string;
}

interface MentionPeopleInputProps {
  label: string;
  icon: React.ReactNode;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  singleSelect?: boolean;
  excludeIds?: string[];
  className?: string;
}

const Avatar: React.FC<{ person: PersonOption; size?: number }> = ({ person, size = 20 }) => (
  <div
    className={`rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0`}
    style={{ width: size, height: size, fontSize: size * 0.45 }}
  >
    {person.avatar
      ? <img src={person.avatar} alt="" className="w-full h-full object-cover" />
      : person.name.charAt(0).toUpperCase()
    }
  </div>
);

const MentionPeopleInput: React.FC<MentionPeopleInputProps> = ({
  label, icon, selectedIds, onChange, placeholder, singleSelect, excludeIds = [], className = ''
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<PersonOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedProfiles, setSelectedProfiles] = useState<PersonOption[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load profiles for selectedIds
  useEffect(() => {
    if (selectedIds.length === 0) { setSelectedProfiles([]); return; }
    dataClient.from('employees').select('id, name, avatar, department')
      .in('id', selectedIds)
      .then(({ data }) => {
        if (data) setSelectedProfiles(data.map(d => ({ id: d.id, name: d.name || '?', avatar: d.avatar, department: d.department })));
      });
  }, [selectedIds.join(',')]);

  // Debounce search
  const search = useCallback(async (q: string) => {
    const allExclude = [...excludeIds, ...selectedIds];
    const query = dataClient.from('employees').select('id, name, avatar, department').order('name').limit(8);
    if (q) query.ilike('name', `%${q}%`);
    const { data } = await query;
    if (data) {
      setSuggestions(data.filter(d => !allExclude.includes(d.id)).map(d => ({
        id: d.id, name: d.name || '?', avatar: d.avatar, department: d.department
      })));
      setActiveIdx(0);
    }
  }, [excludeIds.join(','), selectedIds.join(',')]);

  useEffect(() => {
    if (!isOpen) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(inputValue), 250);
    return () => clearTimeout(debounceRef.current);
  }, [inputValue, isOpen, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setInputValue('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addPerson = (person: PersonOption) => {
    const newIds = singleSelect ? [person.id] : [...selectedIds, person.id];
    onChange(newIds);
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const removePerson = (id: string) => {
    onChange(selectedIds.filter(x => x !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && suggestions[activeIdx]) { e.preventDefault(); addPerson(suggestions[activeIdx]); }
    if (e.key === 'Escape') { setIsOpen(false); setInputValue(''); }
    if (e.key === 'Backspace' && !inputValue && selectedIds.length > 0) {
      removePerson(selectedIds[selectedIds.length - 1]);
    }
  };

  const canAddMore = !singleSelect || selectedIds.length === 0;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
        {icon}{label}
      </label>

      {/* Chips + input container */}
      <div
        onClick={() => { if (canAddMore) { setIsOpen(true); inputRef.current?.focus(); } }}
        className={`flex flex-wrap gap-1.5 min-h-[38px] px-2.5 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-900 transition-all cursor-text
          ${isOpen
            ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
      >
        {/* Selected chips */}
        {selectedProfiles.map(p => (
          <span
            key={p.id}
            className="flex items-center gap-1.5 pl-0.5 pr-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm flex-shrink-0 group"
          >
            <Avatar person={p} size={18} />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[90px]">{p.name}</span>
            <button
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); removePerson(p.id); }}
              className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
            >
              <X size={10} />
            </button>
          </span>
        ))}

        {/* Ghost input */}
        {canAddMore && (
          <input
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedIds.length === 0 ? (placeholder || `Tìm ${label.toLowerCase()}...`) : ''}
            className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 py-0.5"
          />
        )}

        {/* Add icon hint */}
        {selectedIds.length === 0 && !isOpen && (
          <div className="ml-auto self-center text-slate-300 dark:text-slate-600 pointer-events-none">
            <UserPlus size={14} />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-[220px] overflow-y-auto">
          {suggestions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500 text-center">
              {inputValue ? 'Không tìm thấy kết quả' : 'Đang tải...'}
            </div>
          ) : (
            suggestions.map((s, idx) => (
              <button
                key={s.id}
                onMouseDown={e => { e.preventDefault(); addPerson(s); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer
                  ${idx === activeIdx
                    ? 'bg-indigo-50 dark:bg-indigo-900/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
              >
                <Avatar person={s} size={26} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{s.name}</div>
                  {s.department && <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{s.department}</div>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default MentionPeopleInput;
