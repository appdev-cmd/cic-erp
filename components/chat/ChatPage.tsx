import React, { useState, useEffect, useCallback } from 'react';
import ChatSidebar from './ChatSidebar';
import ChatRoom from './ChatRoom';
import ChatNewConversation from './ChatNewConversation';
import { useChatPresence } from '../../hooks/useChatPresence';
import { useAuth } from '../../contexts/AuthContext';
import * as chatService from '../../services/chatService';
import type { ChatRoomWithDetails, ChatMessageWithSender } from '../../types';
import { toast } from 'sonner';
import { Search, X, MessageCircle, ArrowRight } from 'lucide-react';

const ChatPage: React.FC = () => {
    const { user, profile } = useAuth();
    const [rooms, setRooms] = useState<ChatRoomWithDetails[]>([]);
    const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
    const [showNewChat, setShowNewChat] = useState(false);
    const [isLoadingRooms, setIsLoadingRooms] = useState(true);
    const [showSidebarMobile, setShowSidebarMobile] = useState(true);

    // Search state
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ChatMessageWithSender[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Dev bypass: user is null, fallback to profile.id
    const currentUserId = user?.id || profile?.id || '';
    const { isOnline } = useChatPresence(currentUserId || null, profile?.fullName);

    // Load rooms
    const loadRooms = useCallback(async () => {
        if (!currentUserId) {
            setIsLoadingRooms(false);
            return;
        }
        try {
            const data = await chatService.getRooms(currentUserId);
            setRooms(data);
        } catch (err) {
            console.error('Failed to load rooms:', err);
        }
        setIsLoadingRooms(false);
    }, [currentUserId]);

    useEffect(() => {
        loadRooms();
    }, [loadRooms]);

    const activeRoom = rooms.find(r => r.id === activeRoomId) || null;

    const handleSelectRoom = (roomId: string) => {
        setActiveRoomId(roomId);
        setShowSidebarMobile(false);
        setShowSearch(false);
    };

    const handleCreateDirect = async (otherUserId: string) => {
        try {
            const room = await chatService.getOrCreateDirectChat(currentUserId, otherUserId);
            setShowNewChat(false);
            await loadRooms();
            setActiveRoomId(room.id);
            setShowSidebarMobile(false);
        } catch (err) {
            toast.error('Không thể tạo cuộc trò chuyện');
        }
    };

    const handleCreateGroup = async (name: string, memberIds: string[]) => {
        try {
            const room = await chatService.createGroupChat(name, currentUserId, memberIds);
            setShowNewChat(false);
            await loadRooms();
            setActiveRoomId(room.id);
            setShowSidebarMobile(false);
        } catch (err) {
            toast.error('Không thể tạo nhóm chat');
        }
    };

    const handleMessageSent = useCallback(() => {
        loadRooms();
    }, [loadRooms]);

    const handleBack = () => {
        setShowSidebarMobile(true);
        setActiveRoomId(null);
    };

    // Search messages
    const handleSearch = async () => {
        if (!searchQuery.trim() || !currentUserId) return;
        setIsSearching(true);
        try {
            const results = await chatService.searchMessages(currentUserId, searchQuery);
            setSearchResults(results);
        } catch (err) {
            console.error('Search failed:', err);
        }
        setIsSearching(false);
    };

    const handleDeleteRoom = async (roomId: string) => {
        if (!confirm('Bạn có chắc chắn muốn xoá cuộc trò chuyện này? Toàn bộ tin nhắn sẽ bị xoá vĩnh viễn.')) return;
        try {
            await chatService.deleteRoom(roomId, currentUserId);
            toast.success('Đã xoá cuộc trò chuyện');
            if (activeRoomId === roomId) {
                window.history.pushState({}, '', '/chat');
                setActiveRoomId(null);
                setSearchQuery('');
            }
            loadRooms();
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi xoá cuộc trò chuyện');
        }
    };

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }
        const debounce = setTimeout(handleSearch, 400);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    return (
        <div className="h-[calc(100vh-64px)] flex bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
            {/* Sidebar */}
            <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 ${!showSidebarMobile ? 'hidden md:flex' : 'flex'}`}>
                <ChatSidebar
                    rooms={rooms}
                    activeRoomId={activeRoomId}
                    currentUserId={currentUserId}
                    isOnline={isOnline}
                    onSelectRoom={handleSelectRoom}
                    onNewChat={() => setShowNewChat(true)}
                    isLoading={isLoadingRooms}
                />
            </div>

            {/* Main Area: Chat Room or Search Results */}
            <div className={`flex-1 flex flex-col min-h-0 ${showSidebarMobile ? 'hidden md:flex' : 'flex'}`}>
                {/* Search overlay */}
                {showSearch ? (
                    <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
                        {/* Search header */}
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                            <Search size={16} className="text-slate-400" />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Tìm kiếm tin nhắn..."
                                className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
                                autoFocus
                            />
                            <button
                                onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Search results */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {isSearching ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{searchResults.length} kết quả</p>
                                    {searchResults.map(msg => (
                                        <button
                                            key={msg.id}
                                            onClick={() => {
                                                handleSelectRoom(msg.room_id);
                                                setShowSearch(false);
                                            }}
                                            className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-slate-100 dark:border-slate-800"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                                    {msg.sender?.fullName || 'Unknown'}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(msg.created_at).toLocaleDateString('vi-VN')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{msg.content}</p>
                                        </button>
                                    ))}
                                </div>
                            ) : searchQuery.trim() ? (
                                <div className="text-center py-8">
                                    <p className="text-sm text-slate-400 dark:text-slate-500">Không tìm thấy kết quả</p>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <ChatRoom
                        room={activeRoom}
                        currentUserId={currentUserId}
                        isOnline={isOnline}
                        onBack={handleBack}
                        onMessageSent={handleMessageSent}
                        onDeleteRoom={handleDeleteRoom}
                        allRooms={rooms}
                    />
                )}
            </div>

            {/* New Chat Modal */}
            {showNewChat && (
                <ChatNewConversation
                    currentUserId={currentUserId}
                    onCreateDirect={handleCreateDirect}
                    onCreateGroup={handleCreateGroup}
                    onClose={() => setShowNewChat(false)}
                />
            )}
        </div>
    );
};

export default ChatPage;
