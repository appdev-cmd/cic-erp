// ============================================================
// Leave Calendar — Monthly grid showing team leave schedule
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { LeaveService } from '../../services/leaveService';
import type { LeaveRequest, LeavePolicy } from '../../types/hrmTypes';

interface LeaveCalendarProps {
  unitId: string | null;
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const LEAVE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  annual:      { bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-300',    dot: 'bg-blue-500' },
  sick:        { bg: 'bg-red-100 dark:bg-red-900/30',      text: 'text-red-700 dark:text-red-300',      dot: 'bg-red-500' },
  unpaid:      { bg: 'bg-slate-100 dark:bg-slate-800',     text: 'text-slate-600 dark:text-slate-300',  dot: 'bg-slate-500' },
  maternity:   { bg: 'bg-pink-100 dark:bg-pink-900/30',    text: 'text-pink-700 dark:text-pink-300',    dot: 'bg-pink-500' },
  paternity:   { bg: 'bg-cyan-100 dark:bg-cyan-900/30',    text: 'text-cyan-700 dark:text-cyan-300',    dot: 'bg-cyan-500' },
  wedding:     { bg: 'bg-amber-100 dark:bg-amber-900/30',  text: 'text-amber-700 dark:text-amber-300',  dot: 'bg-amber-500' },
  bereavement: { bg: 'bg-purple-100 dark:bg-purple-900/30',text: 'text-purple-700 dark:text-purple-300',dot: 'bg-purple-500' },
  other:       { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
};

const LeaveCalendar: React.FC<LeaveCalendarProps> = ({ unitId }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [data, pols] = await Promise.all([
          LeaveService.getTeamCalendar(unitId, year, month),
          LeaveService.getPolicies(),
        ]);
        setLeaves(data);
        setPolicies(pols);
      } catch (e) {
        console.error('Failed to load calendar:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [unitId, year, month]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();

    // Monday = 0, Sunday = 6
    let startWeekday = firstDay.getDay() - 1;
    if (startWeekday < 0) startWeekday = 6;

    const days: (number | null)[] = [];
    // Add empty cells for days before month starts
    for (let i = 0; i < startWeekday; i++) days.push(null);
    // Add actual days
    for (let d = 1; d <= totalDays; d++) days.push(d);
    // Fill remaining cells
    while (days.length % 7 !== 0) days.push(null);

    return days;
  }, [year, month]);

  // Map: day number → leave requests
  const dayLeaveMap = useMemo(() => {
    const map: Record<number, { request: LeaveRequest; name: string; type: string }[]> = {};
    for (const req of leaves) {
      const start = new Date(req.start_date);
      const end = new Date(req.end_date);
      const current = new Date(Math.max(start.getTime(), new Date(year, month - 1, 1).getTime()));
      const last = new Date(Math.min(end.getTime(), new Date(year, month, 0).getTime()));

      while (current <= last) {
        const day = current.getDate();
        if (!map[day]) map[day] = [];
        map[day].push({
          request: req,
          name: req.employee_name || 'N/A',
          type: req.leave_type,
        });
        current.setDate(current.getDate() + 1);
      }
    }
    return map;
  }, [leaves, year, month]);

  const navigateMonth = (dir: number) => {
    let newMonth = month + dir;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const monthLabel = new Date(year, month - 1).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  const today = new Date();
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
  const isWeekend = (idx: number) => idx % 7 >= 5;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">
          {monthLabel}
        </h3>
        <button
          onClick={() => navigateMonth(1)}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`py-2.5 text-center text-xs font-semibold ${
              i >= 5
                ? 'text-red-400 dark:text-red-500'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          const leavesOnDay = day ? dayLeaveMap[day] || [] : [];
          const weekend = isWeekend(idx);
          const todayFlag = day ? isToday(day) : false;

          return (
            <div
              key={idx}
              className={`
                min-h-[80px] p-1.5 border-b border-r border-slate-100 dark:border-slate-800
                ${!day ? 'bg-slate-50 dark:bg-slate-800' : weekend ? 'bg-slate-50/50 dark:bg-slate-800/50' : ''}
                ${todayFlag ? 'ring-2 ring-inset ring-blue-400 dark:ring-blue-500' : ''}
              `}
            >
              {day && (
                <>
                  <span className={`text-xs font-medium ${
                    todayFlag
                      ? 'bg-blue-600 text-white px-1.5 py-0.5 rounded-full'
                      : weekend
                        ? 'text-red-400 dark:text-red-500'
                        : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {leavesOnDay.slice(0, 3).map((item, i) => {
                      const colors = LEAVE_COLORS[item.type] || LEAVE_COLORS.other;
                      return (
                        <div
                          key={i}
                          className={`text-[10px] px-1 py-0.5 rounded truncate ${colors.bg} ${colors.text}`}
                          title={`${item.name} — ${policies.find(p => p.leave_type === item.type)?.label || item.type}`}
                        >
                          {item.name}
                        </div>
                      );
                    })}
                    {leavesOnDay.length > 3 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1">+{leavesOnDay.length - 3}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800">
        {policies.map(p => {
          const colors = LEAVE_COLORS[p.leave_type] || LEAVE_COLORS.other;
          return (
            <div key={p.leave_type} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{p.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeaveCalendar;
