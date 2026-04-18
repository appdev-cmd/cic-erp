import React, { useState, useEffect, useRef } from 'react';
import { X, Link2, AtSign } from 'lucide-react';
import { EntityRegistryService } from '../../services/entityRegistryService';
import { EntitySearchService } from '../../services/entitySearchService';
import type { EntityRegistryItem } from '../../types/taskTypes';
import { dataClient } from '../../lib/dataClient';

export interface LinkedEntity {
  entityType: string;
  entityId: string;
  label: string;
  typeLabel?: string;
  color?: string;
}

interface MentionLinksInputProps {
  links: LinkedEntity[];
  onChange: (links: LinkedEntity[]) => void;
  disabled?: boolean;
  primaryLink?: LinkedEntity | null;
  profile?: any;
}

interface SearchResult {
  id: string;
  name: string;
  subText?: string;
  entityType: string;
  typeLabel: string;
  color?: string;
}

// Loại entity hiển thị trong gợi ý
const ENTITY_COLORS: Record<string, string> = {
  contract: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  project:  'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  customer: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  partner:  'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  task:     'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  employee: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
  pakd:     'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
};

const CHIP_COLORS: Record<string, string> = {
  contract: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20',
  project:  'border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20',
  customer: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20',
  partner:  'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20',
  task:     'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
  employee: 'border-pink-200 dark:border-pink-800 bg-pink-50 dark:bg-pink-900/20',
};

