
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
  Paperclip
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamEnterpriseAI } from '../services/ai';
import { getBusinessContext, invalidateBusinessContext } from '../services/contextService';
import { searchKnowledgeBase } from '../services/ragService';
import { parseDocumentClientSide } from '../lib/documentReaderClient';
import { useAuth } from '../contexts/AuthContext';
import { routeUserToAgent } from '../services/ai/openclaw/router';
import type { UserContext } from '../services/ai/openclaw/types';
import { cn } from '../lib/utils';
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

  const { type, data, xAxisKey, lines } = chartConfig.config;

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
            <XAxis dataKey={xAxisKey} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickFormatter={formatValue} tickLine={false} axisLine={false} />
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
            <XAxis dataKey={xAxisKey} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickFormatter={formatValue} tickLine={false} axisLine={false} />
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
    <div className="w-full h-80 my-4 p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl shadow-sm overflow-hidden flex flex-col justify-center">
      <ResponsiveContainer width="99%" height={280}>
        {renderChart()}
      </ResponsiveContainer>
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

type AgentType = 'general' | 'legal' | 'drafter' | 'analyst';
type ActiveView = 'chat' | 'ingest';

const AGENTS: Record<AgentType, { name: string; role: string; color: string; icon: any; prompt: string; suggestions: string[] }> = {
  general: {
    name: 'Tổng quát',
    role: 'Trợ lý ảo Enterprise',
    color: 'bg-indigo-600',
    icon: Sparkles,
    prompt: 'Bạn là Trợ lý AI Enterprise của CIC. Trả lời ngắn gọn, chuyên nghiệp. QUY TẮC QUAN TRỌNG: Khi user hỏi "doanh thu năm X", "quý X", "tháng X" → PHẢI tìm dữ liệu đúng khoảng thời gian đó từ Báo cáo Quản trị. KHÔNG BAO GIỜ trả lời bằng tổng tất cả thời gian khi user chỉ định thời gian cụ thể.',
    suggestions: [
      'Tổng doanh thu công ty năm nay bao nhiêu?',
      'Phòng ban nào doanh thu cao nhất năm nay?',
      'Ai là nhân sự xuất sắc nhất năm nay?',
      'Tóm tắt tình hình hợp đồng tháng này'
    ]
  },
  legal: {
    name: 'Pháp chế & Rủi ro',
    role: 'Chuyên gia Pháp lý',
    color: 'bg-rose-600',
    icon: Scale,
    prompt: 'Bạn là Chuyên gia Pháp chế cao cấp. Nhiệm vụ: Rà soát hợp đồng, cảnh báo rủi ro pháp lý, trích dẫn Luật Đấu thầu/Xây dựng/Dân sự Việt Nam. Phong cách: Nghiêm túc, chính xác, cảnh báo rõ ràng.',
    suggestions: [
      'Những điều khoản bắt buộc trong hợp đồng xây dựng?',
      'Rủi ro pháp lý khi ký phụ lục hợp đồng?',
      'Quy định bảo lãnh thực hiện hợp đồng theo luật Đấu thầu?',
      'Checklist kiểm tra hợp đồng trước khi ký'
    ]
  },
  drafter: {
    name: 'Soạn thảo',
    role: 'Thư ký Điều hành',
    color: 'bg-emerald-600',
    icon: PenTool,
    prompt: 'Bạn là Thư ký Điều hành chuyên nghiệp. Nhiệm vụ: Soạn thảo email, công văn, tờ trình, phụ lục hợp đồng. Output: Format chuẩn văn bản hành chính, ngôn từ trang trọng, lịch sự.',
    suggestions: [
      'Soạn email thông báo gia hạn hợp đồng',
      'Viết tờ trình đề xuất duyệt hợp đồng mới',
      'Soạn công văn đề nghị thanh toán',
      'Viết biên bản nghiệm thu công trình'
    ]
  },
  analyst: {
    name: 'Phân tích số liệu',
    role: 'Chuyên gia Dữ liệu',
    color: 'bg-amber-600',
    icon: BarChart3,
    prompt: `Bạn là Chuyên gia Phân tích Dữ liệu. QUY TẮC BẮT BUỘC: 
(0) LUÔN LUÔN giao tiếp, nhận định và giải thích bằng TIẾNG VIỆT (Tuyệt đối không dùng tiếng Trung/Anh).
(1) Khi user đề cập năm/quý/tháng cụ thể → PHẢI dùng dữ liệu đúng thời kỳ đó từ Báo cáo; 
(2) Trả lời ngắn ngọn, đưa ra nhận định (Insights) dựa trên data; 
(3) ĐỂ VẼ BIỂU ĐỒ, hãy trả về CHỈ 1 block JSON trong cặp backticks với language là "chart", ví dụ:
\`\`\`chart
{
  "type": "bar",
  "data": [{"name": "STC", "revenue": 1000}],
  "xAxisKey": "name",
  "lines": [{"dataKey": "revenue", "color": "#4f46e5", "name": "Doanh thu"}]
}
\`\`\`
Hỗ trợ type: "bar", "line", "pie".`,
    suggestions: [
      'So sánh doanh thu các đơn vị bằng biểu đồ',
      'Vẽ biểu đồ doanh thu năm 2026',
      'Đơn vị nào đạt doanh thu cao nhất năm nay?',
      'Top 5 nhân sự xuất sắc nhất năm 2026'
    ]
  }
};

