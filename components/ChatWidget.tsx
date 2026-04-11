import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Maximize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamChat } from '../services/ai';
import { searchKnowledgeBase } from '../services/ragService';
import { getBusinessContext } from '../services/contextService';

interface ChatWidgetProps {
    contextData?: any; // Data to be passed to AI for context
}

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
}

// ─── System Prompt chuyên sâu (lấy cảm hứng từ OpenClaw naturalChat.ts) ───
const SYSTEM_PROMPT_TEMPLATE = `Bạn là "CIC AI" — Trợ lý thông minh nội bộ của Công ty CIC, chạy hoàn toàn trên máy chủ local (bảo mật 100%).

## Nguyên tắc trả lời:
1. Luôn trả lời bằng **Tiếng Việt**, giọng chuyên nghiệp nhưng thân thiện
2. Format bằng **Markdown**: dùng bảng, danh sách, **bold** cho số liệu quan trọng
3. Khi trả lời về số liệu: DỰA VÀO "Báo cáo Quản trị" bên dưới. TUYỆT ĐỐI KHÔNG bịa đặt
4. Khi được hỏi về quy trình/hướng dẫn: ưu tiên "Tài liệu Trích dẫn (RAG)" nếu có
5. Nếu không có dữ liệu: nói rõ "Tôi chưa có thông tin này trong hệ thống"
6. Thêm emoji phù hợp để tăng trải nghiệm đọc 📊💰📋

## QUY TẮC XỬ LÝ THỜI GIAN (BẮT BUỘC):
- Khi user hỏi "doanh thu năm X" → tìm mục "Năm X" trong Báo cáo, KHÔNG dùng tổng tất cả thời gian
- Khi user hỏi "quý X" hoặc "Q1/Q2/Q3/Q4" → tìm mục "Quý X" trong Báo cáo
- Khi user hỏi "tháng X" → tìm mục "Tháng X" trong Báo cáo
- Chỉ khi user hỏi "tổng" / "toàn bộ" / "tất cả" mà KHÔNG kèm thời gian → mới dùng "Tổng quan tất cả thời gian"
- Q1=T1-3, Q2=T4-6, Q3=T7-9, Q4=T10-12

## Bạn KHÔNG ĐƯỢC:
- Bịa đặt số liệu tài chính
- Trộn lẫn dữ liệu các năm khi user hỏi 1 năm cụ thể
- Tiết lộ thông tin cá nhân nhân viên
- Đưa lời khuyên pháp lý cụ thể (khuyên tham vấn luật sư)

## Bạn CÓ THỂ:
- Tổng hợp và phân tích dữ liệu từ Báo cáo Quản trị
- So sánh, đánh giá hiệu suất giữa các đơn vị/nhân sự
- Gợi ý hành động dựa trên dữ liệu (follow-up thanh toán, cảnh báo trễ hạn)
- Hỗ trợ soạn thảo email, công văn, tờ trình mẫu`;