const MentionLinksInput: React.FC<MentionLinksInputProps> = ({
  links, onChange, disabled, primaryLink, profile
}) => {
  const [inputValue, setInputValue]     = useState('');
  const [isOpen, setIsOpen]             = useState(false);
  const [results, setResults]           = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx]       = useState(0);
  const [loading, setLoading]           = useState(false);
  const [resolvedPrimaryLabel, setResolvedPrimaryLabel] = useState(primaryLink?.label || '');
  const [registeredTypes, setRegisteredTypes] = useState<EntityRegistryItem[]>([]);

  const inputRef      = useRef<HTMLInputElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load entity types từ registry
  useEffect(() => {
    EntityRegistryService.getAll().then(setRegisteredTypes).catch(() => {});
  }, []);

  // Resolve label cho primaryLink
  useEffect(() => {
    if (!primaryLink) return;
    if (primaryLink.label) { setResolvedPrimaryLabel(primaryLink.label); return; }
    EntitySearchService.getLabel(primaryLink.entityType, primaryLink.entityId)
      .then(label => setResolvedPrimaryLabel(label || primaryLink.entityId.slice(0, 8)))
      .catch(() => setResolvedPrimaryLabel(primaryLink.entityId.slice(0, 8)));
  }, [primaryLink?.entityType, primaryLink?.entityId]);

  // Phát hiện @ trong input và search
  useEffect(() => {
    const atIdx = inputValue.lastIndexOf('@');
    if (atIdx === -1) { setIsOpen(false); setResults([]); return; }

    const query = inputValue.slice(atIdx + 1);
    setIsOpen(true);
    setActiveIdx(0);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      if (query.length === 0) {
        // Hiện gợi ý mặc định: top nhân viên + danh sách types
        await loadDefaultSuggestions();
      } else if (query.length === 1) {
        // Chỉ search employee (nhanh, không cần 2+ chars)
        await searchEmployeeOnly(query);
      } else {
        // Full search song song tất cả types
        await searchAll(query);
      }
    }, query.length === 0 ? 0 : 300);

    return () => clearTimeout(debounceRef.current);
  }, [inputValue]);

  // Đóng khi click ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search mặc định khi chỉ gõ @
  const loadDefaultSuggestions = async () => {
    try {
      const [empData] = await Promise.all([
        dataClient.from('employees').select('id, name, department').order('name').limit(5),
      ]);
      const empResults: SearchResult[] = (empData.data || []).map((e: any) => ({
        id: e.id, name: e.name, subText: e.department,
        entityType: 'employee', typeLabel: 'Nhân viên',
      }));

      const typeLabels = Object.fromEntries(registeredTypes.map(t => [t.entity_type, t.label]));
      setResults(empResults.map(r => ({ ...r, typeLabel: typeLabels[r.entityType] || r.typeLabel })));
    } catch {}
    setLoading(false);
  };

  // Search chỉ employee (single char)
  const searchEmployeeOnly = async (query: string) => {
    try {
      const { data } = await dataClient.from('employees')
        .select('id, name, department')
        .ilike('name', `%${query}%`)
        .limit(6);
      const typeLabels = Object.fromEntries(registeredTypes.map(t => [t.entity_type, t.label]));
      const existingIds = new Set([...links.map(l => l.entityId), ...(primaryLink ? [primaryLink.entityId] : [])]);
      setResults((data || []).filter((e: any) => !existingIds.has(e.id)).map((e: any): SearchResult => ({
        id: e.id, name: e.name, subText: e.department,
        entityType: 'employee',
        typeLabel: typeLabels['employee'] || 'Nhân viên',
      })));
    } catch {}
    setLoading(false);
  };

  const searchAll = async (query: string) => {
    try {
      const typeLabels = Object.fromEntries(registeredTypes.map(t => [t.entity_type, t.label]));

      // Chỉ search những loại đã đăng ký + employee (always)
      const typesToSearch = [
        'contract', 'project', 'customer', 'task', 'employee', 'partner', 'pakd'
      ].filter(t => t === 'employee' || registeredTypes.some(r => r.entity_type === t));

      const searchPromises = typesToSearch.map(async (entityType) => {
        if (entityType === 'employee') {
          const { data } = await dataClient.from('employees')
            .select('id, name, department')
            .ilike('name', `%${query}%`)
            .limit(3);
          return (data || []).map((e: any): SearchResult => ({
            id: e.id, name: e.name, subText: e.department,
            entityType: 'employee',
            typeLabel: typeLabels['employee'] || 'Nhân viên',
          }));
        }
        try {
          const res = await EntitySearchService.search(entityType, query, profile);
          return res.slice(0, 3).map((r): SearchResult => ({
            ...r, entityType,
            typeLabel: typeLabels[entityType] || entityType,
          }));
        } catch { return []; }
      });

      const allResults = (await Promise.all(searchPromises)).flat();
      // Filter out already-linked entities
      const existingIds = new Set([
        ...links.map(l => l.entityId),
        ...(primaryLink ? [primaryLink.entityId] : []),
      ]);
      setResults(allResults.filter(r => !existingIds.has(r.id)));
    } catch {}
    setLoading(false);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setResults([]);
    // Xóa phần "@..." khỏi input
    const atIdx = inputValue.lastIndexOf('@');
    if (atIdx !== -1) setInputValue(inputValue.slice(0, atIdx));
    else setInputValue('');
  };

  const addLink = (result: SearchResult) => {
    const newLink: LinkedEntity = {
      entityType: result.entityType,
      entityId: result.id,
      label: result.name,
      typeLabel: result.typeLabel,
      color: result.color,
    };
    onChange([...links, newLink]);
    // Xóa "@query" khỏi input
    const atIdx = inputValue.lastIndexOf('@');
    setInputValue(atIdx !== -1 ? inputValue.slice(0, atIdx) : '');
    setIsOpen(false);
    setResults([]);
    inputRef.current?.focus();
  };

  const removeLink = (idx: number) => onChange(links.filter((_, i) => i !== idx));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIdx]) { e.preventDefault(); addLink(results[activeIdx]); }
    if (e.key === 'Escape') { closeDropdown(); }
    if (e.key === 'Backspace' && !inputValue && links.length > 0) removeLink(links.length - 1);
  };

  /* ── Disabled / read-only mode ── */
  if (disabled) {
    return (
      <div>
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Link2 size={10} /> Liên kết
        </label>
        <div className="flex flex-wrap gap-1.5 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 min-h-[38px] items-center">
          {primaryLink && <LinkChip link={{ ...primaryLink, label: resolvedPrimaryLabel }} locked />}
          {links.map((l, i) => <LinkChip key={i} link={l} locked />)}
          {!primaryLink && links.length === 0 && <span className="text-xs text-slate-400 italic">Không có</span>}
        </div>
      </div>
    );
  }

  /* ── Interactive mode ── */
  return (
    <div className="relative" ref={containerRef}>
      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
        <Link2 size={10} /> Liên kết
      </label>

      {/* Chips + input */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={`flex flex-wrap gap-1.5 min-h-[38px] px-2.5 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-900 transition-all cursor-text
          ${isOpen
            ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
      >
        {primaryLink && <LinkChip link={{ ...primaryLink, label: resolvedPrimaryLabel }} locked />}
        {links.map((link, idx) => (
          <LinkChip key={`${link.entityType}-${link.entityId}`} link={link} onRemove={() => removeLink(idx)} />
        ))}

        <div className="flex items-center gap-1 flex-1 min-w-[140px]">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={links.length === 0 && !primaryLink ? 'Gõ @ để gắn liên kết...' : '@'}
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 py-0.5"
          />
          {links.length === 0 && !primaryLink && !isOpen && (
            <div className="ml-auto self-center text-slate-300 dark:text-slate-600 pointer-events-none">
              <AtSign size={14} />
            </div>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-[60] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-[280px] overflow-y-auto">
          {/* Header hint */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <AtSign size={11} className="text-indigo-400" />
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {inputValue.slice(inputValue.lastIndexOf('@') + 1)
                ? `Kết quả cho "${inputValue.slice(inputValue.lastIndexOf('@') + 1)}"`
                : 'Đề xuất liên kết'}
            </span>
          </div>

          {loading ? (
            <div className="px-4 py-4 text-sm text-slate-400 dark:text-slate-500 text-center">Đang tìm kiếm...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-400 dark:text-slate-500 text-center">
              Không tìm thấy kết quả. Thử gõ thêm từ khoá.
            </div>
          ) : (
            results.map((r, idx) => (
              <button
                key={`${r.entityType}-${r.id}`}
                onMouseDown={e => { e.preventDefault(); addLink(r); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer
                  ${idx === activeIdx
                    ? 'bg-indigo-50 dark:bg-indigo-900/30'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              >
                {/* Type badge */}
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${ENTITY_COLORS[r.entityType] || 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                  {r.typeLabel}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{r.name}</div>
                  {r.subText && <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{r.subText}</div>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/* ── Link Chip ── */
const LinkChip: React.FC<{ link: LinkedEntity; onRemove?: () => void; locked?: boolean }> = ({ link, onRemove, locked }) => {
  const colorCls = CHIP_COLORS[link.entityType] || 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800';
  return (
    <span className={`flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 border rounded-full shadow-sm flex-shrink-0 max-w-[220px] ${colorCls}`}>
      <Link2 size={9} className="text-slate-400 flex-shrink-0" />
      {link.typeLabel && (
        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase flex-shrink-0">{link.typeLabel}</span>
      )}
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{link.label || '...'}</span>
      {!locked && onRemove && (
        <button
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
};

export default MentionLinksInput;
