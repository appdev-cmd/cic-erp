import React, { useState } from 'react';
import { Clock, Calendar, CheckSquare } from 'lucide-react';
import { Task, TaskStatus } from '../../../types/taskTypes';
import { formatDate } from '../../../utils/formatters';
import { 
  PRIORITY_CONFIG, 
  QuickTaskInput, 
  PersonAvatar 
} from '../TasksPageSubComponents';

export const PlannerView: React.FC<{
  tasks: Task[];
  statuses: TaskStatus[];
  employees: Record<string, { name: string; avatar?: string }>;
  onSelect: (id: string) => void;
  onToggleComplete: (task: Task) => void;
  onQuickCreate: (title: string, tags: string[]) => Promise<void>;
}> = ({ tasks, statuses, employees, onSelect, onToggleComplete, onQuickCreate }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  const endOfWeekStr = endOfWeek.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const doneStatusIds = new Set(statuses.filter(s => s.is_done).map(s => s.id));
  const activeTasks = tasks.filter(t => !doneStatusIds.has(t.status_id || ''));

  const thisWeekTasks = activeTasks.filter(t => t.due_date && t.due_date >= todayStr && t.due_date <= endOfWeekStr);
  const notPlannedTasks = activeTasks.filter(t => !t.due_date || t.due_date > endOfWeekStr || t.due_date < todayStr);

  const [editingDeadlineTaskId, setEditingDeadlineTaskId] = useState<string | null>(null);

  const plannerColumns = [
    { title: 'Chưa lên kế hoạch', icon: <Clock size={15} />, headerClass: 'bg-slate-500', tasks: notPlannedTasks },
    { title: 'Làm tuần này', icon: <Calendar size={15} />, headerClass: 'bg-indigo-500', tasks: thisWeekTasks },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ minHeight: '60vh' }}>
      {plannerColumns.map(col => (
        <div key={col.title} className="flex flex-col">
          <div className={`${col.headerClass} text-white text-sm font-bold px-4 py-2.5 rounded-t-xl flex items-center justify-between`}>
            <span className="flex items-center gap-2">{col.icon} {col.title}</span>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{col.tasks.length}</span>
          </div>
          <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-b-xl p-3 space-y-2 min-h-[200px]">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-1.5">
              <QuickTaskInput onCreateTask={(title, tags) => onQuickCreate(title, tags)} placeholder="+ Thêm nhanh" />
            </div>
            {col.tasks.map(task => {
              const assignee = task.assignees?.[0] ? employees[task.assignees[0]] : null;
              const priorityConf = PRIORITY_CONFIG[task.priority];
              return (
                <div key={task.id} onClick={() => onSelect(task.id)} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }} className="w-4 h-4 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer border-slate-300 dark:border-slate-600 hover:border-indigo-400">
                      {task.status?.is_done && <CheckSquare size={10} className="text-emerald-500" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">{task.title}</h4>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${priorityConf.bg} ${priorityConf.darkBg} ${priorityConf.color} ${priorityConf.darkColor}`}>
                          {priorityConf.label}
                        </span>
                        {task.due_date && <span className="text-[10px] text-slate-500 dark:text-slate-400">{formatDate(task.due_date)}</span>}
                      </div>
                      {task.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {task.tags.slice(0, 3).map(tag => (<span key={tag} className="text-[10px] text-indigo-500 dark:text-indigo-400">#{tag}</span>))}
                        </div>
                      )}
                    </div>
                    {assignee && <PersonAvatar name={assignee.name} avatar={assignee.avatar} size={24} />}
                  </div>
                </div>
              );
            })}
            {col.tasks.length === 0 && (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <Clock size={28} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">Chưa có công việc</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
