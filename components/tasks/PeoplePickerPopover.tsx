// PeoplePickerPopover — Search & assign people to task roles
// Uses a React Portal to avoid parent overflow clipping
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check } from 'lucide-react';
import { dataClient } from '../../lib/dataClient';

interface ProfileOption {
  id: string;
  full_name: string;
  avatar_url?: string;
  position?: string;
}

interface PeoplePickerPopoverProps {
  /** IDs already selected for this role */
  currentIds: string[];
  /** Callback when selection changes */
  onChange: (newIds: string[]) => void;
  /** Close the popover */
  onClose: () => void;
  /** Alignment of the popover relative to its container. Default is 'right'. */
  align?: 'left' | 'right';
  /** Minimum number of selections allowed. Prevents unchecking the last N items. */
  minSelections?: number;
  /** Whether to render inline instead of absolute positioned (prevents clipping in overflow containers) */
  inline?: boolean;
  /** Single-select mode: clicking a person replaces selection and auto-closes */
  singleSelect?: boolean;
}

const PeoplePickerPopover: React.FC<PeoplePickerPopoverProps> = ({
  currentIds,
  onChange,
  onClose,
  align = 'right',
  minSelections = 0,
  inline = false,
  singleSelect = false,
}) => {
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  // Click outside to close (only for standalone mode)
  useEffect(() => {
    if (inline) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose, inline]);

  // Load all employees (full company directory)
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await dataClient
        .from('employees')
        .select('id, name, avatar, position')
        .order('name', { ascending: true });

      if (data) {
        setProfiles(data.map((e: any) => ({
          id: e.id,
          full_name: e.name || e.id.substring(0, 8),
          avatar_url: e.avatar,
          position: e.position || undefined,
        })));
      }
      setLoading(false);
    })();
  }, []);

  // Filter by search
  const filtered = profiles.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.position || '').toLowerCase().includes(search.toLowerCase())
  );

  // Calculate position for portal-based rendering
  const updatePosition = useCallback(() => {
    if (inline || !anchorRef.current) return;
    const anchorRect = anchorRef.current.getBoundingClientRect();
    const popoverWidth = 400; // w-[400px]
    const popoverMaxHeight = 440; // max-h-96 + search bar
    const margin = 4;
    const edgePadding = 8;

    // Vertical: prefer below, flip to above if not enough space
    const spaceBelow = window.innerHeight - anchorRect.bottom - margin;
    const spaceAbove = anchorRect.top - margin;
    const goUp = spaceBelow < popoverMaxHeight && spaceAbove > spaceBelow;

    // Horizontal: try to align to start of anchor, clamp to viewport
    let left: number;
    if (align === 'right') {
      // Align right edge of popover to right edge of anchor
      left = anchorRect.right - popoverWidth;
    } else {
      // Align left edge of popover to left edge of anchor
      left = anchorRect.left;
    }

    // Clamp to viewport
    if (left + popoverWidth > window.innerWidth - edgePadding) {
      left = window.innerWidth - popoverWidth - edgePadding;
    }
    if (left < edgePadding) {
      left = edgePadding;
    }

    setPopoverStyle({
      position: 'fixed',
      top: goUp ? undefined : anchorRect.bottom + margin,
      bottom: goUp ? window.innerHeight - anchorRect.top + margin : undefined,
      left,
      width: popoverWidth,
      zIndex: 9999,
    });
  }, [align, inline]);

  useEffect(() => {
    updatePosition();
  }, [updatePosition, filtered.length]);

  // Reposition on scroll / resize
  useEffect(() => {
    if (inline) return;
    const handleScrollResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollResize, true);
    window.addEventListener('resize', handleScrollResize);
    return () => {
      window.removeEventListener('scroll', handleScrollResize, true);
      window.removeEventListener('resize', handleScrollResize);
    };
  }, [inline, updatePosition]);

  const togglePerson = (id: string) => {
    if (singleSelect) {
      // Single-select: replace and close
      onChange([id]);
      onClose();
      return;
    }
    if (currentIds.includes(id)) {
      if (currentIds.length <= minSelections) {
        alert(`Bắt buộc phải chọn ít nhất ${minSelections} người`);
        return;
      }
      onChange(currentIds.filter(x => x !== id));
    } else {
      onChange([...currentIds, id]);
    }
  };

  const popoverContent = (
    <div
      ref={ref}
      className={`${inline ? 'mt-2 w-full relative' : ''} bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden`}
      style={inline ? undefined : popoverStyle}
    >
      {/* Search input */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700">
          <Search size={14} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm..."
            className="flex-1 text-sm bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Profile list */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-4 text-sm text-slate-400 dark:text-slate-500">
            Không tìm thấy
          </div>
        ) : (
          filtered.map(p => {
            const selected = currentIds.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePerson(p.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer ${
                  selected
                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : p.full_name.charAt(0).toUpperCase()}
                </div>

                {/* Name + position */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{p.full_name}</div>
                  {p.position && <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{p.position}</div>}
                </div>

                {/* Check icon */}
                {selected && <Check size={14} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // For inline mode, render directly without portal
  if (inline) {
    return popoverContent;
  }

  // For non-inline, render an invisible anchor + portal
  return (
    <>
      <div ref={anchorRef} className="absolute top-full left-0 w-0 h-0" />
      {createPortal(popoverContent, document.body)}
    </>
  );
};

export default PeoplePickerPopover;
