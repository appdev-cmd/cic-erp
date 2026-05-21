import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Bot, Loader2, Square, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../contexts/AuthContext';
import { useEffectiveProfile } from '../contexts/ImpersonationContext';
import { agentDefinitions } from '../services/ai/openclaw/agents/definitions';
import { AgentConfigService } from '../services/ai/agentConfigService';
import { aiPermissionService } from '../services/aiPermissionService';
import type { UserContext, DepartmentAgent } from '../services/ai/openclaw/types';
import { cn } from '../lib/utils';

interface UnitAgentChatProps {
  isOpen: boolean;
  onClose: () => void;
  unitCode: string;
  unitName: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  isStreaming?: boolean;
  timestamp: Date;
}

const MARKDOWN_COMPONENTS: any = {
  table: ({ node, ...props }: any) => <div className="overflow-x-auto my-3"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" {...props} /></div>,
  th: ({ node, ...props }: any) => <th className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400" {...props} />,
  td: ({ node, ...props }: any) => <td className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-700 text-sm" {...props} />,
  a: ({ node, ...props }: any) => <a className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold" target="_blank" rel="noopener noreferrer" {...props} />,
};

const UnitAgentChat: React.FC<UnitAgentChatProps> = ({ isOpen, onClose, unitCode, unitName }) => {
  const { profile } = useEffectiveProfile();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [agent, setAgent] = useState<DepartmentAgent | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load agent cho đơn vị này
  useEffect(() => {
    AgentConfigService.getActive().then(dbAgents => {
      const code = unitCode.toUpperCase();
      const unitAgents = dbAgents.filter(a => a.departmentId === code);
      const bgdAgents = dbAgents.filter(a => a.id === 'agent-bgd' || a.departmentId === 'BGD');
      const def = (unitAgents.length > 0 ? unitAgents[0] : bgdAgents[0]) || agentDefinitions['BGD'];
      setAgent(def);

      // Welcome message
      setMessages([{
        id: 'welcome',
        role: 'model',
        content: `🤖 Xin chào! Tôi là **${def.name}**.\n\n${def.description}\n\nBạn muốn tôi giúp gì về **${unitName}**?`,
        timestamp: new Date(),
      }]);
    }).catch(() => {
      const code = unitCode.toUpperCase();
      const def = agentDefinitions[code] || agentDefinitions['BGD'];
      setAgent(def);

      setMessages([{
        id: 'welcome',
        role: 'model',
        content: `🤖 Xin chào! Tôi là **${def.name}**.\n\n${def.description}\n\nBạn muốn tôi giúp gì về **${unitName}**?`,
        timestamp: new Date(),
      }]);
    });
  }, [unitCode, unitName]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input khi mở
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping || !agent) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const botMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: botMsgId,
      role: 'model',
      content: '',
      isStreaming: true,
      timestamp: new Date(),
    }]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { runReActLoop } = await import('../services/ai/openclaw/react-loop');
      const { erpToolsRegistry } = await import('../services/ai/openclaw/tools/registry');
      const { AgentToolConfigService } = await import('../services/ai/agentToolConfigService');

      const userContext: UserContext = {
        userId: profile?.id || 'web',
        employeeId: profile?.employeeId,
        fullName: profile?.fullName || 'Người dùng',
        role: profile?.role || 'NVKD',
        unitId: profile?.unitId,
        unitCode: profile?.unitCode,
        email: profile?.email,
      };

      const history = messages
        .filter(m => m.id !== 'welcome' && m.id !== botMsgId)
        .map(m => ({ role: m.role as 'user' | 'model', content: m.content }));

      let toolContent = '';
      let streamContent = '';

      const mergedTools = await AgentToolConfigService.getMergedTools(erpToolsRegistry);

      // SECURITY (C4): Only allow tools that the agent config permits
      const filteredTools = agent.allowedTools?.length
          ? mergedTools.filter(t => agent.allowedTools!.includes(t.name))
          : mergedTools;

      // SECURITY (C12): Check AI permission before running agent loop
      const permission = await aiPermissionService.getMyPermission();
      if (permission && !permission.can_use_system_api) {
          setMessages(prev => prev.map(m =>
              m.id === botMsgId ? { ...m, content: '⚠️ Bạn chưa được cấp quyền sử dụng AI Agent. Vui lòng liên hệ Admin.', isStreaming: false } : m
          ));
          setIsTyping(false);
          return;
      }

      const result = await runReActLoop(
        text,
        userContext,
        agent,
        filteredTools,
        history,
        8,
        controller.signal,
        (toolName, args) => {
          toolContent += `\n\n> 🔍 *Truy xuất dữ liệu từ \`${toolName}\`...*\n`;
          setMessages(prev => prev.map(m =>
            m.id === botMsgId ? { ...m, content: toolContent } : m
          ));
        },
        undefined, // use agent's preferredModel
        (chunk) => {
          streamContent += chunk;
          setMessages(prev => prev.map(m =>
            m.id === botMsgId ? { ...m, content: toolContent + streamContent } : m
          ));
        }
      );

      const finalContent = streamContent
        ? toolContent + streamContent
        : toolContent + result.reply;

      setMessages(prev => prev.map(m =>
        m.id === botMsgId ? { ...m, content: finalContent, isStreaming: false } : m
      ));

      // Track usage (fire-and-forget)
      AgentConfigService.trackUsage(agent.id).catch(() => {});

    } catch (error: any) {
      console.error('[UnitAgentChat] Error:', error);
      setMessages(prev => prev.map(m =>
        m.id === botMsgId
          ? { ...m, content: '\n\n⚠️ Đã xảy ra lỗi kết nối. Vui lòng thử lại.', isStreaming: false }
          : m
      ));
    } finally {
      setIsTyping(false);
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsTyping(false);
    setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* SlidePanel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-slate-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg",
              agent?.color || 'bg-indigo-600'
            )}>
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-base">
                {agent?.name || 'Trợ lý AI'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {unitName} • {agent?.isActive ? '🟢 Online' : '🔴 Offline'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={cn("flex gap-3", msg.role === 'user' ? 'justify-end' : '')}>
              {msg.role === 'model' && (
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 mt-1",
                  agent?.color || 'bg-indigo-600'
                )}>
                  <Sparkles size={14} />
                </div>
              )}
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                msg.role === 'user'
                  ? "bg-indigo-600 text-white ml-auto rounded-br-md"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md"
              )}>
                {msg.role === 'model' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2">
                    <ReactMarkdown components={MARKDOWN_COMPONENTS}>
                      {msg.content || (msg.isStreaming ? '...' : '')}
                    </ReactMarkdown>
                    {msg.isStreaming && (
                      <span className="inline-block w-2 h-4 bg-indigo-500 animate-pulse ml-0.5" />
                    )}
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Hỏi trợ lý ${unitName}...`}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 max-h-[120px] overflow-y-auto"
              style={{ minHeight: '42px' }}
            />
            {isTyping ? (
              <button
                onClick={handleStop}
                className="p-2.5 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-colors shrink-0"
                title="Dừng"
              >
                <Square size={18} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                title="Gửi"
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UnitAgentChat;
