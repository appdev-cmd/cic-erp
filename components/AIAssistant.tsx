
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Trash2,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  StopCircle,
  Scale,
  PenTool,
  BarChart3,
  ChevronDown,
  Zap,
  Database,
  Settings,
  X,
  BookOpen,
  ExternalLink,
  KeyRound,
  Paperclip,
  MessageSquare,
  Plus,
  Clock,
  PanelLeftClose,
  PanelLeft,
  AlertTriangle,
  ChevronRight,
  Users,
  Globe,
  Facebook,
  Linkedin,
  Mail
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamEnterpriseAI } from '../services/ai';
import { getBusinessContext, invalidateBusinessContext } from '../services/contextService';
import { searchKnowledgeBase } from '../services/ragService';
import { parseDocumentClientSide } from '../lib/documentReaderClient';
import { searchMentions, encodeMention, type MentionResult } from '../services/mentionService';
import { useAuth } from '../contexts/AuthContext';
import { runReActLoop } from '../services/ai/openclaw/react-loop';
import { getVisibleAgentsFilter, routeUserToAgentFilter } from '../services/ai/openclaw/router';
import { AgentConfigService } from '../services/ai/agentConfigService';
import { agentDefinitions } from '../services/ai/openclaw/agents/definitions';
import type { DepartmentAgent, UserContext } from '../services/ai/openclaw/types';
import { cn } from '../lib/utils';
import * as AiHistory from '../services/aiChatHistoryService';
import type { AiConversation } from '../services/aiChatHistoryService';
import { toast } from 'sonner';
import AIDataIngestion from './AIDataIngestion';
import { NewsService } from '../services/newsService';
import { dataClient } from '../lib/dataClient';
// Formatter functions outside component to avoid reference changes during render
const formatValue = (value: any) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value);
const formatTooltip = (value: any) => new Intl.NumberFormat('vi-VN').format(Number(value));
const PIE_COLORS = ['#4f46e5', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
const CHART_CURSOR = { fill: 'rgba(0,0,0,0.05)' };
const LEGEND_STYLE = { fontSize: '12px', marginTop: '10px' };

const DynamicChart = React.memo(({ configStr }: { configStr: string }) => {
  const chartConfig = React.useMemo(() => {
    try {
      // LLMs often leave trailing commas or add backticks inside the block
      let cleanStr = configStr.replace(/,\s*([\]}])/g, '$1').trim();
      if (cleanStr.startsWith('```json')) cleanStr = cleanStr.substring(7);
      if (cleanStr.startsWith('`')) cleanStr = cleanStr.replace(/^`+|`+$/g, '');
      cleanStr = cleanStr.trim();

      const config = JSON.parse(cleanStr);
      if (!config.data || !Array.isArray(config.data) || config.data.length === 0) {
        return { error: 'Dữ liệu mảng data: [] rỗng hoặc không tồn tại', raw: configStr };
      }

      // ═══ AUTO-NORMALIZE: Chuyển đổi mọi format về chuẩn { xAxisKey, lines } ═══
      
      // 1) Tìm xAxisKey: ưu tiên config → fallback 'name' nếu có trong data
      if (!config.xAxisKey) {
        const firstItem = config.data[0];
        if (firstItem.name !== undefined) config.xAxisKey = 'name';
        else if (firstItem.label !== undefined) config.xAxisKey = 'label';
        else config.xAxisKey = Object.keys(firstItem)[0];
      }

      // 2) Tìm lines: ưu tiên config.lines → chuyển từ config.keys → auto-detect
      if (!config.lines || !Array.isArray(config.lines) || config.lines.length === 0) {
        const chartColors = config.colors || ['#6366f1', '#94a3b8', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
        
        if (config.keys && Array.isArray(config.keys)) {
          // Format từ tool: { keys: ['kyTruoc', 'kyNay'], colors: [...] }
          config.lines = config.keys.map((key: string, i: number) => ({
            dataKey: key,
            color: chartColors[i % chartColors.length],
            name: key // Sẽ hiển thị label trên legend
          }));
        } else {
          // Auto-detect: lấy tất cả numeric keys (trừ xAxisKey)
          const firstItem = config.data[0];
          const numericKeys = Object.keys(firstItem).filter(k => 
            k !== config.xAxisKey && typeof firstItem[k] === 'number'
          );
          config.lines = numericKeys.map((key: string, i: number) => ({
            dataKey: key,
            color: chartColors[i % chartColors.length],
            name: key
          }));
        }
      }

      return { config };
    } catch (e: any) {
      return { error: e.message, raw: configStr };
    }
  }, [configStr]);

  if (chartConfig.error) {
    return (
      <div className="text-sm text-amber-600 border border-amber-200 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 my-2">
        <p className="font-bold mb-2">⚠️ Dữ liệu biểu đồ từ AI chưa chuẩn định dạng JSON ({chartConfig.error}):</p>
        <pre className="text-[10px] overflow-auto whitespace-pre-wrap">{chartConfig.raw}</pre>
      </div>
    );
  }

  const { type, data, xAxisKey, lines, title, unit } = chartConfig.config;

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
            <XAxis dataKey={xAxisKey} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} tickFormatter={formatValue} tickLine={false} axisLine={false} />
            <RechartsTooltip cursor={CHART_CURSOR} formatter={formatTooltip} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            {lines?.map((line: any, i: number) => (
              <Bar key={line.dataKey || i} dataKey={line.dataKey} fill={line.color || '#4f46e5'} radius={[4, 4, 0, 0]} name={line.name || line.dataKey} />
            ))}
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
            <XAxis dataKey={xAxisKey} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} tickFormatter={formatValue} tickLine={false} axisLine={false} />
            <RechartsTooltip formatter={formatTooltip} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            {lines?.map((line: any, i: number) => (
              <Line key={line.dataKey || i} type="monotone" dataKey={line.dataKey} stroke={line.color || '#4f46e5'} strokeWidth={2} name={line.name || line.dataKey} />
            ))}
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie data={data} dataKey={lines?.[0]?.dataKey || 'value'} nameKey={xAxisKey} cx="50%" cy="50%" outerRadius={80} label>
              {data.map((entry: any, index: number) => (
                <Cell key={"cell-" + index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip formatter={formatTooltip} />
            <Legend wrapperStyle={LEGEND_STYLE} />
          </PieChart>
        );
      default:
        return <div className="text-sm text-slate-500">Loại biểu đồ không được hỗ trợ</div>;
    }
  };

  return (
    <div className="w-full my-4 p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl shadow-sm overflow-hidden">
      {title && <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 text-center">{title}</p>}
      <div className="h-72">
        <ResponsiveContainer width="99%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
      {unit && <p className="text-[10px] text-slate-400 text-right mt-1">Đơn vị: {unit}</p>}
    </div>
  );
}); // End of DynamicChart

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isStreaming?: boolean;
  timestamp: Date;
}

import { getVisibleAgents } from '../services/ai/openclaw/router';
import * as Icons from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  Sparkles: Icons.Sparkles,
  Scale: Icons.Scale,
  PenTool: Icons.PenTool,
  BarChart3: Icons.BarChart3,
  Crown: Icons.Crown,
  Box: Icons.Box,
  Leaf: Icons.Leaf,
  HardHat: Icons.HardHat,
  Monitor: Icons.Monitor,
  Calculator: Icons.Calculator,
  Compass: Icons.Compass,
  Users: Icons.Users,
  MapPin: Icons.MapPin,
  Shield: Icons.Shield,
  Download: Icons.Download,
  Terminal: Icons.Terminal,
};

type ActiveView = 'chat' | 'ingest';
const getStorageKey = (userId?: string) => userId ? `cic_ai_chat_history_${userId}` : 'cic_ai_chat_history';
const MODEL_STORAGE_KEY = 'cic_ai_model';
const AGENT_STORAGE_KEY = 'cic_ai_agent';

