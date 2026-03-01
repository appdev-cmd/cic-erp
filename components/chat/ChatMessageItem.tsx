import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Reply, Download, FileText, Pin, SmilePlus, Check, CheckCheck, Forward, Trash2 } from 'lucide-react';
import { parseMentions } from '../../services/mentionService';
import { detectContractLinks } from '../../services/chatService';
import type { ChatMessageWithSender } from '../../types';

interface ChatMessageItemProps {
    message: ChatMessageWithSender;
    isOwn: boolean;
    replyMessage?: ChatMessageWithSender | null;
    onReply?: (message: ChatMessageWithSender) => void;
    onReact?: (messageId: string, emoji: string) => void;
    onPin?: (messageId: string, pin: boolean) => void;
    onForward?: (messageId: string) => void;
    onUnsend?: (messageId: string) => void;
    reactions?: { emoji: string; users: string[]; count: number }[];
    readBy?: string[];
}

function getInitials(name: string): string {
    return name.split(' ').filter(Boolean).map(w => w[0]).slice(-2).join('').toUpperCase();
}

function getAvatarColor(name: string): string {
    const colors = [
        'from-indigo-500 to-purple-500',
        'from-emerald-500 to-teal-500',
        'from-orange-500 to-amber-500',
        'from-rose-500 to-pink-500',
        'from-cyan-500 to-blue-500',
    ];
    let hash = 0;
    for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

function formatTime(dateStr: string): string {
    try { return format(parseISO(dateStr), 'HH:mm'); }
    catch { return ''; }
}

// Color mapping for mention types
const MENTION_COLORS: Record<string, { bg: string; text: string; hoverBg: string }> = {
    user: { bg: 'bg-blue-500/20', text: 'text-blue-300', hoverBg: 'hover:bg-blue-500/30' },
    contract: { bg: 'bg-purple-500/20', text: 'text-purple-300', hoverBg: 'hover:bg-purple-500/30' },
    customer: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', hoverBg: 'hover:bg-emerald-500/30' },
    product: { bg: 'bg-orange-500/20', text: 'text-orange-300', hoverBg: 'hover:bg-orange-500/30' },
    unit: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', hoverBg: 'hover:bg-cyan-500/30' },
};

const MENTION_COLORS_LIGHT: Record<string, { bg: string; text: string; hoverBg: string }> = {
    user: { bg: 'bg-blue-100', text: 'text-blue-700', hoverBg: 'hover:bg-blue-200' },
    contract: { bg: 'bg-purple-100', text: 'text-purple-700', hoverBg: 'hover:bg-purple-200' },
    customer: { bg: 'bg-emerald-100', text: 'text-emerald-700', hoverBg: 'hover:bg-emerald-200' },
    product: { bg: 'bg-orange-100', text: 'text-orange-700', hoverBg: 'hover:bg-orange-200' },
    unit: { bg: 'bg-cyan-100', text: 'text-cyan-700', hoverBg: 'hover:bg-cyan-200' },
};

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
    message, isOwn, replyMessage, onReply, onReact, onPin,
    onForward, onUnsend, reactions = [], readBy = [],
}) => {
    const [showActions, setShowActions] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const senderName = message.sender?.fullName || 'Unknown';
    const avatarUrl = message.sender?.avatarUrl;
    const time = formatTime(message.created_at);
    const isUnsent = message.metadata?.unsent;
    const isForwarded = message.metadata?.forwarded;
    const isFile = message.type === 'file';
    const isImage = message.type === 'image';
    const isSystem = message.type === 'system';
    const canUnsend = isOwn && !isUnsent && (Date.now() - new Date(message.created_at).getTime() < 5 * 60 * 1000);

    // Render content with universal @mentions and contract links
    const renderContent = (text: string) => {
        if (isUnsent) return <span className="italic opacity-60">🚫 Tin nhắn đã thu hồi</span>;
        if (isSystem) return <span className="italic opacity-60">{text}</span>;

        // Parse @[type:id:label] mentions
        const { parts } = parseMentions(text);
        const colorMap = isOwn ? MENTION_COLORS : MENTION_COLORS_LIGHT;

        return parts.map((part, i) => {
            if (part.type === 'mention' && part.mention) {
                const m = part.mention;
                const colors = colorMap[m.type] || colorMap['user'];
                return (
                    <a
                        key={`m${i}`}
                        href={m.route}
                        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md font-semibold text-xs transition-colors cursor-pointer ${colors.bg} ${colors.text} ${colors.hoverBg}`}
                        title={`→ ${m.label}`}
                    >
                        <span className="text-[10px]">{m.icon}</span>
                        {m.label}
                    </a>
                );
            }

            // For text parts, also detect legacy contract codes and @mentions
            const textContent = part.content;
            const links = detectContractLinks(textContent);
            if (links.length > 0) {
                let lastIdx = 0;
                const elements: React.ReactNode[] = [];
                links.forEach((link, j) => {
                    if (link.start > lastIdx) elements.push(<span key={`t${i}_${j}`}>{textContent.slice(lastIdx, link.start)}</span>);
                    elements.push(
                        <a key={`cl${i}_${j}`} href={`/contracts?search=${encodeURIComponent(link.code)}`}
                            className={`font-semibold underline decoration-dotted transition-colors ${isOwn ? 'text-indigo-200 hover:text-white' : 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-500'}`}>
                            {link.code}
                        </a>
                    );
                    lastIdx = link.end;
                });
                if (lastIdx < textContent.length) elements.push(<span key={`te${i}`}>{textContent.slice(lastIdx)}</span>);
                return <React.Fragment key={`f${i}`}>{elements}</React.Fragment>;
            }

            return <span key={`s${i}`}>{textContent}</span>;
        });
    };

    return (
        <div
            className={`group flex gap-2.5 px-4 py-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
        >
            {/* Avatar */}
            {!isOwn && (
                <div className="flex-shrink-0 mt-1">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt={senderName} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(senderName)} flex items-center justify-center text-white text-[10px] font-bold`}>
                            {getInitials(senderName)}
                        </div>
                    )}
                </div>
            )}

            <div className={`max-w-[70%] relative ${isOwn ? 'items-end' : 'items-start'}`}>
                {/* Sender name */}
                {!isOwn && (
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-0.5 ml-1">
                        {senderName}
                    </p>
                )}

                {/* Forwarded label */}
                {isForwarded && (
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mb-0.5 ml-1 flex items-center gap-0.5">
                        <Forward size={9} /> Đã chuyển tiếp
                    </p>
                )}

                {/* Reply quote */}
                {replyMessage && (
                    <div className={`text-[10px] px-2.5 py-1.5 mb-0.5 rounded-t-xl border-l-2 ${isOwn
                        ? 'bg-indigo-700/30 border-indigo-300 text-indigo-200'
                        : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-500 text-slate-500 dark:text-slate-400'
                        }`}>
                        <span className="font-semibold">{replyMessage.sender?.fullName || 'Unknown'}</span>
                        <p className="truncate max-w-[250px] opacity-80">{replyMessage.content}</p>
                    </div>
                )}

                {/* Message bubble */}
                <div className={`relative rounded-2xl px-3.5 py-2 ${isOwn
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
                    } ${message.is_pinned ? 'ring-2 ring-amber-400/60' : ''}`}>

                    {/* Pin indicator */}
                    {message.is_pinned && (
                        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
                            <Pin size={10} className="text-amber-900" />
                        </div>
                    )}

                    {/* Image */}
                    {isImage && message.file_url && (
                        <div className="mb-2 -mx-1 -mt-0.5">
                            <img
                                src={message.file_url}
                                alt={message.file_name || 'Image'}
                                className="rounded-xl max-h-64 object-cover cursor-pointer hover:opacity-90"
                                onClick={() => window.open(message.file_url!, '_blank')}
                            />
                        </div>
                    )}

                    {/* File */}
                    {isFile && message.file_url && (
                        <a href={message.file_url} target="_blank" rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2 rounded-xl mb-1 transition-colors ${isOwn ? 'bg-indigo-700 hover:bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700'}`}>
                            <FileText size={16} className={isOwn ? 'text-indigo-200' : 'text-slate-500'} />
                            <p className={`text-xs font-medium truncate flex-1 ${isOwn ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                {message.file_name || 'File'}
                            </p>
                            <Download size={14} className={isOwn ? 'text-indigo-200' : 'text-slate-400'} />
                        </a>
                    )}

                    {/* Text */}
                    {message.content && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {renderContent(message.content)}
                        </p>
                    )}

                    {/* Time + read */}
                    <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-[9px] ${isOwn ? 'text-indigo-200/70' : 'text-slate-400 dark:text-slate-500'}`}>{time}</span>
                        {isOwn && (
                            <span className="text-indigo-200/70">
                                {readBy.length > 0 ? <CheckCheck size={12} className="text-emerald-300" /> : <Check size={12} />}
                            </span>
                        )}
                    </div>
                </div>

                {/* Reactions */}
                {reactions.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        {reactions.map((r, i) => (
                            <button key={i} onClick={() => onReact?.(message.id, r.emoji)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs border border-slate-200 dark:border-slate-700 transition-colors"
                                title={r.users.join(', ')}>
                                <span>{r.emoji}</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400">{r.count}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Hover action bar */}
                {showActions && !isUnsent && (
                    <div className={`absolute top-0 ${isOwn ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'} flex items-center gap-0.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-0.5 z-10`}>
                        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Reaction">
                            <SmilePlus size={14} />
                        </button>
                        <button onClick={() => onReply?.(message)}
                            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Trả lời">
                            <Reply size={14} />
                        </button>
                        <button onClick={() => onForward?.(message.id)}
                            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Chuyển tiếp">
                            <Forward size={14} />
                        </button>
                        <button onClick={() => onPin?.(message.id, !message.is_pinned)}
                            className={`p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 ${message.is_pinned ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            title={message.is_pinned ? 'Bỏ ghim' : 'Ghim'}>
                            <Pin size={14} />
                        </button>
                        {canUnsend && (
                            <button onClick={() => onUnsend?.(message.id)}
                                className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900 text-slate-400 hover:text-red-500" title="Thu hồi">
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                )}

                {/* Emoji picker */}
                {showEmojiPicker && (
                    <div className={`absolute ${isOwn ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'} top-8 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-20 grid grid-cols-4 gap-1`}>
                        {QUICK_EMOJIS.map(emoji => (
                            <button key={emoji} onClick={() => { onReact?.(message.id, emoji); setShowEmojiPicker(false); }}
                                className="text-lg hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg p-1 transition-colors">
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessageItem;
