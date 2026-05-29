import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Bot, Crown, Shield, Box, Leaf, Download, Monitor, HardHat,
  Compass, Calculator, Users, MapPin, ToggleLeft, ToggleRight,
  Eye, Pencil, BarChart3, Sparkles, Activity, Search, RefreshCw,
  ChevronRight, ChevronDown, X, Settings, Check
} from 'lucide-react';
import { AgentConfigService, type AgentConfigRow } from '../services/ai/agentConfigService';
import { getEnabledModels } from '../services/ai/models';
import { usePermissionCheck } from '../hooks/usePermissions';
import { cn } from '../lib/utils';
import { useSlidePanel } from '../contexts/SlidePanelContext';
import { erpToolsRegistry } from '../services/ai/openclaw/tools/registry';
import { marketingToolsRegistry } from '../services/ai/openclaw/tools/marketingTools';
import { EmployeeService } from '../services/employeeService';
import { ToolDetailModal } from './admin/ToolDetailModal';
import type { OpenClawTool } from '../services/ai/openclaw/types';

const ALL_ROLES = [
  { id: 'Admin', label: 'Quản trị hệ thống' },
  { id: 'Leadership', label: 'Ban Lãnh đạo' },
  { id: 'ChiefAccountant', label: 'Kế toán trưởng' },
  { id: 'Accountant', label: 'Kế toán' },
  { id: 'Legal', label: 'Pháp chế' },
  { id: 'UnitLeader', label: 'Lãnh đạo đơn vị' },
  { id: 'AdminUnit', label: 'Admin đơn vị' },
  { id: 'NVKD', label: 'Kinh doanh' },
  { id: 'NVKT', label: 'Kỹ thuật' },
  { id: 'Marketing', label: 'Marketing' },
];

const ALL_TOOLS = Array.from(new Set([
  ...erpToolsRegistry.map(t => t.name),
  ...marketingToolsRegistry.map(t => t.name)
])).sort();

const TOOL_MAP = new Map<string, OpenClawTool>(
  [...erpToolsRegistry, ...marketingToolsRegistry].map(t => [t.name, t])
);

// ── Tool Categories for organized display ──
const TOOL_CATEGORIES: { id: string; label: string; icon: string; color: string; tools: string[] }[] = [
  {
    id: 'contract', label: 'Hợp đồng', icon: '📋', color: 'bg-blue-500',
    tools: ['search_contracts', 'get_contract_detail', 'get_contract_stats', 'get_overdue_contracts', 'get_contract_expiry_timeline']
  },
  {
    id: 'finance', label: 'Tài chính', icon: '💰', color: 'bg-emerald-500',
    tools: ['search_payments', 'get_debt_report', 'get_cashflow_summary', 'get_revenue_forecast', 'get_expense_breakdown', 'get_budget_variance_report']
  },
  {
    id: 'hr', label: 'Nhân sự', icon: '👥', color: 'bg-violet-500',
    tools: ['search_employees', 'get_employee_ranking', 'get_employee_workload', 'get_hr_headcount_stats', 'get_leave_summary', 'get_attendance_report', 'get_contract_labor_expiry', 'get_employee_profile_360']
  },
  {
    id: 'hr_finance', label: 'Tuyển dụng & Lương', icon: '🎯', color: 'bg-pink-500',
    tools: ['get_recruitment_pipeline', 'get_salary_insights', 'get_payroll_summary', 'get_onboarding_status']
  },
  {
    id: 'dashboard', label: 'Dashboard & Báo cáo', icon: '📊', color: 'bg-amber-500',
    tools: ['get_dashboard_kpi', 'get_comparative_report', 'get_unit_ranking', 'get_daily_briefing', 'get_comprehensive_report', 'get_smart_insights']
  },
  {
    id: 'customer', label: 'Khách hàng & Sản phẩm', icon: '🏢', color: 'bg-cyan-500',
    tools: ['search_customers', 'get_customer_360', 'search_products', 'get_brands_report']
  },
  {
    id: 'system', label: 'Hệ thống & Tác vụ', icon: '⚙️', color: 'bg-slate-500',
    tools: ['create_task', 'approve_task', 'export_document', 'send_notification_email', 'delegate_task']
  },
  {
    id: 'planning', label: 'Lập kế hoạch', icon: '🗺️', color: 'bg-indigo-500',
    tools: ['create_smart_plan', 'analyze_bottleneck', 'forecast_next_quarter']
  },
  {
    id: 'knowledge', label: 'Tri thức & Tài liệu', icon: '📚', color: 'bg-teal-500',
    tools: ['search_knowledge_base', 'search_document_registry']
  },
  {
    id: 'marketing', label: 'Marketing', icon: '📣', color: 'bg-orange-500',
    tools: ['draft_social_post', 'schedule_social_post', 'analyze_seo_content', 'generate_newsletter', 'schedule_email_campaign', 'read_web_url', 'web_search', 'save_lead', 'get_leads']
  },
];

