import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import {
  CheckSquare, Plus, Search, Calendar, User, AlertTriangle, Copy,
  ExternalLink, Loader2, LayoutGrid, List, Clock, Filter, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { TaskService } from '../services/taskService';
import { formatDateShort } from '../utils/formatters';
import type { Task, TaskStatus, TaskPriority } from '../types/taskTypes';
import { useSlidePanel } from '../contexts/SlidePanelContext';
import { useTaskVisibility } from '../hooks/useTaskVisibility';
import { dataClient } from '../lib/dataClient';

const CreateTaskPanel = React.lazy(() => import('./tasks/CreateTaskPanel'));
const TaskDetailPanel = React.lazy(() => import('./tasks/TaskDetailPanel'));
const TaskTemplateModal = React.lazy(() => import('./tasks/TaskTemplateModal').then(m => ({ default: m.TaskTemplateModal })));

interface ProjectTasksTabProps {
  projectId: string;
  projectName: string;
}

// ═══════════════════════════════════════
// PRIORITY CONFIG
// ═══════════════════════════════════════
const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
  none: 'bg-slate-300 dark:bg-slate-600',
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Khẩn cấp', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  high: { label: 'Cao', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  medium: { label: 'Trung bình', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  low: { label: 'Thấp', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' },
  none: { label: 'Không', color: 'text-slate-400 dark:text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800' },
};

type ViewMode = 'list' | 'board';

