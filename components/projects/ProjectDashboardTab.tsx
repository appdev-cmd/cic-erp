import React, { useMemo } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { 
  CheckSquare, Clock, AlertTriangle, Calendar, 
  TrendingUp, Activity, Target, BarChart3
} from 'lucide-react';
import { BIMProject } from '../../types';
import { Task } from '../../types/taskTypes';
import { isDarkTheme, getChartColors, getGridStroke } from '../../lib/themeColors';

import { TaskService } from '../../services/taskService';

interface ProjectDashboardTabProps {
  project: BIMProject;
}

/* ─── KPI Card ─── */
const DashboardStat = ({ title, value, icon, color, subtitle }: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  color: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple';
  subtitle?: string;
}) => {
  const colors = {
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/30',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/30',
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          {icon}
        </div>
        <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{title}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <h4 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{value}</h4>
        {subtitle && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{subtitle}</span>}
      </div>
    </div>
  );
};

const ProjectDashboardTab: React.FC<ProjectDashboardTabProps> = ({ project }) => {
  const isDark = isDarkTheme();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const data = await TaskService.getByProjectId(project.id);
        setTasks(data);
      } catch (err) {
        console.error('Failed to load project tasks for dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [project.id]);

  // ── Stats Calculations ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status?.is_done).length;
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && !t.status?.is_done).length;
    const pending = total - completed;
    
    // Time progress
    let timeProgress = 0;
    if (project.startDate && project.endDate) {
      const start = new Date(project.startDate).getTime();
      const end = new Date(project.endDate).getTime();
      const now = new Date().getTime();
      timeProgress = Math.round(((now - start) / (end - start)) * 100);
      timeProgress = Math.max(0, Math.min(100, timeProgress));
    }

    return { total, completed, overdue, pending, timeProgress };
  }, [tasks, project]);

  // ── Chart Data ─────────────────────────────────────────────────────
  const statusData = useMemo(() => {
    const counts: Record<string, { count: number; color: string }> = {};
    tasks.forEach(t => {
      const s = t.status?.name || 'Chưa rõ';
      if (!counts[s]) counts[s] = { count: 0, color: t.status?.color || '#94a3b8' };
      counts[s].count++;
    });
    return Object.entries(counts).map(([name, data]) => ({ name, value: data.count, color: data.color }));
  }, [tasks]);

  const activityData = useMemo(() => {
    // Generate last 7 days activity (placeholder for now, matching completion date if available)
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const count = tasks.filter(t => t.completed_at?.startsWith(dateStr)).length;
      result.push({ 
        name: d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit' }), 
        count: count 
      });
    }
    return result;
  }, [tasks]);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-2xl" />)}
        <div className="col-span-2 h-64 bg-slate-50 dark:bg-slate-800/50 rounded-2xl" />
        <div className="col-span-2 h-64 bg-slate-50 dark:bg-slate-800/50 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardStat 
          title="Tiến độ công việc" 
          value={`${project.progress}%`} 
          icon={<Target size={18} />} 
          color="indigo"
          subtitle={`Hoàn thành ${stats.completed}/${stats.total}`}
        />
        <DashboardStat 
          title="Thời gian đã qua" 
          value={`${stats.timeProgress}%`} 
          icon={<Clock size={18} />} 
          color="amber"
          subtitle="Theo deadline dự án"
        />
        <DashboardStat 
          title="Công việc quá hạn" 
          value={stats.overdue} 
          icon={<AlertTriangle size={18} />} 
          color="rose"
          subtitle="Cần ưu tiên xử lý"
        />
        <DashboardStat 
          title="Nhiệm vụ active" 
          value={stats.pending} 
          icon={<Activity size={18} />} 
          color="emerald"
          subtitle="Đang trong luồng"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-500" />
              Phân bổ Trạng thái
            </h3>
          </div>
          <div className="h-[280px]">
             {statusData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={statusData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={85}
                     paddingAngle={5}
                     dataKey="value"
                     strokeWidth={0}
                   >
                     {statusData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={entry.color} />
                     ))}
                   </Pie>
                   <Tooltip 
                     contentStyle={{ 
                       backgroundColor: isDark ? '#1e293b' : '#fff', 
                       borderColor: isDark ? '#334155' : '#e2e8f0',
                       borderRadius: '12px',
                       fontSize: '12px',
                       fontWeight: 'bold'
                     }} 
                   />
                 </PieChart>
               </ResponsiveContainer>
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Activity size={32} className="opacity-20 mb-2" />
                  <span className="text-xs font-bold">Chưa có dữ liệu công việc</span>
               </div>
             )}
          </div>
          {/* Custom Legend */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {statusData.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Completion Trend */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-500" />
              Hiệu suất hoàn thành
            </h3>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818CF8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#818CF8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={getGridStroke()} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                <Tooltip 
                   contentStyle={{ 
                     backgroundColor: isDark ? '#1e293b' : '#fff', 
                     borderColor: isDark ? '#334155' : '#e2e8f0',
                     borderRadius: '12px'
                   }} 
                />
                <Area type="monotone" dataKey="count" name="Công việc hoàn thành" stroke="#818CF8" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-4 text-[10px] text-center font-bold text-slate-400 dark:text-slate-500 italic">Thống kê khối lượng công việc hoàn thành trong 7 ngày gần nhất</p>
        </div>
      </div>
    </div>
  );
};

export default ProjectDashboardTab;
