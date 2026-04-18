import React, { useState, useEffect, useCallback } from 'react';
import { Crown, Edit3, Trash2, X, Plus, Link2, ShieldAlert, ArrowRight, ChevronsRight, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { TaskService } from '../../../services/taskService';
import { EntityRegistryService } from '../../../services/entityRegistryService';
import { EntitySearchService } from '../../../services/entitySearchService';
import SearchableSelect from '../../ui/SearchableSelect';
import { LinkItem } from '../TaskDetailSubComponents';
import type { Task, TaskLink, TaskDependencyType } from '../../../types/taskTypes';

const DEPENDENCY_OPTIONS: { value: TaskDependencyType; label: string; color: string }[] = [
  { value: 'related',          label: 'Liên quan',        color: 'text-slate-500 dark:text-slate-400' },
  { value: 'blocks',           label: 'Chặn',             color: 'text-rose-600 dark:text-rose-400' },
  { value: 'blocked_by',       label: 'Bị chặn bởi',      color: 'text-orange-600 dark:text-orange-400' },
  { value: 'duplicates',       label: 'Trùng lặp',        color: 'text-violet-600 dark:text-violet-400' },
  { value: 'is_duplicated_by', label: 'Bị trùng lặp bởi', color: 'text-violet-500 dark:text-violet-300' },
];

interface TaskLinksTabProps {
  task: Task;
  links: TaskLink[];
  setLinks: React.Dispatch<React.SetStateAction<TaskLink[]>>;
  profile: any;
  bufferChange: (field: string, value: any) => void;
}

export const TaskLinksTab: React.FC<TaskLinksTabProps> = ({ task, links, setLinks, profile, bufferChange }) => {
  // Add Link state
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [selectedLinkType, setSelectedLinkType] = useState<string>('');
  const [selectedDepType, setSelectedDepType] = useState<TaskDependencyType>('related');
  const [registryOptions, setRegistryOptions] = useState<{id: string; name: string}[]>([]);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  // Primary Link
  const [isEditingPrimary, setIsEditingPrimary] = useState<boolean>(false);
  const [primaryLinkType, setPrimaryLinkType] = useState<string>('');

  useEffect(() => {
    if (registryOptions.length === 0) {
      EntityRegistryService.getAll().then(all => setRegistryOptions(all.map(x => ({ id: x.entity_type, name: x.label }))));
    }
  }, [registryOptions.length]);

  const searchEntity = useCallback(async (query: string) => {
    if (!selectedLinkType || query.length < 2) return [];
    try {
      return await EntitySearchService.search(selectedLinkType, query, profile);
    } catch (err) {
      console.error('searchEntity error:', err);
      return [];
    }
  }, [selectedLinkType, profile]);

  const handleCreateLink = async (entityId: string | null, option?: {id: string; name: string}) => {
    if (!task || !selectedLinkType || !entityId) return;
    try {
      const newLink = await TaskService.addLink({
        task_id: task.id,
        entity_type: selectedLinkType,
        entity_id: entityId,
        entity_label: option?.name,
        dependency_type: selectedDepType,
      } as any);
      setLinks(prev => [...prev, Object.assign({}, newLink, { entity_type: selectedLinkType, dependency_type: selectedDepType })]);
      setIsAddingLink(false);
      setSelectedLinkType('');
      setSelectedDepType('related');
      toast.success('Đã thêm liên kết');
    } catch (e: any) {
      toast.error('Lỗi thêm liên kết: ' + e.message);
    }
  };

  return (
    <div className="p-5 space-y-4">
      {/* Primary Entity Link */}
      <div className="mb-6">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Crown size={12} className="text-amber-500" />
          Liên kết chính
        </label>
        {(task.source_module || task.project_id) && !isEditingPrimary ? (
          <div className="group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all overflow-hidden shadow-sm">
            <LinkItem 
              link={{
                id: 'primary',
                task_id: task.id,
                entity_type: task.source_module || (task.project_id ? 'project' : 'none'),
                entity_id: task.source_entity_id || task.project_id || '',
                entity_label: '', // will be resolved inside LinkItem
              } as TaskLink} 
              registryOptions={registryOptions} 
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 pl-2 rounded-l-xl">
              <button
                onClick={() => { 
                  setPrimaryLinkType(task.source_module || (task.project_id ? 'project' : 'none')); 
                  setIsEditingPrimary(true); 
                }}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-md transition-colors"
                title="Sửa liên kết"
              >
                <Edit3 size={14} />
              </button>
              <button
                onClick={() => {
                  bufferChange('project_id', null);
                  bufferChange('source_module', null);
                  bufferChange('source_entity_id', null);
                }}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-md transition-colors"
                title="Xóa liên kết"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ) : isEditingPrimary ? (
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cập nhật liên kết chính</label>
              <button onClick={() => { setIsEditingPrimary(false); setPrimaryLinkType(''); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Loại liên kết</label>
                <select
                  value={primaryLinkType}
                  onChange={e => setPrimaryLinkType(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-indigo-500"
                >
                  <option value="">-- Chọn loại --</option>
                  {registryOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
              </div>
              {primaryLinkType && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Tìm kiếm</label>
                  <SearchableSelect
                    value={null}
                    onChange={(id, opt) => {
                      if (primaryLinkType === 'project') {
                        bufferChange('project_id', id);
                        bufferChange('source_module', null);
                        bufferChange('source_entity_id', null);
                      } else {
                        bufferChange('project_id', null);
                        bufferChange('source_module', primaryLinkType);
                        bufferChange('source_entity_id', id);
                      }
                      setIsEditingPrimary(false);
                    }}
                    onSearch={q => EntitySearchService.search(primaryLinkType, q, profile)}
                    placeholder="Gõ để tìm thẻ thay thế..."
                    size="sm"
                    initialOptions={task.source_entity_id || task.project_id ? [{ id: task.source_entity_id || task.project_id || '', name: 'Đang chọn' }] : []}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <button onClick={() => setIsEditingPrimary(true)} className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer text-sm font-medium">
            <Plus size={16} /> Thêm liên kết chính
          </button>
        )}
      </div>

      {/* Manual links */}
      {links.length > 0 && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 block">Liên kết khác ({links.length})</label>
          <div className="space-y-2">
            {links.map(link => 
              editingLinkId === link.id ? (
                <div key={link.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Đổi liên kết phụ</label>
                    <button onClick={() => setEditingLinkId(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Bạn đang sửa liên kết trong module: <span className="font-bold uppercase text-indigo-500 dark:text-indigo-400">{registryOptions.find(o => o.id === link.entity_type)?.name || link.entity_type}</span></label>
                    </div>
                    <SearchableSelect
                      value={null}
                      onChange={async (id, opt) => {
                        if (!id) return;
                        try {
                          const updated = await TaskService.updateLink(link.id, { entity_id: id, entity_label: opt?.name });
                          setLinks(prev => prev.map(l => l.id === link.id ? { ...updated, entity_type: link.entity_type } : l));
                          setEditingLinkId(null);
                        } catch (err: any) {
                          toast.error('Lỗi khi sửa liên kết: ' + err.message);
                        }
                      }}
                      onSearch={(q) => EntitySearchService.search(link.entity_type, q, profile)}
                      placeholder={`Gõ để tìm thẻ thay thế...`}
                      size="sm"
                      initialOptions={[{ id: link.entity_id, name: link.entity_label || 'Đang chọn' }]}
                    />
                  </div>
                </div>
              ) : (
                <div key={link.id} className="group relative bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all overflow-hidden">
                  {link.dependency_type && link.dependency_type !== 'related' && (
                    <div className={`px-2 py-0.5 text-[10px] font-bold border-b border-slate-100 dark:border-slate-700 flex items-center gap-1 ${
                      DEPENDENCY_OPTIONS.find(d => d.value === link.dependency_type)?.color || ''
                    }`}>
                      <ShieldAlert size={9} />
                      {DEPENDENCY_OPTIONS.find(d => d.value === link.dependency_type)?.label}
                    </div>
                  )}
                  <LinkItem link={link} registryOptions={registryOptions} />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 pl-2 rounded-l-xl">
                    <button
                      onClick={() => setEditingLinkId(link.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-md transition-colors"
                      title="Sửa liên kết"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => TaskService.removeLink(link.id).then(() => setLinks(prev => prev.filter(l => l.id !== link.id)))}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-md transition-colors"
                      title="Xóa liên kết"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {links.length === 0 && !task.source_module && !task.project_id && (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-8 mt-4">
          <Link2 size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Chưa có liên kết phụ nào</p>
        </div>
      )}

      {/* Add link section */}
      {isAddingLink ? (
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Thêm liên kết mới</label>
            <button onClick={() => { setIsAddingLink(false); setSelectedLinkType(''); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X size={14} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Loại liên kết</label>
              <select
                value={selectedLinkType}
                onChange={e => setSelectedLinkType(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-indigo-500"
              >
                <option value="">-- Chọn loại --</option>
                {registryOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Quan hệ phụ thuộc</label>
              <select
                value={selectedDepType}
                onChange={e => setSelectedDepType(e.target.value as TaskDependencyType)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-indigo-500"
              >
                {DEPENDENCY_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {selectedLinkType && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Tìm kiếm</label>
                <SearchableSelect
                  value={null}
                  onChange={handleCreateLink}
                  onSearch={searchEntity}
                  placeholder="Gõ để tìm..."
                  size="sm"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <button onClick={() => setIsAddingLink(true)} className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer text-sm font-medium">
          <Plus size={16} /> Thêm liên kết
        </button>
      )}
    </div>
  );
};
