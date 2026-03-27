import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, FileText, CheckCircle2, Loader2, GripVertical, AlertCircle, ChevronDown, ChevronUp, Link as LinkIcon, User, Users, Crown, X, Tag, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { TaskTemplateService, TaskTemplate, TemplateTaskItem, AssigneeRole } from '../../services/taskTemplateService';
import { EntityRegistryService } from '../../services/entityRegistryService';
import { EmployeeService } from '../../services/employeeService';
import type { TaskPriority, EntityRegistryItem } from '../../types/taskTypes';
import type { Employee } from '../../types';
import { formatDate } from '../../utils/formatters';
import PeoplePickerPopover from './PeoplePickerPopover';
import { SlidePanelHeader } from '../ui/SlidePanelHeader';
import { createPortal } from 'react-dom';

interface TaskTemplateManagerPanelProps {
  onClose: () => void;
}

// ═══════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════
const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent', label: 'Khẩn cấp', color: 'text-red-600 dark:text-red-400' },
  { value: 'high', label: 'Cao', color: 'text-orange-600 dark:text-orange-400' },
  { value: 'medium', label: 'TB', color: 'text-blue-600 dark:text-blue-400' },
  { value: 'low', label: 'Thấp', color: 'text-slate-500 dark:text-slate-400' },
];

const ASSIGNEE_ROLE_OPTIONS: { value: AssigneeRole | ''; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: '', label: 'Không gán', icon: <User size={14} className="text-slate-400" />, desc: 'Để trống' },
  { value: 'creator', label: 'Người giao việc', icon: <User size={14} className="text-blue-500 dark:text-blue-400" />, desc: 'Gán cho người kích hoạt mẫu' },
  { value: 'unit_leader', label: 'Trưởng đơn vị', icon: <Crown size={14} className="text-amber-500 dark:text-amber-400" />, desc: 'Gán cho trưởng đơn vị liên quan' },
  { value: 'specific', label: 'Chọn cụ thể', icon: <Users size={14} className="text-purple-500 dark:text-purple-400" />, desc: 'Chọn nhân viên cụ thể' },
];

