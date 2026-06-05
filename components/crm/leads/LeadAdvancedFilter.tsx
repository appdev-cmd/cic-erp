import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Pin, Plus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import MultiSelectCheckbox from '../../ui/MultiSelectCheckbox';
import SearchableSelect from '../../ui/SearchableSelect';
import DateInput from '../../ui/DateInput';
import { EmployeeService } from '../../../services/employeeService';

interface FilterState {
  preset: string;
  source: string[];
  status: string[];
  communication: string[];
  createdOn: string;
  createdOnStart?: string;
  createdOnEnd?: string;
  responsiblePerson: string;
  activities: string;
  clientPath: string;
  searchQuery: string;
  region: string[];
  scoreMin: string;
  scoreMax: string;
}

interface LeadAdvancedFilterProps {
  onFilterChange: (filters: FilterState) => void;
  className?: string;
}

export const LeadAdvancedFilter: React.FC<LeadAdvancedFilterProps> = ({ onFilterChange, className = '' }) => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  
  const [filters, setFilters] = useState<FilterState>({
    preset: 'ALL IN PROGRESS',
    source: [],
    status: [],
    communication: [],
    createdOn: 'Any date',
    createdOnStart: '',
    createdOnEnd: '',
    responsiblePerson: '',
    activities: '',
    clientPath: '',
    searchQuery: '',
    region: [],
    scoreMin: '',
    scoreMax: '',
  });

  const presets = [
    { id: 'MY LEADS IN PROGRESS', label: 'LEAD CỦA TÔI ĐANG XỬ LÝ' },
    { id: 'ALL CLOSED', label: 'TẤT CẢ ĐÃ ĐÓNG' },
    { id: 'ALL IN PROGRESS', label: 'TẤT CẢ ĐANG XỬ LÝ', isPinned: true },
  ];

  const regionOptions = [
    { id: 'north', label: 'Miền Bắc' },
    { id: 'central', label: 'Miền Trung' },
    { id: 'south', label: 'Miền Nam' },
    { id: 'unknown', label: 'Chưa xác định' },
  ];

  const sourceOptions = [
    { id: 'phone', label: 'Gọi điện thoại' },
    { id: 'email', label: 'E-Mail' },
    { id: 'website', label: 'Website' },
    { id: 'ads', label: 'Quảng cáo' },
    { id: 'returning_customer', label: 'Khách hàng cũ' },
  ];

  const statusOptions = [
    { id: 'Mới', label: 'Mới' },
    { id: 'Đang xử lý', label: 'Đang xử lý' },
    { id: 'Tiềm năng cao', label: 'Tiềm năng cao' },
    { id: 'Không tiềm năng', label: 'Không tiềm năng' },
  ];

  const communicationOptions = [
    { id: 'email', label: 'Email' },
    { id: 'phone', label: 'Điện thoại' },
  ];

  const searchUsers = async (q: string) => {
    try {
      const res = await EmployeeService.list({ search: q, pageSize: 10 });
      return res.data.map(emp => ({ id: emp.id, name: emp.name }));
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Prevent closing if clicking inside a dropdown rendered via portal
      if ((event.target as Element).closest('[data-portal-dropdown="true"]')) {
        return;
      }
      
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApply = () => {
    onFilterChange(filters);
    setIsOpen(false);
  };

  const handleReset = () => {
    const defaultFilters = {
      ...filters,
      source: [],
      status: [],
      communication: [],
      createdOn: 'Any date',
      createdOnStart: '',
      createdOnEnd: '',
      responsiblePerson: '',
      activities: '',
      clientPath: '',
      searchQuery: '',
      region: [],
      scoreMin: '',
      scoreMax: '',
    };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  };

  const handleRemoveToken = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newFilters = { ...filters, preset: '' };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const renderSummaryToken = (fieldKey: keyof FilterState, options: { id: string, label: string }[]) => {
    const selectedIds = filters[fieldKey] as string[];
    if (!selectedIds || selectedIds.length === 0) return null;
    
    const labels = options
      .filter(opt => selectedIds.includes(opt.id))
      .map(opt => opt.label);
      
    let displayStr = labels.join(', ');
    if (displayStr.length > 25) {
      displayStr = displayStr.substring(0, 25) + '...';
    }

    return (
      <div key={fieldKey} className="flex items-center gap-1 px-2 py-1 bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300 text-sm rounded max-w-[200px]">
        <span className="truncate">{displayStr}</span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            const newFilters = { ...filters, [fieldKey]: [] };
            setFilters(newFilters);
            onFilterChange(newFilters);
          }}
          className="hover:text-sky-900 dark:hover:text-sky-200 p-0.5 shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className={`relative w-full min-w-[300px] md:min-w-[500px] lg:min-w-[700px] ${className}`} ref={filterRef}>
      {/* Search Input Bar */}
      <div 
        className="flex items-center min-h-[42px] px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-sm cursor-text hover:border-sky-400 dark:hover:border-sky-500 transition-colors"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {filters.preset && (
            <div className="flex items-center gap-1 px-2 py-1 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 text-sm rounded">
              <span>{presets.find(p => p.id === filters.preset)?.label || filters.preset}</span>
              <button 
                onClick={handleRemoveToken}
                className="hover:text-sky-900 dark:hover:text-sky-300 p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          )}
          
          {renderSummaryToken('source', sourceOptions)}
          {renderSummaryToken('status', statusOptions)}
          {renderSummaryToken('communication', communicationOptions)}
          {renderSummaryToken('region', regionOptions)}

          {(filters.scoreMin || filters.scoreMax) && (
            <div className="flex items-center gap-1 px-2 py-1 bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300 text-sm rounded max-w-[200px]">
              <span className="truncate">Score: {filters.scoreMin || '0'}-{filters.scoreMax || '100'}</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const newFilters = { ...filters, scoreMin: '', scoreMax: '' };
                  setFilters(newFilters);
                  onFilterChange(newFilters);
                }}
                className="hover:text-sky-900 dark:hover:text-sky-200 p-0.5 shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center min-w-[120px] flex-1">
            <span className="text-slate-500 dark:text-slate-400 mr-2 text-sm">+ tìm kiếm</span>
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApply();
              }}
              className="flex-1 bg-transparent border-none focus:outline-none text-slate-900 dark:text-slate-100 text-sm w-full"
              placeholder=""
            />
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 text-slate-500 dark:text-slate-400">
          <Search size={16} />
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setFilters(prev => ({ ...prev, searchQuery: '', preset: '' }));
              onFilterChange({ ...filters, searchQuery: '', preset: '' });
            }}
            className="hover:text-slate-700 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-[90vw] max-w-[900px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-b-md z-50 flex flex-col md:flex-row overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Left Sidebar - Presets */}
          <div className="w-full md:w-64 shrink-0 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              BỘ LỌC
            </div>
            <div className="flex-1 overflow-y-auto">
              {presets.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setFilters(prev => ({ ...prev, preset: preset.id }))}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors
                    ${filters.preset === preset.id 
                      ? 'bg-white dark:bg-slate-900 border-l-2 border-sky-500 text-sky-600 dark:text-sky-400 font-medium shadow-sm' 
                      : 'border-l-2 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                  <span>{preset.label}</span>
                  {preset.isPinned && <Pin size={14} className="text-slate-400 dark:text-slate-500" fill="currentColor" />}
                </button>
              ))}
            </div>
          </div>

          {/* Right Panel - Form Fields */}
          <div className="flex-1 p-6 flex flex-col bg-white dark:bg-slate-900 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {/* Field: Source */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Nguồn</label>
                <MultiSelectCheckbox
                  options={sourceOptions}
                  selectedIds={filters.source}
                  onChange={(selectedIds) => setFilters(prev => ({ ...prev, source: selectedIds }))}
                  placeholder=""
                />
              </div>

              {/* Field: Status */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Trạng thái</label>
                <MultiSelectCheckbox
                  options={statusOptions}
                  selectedIds={filters.status}
                  onChange={(selectedIds) => setFilters(prev => ({ ...prev, status: selectedIds }))}
                  placeholder=""
                />
              </div>

              {/* Field: Communication */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Kênh giao tiếp</label>
                <MultiSelectCheckbox
                  options={communicationOptions}
                  selectedIds={filters.communication}
                  onChange={(selectedIds) => setFilters(prev => ({ ...prev, communication: selectedIds }))}
                  placeholder=""
                />
              </div>

              {/* Field: Created on */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Ngày tạo</label>
                <select 
                  className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500 dark:focus:border-sky-500"
                  value={filters.createdOn}
                  onChange={e => setFilters(prev => ({ ...prev, createdOn: e.target.value }))}
                >
                  <option value="Any date">Bất kỳ lúc nào</option>
                  <option value="Yesterday">Hôm qua</option>
                  <option value="Current day">Hôm nay</option>
                  <option value="Tomorrow">Ngày mai</option>
                  <option value="This week">Tuần này</option>
                  <option value="This month">Tháng này</option>
                  <option value="Current quarter">Quý này</option>
                  <option value="Last 7 days">7 ngày qua</option>
                  <option value="Last 30 days">30 ngày qua</option>
                  <option value="Last 60 days">60 ngày qua</option>
                  <option value="Last 90 days">90 ngày qua</option>
                  <option value="Custom">Khoảng thời gian...</option>
                </select>
                {filters.createdOn === 'Custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1">
                      <DateInput 
                        value={filters.createdOnStart || ''} 
                        onChange={val => setFilters(prev => ({ ...prev, createdOnStart: val }))} 
                        className="w-full p-1.5 px-3 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                        placeholder="Từ ngày"
                      />
                    </div>
                    <span className="text-slate-400">-</span>
                    <div className="flex-1">
                      <DateInput 
                        value={filters.createdOnEnd || ''} 
                        onChange={val => setFilters(prev => ({ ...prev, createdOnEnd: val }))} 
                        className="w-full p-1.5 px-3 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                        placeholder="Đến ngày"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Field: Responsible person */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Người phụ trách</label>
                <SearchableSelect
                  value={filters.responsiblePerson}
                  onChange={(id) => setFilters(prev => ({ ...prev, responsiblePerson: id || '' }))}
                  onSearch={searchUsers}
                  initialOptions={[]}
                  placeholder="Nhập tên nhân viên..."
                />
              </div>

              {/* Field: Region */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Vùng miền</label>
                <MultiSelectCheckbox
                  options={regionOptions}
                  selectedIds={filters.region}
                  onChange={(selectedIds) => setFilters(prev => ({ ...prev, region: selectedIds }))}
                  placeholder=""
                />
              </div>

              {/* Field: Score Range */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Điểm số (Score)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={filters.scoreMin}
                    onChange={(e) => setFilters(prev => ({ ...prev, scoreMin: e.target.value }))}
                    className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                    placeholder="Min"
                    min={0}
                    max={100}
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="number"
                    value={filters.scoreMax}
                    onChange={(e) => setFilters(prev => ({ ...prev, scoreMax: e.target.value }))}
                    className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                    placeholder="Max"
                    min={0}
                    max={100}
                  />
                </div>
              </div>
            </div>

            {/* Link Options */}
            <div className="flex items-center gap-4 mt-6 text-sm">
              <button className="text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 font-medium">Thêm trường</button>
              <button className="text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300">Khôi phục mặc định</button>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button 
                onClick={handleApply}
                className="px-6 py-2 bg-sky-400 hover:bg-sky-500 text-white text-sm font-medium rounded transition-colors"
              >
                TÌM KIẾM
              </button>
              <button 
                onClick={handleReset}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded transition-colors border border-slate-200 dark:border-slate-700"
              >
                LÀM MỚI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