export const CUSTOM_GEMINI_KEY = 'cic_custom_gemini_key';
export const CUSTOM_OPENAI_KEY = 'cic_custom_openai_key';
export const CUSTOM_DEEPSEEK_KEY = 'cic_custom_deepseek_key';

const saveMessages = (messages: Message[], userId?: string) => {
  try {
    // Only save last 50 messages to avoid localStorage bloat
    const toSave = messages.slice(-50).map(m => ({
      ...m,
      isStreaming: false,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp
    }));
    localStorage.setItem(getStorageKey(userId), JSON.stringify(toSave));
  } catch { /* localStorage full or unavailable */ }
};

const loadMessages = (userId?: string): Message[] => {
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return parsed.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
      isStreaming: false
    }));
  } catch { return []; }
};

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'model',
  content: 'Xin chào! Tôi là Trợ lý AI Enterprise của bạn. \n\nTôi có thể giúp gì cho bạn hôm nay? Hãy chọn một gợi ý bên dưới hoặc nhập câu hỏi trực tiếp.',
  timestamp: new Date()
};

const MARKDOWN_COMPONENTS: any = {
  table: ({ node, ...props }: any) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg" {...props} /></div>,
  th: ({ node, ...props }: any) => <th className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400" {...props} />,
  td: ({ node, ...props }: any) => <td className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-sm" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="list-disc pl-5 space-y-1" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
  code: ({ node, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    if (match && match[1] === 'chart') {
      return <DynamicChart configStr={String(children).replace(/\n$/, '')} />;
    }
    return className ? (
      <pre className="p-4 rounded-lg bg-slate-900 text-slate-50 overflow-x-auto my-4 text-sm font-mono"><code className={className} {...props}>{children}</code></pre>
    ) : (
      <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono text-rose-500 dark:text-rose-400" {...props}>{children}</code>
    );
  },
  a: ({ node, ...props }: any) => {
    const isExport = props.href?.startsWith('data:') || props.href?.startsWith('blob:');
    return <a className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold" target="_blank" rel="noopener noreferrer" download={isExport ? 'BaoCao_Export.md' : undefined} {...props} />;
  }
};

const AIAssistant: React.FC = () => {
  const { profile: _profile } = useAuth();
  const [dbAgents, setDbAgents] = useState<DepartmentAgent[]>([]);

  useEffect(() => {
    const isAdmin = _profile?.role === 'Admin' || _profile?.role === 'Leadership';
    if (isAdmin) {
      // Admin: merge DB agents with code definitions as fallback (so agents show even if not synced to DB)
      AgentConfigService.getAllAgents()
        .then(dbRows => {
          const dbIds = new Set(dbRows.map(a => a.id));
          const codeOnly = Object.values(agentDefinitions).filter(a => !dbIds.has(a.id));
          setDbAgents([...dbRows, ...codeOnly]);
        })
        .catch(() => {
          // DB unreachable — use code definitions directly
          setDbAgents(Object.values(agentDefinitions));
        });
    } else {
      AgentConfigService.getActive().then(setDbAgents).catch(() => {});
    }
  }, [_profile?.role]);
  
  const dynamicAgents = React.useMemo(() => {
    const _context: UserContext = {
      userId: _profile?.id || 'web',
      employeeId: _profile?.employeeId,
      fullName: _profile?.fullName || 'Người dùng',
      role: _profile?.role || 'Guest',
      unitCode: _profile?.unitCode
    };
    const visible = getVisibleAgentsFilter(_context, dbAgents);
    const agentMap: Record<string, any> = {};
    visible.forEach(a => {
      agentMap[a.id] = {
        name: a.name,
        role: a.description || 'Trợ lý AI',
        color: a.color || 'bg-indigo-600',
        icon: (a.icon && ICON_MAP[a.icon]) || Icons.Bot,
        prompt: a.systemPrompt,
        suggestions: a.allowedTools && a.allowedTools.length > 0 
          ? ['Dữ liệu hôm nay thế nào?', 'Tóm tắt báo cáo gần nhất'] 
          : ['Bạn có thể giúp gì cho tôi?']
      };
    });
    // Add default SYSTEM general if not present
    if (!agentMap['SYSTEM']) {
      agentMap['SYSTEM'] = {
        name: 'Tổng quát',
        role: 'Trợ lý ảo Enterprise',
        color: 'bg-indigo-600',
        icon: Icons.Sparkles,
        prompt: 'Bạn là Trợ lý AI Enterprise của CIC.',
        suggestions: ['Tổng doanh thu công ty năm nay bao nhiêu?', 'Ai là nhân sự xuất sắc nhất năm nay?']
      };
    }
    return agentMap;
  }, [_profile, dbAgents]);

  const [currentModel, setCurrentModel] = useState<string>(() => {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    // Auto-reset stale model nếu model cũ không còn trên vLLM
    const staleModels = ['Qwen3.5', 'gemma-3-9b', 'gemma-2-9b', 'Qwen2.5-14B', 'qwen2.5-14b', 'cic-legal-14b', 'qwen-2.5-14b'];
    if (saved && staleModels.some(s => saved.includes(s))) {
      localStorage.removeItem(MODEL_STORAGE_KEY);
      return 'qwen2.5-7b';
    }
    return saved || import.meta.env.VITE_DEFAULT_LLM_MODEL || 'gemini-2.0-flash';
  });

  const [useHermesEngine, setUseHermesEngine] = useState<boolean>(() => {
    const saved = localStorage.getItem('cic_use_hermes_engine');
    if (saved !== null) return saved === 'true';
    return import.meta.env.VITE_USE_HERMES === 'true';
  });

  const [currentAgent, setCurrentAgent] = useState<string>(() => {
    return localStorage.getItem(AGENT_STORAGE_KEY) || 'SYSTEM';
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    // We will initialize empty or load from global if no user, but will trigger effect below when user ready
    return [WELCOME_MESSAGE];
  });

  // Re-load messages strictly when the user account changes
  useEffect(() => {
    if (_profile?.id) {
      const saved = loadMessages(_profile.id);
      setMessages(saved.length > 0 ? saved : [WELCOME_MESSAGE]);
    }
  }, [_profile?.id]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('chat');
  
  // ─── Chat History State ─────────────────────────────────
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const activeConvIdRef = useRef<string | null>(null);
  activeConvIdRef.current = activeConvId;

  // Load conversations on mount
  useEffect(() => {
    if (_profile?.id) {
      AiHistory.getConversations(_profile.id).then(convs => setConversations(convs));
    }
  }, [_profile?.id]);

  // ─── Proactive Alerts State ────────────────────────────
  const [proactiveAlerts, setProactiveAlerts] = useState<{ icon: string; text: string; action: string; severity: 'danger' | 'warning' | 'info' }[]>([]);
  const [alertsDismissed, setAlertsDismissed] = useState(false);

  // Fetch proactive alerts on mount (only for Leadership/Admin roles)
  useEffect(() => {
    if (!_profile?.id || !['Admin', 'Leadership', 'UnitLeader'].includes(_profile?.role || '')) return;
    const fetchAlerts = async () => {
      try {
        const alerts: typeof proactiveAlerts = [];
        const today = new Date().toISOString().split('T')[0];

        // 1. HĐ quá hạn (endDate < today, status is active)
        const { data: overdueContracts, count: overdueCount } = await dataClient
          .from('contracts')
          .select('id', { count: 'exact', head: true })
          .lt('end_date', today)
          .in('status', ['Đang thực hiện', 'Tạm dừng']);
        if (overdueCount && overdueCount > 0) {
          alerts.push({
            icon: '🔴',
            text: `${overdueCount} hợp đồng đã quá hạn hoàn thành`,
            action: 'Cho tôi xem danh sách hợp đồng quá hạn',
            severity: 'danger'
          });
        }

        // 2. HĐ sắp hết hạn (trong 30 ngày tới)
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const { count: expiringCount } = await dataClient
          .from('contracts')
          .select('id', { count: 'exact', head: true })
          .gte('end_date', today)
          .lte('end_date', futureDate.toISOString().split('T')[0])
          .in('status', ['Đang thực hiện']);
        if (expiringCount && expiringCount > 0) {
          alerts.push({
            icon: '🟡',
            text: `${expiringCount} hợp đồng sắp hết hạn (30 ngày)`,
            action: 'Cho tôi xem các hợp đồng sắp hết hạn trong 30 ngày tới',
            severity: 'warning'
          });
        }

        // 3. Phiếu thu quá hạn
        const { count: overduePayments } = await dataClient
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .lt('due_date', today)
          .in('status', ['Đã xuất HĐ', 'Tạm ứng']);
        if (overduePayments && overduePayments > 0) {
          alerts.push({
            icon: '💰',
            text: `${overduePayments} phiếu thu/chi quá hạn thanh toán`,
            action: 'Báo cáo công nợ chi tiết',
            severity: 'danger'
          });
        }

        setProactiveAlerts(alerts);
      } catch (err) {
        console.warn('Proactive alerts fetch failed:', err);
      }
    };
    fetchAlerts();
  }, [_profile?.id, _profile?.role]);

  // Load a specific conversation
  const loadConversation = useCallback(async (conv: AiConversation) => {
    setActiveConvId(conv.id);
    setShowHistory(false);
    const msgs = await AiHistory.getMessages(conv.id);
    if (msgs.length > 0) {
      setMessages(msgs.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'model',
        content: m.content,
        timestamp: new Date(m.created_at),
      })));
    }
  }, []);

  // Start new conversation
  const newConversation = useCallback(() => {
    setActiveConvId(null);
    setMessages([WELCOME_MESSAGE]);
    setShowHistory(false);
  }, []);

  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'config' | 'guide' | 'local'>('config');
  const [customGeminiKey, setCustomGeminiKey] = useState(() => localStorage.getItem(CUSTOM_GEMINI_KEY) || '');
  const [customOpenAIKey, setCustomOpenAIKey] = useState(() => localStorage.getItem(CUSTOM_OPENAI_KEY) || '');
  const [customDeepseekKey, setCustomDeepseekKey] = useState(() => localStorage.getItem(CUSTOM_DEEPSEEK_KEY) || '');
  const [localAIBaseURL, setLocalAIBaseURL] = useState(() => localStorage.getItem('cic_local_ai_base_url') || '/api/vllm');
  const [localAITestResult, setLocalAITestResult] = useState<{ok: boolean; models: string[]} | null>(null);
  const [localAITesting, setLocalAITesting] = useState(false);
  const [widgetHistoryBanner, setWidgetHistoryBanner] = useState(false);

  // ─── Mention State ──────────────────────────────────────
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionResults, setMentionResults] = useState<MentionResult[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [selectedMentions, setSelectedMentions] = useState<MentionResult[]>([]);

  const handleSearchMention = async (q: string) => {
    try {
      const results = await searchMentions(q);
      setMentionResults(results);
      setMentionIndex(0);
    } catch (e) {
      console.error(e);
    }
  };

  const insertMention = (item: MentionResult) => {
    if (mentionStartPos === null) return;
    const val = inputRef.current?.value || input;
    const beforePart = val.slice(0, mentionStartPos);
    
    // Find end of current query text inside input
    const cursor = inputRef.current?.selectionStart || val.length;
    const afterPart = val.slice(cursor);
    
    // Insert: @Label
    const mentionText = `@${item.label} `;
    const newInput = beforePart + mentionText + afterPart;
    
    setInput(newInput);
    setShowMentionDropdown(false);
    setSelectedMentions(prev => {
      if (!prev.find(p => p.id === item.id)) return [...prev, item];
      return prev;
    });
    
    // Focus back and set cursor
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = beforePart.length + mentionText.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // ─── Import chat history from ChatWidget popup ──────────
  useEffect(() => {
    try {
      const widgetHistory = localStorage.getItem('cic_widget_chat_history');
      if (widgetHistory) {
        setWidgetHistoryBanner(true);
      }
    } catch {}
  }, []);

  const importWidgetHistory = useCallback(() => {
    try {
      const raw = localStorage.getItem('cic_widget_chat_history');
      if (!raw) return;
      const parsed = JSON.parse(raw) as {role: string; content: string; timestamp: string}[];
      const imported: Message[] = parsed.map((m, i) => ({
        id: `widget_${i}_${Date.now()}`,
        role: m.role as 'user' | 'model',
        content: m.content,
        timestamp: new Date(m.timestamp),
      }));
      setMessages(prev => [...imported, ...prev]);
      localStorage.removeItem('cic_widget_chat_history');
      setWidgetHistoryBanner(false);
      toast.success(`Đã nhập ${imported.length} tin nhắn từ Chat nhanh!`);
    } catch { toast.error('Lỗi nhập lịch sử'); }
  }, []);

  const dismissWidgetHistory = useCallback(() => {
    localStorage.removeItem('cic_widget_chat_history');
    setWidgetHistoryBanner(false);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const agentMenuRef = useRef<HTMLDivElement>(null);

  // ─── Auto-scroll ────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ─── Persist messages  // Save messages whenever they change
  useEffect(() => {
    if (!isTyping && _profile?.id) saveMessages(messages, _profile.id);
  }, [messages, isTyping, _profile?.id]);

  // ─── Persist & Validate model/agent selection ──────────────────────
  useEffect(() => { localStorage.setItem(MODEL_STORAGE_KEY, currentModel); }, [currentModel]);
  useEffect(() => { localStorage.setItem(AGENT_STORAGE_KEY, currentAgent); }, [currentAgent]);

  // Kiểm tra quyền: nếu agent lấy từ cache không còn nằm trong danh sách được phép, tự động reset
  useEffect(() => {
    if (Object.keys(dynamicAgents).length > 0 && !dynamicAgents[currentAgent]) {
      setCurrentAgent(Object.keys(dynamicAgents)[0]);
    }
  }, [dynamicAgents, currentAgent]);

  useEffect(() => {
    localStorage.setItem('cic_use_hermes_engine', useHermesEngine.toString());
  }, [useHermesEngine]);

  const saveSettings = () => {
    localStorage.setItem(CUSTOM_GEMINI_KEY, customGeminiKey);
    localStorage.setItem(CUSTOM_OPENAI_KEY, customOpenAIKey);
    localStorage.setItem(CUSTOM_DEEPSEEK_KEY, customDeepseekKey);
    localStorage.setItem('cic_local_ai_base_url', localAIBaseURL);
    setShowSettings(false);
    toast.success('Đã lưu cấu hình!');
  };

  // ─── Test Local AI Connection ──────────────────────
  const testLocalAI = useCallback(async () => {
    setLocalAITesting(true);
    setLocalAITestResult(null);
    try {
      let models: string[] = [];

      // Lấy từ Ollama Native Proxy
      try {
        const res = await fetch(`/api/ollama_native/tags`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json() as { models?: { name: string }[] };
          if (data.models && data.models.length > 0) {
            models = [...models, ...data.models.map(m => m.name)];
          }
        }
      } catch (err) { console.log('Ollama timeout:', err); }

      // Lấy từ vLLM Proxy
      try {
        const res = await fetch(`/api/vllm/models`, { 
          signal: AbortSignal.timeout(3000),
          headers: { 'Authorization': `Bearer sk-cic-2026` }
        });
        if (res.ok) {
          const data = await res.json() as { data?: { id: string }[] };
          if (data.data && data.data.length > 0) {
            models = [...models, ...data.data.map(m => m.id)];
          }
        }
      } catch (err) { console.log('vLLM timeout:', err); }

      // Lấy từ vLLM Proxy (Gemma)
      try {
        const res = await fetch(`/api/vllm_gemma/models`, { 
          signal: AbortSignal.timeout(3000),
          headers: { 'Authorization': `Bearer sk-cic-2026` }
        });
        if (res.ok) {
          const data = await res.json() as { data?: { id: string }[] };
          if (data.data && data.data.length > 0) {
            models = [...models, ...data.data.map(m => m.id)];
          }
        }
      } catch (err) { console.log('vLLM Gemma timeout:', err); }

      // Lấy từ localAIBaseURL nếu user nhập vào custom url không phải localhost
      if (!localAIBaseURL.includes('localhost') && !localAIBaseURL.includes('127.0.0.1') && !localAIBaseURL.includes('/api/vllm')) {
        let v1Url = localAIBaseURL;
        if (!v1Url.includes('/v1')) v1Url = v1Url.replace(/\/$/, '') + '/v1';
        try {
          const res = await fetch(`${v1Url}/models`, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data = await res.json() as { data?: { id: string }[] };
            if (data.data && data.data.length > 0) {
              models = [...models, ...data.data.map(m => m.id)];
            }
          }
        } catch (err) { console.log('Custom local error:', err); }
      }

      // Xóa model trùng lặp
      models = Array.from(new Set(models));

      if (models.length > 0) {
        setLocalAITestResult({ ok: true, models });
      } else {
        throw new Error('Không lấy được danh sách model');
      }
    } catch {
      setLocalAITestResult({ ok: false, models: [] });
    } finally {
      setLocalAITesting(false);
    }
  }, [localAIBaseURL]);

  useEffect(() => {
    testLocalAI();
  }, [testLocalAI]);

  // ─── Pre-fetch business context ────────────────────────
  const [systemContext, setSystemContext] = useState<string>('');
  useEffect(() => {
    invalidateBusinessContext(); // Force refresh khi mở page
    getBusinessContext().then(ctx => setSystemContext(ctx));
  }, []);

  // ─── Close agent menu on outside click ─────────────────
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (agentMenuRef.current && !agentMenuRef.current.contains(e.target as Node)) {
        setShowAgentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Auto-resize textarea ──────────────────────────────
  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  useEffect(() => { autoResize(); }, [input, autoResize]);

  // ─── Send message ──────────────────────────────────────
  const handleSend = async (overrideInput?: string) => {
    const rawText = overrideInput || input.trim();
    if ((!rawText && attachedFiles.length === 0) || isTyping) return;

    let messageText = rawText;
    let fileContents = '';

    if (attachedFiles.length > 0) {
      try {
        toast.info(`Đang trích xuất văn bản từ ${attachedFiles.length} file...`);
        for (const file of attachedFiles) {
          if (file.type.indexOf('image/') === 0) {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
               reader.onload = (e) => resolve(e.target?.result as string);
               reader.readAsDataURL(file);
            });
            const b64 = await base64Promise;
            fileContents += `\n\n![Image](${b64})`;
          } else {
            const parsed = await parseDocumentClientSide(file);
            fileContents += `\n\n--- Trích xuất từ file: ${file.name} ---\n${parsed}\n--- Kết thúc file ---`;
          }
        }
        setAttachedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        toast.error(err.message || 'Lỗi khi đọc file');
        return;
      }
    }

    if (fileContents) {
      messageText = (messageText ? messageText + '\n\n' : '') + 'Dưới đây là nội dung tài liệu đính kèm:\n' + fileContents;
    }

    // Inject hidden mentions back into the messageText string so react-loop can extract them
    if (selectedMentions.length > 0) {
      const activeMentions = selectedMentions.filter(m => rawText.includes(`@${m.label}`));
      if (activeMentions.length > 0) {
        const hiddenTags = activeMentions.map(m => `[//]: # (${encodeMention(m)})`).join('\n');
        messageText += `\n\n${hiddenTags}`;
      }
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedMentions([]);
    setIsTyping(true);

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const botMsgId = (Date.now() + 1).toString();
    const botMsg: Message = {
      id: botMsgId,
      role: 'model',
      content: '',
      isStreaming: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const activeAgent = dynamicAgents[currentAgent] || Object.values(dynamicAgents)[0];

    try {
      // Lazy load to prevent circular logic if any
      const { runReActLoop } = await import('../services/ai/openclaw/react-loop');
      const { agentDefinitions } = await import('../services/ai/openclaw/agents/definitions');
      const { erpToolsRegistry } = await import('../services/ai/openclaw/tools/registry');

      // Lấy user context thật từ AuthContext
      const _userContext: UserContext = {
        userId: _profile?.employeeId || _profile?.id || 'web',
        employeeId: _profile?.employeeId,
        fullName: _profile?.fullName || 'Người dùng',
        role: _profile?.role || 'NVKD',
        unitId: _profile?.unitId,
        unitCode: _profile?.unitCode,
        email: _profile?.email,
      };

      // Auto-route agent dựa trên profile user (role + unitCode)
      // Nếu user chọn agent cụ thể qua UI tab, vẫn ưu tiên lấy theo tab
      // Ngược lại, route tự động theo phòng ban
      const autoAgent = routeUserToAgentFilter(_userContext, dbAgents);
      let agentConf = autoAgent;
      // Map 4 agent UI cũ sang agent definitions mới  
      if (currentAgent === 'legal') agentConf = dbAgents.find(a => a.id === 'agent-bgd' || a.departmentId === 'BGD') || autoAgent;
      if (currentAgent === 'drafter') agentConf = dbAgents.find(a => a.id === 'agent-hcns' || a.departmentId === 'HCNS') || autoAgent;
      if (currentAgent === 'analyst') agentConf = dbAgents.find(a => a.id === 'agent-bgd' || a.departmentId === 'BGD') || autoAgent;

      // Extract existing history for LLM
      const history = messages.filter(m => m.id !== 'welcome' && m.id !== botMsgId).map(m => {
        // Loại bỏ phần text indicator UI để LLM không bị rối context
        const cleanContent = m.content.replace(/> 🔍 \*Hệ thống đang truy xuất dữ liệu từ công cụ(.*?)\*\n\n/g, '').trim();
        return {
          role: m.role as 'user'|'model',
          content: cleanContent
        };
      });

      // ─── PHÂN LUỒNG XỬ LÝ (HERMES HOẶC OPENCLAW) ────────────────────────
      let finalContent = '';
      if (useHermesEngine) {
        const proxyUrl = import.meta.env.VITE_HERMES_PROXY_URL || 'http://localhost:3005';
        const res = await fetch(`${proxyUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMsg.content,
            agentId: currentAgent,
            userId: _userContext.userId,
            history: history,
            userContext: _userContext
          }),
          signal: controller.signal
        });

        if (!res.ok || !res.body) throw new Error('Proxy connection failed');
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;

        let streamContent = '';
        while (!done) {
          if (controller.signal.aborted) {
            reader.cancel();
            break;
          }
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  streamContent += data.text;
                  setMessages(prev => prev.map(m =>
                    m.id === botMsgId
                      ? { ...m, content: streamContent }
                      : m
                  ));
                } catch(e) {}
              }
            }
          }
        }
        finalContent = streamContent;
      } else {
        // Track content that accumulates
        let toolContent = '';
        let streamContent = '';

        const result = await runReActLoop(
          userMsg.content,
          _userContext,
          agentConf,
          erpToolsRegistry,
          history,
          8,
          controller.signal,
          (toolName, args) => {
            // Callback: tool đang được gọi → hiện indicator siêu gọn
            const friendlyName = toolName === 'get_contract_stats' ? 'thống kê hợp đồng' : 
                                 toolName === 'get_dashboard_kpi' ? 'chỉ số KPI' : 
                                 toolName === 'export_document' ? 'đóng gói file' : toolName;
            toolContent += `\n\n> 🔍 *Hệ thống đang truy xuất dữ liệu từ công cụ \`${friendlyName}\`...*\n\n`;
            setMessages(prev => prev.map(m =>
              m.id === botMsgId
                ? { ...m, content: toolContent }
                : m
            ));
          },
          currentModel,
          (chunk) => {
            // Callback: streaming final answer → hiện chữ ngay lập tức
            streamContent += chunk;
            setMessages(prev => prev.map(m =>
              m.id === botMsgId
                ? { ...m, content: toolContent + streamContent }
                : m
            ));
          }
        );

        finalContent = streamContent
          ? toolContent + streamContent  // Đã stream rồi
          : toolContent + result.reply;  // Fallback nếu không stream
      }

      // Khi xong hoàn toàn
      setMessages(prev => prev.map(m =>
        m.id === botMsgId
          ? { ...m, content: finalContent, isStreaming: false }
          : m
      ));

      // ─── AUTO-SAVE to DB ────────────────────────
      if (_profile?.id) {
        try {
          let convId = activeConvIdRef.current;
          if (!convId) {
            // Tạo conversation mới
            const title = AiHistory.generateTitle(userMsg.content);
            const conv = await AiHistory.createConversation(_profile.id, currentAgent, currentModel, title);
            if (conv) {
              convId = conv.id;
              setActiveConvId(conv.id);
              setConversations(prev => [conv, ...prev]);
            }
          }
          if (convId) {
            // Lưu cả user msg và bot reply
            await AiHistory.saveMessage(convId, 'user', userMsg.content);
            await AiHistory.saveMessage(convId, 'model', finalContent);
          }
        } catch (e) { console.warn('[aiChatHistory] save error:', e); }
      }

    } catch (error: any) {
      console.error("Chat Error", error);
      const errDetail = error?.message || String(error);
      setMessages(prev => prev.map(m =>
        m.id === botMsgId
          ? { ...m, content: `\n\n⚠️ Đã xảy ra lỗi kết nối.\n\n\`\`\`\n${errDetail}\n\`\`\``, isStreaming: false }
          : m
      ));
    } finally {
      setIsTyping(false);
    }
  };

  // ─── Stop streaming ────────────────────────────────────
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsTyping(false);
      // Mark current streaming msg as done
      setMessages(prev => prev.map(m =>
        m.isStreaming ? { ...m, isStreaming: false } : m
      ));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionDropdown && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % mentionResults.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionDropdown(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = async () => {
    if (window.confirm('Xóa toàn bộ lịch sử chat?')) {
      // Xóa conversation hiện tại khỏi DB nếu có
      if (activeConvId) {
        await AiHistory.deleteConversation(activeConvId);
        setConversations(prev => prev.filter(c => c.id !== activeConvId));
        setActiveConvId(null);
      }
      setMessages([WELCOME_MESSAGE]);
      localStorage.removeItem(getStorageKey(_profile?.id));
    }
  };

  const handleCopy = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(msgId);
    toast.success('Đã copy nội dung!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const switchAgent = (key: string) => {
    setCurrentAgent(key);
    setShowAgentMenu(false);
    const agent = dynamicAgents[key];
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'model',
      content: `**Đã chuyển sang chế độ: ${agent.name}** — ${agent.role}`,
      timestamp: new Date()
    }]);
  };

  // Check if should show suggestions (last message is from model and not streaming)
  const lastMsg = messages[messages.length - 1];
  const showSuggestions = lastMsg && lastMsg.role === 'model' && !lastMsg.isStreaming && !isTyping;

  return (
    <div className={cn(
      "flex flex-col bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-all duration-300",
      isFullScreen ? "fixed inset-0 z-50 rounded-none m-0" : "rounded-[24px] h-[calc(100vh-6rem)] md:h-[calc(100vh-7rem)] lg:h-[calc(100vh-8.5rem)] min-h-[500px] w-full max-w-7xl mx-auto relative"
    )}>
      {/* ═══ Header ═══════════════════════════════════════ */}
      <div className="flex items-center justify-between px-3 md:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-10 relative">
        {/* Left: Agent Identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md shrink-0",
            dynamicAgents[currentAgent]?.color
          )}>
            {dynamicAgents[currentAgent]?.icon && React.createElement(dynamicAgents[currentAgent].icon, { size: 18 })}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
              AI Agent
              <span className="px-1.5 py-px rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-wider">v5</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px] md:max-w-[300px] flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", dynamicAgents[currentAgent]?.color)}></span>
                <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", dynamicAgents[currentAgent]?.color)}></span>
              </span>
              {dynamicAgents[currentAgent]?.name}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Agent Selector Dropdown */}
          <div ref={agentMenuRef} className="relative">
            <button
              onClick={() => setShowAgentMenu(!showAgentMenu)}
              className={cn(
                "p-2 rounded-lg transition-all cursor-pointer",
                showAgentMenu
                  ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
              title="Chọn Agent"
            >
              <Users size={17} />
            </button>
            {showAgentMenu && (
              <div className="absolute top-full right-0 mt-1.5 w-[260px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl dark:shadow-black/40 z-50 py-1 overflow-hidden" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Chọn Agent</p>
                {Object.entries(dynamicAgents).map(([key, agent]) => {
                  const Icon = agent.icon;
                  const isActive = currentAgent === key;
                  return (
                    <button
                      key={key}
                      onClick={() => switchAgent(key)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer text-left",
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                      )}
                    >
                      <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0", agent.color)}>
                        <Icon size={12} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs truncate leading-tight">{agent.name}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{agent.role}</div>
                      </div>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chat Mode */}
          <button
            onClick={() => setActiveView('chat')}
            className={cn(
              "p-2 rounded-lg transition-all cursor-pointer",
              activeView === 'chat'
                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                : "text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            )}
            title="Chat AI"
          >
            <MessageSquare size={17} />
          </button>


          {/* Data Ingestion */}
          <button
            onClick={() => setActiveView('ingest')}
            className={cn(
              "p-2 rounded-lg transition-all cursor-pointer",
              activeView === 'ingest'
                ? "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20"
                : "text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20"
            )}
            title="Nạp dữ liệu"
          >
            <Database size={17} />
          </button>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>

          {/* New Chat */}
          <button
            onClick={newConversation}
            className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all cursor-pointer"
            title="Cuộc trò chuyện mới"
          >
            <Plus size={17} />
          </button>

          {/* History */}
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory && _profile?.id) AiHistory.getConversations(_profile.id).then(c => setConversations(c)); }}
            className={cn("p-2 rounded-lg transition-all cursor-pointer", showHistory ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20" : "text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20")}
            title="Lịch sử hội thoại"
          >
            <Clock size={17} />
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
            title="Cài đặt API Key"
          >
            <Settings size={17} />
          </button>

          {/* Clear */}
          <button
            onClick={clearChat}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all cursor-pointer"
            title="Xóa lịch sử"
          >
            <Trash2 size={17} />
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
            title={isFullScreen ? "Thu nhỏ" : "Toàn màn hình"}
          >
            {isFullScreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>

      {/* ═══ Chat History Sidebar ═══ */}
      {showHistory && (
        <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 max-h-[40vh] overflow-y-auto">
          <div className="px-4 py-2 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <MessageSquare size={13} /> Lịch sử hội thoại ({conversations.length})
            </p>
            <button onClick={() => setShowHistory(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
              <X size={14} />
            </button>
          </div>
          {conversations.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-400">Chưa có cuộc hội thoại nào</p>
          ) : (
            <div className="pb-2">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 flex items-start gap-3 group",
                    activeConvId === conv.id && "bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500"
                  )}
                >
                  <MessageSquare size={14} className="mt-0.5 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {conv.title || 'Cuộc hội thoại không có tiêu đề'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(conv.updated_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm('Xóa cuộc hội thoại này?')) {
                        await AiHistory.deleteConversation(conv.id);
                        setConversations(prev => prev.filter(c => c.id !== conv.id));
                        if (activeConvId === conv.id) newConversation();
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-all cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Conditional Render: Chat or Data Ingestion ═══ */}
      {activeView === 'ingest' ? (
        <AIDataIngestion />
      ) : (
        <>
          {/* ═══ Widget History Import Banner ═════════════════ */}
          {widgetHistoryBanner && (
            <div className="mx-4 md:mx-6 mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center gap-3">
              <span className="text-lg">📥</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Có lịch sử chat từ popup</p>
                <p className="text-[10px] text-indigo-500 dark:text-indigo-400">Nhập vào để tiếp tục cuộc trò chuyện</p>
              </div>
              <button onClick={importWidgetHistory} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer">Nhập</button>
              <button onClick={dismissWidgetHistory} className="p-1 text-indigo-400 hover:text-indigo-600 cursor-pointer"><X size={14} /></button>
            </div>
          )}
          {/* ═══ Proactive Alerts Banner ════════════════════ */}
          {proactiveAlerts.length > 0 && !alertsDismissed && messages.length <= 1 && (
            <div className="mx-4 md:mx-6 mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={11} /> Cảnh báo ({proactiveAlerts.length})
                </p>
                <button onClick={() => setAlertsDismissed(true)} className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                  <X size={12} />
                </button>
              </div>
              {proactiveAlerts.map((alert, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(alert.action)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
                    alert.severity === 'danger'
                      ? "bg-rose-50 dark:bg-rose-900/15 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/25"
                      : alert.severity === 'warning'
                      ? "bg-amber-50 dark:bg-amber-900/15 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/25"
                      : "bg-sky-50 dark:bg-sky-900/15 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/25"
                  )}
                >
                  <span className="text-base">{alert.icon}</span>
                  <span className="flex-1">{alert.text}</span>
                  <ChevronRight size={12} className="opacity-50" />
                </button>
              ))}
            </div>
          )}
          {/* ═══ Messages Area ════════════════════════════════ */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 md:gap-4 max-w-[95%] md:max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                  msg.role === 'user'
                    ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    : cn("border-transparent text-white shadow-md shadow-indigo-200 dark:shadow-none", dynamicAgents[currentAgent]?.color)
                )}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>

                <div className={cn(
                  "group relative px-5 py-3.5 md:px-6 md:py-4 rounded-[20px] text-sm leading-relaxed shadow-sm",
                  msg.role === 'user'
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm"
                )}>
                  {msg.role === 'model' ? (
                    <div className="markdown-body">
                      {msg.content === '' && msg.isStreaming ? (
                        <span className="flex gap-1.5 items-center h-5">
                          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                        </span>
                      ) : (
                        <div className="prose prose-sm prose-indigo dark:prose-invert max-w-none break-words">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            urlTransform={(url: string) => url}
                            components={MARKDOWN_COMPONENTS as any}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {msg.role === 'model' && !msg.isStreaming && msg.content && (
                    <div className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-pointer transition-colors"
                        title="Copy"
                      >
                        {copiedId === msg.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                      {msg.content.length > 50 && (
                        <button
                          onClick={async () => {
                            try {
                              const titleVi = msg.content.substring(0, 60).replace(/[#*`]/g, '').trim() + '...';
                              const slug = 'ai-post-' + Date.now();
                              await NewsService.create({
                                titleVi,
                                slug,
                                contentVi: msg.content,
                                status: 'pending_approval'
                              });
                              toast.success('Đã gửi bài viết lên mục Tin tức chờ duyệt!');
                            } catch (e: any) {
                              toast.error('Lỗi khi gửi bài: ' + (e.message || 'Error'));
                            }
                          }}
                          className="px-2 py-1.5 text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:text-orange-600 hover:border-orange-200 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer group/btn"
                          title="Gửi bài lên CMS để đăng Đa kênh (Web, FB, LinkedIn, Email)"
                        >
                          <div className="flex items-center gap-1 opacity-70 group-hover/btn:opacity-100 transition-opacity">
                            <Globe size={12} className="text-blue-500" />
                            <Facebook size={12} className="text-blue-600" />
                            <Linkedin size={12} className="text-sky-600" />
                            <Mail size={12} className="text-emerald-500" />
                          </div>
                          Gửi duyệt đa kênh
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* ═══ Suggestion Chips ═══════════════════════════ */}
            {showSuggestions && (() => {
              // Smart Quick Actions — Dynamic suggestions based on conversation context
              const lastContent = (lastMsg?.content || '').toLowerCase();
              const quickActions: { label: string; icon: string; action: string }[] = [];
              
              // Context-aware suggestions
              if (lastContent.includes('hợp đồng') || lastContent.includes('contract')) {
                quickActions.push(
                  { label: 'HĐ quá hạn?', icon: '⚠️', action: 'Cho tôi xem danh sách hợp đồng quá hạn' },
                  { label: 'Xem công nợ', icon: '💰', action: 'Báo cáo công nợ hiện tại' },
                );
              }
              if (lastContent.includes('doanh thu') || lastContent.includes('kpi') || lastContent.includes('revenue')) {
                quickActions.push(
                  { label: 'So sánh quý', icon: '📊', action: 'So sánh doanh thu Q1 và Q2 năm nay' },
                  { label: 'Dự báo doanh thu', icon: '📈', action: 'Dự báo doanh thu năm nay dựa trên pipeline' },
                );
              }
              if (lastContent.includes('task') || lastContent.includes('công việc') || lastContent.includes('giao việc')) {
                quickActions.push(
                  { label: 'Ai đang bận?', icon: '👥', action: 'Xem khối lượng công việc của nhân viên' },
                );
              }
              if (lastContent.includes('công nợ') || lastContent.includes('nợ')) {
                quickActions.push(
                  { label: 'Dòng tiền', icon: '💸', action: 'Tổng hợp dòng tiền thu chi năm nay' },
                );
              }
              // Default suggestions if no context match
              if (quickActions.length === 0) {
                quickActions.push(
                  { label: 'Bản tin sáng', icon: '🌅', action: 'Cho tôi xem bản tin sáng hôm nay' },
                  { label: 'Tổng quan KPI', icon: '📊', action: 'Cho tôi xem KPI tổng quan công ty' },
                  { label: 'HĐ quá hạn', icon: '⚠️', action: 'Có hợp đồng nào quá hạn không?' },
                  { label: 'Công nợ', icon: '💰', action: 'Báo cáo công nợ hiện tại' },
                  { label: 'Xếp hạng đơn vị', icon: '🏆', action: 'Xếp hạng đơn vị theo doanh thu' },
                );
              }
              // Always add a general action
              if (quickActions.length < 4) {
                quickActions.push(
                  { label: 'Xuất báo cáo', icon: '📋', action: 'Xuất báo cáo tổng hợp tình hình kinh doanh' },
                );
              }

              return (
                <div className="flex flex-wrap gap-2 justify-center pt-3 pb-1 px-4">
                  {quickActions.slice(0, 4).map((qa, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(qa.action)}
                      className="group px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-violet-50 dark:hover:from-indigo-900/20 dark:hover:to-violet-900/20
                    border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600
                    rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400
                    transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                    >
                      <span className="text-sm">{qa.icon}</span>
                      <span>{qa.label}</span>
                    </button>
                  ))}
                </div>
              );
            })()}

            <div ref={messagesEndRef} />
          </div>

          {/* ═══ Input Area ═══════════════════════════════════ */}
          <div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <div className="max-w-4xl mx-auto">
              {/* Model Selector — above input on mobile, inline on desktop */}
              <div className="flex items-center gap-2 mb-2">
                {['Admin', 'Leadership', 'Dev'].includes(_profile?.role || '') && (
                  <select
                    value={useHermesEngine ? 'hermes' : 'openclaw'}
                    onChange={(e) => setUseHermesEngine(e.target.value === 'hermes')}
                    className="bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 py-1.5 px-2 rounded-lg cursor-pointer focus:outline-none border border-transparent transition-all"
                    title="Chọn AI Engine"
                  >
                    <option value="openclaw">⚙️ OpenClaw (Ổn định)</option>
                    <option value="hermes">⚡ Hermes (Tốc độ cao)</option>
                  </select>
                )}

                {['Admin', 'Leadership', 'Dev'].includes(_profile?.role || '') ? (
                  <select
                    value={currentModel}
                    onChange={(e) => setCurrentModel(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[10px] font-bold text-slate-600 dark:text-slate-300 py-1.5 px-2 rounded-lg cursor-pointer focus:outline-none border border-transparent hover:border-indigo-200 dark:hover:border-indigo-700 transition-all"
                    title="Chọn Model AI"
                  >
                    <optgroup label="🖥️ Local AI (Bảo mật 100%)">
                      <option value="gemma-4-26b">💎 Gemma 4 26B (Siêu Trí Tuệ & Code)</option>
                      <option value="qwen2.5-vl-7b">👁️ Qwen-VL 7B (Đọc ảnh & Hoá đơn)</option>
                    </optgroup>
                    <optgroup label="🔑 Cloud AI (Hệ thống)">
                      <option value="gemini-2.0-flash">✨ Gemini 2.0 Flash (Tốc độ, Mặc định)</option>
                      <option value="gemini-1.5-pro">🧠 Gemini 1.5 Pro (Phân tích sâu)</option>
                    </optgroup>
                    <optgroup label="🔐 Cloud AI (Yêu cầu API Key)">
                      <option value="gpt-4o">🤖 GPT-4o (Xịn nhất chung)</option>
                      <option value="deepseek-chat">💬 DeepSeek Chat V3 (Giá rẻ)</option>
                      <option value="deepseek-r1">🤔 DeepSeek R1 (Suy luận đỉnh cao)</option>
                    </optgroup>
                  </select>
                ) : (
                  <div className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                    <Database size={12} />
                    <span>Qwen 2.5 7B (Bảo mật & Tốc độ)</span>
                  </div>
                )}
              </div>

              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium border border-indigo-100 dark:border-indigo-800/50">
                      <Paperclip size={12} />
                      <span className="max-w-[150px] truncate">{file.name}</span>
                      <button onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))} className="hover:text-rose-500 ml-1">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative flex items-center">
                {showMentionDropdown && mentionResults.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                      Đề xuất tag
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1">
                      {mentionResults.map((item, idx) => (
                        <button
                          key={`${item.type}-${item.id}`}
                          onClick={(e) => { e.preventDefault(); insertMention(item); }}
                          onMouseEnter={() => setMentionIndex(idx)}
                          className={cn(
                            "w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                            idx === mentionIndex ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          <span className="text-base leading-none pt-0.5">{item.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{item.label}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.sublabel}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  className="hidden"
                  accept=".txt,.csv,.md,.json,.docx,image/*"
                  onChange={(e) => {
                    if (e.target.files) {
                      setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }}
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer z-10"
                  title="Đính kèm tài liệu (.docx, .txt, .csv)"
                >
                  <Paperclip size={18} />
                </button>

                <textarea
                  ref={inputRef}
                  value={input}
                  onPaste={(e) => {
                    const items = e.clipboardData.items;
                    const filesToAttach: File[] = [];
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.indexOf('image') !== -1) {
                        const file = items[i].getAsFile();
                        if (file) filesToAttach.push(file);
                      }
                    }
                    if (filesToAttach.length > 0) {
                      setAttachedFiles(prev => [...prev, ...filesToAttach]);
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInput(val);
                    const cursor = e.target.selectionStart;
                    const textBeforeCursor = val.slice(0, cursor);
                    const match = textBeforeCursor.match(/@([a-zA-Z0-9_\-\sàáãạảăắằẳẵặâấầẩẫậèéẹẻẽêềếểễệđìíĩỉịòóõọỏôốồổỗộơớờởỡợùúũụủưứừửữựỳỵỷỹýÀÁÃẠẢĂẮẰẲẴẶÂẤẦẨẪẬÈÉẸẺẼÊỀẾỂỄỆĐÌÍĨỈỊÒÓÕỌỎÔỐỒỔỖỘƠỚỜỞỠỢÙÚŨỤỦƯỨỪỬỮỰỲỴỶỸÝ]*)$/);
                    if (match) {
                      const query = match[1];
                      setMentionStartPos(match.index !== undefined ? match.index : null);
                      setShowMentionDropdown(true);
                      handleSearchMention(query);
                    } else {
                      setShowMentionDropdown(false);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Hỏi AI hoặc đính kèm hợp đồng để phân tích..."
                  className="w-full pl-12 pr-14 py-4 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-indigo-500 dark:focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 rounded-[20px] resize-none max-h-40 min-h-[56px] shadow-sm text-sm font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                  rows={1}
                  disabled={isTyping}
                />

                <button
                  onClick={isTyping ? handleStop : () => handleSend()}
                  disabled={!isTyping && !input.trim() && attachedFiles.length === 0}
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                    isTyping
                      ? "bg-rose-500 text-white shadow-lg hover:bg-rose-600 hover:scale-105 active:scale-95"
                      : (input.trim() || attachedFiles.length > 0)
                        ? "bg-indigo-600 text-white shadow-lg hover:scale-105 active:scale-95"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                  )}
                  title={isTyping ? "Dừng" : "Gửi"}
                >
                  {isTyping ? <StopCircle size={20} /> : <Send size={20} />}
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
              AI có thể mắc lỗi. Vui lòng kiểm tra lại các thông tin quan trọng.
            </p>
          </div>
        </>
      )}

      {/* ═══ Settings Modal ════════════════════════════════ */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Settings size={20} className="text-indigo-500" />
                Cài đặt API cá nhân
              </h3>
              <button
                onClick={() => { setShowSettings(false); setSettingsTab('config'); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <button
                onClick={() => setSettingsTab('config')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-all cursor-pointer relative",
                  settingsTab === 'config'
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <KeyRound size={16} />
                API Keys
                {settingsTab === 'config' && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setSettingsTab('local')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-all cursor-pointer relative",
                  settingsTab === 'local'
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                🖥️ Local AI
                {settingsTab === 'local' && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setSettingsTab('guide')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold transition-all cursor-pointer relative",
                  settingsTab === 'guide'
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                <BookOpen size={16} />
                Hướng dẫn
                {settingsTab === 'guide' && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            </div>

            {/* Tab Content */}
            {settingsTab === 'config' ? (
              <>
                <div className="p-4 md:p-6 space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Sử dụng API Key cá nhân của bạn để bỏ qua giới hạn của hệ thống. Key được lưu trữ an toàn ngay trên trình duyệt của bạn (localStorage).
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Google Gemini API Key</label>
                      <input
                        type="password"
                        value={customGeminiKey}
                        onChange={(e) => setCustomGeminiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">OpenAI API Key (GPT-4o)</label>
                      <input
                        type="password"
                        value={customOpenAIKey}
                        onChange={(e) => setCustomOpenAIKey(e.target.value)}
                        placeholder="sk-proj-..."
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">DeepSeek API Key (R1/Chat)</label>
                      <input
                        type="password"
                        value={customDeepseekKey}
                        onChange={(e) => setCustomDeepseekKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 rounded-b-2xl">
                  <button
                    onClick={() => { setShowSettings(false); setSettingsTab('config'); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={saveSettings}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-md shadow-indigo-200 dark:shadow-none transition-all"
                  >
                    Lưu cài đặt
                  </button>
                </div>
              </>
            ) : settingsTab === 'local' ? (
              <>
                <div className="p-4 md:p-6 space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    Cấu hình kết nối Ollama (Local AI). Dữ liệu không rời khỏi máy bạn — bảo mật 100%.
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Ollama Base URL</label>
                    <input
                      type="text"
                      value={localAIBaseURL}
                      onChange={(e) => setLocalAIBaseURL(e.target.value)}
                      placeholder="http://localhost:11434/v1"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono"
                    />
                  </div>

                  <button
                    onClick={testLocalAI}
                    disabled={localAITesting}
                    className="w-full px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-sm font-bold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {localAITesting ? (
                      <><span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> Đang kiểm tra...</>
                    ) : (
                      <>🔍 Kiểm tra kết nối</>
                    )}
                  </button>

                  {localAITestResult && (
                    <div className={cn(
                      "rounded-xl p-4 border",
                      localAITestResult.ok
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                        : "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800"
                    )}>
                      {localAITestResult.ok ? (
                        <>
                          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-2">✅ Hệ thống Local AI (vLLM) sẵn sàng — {localAITestResult.models.length} models</p>
                          <div className="space-y-1">
                            {localAITestResult.models.map((m, i) => (
                              <p key={i} className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">• {m}</p>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">❌ Không kết nối được Ollama</p>
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">Kiểm tra: <code className="bg-rose-100 dark:bg-rose-900/30 px-1 rounded">ollama serve</code> đã chạy chưa?</p>
                        </>
                      )}
                    </div>
                  )}

                  <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3">
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">💡 vLLM Engine tự tải model. Tốc độ cao nhờ kiến trúc GPU Enterprise.</p>
                  </div>
                </div>

                <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 rounded-b-2xl">
                  <button
                    onClick={() => { setShowSettings(false); setSettingsTab('config'); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={saveSettings}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-md shadow-indigo-200 dark:shadow-none transition-all"
                  >
                    Lưu cài đặt
                  </button>
                </div>
              </>
            ) : settingsTab === 'guide' ? (
              <div className="p-4 md:p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Google Gemini Guide */}
                <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                  <h4 className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-black">G</span>
                    Google Gemini API Key
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">Miễn phí</span>
                  </h4>
                  <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-black mt-0.5">1</span>
                      <span>Truy cập <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-bold hover:underline inline-flex items-center gap-0.5">Google AI Studio <ExternalLink size={10} /></a></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-black mt-0.5">2</span>
                      <span>Đăng nhập bằng tài khoản Google của bạn</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-black mt-0.5">3</span>
                      <span>Nhấn nút <strong>"Create API Key"</strong> hoặc <strong>"Tạo API Key"</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-black mt-0.5">4</span>
                      <span>Chọn project hoặc tạo mới → Nhấn <strong>"Create API key in existing project"</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-black mt-0.5">5</span>
                      <span>Copy API Key (bắt đầu bằng <code className="bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-[10px] font-mono text-blue-700 dark:text-blue-300">AIzaSy...</code>) → Dán vào ô Gemini</span>
                    </li>
                  </ol>
                  <div className="mt-3 pt-3 border-t border-blue-200/50 dark:border-blue-900/30">
                    <p className="text-[10px] text-blue-500 dark:text-blue-400/70 font-medium">💡 Gói miễn phí: 15 request/phút, 1.500 request/ngày — đủ dùng cho cá nhân.</p>
                  </div>
                </div>

                {/* OpenAI Guide */}
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                  <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-xs">🤖</span>
                    OpenAI API Key (GPT-4o)
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase">Trả phí</span>
                  </h4>
                  <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black mt-0.5">1</span>
                      <span>Truy cập <a href="https://platform.openai.com/signup" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-0.5">OpenAI Platform <ExternalLink size={10} /></a> → Đăng ký hoặc đăng nhập</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black mt-0.5">2</span>
                      <span>Vào <a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-0.5">Settings → Billing <ExternalLink size={10} /></a> → Nạp tối thiểu $5</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black mt-0.5">3</span>
                      <span>Vào <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-0.5">API Keys <ExternalLink size={10} /></a> → Nhấn <strong>"Create new secret key"</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black mt-0.5">4</span>
                      <span>Đặt tên (VD: "CIC ERP") → Nhấn <strong>"Create secret key"</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black mt-0.5">5</span>
                      <span>Copy Key (bắt đầu bằng <code className="bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-700 dark:text-emerald-300">sk-proj-...</code>) → Dán vào ô OpenAI</span>
                    </li>
                  </ol>
                  <div className="mt-3 pt-3 border-t border-emerald-200/50 dark:border-emerald-900/30">
                    <p className="text-[10px] text-emerald-500 dark:text-emerald-400/70 font-medium">⚠️ Key chỉ hiện 1 lần duy nhất. Hãy copy và lưu lại ngay!</p>
                  </div>
                </div>

                {/* DeepSeek Guide */}
                <div className="rounded-xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 p-4">
                  <h4 className="text-sm font-bold text-violet-700 dark:text-violet-400 flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center text-xs">🤔</span>
                    DeepSeek API Key
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">Rẻ</span>
                  </h4>
                  <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center text-[10px] font-black mt-0.5">1</span>
                      <span>Truy cập <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 font-bold hover:underline inline-flex items-center gap-0.5">DeepSeek Platform <ExternalLink size={10} /></a> → Đăng ký / đăng nhập</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center text-[10px] font-black mt-0.5">2</span>
                      <span>Vào <a href="https://platform.deepseek.com/top_up" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 font-bold hover:underline inline-flex items-center gap-0.5">Top Up <ExternalLink size={10} /></a> → Nạp tiền (tối thiểu ~$2)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center text-[10px] font-black mt-0.5">3</span>
                      <span>Vào <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 font-bold hover:underline inline-flex items-center gap-0.5">API Keys <ExternalLink size={10} /></a> → Nhấn <strong>"Create new API key"</strong></span>
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 flex items-center justify-center text-[10px] font-black mt-0.5">4</span>
                      <span>Copy Key (bắt đầu bằng <code className="bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded text-[10px] font-mono text-violet-700 dark:text-violet-300">sk-...</code>) → Dán vào ô DeepSeek</span>
                    </li>
                  </ol>
                  <div className="mt-3 pt-3 border-t border-violet-200/50 dark:border-violet-900/30">
                    <p className="text-[10px] text-violet-500 dark:text-violet-400/70 font-medium">💡 DeepSeek R1 rất rẻ (~$0.55/1M token input) — phù hợp cho phân tích chuyên sâu.</p>
                  </div>
                </div>

                {/* Tips Section */}
                <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4">
                  <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                    💡 Mẹo bảo mật
                  </h4>
                  <ul className="space-y-1.5 text-[11px] text-amber-700/80 dark:text-amber-400/70 font-medium">
                    <li className="flex gap-1.5">• API Key chỉ lưu trên trình duyệt của bạn, <strong>không gửi lên server</strong></li>
                    <li className="flex gap-1.5">• Không bao giờ chia sẻ API Key cho người khác</li>
                    <li className="flex gap-1.5">• Nên đặt giới hạn chi tiêu (spending limit) trên mỗi platform</li>
                    <li className="flex gap-1.5">• Nếu nghi ngờ Key bị lộ, hãy <strong>xóa và tạo Key mới</strong> ngay</li>
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
