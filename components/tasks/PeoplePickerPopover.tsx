// PeoplePickerPopover — Search & assign people to task roles
import React, { useState, useEffect, useRef } from 'react';
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
}

const PeoplePickerPopover: React.FC<PeoplePickerPopoverProps> = ({
  currentIds,
  onChange,
  onClose,
  align = 'right',
  minSelections = 0,
  inline = false,
}) => {
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [verticalPos, setVerticalPos] = useState<'top' | 'bottom'>('bottom');
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  // Load all profiles once
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await dataClient
        .from('profiles')
        .select('id, full_name, avatar_url, employee_id')
        .order('full_name', { ascending: true });

      if (data) {
        // Enrich with employee position
        const empIds = data.map((p: any) => p.employee_id).filter(Boolean);
        let posMap = new Map<string, string>();
        if (empIds.length > 0) {
          const { data: employees } = await dataClient
            .from('employees')
            .select('id, position')
            .in('id', empIds);
          if (employees) {
            posMap = new Map(employees.map((e: any) => [e.id, e.position]));
          }
        }

        setProfiles(data.map((p: any) => ({
          id: p.id,
          full_name: p.full_name || p.id.substring(0, 8),
          avatar_url: p.avatar_url,
          position: p.employee_id ? posMap.get(p.employee_id) : undefined,
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

  // Check position after render
  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const isOffBottom = rect.bottom > window.innerHeight - 20;
      if (isOffBottom) {
        setVerticalPos('top');
      }
    }
  }, [filtered.length]);

  const togglePerson = (id: string) => {
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

  return (
    <div
      ref={ref}
      className={`${inline ? 'mt-2 w-full relative' : `absolute ${align === 'right' ? 'right-0' : 'left-0'} ${verticalPos === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1'} z-50 w-72`} bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden`}
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
      <div className="max-h-56 overflow-y-auto">
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
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
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
};

export default PeoplePickerPopover;
