import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Task, TaskStatus } from '../../types/taskTypes';
import { addDays, startOfDay, differenceInDays, format } from 'date-fns';
import Gantt from 'frappe-gantt';
import '../../node_modules/frappe-gantt/dist/frappe-gantt.css';
import { Calendar } from 'lucide-react';

interface GanttViewProps {
  tasks: Task[];
  onSelect: (id: string) => void;
  statuses: TaskStatus[];
}

type ViewModeKey = 'Day' | 'Week' | 'Month';
const VIEW_MODES: { label: string; value: ViewModeKey }[] = [
  { label: 'Ngày', value: 'Day' },
  { label: 'Tuần', value: 'Week' },
  { label: 'Tháng', value: 'Month' },
];

export const GanttView: React.FC<GanttViewProps> = ({ tasks, onSelect, statuses }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const ganttInstance = useRef<any>(null);
  const [viewMode, setViewMode] = useState<ViewModeKey>('Day');
  const [isDark, setIsDark] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const html = document.documentElement;
    const check = () => setIsDark(html.classList.contains('dark'));
    check();
    const ob = new MutationObserver(check);
    ob.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => ob.disconnect();
  }, []);

  // Build frappe-gantt task array + id map
  const { fTasks, idMap } = useMemo(() => {
    const out: any[] = [];
    const map: Record<string, string> = {};

    tasks.forEach((t) => {
      let s: Date | null = t.start_date ? startOfDay(new Date(t.start_date)) : null;
      let e: Date | null = t.due_date ? startOfDay(new Date(t.due_date)) : null;

      if (!s && e) s = addDays(e, -1);
      if (s && !e) e = addDays(s, 1);
      if (!s || !e) return;
      if (s > e) { const tmp = s; s = e; e = tmp; }

      const status = statuses.find((st) => st.id === t.status_id);
      const fId = 'T' + out.length;
      map[fId] = t.id;

      out.push({
        id: fId,
        name: t.title,
        start: format(s, 'yyyy-MM-dd'),
        end: format(e, 'yyyy-MM-dd'),
        progress: status?.is_done ? 100 : 0,
        dependencies: '',
        _color: status?.color || '#6366f1',
        _statusName: status?.name || '',
      });
    });

    return { fTasks: out, idMap: map };
  }, [tasks, statuses]);

  const onBarClick = useCallback(
    (task: any) => {
      const real = idMap[task.id];
      if (real) onSelect(real);
    },
    [idMap, onSelect],
  );

  // Render chart
  useEffect(() => {
    if (!svgRef.current || fTasks.length === 0) return;

    // Destroy previous instance
    if (ganttInstance.current) {
      try { ganttInstance.current = null; } catch (_) {}
    }

    const gantt = new Gantt(svgRef.current, fTasks, {
      view_mode: viewMode,
      date_format: 'YYYY-MM-DD',
      language: 'vi',
      bar_height: 28,
      bar_corner_radius: 6,
      padding: 18,
      on_click: onBarClick,
      on_date_change: () => {},
      on_progress_change: () => {},
      custom_popup_html: (task: any) => `
        <div style="padding:12px 16px;min-width:200px">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:${isDark ? '#f1f5f9' : '#1e293b'}">${task.name}</div>
          <div style="font-size:12px;color:${isDark ? '#94a3b8' : '#64748b'};margin-bottom:2px">${task._statusName}</div>
          <div style="font-size:12px;color:#6366f1;font-weight:600">${task.start} → ${task.end}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px">Tiến độ: ${task.progress}%</div>
        </div>
      `,
    });

    ganttInstance.current = gantt;

    // Apply custom bar colors after a short delay
    const colorize = () => {
      const wrappers = svgRef.current?.closest('.gantt-container')?.querySelectorAll('.bar-wrapper');
      if (!wrappers) return;
      wrappers.forEach((w, i) => {
        if (i >= fTasks.length) return;
        const color = fTasks[i]._color;
        const bar = w.querySelector('.bar') as SVGRectElement | null;
        if (bar) {
          bar.style.fill = color;
          bar.setAttribute('fill', color);
        }
      });
    };
    setTimeout(colorize, 150);
    setTimeout(colorize, 600);

    return () => { ganttInstance.current = null; };
  }, [fTasks, viewMode, onBarClick, isDark]);

  // --- Empty states ---
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
        <Calendar size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">Không có công việc nào.</p>
      </div>
    );
  }

  if (fTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
        <Calendar size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          Chưa có công việc nào được gán <span className="font-bold text-slate-700 dark:text-slate-300">Ngày bắt đầu</span>{' '}
          hoặc <span className="font-bold text-slate-700 dark:text-slate-300">Hạn chót</span>.
        </p>
        <p className="text-xs text-slate-400 mt-2">Biểu đồ Gantt cần mốc thời gian để vẽ tiến độ.</p>
      </div>
    );
  }

  // --- Main Render ---
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-220px)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
          <Calendar size={16} className="text-indigo-500" />
          Tiến độ công việc
        </h3>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {VIEW_MODES.map((v) => (
            <button
              key={v.value}
              onClick={() => setViewMode(v.value)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                viewMode === v.value
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className={`flex-1 overflow-auto gantt-wrapper ${isDark ? 'gantt-dark' : 'gantt-light'}`}>
        <style>{`
          /* ═══════ LIGHT MODE ═══════ */
          .gantt-light .gantt-container { background: #fff; }
          .gantt-light .grid-background { fill: #ffffff; }
          .gantt-light .grid-row:nth-child(even) { fill: #f8fafc; }
          .gantt-light .row-line { stroke: #e2e8f0; }
          .gantt-light .tick { stroke: #f1f5f9; }
          .gantt-light .today-highlight { fill: rgba(99,102,241,0.08); }
          .gantt-light .upper-text { fill: #334155; font-weight: 700; font-size: 12px; }
          .gantt-light .lower-text { fill: #64748b; font-weight: 600; font-size: 11px; }
          .gantt-light .bar { fill: #6366f1; rx: 6; ry: 6; }
          .gantt-light .bar-progress { fill: rgba(255,255,255,0.3); rx: 6; ry: 6; }
          .gantt-light .bar-label { fill: #fff !important; font-weight: 600; font-size: 11px; }
          .gantt-light .handle { fill: rgba(255,255,255,0.4); cursor: col-resize; }
          .gantt-light .popup-wrapper { background: #fff; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); border: 1px solid #e2e8f0; }

          /* ═══════ DARK MODE ═══════ */
          .gantt-dark .gantt-container { background: #0f172a; }
          .gantt-dark .grid-background { fill: #0f172a; }
          .gantt-dark .grid-row { fill: transparent; }
          .gantt-dark .grid-row:nth-child(even) { fill: #1e293b; }
          .gantt-dark .row-line { stroke: #1e293b; }
          .gantt-dark .tick { stroke: #1e293b; }
          .gantt-dark .today-highlight { fill: rgba(99,102,241,0.12); }
          .gantt-dark .upper-text { fill: #e2e8f0; font-weight: 700; font-size: 12px; }
          .gantt-dark .lower-text { fill: #94a3b8; font-weight: 600; font-size: 11px; }
          .gantt-dark .bar { fill: #6366f1; rx: 6; ry: 6; }
          .gantt-dark .bar-progress { fill: rgba(255,255,255,0.2); rx: 6; ry: 6; }
          .gantt-dark .bar-label { fill: #fff !important; font-weight: 600; font-size: 11px; }
          .gantt-dark .handle { fill: rgba(255,255,255,0.3); cursor: col-resize; }
          .gantt-dark .arrow { stroke: #475569; }
          .gantt-dark .popup-wrapper { background: #1e293b; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.4); border: 1px solid #334155; }

          /* ═══════ SHARED ═══════ */
          .gantt-wrapper .gantt { font-family: 'Inter', system-ui, sans-serif; }
          .gantt-wrapper .bar { transition: filter 0.2s; cursor: pointer; }
          .gantt-wrapper .bar:hover { filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2)); }
          .gantt-wrapper .gantt-container { overflow-x: auto; overflow-y: auto; }
        `}</style>
        <svg ref={svgRef}></svg>
      </div>
    </div>
  );
};

export default GanttView;
