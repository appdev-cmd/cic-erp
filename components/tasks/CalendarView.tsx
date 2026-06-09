import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, CircleDot } from 'lucide-react';
import type { Task, TaskStatus, TaskPriority } from '../../types/taskTypes';

// ═══════════════════════════════════════
// PRIORITY DOT COLORS
// ═══════════════════════════════════════
const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
  none: 'bg-slate-300',
};

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Returns 0=Mon … 6=Sun for day-of-week of the 1st */
function getFirstDayOfWeek(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Convert Sun=0→6, Mon=1→0
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ═══════════════════════════════════════
// CALENDAR VIEW
// ═══════════════════════════════════════
interface CalendarViewProps {
  tasks: Task[];
  statuses: TaskStatus[];
  onSelect: (id: string) => void;
  onUpdateDates?: (taskId: string, newDueDate: string) => Promise<void>;
}

const CalendarView: React.FC<CalendarViewProps> = ({ tasks, statuses, onSelect, onUpdateDates }) => {
  const today = new Date();
  const todayKey = toDateKey(today);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  // Group tasks by due_date
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!task.due_date) continue;
      const key = task.due_date; // Already 'YYYY-MM-DD'
      if (!map[key]) map[key] = [];
      map[key].push(task);
    }
    return map;
  }, [tasks]);

  // Calendar grid
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfWeek(year, month);

  // Previous month fill
  const prevMonthDays = getDaysInMonth(year, month === 0 ? 11 : month - 1);

  // Navigate
  const goToPrev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const goToNext = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  // Build cells
  type CellData = { day: number; dateKey: string; isCurrentMonth: boolean; isToday: boolean; isWeekend: boolean; tasks: Task[] };
  const cells: CellData[] = [];

  // Previous month
  for (let i = firstDayOffset - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateKey, isCurrentMonth: false, isToday: dateKey === todayKey, isWeekend: false, tasks: tasksByDate[dateKey] || [] });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = (firstDayOffset + d - 1) % 7; // 0=Mon…6=Sun
    const isWeekend = dayOfWeek >= 5;
    cells.push({ day: d, dateKey, isCurrentMonth: true, isToday: dateKey === todayKey, isWeekend, tasks: tasksByDate[dateKey] || [] });
  }

  // Next month fill (to complete 6 rows)
  const totalCells = Math.ceil(cells.length / 7) * 7;
  for (let d = 1; cells.length < totalCells; d++) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateKey, isCurrentMonth: false, isToday: dateKey === todayKey, isWeekend: false, tasks: tasksByDate[dateKey] || [] });
  }

  // Count tasks with no due date
  const noDueDateCount = tasks.filter(t => !t.due_date).length;

  return (
    <div className="space-y-4">
      {/* ─── Calendar Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
          >
            Hôm nay
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={goToPrev}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goToNext}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* ─── Calendar Grid ─── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`py-2.5 text-center text-xs font-bold uppercase tracking-wider
                ${i >= 5
                  ? 'text-red-400 dark:text-red-500'
                  : 'text-slate-500 dark:text-slate-400'
                }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell, idx) => {
            const hasOverdue = cell.isCurrentMonth && cell.tasks.some(
              t => !t.completed_at && cell.dateKey < todayKey
            );

            return (
              <div
                key={idx}
                className={`min-h-[100px] border-b border-r border-slate-100 dark:border-slate-800 p-1.5 transition-colors
                  ${!cell.isCurrentMonth
                    ? 'bg-slate-50/50 dark:bg-slate-900'
                    : cell.isWeekend
                      ? 'bg-slate-50/30 dark:bg-slate-800'
                      : ''
                  }
                  ${cell.isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}
                  ${hasOverdue ? 'bg-red-50/30 dark:bg-red-900/10' : ''}
                  ${dragOverDate === cell.dateKey ? 'ring-2 ring-inset ring-indigo-400 dark:ring-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/20' : ''}
                `}
                onDragOver={onUpdateDates ? (e) => { e.preventDefault(); setDragOverDate(cell.dateKey); } : undefined}
                onDragLeave={onUpdateDates ? () => setDragOverDate(null) : undefined}
                onDrop={onUpdateDates ? async (e) => {
                  e.preventDefault();
                  setDragOverDate(null);
                  const taskId = e.dataTransfer.getData('taskId');
                  if (!taskId || !cell.isCurrentMonth) return;
                  try { await onUpdateDates(taskId, cell.dateKey); } catch {}
                  setDraggingTaskId(null);
                } : undefined}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
                      ${cell.isToday
                        ? 'bg-indigo-600 text-white'
                        : !cell.isCurrentMonth
                          ? 'text-slate-300 dark:text-slate-600'
                          : cell.isWeekend
                            ? 'text-red-400 dark:text-red-500'
                            : 'text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    {cell.day}
                  </span>
                  {cell.tasks.length > 3 && (
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      +{cell.tasks.length - 3}
                    </span>
                  )}
                </div>

                {/* Task pills (max 3) */}
                <div className="space-y-0.5">
                  {cell.tasks.slice(0, 3).map(task => {
                    const status = statuses.find(s => s.id === task.status_id);
                    const isDone = task.status?.is_done || status?.is_done;

                    return (
                      <button
                        key={task.id}
                        draggable={!!onUpdateDates}
                        onDragStart={onUpdateDates ? (e) => {
                          e.dataTransfer.setData('taskId', task.id);
                          setDraggingTaskId(task.id);
                        } : undefined}
                        onDragEnd={() => setDraggingTaskId(null)}
                        onClick={() => onSelect(task.id)}
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] leading-tight truncate transition-all cursor-pointer group
                          ${isDone
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 line-through opacity-60 hover:opacity-100'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-400'
                          }
                          ${draggingTaskId === task.id ? 'opacity-50 scale-95' : ''}
                        `}
                        title={task.title}
                      >
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                          <span className="truncate">{task.title}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Footer: tasks without due date ─── */}
      {noDueDateCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
          <span className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-700 dark:text-slate-300">{noDueDateCount}</span> công việc chưa có deadline
          </span>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