// Collect any tools not in categories
const categorizedTools = new Set(TOOL_CATEGORIES.flatMap(c => c.tools));
const uncategorizedTools = ALL_TOOLS.filter(t => !categorizedTools.has(t));
if (uncategorizedTools.length > 0) {
  TOOL_CATEGORIES.push({
    id: 'other', label: 'Khác', icon: '🔧', color: 'bg-gray-500',
    tools: uncategorizedTools
  });
}

// Icon map để render dynamic
const ICON_MAP: Record<string, React.ElementType> = {
  Crown, Shield, Box, Leaf, Download, Monitor, HardHat,
  Compass, Calculator, Users, MapPin, Bot, Sparkles, Activity
};

const AgentManager: React.FC = () => {
  const { can } = usePermissionCheck();
  const canManage = can('settings', 'update'); // Only Admin can edit

  const [agents, setAgents] = useState<AgentConfigRow[]>([]);
  const [employees, setEmployees] = useState<{id: string, name: string}[]>([]);
  const [userSearchText, setUserSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfigRow | null>(null);
  const [editingForm, setEditingForm] = useState<Partial<AgentConfigRow>>({});
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [configuringTool, setConfiguringTool] = useState<OpenClawTool | null>(null);
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const { openPanel, closePanel } = useSlidePanel();
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

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
    EmployeeService.getAll().then(emps => setEmployees(emps.map(e => ({ id: e.id, name: e.name })))).catch(() => {});
  }, [fetchAgents]);

  const handleToggleActive = async (agent: AgentConfigRow): Promise<void> => {
    if (!canManage) {
      toast.error('Bạn không có quyền quản trị Agent');
      return;
    }
    try {
      await AgentConfigService.update(agent.id, { is_active: !agent.is_active });
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, is_active: !a.is_active } : a));
      toast.success(`${agent.name} đã ${!agent.is_active ? 'bật' : 'tắt'}`);
    } catch {
      toast.error('Lỗi cập nhật trạng thái');
    }
  };


  const handleSync = async () => {
    if (!canManage) return;
    setSyncing(true);
    try {
      const res = await AgentConfigService.syncFromDefinitions();
      toast.success(`Đã đồng bộ ${res.success} agents từ source code`);
      fetchAgents();
    } catch (err) {
      toast.error('Lỗi đồng bộ cấu hình');
    } finally {
      setSyncing(false);
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
            Danh sách Agent
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Cấu hình trợ lý AI cho từng phòng ban • {activeCount}/{agents.length} đang hoạt động • {totalUsage.toLocaleString()} lượt sử dụng
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-lg text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> Đồng bộ từ Code
            </button>
          )}
          <button
            onClick={fetchAgents}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw size={16} className={loading && !syncing ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>
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
              onClick={() => { 
                setSelectedAgent(agent);
                openPanel({
                  title: agent.name,
                  icon: renderIcon(agent.icon, 14),
                  component: (
                    <AgentDetailPanel
                      agent={agent}
                      canManage={canManage}
                      employees={employees}
                      roles={ALL_ROLES}
                      onSave={async (id, updates) => {
                        try {
                          await AgentConfigService.update(id, updates);
                          setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
                          toast.success('Đã lưu cấu hình');
                          closePanel();
                        } catch {
                          toast.error('Lỗi khi lưu cấu hình');
                        }
                      }}
                      onToggleActive={handleToggleActive}
                      onClose={() => {
                        closePanel();
                        setSelectedAgent(null);
                      }}
                      renderIcon={renderIcon}
                    />
                  )
                });
              }}
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

          </div>
  );
};


interface AgentDetailPanelProps {
  agent: AgentConfigRow;
  canManage: boolean;
  employees: {id: string, name: string}[];
  roles: any[];
  onSave: (id: string, updates: Partial<AgentConfigRow>) => Promise<void>;
  onToggleActive: (agent: AgentConfigRow) => Promise<void>;
  onClose: () => void;
  renderIcon: (iconName: string, size?: number) => React.ReactNode;
}

