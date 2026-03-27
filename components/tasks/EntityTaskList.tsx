import React, { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Plus, ExternalLink, AlertTriangle, Calendar, User, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { TaskService } from '../../services/taskService';
import { formatDateShort } from '../../utils/formatters';
import type { Task, TaskStatus } from '../../types/taskTypes';
import { useSlidePanel } from '../../contexts/SlidePanelContext';
import CreateTaskPanel from './CreateTaskPanel';
import { TaskTemplateModal } from './TaskTemplateModal';
import { useTaskVisibility } from '../../hooks/useTaskVisibility';
import { dataClient } from '../../lib/dataClient';

interface EntityTaskListProps {
  entityType: string;
  entityId: string;
  entityLabel?: string;
  className?: string;
}

const EntityTaskList: React.FC<EntityTaskListProps> = ({
  entityType,
  entityId,
  entityLabel,
  className = '',
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [profiles, setProfiles] = useState<Record<string, {name: string, avatar: string}>>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const { openPanel, closePanel } = useSlidePanel();
  const { visibilityContext } = useTaskVisibility();

  const loadData = useCallback(async () => {
    try {
      const [taskList, statusList] = await Promise.all([
        TaskService.getByEntityLink(entityType, entityId, visibilityContext),
        TaskService.getStatuses(),
      ]);
      setTasks(taskList);
      setStatuses(statusList);

      // Fetch user profile
      const { data: userData } = await dataClient.auth.getUser();
      if (userData?.user) setCurrentUser(userData.user.id);

      // Get unique employee IDs
      const empIds = new Set<string>();
      taskList.forEach(t => {
        t.assignees?.forEach(id => empIds.add(id));
      });

      if (empIds.size > 0) {
        const { data: emps } = await dataClient
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', Array.from(empIds));
        
        const profileMap: Record<string, any> = {};
        if (emps) {
          emps.forEach((emp: any) => {
            profileMap[emp.id] = { name: emp.full_name, avatar: emp.avatar_url };
          });
        }
        setProfiles(profileMap);
      }
    } catch (err) {
      console.error('Failed to load entity tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, visibilityContext]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleAddTaskClick = () => {
    if (!currentUser) return;
    openPanel({
      title: 'Thêm công việc',
      component: <CreateTaskPanel
        currentUserId={currentUser}
        initialData={{ source_module: entityType, source_entity_id: entityId }}
        onTaskCreated={() => {
          loadData();
          closePanel();
        }}
        onClose={() => closePanel()}
      />
    });
  };

  const doneStatusIds = statuses.filter(s => s.is_done).map(s => s.id);
  const activeTasks = tasks.filter(t => !doneStatusIds.includes(t.status_id || ''));
  const doneTasks = tasks.filter(t => doneStatusIds.includes(t.status_id || ''));

  const renderAssignees = (assignees: string[]) => {
    if (!assignees || assignees.length === 0) return null;
    return (
      <div className="flex items-center -space-x-1.5 ml-2">
        {assignees.slice(0, 3).map(id => {
          const profile = profiles[id];
          return (
            <div key={id} className="w-5 h-5 rounded-full border border-white dark:border-slate-800 bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center overflow-hidden" title={profile?.name}>
              {profile?.avatar ? (
                 <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[8px] font-bold text-indigo-700 dark:text-indigo-400">
                  {profile?.name?.charAt(0) || <User size={10} />}
                </span>
              )}
            </div>
          );
        })}
        {assignees.length > 3 && (
          <div className="w-5 h-5 rounded-full border border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-600 dark:text-slate-400">
            +{assignees.length - 3}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400" />
          Công việc liên quan
          {tasks.length > 0 && (
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/50 px-2 py-0.5 rounded-full">
              {activeTasks.length}/{tasks.length}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            title="Áp dụng mẫu công việc có sẵn"
          >
            <Copy size={13} /> Mẫu
          </button>
          <button
            onClick={handleAddTaskClick}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            <Plus size={14} /> Thêm việc
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700/50 rounded-lg" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <CheckSquare size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có công việc nào</p>
          <button onClick={handleAddTaskClick} className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline mt-1">
            Tạo công việc đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Active tasks */}
          {activeTasks.map(task => {
            const isOverdue = task.due_date && new Date(task.due_date) < new Date();
            return (
              <div
                key={task.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
              >
                <button
                  onClick={() => handleToggle(task)}
                  className="w-4 h-4 rounded border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 flex-shrink-0 transition-colors"
                />
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate pr-2">{task.title}</span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {task.due_date && (
                      <span className={`text-[10px] flex items-center gap-1 font-semibold ${isOverdue ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-md' : 'text-slate-400 dark:text-slate-500'}`}>
                        {isOverdue && <AlertTriangle size={10} />}
                        {formatDateShort(task.due_date)}
                      </span>
                    )}
                    {renderAssignees(task.assignees)}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Done tasks (collapsed) */}
          {doneTasks.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs font-semibold text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors inline-block mb-1">
                {doneTasks.length} đã hoàn thành
              </summary>
              <div className="space-y-1">
                {doneTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2.5 px-3 py-2 opacity-60">
                    <button
                      onClick={() => handleToggle(task)}
                      className="w-4 h-4 rounded bg-emerald-500 dark:bg-emerald-600 border-emerald-500 dark:border-emerald-600 flex items-center justify-center flex-shrink-0"
                    >
                      <CheckSquare size={10} className="text-white" />
                    </button>
                    <span className="flex-1 text-sm text-slate-500 dark:text-slate-400 line-through truncate">{task.title}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {isTemplateModalOpen && (
         <TaskTemplateModal 
            isOpen={isTemplateModalOpen} 
            onClose={() => setIsTemplateModalOpen(false)} 
            entityType={entityType} 
            entityId={entityId} 
            onApplied={(count) => {
              if (count > 0) loadData();
            }} 
         />
      )}
    </div>
  );
};

export default EntityTaskList;
