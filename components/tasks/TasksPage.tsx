import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, LayoutGrid, List, CheckSquare, Filter, Search,
  Clock, AlertTriangle, Calendar, ChevronDown, X,
  MessageSquare, Link2, MoreHorizontal, Tag, Copy, FolderKanban
} from 'lucide-react';
import { toast } from 'sonner';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import { useLayoutContext } from '../layout/MainLayout';
import { TaskService } from '../../services/taskService';
import { dataClient } from '../../lib/dataClient';
import TaskDetailPanel from './TaskDetailPanel';
import CreateTaskPanel from './CreateTaskPanel';
import CalendarView from './CalendarView';
import { GanttView } from './GanttView';
import TaskTemplateManagerPanel from './TaskTemplateManagerPanel';
import { useTaskVisibility } from '../../hooks/useTaskVisibility';
import { formatDate, formatDateShort } from '../../utils/formatters';
import type {
  Task, TaskStatus, TaskPriority, TaskFilterOptions, CreateTaskInput
} from '../../types/taskTypes';

// ═══════════════════════════════════════
// PRIORITY CONFIG
// ═══════════════════════════════════════
const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; darkColor: string; bg: string; darkBg: string }> = {
  urgent: { label: 'Khẩn cấp', color: 'text-red-600', darkColor: 'dark:text-red-400', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/20' },
  high: { label: 'Cao', color: 'text-orange-600', darkColor: 'dark:text-orange-400', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-900/20' },
  medium: { label: 'Trung bình', color: 'text-blue-600', darkColor: 'dark:text-blue-400', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/20' },
  low: { label: 'Thấp', color: 'text-slate-500', darkColor: 'dark:text-slate-400', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-800' },
  none: { label: 'Không', color: 'text-slate-400', darkColor: 'dark:text-slate-500', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-800' },
};

// ═══════════════════════════════════════
// TASK CARD COMPONENT
// ═══════════════════════════════════════
const TaskCard: React.FC<{
  task: Task;
  onSelect: (id: string) => void;
  onToggleComplete: (task: Task) => void;
  statuses: TaskStatus[];
}> = ({ task, onSelect, onToggleComplete, statuses }) => {
  const priorityConf = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed_at;
  const isDone = task.status?.is_done;

  return (
    <div
      onClick={() => onSelect(task.id)}
      className={`group p-4 rounded-xl border cursor-pointer transition-all duration-200
        ${isDone
          ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-70'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md dark:hover:shadow-indigo-900/10'
        }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }}
          className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all
            ${isDone
              ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600'
              : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500'
            }`}
        >
          {isDone && <CheckSquare size={12} className="text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className={`text-sm font-semibold leading-tight ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
            {task.title}
          </h3>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Priority */}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityConf.bg} ${priorityConf.darkBg} ${priorityConf.color} ${priorityConf.darkColor}`}>
              {priorityConf.label}
            </span>

            {/* Due date */}
            {task.due_date && (
              <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                {isOverdue ? <AlertTriangle size={12} /> : <Calendar size={12} />}
                {formatDateShort(task.due_date)}
              </span>
            )}

            {/* Source module badge */}
            {task.source_module && (
              <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                {task.source_module}
              </span>
            )}

            {/* Project badge */}
            {(task as any)._projectName && (
              <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <FolderKanban size={10} />
                {(task as any)._projectName}
              </span>
            )}

            {/* Tags */}
            {task.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Tag size={10} /> {tag}
              </span>
            ))}
          </div>

          {/* Assignees */}
          {task.assignees.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {task.assignees.slice(0, 3).map((id, i) => (
                <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-slate-900 -ml-1 first:ml-0">
                  {id.charAt(0).toUpperCase()}
                </div>
              ))}
              {task.assignees.length > 3 && (
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">+{task.assignees.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// ═══════════════════════════════════════
// MY TASKS VIEW
// ═══════════════════════════════════════
const MyTasksView: React.FC<{
  tasks: Task[];
  statuses: TaskStatus[];
  onSelect: (id: string) => void;
  onToggleComplete: (task: Task) => void;
}> = ({ tasks, statuses, onSelect, onToggleComplete }) => {
  const today = new Date().toISOString().split('T')[0];
  const doneStatusIds = statuses.filter(s => s.is_done).map(s => s.id);

  const overdue = tasks.filter(t => t.due_date && t.due_date < today && !doneStatusIds.includes(t.status_id || ''));
  const todayTasks = tasks.filter(t => t.due_date === today && !doneStatusIds.includes(t.status_id || ''));
  const upcoming = tasks.filter(t => t.due_date && t.due_date > today && !doneStatusIds.includes(t.status_id || ''));
  const noDue = tasks.filter(t => !t.due_date && !doneStatusIds.includes(t.status_id || ''));
  const completed = tasks.filter(t => doneStatusIds.includes(t.status_id || ''));

  const sections = [
    { title: '⚠️ Quá hạn', tasks: overdue, color: 'text-red-600 dark:text-red-400' },
    { title: '📌 Hôm nay', tasks: todayTasks, color: 'text-amber-600 dark:text-amber-400' },
    { title: '📅 Sắp tới', tasks: upcoming, color: 'text-blue-600 dark:text-blue-400' },
    { title: '📋 Chưa có deadline', tasks: noDue, color: 'text-slate-600 dark:text-slate-400' },
    { title: '✅ Hoàn thành', tasks: completed, color: 'text-emerald-600 dark:text-emerald-400' },
  ].filter(s => s.tasks.length > 0);

  return (
    <div className="space-y-6">
      {sections.map(section => (
        <div key={section.title}>
          <h3 className={`text-sm font-bold mb-3 ${section.color}`}>
            {section.title} ({section.tasks.length})
          </h3>
          <div className="space-y-2">
            {section.tasks.map(task => (
              <TaskCard key={task.id} task={task} onSelect={onSelect} onToggleComplete={onToggleComplete} statuses={statuses} />
            ))}
          </div>
        </div>
      ))}
      {tasks.length === 0 && (
        <div className="text-center py-16">
          <CheckSquare size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400">Chưa có công việc nào</h3>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Tạo công việc mới hoặc chờ được giao từ hệ thống</p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// BOARD VIEW (KANBAN)
// ═══════════════════════════════════════
const BoardView: React.FC<{
  tasks: Task[];
  statuses: TaskStatus[];
  onSelect: (id: string) => void;
  onToggleComplete: (task: Task) => void;
  onUpdateStatus: (taskId: string, statusId: string) => void;
}> = ({ tasks, statuses, onSelect, onToggleComplete, onUpdateStatus }) => {
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  const columns = statuses.filter(s => !s.space_id).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex gap-3 pb-4" style={{ minHeight: '60vh' }}>
      {columns.map(status => {
        const columnTasks = tasks.filter(t => t.status_id === status.id);
        return (
          <div
            key={status.id}
            className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800 rounded-xl p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragTaskId) {
                onUpdateStatus(dragTaskId, status.id);
                setDragTaskId(null);
              }
            }}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{status.name}</h3>
                <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                  {columnTasks.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="space-y-2 min-h-[100px]">
              {columnTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => setDragTaskId(task.id)}
                  onDragEnd={() => setDragTaskId(null)}
                  className={dragTaskId === task.id ? 'opacity-40' : ''}
                >
                  <TaskCard task={task} onSelect={onSelect} onToggleComplete={onToggleComplete} statuses={statuses} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════
// TABLE VIEW
// ═══════════════════════════════════════
const TableView: React.FC<{
  tasks: Task[];
  statuses: TaskStatus[];
  onSelect: (id: string) => void;
  onToggleComplete: (task: Task) => void;
}> = ({ tasks, statuses, onSelect, onToggleComplete }) => {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <th className="w-10 px-3 py-3" />
            <th className="text-left px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Công việc</th>
            <th className="text-left px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trạng thái</th>
            <th className="text-left px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ưu tiên</th>
            <th className="text-left px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Deadline</th>
            <th className="text-left px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nguồn</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const priorityConf = PRIORITY_CONFIG[task.priority];
            const status = statuses.find(s => s.id === task.status_id);
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed_at;
            const isDone = task.status?.is_done || status?.is_done;

            return (
              <tr
                key={task.id}
                onClick={() => onSelect(task.id)}
                className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <td className="px-3 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
                      ${isDone
                        ? 'bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600'
                        : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500'
                      }`}
                  >
                    {isDone && <CheckSquare size={12} className="text-white" />}
                  </button>
                </td>
                <td className="px-3 py-3">
                  <span className={`font-semibold ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                    {task.title}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {status && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />{' '}
                      <span className="text-slate-600 dark:text-slate-400">{status.name}</span>
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityConf.bg} ${priorityConf.darkBg} ${priorityConf.color} ${priorityConf.darkColor}`}>
                    {priorityConf.label}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {task.due_date && (
                    <span className={`text-xs ${isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                      {formatDate(task.due_date)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  {task.source_module && (
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">
                      {task.source_module}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {tasks.length === 0 && (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500">
          Chưa có công việc nào
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// MAIN TASKS PAGE
// ═══════════════════════════════════════
type ViewMode = 'my-tasks' | 'board' | 'table' | 'calendar' | 'gantt';

interface TasksPageProps {
  onSelectTask?: (taskId: string) => void;
}

const TasksPage: React.FC<TasksPageProps> = ({ onSelectTask }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('my-tasks');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [filterProjectId, setFilterProjectId] = useState<string>('all');
  const [projects, setProjects] = useState<{id: string; name: string}[]>([]);

  const { getVisibleTasks, getMyTasks, isAdmin, visibilityContext } = useTaskVisibility();
  const { openPanel, closePanel } = useSlidePanel();
  const { selectedUnit } = useLayoutContext();

  // Load projects list
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { data } = await dataClient.from('projects').select('id, name').order('name');
        if (data) setProjects(data.map((p: any) => ({ id: p.id, name: p.name })));
      } catch { /* ignore */ }
    };
    loadProjects();
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusList, taskList] = await Promise.all([
        TaskService.getStatuses(),
        viewMode === 'my-tasks'
          ? getMyTasks()
          : getVisibleTasks(),
      ]);
      setStatuses(statusList);

      // Enrich tasks with project names
      const projectIds = [...new Set(taskList.filter(t => t.project_id).map(t => t.project_id!))];
      let projectMap: Record<string, string> = {};
      if (projectIds.length > 0) {
        const { data: projData } = await dataClient.from('projects').select('id, name').in('id', projectIds);
        if (projData) projData.forEach((p: any) => { projectMap[p.id] = p.name; });
      }
      const enriched = taskList.map(t => ({
        ...t,
        _projectName: t.project_id ? projectMap[t.project_id] : undefined,
      }));
      setTasks(enriched);
    } catch (err: any) {
      console.error('Failed to load tasks:', err);
      toast.error('Lỗi tải công việc: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  }, [viewMode, getMyTasks, getVisibleTasks]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;
    // Filter by selected unit
    if (selectedUnit && selectedUnit.id !== 'all') {
      result = result.filter(t => t.unit_id === selectedUnit.id);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q));
    }
    if (filterPriority !== 'all') {
      result = result.filter(t => t.priority === filterPriority);
    }
    if (filterProjectId !== 'all') {
      result = result.filter(t => t.project_id === filterProjectId);
    }
    return result;
  }, [tasks, searchQuery, filterPriority, selectedUnit, filterProjectId]);

  // Handlers

  const handleToggleComplete = useCallback(async (task: Task) => {
    try {
      if (task.status?.is_done) {
        // Reopen → set default status
        const defaultId = await TaskService.getDefaultStatusId();
        if (defaultId) await TaskService.update(task.id, { status_id: defaultId, completed_at: undefined, completed_by: undefined });
      } else {
        await TaskService.complete(task.id, visibilityContext.userId);
      }
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  }, [visibilityContext.userId, loadData]);

  const handleUpdateStatus = useCallback(async (taskId: string, statusId: string) => {
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
  }, [statuses, visibilityContext.userId, loadData]);

  const handleSelectTask = useCallback((taskId: string) => {
    if (onSelectTask) {
      onSelectTask(taskId);
    } else {
      openPanel({
        component: (
          <TaskDetailPanel
            taskId={taskId}
            onUpdate={loadData}
            currentUserId={visibilityContext.userId}
            onClose={closePanel}
          />
        ),
        title: 'Chi tiết công việc',
        url: `/tasks/${taskId}`,
      });
    }
  }, [onSelectTask, openPanel, closePanel, loadData, visibilityContext.userId]);

  // Stats
  const today = new Date().toISOString().split('T')[0];
  const doneStatusIds = statuses.filter(s => s.is_done).map(s => s.id);
  const overdueCount = tasks.filter(t => t.due_date && t.due_date < today && !doneStatusIds.includes(t.status_id || '')).length;
  const todayCount = tasks.filter(t => t.due_date === today && !doneStatusIds.includes(t.status_id || '')).length;
  const completedCount = tasks.filter(t => doneStatusIds.includes(t.status_id || '')).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Công việc</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Quản lý và theo dõi công việc</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              openPanel({
                component: <TaskTemplateManagerPanel onClose={() => closePanel()} />,
                title: 'Quản lý Mẫu Công Việc',
              });
            }}
            className="hidden sm:flex items-center gap-2 border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Copy size={16} /> Quản lý Mẫu
          </button>
          
          <button
            onClick={() => {
              openPanel({
                component: <CreateTaskPanel onTaskCreated={loadData} onClose={() => closePanel()} currentUserId={visibilityContext.userId} />,
                title: 'Thêm công việc',
              });
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} /> Thêm công việc
          </button>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {([
            { mode: 'my-tasks' as ViewMode, icon: <CheckSquare size={16} />, label: 'Của tôi' },
            { mode: 'board' as ViewMode, icon: <LayoutGrid size={16} />, label: 'Board' },
            { mode: 'table' as ViewMode, icon: <List size={16} />, label: 'Bảng' },
            { mode: 'calendar' as ViewMode, icon: <Calendar size={16} />, label: 'Lịch' },
            { mode: 'gantt' as ViewMode, icon: <Clock size={16} />, label: 'Gantt' },
          ]).map(v => (
            <button
              key={v.mode}
              onClick={() => setViewMode(v.mode)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === v.mode
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Quá hạn', value: overdueCount, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20', icon: <AlertTriangle size={16} /> },
          { label: 'Hôm nay', value: todayCount, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20', icon: <Clock size={16} /> },
          { label: 'Tổng', value: tasks.length, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20', icon: <CheckSquare size={16} /> },
          { label: 'Hoàn thành', value: completedCount, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', icon: <CheckSquare size={16} /> },
        ].map(stat => (
          <div key={stat.label} className={`p-4 rounded-xl ${stat.bgColor}`}>
            <div className={`flex items-center gap-2 ${stat.color}`}>
              {stat.icon}
              <span className="text-xs font-semibold uppercase">{stat.label}</span>
            </div>
            <div className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm công việc..."
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Priority filter */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as TaskPriority | 'all')}
          className="px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
        >
          <option value="all">Tất cả ưu tiên</option>
          <option value="urgent">🔴 Khẩn cấp</option>
          <option value="high">🟠 Cao</option>
          <option value="medium">🔵 Trung bình</option>
          <option value="low">⚪ Thấp</option>
        </select>

        {/* Project filter */}
        <select
          value={filterProjectId}
          onChange={(e) => setFilterProjectId(e.target.value)}
          className="px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 max-w-[220px] truncate"
        >
          <option value="all">Tất cả dự án</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {viewMode === 'my-tasks' && (
            <MyTasksView tasks={filteredTasks} statuses={statuses} onSelect={handleSelectTask} onToggleComplete={handleToggleComplete} />
          )}
          {viewMode === 'board' && (
            <BoardView tasks={filteredTasks} statuses={statuses} onSelect={handleSelectTask} onToggleComplete={handleToggleComplete} onUpdateStatus={handleUpdateStatus} />
          )}
          {viewMode === 'table' && (
            <TableView tasks={filteredTasks} statuses={statuses} onSelect={handleSelectTask} onToggleComplete={handleToggleComplete} />
          )}
          {viewMode === 'calendar' && (
            <CalendarView tasks={filteredTasks} statuses={statuses} onSelect={handleSelectTask} />
          )}
          {viewMode === 'gantt' && (
            <GanttView tasks={filteredTasks} statuses={statuses} onSelect={handleSelectTask} />
          )}
        </>
      )}
    </div>
  );
};

export default TasksPage;
