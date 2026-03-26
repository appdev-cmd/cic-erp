import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle2, Loader2, Users, BarChart3,
  TrendingUp, Clock, ChevronDown, ChevronUp, Filter
} from 'lucide-react';
import { TaskService } from '../../services/taskService';
import type { TaskVisibilityContext } from '../../types/taskTypes';

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════
interface EmployeeStat {
  id: string;
  name: string;
  position?: string;
  unit_id?: string;
  avatar?: string;
  total: number;
  overdue: number;
  inProgress: number;
  completed: number;
}

interface TeamDashboardProps {
  visibilityContext: TaskVisibilityContext;
  onSelectEmployee: (empId: string) => void;
  onViewTask: (taskId: string) => void;
}

// ═══════════════════════════════════════
// PERSON AVATAR (reused)
// ═══════════════════════════════════════
const PersonAvatar: React.FC<{ name: string; avatar?: string; size?: number }> = ({ name, avatar, size = 32 }) => (
  <div
    className="rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0 border-2 border-white dark:border-slate-900 overflow-hidden"
    style={{ width: size, height: size, fontSize: size * 0.38 }}
    title={name}
  >
    {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
  </div>
);

// ═══════════════════════════════════════
// KPI CARD
// ═══════════════════════════════════════
const KpiCard: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'red' | 'amber' | 'blue' | 'emerald' | 'indigo';
  description?: string;
}> = ({ label, value, icon, color, description }) => {
  const styles: Record<string, { bg: string; text: string; iconBg: string }> = {
    red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', iconBg: 'bg-red-100 dark:bg-red-900/30' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-100 dark:bg-amber-900/30' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-100 dark:bg-blue-900/30' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  };
  const s = styles[color];

  return (
    <div className={`${s.bg} rounded-xl p-4 flex items-center gap-3.5 transition-all`}>
      <div className={`${s.iconBg} p-2.5 rounded-lg`}>
        <span className={s.text}>{icon}</span>
      </div>
      <div>
        <p className={`text-2xl font-black leading-none ${s.text}`}>{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
        {description && <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════
const ProgressBar: React.FC<{ completed: number; total: number; size?: 'sm' | 'md' }> = ({ completed, total, size = 'sm' }) => {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${height} bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden`}>
        <div
          className={`${height} rounded-full transition-all duration-700 ${
            pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : pct >= 20 ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  );
};

// ═══════════════════════════════════════
// UNIT NAME MAP
// ═══════════════════════════════════════
const UNIT_LABELS: Record<string, string> = {
  bgd: 'Ban Giám đốc',
  bim: 'TT BIM',
  css: 'TT CSS',
  dcs: 'TT DCS',
  hcm: 'CN TP.HCM',
  hcns: 'P. HC-NS',
  hdqt: 'HĐQT',
  pmxd: 'TT PMXD',
  stc: 'TT STC',
  tckt: 'P. TC-KT',
  tvda: 'TT TVDA',
  tvtk: 'TT TVTK',
};

// ═══════════════════════════════════════
// TEAM DASHBOARD
// ═══════════════════════════════════════
const TeamDashboard: React.FC<TeamDashboardProps> = ({ visibilityContext, onSelectEmployee, onViewTask }) => {
  const [stats, setStats] = useState<{
    employees: EmployeeStat[];
    totals: { total: number; overdue: number; inProgress: number; completed: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'overdue' | 'total' | 'completed' | 'name'>('overdue');
  const [sortAsc, setSortAsc] = useState(false);
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const result = await TaskService.getSubordinateStats(visibilityContext);
      setStats(result);
    } catch (err) {
      console.error('Failed to load subordinate stats:', err);
    } finally {
      setLoading(false);
    }
  }, [visibilityContext]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Listen for task changes
  useEffect(() => {
    const handle = () => loadStats();
    window.addEventListener('task-changed', handle);
    return () => window.removeEventListener('task-changed', handle);
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={28} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!stats || stats.employees.length === 0) {
    return (
      <div className="text-center py-12">
        <Users size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Không có nhân viên cấp dưới</p>
      </div>
    );
  }

  const { totals, employees } = stats;
  const completionRate = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  // Get unique units for filter
  const units = [...new Set(employees.map(e => e.unit_id).filter(Boolean))] as string[];

  // Filter + sort employees
  let displayEmployees = [...employees];
  if (filterUnit !== 'all') {
    displayEmployees = displayEmployees.filter(e => e.unit_id === filterUnit);
  }
  displayEmployees.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'name': cmp = a.name.localeCompare(b.name); break;
      case 'overdue': cmp = b.overdue - a.overdue; break;
      case 'total': cmp = b.total - a.total; break;
      case 'completed': {
        const pctA = a.total > 0 ? a.completed / a.total : 0;
        const pctB = b.total > 0 ? b.completed / b.total : 0;
        cmp = pctB - pctA;
        break;
      }
    }
    return sortAsc ? -cmp : cmp;
  });

  const visibleEmployees = showAll ? displayEmployees : displayEmployees.slice(0, 10);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => (
    sortField === field ? (
      sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />
    ) : null
  );

  return (
    <div className="mb-6 space-y-4">
      {/* ═══ KPI CARDS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Tổng công việc"
          value={totals.total}
          icon={<BarChart3 size={18} />}
          color="indigo"
        />
        <KpiCard
          label="Quá hạn"
          value={totals.overdue}
          icon={<AlertTriangle size={18} />}
          color="red"
          description={totals.total > 0 ? `${Math.round((totals.overdue / totals.total) * 100)}% tổng` : undefined}
        />
        <KpiCard
          label="Đang làm"
          value={totals.inProgress}
          icon={<Clock size={18} />}
          color="amber"
        />
        <KpiCard
          label="Hoàn thành"
          value={totals.completed}
          icon={<CheckCircle2 size={18} />}
          color="emerald"
        />
        <KpiCard
          label="Tiến độ"
          value={completionRate}
          icon={<TrendingUp size={18} />}
          color="blue"
          description={`${totals.completed}/${totals.total} xong`}
        />
      </div>

      {/* ═══ OVERALL PROGRESS BAR ═══ */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Tiến độ chung của team
          </span>
          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{completionRate}%</span>
        </div>
        <ProgressBar completed={totals.completed} total={totals.total} size="md" />
      </div>

      {/* ═══ EMPLOYEE TABLE ═══ */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Table header with filter */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Nhân viên ({displayEmployees.length})
            </h3>
          </div>
          {units.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-slate-400 dark:text-slate-500" />
              <select
                value={filterUnit}
                onChange={e => setFilterUnit(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
              >
                <option value="all">Tất cả đơn vị</option>
                {units.map(u => (
                  <option key={u} value={u}>{UNIT_LABELS[u] || u}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                    Nhân viên <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">
                  Đơn vị
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <button onClick={() => handleSort('total')} className="flex items-center gap-1 mx-auto cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                    Tổng <SortIcon field="total" />
                  </button>
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <button onClick={() => handleSort('overdue')} className="flex items-center gap-1 mx-auto cursor-pointer hover:text-red-500 dark:hover:text-red-400 transition-colors">
                    Quá hạn <SortIcon field="overdue" />
                  </button>
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                  Đang làm
                </th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                  Xong
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">
                  <button onClick={() => handleSort('completed')} className="flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                    Tiến độ <SortIcon field="completed" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleEmployees.map(emp => {
                const pct = emp.total > 0 ? Math.round((emp.completed / emp.total) * 100) : 0;
                return (
                  <tr
                    key={emp.id}
                    onClick={() => onSelectEmployee(emp.id)}
                    className={`border-b border-slate-50 dark:border-slate-800 cursor-pointer transition-colors
                      ${emp.overdue > 0 ? 'hover:bg-red-50 dark:hover:bg-red-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    {/* Employee */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <PersonAvatar name={emp.name} avatar={emp.avatar} size={30} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{emp.name}</p>
                          {emp.position && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{emp.position}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Unit */}
                    <td className="px-3 py-3 text-center hidden md:table-cell">
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {emp.unit_id ? (UNIT_LABELS[emp.unit_id] || emp.unit_id) : '—'}
                      </span>
                    </td>

                    {/* Total */}
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{emp.total}</span>
                    </td>

                    {/* Overdue */}
                    <td className="px-3 py-3 text-center">
                      {emp.overdue > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} /> {emp.overdue}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300 dark:text-slate-600">0</span>
                      )}
                    </td>

                    {/* In Progress */}
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <span className="text-sm font-medium text-amber-600 dark:text-amber-400">{emp.inProgress}</span>
                    </td>

                    {/* Completed */}
                    <td className="px-3 py-3 text-center hidden sm:table-cell">
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{emp.completed}</span>
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-3">
                      {emp.total > 0 ? (
                        <ProgressBar completed={emp.completed} total={emp.total} />
                      ) : (
                        <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">Chưa có task</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Show more */}
        {displayEmployees.length > 10 && !showAll && (
          <div className="text-center py-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowAll(true)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer transition-colors"
            >
              Xem tất cả ({displayEmployees.length} nhân viên)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamDashboard;
