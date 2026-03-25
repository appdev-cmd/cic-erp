import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Hash, Plus, Loader2 } from 'lucide-react';
import { ContractTagService, normalizeTag } from '../../services/contractTagService';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

interface ContractTagsWidgetProps {
  contractId: string;
}

const ContractTagsWidget: React.FC<ContractTagsWidgetProps> = ({ contractId }) => {
  const { profile } = useAuth();
  const userId = profile?.id;

  const [tags, setTags] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allUserTags, setAllUserTags] = useState<string[]>([]);
  const [focusedSuggestion, setFocusedSuggestion] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load tags for this contract
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    ContractTagService.getTagsForContract(userId, contractId)
      .then(data => { if (mounted) setTags(data); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [contractId, userId]);

  // Load all user tags for autocomplete (once)
  useEffect(() => {
    if (!userId) return;
    ContractTagService.getAllUserTags(userId)
      .then(setAllUserTags)
      .catch(() => {});
  }, [userId]);

  // Filter suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (!input.trim()) return [];
    const normalized = normalizeTag(input);
    return allUserTags
      .filter(t => t.includes(normalized) && !tags.includes(t))
      .slice(0, 6);
  }, [input, allUserTags, tags]);

  useEffect(() => {
    setSuggestions(filteredSuggestions);
    setFocusedSuggestion(-1);
  }, [filteredSuggestions]);

  const handleAdd = useCallback(async (rawTag?: string) => {
    if (!userId) { toast.error('Chưa đăng nhập'); return; }
    const tagToAdd = rawTag || input;
    const normalized = normalizeTag(tagToAdd);
    if (!normalized) return;
    if (tags.includes(normalized)) {
      toast.info(`Tag #${normalized} đã tồn tại`);
      setInput('');
      return;
    }

    setAdding(true);
    try {
      const ok = await ContractTagService.addTag(userId, contractId, normalized);
      if (ok) {
        setTags(prev => [...prev, normalized]);
        if (!allUserTags.includes(normalized)) {
          setAllUserTags(prev => [...prev, normalized].sort());
        }
        setInput('');
        // Notify ContractList to refresh inline tags
        window.dispatchEvent(new CustomEvent('contract-tags-changed', { detail: { contractId } }));
      } else {
        toast.error('Không thể thêm tag');
      }
    } catch (err) {
      console.error('[ContractTagsWidget] addTag error:', err);
      toast.error('Lỗi khi thêm tag');
    } finally {
      setAdding(false);
      inputRef.current?.focus();
    }
  }, [contractId, input, tags, allUserTags, userId]);

  const handleRemove = useCallback(async (tag: string) => {
    if (!userId) return;
    try {
      const ok = await ContractTagService.removeTag(userId, contractId, tag);
      if (ok) {
        setTags(prev => prev.filter(t => t !== tag));
        window.dispatchEvent(new CustomEvent('contract-tags-changed', { detail: { contractId } }));
      } else {
        toast.error('Không thể xóa tag');
      }
    } catch {
      toast.error('Lỗi khi xóa tag');
    }
  }, [contractId, userId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedSuggestion >= 0 && suggestions[focusedSuggestion]) {
        handleAdd(suggestions[focusedSuggestion]);
      } else {
        handleAdd();
      }
    } else if (e.key === 'Escape') {
      setShowInput(false);
      setInput('');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSuggestion(prev => Math.max(prev - 1, -1));
    }
  };

  // Tag pill colors — cycle through a palette
  const TAG_COLORS = [
    { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800', hover: 'hover:bg-indigo-100 dark:hover:bg-indigo-900/40' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/40' },
    { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', hover: 'hover:bg-amber-100 dark:hover:bg-amber-900/40' },
    { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800', hover: 'hover:bg-rose-100 dark:hover:bg-rose-900/40' },
    { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800', hover: 'hover:bg-purple-100 dark:hover:bg-purple-900/40' },
    { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800', hover: 'hover:bg-cyan-100 dark:hover:bg-cyan-900/40' },
    { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', hover: 'hover:bg-orange-100 dark:hover:bg-orange-900/40' },
  ];

  const getTagColor = (tag: string) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
  };

  if (!userId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
        <Loader2 size={12} className="animate-spin" />
        <span>Đang tải tags...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Tag pills */}
      {tags.map(tag => {
        const color = getTagColor(tag);
        return (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${color.bg} ${color.text} ${color.border} ${color.hover} group`}
          >
            <Hash size={10} className="opacity-60" />
            {tag}
            <button
              onClick={(e) => { e.stopPropagation(); handleRemove(tag); }}
              className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
              title={`Xóa tag #${tag}`}
            >
              <X size={10} />
            </button>
          </span>
        );
      })}

      {/* Add tag button / input */}
      {showInput ? (
        <div className="relative">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-full pl-2 pr-1 py-0.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 transition-all">
            <Hash size={11} className="text-slate-400 dark:text-slate-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value.replace(/\s/g, '_'))}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                setTimeout(() => {
                  if (!input.trim()) setShowInput(false);
                }, 200);
              }}
              placeholder="Nhập tag..."
              className="bg-transparent outline-none text-[11px] font-medium text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 w-24"
              autoFocus
              maxLength={50}
              disabled={adding}
            />
            {adding && <Loader2 size={12} className="animate-spin text-indigo-500" />}
          </div>

          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 py-1 min-w-[120px]"
            >
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  onMouseDown={(e) => { e.preventDefault(); handleAdd(s); }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                    i === focusedSuggestion
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="opacity-50">#</span>{s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold text-slate-400 dark:text-slate-500 border border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer"
          title="Thêm tag cá nhân"
        >
          <Plus size={10} />
          Tag
        </button>
      )}
    </div>
  );
};

export default ContractTagsWidget;