const ProjectTasksTab: React.FC<ProjectTasksTabProps> = ({ projectId, projectName }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatar: string }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    return (localStorage.getItem('cic-erp-project-task-mode') as ViewMode) || 'list';
  });
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem('cic-erp-project-task-mode', mode);
  };
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const { openPanel, closePanel } = useSlidePanel();
  const navigate = useNavigate();
  const { visibilityContext } = useTaskVisibility();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [taskList, statusList] = await Promise.all([
        TaskService.getByProjectId(projectId, undefined, visibilityContext),
        TaskService.getStatuses(),
      ]);
      setTasks(taskList);
      setStatuses(statusList);

      // Profiles
      const empIds = new Set<string>();
      taskList.forEach(t => {
        t.assignees?.forEach(id => empIds.add(id));
        if (t.created_by) empIds.add(t.created_by);
      });
      if (empIds.size > 0) {
        const { data: emps } = await dataClient.from('profiles').select('id, full_name, avatar_url').in('id', Array.from(empIds));
        const map: Record<string, any> = {};
        emps?.forEach((e: any) => { map[e.id] = { name: e.full_name, avatar: e.avatar_url }; });
        setProfiles(map);
      }
    } catch (err) {
      console.error('Failed to load project tasks:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, visibilityContext]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Computed ─────────────────────────────────────────────────────────
  const doneStatusIds = useMemo(() => statuses.filter(s => s.is_done).map(s => s.id), [statuses]);

  const filtered = useMemo(() => {
    let result = tasks;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }
    if (filterPriority !== 'all') {
      result = result.filter(t => t.priority === filterPriority);
    }
    return result;
  }, [tasks, search, filterPriority]);

  const activeTasks = useMemo(() => filtered.filter(t => !doneStatusIds.includes(t.status_id || '')), [filtered, doneStatusIds]);
  const doneTasks = useMemo(() => filtered.filter(t => doneStatusIds.includes(t.status_id || '')), [filtered, doneStatusIds]);

  // Stats
  const today = new Date().toISOString().split('T')[0];
  const overdueCount = tasks.filter(t => t.due_date && t.due_date < today && !doneStatusIds.includes(t.status_id || '')).length;
  const todayCount = tasks.filter(t => t.due_date === today && !doneStatusIds.includes(t.status_id || '')).length;
  const completedCount = tasks.filter(t => doneStatusIds.includes(t.status_id || '')).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleToggle = async (task: Task) => {
    try {
      if (task.status?.is_done) {
        const defaultId = await TaskService.getDefaultStatusId();
        if (defaultId) await TaskService.update(task.id, { status_id: defaultId, completed_at: undefined, completed_by: undefined });
      } else {
        await TaskService.complete(task.id, visibilityContext.userId);
      }
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  const handleAddTask = () => {
    if (!visibilityContext.userId) {
      toast.error('Không tìm thấy thông tin user. Đang tải lại...');
      loadData();
      return;
    }
    openPanel({
      title: 'Thêm công việc cho dự án',
      component: (
        <Suspense fallback={<div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>}>
          <CreateTaskPanel
            currentUserId={visibilityContext.userId}
            initialData={{
              project_id: projectId,
              source_module: 'project',
              source_entity_id: projectId,
            }}
            onTaskCreated={() => { loadData(); closePanel(); }}
            onClose={() => closePanel()}
          />
        </Suspense>
      ),
    });
  };

  const handleOpenTask = (task: Task) => {
    openPanel({
      title: task.title,
      component: (
        <Suspense fallback={<div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>}>
          <TaskDetailPanel
            taskId={task.id}
            onClose={() => closePanel()}
            onUpdate={loadData}
          />
        </Suspense>
      ),
    });
  };

  const handleUpdateStatus = async (taskId: string, statusId: string) => {
    try {
      const status = statuses.find(s => s.id === statusId);
      const updates: any = { status_id: statusId };
      if (status?.is_done) {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = visibilityContext.userId;
      }
      await TaskService.update(taskId, updates);
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  const handleViewAllInModule = () => {
    navigate('/tasks');
  };

  // ── Render Helpers ───────────────────────────────────────────────────
  const renderAssignees = (assignees: string[]) => {
    if (!assignees || assignees.length === 0) return null;
    return (
      <div className="flex -space-x-1.5 flex-shrink-0">
        {assignees.slice(0, 2).map(id => {
          const p = profiles[id];
          return (
            <div key={id} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center overflow-hidden" title={p?.name}>
              {p?.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">{p?.name?.charAt(0) || <User size={10} />}</span>}
            </div>
          );
        })}
        {assignees.length > 2 && (
          <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-500 dark:text-slate-400">+{assignees.length - 2}</div>
        )}
      </div>
    );
  };

  const renderTaskRow = (task: Task, idx: number, showBorder: boolean) => {
    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed_at;
    const statusObj = statuses.find(s => s.id === task.status_id);
    return (
      <div
        key={task.id}
        className={`flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group ${showBorder ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}
        onClick={() => handleOpenTask(task)}
      >
        {/* Checkbox */}
        <button
          onClick={e => { e.stopPropagation(); handleToggle(task); }}
          className={`w-5 h-5 rounded border-2 flex-shrink-0 transition-all cursor-pointer flex items-center justify-center ${task.status?.is_done
            ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600'
            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400'
            }`}
        >
          {task.status?.is_done && (
            <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Priority dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.none}`} />

        {/* Title */}
        <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {task.title}
        </span>

        {/* Status badge */}
        {statusObj && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: statusObj.color + '20', color: statusObj.color }}
          >
            {statusObj.name}
          </span>
        )}

        {/* Due date */}
        {task.due_date && (
          <span className={`text-[10px] font-bold flex items-center gap-1 flex-shrink-0 ${isOverdue ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-md' : 'text-slate-400 dark:text-slate-500'}`}>
            {isOverdue && <AlertTriangle size={10} />}
            <Calendar size={10} />
            {formatDateShort(task.due_date)}
          </span>
        )}

        {/* Assignees */}
        {renderAssignees(task.assignees)}
      </div>
    );
  };

  // ── Kanban Board ─────────────────────────────────────────────────────
  const renderBoard = () => {
    const columns = statuses.filter(s => !s.space_id).sort((a, b) => a.sort_order - b.sort_order);
    return (
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '40vh' }}>
        {columns.map(status => {
          const columnTasks = filtered.filter(t => t.status_id === status.id);
          return (
            <div
              key={status.id}
              className="flex-1 min-w-[200px] bg-slate-50 dark:bg-slate-800 rounded-xl p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragTaskId) {
                  handleUpdateStatus(dragTaskId, status.id);
                  setDragTaskId(null);
                }
              }}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">{status.name}</h4>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="space-y-2 min-h-[60px]">
                {columnTasks.map(task => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed_at;
                  const priorityConf = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.none;
                  const isDone = status.is_done;
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => setDragTaskId(task.id)}
                      onDragEnd={() => setDragTaskId(null)}
                      onClick={() => handleOpenTask(task)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 group ${dragTaskId === task.id ? 'opacity-40' : ''
                        } ${isDone
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-70'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm'
                        }`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggle(task); }}
                          className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer ${isDone
                            ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600'
                            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500'
                            }`}
                        >
                          {isDone && <CheckSquare size={10} className="text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-semibold leading-tight ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${priorityConf.bg} ${priorityConf.color}`}>
                              {priorityConf.label}
                            </span>
                            {task.due_date && (
                              <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                                {isOverdue ? <AlertTriangle size={10} /> : <Calendar size={10} />}
                                {formatDateShort(task.due_date)}
                              </span>
                            )}
                          </div>
                          {task.assignees?.length > 0 && (
                            <div className="mt-2">
                              {renderAssignees(task.assignees)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ═══════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare size={20} className="text-indigo-500" />
            Công việc
          </h3>
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full">
            {activeTasks.length} đang làm • {doneTasks.length} hoàn thành
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
              title="Danh sách"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'board' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
              title="Kanban Board"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
          >
            <Copy size={13} /> Mẫu
          </button>
          <button
            onClick={handleAddTask}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <Plus size={14} /> Thêm công việc
          </button>
        </div>
      </div>

      {/* Quick Stats + Progress */}
      {tasks.length > 0 && (
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tiến độ công việc</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{progressPercent}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{completedCount} / {tasks.length} công việc</span>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Quá hạn', value: overdueCount, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', icon: <AlertTriangle size={14} /> },
              { label: 'Hôm nay', value: todayCount, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: <Clock size={14} /> },
              { label: 'Đang làm', value: activeTasks.length, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: <CheckSquare size={14} /> },
              { label: 'Hoàn thành', value: completedCount, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: <CheckSquare size={14} /> },
            ].map(stat => (
              <div key={stat.label} className={`p-3 rounded-xl ${stat.bg} border border-transparent`}>
                <div className={`flex items-center gap-1.5 ${stat.color}`}>
                  {stat.icon}
                  <span className="text-[10px] font-bold uppercase tracking-wide">{stat.label}</span>
                </div>
                <div className={`text-xl font-black mt-1 ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filter bar */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm kiếm công việc..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as TaskPriority | 'all')}
            className="px-3 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 cursor-pointer"
          >
            <option value="all">Tất cả ưu tiên</option>
            <option value="urgent">🔴 Khẩn cấp</option>
            <option value="high">🟠 Cao</option>
            <option value="medium">🔵 Trung bình</option>
            <option value="low">⚪ Thấp</option>
          </select>
        </div>
      )}

      {/* Task Content */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          <CheckSquare size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Chưa có công việc nào</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Tạo công việc đầu tiên cho dự án này</p>
          <button
            onClick={handleAddTask}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all cursor-pointer"
          >
            <Plus size={14} /> Tạo công việc
          </button>
        </div>
      ) : viewMode === 'board' ? (
        renderBoard()
      ) : (
        /* List View */
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Active */}
          {activeTasks.map((task, idx) => renderTaskRow(task, idx, idx > 0))}

          {activeTasks.length === 0 && filtered.length > 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              Không tìm thấy công việc đang làm
            </div>
          )}

          {/* Done */}
          {doneTasks.length > 0 && (
            <details className="border-t border-slate-100 dark:border-slate-800">
              <summary className="px-4 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors bg-slate-50/50 dark:bg-slate-800">
                ✅ {doneTasks.length} đã hoàn thành
              </summary>
              {doneTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-4 py-2.5 opacity-50 hover:opacity-80 transition-opacity cursor-pointer border-t border-slate-50 dark:border-slate-800"
                  onClick={() => handleOpenTask(task)}
                >
                  <button
                    onClick={e => { e.stopPropagation(); handleToggle(task); }}
                    className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center flex-shrink-0 cursor-pointer"
                  >
                    <CheckSquare size={12} className="text-white" />
                  </button>
                  <span className="flex-1 text-sm text-slate-500 dark:text-slate-400 line-through truncate">{task.title}</span>
                </div>
              ))}
            </details>
          )}
        </div>
      )}

      {/* Footer: View all in Tasks module */}
      {tasks.length > 0 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleViewAllInModule}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all cursor-pointer"
          >
            <ExternalLink size={13} />
            Xem tất cả trong module Công việc
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {isTemplateModalOpen && (
        <Suspense fallback={null}>
          <TaskTemplateModal
            isOpen={isTemplateModalOpen}
            onClose={() => setIsTemplateModalOpen(false)}
            entityType="project"
            entityId={projectId}
            onApplied={(count: number) => { if (count > 0) loadData(); }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default ProjectTasksTab;
