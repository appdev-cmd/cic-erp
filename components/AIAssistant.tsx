
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Zap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamEnterpriseAI } from '../services/aiService';
import { getBusinessContext } from '../services/contextService';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isStreaming?: boolean;
  timestamp: Date;
}

type AgentType = 'general' | 'legal' | 'drafter' | 'analyst';

const AGENTS: Record<AgentType, { name: string; role: string; color: string; icon: any; prompt: string; suggestions: string[] }> = {
  general: {
    name: 'Tổng quát',
    role: 'Trợ lý ảo Enterprise',
    color: 'bg-indigo-600',
    icon: Sparkles,
    prompt: 'Bạn là Trợ lý AI Enterprise. Trả lời ngắn gọn, chuyên nghiệp, hỗ trợ mọi tác vụ quản trị.',
    suggestions: [
      'Tổng doanh thu công ty hiện tại bao nhiêu?',
      'Phòng ban nào doanh thu cao nhất?',
      'Ai là nhân viên xuất sắc nhất?',
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
    prompt: 'Bạn là Chuyên gia Phân tích Dữ liệu. Nhiệm vụ: Phân tích xu hướng tài chính, KPI, dòng tiền. Format: Dùng bảng (Table) để so sánh số liệu, đưa ra nhận định (Insights) dựa trên data.',
    suggestions: [
      'So sánh doanh thu các đơn vị bằng bảng',
      'Phân tích xu hướng dòng tiền 3 tháng gần nhất',
      'Top 5 khách hàng có giá trị hợp đồng lớn nhất',
      'KPI nào đang dưới mức mục tiêu?'
    ]
  }
};

// ─── LocalStorage Helpers ────────────────────────────────
const STORAGE_KEY = 'cic_ai_chat_history';
const MODEL_STORAGE_KEY = 'cic_ai_model';
const AGENT_STORAGE_KEY = 'cic_ai_agent';

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

const AIAssistant: React.FC = () => {
  const [currentAgent, setCurrentAgent] = useState<AgentType>(() => {
    return (localStorage.getItem(AGENT_STORAGE_KEY) as AgentType) || 'general';
  });
  const [currentModel, setCurrentModel] = useState<string>(() => {
    return localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-2.0-flash';
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

  // ─── Pre-fetch business context ────────────────────────
  const [systemContext, setSystemContext] = useState<string>('');
  useEffect(() => {
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
    const messageText = overrideInput || input.trim();
    if (!messageText || isTyping) return;

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

    // Create AbortController for this stream
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let fullContent = '';

    try {
      const history = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      let finalPrompt = AGENTS[currentAgent].prompt;
      if (['general', 'analyst', 'legal'].includes(currentAgent)) {
        finalPrompt = `${systemContext}\n\n${finalPrompt}`;
      }

      const stream = streamEnterpriseAI(history, userMsg.content, currentModel, finalPrompt, controller.signal);

      for await (const chunk of stream) {
        if (controller.signal.aborted) break;
        fullContent += chunk;
        setMessages(prev => prev.map(m =>
          m.id === botMsgId
            ? { ...m, content: fullContent }
            : m
        ));
      }

      setMessages(prev => prev.map(m =>
        m.id === botMsgId
          ? { ...m, isStreaming: false }
          : m
      ));

    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error("Chat Error", error);
        setMessages(prev => prev.map(m =>
          m.id === botMsgId
            ? { ...m, content: fullContent + "\n\n⚠️ Đã xảy ra lỗi kết nối.", isStreaming: false }
            : m
        ));
      }
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
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
      isFullScreen ? "fixed inset-0 z-50 rounded-none m-0" : "rounded-[24px] h-[92vh] w-full max-w-7xl mx-auto my-2 relative"
    )}>
      {/* ═══ Header ═══════════════════════════════════════ */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
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
            const isActive = currentAgent === key;
            return (
              <button
                key={key}
                onClick={() => switchAgent(key)}
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
                        components={{
                          table: ({ node, ...props }) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg" {...props} /></div>,
                          th: ({ node, ...props }) => <th className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400" {...props} />,
                          td: ({ node, ...props }) => <td className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-sm" {...props} />,
                          ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1" {...props} />,
                          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
                          code: ({ node, ...props }) => <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono text-rose-500 dark:text-rose-400" {...props} />,
                          a: ({ node, ...props }) => <a className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold" target="_blank" rel="noopener noreferrer" {...props} />
                        }}
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
      < div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800" >
        <div className="relative max-w-4xl mx-auto">
          {/* Model Selector */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
            <select
              value={currentModel}
              onChange={(e) => setCurrentModel(e.target.value)}
              className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[10px] font-bold text-slate-600 dark:text-slate-300 py-1.5 px-2 rounded-lg cursor-pointer focus:outline-none border border-transparent hover:border-indigo-200 dark:hover:border-indigo-700 transition-all max-w-[120px]"
              title="Chọn Model AI"
            >
              <option value="gemini-2.0-flash">✨ Gemini 2.0 Flash</option>
              <option value="gemini-1.5-flash">⚡ Gemini 1.5 Flash</option>
              <option value="gemini-1.5-pro">🧠 Gemini 1.5 Pro</option>
              <option value="gpt-4o">🤖 GPT-4o</option>
              <option value="deepseek-r1">🤔 DeepSeek R1</option>
            </select>
          </div>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập câu hỏi của bạn (Shift+Enter để xuống dòng)..."
            className="w-full pl-[135px] pr-14 py-4 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-indigo-500 dark:focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 rounded-[20px] resize-none max-h-40 min-h-[56px] shadow-sm text-sm font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
            rows={1}
            disabled={isTyping}
          />

          <button
            onClick={isTyping ? handleStop : () => handleSend()}
            disabled={!isTyping && !input.trim()}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer",
              isTyping
                ? "bg-rose-500 text-white shadow-lg hover:bg-rose-600 hover:scale-105 active:scale-95"
                : input.trim()
                  ? "bg-indigo-600 text-white shadow-lg hover:scale-105 active:scale-95"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
            )}
            title={isTyping ? "Dừng" : "Gửi"}
          >
            {isTyping ? <StopCircle size={20} /> : <Send size={20} />}
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
          AI có thể mắc lỗi. Vui lòng kiểm tra lại các thông tin quan trọng.
        </p>
      </div>
    </div>
  );
};

export default AIAssistant;
