import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts';
import {
  Activity, Layers, Cpu, DollarSign, RefreshCw,
  CheckCircle, XCircle, Clock, Zap, TrendingUp, Filter
} from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────

interface DashboardStats {
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  toolsCalled: number;
  successCount: number;
  failCount: number;
  avgLatencyMs: number;
}

interface DayUsage {
  day: string;
  requests: number;
  cost: number;
}

interface AgentUsage {
  agent: string;
  requests: number;
}

interface TopTool {
  name: string;
  count: number;
}

interface RecentLog {
  id: string;
  created_at: string;
  agent_id: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_cost_usd: number | null;
  latency_ms: number | null;
  success: boolean | null;
  metadata: Record<string, any> | null;
}

// ─── Helpers ──────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n.toString();
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDayLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const AGENT_LABEL: Record<string, string> = {
  'agent-master': 'Master',
  'agent-bgd': 'BGĐ',
  'agent-mkt': 'Marketing',
  'agent-planning': 'Lập KH',
  'agent-system': 'System',
};

// ─── KPI Card ─────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  loading?: boolean;
}

function KpiCard({ icon, label, value, sub, color, loading }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', color)}>
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
      )}
      {sub && <span className="text-xs text-slate-400 dark:text-slate-500">{sub}</span>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────

export default function AIObservabilityDashboard() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<7 | 30>(7);

  const [stats, setStats] = useState<DashboardStats>({
    totalRequests: 0, totalTokens: 0, totalCostUsd: 0,
    toolsCalled: 0, successCount: 0, failCount: 0, avgLatencyMs: 0,
  });
  const [dailyUsage, setDailyUsage] = useState<DayUsage[]>([]);
  const [agentUsage, setAgentUsage] = useState<AgentUsage[]>([]);
  const [topTools, setTopTools] = useState<TopTool[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceIso = since.toISOString();

      // 1. Fetch logs trong khoảng thời gian
      const { data: logs, error } = await supabase
        .from('ai_logs')
        .select('*')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (error) throw error;
      if (!logs || logs.length === 0) {
        setStats({ totalRequests: 0, totalTokens: 0, totalCostUsd: 0, toolsCalled: 0, successCount: 0, failCount: 0, avgLatencyMs: 0 });
        setDailyUsage([]); setAgentUsage([]); setTopTools([]); setRecentLogs([]);
        return;
      }

      // 2. Tính Stats tổng hợp
      let totalTokens = 0, totalCost = 0, toolsCalled = 0, successCount = 0, totalLatency = 0, latencyCount = 0;
      const toolCountMap: Record<string, number> = {};
      const agentCountMap: Record<string, number> = {};
      const dayMap: Record<string, { requests: number, cost: number }> = {};

      logs.forEach((log: RecentLog) => {
        const tokens = (log.prompt_tokens || 0) + (log.completion_tokens || 0);
        totalTokens += tokens;
        totalCost += log.total_cost_usd || 0;
        if (log.success) successCount++;
        if (log.latency_ms) { totalLatency += log.latency_ms; latencyCount++; }

        // Tools called (từ metadata.tools_called)
        const toolsList: string[] = log.metadata?.tools_called || [];
        toolsList.forEach(toolName => {
          toolsCalled++;
          toolCountMap[toolName] = (toolCountMap[toolName] || 0) + 1;
        });

        // Agent usage
        const agentKey = log.agent_id || 'unknown';
        agentCountMap[agentKey] = (agentCountMap[agentKey] || 0) + 1;

        // Daily usage
        const dayKey = log.created_at?.split('T')[0] || '';
        if (dayKey) {
          if (!dayMap[dayKey]) dayMap[dayKey] = { requests: 0, cost: 0 };
          dayMap[dayKey].requests++;
          dayMap[dayKey].cost += log.total_cost_usd || 0;
        }
      });

      setStats({
        totalRequests: logs.length,
        totalTokens,
        totalCostUsd: totalCost,
        toolsCalled,
        successCount,
        failCount: logs.length - successCount,
        avgLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
      });

      // 3. Daily chart (fill missing days)
      const dailyArr: DayUsage[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dailyArr.push({
          day: fmtDayLabel(key + 'T00:00:00'),
          requests: dayMap[key]?.requests || 0,
          cost: Math.round((dayMap[key]?.cost || 0) * 10000) / 10000,
        });
      }
      setDailyUsage(dailyArr);

      // 4. Agent usage chart
      const agentArr: AgentUsage[] = Object.entries(agentCountMap)
        .map(([id, count]) => ({ agent: AGENT_LABEL[id] || id, requests: count }))
        .sort((a, b) => b.requests - a.requests)
        .slice(0, 6);
      setAgentUsage(agentArr);

      // 5. Top tools
      const toolArr: TopTool[] = Object.entries(toolCountMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      setTopTools(toolArr);

      // 6. Recent logs (top 20)
      setRecentLogs(logs.slice(0, 20));

    } catch (e) {
      console.error('[AIObservability] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const successRate = stats.totalRequests > 0
    ? Math.round((stats.successCount / stats.totalRequests) * 100)
    : 0;

  return (
    <div className="p-6 md:p-8 space-y-6 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
            Trạm Giám sát AI
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Giám sát hoạt động, tools, và chi phí của các AI Agent theo thời gian thực
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter days */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <Filter className="w-4 h-4 text-slate-400 ml-1" />
            {([7, 30] as const).map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'px-3 py-1 rounded-md text-sm font-medium transition',
                  days === d
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                )}
              >
                {d} ngày
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          label="Tổng requests"
          value={fmtNum(stats.totalRequests)}
          sub={`${days} ngày gần nhất`}
          color="bg-blue-50 dark:bg-blue-900/30"
          loading={loading}
        />
        <KpiCard
          icon={<Layers className="w-4 h-4 text-violet-600 dark:text-violet-400" />}
          label="Tools đã gọi"
          value={fmtNum(stats.toolsCalled)}
          sub="Từ metadata thực tế"
          color="bg-violet-50 dark:bg-violet-900/30"
          loading={loading}
        />
        <KpiCard
          icon={<Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          label="Tokens tiêu thụ"
          value={fmtNum(stats.totalTokens)}
          sub="Prompt + Completion"
          color="bg-emerald-50 dark:bg-emerald-900/30"
          loading={loading}
        />
        <KpiCard
          icon={<DollarSign className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
          label="Chi phí API"
          value={`$${stats.totalCostUsd.toFixed(4)}`}
          sub="USD (cloud models)"
          color="bg-rose-50 dark:bg-rose-900/30"
          loading={loading}
        />
      </div>

      {/* Success Rate + Latency row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 flex items-center gap-4">
          <div className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
            successRate >= 90 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
            successRate >= 70 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
            'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
          )}>
            {loading ? '–' : `${successRate}%`}
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tỷ lệ thành công</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {stats.successCount} ✓ / {stats.failCount} ✗
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
            <Clock className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Avg Latency</p>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
              {loading ? '–' : stats.avgLatencyMs > 0 ? `${(stats.avgLatencyMs / 1000).toFixed(1)}s` : 'N/A'}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tools / Request</p>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-200">
              {loading || stats.totalRequests === 0 ? '–'
                : (stats.toolsCalled / stats.totalRequests).toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Usage Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            Lưu lượng theo ngày
          </h2>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Đang tải...</div>
          ) : dailyUsage.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Chưa có dữ liệu</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                    formatter={(val: number | undefined) => [val ?? 0, 'Requests']}
                  />
                  <Line type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2.5}
                    dot={{ fill: '#6366f1', strokeWidth: 2, r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Tools Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Top Tools được gọi
          </h2>
          {loading ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Đang tải...</div>
          ) : topTools.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              Chưa có dữ liệu — Agent cần lưu tools_called vào metadata
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topTools} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis dataKey="name" type="category" width={140} stroke="#64748b" fontSize={11}
                    tickFormatter={(v: string) => v.replace(/_/g, ' ')} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                    formatter={(val: number | undefined) => [val ?? 0, 'lần gọi']}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Agent Usage + Recent logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent usage bar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-4">Requests theo Agent</h2>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-8 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />)}
            </div>
          ) : agentUsage.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có dữ liệu</p>
          ) : (
            <div className="space-y-3">
              {agentUsage.map(item => {
                const max = agentUsage[0]?.requests || 1;
                const pct = Math.round((item.requests / max) * 100);
                return (
                  <div key={item.agent}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">{item.agent}</span>
                      <span className="text-slate-400">{item.requests}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Logs table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-4">Logs gần nhất</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left pb-2 font-medium">Thời gian</th>
                  <th className="text-left pb-2 font-medium">Agent</th>
                  <th className="text-left pb-2 font-medium">Model</th>
                  <th className="text-right pb-2 font-medium">Tokens</th>
                  <th className="text-right pb-2 font-medium">Latency</th>
                  <th className="text-center pb-2 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="py-2">
                        <div className="h-5 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400">Chưa có logs</td>
                  </tr>
                ) : (
                  recentLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <td className="py-1.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {fmtDate(log.created_at)}
                      </td>
                      <td className="py-1.5 text-slate-600 dark:text-slate-300">
                        {AGENT_LABEL[log.agent_id || ''] || log.agent_id || '–'}
                      </td>
                      <td className="py-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono">
                          {(log.model || '–').split('/').pop()?.slice(0, 16) || '–'}
                        </span>
                      </td>
                      <td className="py-1.5 text-right text-slate-500 dark:text-slate-400">
                        {((log.prompt_tokens || 0) + (log.completion_tokens || 0)).toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right text-slate-500 dark:text-slate-400">
                        {log.latency_ms ? `${(log.latency_ms / 1000).toFixed(1)}s` : '–'}
                      </td>
                      <td className="py-1.5 text-center">
                        {log.success === true ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 inline" />
                        ) : log.success === false ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-500 inline" />
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
