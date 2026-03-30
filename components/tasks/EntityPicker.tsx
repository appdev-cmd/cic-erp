import React, { useState, useEffect } from 'react';
import SearchableSelect from '../ui/SearchableSelect';
import { useAuth } from '../../contexts/AuthContext';
import { EntitySearchService } from '../../services/entitySearchService';
import { EntityRegistryService } from '../../services/entityRegistryService';
import { Link2, Plus, Edit3, Trash2, X } from 'lucide-react';
import { useOpenEntityPanel } from '../LazyPages';

export type EntityLink = {
  module: string; // 'none', 'project', 'contract', 'customer', 'project_bid'
  entityId: string | null;
  label?: string;
};

interface EntityPickerProps {
  value: EntityLink;
  onChange: (val: EntityLink) => void;
  disabled?: boolean;
}

const EntityPicker: React.FC<EntityPickerProps> = ({ value, onChange, disabled }) => {
  const { profile } = useAuth();
  const openEntityPanel = useOpenEntityPanel();
  const [initialOptions, setInitialOptions] = useState<any[]>([]);
  const [registryOptions, setRegistryOptions] = useState<{ id: string; label: string }[]>([]);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  
  // UI States
  const [isEditing, setIsEditing] = useState(false);
  const [tempModule, setTempModule] = useState<string>('');

  useEffect(() => {
    EntityRegistryService.getAll().then(all => {
      setRegistryOptions([
        { id: 'none', label: '— Không gắn liên kết —' },
        ...all.map(x => ({ id: x.entity_type, label: x.label }))
      ]);
    });
  }, []);
  
  useEffect(() => {
    let active = true;
    const tryLoadLabel = async () => {
      if (!value.entityId || value.module === 'none') {
        if (active) setInitialOptions([]);
        return;
      }
      
      if (value.label) {
        if (active) setInitialOptions([{ id: value.entityId, name: value.label }]);
        return;
      }
      
      try {
        const name = await EntitySearchService.getLabel(value.module, value.entityId);
        if (active) {
          setInitialOptions([{ id: value.entityId, name: name || 'Đã chọn' }]);
        }
      } catch (err) {
        console.error('Failed to load initial entity label:', err);
      }
    };
    tryLoadLabel();

    if (value.module !== 'none' && value.entityId) {
      EntityRegistryService.resolveUrl(value.module, value.entityId).then(u => active && setResolvedUrl(u));
    }
    
    return () => { active = false; };
  }, [value.entityId, value.label, value.module]);

  const handleSearch = async (query: string) => {
    return await EntitySearchService.search(tempModule, query, profile);
  };

  const handleCreateLink = (id: string | null, opt?: {id: string; name: string}) => {
    if (id) {
      onChange({ module: tempModule, entityId: id, label: opt?.name });
      setIsEditing(false);
    }
  };

  // 1. Dạng Card đã gắn liên kết
  if (!isEditing && value.module !== 'none' && value.entityId) {
    return (
      <div className="group relative">
        <a
          href={resolvedUrl || '#'}
          onClick={e => { 
            e.preventDefault(); 
            if (value.module !== 'none' && value.entityId) {
              openEntityPanel(value.module, value.entityId);
            } else if (resolvedUrl) { 
              window.location.href = resolvedUrl; 
            }
          }}
          className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900 flex items-center justify-center flex-shrink-0">
            <Link2 size={16} className="text-indigo-500 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0 pr-14">
             <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
               {value.label || initialOptions[0]?.name || 'Đang tải...'}
             </div>
             <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
               <span className="capitalize">{registryOptions.find(o => o.id === value.module)?.label || value.module}</span>
               <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
               <span className="truncate opacity-70">ID: {value.entityId}</span>
             </div>
          </div>
        </a>
        
        {/* Actions inside the card on hover */}
        {!disabled && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 pl-2 rounded-l-xl">
            <button
               onClick={(e) => { e.preventDefault(); setTempModule(value.module); setIsEditing(true); }}
               className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-md transition-colors"
               title="Sửa liên kết"
            >
              <Edit3 size={14} />
            </button>
            <button
               onClick={(e) => { e.preventDefault(); onChange({ module: 'none', entityId: null, label: undefined }); }}
               className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-md transition-colors"
               title="Xóa liên kết"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // 2. Form thêm/sửa liên kết đang hiển thị
  if (isEditing) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="flex justify-between items-center mb-1">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {value.module === 'none' ? 'Tạo liên kết chính' : 'Đổi liên kết chính'}
          </label>
          <button 
            onClick={() => setIsEditing(false)} 
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Loại liên kết</label>
            <select
              value={tempModule}
              onChange={(e) => {
                setTempModule(e.target.value);
                if (e.target.value === 'none') {
                  onChange({ module: 'none', entityId: null, label: undefined });
                  setIsEditing(false);
                }
              }}
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:border-indigo-500 font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="" disabled>-- Chọn module --</option>
              {registryOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>

          {tempModule && tempModule !== 'none' && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Tìm kiếm</label>
              <SearchableSelect
                value={null}
                onChange={handleCreateLink}
                onSearch={handleSearch}
                placeholder="Gõ để tìm..."
                size="sm"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Trạng thái rỗng (Nút thêm mới)
  return (
    <button 
      onClick={() => setIsEditing(true)} 
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:text-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Plus size={16} /> Gắn liên kết chính
    </button>
  );
};

export default EntityPicker;
