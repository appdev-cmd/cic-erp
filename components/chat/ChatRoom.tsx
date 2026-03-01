import React, { useState, useEffect, useCallback, useRef } from 'react';
import ChatHeader from './ChatHeader';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import ChatAISummary from './ChatAISummary';
import { useChatRealtime } from '../../hooks/useChatRealtime';
import * as chatService from '../../services/chatService';
import type { ChatRoomWithDetails, ChatMessageWithSender } from '../../types';
import { toast } from 'sonner';

interface ChatRoomProps {
    room: ChatRoomWithDetails | null;
    currentUserId: string;
    isOnline?: (userId: string) => boolean;
    onBack?: () => void;
    onMessageSent?: () => void;
    onDeleteRoom?: (roomId: string) => void;
    allRooms?: ChatRoomWithDetails[]; // For forward message room selection
}

const ChatRoom: React.FC<ChatRoomProps> = ({
    room, currentUserId, isOnline, onBack, onMessageSent, onDeleteRoom, allRooms = [],
}) => {
    const [messages, setMessages] = useState<ChatMessageWithSender[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [replyTo, setReplyTo] = useState<ChatMessageWithSender | null>(null);
    const [reactions, setReactions] = useState<Record<string, { emoji: string; users: string[]; count: number }[]>>({});
    const [readStatus, setReadStatus] = useState<{ userId: string; fullName: string; lastReadAt: string }[]>([]);
    const [pinnedMessages, setPinnedMessages] = useState<ChatMessageWithSender[]>([]);
    const [showPinned, setShowPinned] = useState(false);
    const [showAISummary, setShowAISummary] = useState(false);
    const [showForwardModal, setShowForwardModal] = useState<string | null>(null);
    const prevRoomRef = useRef<string | null>(null);

    // Load messages
    const loadMessages = useCallback(async () => {
        if (!room) return;
        setIsLoading(true);
        try {
            const data = await chatService.getMessages(room.id);
            setMessages(data);
            const msgIds = data.map(m => m.id);
            if (msgIds.length > 0) {
                const rxns = await chatService.getReactionsForMessages(msgIds);
                setReactions(rxns);
            }
            const rs = await chatService.getReadStatus(room.id);
            setReadStatus(rs);
            const pinned = await chatService.getPinnedMessages(room.id);
            setPinnedMessages(pinned);
            await chatService.markAsRead(room.id, currentUserId);
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
        setIsLoading(false);
    }, [room?.id, currentUserId]);

    useEffect(() => {
        if (room && room.id !== prevRoomRef.current) {
            prevRoomRef.current = room.id;
            loadMessages();
            setReplyTo(null);
            setShowPinned(false);
            setShowAISummary(false);
            setShowForwardModal(null);
        }
    }, [room?.id, loadMessages]);

    // Realtime
    const handleNewMessage = useCallback((msg: ChatMessageWithSender) => {
        setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            if (msg.sender_id !== currentUserId) {
                toast.info(`${msg.sender?.fullName || 'Ai đó'}: ${msg.content?.slice(0, 50) || '📎 File'}`, {
                    duration: 3000, position: 'top-right',
                });
            }
            return [...prev, msg];
        });
        if (room) chatService.markAsRead(room.id, currentUserId).catch(() => { });
        onMessageSent?.();
    }, [currentUserId, room?.id, onMessageSent]);

    useChatRealtime({ roomId: room?.id || null, onNewMessage: handleNewMessage });

    // Send message
    const handleSend = async (content: string) => {
        if (!room || !content.trim()) return;
        try {
            await chatService.sendMessage(room.id, currentUserId, content.trim(), 'text' as const, {}, replyTo?.id);
            setReplyTo(null);
            onMessageSent?.();
        } catch { toast.error('Gửi tin nhắn thất bại'); }
    };

    // File upload
    const handleFileUpload = async (file: File) => {
        if (!room) return;
        if (file.size > 10 * 1024 * 1024) { toast.error('File quá lớn (tối đa 10MB)'); return; }
        try {
            toast.loading('Đang tải file lên...', { id: 'file-upload' });
            await chatService.uploadAndSendFile(room.id, currentUserId, file);
            toast.success('Đã gửi file', { id: 'file-upload' });
            onMessageSent?.();
        } catch { toast.error('Upload thất bại', { id: 'file-upload' }); }
    };

    // Reactions
    const handleReact = async (messageId: string, emoji: string) => {
        try {
            await chatService.toggleReaction(messageId, currentUserId, emoji);
            const msgIds = messages.map(m => m.id);
            const rxns = await chatService.getReactionsForMessages(msgIds);
            setReactions(rxns);
        } catch { console.error('Reaction failed'); }
    };

    // Pin
    const handlePin = async (messageId: string, pin: boolean) => {
        try {
            await chatService.togglePinMessage(messageId, currentUserId, pin);
            toast.success(pin ? 'Đã ghim tin nhắn' : 'Đã bỏ ghim');
            const data = await chatService.getMessages(room!.id);
            setMessages(data);
            const pinned = await chatService.getPinnedMessages(room!.id);
            setPinnedMessages(pinned);
        } catch { toast.error('Thao tác thất bại'); }
    };

    // Forward
    const handleForward = (messageId: string) => setShowForwardModal(messageId);
    const handleForwardTo = async (targetRoomId: string) => {
        if (!showForwardModal) return;
        try {
            await chatService.forwardMessage(showForwardModal, targetRoomId, currentUserId);
            toast.success('Đã chuyển tiếp tin nhắn');
            setShowForwardModal(null);
            onMessageSent?.();
        } catch (err: any) { toast.error(err.message || 'Chuyển tiếp thất bại'); }
    };

    // Unsend
    const handleUnsend = async (messageId: string) => {
        try {
            await chatService.unsendMessage(messageId, currentUserId);
            toast.success('Đã thu hồi tin nhắn');
            const data = await chatService.getMessages(room!.id);
            setMessages(data);
            onMessageSent?.();
        } catch (err: any) { toast.error(err.message || 'Thu hồi thất bại'); }
    };

    // Empty state
    if (!room) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 gap-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center">
                    <span className="text-4xl">💬</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">CIC Internal Chat</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500">Chọn cuộc trò chuyện để bắt đầu</p>
            </div>
        );
    }

    const getRoomDisplayName = () => {
        if (room.type === 'direct') {
            const other = room.members.find(m => m.user_id !== currentUserId);
            return other?.profile?.fullName || 'Chat';
        }
        return room.name || 'Nhóm chat';
    };

    const handleExport = async () => {
        try {
            await chatService.exportChatAsHTML(room.id, getRoomDisplayName());
        } catch (err: any) {
            toast.error(err.message || 'Xuất thất bại');
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <ChatHeader
                room={room}
                currentUserId={currentUserId}
                isOnline={isOnline}
                onBack={onBack}
                pinnedCount={pinnedMessages.length}
                onShowPinned={() => setShowPinned(!showPinned)}
                onShowAI={() => setShowAISummary(!showAISummary)}
                onExport={handleExport}
                onDeleteRoom={onDeleteRoom ? () => onDeleteRoom(room.id) : undefined}
            />

            {/* AI Summary panel */}
            {showAISummary && (
                <ChatAISummary roomId={room.id} onClose={() => setShowAISummary(false)} />
            )}

            {/* Pinned panel */}
            {showPinned && pinnedMessages.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900 border-b border-amber-200 dark:border-amber-800 px-4 py-2 max-h-40 overflow-y-auto">
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mb-1.5">
                        📌 Tin nhắn đã ghim ({pinnedMessages.length})
                    </p>
                    {pinnedMessages.map(pm => (
                        <div key={pm.id} className="flex items-start gap-2 py-1.5 border-b border-amber-100 dark:border-amber-800 last:border-0">
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-300 whitespace-nowrap">{pm.sender?.fullName}:</span>
                            <p className="text-xs text-amber-600 dark:text-amber-400 truncate">{pm.content}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Forward modal */}
            {showForwardModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForwardModal(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-80 max-h-96 overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Chuyển tiếp đến</h3>
                        </div>
                        {allRooms.filter(r => r.id !== room.id).map(r => {
                            const name = r.type === 'direct'
                                ? r.members.find(m => m.user_id !== currentUserId)?.profile?.fullName || 'Người dùng'
                                : r.name || 'Nhóm';
                            return (
                                <button key={r.id} onClick={() => handleForwardTo(r.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                        {name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()}
                                    </div>
                                    <span className="text-sm text-slate-700 dark:text-slate-300">{name}</span>
                                </button>
                            );
                        })}
                        {allRooms.filter(r => r.id !== room.id).length === 0 && (
                            <p className="text-sm text-slate-400 text-center py-8">Không có cuộc trò chuyện khác</p>
                        )}
                    </div>
                </div>
            )}

            <ChatMessageList
                messages={messages}
                currentUserId={currentUserId}
                isLoading={isLoading}
                onReply={setReplyTo}
                onReact={handleReact}
                onPin={handlePin}
                onForward={handleForward}
                onUnsend={handleUnsend}
                reactions={reactions}
                readStatus={readStatus}
            />

            <ChatInput
                onSend={handleSend}
                onFileUpload={handleFileUpload}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                members={room.members}
                currentUserId={currentUserId}
            />
        </div>
    );
};

export default ChatRoom;
