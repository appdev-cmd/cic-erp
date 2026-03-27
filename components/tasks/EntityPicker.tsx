import React, { useState, useEffect } from 'react';
import { dataClient } from '../../lib/dataClient';
import SearchableSelect from '../ui/SearchableSelect';

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

const MODULE_OPTIONS = [
  { id: 'none', label: '— Không gắn liên kết —' },
  { id: 'project', label: 'Dự án' },
  { id: 'contract', label: 'Hợp đồng' },
  { id: 'customer', label: 'Khách hàng' },
  { id: 'project_bid', label: 'Gói thầu/Cơ hội' },
];

const EntityPicker: React.FC<EntityPickerProps> = ({ value, onChange, disabled }) => {
  const [initialOptions, setInitialOptions] = useState<any[]>([]);
  
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
        let tableName = '';
        let nameCol = '';
        
        if (value.module === 'project') { tableName = 'projects'; nameCol = 'name'; }
        else if (value.module === 'contract') { tableName = 'contracts'; nameCol = 'title'; }
        else if (value.module === 'customer') { tableName = 'customers'; nameCol = 'name'; }
        else if (value.module === 'project_bid') { tableName = 'project_bids'; nameCol = 'name'; }
        
        if (tableName) {
           const { data } = await dataClient.from(tableName).select('*').eq('id', value.entityId).single();
           if (data && active) {
              let itemName = data[nameCol];
              if (tableName === 'project_bids' && !itemName) itemName = data.title;
              if (tableName === 'contracts' && data.contractCode) itemName = `${data.contractCode} - ${itemName}`;
              if (tableName === 'customers' && data.code) itemName = `${data.code} - ${itemName}`;
              if (tableName === 'project_bids' && data.code) itemName = `${data.code} - ${itemName}`;
              
              setInitialOptions([{ id: value.entityId, name: itemName || 'Đã chọn' }]);
           }
        }
      } catch (err) {
        console.error('Failed to load initial entity label:', err);
      }
    };
    
    tryLoadLabel();
    return () => { active = false; };
  }, [value.entityId, value.label, value.module]);

  const handleSearch = async (query: string) => {
    if (!query || query.length < 2) return [];
    
    let tableName = '';
    let searchCols = '';
    let nameCol = '';
    let subtextCol = '';
    
    if (value.module === 'project') {
       tableName = 'projects';
       searchCols = 'name';
       nameCol = 'name';
       subtextCol = '';
    } else if (value.module === 'contract') {
       tableName = 'contracts';
       searchCols = 'contractCode,title';
       nameCol = 'title';
       subtextCol = 'contractCode';
    } else if (value.module === 'customer') {
       tableName = 'customers';
       searchCols = 'name,code';
       nameCol = 'name';
       subtextCol = 'code';
    } else if (value.module === 'project_bid') {
       tableName = 'project_bids';
       searchCols = 'name,code';
       nameCol = 'name';
       subtextCol = 'code';
    }

    if (!tableName) return [];
    
    try {
      let qObj = dataClient.from(tableName).select('*').limit(20);
      
      const cols = searchCols.split(',');
      const orString = cols.map(c => `${c}.ilike.%${query}%`).join(',');
      qObj = qObj.or(orString);
      
      const { data, error } = await qObj;
      if (error) throw error;
      
      if (data) {
         return data.map((item: any) => {
           let itemName = item[nameCol];
           if (tableName === 'project_bids' && !itemName) itemName = item.title; // fallback
           if (!itemName) itemName = 'Chưa có tên';
           
           return {
             id: item.id,
             name: itemName,
             subText: subtextCol && item[subtextCol] ? item[subtextCol] : undefined
           };
         });
      }
      return [];
    } catch (err) {
      console.error('Search error in EntityPicker:', err);
      return [];
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 col-span-2">
      <div>
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">
          Gắn với
        </label>
        <select
          value={value.module}
          onChange={(e) => onChange({ module: e.target.value, entityId: null, label: undefined })}
          disabled={disabled}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60"
        >
          {MODULE_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block whitespace-nowrap overflow-hidden text-ellipsis">
          {value.module !== 'none' 
            ? `Chọn ${MODULE_OPTIONS.find(o => o.id === value.module)?.label?.toLowerCase()}`
            : 'Chọn'
          }
        </label>
        
        {value.module !== 'none' ? (
          <SearchableSelect
            value={value.entityId}
            onChange={(id, opt) => onChange({ module: value.module, entityId: id, label: opt?.name })}
            onSearch={handleSearch}
            placeholder={`Gõ để tìm...`}
            disabled={disabled}
            initialOptions={initialOptions}
          />
        ) : (
          <div className="w-full flex items-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-400 opacity-60 cursor-not-allowed border-dashed">
            Không yêu cầu liên kết
          </div>
        )}
      </div>
    </div>
  );
};

export default EntityPicker;
