import React, { useState } from 'react';
import { Sparkles, Loader2, X, Copy, Check } from 'lucide-react';
import * as chatService from '../../services/chatService';
import { toast } from 'sonner';

interface ChatAISummaryProps {
    roomId: string;
    onClose: () => void;
}

const ChatAISummary: React.FC<ChatAISummaryProps> = ({ roomId, onClose }) => {
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleSummarize = async () => {
        setIsLoading(true);
        setSummary('');
        try {
            const result = await chatService.summarizeConversation(roomId);
            setSummary(result);
        } catch (err: any) {
            toast.error(err.message || 'Tóm tắt thất bại');
        }
        setIsLoading(false);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(summary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-gradient-to-b from-indigo-50 to-purple-50 dark:from-indigo-900 dark:to-purple-900 border-b border-indigo-200 dark:border-indigo-800 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                        <Sparkles size={14} className="text-white" />
                    </div>
                    <h4 className="text-sm font-bold text-indigo-700 dark:text-indigo-400">
                        AI Tóm tắt
                    </h4>
                </div>
                <div className="flex items-center gap-1">
                    {summary && (
                        <button onClick={handleCopy}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/50 dark:hover:bg-slate-800 transition-colors"
                            title="Copy">
                            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                    )}
                    <button onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800 transition-colors">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {!summary && !isLoading && (
                <button onClick={handleSummarize}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-medium shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
                    <Sparkles size={15} />
                    Tóm tắt cuộc trò chuyện bằng AI
                </button>
            )}

            {isLoading && (
                <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                    <span className="text-sm text-indigo-600 dark:text-indigo-400 animate-pulse">
                        AI đang phân tích cuộc trò chuyện...
                    </span>
                </div>
            )}

            {summary && (
                <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl p-3 text-sm text-slate-700 dark:text-slate-300 prose prose-sm dark:prose-invert max-w-none leading-relaxed">
                    {summary.split('\n').map((line, i) => (
                        <p key={i} className="mb-1 last:mb-0">
                            {line.startsWith('- ') ? (
                                <span className="flex items-start gap-1.5">
                                    <span className="text-indigo-500 mt-0.5">•</span>
                                    <span>{line.slice(2)}</span>
                                </span>
                            ) : line.startsWith('**') ? (
                                <strong className="text-indigo-700 dark:text-indigo-400">{line.replace(/\*\*/g, '')}</strong>
                            ) : line}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ChatAISummary;