const emptyTask = (): TemplateTaskItem => ({
  id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
  title: '',
  description: '',
  duration_days: 1,
  priority: 'medium',
  status_type: 'todo',
  sort_order: 0,
  base_date_type: 'current_date',
});

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export const TaskTemplateManagerPanel: React.FC<TaskTemplateManagerPanelProps> = ({ onClose }) => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityTypes, setEntityTypes] = useState<EntityRegistryItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = creating new
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTasks, setEditTasks] = useState<TemplateTaskItem[]>([]);
  const [editEntityTypes, setEditEntityTypes] = useState<string[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showPeoplePicker, setShowPeoplePicker] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    loadTemplates();
    loadEntityTypes();
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await EmployeeService.getAll();
      setEmployees(data);
    } catch { /* ignore */ }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await TaskTemplateService.getAll();
      setTemplates(data);
    } catch (err: any) {
      toast.error('Lỗi tải danh sách mẫu: ' + (err.message || 'Unknown'));
    } finally {
      setLoading(false);
    }
  };

  const loadEntityTypes = async () => {
    try {
      const data = await EntityRegistryService.getAll();
      // Filter out 'task' entity type — not relevant for templates
      setEntityTypes(data.filter(e => e.entity_type !== 'task'));
    } catch { /* ignore */ }
  };

  const handleStartCreate = () => {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
    setEditTasks([emptyTask()]);
    setEditEntityTypes([]);
    setExpandedTaskId(null);
    setIsEditing(true);
  };

  const handleStartEdit = (tpl: TaskTemplate) => {
    setEditingId(tpl.id);
    setEditName(tpl.name);
    setEditDesc(tpl.description || '');
    setEditTasks(tpl.tasks_json.length > 0 ? [...tpl.tasks_json] : [emptyTask()]);
    setEditEntityTypes([...(tpl.applicable_entity_types || [])]);
    setExpandedTaskId(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editName.trim()) return toast.error('Vui lòng nhập tên mẫu');
    if (editTasks.length === 0) return toast.error('Vui lòng thêm ít nhất 1 công việc');
    
    for (const t of editTasks) {
      if (!t.title.trim()) return toast.error('Tên công việc không được để trống');
    }

    // Update sort_order based on position
    const tasksWithOrder = editTasks.map((t, i) => ({ ...t, sort_order: i }));

    setSaving(true);
    try {
      if (editingId) {
        await TaskTemplateService.update(editingId, {
          name: editName.trim(),
          description: editDesc.trim(),
          tasks_json: tasksWithOrder,
          applicable_entity_types: editEntityTypes,
        });
        toast.success('Cập nhật mẫu thành công');
      } else {
        await TaskTemplateService.create({
          name: editName.trim(),
          description: editDesc.trim(),
          tasks_json: tasksWithOrder,
          applicable_entity_types: editEntityTypes,
          category: 'general',
          is_active: true,
        });
        toast.success('Tạo mẫu thành công');
      }
      setIsEditing(false);
      setEditingId(null);
      loadTemplates();
    } catch (err: any) {
      toast.error('Lỗi lưu mẫu: ' + (err.message || 'Unknown'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn xoá mẫu này?')) return;
    try {
      await TaskTemplateService.delete(id);
      toast.success('Xoá mẫu thành công');
      loadTemplates();
    } catch (err: any) {
      toast.error('Lỗi xoá mẫu: ' + (err.message || 'Unknown'));
    }
  };

  // ── Task editing helpers ──
  const updateTask = useCallback((taskId: string, updates: Partial<TemplateTaskItem>) => {
    setEditTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setEditTasks(prev => {
      // Also remove any depends_on references to this task
      return prev.filter(t => t.id !== taskId).map(t => 
        t.depends_on === taskId ? { ...t, depends_on: undefined } : t
      );
    });
  }, []);

  const addTask = useCallback(() => {
    setEditTasks(prev => [...prev, emptyTask()]);
  }, []);

  // ── Drag handlers ──
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setEditTasks(prev => {
      const newTasks = [...prev];
      const [moved] = newTasks.splice(dragIdx, 1);
      newTasks.splice(idx, 0, moved);
      return newTasks;
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  // ── Entity type toggle ──
  const toggleEntityType = (et: string) => {
    setEditEntityTypes(prev => 
      prev.includes(et) ? prev.filter(x => x !== et) : [...prev, et]
    );
  };

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <SlidePanelHeader>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
            Quản lý Template
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Quản lý các mẫu quy trình công việc tái sử dụng</p>
        </div>
        {!isEditing && (
          <button
            onClick={handleStartCreate}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={16} /> Tạo mẫu mới
          </button>
        )}
      </SlidePanelHeader>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {isEditing ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* ── Template Info ── */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên mẫu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="VD: Quy trình triển khai hợp đồng, Onboarding nhân sự..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors text-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mô tả (tuỳ chọn)</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  placeholder="Mô tả ngắn gọn mục đích sử dụng mẫu này..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors resize-none h-16 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* ── Entity Type Tags ── */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  <LinkIcon size={12} className="inline mr-1" />
                  Áp dụng cho loại
                  <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">(để trống = áp dụng cho tất cả)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {entityTypes.map(et => {
                    const selected = editEntityTypes.includes(et.entity_type);
                    return (
                      <button
                        key={et.entity_type}
                        onClick={() => toggleEntityType(et.entity_type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          selected
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                        }`}
                      >
                        {selected && <CheckCircle2 size={12} className="inline mr-1" />}
                        {et.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Task List ── */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 dark:text-slate-200">
                  Danh sách công việc mẫu ({editTasks.length})
                </h3>
                <button
                  onClick={addTask}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} /> Thêm việc
                </button>
              </div>

              <div className="space-y-3">
                {editTasks.map((task, index) => (
                  <TaskItemEditor
                    key={task.id}
                    task={task}
                    index={index}
                    allTasks={editTasks}
                    employees={employees}
                    expanded={expandedTaskId === task.id}
                    onToggleExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    onUpdate={updateTask}
                    onRemove={removeTask}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    isDragging={dragIdx === index}
                    showPeoplePicker={showPeoplePicker === task.id}
                    onTogglePeoplePicker={(show) => setShowPeoplePicker(show ? task.id : null)}
                  />
                ))}
              </div>

              {editTasks.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                  <p className="text-sm text-slate-400 dark:text-slate-500">Chưa có công việc nào</p>
                  <button onClick={addTask} className="mt-2 text-sm text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer hover:underline">
                    + Thêm công việc đầu tiên
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-slate-400" /></div>
        ) : templates.length === 0 ? (
          <div className="max-w-md mx-auto mt-20 text-center">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <FileText size={24} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Chưa có Template nào</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tạo mẫu quy trình để tiết kiệm thời gian. Khi áp dụng mẫu cho hợp đồng, dự án, hoá đơn,... hệ thống sẽ tự động tạo các công việc cần thiết.</p>
            <button onClick={handleStartCreate} className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition mx-auto flex items-center gap-2 shadow-sm shadow-indigo-600/20 cursor-pointer">
               <Plus size={16} /> Bắt đầu tạo mẫu
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
            {templates.map(tpl => (
              <div
                key={tpl.id}
                onClick={() => handleStartEdit(tpl)}
                className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative group cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
              >
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => handleDelete(tpl.id, e)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer" title="Xoá mẫu">
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 pr-16">{tpl.name}</h3>
                {tpl.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{tpl.description}</p>}
                
                {/* Entity type badges */}
                {tpl.applicable_entity_types.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {tpl.applicable_entity_types.map(et => {
                      const reg = entityTypes.find(r => r.entity_type === et);
                      return (
                        <span key={et} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50">
                          {reg?.label || et}
                        </span>
                      );
                    })}
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500 dark:text-emerald-400" />
                    {tpl.tasks_json?.length || 0} tasks
                  </span>
                  {/* Show dependency count */}
                  {tpl.tasks_json?.some(t => t.depends_on) && (
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full flex items-center gap-1">
                      <ArrowRight size={12} className="text-amber-500 dark:text-amber-400" />
                      {tpl.tasks_json.filter(t => t.depends_on).length} phụ thuộc
                    </span>
                  )}
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 px-2 py-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {formatDate(tpl.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer (if editing) */}
      {isEditing && (
        <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
          <button disabled={saving} onClick={() => { setIsEditing(false); setEditingId(null); }} className="px-4 py-2 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition border border-transparent cursor-pointer">
            Hủy
          </button>
          <button disabled={saving} onClick={handleSave} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 flex items-center gap-2 transition disabled:opacity-70 cursor-pointer">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
            {editingId ? 'Cập nhật' : 'Lưu Mẫu'}
          </button>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// TASK ITEM EDITOR — Sub-component cho mỗi task mẫu
// ═══════════════════════════════════════
interface TaskItemEditorProps {
  task: TemplateTaskItem;
  index: number;
  allTasks: TemplateTaskItem[];
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (taskId: string, updates: Partial<TemplateTaskItem>) => void;
  onRemove: (taskId: string) => void;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  showPeoplePicker: boolean;
  onTogglePeoplePicker: (show: boolean) => void;
  employees: Employee[];
}

const TaskItemEditor: React.FC<TaskItemEditorProps> = ({
  task, index, allTasks, employees, expanded, onToggleExpand,
  onUpdate, onRemove, onDragStart, onDragOver, onDragEnd, isDragging,
  showPeoplePicker, onTogglePeoplePicker,
}) => {
  // Other tasks for dependency dropdown (exclude self and tasks that depend on this one to prevent cycles)
  const dependencyOptions = allTasks.filter(t => {
    if (t.id === task.id) return false;
    // Simple cycle check: don't allow selecting a task that already depends on this task
    let current: TemplateTaskItem | undefined = t;
    const visited = new Set<string>();
    while (current?.depends_on) {
      if (visited.has(current.id)) break;
      visited.add(current.id);
      if (current.depends_on === task.id) return false;
      current = allTasks.find(x => x.id === current!.depends_on);
    }
    return true;
  });

  const dependsOnTask = task.depends_on ? allTasks.find(t => t.id === task.depends_on) : null;
  
  const [dropdownPos, setDropdownPos] = React.useState({ top: 0, left: 0, width: 288 });
  const btnRef = React.useRef<HTMLButtonElement>(null);

  const handleTogglePicker = (show: boolean) => {
    if (show && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const viewportH = window.innerHeight;
      let top = rect.bottom + 4;
      if (top + 400 > viewportH && rect.top > 400) {
        top = rect.top - 400 - 4; // Render above if no space below
      }
      setDropdownPos({ top, left: rect.left, width: 288 }); // 288 is w-72 matches
    }
    onTogglePeoplePicker(show);
  };

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      className={`group bg-slate-50 dark:bg-slate-800 border rounded-xl relative transition-all ${
        isDragging
          ? 'border-indigo-400 dark:border-indigo-500 shadow-lg scale-[1.01] opacity-80'
          : 'border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      {/* Row 1: Drag + Title + Expand + Delete */}
      <div className="flex items-center gap-2 p-3 pb-2">
        <div className="text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing flex-shrink-0 hover:text-slate-400 dark:hover:text-slate-500 transition-colors">
          <GripVertical size={16} />
        </div>
        
        {/* Order badge */}
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>

        <input
          type="text"
          value={task.title}
          onChange={e => onUpdate(task.id, { title: e.target.value })}
          placeholder="Tên công việc..."
          className="flex-1 bg-transparent border-none focus:outline-none text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
        />
        
        <button
          onClick={onToggleExpand}
          className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors cursor-pointer"
          title={expanded ? "Thu gọn" : "Mở rộng"}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        
        <button
          onClick={() => onRemove(task.id)}
          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Row 2: Badges (always visible) */}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pl-12">
        {/* Assignee Role Custom Dropdown */}
        <div className="relative">
          <button
            ref={btnRef}
            onClick={() => handleTogglePicker(!showPeoplePicker)}
            className="flex items-center gap-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 outline-none font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors shadow-sm"
          >
            {(() => {
              if (task.assignee_role === 'creator') return <><User size={12} className="text-blue-500 dark:text-blue-400" /> Ng. giao việc</>;
              if (task.assignee_role === 'unit_leader') return <><Crown size={12} className="text-amber-500 dark:text-amber-400" /> Trưởng ĐV</>;
              if (task.assignee_role === 'specific') {
                const emp = employees.find(e => e.id === task.assignee_id);
                if (emp) {
                  return (
                    <div className="flex items-center gap-1.5">
                      {emp.avatar ? (
                        <img src={emp.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[8px] font-bold">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-indigo-600 dark:text-indigo-400 truncate max-w-[120px]">{emp.name}</span>
                    </div>
                  );
                }
                return <><Users size={12} className="text-purple-500 dark:text-purple-400" /> Chọn người...</>;
              }
              return <><User size={12} className="text-slate-400" /> Không gán</>;
            })()}
          </button>
          
          {showPeoplePicker && createPortal(
            <>
              {/* BACKDROP - Rendered FIRST so it's behind the dropdown content via z-index or DOM order */}
              <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); handleTogglePicker(false); }} />

              <div 
                style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: Math.max(dropdownPos.width, 300), zIndex: 9999 }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              >
                <div className="p-2 border-b border-slate-100 dark:border-slate-700/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-1.5">Vai trò động</p>
                  {ASSIGNEE_ROLE_OPTIONS.filter(o => o.value !== 'specific').map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdate(task.id, { assignee_role: opt.value || undefined, assignee_id: undefined });
                        handleTogglePicker(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${task.assignee_role === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
                <div className="p-2 bg-slate-50/50 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between px-2 mb-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Người cụ thể</p>
                    {task.assignee_role === 'specific' && task.assignee_id && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); onUpdate(task.id, { assignee_role: undefined, assignee_id: undefined }); handleTogglePicker(false); }} className="text-[10px] text-red-500 hover:text-red-600 font-semibold cursor-pointer">Xoá chọn</button>
                    )}
                  </div>
                  {/* PeoplePickerPopover inside inline mode */}
                  <PeoplePickerPopover
                    currentIds={task.assignee_id ? [task.assignee_id] : []}
                    onChange={(ids) => {
                      onUpdate(task.id, { assignee_role: 'specific', assignee_id: ids[0] || undefined });
                      handleTogglePicker(false);
                    }}
                    onClose={() => handleTogglePicker(false)}
                    align="left"
                    singleSelect
                    inline
                  />
                </div>
              </div>
            </>,
            document.body
          )}
        </div>

        {/* Priority */}
        <select
          value={task.priority}
          onChange={e => onUpdate(task.id, { priority: e.target.value as TaskPriority })}
          className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 outline-none font-semibold text-slate-600 dark:text-slate-300 cursor-pointer appearance-auto"
        >
          {PRIORITY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Duration */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            value={task.duration_days}
            onChange={e => onUpdate(task.id, { duration_days: parseInt(e.target.value) || 0 })}
            className="w-12 text-center text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-1.5 outline-none font-semibold text-slate-600 dark:text-slate-300"
          />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">ngày</span>
        </div>

        {/* Dependency */}
        <select
          value={task.depends_on || ''}
          onChange={e => onUpdate(task.id, { depends_on: e.target.value || undefined })}
          className={`text-xs border rounded-lg px-2 py-1.5 outline-none font-semibold cursor-pointer appearance-auto ${
            task.depends_on
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400'
              : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
          }`}
        >
          <option value="">Không phụ thuộc</option>
          {dependencyOptions.map(t => (
            <option key={t.id} value={t.id}>
              Chờ: {t.title || `Task ${allTasks.indexOf(t) + 1}`}
            </option>
          ))}
        </select>

        {/* Dependency indicator */}
        {dependsOnTask && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
            <ArrowRight size={10} />
            sau "{dependsOnTask.title || `Task ${allTasks.indexOf(dependsOnTask) + 1}`}"
          </span>
        )}
      </div>

      {/* Row 3: Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 pl-12 space-y-3 border-t border-slate-200 dark:border-slate-700/50 pt-3 mx-3 mb-1">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Mô tả công việc</label>
            <textarea
              value={task.description}
              onChange={e => onUpdate(task.id, { description: e.target.value })}
              placeholder="Mô tả chi tiết việc cần làm..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors resize-none h-16 text-slate-700 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Trạng thái mặc định</label>
            <select
              value={task.status_type}
              onChange={e => onUpdate(task.id, { status_type: e.target.value as any })}
              className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 outline-none font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <option value="todo">Cần làm</option>
              <option value="in_progress">Đang thực hiện</option>
              <option value="done">Hoàn thành</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Mốc thời gian bắt đầu</label>
            <select
              value={task.base_date_type || 'current_date'}
              onChange={e => onUpdate(task.id, { base_date_type: e.target.value as any })}
              className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 outline-none font-semibold text-slate-600 dark:text-slate-300 cursor-pointer w-full"
            >
              <option value="current_date">Theo ngày áp dụng mẫu (Mặc định)</option>
              <option value="payment_term">Theo Hạn thanh toán của Hợp đồng / HĐ</option>
            </select>
            {task.base_date_type === 'payment_term' && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 italic">
                *Chỉ áp dụng khi tạo từ Hợp đồng có cấu hình (nếu không, sẽ mặc định theo ngày áp dụng mẫu)
              </p>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default TaskTemplateManagerPanel;
