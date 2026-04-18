// DiscussionBox — Reusable Discussion Component
// Embed in any entity: <DiscussionBox entityType="contract" entityId={id} />
// Features: chat-like UI, avatar, reactions, reply, pin, system messages, sticky input

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Send, Pin, CornerDownRight, Smile, Paperclip,
  Trash2, Edit3, X, Check, MessageCircle, PinOff, AtSign
} from 'lucide-react';
import { toast } from 'sonner';
import { DiscussionService } from '../../services/discussionService';
import type { Discussion } from '../../services/discussionService';
import { formatDateTime } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import { dataClient } from '../../lib/dataClient';

interface MentionUser {
  id: string;
  name: string;
  avatar?: string;
}

// ═══════════════════════════════════════
// EMOJI PICKER
// ═══════════════════════════════════════
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '👀', '🔥', '💯'];

// ═══════════════════════════════════════
// AUTO-LINKIFY HELPER
// ═══════════════════════════════════════
const LINKIFY_REGEX = /(?:https?:\/\/[^\s]+)|(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(?:(?:\+84|0)\d{9,10})|(?:@[\w\u00C0-\u024F]+(?:\s[\w\u00C0-\u024F]+)?)/g;

const linkifyContent = (text: string): React.ReactNode[] => {
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  LINKIFY_REGEX.lastIndex = 0;
  while ((match = LINKIFY_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    const m = match[0];
    if (m.startsWith('@')) {
      result.push(<span key={key++} className="font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded px-0.5">{m}</span>);
    } else if (m.startsWith('http')) {
      result.push(<a key={key++} href={m} target="_blank" rel="noopener noreferrer" className="text-indigo-500 dark:text-indigo-400 hover:underline break-all">{m}</a>);
    } else if (m.includes('@')) {
      result.push(<a key={key++} href={`mailto:${m}`} className="text-indigo-500 dark:text-indigo-400 hover:underline">{m}</a>);
    } else {
      result.push(<a key={key++} href={`tel:${m}`} className="text-emerald-600 dark:text-emerald-400 hover:underline">{m}</a>);
    }
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) {
    result.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }
  return result.length > 0 ? result : [<span key={0}>{text}</span>];
};

// ═══════════════════════════════════════
// SINGLE COMMENT BUBBLE
// ═══════════════════════════════════════
const CommentBubble: React.FC<{
  comment: Discussion;
  currentUserId: string;
  onReply: (comment: Discussion) => void;
  onReaction: (commentId: string, emoji: string) => void;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onPin: (commentId: string) => void;
  onScrollToComment?: (commentId: string) => void;
  commentRef?: (el: HTMLDivElement | null) => void;
}> = ({ comment, currentUserId, onReply, onReaction, onDelete, onEdit, onPin, onScrollToComment, commentRef }) => {
  const [showEmoji, setShowEmoji] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const emojiRef = useRef<HTMLDivElement>(null);
  const isOwn = comment.user_id === currentUserId;
  const isSystem = comment.comment_type === 'system';

  // Close emoji on click outside
  useEffect(() => {
    if (!showEmoji) return;
    const handleClick = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmoji]);

  // System message
  if (isSystem) {
    return (
      <div ref={commentRef} className="flex items-center gap-2 py-1.5">
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        <span className="text-[11px] text-slate-400 dark:text-slate-500 italic px-2 whitespace-nowrap">{comment.content}</span>
        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  const initials = (comment.user_name || '?').charAt(0).toUpperCase();
  const hasReactions = Object.keys(comment.reactions || {}).length > 0;

  return (
    <div ref={commentRef} className="group flex gap-2.5 relative py-1.5 -mx-2 px-2 rounded-lg transition-all">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
        {comment.user_avatar ? (
          <img src={comment.user_avatar} alt="" className="w-full h-full rounded-full object-cover" />
        ) : initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name + time */}
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{comment.user_name || 'Người dùng'}</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{formatDateTime(comment.created_at)}</span>
          {comment.is_edited && <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">(đã sửa)</span>}
          {comment.is_pinned && <Pin size={11} className="text-amber-500 fill-amber-500" />}
        </div>

        {comment.reply_to_name && (
          <button
            onClick={() => comment.parent_id && onScrollToComment?.(comment.parent_id)}
            className="flex items-center gap-1.5 mb-1 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer transition-colors"
          >
            <CornerDownRight size={12} />
            <span>Trả lời <strong>{comment.reply_to_name}</strong></span>
            {comment.reply_to_content && (
              <span className="text-slate-400 dark:text-slate-500 truncate max-w-[200px]">— {comment.reply_to_content}</span>
            )}
          </button>
        )}

        {/* Message body */}
        {isEditing ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              autoFocus value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { onEdit(comment.id, editText); setIsEditing(false); }
                if (e.key === 'Escape') { setEditText(comment.content); setIsEditing(false); }
              }}
              className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button onClick={() => { onEdit(comment.id, editText); setIsEditing(false); }} className="text-emerald-500 hover:text-emerald-600 cursor-pointer"><Check size={16} /></button>
            <button onClick={() => { setEditText(comment.content); setIsEditing(false); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"><X size={16} /></button>
          </div>
        ) : (
          <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{linkifyContent(comment.content)}</div>
        )}

        {/* Reactions */}
        {hasReactions && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {Object.entries(comment.reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReaction(comment.id, emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all cursor-pointer ${
                  (users as string[]).includes(currentUserId)
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <span>{emoji}</span>
                <span className="font-semibold">{(users as string[]).length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action toolbar — floats right next to message content, not at absolute right */}
      {!isEditing && (
        <div className="flex items-start gap-0.5 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-start">
          {/* Emoji */}
          <div className="relative" ref={emojiRef}>
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className="p-1.5 rounded-md text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Thả cảm xúc"
            >
              <Smile size={14} />
            </button>
            {showEmoji && (
              <div className="absolute bottom-full right-0 mb-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 flex gap-1 z-50">
                {QUICK_REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => { onReaction(comment.id, emoji); setShowEmoji(false); }}
                    className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => onReply(comment)} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" title="Trả lời">
            <CornerDownRight size={14} />
          </button>
          {isOwn && (
            <button onClick={() => setIsEditing(true)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" title="Chỉnh sửa">
              <Edit3 size={14} />
            </button>
          )}
          <button onClick={() => onPin(comment.id)} className="p-1.5 rounded-md text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" title={comment.is_pinned ? 'Bỏ ghim' : 'Ghim'}>
            {comment.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          {isOwn && (
            <button onClick={() => onDelete(comment.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer" title="Xóa">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════
// PINNED MESSAGE PREVIEW
// ═══════════════════════════════════════
const PinnedPreview: React.FC<{
  comment: Discussion;
  onClick: () => void;
  onUnpin: (id: string) => void;
}> = ({ comment, onClick, onUnpin }) => (
  <div className="flex items-center gap-2 group">
    <button
      onClick={onClick}
      className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
    >
      <Pin size={11} className="text-amber-500 fill-amber-500 flex-shrink-0" />
      <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex-shrink-0">{comment.user_name}:</span>
      <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{comment.content}</span>
    </button>
    <button
      onClick={e => { e.stopPropagation(); onUnpin(comment.id); }}
      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all cursor-pointer p-0.5 flex-shrink-0"
      title="Bỏ ghim"
    >
      <X size={12} />
    </button>
  </div>
);

// ═══════════════════════════════════════
// MAIN DISCUSSION BOX
// ═══════════════════════════════════════
interface DiscussionBoxProps {
  entityType: string;
  entityId: string;
  className?: string;
  maxHeight?: string;
  title?: string;
  showHeader?: boolean;
}

const DiscussionBox: React.FC<DiscussionBoxProps> = ({
  entityType,
  entityId,
  className = '',
  maxHeight,
  title = 'Trao đổi',
  showHeader = true,
}) => {
  const { profile } = useAuth();
  const currentUserId = profile?.id || '';
  const currentUserName = profile?.fullName || 'Người dùng';

  const [comments, setComments] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Discussion | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [allUsers, setAllUsers] = useState<MentionUser[]>([]);

  // Load employees for @mention autocomplete
  useEffect(() => {
    dataClient.from('employees').select('id, name, avatar').order('name').then(({ data }) => {
      if (data) setAllUsers(data.map((e: any) => ({ id: e.id, name: e.name || e.id, avatar: e.avatar })));
    });
  }, []);


  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    // Detect @mention trigger
    const cursor = e.target.selectionStart || 0;
    const before = val.slice(0, cursor);
    const mentionMatch = before.match(/@([\w\u00C0-\u024F]*)$/);
    if (mentionMatch) {
      const q = mentionMatch[1].toLowerCase();
      setMentionQuery(q);
      const filtered = allUsers.filter(u => u.name.toLowerCase().includes(q)).slice(0, 6);
      setMentionUsers(filtered);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionUsers([]);
    }
  };

  const insertMention = (user: MentionUser) => {
    const input = inputRef.current;
    if (!input) return;
    const cursor = input.selectionStart || 0;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const newBefore = before.replace(/@[\w\u00C0-\u024F]*$/, `@${user.name} `);
    setText(newBefore + after);
    setMentionQuery(null);
    setMentionUsers([]);
    setTimeout(() => { input.focus(); input.setSelectionRange(newBefore.length, newBefore.length); }, 0);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionUsers.length > 0 && mentionQuery !== null) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionUsers.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionUsers[mentionIndex]); return; }
      if (e.key === 'Escape') { setMentionQuery(null); setMentionUsers([]); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && mentionUsers.length === 0) { e.preventDefault(); handleSend(); }
  };

  const loadComments = useCallback(async () => {
    try {
      const data = await DiscussionService.getByEntity(entityType, entityId);
      setComments(data.filter(c => c.comment_type !== 'system'));
    } catch (err: any) {
      console.error('Failed to load discussions:', err);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const scrollToComment = (id: string) => {
    const el = commentRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash highlight
      el.classList.add('ring-2', 'ring-amber-400', 'dark:ring-amber-500');
      setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'dark:ring-amber-500'), 2000);
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await DiscussionService.add({
        entity_type: entityType,
        entity_id: entityId,
        user_id: currentUserId,
        content: text.trim(),
        parent_id: replyingTo?.id,
      });
      setText('');
      setReplyingTo(null);
      await loadComments();
      scrollToBottom();
    } catch (err: any) {
      toast.error('Lỗi gửi bình luận: ' + (err.message || err));
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (commentId: string, emoji: string) => {
    try {
      await DiscussionService.toggleReaction(commentId, emoji, currentUserId);
      await loadComments();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Xóa bình luận này?')) return;
    try {
      await DiscussionService.delete(commentId);
      await loadComments();
      toast.success('Đã xóa bình luận');
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  const handleEdit = async (commentId: string, content: string) => {
    try {
      await DiscussionService.edit(commentId, content);
      await loadComments();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || err));
    }
  };

  const handlePin = async (commentId: string) => {
    try {
      await DiscussionService.togglePin(commentId);
      await loadComments();
      toast.success('Đã cập nhật ghim');
    } catch (err: any) {
      toast.error('Lỗi ghim: ' + (err.message || err));
    }
  };

  const handleReply = (comment: Discussion) => {
    setReplyingTo(comment);
    inputRef.current?.focus();
  };

  const pinnedComments = comments.filter(c => c.is_pinned && c.comment_type !== 'system');
  const totalCount = comments.filter(c => c.comment_type !== 'system').length;

  return (
    <div className={`flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${className}`} style={{ height: '100%' }}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex-shrink-0">
          <MessageCircle size={16} className="text-indigo-500 dark:text-indigo-400" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{title}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full font-semibold">{totalCount}</span>
        </div>
      )}

      {/* Pinned messages section (compact, 1-line each) */}
      {pinnedComments.length > 0 && (
        <div className="px-4 py-2 border-b border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 flex-shrink-0 space-y-1">
          {pinnedComments.map(p => (
            <PinnedPreview key={p.id} comment={p} onClick={() => scrollToComment(p.id)} onUnpin={handlePin} />
          ))}
        </div>
      )}

      {/* Messages area (scrollable) */}
      <div className={`flex-1 overflow-y-auto p-4 ${comments.length === 0 && !loading ? 'flex items-center justify-center' : 'space-y-1'}`} style={maxHeight && maxHeight !== '100%' ? { maxHeight } : {}}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center">
            <MessageCircle size={36} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Chưa có trao đổi nào</p>
            <p className="text-xs text-slate-300 dark:text-slate-600 mt-1">Hãy bắt đầu cuộc thảo luận!</p>
          </div>
        ) : (
          comments.map(comment => (
            <CommentBubble
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              onReply={handleReply}
              onReaction={handleReaction}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onPin={handlePin}
              onScrollToComment={scrollToComment}
              commentRef={el => { commentRefs.current[comment.id] = el; }}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply indicator (sticky) */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-t border-indigo-200 dark:border-indigo-800 flex-shrink-0">
          <CornerDownRight size={14} className="text-indigo-500 dark:text-indigo-400" />
          <span className="text-xs text-indigo-600 dark:text-indigo-400 flex-1 truncate">
            Trả lời <strong>{replyingTo.user_name}</strong>: {replyingTo.content}
          </span>
          <button onClick={() => setReplyingTo(null)} className="text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer"><X size={14} /></button>
        </div>
      )}

      {/* Input (sticky bottom) */}
      <div className="flex items-center gap-2 p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {currentUserName.charAt(0).toUpperCase()}
        </div>
        {/* Input wrapper with mention dropdown */}
        <div className="flex-1 relative">
          {mentionUsers.length > 0 && mentionQuery !== null && (
            <div className="absolute bottom-full left-0 mb-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 flex items-center gap-1">
                <AtSign size={10} /> Nhắc đến
              </div>
              {mentionUsers.map((u, i) => (
                <button
                  key={u.id}
                  onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors cursor-pointer
                    ${i === mentionIndex ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : u.name.charAt(0).toUpperCase()}
                  </div>
                  {u.name}
                </button>
              ))}
            </div>
          )}
          <input
            ref={inputRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleInputKeyDown}
            placeholder={replyingTo ? `Trả lời ${replyingTo.user_name}... (dùng @ để nhắc đến)` : 'Viết bình luận... (dùng @ để nhắc đến)'}
            className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default DiscussionBox;
