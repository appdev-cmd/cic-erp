import React, { useState } from 'react';
import { Clock, Calendar, CheckSquare, Plus } from 'lucide-react';
import { Task, TaskStatus } from '../../../types/taskTypes';
import { formatDate } from '../../../utils/formatters';
import { QuickTaskInput, DeadlineInput, PersonAvatar } from '../TasksPageSubComponents';
import PeoplePickerPopover from '../PeoplePickerPopover';

type DeadlineColumnKey = 'later' | 'overdue' | 'today' | 'this_week' | 'next_week' | 'no_deadline';

export const DeadlineView: React.FC<{
  tasks: Task[];
  statuses: TaskStatus[];
  employees: Record<string, { name: string; avatar?: string }>;
  onSelect: (id: string) => void;
  onToggleComplete: (task: Task) => void;
  onQuickCreate: (title: string, tags: string[], dueDate?: string) => Promise<void>;
  onUpdateDeadline: (taskId: string, deadline: string | null) => void;
  onUpdateAssignee: (taskId: string, assigneeIds: string[]) => void;
}> = ({ tasks, statuses, employees, onSelect, onToggleComplete, onQuickCreate, onUpdateDeadline, onUpdateAssignee }) => {
  // Helper: format Date to local YYYY-MM-DD (avoids UTC shift from toISOString)
  const localDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);
  
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  const endOfWeekStr = localDateStr(endOfWeek);
  
  const endOfNextWeek = new Date(endOfWeek);
  endOfNextWeek.setDate(endOfWeek.getDate() + 7);
  const endOfNextWeekStr = localDateStr(endOfNextWeek);

  const doneStatusIds = new Set(statuses.filter(s => s.is_done).map(s => s.id));
  const activeTasks = tasks.filter(t => !doneStatusIds.has(t.status_id || ''));

  // Helper: extract local YYYY-MM-DD from any ISO timestamp
  const toDateStr = (d?: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return localDateStr(dt);
  };

  const [dragOverCol, setDragOverCol] = useState<DeadlineColumnKey | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [editingAssigneeTaskId, setEditingAssigneeTaskId] = useState<string | null>(null);
  const [editingDeadlineTaskId, setEditingDeadlineTaskId] = useState<string | null>(null);

  // Compute target deadline for a drop or quick-create
  const getDeadlineForColumn = (colKey: DeadlineColumnKey): string | null => {
    const now = new Date();
    now.setHours(9, 0, 0, 0); // default 09:00
    switch (colKey) {
      case 'overdue': return null;
      case 'today':
        now.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
        return now.toISOString();
      case 'this_week': {
        const wed = new Date(today);
        const dayOfWeek = today.getDay();
        const daysToWed = dayOfWeek <= 3 ? 3 - dayOfWeek : 7 - dayOfWeek + 3;
        wed.setDate(today.getDate() + Math.max(daysToWed, 1));
        wed.setHours(9, 0, 0, 0);
        return wed.toISOString();
      }
      case 'next_week': {
        const monday = new Date(endOfWeek);
        monday.setDate(endOfWeek.getDate() + 1);
        monday.setHours(9, 0, 0, 0);
        return monday.toISOString();
      }
      case 'later': {
        const futureMonday = new Date(endOfWeek);
        futureMonday.setDate(endOfWeek.getDate() + 8);
        futureMonday.setHours(9, 0, 0, 0);
        return futureMonday.toISOString();
      }
      case 'no_deadline':
        return null;
      default: return null;
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, colKey: DeadlineColumnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colKey) setDragOverCol(colKey);
  };

  const handleDragLeave = (e: React.DragEvent, colKey: DeadlineColumnKey) => {
    const relatedTarget = e.relatedTarget as Node | null;
    const currentTarget = e.currentTarget as Node;
    if (!currentTarget.contains(relatedTarget)) {
      if (dragOverCol === colKey) setDragOverCol(null);
    }
  };

  const handleDrop = (e: React.DragEvent, colKey: DeadlineColumnKey) => {
    e.preventDefault();
    setDragOverCol(null);
    setDraggingTaskId(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    if (colKey === 'no_deadline') {
      onUpdateDeadline(taskId, null);
    } else if (colKey !== 'overdue') {
      const newDeadline = getDeadlineForColumn(colKey);
      if (newDeadline) onUpdateDeadline(taskId, newDeadline);
    }
  };

  const columns: { key: DeadlineColumnKey; title: string; headerBg: string; tasks: Task[] }[] = [
    {
      key: 'overdue',
      title: 'Quá hạn',
      headerBg: 'bg-red-500',
      tasks: activeTasks.filter(t => t.due_date && toDateStr(t.due_date) < todayStr),
    },
    {
      key: 'today',
      title: 'Hôm nay',
      headerBg: 'bg-amber-500',
      tasks: activeTasks.filter(t => toDateStr(t.due_date) === todayStr),
    },
    {
      key: 'this_week',
      title: 'Tuần này',
      headerBg: 'bg-emerald-500',
      tasks: activeTasks.filter(t => t.due_date && toDateStr(t.due_date) > todayStr && toDateStr(t.due_date) <= endOfWeekStr),
    },
    {
      key: 'next_week',
      title: 'Tuần sau',
      headerBg: 'bg-blue-500',
      tasks: activeTasks.filter(t => t.due_date && toDateStr(t.due_date) > endOfWeekStr && toDateStr(t.due_date) <= endOfNextWeekStr),
    },
    {
      key: 'no_deadline',
      title: 'Không có deadline',
      headerBg: 'bg-slate-400',
      tasks: activeTasks.filter(t => !t.due_date),
    },
    {
      key: 'later',
      title: 'Hơn 2 tuần nữa',
      headerBg: 'bg-purple-500',
      tasks: activeTasks.filter(t => t.due_date && toDateStr(t.due_date) > endOfNextWeekStr),
    },
  ];

  return (
    <div className="flex gap-2 pb-4" style={{ minHeight: '60vh' }}>
      {columns.map(col => (
        <div
          key={col.key}
          className={`flex-1 min-w-0 transition-all duration-200 ${
            dragOverCol === col.key ? 'scale-[1.02]' : ''
          }`}
          onDragOver={(e) => handleDragOver(e, col.key)}
          onDragLeave={(e) => handleDragLeave(e, col.key)}
          onDrop={(e) => handleDrop(e, col.key)}
        >
          {/* Column header */}
          <div className={`${col.headerBg} text-white text-sm font-bold px-3 py-2 rounded-t-xl flex items-center justify-between`}>
            <span>{col.title}</span>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{col.tasks.length}</span>
          </div>

          {/* Cards + drop zone */}
          <div className={`bg-slate-50 dark:bg-slate-800 rounded-b-xl p-2 space-y-2 min-h-[200px] transition-all duration-200 ${
            dragOverCol === col.key
              ? 'ring-2 ring-indigo-400 dark:ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
              : ''
          }`}>
            {/* Quick add */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-1.5">
              <QuickTaskInput
                onCreateTask={(title, tags) => onQuickCreate(title, tags, getDeadlineForColumn(col.key) || undefined)}
                placeholder="+ Thêm nhanh"
              />
            </div>

            {col.tasks.map(task => {
              const assignee = task.assignees?.[0] ? employees[task.assignees[0]] : null;
              const isOverdue = task.due_date && task.due_date < todayStr;
              const isDragging = draggingTaskId === task.id;

              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelect(task.id)}
                  className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3 cursor-grab hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all group active:cursor-grabbing ${
                    isDragging ? 'opacity-40 scale-95' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleComplete(task); }}
                      className="w-4 h-4 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all cursor-pointer border-slate-300 dark:border-slate-600 hover:border-indigo-400"
                    >
                      {task.status?.is_done && <CheckSquare size={10} className="text-emerald-500" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">{task.title}</h4>
                      {/* Tags */}
                      {task.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {task.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] text-indigo-500 dark:text-indigo-400">#{tag}</span>
                          ))}
                        </div>
                      )}
                      {/* Deadline badge */}
                      <div className="relative mt-1.5" onClick={e => e.stopPropagation()}>
                        {editingDeadlineTaskId === task.id ? (
                          <div className="absolute top-0 left-0 z-50 min-w-[180px]">
                            <DeadlineInput
                              currentValue={task.due_date || ''}
                              onSave={(val) => { onUpdateDeadline(task.id, val || null); setEditingDeadlineTaskId(null); }}
                              onClose={() => setEditingDeadlineTaskId(null)}
                            />
                          </div>
                        ) : task.due_date ? (
                          <button
                            onClick={() => setEditingDeadlineTaskId(task.id)}
                            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${
                              isOverdue
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            }`}
                            title="Bấm để đổi deadline"
                          >
                            {formatDate(task.due_date)}
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingDeadlineTaskId(task.id)}
                            className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                            title="Bấm để đặt deadline"
                          >
                            <Calendar size={12} /> Đặt dl
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Footer: assignees — clickable to change */}
                  <div className="flex items-center gap-1 mt-2 -ml-1 relative" onClick={e => e.stopPropagation()}>
                    {task.assignees.length > 0 ? (
                      task.assignees.slice(0, 3).map(id => {
                        const emp = employees[id];
                        return emp ? (
                          <button
                            key={id}
                            onClick={() => setEditingAssigneeTaskId(editingAssigneeTaskId === task.id ? null : task.id)}
                            className="cursor-pointer hover:ring-2 hover:ring-indigo-400 rounded-full transition-all"
                            title="Bấm để đổi người phụ trách"
                          >
                            <PersonAvatar name={emp.name} avatar={emp.avatar} size={22} />
                          </button>
                        ) : null;
                      })
                    ) : (
                      <button
                        onClick={() => setEditingAssigneeTaskId(editingAssigneeTaskId === task.id ? null : task.id)}
                        className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 cursor-pointer transition-colors flex items-center gap-0.5"
                      >
                        <Plus size={10} /> Giao việc
                      </button>
                    )}
                    {editingAssigneeTaskId === task.id && (
                      <PeoplePickerPopover
                        currentIds={task.assignees || []}
                        onChange={(newIds) => { onUpdateAssignee(task.id, newIds); setEditingAssigneeTaskId(null); }}
                        onClose={() => setEditingAssigneeTaskId(null)}
                        align="left"
                        minSelections={0}
                        singleSelect
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Drop placeholder when empty and dragging */}
            {col.tasks.length === 0 && !draggingTaskId && (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <Clock size={28} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">Chưa có công việc</p>
              </div>
            )}
            {draggingTaskId && col.tasks.length === 0 && (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 border-2 border-dashed border-indigo-300 dark:border-indigo-600 rounded-lg">
                <p className="text-xs font-medium text-indigo-500 dark:text-indigo-400">Thả vào đây</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