// ─── LocalStorage Helpers ────────────────────────────────
const STORAGE_KEY = 'cic_ai_chat_history';
const MODEL_STORAGE_KEY = 'cic_ai_model';
const AGENT_STORAGE_KEY = 'cic_ai_agent';

export const CUSTOM_GEMINI_KEY = 'cic_custom_gemini_key';
export const CUSTOM_OPENAI_KEY = 'cic_custom_openai_key';
export const CUSTOM_DEEPSEEK_KEY = 'cic_custom_deepseek_key';

const saveMessages = (messages: Message[]) => {
  try {
    // Only save last 50 messages to avoid localStorage bloat
    const toSave = messages.slice(-50).map(m => ({
      ...m,
      isStreaming: false,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* localStorage full or unavailable */ }
};

const loadMessages = (): Message[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
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
  a: ({ node, ...props }: any) => <a className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold" target="_blank" rel="noopener noreferrer" {...props} />
};

const AIAssistant: React.FC = () => {
  const { profile: _profile } = useAuth();
  const [currentAgent, setCurrentAgent] = useState<AgentType>(() => {
    return (localStorage.getItem(AGENT_STORAGE_KEY) as AgentType) || 'general';
  });
  const [currentModel, setCurrentModel] = useState<string>(() => {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    // Auto-reset stale model nếu model cũ không còn trên vLLM
    const staleModels = ['Qwen3.5', 'gemma-3-9b', 'gemma-2-9b', 'Qwen2.5-7B', 'qwen2.5-7b'];
    if (saved && staleModels.some(s => saved.includes(s))) {
      localStorage.removeItem(MODEL_STORAGE_KEY);
      return 'cic-legal-14b';
    }
    return saved || 'cic-legal-14b';
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = loadMessages();
    return saved.length > 0 ? saved : [WELCOME_MESSAGE];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('chat');
  
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'config' | 'guide' | 'local'>('config');
  const [customGeminiKey, setCustomGeminiKey] = useState(() => localStorage.getItem(CUSTOM_GEMINI_KEY) || '');
  const [customOpenAIKey, setCustomOpenAIKey] = useState(() => localStorage.getItem(CUSTOM_OPENAI_KEY) || '');
  const [customDeepseekKey, setCustomDeepseekKey] = useState(() => localStorage.getItem(CUSTOM_DEEPSEEK_KEY) || '');
  const [localAIBaseURL, setLocalAIBaseURL] = useState(() => localStorage.getItem('cic_local_ai_base_url') || 'http://localhost:11434/v1');
  const [localAITestResult, setLocalAITestResult] = useState<{ok: boolean; models: string[]} | null>(null);
  const [localAITesting, setLocalAITesting] = useState(false);
  const [widgetHistoryBanner, setWidgetHistoryBanner] = useState(false);

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

  // ─── Persist messages ───────────────────────────────────
  useEffect(() => {
    if (!isTyping) saveMessages(messages);
  }, [messages, isTyping]);

  // ─── Persist model/agent selection ──────────────────────
  useEffect(() => { localStorage.setItem(MODEL_STORAGE_KEY, currentModel); }, [currentModel]);
  useEffect(() => { localStorage.setItem(AGENT_STORAGE_KEY, currentAgent); }, [currentAgent]);

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
          const parsed = await parseDocumentClientSide(file);
          fileContents += `\n\n--- Trích xuất từ file: ${file.name} ---\n${parsed}\n--- Kết thúc file ---`;
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

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
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

    const activeAgent = AGENTS[currentAgent] || Object.values(AGENTS)[0];

    try {
      // Lazy load to prevent circular logic if any
      const { runReActLoop } = await import('../services/ai/openclaw/react-loop');
      const { agentDefinitions } = await import('../services/ai/openclaw/agents/definitions');
      const { erpToolsRegistry } = await import('../services/ai/openclaw/tools/registry');

      // Lấy user context thật từ AuthContext
      const _userContext: UserContext = {
        userId: _profile?.id || 'web',
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
      const autoAgent = routeUserToAgent(_userContext);
      let agentConf = autoAgent;
      // Map 4 agent UI cũ sang agent definitions mới  
      if (currentAgent === 'legal') agentConf = agentDefinitions['BGD'] || autoAgent;
      if (currentAgent === 'drafter') agentConf = agentDefinitions['HCNS'] || autoAgent;
      if (currentAgent === 'analyst') agentConf = agentDefinitions['TCKT'] || autoAgent;

      // Extract existing history for LLM
      const history = messages.filter(m => m.id !== 'welcome' && m.id !== botMsgId).map(m => ({
        role: m.role as 'user'|'model',
        content: m.content
      }));

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
          // Callback: tool đang được gọi → hiện indicator
          toolContent += `\n\n> 🔍 *Hệ thống đang truy xuất dữ liệu từ công cụ \`${toolName}\`...*\n> \`\`\`json\n> ${JSON.stringify(args)}\n> \`\`\`\n\n`;
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

      // Khi xong hoàn toàn
      const finalContent = streamContent
        ? toolContent + streamContent  // Đã stream rồi
        : toolContent + result.reply;  // Fallback nếu không stream
      setMessages(prev => prev.map(m =>
        m.id === botMsgId
          ? { ...m, content: finalContent, isStreaming: false }
          : m
      ));

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    if (window.confirm('Xóa toàn bộ lịch sử chat?')) {
      setMessages([WELCOME_MESSAGE]);
      localStorage.removeItem(STORAGE_KEY);
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

  const switchAgent = (key: AgentType) => {
    setCurrentAgent(key);
    setShowAgentMenu(false);
    const agent = AGENTS[key];
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
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-10 relative">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none",
            AGENTS[currentAgent].color
          )}>
            {React.createElement(AGENTS[currentAgent].icon, { size: 20 })}
          </div>
          <div>
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
              Trợ lý AI Enterprise
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider">v4.0</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <span className={cn("w-2 h-2 rounded-full", AGENTS[currentAgent].color)}></span>
              {AGENTS[currentAgent].name} • {AGENTS[currentAgent].role}
            </p>
          </div>
        </div>

        {/* Agent Selector - Desktop: inline tabs */}
        <div className="hidden md:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {(Object.entries(AGENTS) as [AgentType, typeof AGENTS[AgentType]][]).map(([key, agent]) => {
            const Icon = agent.icon;
            const isActive = activeView === 'chat' && currentAgent === key;
            return (
              <button
                key={key}
                onClick={() => { switchAgent(key); setActiveView('chat'); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all cursor-pointer",
                  isActive
                    ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                )}
                title={agent.role}
              >
                <Icon size={14} className={isActive ? agent.color.replace('bg-', 'text-') : ''} />
                {agent.name}
              </button>
            );
          })}
          {/* Nạp dữ liệu tab */}
          <button
            onClick={() => setActiveView('ingest')}
            className={cn(
              "px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all cursor-pointer",
              activeView === 'ingest'
                ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
            )}
            title="Nạp dữ liệu bằng AI"
          >
            <Database size={14} className={activeView === 'ingest' ? 'text-violet-500' : ''} />
            Nạp dữ liệu
          </button>
        </div>

        {/* Agent Selector - Mobile: dropdown */}
        <div className="flex md:hidden relative" ref={agentMenuRef}>
          <button
            onClick={() => setShowAgentMenu(!showAgentMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            {React.createElement(AGENTS[currentAgent].icon, { size: 14 })}
            {AGENTS[currentAgent].name}
            <ChevronDown size={12} className={cn("transition-transform", showAgentMenu && "rotate-180")} />
          </button>
          {showAgentMenu && (
            <div className="absolute top-full right-0 mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
              {(Object.entries(AGENTS) as [AgentType, typeof AGENTS[AgentType]][]).map(([key, agent]) => {
                const Icon = agent.icon;
                const isActive = currentAgent === key;
                return (
                  <button
                    key={key}
                    onClick={() => switchAgent(key)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer",
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 font-bold"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    )}
                  >
                    <Icon size={16} className={agent.color.replace('bg-', 'text-')} />
                    <div className="text-left">
                      <div className="font-semibold">{agent.name}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">{agent.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all cursor-pointer"
            title="Cài đặt API Key"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={clearChat}
            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all cursor-pointer"
            title="Xóa lịch sử"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all cursor-pointer"
            title={isFullScreen ? "Thu nhỏ" : "Toàn màn hình"}
          >
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

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
                    : cn("border-transparent text-white shadow-md shadow-indigo-200 dark:shadow-none", AGENTS[currentAgent].color)
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
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* ═══ Suggestion Chips ═══════════════════════════ */}
            {showSuggestions && (
              <div className="flex flex-wrap gap-2 justify-center pt-2 pb-1">
                {AGENTS[currentAgent].suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(sug)}
                    className="px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 
                  border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700
                  rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400
                  transition-all cursor-pointer flex items-center gap-1.5 shadow-sm hover:shadow"
                  >
                    <Zap size={10} className="text-indigo-400" />
                    {sug}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ═══ Input Area ═══════════════════════════════════ */}
          <div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <div className="max-w-4xl mx-auto">
              {/* Model Selector — above input on mobile, inline on desktop */}
              <div className="flex items-center gap-2 mb-2">
                <select
                  value={currentModel}
                  onChange={(e) => setCurrentModel(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[10px] font-bold text-slate-600 dark:text-slate-300 py-1.5 px-2 rounded-lg cursor-pointer focus:outline-none border border-transparent hover:border-indigo-200 dark:hover:border-indigo-700 transition-all"
                  title="Chọn Model AI"
                >
                  <optgroup label="🖥️ Local AI (Bảo mật 100%)">
                    {localAITestResult?.ok && localAITestResult.models.length > 0 ? (
                      localAITestResult.models.map(m => (
                        <option key={m} value={m}>🦖 {m} (Local)</option>
                      ))
                    ) : (
                      <>
                        <option value="qwen2.5-7b">🦖 Qwen 2.5 7B (Local)</option>
                        <option value="qwen2.5-14b">🦖 Qwen 2.5 14B (Local)</option>
                      </>
                    )}
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
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  className="hidden"
                  accept=".txt,.csv,.md,.json,.docx"
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
                  onChange={(e) => setInput(e.target.value)}
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
