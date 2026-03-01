import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import type { ChatMessageWithSender, ChatMemberWithProfile } from '../../types';
import { searchMentions, encodeMention, MENTION_CATEGORIES, type MentionResult, type MentionType } from '../../services/mentionService';

interface ChatInputProps {
    onSend: (content: string) => void;
    onTyping?: (isTyping: boolean) => void;
    onFileUpload?: (file: File) => void;
    disabled?: boolean;
    placeholder?: string;
    replyTo?: ChatMessageWithSender | null;
    onCancelReply?: () => void;
    members?: ChatMemberWithProfile[];
    currentUserId?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
    onSend, onTyping, onFileUpload, disabled, placeholder,
    replyTo, onCancelReply, members = [], currentUserId,
}) => {
    const [text, setText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Universal @mention state
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionStart, setMentionStart] = useState(-1);
    const [suggestions, setSuggestions] = useState<MentionResult[]>([]);
    const [activeTab, setActiveTab] = useState<MentionType | 'all'>('all');
    const [isSearching, setIsSearching] = useState(false);

    // Search mentions when query changes (debounced)
    useEffect(() => {
        if (mentionQuery === null) {
            setSuggestions([]);
            return;
        }

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        // Immediate results for empty query
        if (mentionQuery === '') {
            setIsSearching(true);
            searchMentions('', currentUserId).then(results => {
                setSuggestions(results);
                setMentionIndex(0);
                setIsSearching(false);
            });
            return;
        }

        // Debounced search for typed query
        searchTimeoutRef.current = setTimeout(() => {
            setIsSearching(true);
            searchMentions(mentionQuery, currentUserId).then(results => {
                setSuggestions(results);
                setMentionIndex(0);
                setIsSearching(false);
            });
        }, 200);

        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [mentionQuery, currentUserId]);

    // Filter by active tab
    const filteredSuggestions = activeTab === 'all'
        ? suggestions
        : suggestions.filter(s => s.type === activeTab);

    // Auto resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [text]);

    useEffect(() => {
        if (replyTo) textareaRef.current?.focus();
    }, [replyTo]);

    const handleSend = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        onSend(trimmed);
        setText('');
        setMentionQuery(null);
        onTyping?.(false);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const insertMention = useCallback((result: MentionResult) => {
        const before = text.slice(0, mentionStart);
        const cursorEnd = textareaRef.current?.selectionEnd || text.length;
        // Find end of current mention text (up to cursor)
        const after = text.slice(cursorEnd);
        const encoded = encodeMention(result) + ' ';
        const newText = before + encoded + after;
        setText(newText);
        setMentionQuery(null);
        setSuggestions([]);

        requestAnimationFrame(() => {
            if (textareaRef.current) {
                const pos = before.length + encoded.length;
                textareaRef.current.selectionStart = pos;
                textareaRef.current.selectionEnd = pos;
                textareaRef.current.focus();
            }
        });
    }, [text, mentionStart]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (filteredSuggestions.length > 0 && mentionQuery !== null) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredSuggestions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (filteredSuggestions[mentionIndex]) {
                    insertMention(filteredSuggestions[mentionIndex]);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setMentionQuery(null);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        if (e.key === 'Escape' && replyTo) {
            onCancelReply?.();
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const cursorPos = e.target.selectionStart;
        setText(value);
        detectMention(value, cursorPos);
        onTyping?.(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => onTyping?.(false), 2000);
    };

    const detectMention = (value: string, cursorPos: number) => {
        const textBeforeCursor = value.slice(0, cursorPos);
        const atIndex = textBeforeCursor.lastIndexOf('@');

        if (atIndex === -1) { setMentionQuery(null); return; }
        if (atIndex > 0 && !/\s/.test(textBeforeCursor[atIndex - 1])) { setMentionQuery(null); return; }

        // Don't trigger inside @[...] encoded mentions
        const beforeAt = textBeforeCursor.slice(0, atIndex);
        const openBrackets = (beforeAt.match(/@\[/g) || []).length;
        const closeBrackets = (beforeAt.match(/\]/g) || []).length;
        if (openBrackets > closeBrackets) { setMentionQuery(null); return; }

        const queryText = textBeforeCursor.slice(atIndex + 1);
        // If starts with [ it's an encoded mention, skip
        if (queryText.startsWith('[')) { setMentionQuery(null); return; }
        if (queryText.length > 40) { setMentionQuery(null); return; }

        setMentionStart(atIndex);
        setMentionQuery(queryText);
        setActiveTab('all');
    };

    const handleFileClick = () => fileInputRef.current?.click();
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onFileUpload) { onFileUpload(file); e.target.value = ''; }
    };

    // Count per category
    const getCategoryCount = (type: MentionType) => suggestions.filter(s => s.type === type).length;

    return (
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 relative">
            {/* Reply preview */}
            {replyTo && (
                <div className="flex items-center gap-2 px-4 pt-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900 border-l-2 border-indigo-500">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                Trả lời {replyTo.sender?.fullName || 'Ai đó'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{replyTo.content}</p>
                        </div>
                        <button onClick={onCancelReply} className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"><X size={14} /></button>
                    </div>
                </div>
            )}

            {/* Universal @Mention dropdown */}
            {mentionQuery !== null && (
                <div className="absolute bottom-full left-4 right-4 mb-1 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-72 overflow-hidden z-50">
                    {/* Category tabs */}
                    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
                        <button
                            onClick={() => { setActiveTab('all'); setMentionIndex(0); }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${activeTab === 'all'
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            Tất cả ({suggestions.length})
                        </button>
                        {MENTION_CATEGORIES.map(cat => {
                            const count = getCategoryCount(cat.type);
                            if (count === 0 && mentionQuery !== '') return null;
                            return (
                                <button
                                    key={cat.type}
                                    onClick={() => { setActiveTab(cat.type); setMentionIndex(0); }}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${activeTab === cat.type
                                        ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {cat.icon} {cat.label} {count > 0 ? `(${count})` : ''}
                                </button>
                            );
                        })}
                    </div>

                    {/* Results */}
                    <div className="max-h-52 overflow-y-auto p-1.5">
                        {isSearching && filteredSuggestions.length === 0 && (
                            <div className="flex items-center justify-center py-4 gap-2">
                                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-slate-400">Đang tìm...</span>
                            </div>
                        )}

                        {!isSearching && filteredSuggestions.length === 0 && mentionQuery !== '' && (
                            <p className="text-xs text-slate-400 text-center py-4">Không tìm thấy "{mentionQuery}"</p>
                        )}

                        {filteredSuggestions.map((result, i) => (
                            <button
                                key={`${result.type}-${result.id}`}
                                onClick={() => insertMention(result)}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors ${i === mentionIndex
                                    ? 'bg-indigo-50 dark:bg-indigo-900'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className="text-base flex-shrink-0">{result.icon}</span>
                                <div className="flex-1 min-w-0 text-left">
                                    <p className={`text-sm font-medium truncate ${i === mentionIndex ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'
                                        }`}>
                                        {result.label}
                                    </p>
                                    {result.sublabel && (
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{result.sublabel}</p>
                                    )}
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${result.type === 'user' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                    result.type === 'contract' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                                        result.type === 'customer' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                                            result.type === 'product' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                                                'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                    }`}>
                                    {MENTION_CATEGORIES.find(c => c.type === result.type)?.label || result.type}
                                </span>
                                {i === mentionIndex && (
                                    <span className="text-[9px] text-slate-400 ml-1">Enter ↵</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-end gap-2 px-4 py-3">
                {onFileUpload && (
                    <>
                        <button onClick={handleFileClick} disabled={disabled}
                            className="flex-shrink-0 p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                            title="Đính kèm file">
                            <Paperclip size={18} />
                        </button>
                        <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden"
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt" />
                    </>
                )}

                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder || 'Nhập tin nhắn... (@ để tag, Shift+Enter xuống dòng)'}
                        disabled={disabled}
                        rows={1}
                        className="w-full resize-none rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none transition-all"
                    />
                </div>

                <button onClick={handleSend} disabled={!text.trim() || disabled}
                    className="flex-shrink-0 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 hover:scale-105 active:scale-95">
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};

export default ChatInput;