const ChatWidget: React.FC<ChatWidgetProps> = ({ contextData }) => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: 'welcome', text: 'Xin chào! 👋 Tôi là **CIC AI** — trợ lý thông minh nội bộ, chạy 100% trên máy chủ local.\n\nBạn có thể hỏi tôi về:\n- 📊 Doanh thu, hợp đồng, công nợ\n- 👥 Hiệu suất đơn vị, nhân sự\n- 📋 Quy trình, hướng dẫn sử dụng ERP\n\nHoặc nhấn **⤢** để vào chế độ phân tích chuyên sâu!', sender: 'ai', timestamp: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [businessContext, setBusinessContext] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load business context khi mount
    useEffect(() => {
        getBusinessContext().then(ctx => setBusinessContext(ctx)).catch(() => {});
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    // ─── Expand: Phóng lớn sang AI Agent ───────────────────
    const handleExpand = () => {
        // Lưu lịch sử chat (bỏ welcome message) vào localStorage
        const chatHistory = messages.filter(m => m.id !== 'welcome').map(m => ({
            role: m.sender === 'user' ? 'user' : 'model',
            content: m.text,
            timestamp: m.timestamp.toISOString(),
        }));
        if (chatHistory.length > 0) {
            localStorage.setItem('cic_widget_chat_history', JSON.stringify(chatHistory));
        }
        setIsOpen(false);
        navigate('/ai-assistant');
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: input,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        setIsSearching(true);

        try {
            // Bước 1: Gọi RAG để lấy tài liệu nội suy (Knowledge Base)
            const ragContext = await searchKnowledgeBase(input, 3);
            setIsSearching(false);

            // Bước 2: Xây dựng System Instruction kết hợp Context + RAG
            const contextBlock = businessContext 
                ? `\n\n═══ BÁO CÁO QUẢN TRỊ THỜI GIAN THỰC ═══\n${businessContext}`
                : '';
            
            const pageContext = contextData 
                ? `\n\n═══ DỮ LIỆU TRANG HIỆN TẠI ═══\n${JSON.stringify(contextData)}`
                : '';

            const ragBlock = ragContext 
                ? `\n\n═══ TÀI LIỆU TRÍCH DẪN (Knowledge Base) ═══\n${ragContext}\n\nHãy ưu tiên sử dụng Tài liệu Trích dẫn để trả lời nếu phù hợp.`
                : '';

            const systemInst = SYSTEM_PROMPT_TEMPLATE + contextBlock + pageContext + ragBlock;

            const aiMsgId = (Date.now() + 1).toString();
            // Thêm tin nhắn rỗng của AI để bắt đầu Stream
            setMessages(prev => [...prev, {
                id: aiMsgId,
                text: '',
                sender: 'ai',
                timestamp: new Date()
            }]);

            // Bước 3: Xây dựng Multi-turn History (6 tin nhắn gần nhất)
            const recentMessages = messages
                .filter(m => m.id !== 'welcome' && m.text.trim())
                .slice(-6) // Lấy 6 tin nhắn gần nhất (3 cặp user/ai)
                .map(m => ({
                    role: m.sender === 'user' ? 'user' as const : 'model' as const,
                    content: m.text
                }));
            
            // Lấy model ưu tiên
            const modelId = localStorage.getItem('cic_local_ai_model') || 'qwen2.5-14b';
            
            const stream = streamChat({
                messages: [
                    ...recentMessages.map(m => ({ role: m.role, content: m.content })),
                    { role: 'user' as const, content: input },
                ],
                model: modelId,
                systemInstruction: systemInst,
                meta: { source: 'web-chat' as const },
            });

            let accumulatedText = '';
            for await (const chunk of stream) {
                accumulatedText += chunk;
                setMessages(prev => prev.map(msg => 
                    msg.id === aiMsgId ? { ...msg, text: accumulatedText } : msg
                ));
            }

        } catch (error) {
            console.error(error);
            setIsSearching(false);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: "⚠️ Xin lỗi, tôi đang gặp sự cố kết nối nội bộ. Vui lòng kiểm tra:\n- Docker vLLM đang chạy (`docker ps`)\n- Model lớn đã tải xong chưa",
                sender: 'ai',
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none font-sans">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-80 md:w-[400px] h-[550px] bg-white/95 backdrop-blur-xl dark:bg-slate-900 rounded-2xl shadow-2xl shadow-indigo-500/10 dark:shadow-none border border-slate-200/50 dark:border-slate-800 flex flex-col overflow-hidden pointer-events-auto animate-slide-up transform origin-bottom-right transition-all">
                    {/* Premium Header */}
                    <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-slate-800 dark:to-slate-900 flex items-center justify-between text-white shadow-sm border-b border-white/10 dark:border-slate-800/50">
                        <div className="flex items-center gap-3">
                            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm border border-white/20">
                                <Bot className="w-4 h-4 text-white" />
                                <div className="absolute top-0 right-0 w-2 h-2 bg-green-400 rounded-full border border-indigo-600"></div>
                            </div>
                            <div>
                                <h3 className="font-semibold text-[15px] leading-none tracking-tight">CIC AI Assistant</h3>
                                <p className="text-[11px] text-indigo-100/80 dark:text-slate-400 mt-1 uppercase tracking-wider font-medium">Local Secure Network</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {/* Expand Button */}
                            <button
                                onClick={handleExpand}
                                className="p-1.5 hover:bg-white/20 dark:hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
                                title="Phóng lớn — Vào chế độ phân tích chuyên sâu"
                            >
                                <Maximize2 size={16} />
                            </button>
                            {/* Close Button */}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 hover:bg-white/20 dark:hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50 dark:bg-slate-950 custom-scrollbar">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.sender === 'ai' && (
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 mr-3 shadow-sm">
                                        <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] p-4 text-[14px] leading-relaxed shadow-sm ${msg.sender === 'user'
                                        ? 'bg-gradient-to-br from-indigo-600 to-indigo-500 text-white rounded-2xl rounded-tr-sm'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 rounded-2xl rounded-tl-sm'
                                        }`}
                                >
                                    {msg.sender === 'user' ? (
                                        <div className="font-medium">{msg.text}</div>
                                    ) : (
                                        <div className="prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-headings:font-semibold prose-a:text-indigo-500 hover:prose-a:text-indigo-600 prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-2 space-y-1.5 marker:text-indigo-400" {...props} />,
                                                    ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1.5 marker:text-indigo-400 font-medium" {...props} />,
                                                    li: ({ node, ...props }) => <li className="my-1" {...props} />,
                                                    p: ({ node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                                                    strong: ({ node, ...props }) => <strong className="font-bold text-slate-900 dark:text-white" {...props} />,
                                                    table: ({ node, ...props }) => <div className="overflow-x-auto my-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-xs" {...props} /></div>,
                                                    thead: ({ node, ...props }) => <thead className="bg-slate-50 dark:bg-slate-800/80" {...props} />,
                                                    th: ({ node, ...props }) => <th className="px-4 py-2.5 text-left font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]" {...props} />,
                                                    td: ({ node, ...props }) => <td className="px-4 py-2.5 whitespace-nowrap border-t border-slate-100 dark:border-slate-700/50" {...props} />,
                                                    code: ({ node, inline, ...props }: any) => inline 
                                                        ? <code className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-mono text-[12px]" {...props} /> 
                                                        : <code {...props} />,
                                                }}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 mr-3 shadow-sm">
                                    <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="flex flex-col items-start gap-1.5 justify-center">
                                    <div className="bg-white dark:bg-slate-800 px-4 py-3.5 rounded-2xl rounded-tl-sm border border-slate-200/60 dark:border-slate-700 shadow-sm flex items-center gap-1.5 h-[44px]">
                                        <div className="w-2 h-2 bg-indigo-400 dark:bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-indigo-400 dark:bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-indigo-400 dark:bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    {isSearching && (
                                        <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium tracking-wide flex items-center gap-1 animate-pulse ml-1">
                                            📚 Đang tra cứu Knowledge Base...
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                        <div className="relative flex items-end bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 transition-all shadow-sm">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Nhập câu hỏi tại đây..."
                                className="w-full pl-4 pr-12 py-3.5 min-h-[52px] max-h-[120px] rounded-xl bg-transparent border-none focus:ring-0 text-[14px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 resize-none outline-none overflow-y-auto custom-scrollbar"
                                disabled={isLoading}
                                rows={1}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed transition-all duration-200 shadow-md shadow-indigo-500/20 cursor-pointer"
                            >
                                <Send size={16} className={input.trim() && !isLoading ? "ml-0.5" : ""} />
                            </button>
                        </div>
                        <div className="text-center mt-2">
                             <p className="text-[10px] text-slate-400 dark:text-slate-500">AI có thể đưa ra câu trả lời không chính xác. Hãy kiểm tra lại.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative group p-4 rounded-full shadow-2xl transition-all duration-300 pointer-events-auto hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer ${isOpen
                    ? 'bg-slate-800 text-white rotate-90 scale-0 opacity-0 absolute'
                    : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white hover:shadow-indigo-500/40'
                    }`}
            >
                {/* Glow effect under button */}
                <div className="absolute inset-0 rounded-full bg-indigo-500 blur opacity-40 group-hover:opacity-60 transition-opacity"></div>
                <MessageCircle size={28} className="relative z-10" />
                
                {/* Notification Badge */}
                {!isOpen && (
                    <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-4 w-4 z-20">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white dark:border-slate-900"></span>
                    </span>
                )}
            </button>
        </div>
    );
};

export default ChatWidget;