const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({
  agent,
  canManage,
  employees,
  roles,
  onSave,
  onToggleActive,
  onClose,
  renderIcon
}) => {
  const [editingForm, setEditingForm] = useState<Partial<AgentConfigRow>>({
    description: agent.description,
    system_prompt: agent.system_prompt,
    allowed_tools: agent.allowed_tools || [],
    allowed_roles: agent.allowed_roles || [],
    allowed_users: agent.allowed_users || [],
    preferred_model: agent.preferred_model,
    data_scope: agent.data_scope
  });
  const [configuringTool, setConfiguringTool] = useState<OpenClawTool | null>(null);
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [userSearchText, setUserSearchText] = useState('');

  const handleSaveConfig = async () => {
    await onSave(agent.id, editingForm);
  };

  return (
    <>
      {/* Detail Panel (slide-in from right) */}
      <div className="flex flex-col h-full bg-white dark:bg-slate-950">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg",
                  agent.color || 'bg-slate-600'
                )}>
                  {renderIcon(agent.icon)}
                </div>
                <div>
                  <h3 className="font-black text-slate-800 dark:text-slate-100">{agent.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{agent.id} • {agent.department_id}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">

                {/* ─── LEFT COLUMN: Prompt & Description ─── */}
                <div className="flex flex-col space-y-6">
                  {/* Description Editor */}
                  <div className="flex-none">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Mô tả khả năng của Agent</h4>
                    <textarea
                      value={editingForm.description || ''}
                      onChange={e => setEditingForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      disabled={!canManage}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 resize-y disabled:opacity-60 leading-relaxed"
                      placeholder="Nhập mô tả cho agent..."
                    />
                  </div>

                  {/* System Prompt Editor */}
                  <div className="flex-1 flex flex-col min-h-[300px]">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">System Prompt</h4>
                    </div>
                    <textarea
                      value={editingForm.system_prompt || ''}
                      onChange={e => setEditingForm(prev => ({ ...prev, system_prompt: e.target.value }))}
                      disabled={!canManage}
                      className="w-full flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:opacity-60 font-mono leading-relaxed"
                      placeholder="Nhập system prompt cho agent..."
                    />
                  </div>
                </div>

                {/* ─── RIGHT COLUMN: Settings ─── */}
                <div className="flex flex-col space-y-6">
                  {/* Info Cards */}
                  <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Model mặc định</p>
                  {canManage ? (
                    <select
                      className="mt-1 w-full p-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none text-slate-800 dark:text-slate-200"
                      value={editingForm.preferred_model || 'gemma-4-26b'}
                      onChange={e => setEditingForm(prev => ({ ...prev, preferred_model: e.target.value }))}
                    >
                      {/* Group by provider */}
                      {(['local', 'gemini', 'openai', 'deepseek'] as const).map(provider => {
                        const models = getEnabledModels().filter(m => m.provider === provider);
                        if (models.length === 0) return null;
                        const providerLabel: Record<string, string> = {
                          local: '🖥 Local (vLLM)',
                          gemini: '✨ Google Gemini',
                          openai: '🤖 OpenAI',
                          deepseek: '🔷 DeepSeek',
                        };
                        return (
                          <optgroup key={provider} label={providerLabel[provider]}>
                            {models.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name}{m.isDefault ? ' ★' : ''}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  ) : (
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                      {getEnabledModels().find(m => m.id === agent.preferred_model)?.name || agent.preferred_model || 'Gemma 4 26B (mặc định)'}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Data Scope</p>
                  {canManage ? (
                     <select
                      className="mt-1 w-full p-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded outline-none text-slate-800 dark:text-slate-200"
                      value={editingForm.data_scope || 'unit'}
                      onChange={e => setEditingForm(prev => ({ ...prev, data_scope: e.target.value as 'company'|'unit' }))}
                    >
                      <option value="company">🏢 Toàn công ty</option>
                      <option value="unit">🏠 Đơn vị</option>
                    </select>
                  ) : (
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">{agent.data_scope === 'company' ? '🏢 Toàn công ty' : '🏠 Đơn vị'}</p>
                  )}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Lượt dùng</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">{(agent.usage_count || 0).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Trạng thái</p>
                  <p className="text-sm font-bold mt-0.5">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-bold",
                      agent.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    )}>
                      {agent.is_active ? '🟢 Hoạt động' : '⭕ Tắt'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Tools - Categorized Layout */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Danh sách Tools ({(editingForm.allowed_tools || []).length}/{ALL_TOOLS.length})
                  </h4>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingForm(prev => ({ ...prev, allowed_tools: [...ALL_TOOLS] }))}
                        className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >Chọn tất cả</button>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <button
                        onClick={() => setEditingForm(prev => ({ ...prev, allowed_tools: [] }))}
                        className="text-[10px] font-bold text-rose-500 dark:text-rose-400 hover:underline"
                      >Bỏ tất cả</button>
                    </div>
                  )}
                </div>

                {/* Tool Search */}
                {canManage && (
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={toolSearchQuery}
                      onChange={e => setToolSearchQuery(e.target.value)}
                      placeholder="Tìm tool theo tên..."
                      className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                )}

                {canManage ? (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {TOOL_CATEGORIES.map(cat => {
                      const filteredTools = cat.tools.filter(t =>
                        ALL_TOOLS.includes(t) && (!toolSearchQuery || t.toLowerCase().includes(toolSearchQuery.toLowerCase()) || (TOOL_MAP.get(t)?.description || '').toLowerCase().includes(toolSearchQuery.toLowerCase()))
                      );
                      if (filteredTools.length === 0) return null;

                      const selectedInCat = filteredTools.filter(t => (editingForm.allowed_tools || []).includes(t));
                      const allSelected = selectedInCat.length === filteredTools.length;
                      const someSelected = selectedInCat.length > 0 && !allSelected;
                      const isCollapsed = collapsedCategories.has(cat.id);

                      const toggleCategoryAll = () => {
                        if (allSelected) {
                          setEditingForm(prev => ({
                            ...prev,
                            allowed_tools: (prev.allowed_tools || []).filter((t: string) => !filteredTools.includes(t))
                          }));
                        } else {
                          setEditingForm(prev => ({
                            ...prev,
                            allowed_tools: [...new Set([...(prev.allowed_tools || []), ...filteredTools])]
                          }));
                        }
                      };

                      const toggleCollapse = () => {
                        setCollapsedCategories(prev => {
                          const next = new Set(prev);
                          if (next.has(cat.id)) next.delete(cat.id);
                          else next.add(cat.id);
                          return next;
                        });
                      };

                      return (
                        <div key={cat.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                          {/* Category Header */}
                          <div
                            className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none"
                            onClick={toggleCollapse}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">{cat.icon}</span>
                              <span className="text-xs font-black text-slate-700 dark:text-slate-200">{cat.label}</span>
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                allSelected
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : someSelected
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                              )}>
                                {selectedInCat.length}/{filteredTools.length}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleCategoryAll(); }}
                                className={cn(
                                  "text-[10px] font-bold px-2 py-1 rounded-md transition-colors",
                                  allSelected
                                    ? "bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/30"
                                    : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/30"
                                )}
                              >
                                {allSelected ? 'Bỏ chọn' : 'Chọn hết'}
                              </button>
                              {isCollapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                            </div>
                          </div>

                          {/* Category Tools */}
                          {!isCollapsed && (
                            <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                              {filteredTools.map(toolName => {
                                const isSelected = (editingForm.allowed_tools || []).includes(toolName);
                                const toolObj = TOOL_MAP.get(toolName);
                                const desc = toolObj?.description || '';
                                return (
                                  <div
                                    key={toolName}
                                    className={cn(
                                      "flex items-start gap-2 p-2 border rounded-lg transition-all duration-150 group relative cursor-pointer",
                                      isSelected
                                        ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700"
                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700"
                                    )}
                                    onClick={() => {
                                      const checked = !isSelected;
                                      setEditingForm(prev => ({
                                        ...prev,
                                        allowed_tools: checked
                                          ? [...(prev.allowed_tools || []), toolName]
                                          : (prev.allowed_tools || []).filter((t: string) => t !== toolName)
                                      }));
                                    }}
                                  >
                                    <div className={cn(
                                      "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                                      isSelected
                                        ? "bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500"
                                        : "border-slate-300 dark:border-slate-600"
                                    )}>
                                      {isSelected && <Check size={10} className="text-white" />}
                                    </div>
                                    <div className="min-w-0 flex-1 pr-6">
                                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{toolName}</p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-relaxed mt-0.5">{desc}</p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setConfiguringTool(toolObj || null);
                                      }}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Cấu hình Tool"
                                    >
                                      <Settings size={13} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Read-only view: grouped by category */
                  <div className="space-y-3">
                    {TOOL_CATEGORIES.map(cat => {
                      const agentTools = (agent.allowed_tools || []).filter(t => cat.tools.includes(t));
                      if (agentTools.length === 0) return null;
                      return (
                        <div key={cat.id}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-sm">{cat.icon}</span>
                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">{cat.label}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {agentTools.map(toolName => {
                              const toolObj = TOOL_MAP.get(toolName);
                              return (
                                <div key={toolName} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold group relative cursor-help">
                                  <span title={`${toolName}\n\n${toolObj?.description || ''}`}>{toolName}</span>
                                  <button
                                    onClick={() => setConfiguringTool(toolObj || null)}
                                    className="ml-1 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded"
                                  >
                                    <Settings size={12} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Access Control: Roles & Users */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Roles */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Vai trò được phép ({(editingForm.allowed_roles || []).length})</h4>
                  {canManage ? (
                    <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      {ALL_ROLES.map(role => {
                        const isSelected = (editingForm.allowed_roles || []).includes(role.id);
                        return (
                          <label key={role.id} className={cn("flex flex-col gap-1 p-2 border rounded-lg cursor-pointer transition-colors", isSelected ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500/50" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300")}>
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 bg-white dark:bg-slate-800"
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setEditingForm(prev => ({
                                    ...prev,
                                    allowed_roles: checked 
                                      ? [...(prev.allowed_roles || []), role.id] 
                                      : (prev.allowed_roles || []).filter((r: string) => r !== role.id)
                                  }));
                                }}
                              />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate" title={role.label}>{role.label}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(agent.allowed_roles || []).map(r => {
                          const rLabel = ALL_ROLES.find(x => x.id === r)?.label || r;
                          return <span key={r} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold">{rLabel}</span>;
                      })}
                    </div>
                  )}
                </div>

                {/* Users */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Người dùng cụ thể ({(editingForm.allowed_users || []).length})</h4>
                  {canManage ? (
                    <div className="flex flex-col max-h-56 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <input 
                        type="text" 
                        placeholder="Tìm kiếm nhân viên..." 
                        value={userSearchText}
                        onChange={e => setUserSearchText(e.target.value)}
                        className="mb-2 w-full p-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200"
                      />
                      <div className="overflow-y-auto pr-1 flex-1">
                        <div className="space-y-1.5">
                          {employees
                            .filter(e => !userSearchText || e.name.toLowerCase().includes(userSearchText.toLowerCase()))
                            .slice(0, 10)
                            .map(emp => {
                              const isSelected = (editingForm.allowed_users || []).includes(emp.id);
                              return (
                                <label key={emp.id} className={cn("flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors", isSelected ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500/50" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300")}>
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 bg-white dark:bg-slate-800 flex-shrink-0"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setEditingForm(prev => ({
                                        ...prev,
                                        allowed_users: checked 
                                          ? [...(prev.allowed_users || []), emp.id] 
                                          : (prev.allowed_users || []).filter((id: string) => id !== emp.id)
                                      }));
                                    }}
                                  />
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{emp.name}</span>
                                </label>
                              );
                          })}
                        </div>
                        {employees.filter(e => !userSearchText || e.name.toLowerCase().includes(userSearchText.toLowerCase())).length > 10 && (
                          <p className="text-[10px] text-slate-400 text-center italic mt-2">Đang hiển thị 10 nhân viên. Gõ chữ để tìm thêm.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-56">
                      {(agent.allowed_users || []).map(uId => {
                          const uName = employees.find(e => e.id === uId)?.name || 'Unknown';
                          return <span key={uId} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold">{uName}</span>;
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>{/* End Right Column */}

          </div>{/* End Grid */}
        </div>{/* End Panel Content */}

            {/* Panel Footer */}
            {canManage && (
              <div className="flex gap-2 border-t border-slate-200 dark:border-slate-800 px-6 py-3 bg-white dark:bg-slate-900 shrink-0">
                <button
                   onClick={handleSaveConfig}
                   className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                   💾 Lưu thay đổi
                </button>
                <button
                  onClick={() => onToggleActive(agent)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors",
                    agent.is_active
                      ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30"
                      : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                  )}
                >
                  {agent.is_active ? '⏸️ Tắt Agent' : '▶️ Bật Agent'}
                </button>
              </div>
            )}
          </div>
      {/* Tool Config Modal */}
      {configuringTool && (
        <ToolDetailModal
          tool={configuringTool}
          onClose={() => setConfiguringTool(null)}
          onSaved={() => {
            // Option to refresh config here if needed
          }}
        />
      )}
    </>
  );
};



export default AgentManager;
