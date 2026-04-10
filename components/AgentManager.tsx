import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Bot, Crown, Shield, Box, Leaf, Download, Monitor, HardHat,
  Compass, Calculator, Users, MapPin, ToggleLeft, ToggleRight,
  Eye, Pencil, BarChart3, Sparkles, Activity, Search, RefreshCw,
  ChevronRight, X
} from 'lucide-react';
import { AgentConfigService, type AgentConfigRow } from '../services/ai/agentConfigService';
import { usePermissionCheck } from '../hooks/usePermissions';
import { cn } from '../lib/utils';

// Icon map để render dynamic
const ICON_MAP: Record<string, React.ElementType> = {
  Crown, Shield, Box, Leaf, Download, Monitor, HardHat,
  Compass, Calculator, Users, MapPin, Bot, Sparkles, Activity
};

const AgentManager: React.FC = () => {
  const { can } = usePermissionCheck();
  const canManage = can('settings', 'update'); // Only Admin can edit

  const [agents, setAgents] = useState<AgentConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfigRow | null>(null);
  const [editingPrompt, setEditingPrompt] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await AgentConfigService.getAll();
      setAgents(data);
    } catch (err) {
      toast.error('Không thể tải danh sách Agent');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleToggleActive = async (agent: AgentConfigRow) => {
    if (!canManage) return toast.error('Bạn không có quyền quản trị Agent');
    try {
      await AgentConfigService.update(agent.id, { is_active: !agent.is_active });
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, is_active: !a.is_active } : a));
      toast.success(`${agent.name} đã ${!agent.is_active ? 'bật' : 'tắt'}`);
    } catch {
      toast.error('Lỗi cập nhật trạng thái');
    }
  };

  const handleSavePrompt = async () => {
    if (!selectedAgent || !canManage) return;
    try {
      await AgentConfigService.update(selectedAgent.id, { system_prompt: editingPrompt });
      setAgents(prev => prev.map(a => a.id === selectedAgent.id ? { ...a, system_prompt: editingPrompt } : a));
      setSelectedAgent(prev => prev ? { ...prev, system_prompt: editingPrompt } : null);
      toast.success('Đã lưu System Prompt');
    } catch {
      toast.error('Lỗi lưu prompt');
    }
  };

  const filteredAgents = agents.filter(a =>
    !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.department_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = agents.filter(a => a.is_active).length;
  const totalUsage = agents.reduce((s, a) => s + (a.usage_count || 0), 0);

  const renderIcon = (iconName: string, size = 20) => {
    const IconComp = ICON_MAP[iconName] || Bot;
    return <IconComp size={size} />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-lg">
              <Sparkles size={22} />
            </div>
            Quản lý AI Agents
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Cấu hình trợ lý AI cho từng phòng ban • {activeCount}/{agents.length} đang hoạt động • {totalUsage.toLocaleString()} lượt sử dụng
          </p>
        </div>
        <button
          onClick={fetchAgents}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Tìm agent theo tên hoặc mã phòng ban..."
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map(agent => (
            <div
              key={agent.id}
              className={cn(
                "group relative bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg",
                agent.is_active
                  ? "border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700"
                  : "border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100"
              )}
              onClick={() => { setSelectedAgent(agent); setEditingPrompt(agent.system_prompt); }}
            >
              {/* Color header bar */}
              <div className={cn("h-1.5", agent.color || 'bg-slate-500')} />

              <div className="p-4">
                {/* Icon + Status */}
                <div className="flex items-start justify-between mb-3">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md",
                    agent.color || 'bg-slate-600'
                  )}>
                    {renderIcon(agent.icon)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      agent.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                    )} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {agent.is_active ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>

                {/* Name + Dept */}
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm leading-tight">
                  {agent.name}
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded uppercase">
                    {agent.department_id === '*' ? 'Toàn C.Ty' : agent.department_id}
                  </span>
                  <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                    {agent.data_scope === 'company' ? '🏢 Company' : '🏠 Unit'}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                  {agent.description || 'Chưa có mô tả'}
                </p>

                {/* Stats footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <BarChart3 size={12} />
                    <span>{(agent.usage_count || 0).toLocaleString()} lượt</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span>{(agent.allowed_tools || []).length} tools</span>
                  </div>
                </div>
              </div>

              {/* Quick toggle (Admin only) */}
              {canManage && (
                <button
                  onClick={e => { e.stopPropagation(); handleToggleActive(agent); }}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  title={agent.is_active ? 'Tắt agent' : 'Bật agent'}
                >
                  {agent.is_active
                    ? <ToggleRight size={24} className="text-emerald-500" />
                    : <ToggleLeft size={24} className="text-slate-300 dark:text-slate-600" />
                  }
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail Panel (slide-in from right) */}
      {selectedAgent && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setSelectedAgent(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-slate-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg",
                  selectedAgent.color || 'bg-slate-600'
                )}>
                  {renderIcon(selectedAgent.icon)}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-slate-100">{selectedAgent.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedAgent.id} • {selectedAgent.department_id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Model</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 truncate">{selectedAgent.preferred_model}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Data Scope</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">{selectedAgent.data_scope === 'company' ? '🏢 Toàn công ty' : '🏠 Đơn vị'}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Lượt dùng</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">{(selectedAgent.usage_count || 0).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Trạng thái</p>
                  <p className="text-sm font-bold mt-0.5">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-bold",
                      selectedAgent.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    )}>
                      {selectedAgent.is_active ? '🟢 Hoạt động' : '⭕ Tắt'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Tools */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Danh sách Tools ({(selectedAgent.allowed_tools || []).length})</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedAgent.allowed_tools || []).map(tool => (
                    <span key={tool} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              {/* System Prompt Editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">System Prompt</h4>
                  {canManage && (
                    <button
                      onClick={handleSavePrompt}
                      className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      💾 Lưu
                    </button>
                  )}
                </div>
                <textarea
                  value={editingPrompt}
                  onChange={e => setEditingPrompt(e.target.value)}
                  rows={12}
                  disabled={!canManage}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 resize-y disabled:opacity-60 font-mono leading-relaxed"
                  placeholder="Nhập system prompt cho agent..."
                />
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Mô tả</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{selectedAgent.description || 'Chưa có mô tả'}</p>
              </div>
            </div>

            {/* Panel Footer */}
            {canManage && (
              <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-3 bg-white dark:bg-slate-900 shrink-0">
                <button
                  onClick={() => handleToggleActive(selectedAgent)}
                  className={cn(
                    "w-full py-2.5 rounded-xl font-bold text-sm transition-colors",
                    selectedAgent.is_active
                      ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30"
                      : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                  )}
                >
                  {selectedAgent.is_active ? '⏸️ Tắt Agent' : '▶️ Bật Agent'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AgentManager;
