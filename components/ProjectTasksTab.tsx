import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { CheckSquare, Plus, Search, Calendar, User, AlertTriangle, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { TaskService } from '../services/taskService';
import { formatDateShort } from '../utils/formatters';
import type { Task, TaskStatus } from '../types/taskTypes';
import { useSlidePanel } from '../contexts/SlidePanelContext';
import { dataClient } from '../lib/dataClient';

const CreateTaskPanel = React.lazy(() => import('./tasks/CreateTaskPanel'));
const TaskDetailPanel = React.lazy(() => import('./tasks/TaskDetailPanel'));
const TaskTemplateModal = React.lazy(() => import('./tasks/TaskTemplateModal').then(m => ({ default: m.TaskTemplateModal })));

interface ProjectTasksTabProps {
  projectId: string;
  projectName: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
  none: 'bg-slate-300 dark:bg-slate-600',
};

const ProjectTasksTab: React.FC<ProjectTasksTabProps> = ({ projectId, projectName }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatar: string }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const { openPanel, closePanel } = useSlidePanel();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [taskList, statusList] = await Promise.all([
        TaskService.getByProjectId(projectId),
        TaskService.getStatuses(),
      ]);
      setTasks(taskList);
      setStatuses(statusList);

      // Fetch user
      const { data: userData } = await dataClient.auth.getUser();
      if (userData?.user) setCurrentUser(userData.user.id);

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
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (task: Task) => {
    try {
      if (task.status?.is_done) {
        const defaultId = await TaskService.getDefaultStatusId();
        if (defaultId) await TaskService.update(task.id, { status_id: defaultId, completed_at: undefined, completed_by: undefined });
      } else {
        await TaskService.complete(task.id, currentUser);
      }
      loadData();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  const handleAddTask = () => {
    if (!currentUser) return;
    openPanel({
      title: 'Thêm công việc cho dự án',
      component: (
        <Suspense fallback={<div className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>}>
          <CreateTaskPanel
            currentUserId={currentUser}
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

  const doneStatusIds = statuses.filter(s => s.is_done).map(s => s.id);
  const filtered = tasks.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()));
  const activeTasks = filtered.filter(t => !doneStatusIds.includes(t.status_id || ''));
  const doneTasks = filtered.filter(t => doneStatusIds.includes(t.status_id || ''));

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
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
          >
            <Copy size={13} /> Mẫu
          </button>
          <button
            onClick={handleAddTask}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-[1.02] active:scale-95"
          >
            <Plus size={14} /> Thêm công việc
          </button>
        </div>
      </div>

      {/* Search */}
      {tasks.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm công việc..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
          />
        </div>
      )}

      {/* Task List */}
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
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all"
          >
            <Plus size={14} /> Tạo công việc
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Active */}
          {activeTasks.map((task, idx) => {
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed_at;
            const statusObj = statuses.find(s => s.id === task.status_id);
            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group ${idx > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}
                onClick={() => handleOpenTask(task)}
              >
                {/* Checkbox */}
                <button
                  onClick={e => { e.stopPropagation(); handleToggle(task); }}
                  className="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-400 flex-shrink-0 transition-colors"
                />

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
                {task.assignees?.length > 0 && (
                  <div className="flex -space-x-1.5 flex-shrink-0">
                    {task.assignees.slice(0, 2).map(id => {
                      const p = profiles[id];
                      return (
                        <div key={id} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center overflow-hidden" title={p?.name}>
                          {p?.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">{p?.name?.charAt(0) || <User size={10}/>}</span>}
                        </div>
                      );
                    })}
                    {task.assignees.length > 2 && (
                      <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-500">+{task.assignees.length - 2}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Done */}
          {doneTasks.length > 0 && (
            <details className="border-t border-slate-100 dark:border-slate-800">
              <summary className="px-4 py-3 text-xs font-bold text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors bg-slate-50/50 dark:bg-slate-800/30">
                ✅ {doneTasks.length} đã hoàn thành
              </summary>
              {doneTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-4 py-2.5 opacity-50 hover:opacity-80 transition-opacity cursor-pointer border-t border-slate-50 dark:border-slate-800/50"
                  onClick={() => handleOpenTask(task)}
                >
                  <button
                    onClick={e => { e.stopPropagation(); handleToggle(task); }}
                    className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center flex-shrink-0"
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
