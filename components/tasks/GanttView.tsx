import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Task, TaskStatus, TaskPriority } from '../../types/taskTypes';
import {
  addDays, startOfDay, differenceInDays, format,
  startOfMonth, endOfMonth, getDaysInMonth, isWeekend, isToday
} from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Calendar, ChevronDown, ChevronRight, Crosshair,
  AlertTriangle, Layers, User
} from 'lucide-react';
import { dataClient } from '../../lib/dataClient';

// ═══════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════
type ZoomLevel = 'day' | 'week' | 'month';
type GroupBy = 'none' | 'status' | 'priority';

const ROW_HEIGHT = 40;
const ZOOM_CONFIG: Record<ZoomLevel, { pxPerDay: number; label: string }> = {
  day:   { pxPerDay: 48, label: 'Ngày' },
  week:  { pxPerDay: 14, label: 'Tuần' },
  month: { pxPerDay: 4,  label: 'Tháng' },
};

const PRIORITY_COLORS: Record<TaskPriority, { text: string; bg: string }> = {
  urgent: { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  high:   { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  medium: { text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  low:    { text: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
  none:   { text: 'text-slate-400 dark:text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800' },
};
const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: 'Khẩn cấp', high: 'Cao', medium: 'TB', low: 'Thấp', none: '',
};
const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'Không nhóm' },
  { value: 'status', label: 'Theo trạng thái' },
  { value: 'priority', label: 'Theo ưu tiên' },
];

// ═══════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════
interface GanttTask {
  task: Task;
  startDay: Date;
  endDay: Date;
  statusColor: string;
  statusName: string;
  progress: number;
}
interface RowItem {
  type: 'group-header' | 'task';
  groupKey?: string;
  groupLabel?: string;
  groupColor?: string;
  groupCount?: number;
  ganttTask?: GanttTask;
}
interface HeaderCell { label: string; width: number; isWeekend?: boolean; isToday?: boolean; }
interface HeaderGroup { label: string; width: number; }

// ═══════════════════════════════════════
// SUB COMPONENTS
// ═══════════════════════════════════════
const EmptyState: React.FC<{ message: string; sub?: string }> = ({ message, sub }) => (
  <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
    <Calendar size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
    <p className="text-slate-500 dark:text-slate-400 font-medium">{message}</p>
    {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{sub}</p>}
  </div>
);

const Toolbar: React.FC<{
  zoom: ZoomLevel; setZoom: (z: ZoomLevel) => void;
  groupBy: GroupBy; setGroupBy: (g: GroupBy) => void;
  onScrollToToday: () => void; taskCount: number; noDateCount: number;
}> = ({ zoom, setZoom, groupBy, setGroupBy, onScrollToToday, taskCount }) => (
  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4 bg-white dark:bg-slate-900 shrink-0">
    <div className="flex items-center gap-3">
      <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
        <Calendar size={16} className="text-indigo-500" />
        Gantt Chart
        <span className="text-xs font-normal text-slate-400 dark:text-slate-500">({taskCount})</span>
      </h3>
      <button
        onClick={onScrollToToday}
        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors cursor-pointer"
      >
        <Crosshair size={12} /> Hôm nay
      </button>
    </div>
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Layers size={14} className="text-slate-400 dark:text-slate-500" />
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="text-xs font-semibold bg-transparent border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
        >
          {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
        {(['day', 'week', 'month'] as ZoomLevel[]).map(z => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              zoom === z
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >{ZOOM_CONFIG[z].label}</button>
        ))}
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════
// MAIN GANTT COMPONENT
// ═══════════════════════════════════════
interface GanttViewProps {
  tasks: Task[];
  onSelect: (id: string) => void;
  statuses: TaskStatus[];
}

export const GanttView: React.FC<GanttViewProps> = ({ tasks, onSelect, statuses }) => {
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; task: GanttTask } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isResizing, setIsResizing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatar: string | null }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Prepare Gantt tasks (only those with dates) ───
  const { ganttTasks, noDateCount } = useMemo(() => {
    const gt: GanttTask[] = [];
    let noDate = 0;
    tasks.forEach(t => {
      let s = t.start_date ? startOfDay(new Date(t.start_date)) : null;
      let e = t.due_date ? startOfDay(new Date(t.due_date)) : null;
      if (!s && e) s = addDays(e, -1);
      if (s && !e) e = addDays(s, 1);
      if (!s || !e) { noDate++; return; }
      if (s > e) { const tmp = s; s = e; e = tmp; }
      const status = statuses.find(st => st.id === t.status_id);
      gt.push({
        task: t, startDay: s, endDay: e,
        statusColor: status?.color || '#6366f1',
        statusName: status?.name || '',
        progress: status?.is_done ? 100 : (t.time_estimate && t.time_spent ? Math.min(100, Math.round(t.time_spent / t.time_estimate * 100)) : 0),
      });
    });
    return { ganttTasks: gt, noDateCount: noDate };
  }, [tasks, statuses]);

  // ─── Fetch profiles for assignees ───
  useEffect(() => {
    const ids = new Set<string>();
    ganttTasks.forEach(gt => gt.task.assignees?.forEach(id => ids.add(id)));
    if (ids.size === 0) return;
    dataClient.from('profiles').select('id, full_name, avatar_url').in('id', Array.from(ids))
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, { name: string; avatar: string | null }> = {};
        data.forEach((p: any) => { map[p.id] = { name: p.full_name || '', avatar: p.avatar_url }; });
        setProfiles(map);
      });
  }, [ganttTasks]);

  // ─── Date range with padding ───
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    if (ganttTasks.length === 0) {
      const now = new Date();
      return { rangeStart: addDays(now, -15), rangeEnd: addDays(now, 45), totalDays: 60 };
    }
    let min = ganttTasks[0].startDay;
    let max = ganttTasks[0].endDay;
    for (const g of ganttTasks) {
      if (g.startDay < min) min = g.startDay;
      if (g.endDay > max) max = g.endDay;
    }
    const start = addDays(startOfMonth(min), -7);
    const end = addDays(endOfMonth(max), 14);
    return { rangeStart: start, rangeEnd: end, totalDays: differenceInDays(end, start) + 1 };
  }, [ganttTasks]);

  // ─── Track container width for auto-fit ───
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Effective pxPerDay: auto-stretch to fill container ───
  const pxPerDay = useMemo(() => {
    const basePx = ZOOM_CONFIG[zoom].pxPerDay;
    if (containerWidth <= 0 || totalDays <= 0) return basePx;
    const availableWidth = containerWidth - sidebarWidth;
    const neededPx = availableWidth / totalDays;
    // Only stretch (never shrink below base) for week/month; day stays fixed
    if (zoom === 'day') return basePx;
    return Math.max(basePx, neededPx);
  }, [zoom, containerWidth, sidebarWidth, totalDays]);

  const timelineWidth = totalDays * pxPerDay;

  // ─── Today offset ───
  const todayOffset = useMemo(() => {
    return differenceInDays(startOfDay(new Date()), rangeStart) * pxPerDay;
  }, [rangeStart, pxPerDay]);

  // ─── Header generation ───
  const { topHeaders, bottomHeaders } = useMemo(() => {
    const top: HeaderGroup[] = [];
    const bottom: HeaderCell[] = [];

    if (zoom === 'day' || zoom === 'week') {
      let curMonth = -1, curWidth = 0, curLabel = '';
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(rangeStart, i);
        const m = d.getMonth();
        if (m !== curMonth) {
          if (curMonth !== -1) top.push({ label: curLabel, width: curWidth });
          curMonth = m; curWidth = 0;
          curLabel = format(d, 'MMMM yyyy', { locale: vi });
        }
        curWidth += pxPerDay;
        if (zoom === 'day') {
          bottom.push({ label: format(d, 'd'), width: pxPerDay, isWeekend: isWeekend(d), isToday: isToday(d) });
        } else {
          const dow = d.getDay();
          bottom.push({ label: dow === 1 ? format(d, 'dd/MM') : '', width: pxPerDay, isWeekend: isWeekend(d), isToday: isToday(d) });
        }
      }
      if (curWidth > 0) top.push({ label: curLabel, width: curWidth });
    } else {
      // Month zoom
      let curYear = -1, curYearWidth = 0, curYearLabel = '';
      let dayIndex = 0;
      while (dayIndex < totalDays) {
        const d = addDays(rangeStart, dayIndex);
        const y = d.getFullYear();
        const daysInM = getDaysInMonth(d);
        const monthEnd = addDays(startOfMonth(d), daysInM - 1);
        const effectiveEnd = monthEnd > rangeEnd ? rangeEnd : monthEnd;
        const daysShown = differenceInDays(effectiveEnd, d) + 1;
        const cellWidth = daysShown * pxPerDay;

        if (y !== curYear) {
          if (curYear !== -1) top.push({ label: curYearLabel, width: curYearWidth });
          curYear = y; curYearWidth = 0; curYearLabel = String(y);
        }
        curYearWidth += cellWidth;
        bottom.push({ label: format(d, 'MMM', { locale: vi }), width: cellWidth });
        dayIndex += daysShown;
      }
      if (curYearWidth > 0) top.push({ label: curYearLabel, width: curYearWidth });
    }
    return { topHeaders: top, bottomHeaders: bottom };
  }, [zoom, rangeStart, rangeEnd, totalDays, pxPerDay]);

  // ─── Grouped rows ───
  const rows = useMemo((): RowItem[] => {
    if (groupBy === 'none') return ganttTasks.map(gt => ({ type: 'task' as const, ganttTask: gt }));
    const groups = new Map<string, { label: string; color?: string; items: GanttTask[] }>();
    for (const gt of ganttTasks) {
      const key = groupBy === 'status' ? (gt.statusName || 'N/A') : gt.task.priority;
      const label = groupBy === 'status' ? (gt.statusName || 'Không có trạng thái') : (PRIORITY_LABELS[gt.task.priority] || 'Không');
      const color = groupBy === 'status' ? gt.statusColor : undefined;
      if (!groups.has(key)) groups.set(key, { label, color, items: [] });
      groups.get(key)!.items.push(gt);
    }
    const result: RowItem[] = [];
    for (const [key, group] of groups) {
      result.push({ type: 'group-header', groupKey: key, groupLabel: group.label, groupColor: group.color, groupCount: group.items.length });
      if (!collapsedGroups.has(key)) {
        for (const gt of group.items) result.push({ type: 'task', ganttTask: gt });
      }
    }
    return result;
  }, [ganttTasks, groupBy, collapsedGroups]);

  // ─── Scroll to today on mount / zoom change ───
  useEffect(() => {
    if (scrollRef.current && todayOffset > 0) {
      scrollRef.current.scrollLeft = Math.max(0, todayOffset + sidebarWidth - scrollRef.current.clientWidth / 2);
    }
  }, [zoom, todayOffset, sidebarWidth]);

  // ─── Bar position calculator ───
  const getBarStyle = useCallback((gt: GanttTask) => {
    const left = differenceInDays(gt.startDay, rangeStart) * pxPerDay;
    const width = Math.max(pxPerDay, (differenceInDays(gt.endDay, gt.startDay) + 1) * pxPerDay);
    return { left, width };
  }, [rangeStart, pxPerDay]);

  // ─── Sidebar resize ───
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (me: MouseEvent) => setSidebarWidth(Math.min(500, Math.max(200, startW + me.clientX - startX)));
    const onUp = () => { setIsResizing(false); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);

  const showTooltip = useCallback((e: React.MouseEvent, gt: GanttTask) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: r.left + r.width / 2, y: r.top - 8, task: gt });
  }, []);
  const hideTooltip = useCallback(() => setTooltip(null), []);

  // ═══════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════
  if (tasks.length === 0) return <EmptyState message="Không có công việc nào." />;
  if (ganttTasks.length === 0) return <EmptyState message="Chưa có công việc nào có ngày bắt đầu hoặc hạn chót." sub="Biểu đồ Gantt cần mốc thời gian để hiển thị." />;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 260px)' }}>
      <Toolbar zoom={zoom} setZoom={setZoom} groupBy={groupBy} setGroupBy={setGroupBy}
        onScrollToToday={() => { if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayOffset + sidebarWidth - scrollRef.current.clientWidth / 2); }}
        taskCount={ganttTasks.length} noDateCount={noDateCount}
      />

      {/* ─── Gantt Body ─── */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative" style={{ cursor: isResizing ? 'col-resize' : undefined }}>
        <div style={{ width: sidebarWidth + timelineWidth, minHeight: '100%' }}>
          {/* ─── Sticky Header ─── */}
          <div className="sticky top-0 z-20 flex" style={{ width: sidebarWidth + timelineWidth }}>
            {/* Sidebar header */}
            <div
              className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 flex items-end px-4 py-2 relative"
              style={{ width: sidebarWidth, minWidth: sidebarWidth, height: 56 }}
            >
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Công việc</span>
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-300/50 dark:hover:bg-indigo-700/50 transition-colors z-40 flex items-center justify-center"
                onMouseDown={handleResizeStart}
              >
                <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-600 rounded-full" />
              </div>
            </div>
            {/* Timeline header */}
            <div style={{ width: timelineWidth }}>
              <div className="flex h-7 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                {topHeaders.map((h, i) => (
                  <div key={i} className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center border-r border-slate-200 dark:border-slate-700 truncate px-2"
                    style={{ width: h.width, minWidth: h.width }}>{h.label}</div>
                ))}
              </div>
              <div className="flex h-7 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                {bottomHeaders.map((h, i) => (
                  <div key={i}
                    className={`text-[10px] font-semibold flex items-center justify-center border-r border-slate-200 dark:border-slate-700
                      ${h.isToday ? 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold'
                        : h.isWeekend ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                        : 'text-slate-500 dark:text-slate-400'}`}
                    style={{ width: h.width, minWidth: h.width }}
                  >{h.label}</div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Rows ─── */}
          <div className="relative">
            {/* Today marker */}
            {todayOffset > 0 && todayOffset < timelineWidth && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 dark:bg-red-400 z-10 pointer-events-none" style={{ left: sidebarWidth + todayOffset + pxPerDay / 2 }}>
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 dark:bg-red-400 rounded-full shadow-sm" />
              </div>
            )}

            {rows.map((row, idx) => {
              if (row.type === 'group-header') {
                const collapsed = collapsedGroups.has(row.groupKey!);
                return (
                  <div key={`g-${row.groupKey}`} className="flex cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" style={{ height: ROW_HEIGHT }} onClick={() => toggleGroup(row.groupKey!)}>
                    <div className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 flex items-center gap-2 px-4" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
                      {collapsed ? <ChevronRight size={14} className="text-slate-500 dark:text-slate-400" /> : <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />}
                      {row.groupColor && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.groupColor }} />}
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{row.groupLabel}</span>
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">{row.groupCount}</span>
                    </div>
                    <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800" style={{ width: timelineWidth }} />
                  </div>
                );
              }

              const gt = row.ganttTask!;
              const bar = getBarStyle(gt);
              const isDone = gt.progress === 100;
              const isOverdue = gt.task.due_date && new Date(gt.task.due_date) < new Date() && !gt.task.completed_at;

              return (
                <div key={gt.task.id} className={`flex group/row ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}`} style={{ height: ROW_HEIGHT }}>
                  {/* Sidebar cell */}
                  <div
                    className={`sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 flex items-center gap-2 px-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}`}
                    style={{ width: sidebarWidth, minWidth: sidebarWidth }}
                    onClick={() => onSelect(gt.task.id)}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: gt.statusColor }} />
                    <span className={`text-xs font-medium truncate flex-1 ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                      {gt.task.title}
                    </span>

                    {isOverdue && <AlertTriangle size={12} className="text-red-500 dark:text-red-400 flex-shrink-0" />}
                  </div>

                  {/* Timeline cell */}
                  <div className="relative border-b border-slate-100 dark:border-slate-800" style={{ width: timelineWidth }}>
                    {/* Gantt bar */}
                    <div
                      className="absolute top-1.5 cursor-pointer rounded-md overflow-hidden group/bar"
                      style={{ left: bar.left, width: bar.width, height: ROW_HEIGHT - 12 }}
                      onClick={() => onSelect(gt.task.id)}
                      onMouseEnter={(e) => showTooltip(e, gt)}
                      onMouseLeave={hideTooltip}
                    >
                      <div className="absolute inset-0 rounded-md transition-opacity opacity-85 group-hover/bar:opacity-100" style={{ backgroundColor: gt.statusColor }} />
                      {gt.progress > 0 && gt.progress < 100 && (
                        <div className="absolute inset-y-0 left-0 rounded-l-md bg-white/25" style={{ width: `${gt.progress}%` }} />
                      )}
                      {/* Priority label on bar */}
                      {gt.task.priority !== 'none' && bar.width > 40 && (
                        <div className="absolute left-1 inset-y-0 flex items-center z-[1]">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm leading-none
                            ${gt.task.priority === 'urgent' ? 'bg-red-900/40 text-white' : ''}
                            ${gt.task.priority === 'high' ? 'bg-orange-900/30 text-white' : ''}
                            ${gt.task.priority === 'medium' ? 'bg-white/20 text-white/90' : ''}
                            ${gt.task.priority === 'low' ? 'bg-white/15 text-white/70' : ''}`}
                          >
                            {gt.task.priority === 'urgent' && '⚡ Khẩn'}
                            {gt.task.priority === 'high' && '↑ Cao'}
                            {gt.task.priority === 'medium' && '— TB'}
                            {gt.task.priority === 'low' && '↓ Thấp'}
                          </span>
                        </div>
                      )}
                      {/* Assignee avatars */}
                      {gt.task.assignees?.length > 0 && (
                        <div className="absolute right-1 inset-y-0 flex items-center z-[2] -space-x-1">
                          {gt.task.assignees.slice(0, 2).map(id => {
                            const p = profiles[id];
                            return (
                              <div key={id}
                                className="w-5 h-5 rounded-full border-[1.5px] border-white/80 dark:border-white/40 bg-white/30 dark:bg-white/20 flex items-center justify-center overflow-hidden shadow-sm"
                                title={p?.name || id}
                              >
                                {p?.avatar ? (
                                  <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[8px] font-bold text-white drop-shadow-sm">
                                    {p?.name?.charAt(0)?.toUpperCase() || <User size={9} />}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {gt.task.assignees.length > 2 && (
                            <div className="w-5 h-5 rounded-full border-[1.5px] border-white/80 dark:border-white/40 bg-white/30 dark:bg-white/20 flex items-center justify-center shadow-sm">
                              <span className="text-[7px] font-bold text-white drop-shadow-sm">+{gt.task.assignees.length - 2}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-md opacity-0 group-hover/bar:opacity-100 transition-opacity" style={{ boxShadow: `0 4px 14px ${gt.statusColor}50` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Tooltip ─── */}
      {tooltip && (
        <div
          className="fixed z-[60] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-3 pointer-events-none min-w-[220px]"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 truncate max-w-[280px]">{tooltip.task.task.title}</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tooltip.task.statusColor }} />
            {tooltip.task.statusName}
          </div>
          <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
            {format(tooltip.task.startDay, 'dd/MM/yyyy')} → {format(tooltip.task.endDay, 'dd/MM/yyyy')}
          </div>
          {tooltip.task.progress > 0 && <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Tiến độ: {tooltip.task.progress}%</div>}
          {tooltip.task.task.source_module && <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Nguồn: {tooltip.task.task.source_module}</div>}
        </div>
      )}

      {/* ─── No-date footer ─── */}
      {noDateCount > 0 && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <AlertTriangle size={12} />
          <span><span className="font-bold text-slate-700 dark:text-slate-300">{noDateCount}</span> công việc chưa có ngày — không hiển thị trên biểu đồ</span>
        </div>
      )}
    </div>
  );
};

export default GanttView;
