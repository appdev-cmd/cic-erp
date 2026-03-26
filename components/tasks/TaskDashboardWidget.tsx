import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Clock, CheckCircle2, Loader2,
  ChevronRight, ListChecks, Users
} from 'lucide-react';
import { TaskService } from '../../services/taskService';
import { useTaskVisibility } from '../../hooks/useTaskVisibility';
import { formatDateShort } from '../../utils/formatters';
import type { Task, TaskStatus, TaskVisibilityContext } from '../../types/taskTypes';

// ═══════════════════════════════════════
// PRIORITY CONFIG
// ═══════════════════════════════════════
const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
  none: 'bg-slate-300',
};

// ═══════════════════════════════════════
// TASK DASHBOARD WIDGET
// ═══════════════════════════════════════
const TaskDashboardWidget: React.FC = () => {
  const navigate = useNavigate();
  const { getMyTasks, isManager, visibilityContext } = useTaskVisibility();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamStats, setTeamStats] = useState<{
    totals: { total: number; overdue: number; inProgress: number; completed: number };
    topOverdue: { id: string; name: string; overdue: number }[];
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [statusList, taskList] = await Promise.all([
        TaskService.getStatuses(),
        getMyTasks(),
      ]);
      setStatuses(statusList);
      setTasks(taskList);

      // Load team stats for managers
      if (isManager) {
        try {
          const stats = await TaskService.getSubordinateStats(visibilityContext);
          setTeamStats({
            totals: stats.totals,
            topOverdue: stats.employees
              .filter(e => e.overdue > 0)
              .slice(0, 3)
              .map(e => ({ id: e.id, name: e.name, overdue: e.overdue })),
          });
        } catch { /* silent */ }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [getMyTasks, isManager, visibilityContext]);

  useEffect(() => { loadData(); }, [loadData]);

  // Listen realtime
  useEffect(() => {
    const handle = () => loadData();
    window.addEventListener('task-changed', handle);
    return () => window.removeEventListener('task-changed', handle);
  }, [loadData]);

  // Compute stats
  const today = new Date().toISOString().split('T')[0];
  const doneIds = statuses.filter(s => s.is_done).map(s => s.id);
  const activeTasks = tasks.filter(t => !doneIds.includes(t.status_id || ''));
  const overdueTasks = activeTasks.filter(t => t.due_date && t.due_date < today);
  const todayTasks = activeTasks.filter(t => t.due_date === today);
  const completedTasks = tasks.filter(t => doneIds.includes(t.status_id || ''));
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  // Most urgent: overdue first, then today, then nearest deadline
  const urgentTasks = [...overdueTasks, ...todayTasks, ...activeTasks.filter(t => t.due_date && t.due_date > today)]
    .slice(0, 5);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm dark-card-glow">
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-indigo-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm dark-card-glow">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <ListChecks size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Công việc</h3>
        </div>
        <button
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer"
        >
          Xem tất cả <ChevronRight size={14} />
        </button>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard
          label="Quá hạn"
          value={overdueTasks.length}
          icon={<AlertTriangle size={14} />}
          color="red"
        />
        <StatCard
          label="Hôm nay"
          value={todayTasks.length}
          icon={<Clock size={14} />}
          color="amber"
        />
        <StatCard
          label="Đang làm"
          value={activeTasks.length}
          icon={<Loader2 size={14} />}
          color="blue"
        />
        <StatCard
          label="Xong"
          value={completedTasks.length}
          icon={<CheckCircle2 size={14} />}
          color="emerald"
        />
      </div>

      {/* Progress Bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tiến độ tổng thể</span>
          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{completionRate}%</span>
        </div>
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-1000"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Urgent Task List */}
      {urgentTasks.length > 0 ? (
        <div className="space-y-1.5">
          {urgentTasks.map(task => {
            const isOverdue = task.due_date && task.due_date < today;
            const isToday = task.due_date === today;
            const status = statuses.find(s => s.id === task.status_id);

            return (
              <button
                key={task.id}
                onClick={() => navigate('/tasks')}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left
                  hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
              >
                {/* Priority dot */}
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.none}`} />

                {/* Title */}
                <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-300 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {task.title}
                </span>

                {/* Date badge */}
                {task.due_date && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0
                    ${isOverdue
                      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                      : isToday
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
                        : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    {formatDateShort(task.due_date)}
                  </span>
                )}

                {/* Status dot */}
                {status && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: status.color }}
                    title={status.name}
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4 text-slate-400 dark:text-slate-500">
          <CheckCircle2 size={24} className="mx-auto mb-1 opacity-50" />
          <p className="text-xs font-semibold">Không có công việc cần xử lý</p>
        </div>
      )}

      {/* ═══ TEAM SECTION (managers only) ═══ */}
      {isManager && teamStats && teamStats.totals.total > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Team</span>
            </div>
            <button
              onClick={() => navigate('/tasks')}
              className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer transition-colors"
            >
              Giám sát →
            </button>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
              <p className="text-lg font-black text-red-600 dark:text-red-400">{teamStats.totals.overdue}</p>
              <p className="text-[8px] font-bold uppercase text-red-500 dark:text-red-400 opacity-70">Quá hạn</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <p className="text-lg font-black text-blue-600 dark:text-blue-400">{teamStats.totals.inProgress}</p>
              <p className="text-[8px] font-bold uppercase text-blue-500 dark:text-blue-400 opacity-70">Đang làm</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{teamStats.totals.completed}</p>
              <p className="text-[8px] font-bold uppercase text-emerald-500 dark:text-emerald-400 opacity-70">Xong</p>
            </div>
          </div>

          {/* Top overdue employees */}
          {teamStats.topOverdue.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">NV quá hạn nhiều nhất</p>
              {teamStats.topOverdue.map(emp => (
                <div key={emp.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{emp.name}</span>
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                    {emp.overdue} quá hạn
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// STAT CARD (mini)
// ═══════════════════════════════════════
const StatCard: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'red' | 'amber' | 'blue' | 'emerald';
}> = ({ label, value, icon, color }) => {
  const styles: Record<string, string> = {
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  };

  return (
    <div className={`p-2.5 rounded-lg text-center ${styles[color]}`}>
      <div className="flex items-center justify-center mb-1">{icon}</div>
      <p className="text-lg font-black leading-none">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5 opacity-70">{label}</p>
    </div>
  );
};

export default TaskDashboardWidget;
