import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Card from '../ui/Card';
import { Users, Briefcase, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { motion } from 'framer-motion';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#10b981', '#f59e0b'];

const RecruitmentDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalJobs: 0,
    openJobs: 0,
    totalCandidates: 0,
    totalHired: 0,
    avgTimeToHire: 0 // In days
  });

  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch all candidate applications
      const { data: apps } = await supabase.from('applications').select('id, stage, created_at, stage_updated_at, candidate_id, candidates(source)');
      const { data: jobs } = await supabase.from('job_openings').select('id, status');
      const { data: cands } = await supabase.from('candidates').select('id');

      const applications = apps || [];
      const jobOpenings = jobs || [];
      const candidates = cands || [];

      // Calculate KPI Stats
      let totalHired = 0;
      let totalDaysToHire = 0;

      applications.forEach(app => {
        if (app.stage === 'hired') {
          totalHired++;
          if (app.stage_updated_at && app.created_at) {
            const days = (new Date(app.stage_updated_at).getTime() - new Date(app.created_at).getTime()) / (1000 * 3600 * 24);
            if (days > 0) totalDaysToHire += days;
          }
        }
      });

      setStats({
        totalJobs: jobOpenings.length,
        openJobs: jobOpenings.filter(j => j.status === 'open').length,
        totalCandidates: candidates.length,
        totalHired,
        avgTimeToHire: totalHired > 0 ? Math.round(totalDaysToHire / totalHired) : 0
      });

      // Calculate Funnel
      const stageMap: Record<string, number> = {
        'applied': 0, 'screening': 0, 'interview_1': 0, 'interview_2': 0, 'technical_test': 0, 'offer': 0, 'hired': 0, 'rejected': 0, 'withdrawn': 0
      };
      
      applications.forEach(app => {
        if(stageMap[app.stage] !== undefined) {
          stageMap[app.stage]++;
        }
      });

      const fd = [
        { name: 'Apply', value: stageMap['applied'] || 0 },
        { name: 'Sàng lọc', value: stageMap['screening'] || 0 },
        { name: 'Phỏng vấn 1', value: stageMap['interview_1'] || 0 },
        { name: 'Phỏng vấn 2', value: stageMap['interview_2'] || 0 },
        { name: 'Gửi Offer', value: stageMap['offer'] || 0 },
        { name: 'Đã Tuyển', value: stageMap['hired'] || 0 }
      ];
      setFunnelData(fd);

      // Source Data
      const srcMap: Record<string, number> = {};
      applications.forEach((app: any) => {
        const src = app.candidates?.source || 'Khác';
        srcMap[src] = (srcMap[src] || 0) + 1;
      });

      const sd = Object.keys(srcMap).map(k => ({
        name: k.charAt(0).toUpperCase() + k.slice(1),
        value: srcMap[k]
      })).sort((a,b) => b.value - a.value);

      setSourceData(sd);

    } catch (e) {
      console.error('Error loading dashboard', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in custom-scrollbar overflow-x-hidden p-1">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-5 flex items-center gap-4 border-l-4 border-l-indigo-500">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Briefcase size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Job Đang Tuyển</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.openJobs} <span className="text-sm font-normal text-slate-400 mx-1">/ {stats.totalJobs} tổng</span></p>
            </div>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="p-5 flex items-center gap-4 border-l-4 border-l-blue-500">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tổng Ứng viên</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.totalCandidates}</p>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-5 flex items-center gap-4 border-l-4 border-l-emerald-500">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Đã Tuyển (Hired)</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.totalHired}</p>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="p-5 flex items-center gap-4 border-l-4 border-l-amber-500">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Time-to-Hire TB</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.avgTimeToHire} ngày</p>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Chart Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
          <Card className="p-5 h-full">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-6">Biểu đồ Phễu Tuyển dụng (Pipeline)</h3>
            <div className="-ml-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-secondary)" />
                  <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: 'var(--bg-hover)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}>
          <Card className="p-5 h-full">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-6">Nguồn CV Ứng viên</h3>
            <div className="h-[300px]">
              {sourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} innerRadius={70} outerRadius={110} dataKey="value" nameKey="name" paddingAngle={2}>
                      {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="rgba(0,0,0,0)" />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)', borderRadius: '8px' }} />
                    <Legend layout="vertical" verticalAlign="middle" align="right" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-slate-400">Không có dữ liệu</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default RecruitmentDashboard;
