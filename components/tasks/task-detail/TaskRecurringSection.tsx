// TaskRecurringSection — Cài đặt lịch lặp công việc (T7.5)
import React, { useState, useCallback } from 'react';
import { RefreshCw, Plus, X, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { TaskService } from '../../../services/taskService';
import { addDays, addWeeks, addMonths, addYears, format } from 'date-fns';
import type { Task, RecurrenceRule, RecurrenceFrequency } from '../../../types/taskTypes';

interface TaskRecurringSectionProps {
  task: Task;
  onUpdate: () => void;
}

const FREQ_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily', label: 'Hàng ngày' },
  { value: 'weekly', label: 'Hàng tuần' },
  { value: 'monthly', label: 'Hàng tháng' },
  { value: 'yearly', label: 'Hàng năm' },
];

const DAYS_OF_WEEK = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function nextOccurrence(task: Task, rule: RecurrenceRule): { start_date?: string; due_date?: string } {
  const base = task.due_date ? new Date(task.due_date) : new Date();
  let next: Date;
  switch (rule.frequency) {
    case 'daily':   next = addDays(base, rule.interval); break;
    case 'weekly':  next = addWeeks(base, rule.interval); break;
    case 'monthly': next = addMonths(base, rule.interval); break;
    case 'yearly':  next = addYears(base, rule.interval); break;
  }
  const diff = task.start_date && task.due_date
    ? new Date(task.due_date).getTime() - new Date(task.start_date).getTime()
    : 0;
  const nextStart = diff > 0 ? new Date(next.getTime() - diff) : undefined;
  return {
    due_date: format(next, 'yyyy-MM-dd'),
    start_date: nextStart ? format(nextStart, 'yyyy-MM-dd') : undefined,
  };
}

const TaskRecurringSection: React.FC<TaskRecurringSectionProps> = ({ task, onUpdate }) => {
  const rule: RecurrenceRule | null = (task.recurrence_rule as RecurrenceRule) || null;
  const [editing, setEditing] = useState(false);
  const [freq, setFreq] = useState<RecurrenceFrequency>(rule?.frequency || 'weekly');
  const [interval, setInterval] = useState(rule?.interval || 1);
  const [endDate, setEndDate] = useState(rule?.end_date || '');
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newRule: RecurrenceRule = { frequency: freq, interval, end_date: endDate || undefined };
      await TaskService.update(task.id, { recurrence_rule: newRule } as any);
      toast.success('Đã lưu lịch lặp');
      setEditing(false);
      onUpdate();
    } catch (err: any) {
      toast.error('Lỗi: ' + err.message);
    } finally { setSaving(false); }
  };

  const handleRemove = async () => {
    if (!confirm('Xóa lịch lặp?')) return;
    try {
      await TaskService.update(task.id, { recurrence_rule: null } as any);
      toast.success('Đã xóa lịch lặp');
      onUpdate();
    } catch (err: any) { toast.error('Lỗi: ' + err.message); }
  };

  const handleCreateNext = async () => {
    if (!rule) return;
    setCloning(true);
    try {
      const dates = nextOccurrence(task, rule);
      const { id, created_at, updated_at, status, subtasks, links, comments_count, ...rest } = task as any;
      await TaskService.create({
        ...rest,
        title: task.title,
        start_date: dates.start_date,
        due_date: dates.due_date,
        completed_at: undefined,
        recurrence_parent_id: task.id,
        recurrence_rule: rule,
      });
      toast.success('Đã tạo công việc tiếp theo!');
      onUpdate();
    } catch (err: any) { toast.error('Lỗi: ' + err.message); }
    finally { setCloning(false); }
  };

  const labelCls = 'text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider';
  const inputCls = 'w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div>
      <label className={labelCls + ' flex items-center gap-1 mb-2'}>
        <RefreshCw size={10} /> Lịch lặp
      </label>

      {!rule && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors cursor-pointer"
        >
          <Plus size={12} /> Thêm lịch lặp
        </button>
      )}

      {rule && !editing && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                <CalendarClock size={13} />
                {rule.interval > 1 ? `Mỗi ${rule.interval} ` : ''}
                {FREQ_OPTIONS.find(f => f.value === rule.frequency)?.label}
              </p>
              {rule.end_date && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Kết thúc: {rule.end_date}</p>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(true)} className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">Sửa</button>
              <button onClick={handleRemove} className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 hover:underline cursor-pointer">Xóa</button>
            </div>
          </div>
          <button
            onClick={handleCreateNext}
            disabled={cloning}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Plus size={12} /> {cloning ? 'Đang tạo…' : 'Tạo lần tiếp theo'}
          </button>
        </div>
      )}

      {editing && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls + ' mb-1 block'}>Tần suất</label>
              <select value={freq} onChange={e => setFreq(e.target.value as RecurrenceFrequency)} className={inputCls}>
                {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls + ' mb-1 block'}>Mỗi</label>
              <input
                type="number" min={1} max={99} value={interval}
                onChange={e => setInterval(parseInt(e.target.value) || 1)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls + ' mb-1 block'}>Ngày kết thúc (tùy chọn)</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="flex-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 transition-colors cursor-pointer disabled:opacity-50">
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button onClick={() => setEditing(false)} className="w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer">
              <X size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskRecurringSection;
