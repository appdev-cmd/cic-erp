import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { Activity, Layers, PlayCircle, AlertTriangle, RefreshCw, Cpu, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

const AICostPerToken = {
    'gemini-2.5-flash': 0.000000075,
    'gemini-1.5-pro': 0.00000125,
    'llama3.1': 0
};

export default function AIObservabilityDashboard() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [stats, setStats] = useState({
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        toolsCalled: 0
    });

    const [chartData, setChartData] = useState<any[]>([]);
    const [topTools, setTopTools] = useState<any[]>([]);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('ai_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1000);

            if (error) {
                console.error("Error fetching AI logs:", error);
                throw error;
            }

            if (data) {
                setLogs(data);

                // Calculate stats
                let reqCount = data.length;
                let tTokens = 0;
                let tCost = 0;
                
                data.forEach(log => {
                    tTokens += (log.prompt_tokens || 0) + (log.completion_tokens || 0);
                    tCost += (log.total_cost_usd || 0);
                });

                setStats({
                    totalRequests: reqCount,
                    totalTokens: tTokens,
                    totalCost: tCost,
                    toolsCalled: Math.floor(reqCount * 1.5) // Placeholder
                });
                
                // Placeholder chart data since we'd need complex grouping
                setChartData([
                    { name: 'T2', Marketing: 120, BGD: 30, System: 15 },
                    { name: 'T3', Marketing: 180, BGD: 45, System: 10 },
                    { name: 'T4', Marketing: 250, BGD: 20, System: 5 },
                    { name: 'T5', Marketing: 150, BGD: 80, System: 22 },
                    { name: 'T6', Marketing: 300, BGD: 15, System: 45 },
                    { name: 'T7', Marketing: 120, BGD: 10, System: 8 },
                    { name: 'CN', Marketing: 80, BGD: 5, System: 2 },
                ]);

                // Placeholder top tools data
                setTopTools([
                    { name: 'search_contracts', count: 420 },
                    { name: 'web_search', count: 350 },
                    { name: 'get_revenue_stats', count: 210 },
                    { name: 'find_employees', count: 180 },
                    { name: 'check_overdue_debt', count: 145 },
                ]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (num: number) => {
        if (num > 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num > 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toString();
    };

    return (
        <div className="p-6 md:p-8 space-y-6 w-full max-w-7xl mx-auto text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-500">
                        Trạm Giám Sát AI Siêu Việt
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Giám sát hoạt động, Tools, và chi phí API của các AI Agent.</p>
                </div>
                <button onClick={fetchLogs} disabled={loading} className={`px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Activity className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300">Tổng request</h3>
                    </div>
                    <p className="text-3xl font-bold">{formatNumber(stats.totalRequests)}</p>
                    <span className="text-sm text-emerald-500 mt-1 inline-block">Real-time stats</span>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <Layers className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300">Tools đã gọi</h3>
                    </div>
                    <p className="text-3xl font-bold">{formatNumber(stats.toolsCalled)}</p>
                    <span className="text-sm text-slate-500 mt-1 inline-block">Appoximated</span>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <Cpu className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300">Tokens tiêu thụ</h3>
                    </div>
                    <p className="text-3xl font-bold">{formatNumber(stats.totalTokens)}</p>
                    <span className="text-sm text-slate-500 mt-1 inline-block">Prompt + Completion</span>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-slate-700 dark:text-slate-300">Ước tính chi phí</h3>
                    </div>
                    <p className="text-3xl font-bold">${stats.totalCost.toFixed(4)}</p>
                    <span className="text-sm text-emerald-500 mt-1 inline-block">Dữ liệu từ db</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <h2 className="text-lg font-bold mb-4">Lưu lượng Request 7 ngày (AI Agents)</h2>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                                <XAxis dataKey="name" stroke="#64748b" />
                                <YAxis stroke="#64748b" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                />
                                <Line type="monotone" dataKey="Marketing" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6', strokeWidth: 2 }} />
                                <Line type="monotone" dataKey="BGD" stroke="#3b82f6" strokeWidth={3} />
                                <Line type="monotone" dataKey="System" stroke="#10b981" strokeWidth={3} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <h2 className="text-lg font-bold mb-4">Top Tools được gọi nhiều nhất</h2>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topTools} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#64748b" />
                                <YAxis dataKey="name" type="category" width={120} stroke="#64748b" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                                />
                                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

        </div>
    );
}
