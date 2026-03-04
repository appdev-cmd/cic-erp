/**
 * NotificationPanel — Dropdown notification center
 * ===================================================
 * Triggered by Bell icon in Header.
 * Shows list of notifications with real-time updates.
 */

import React, { useRef, useEffect } from 'react';
import { Bell, CheckCheck, Loader2, Inbox } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import NotifItem from './NotificationItem';
import { NotificationItem as NotificationItemType } from '../../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onNavigate?: (notification: NotificationItemType) => void;
}

const NotificationPanel: React.FC<Props> = ({ isOpen, onClose, onNavigate }) => {
    const {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        loadMore,
        hasMore,
    } = useNotifications();

    const panelRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
        }
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Infinite scroll
    const handleScroll = () => {
        if (!scrollRef.current || !hasMore) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        if (scrollHeight - scrollTop - clientHeight < 60) {
            loadMore();
        }
    };

    const handleNotificationClick = (notification: NotificationItemType) => {
        onClose();
        if (onNavigate) {
            onNavigate(notification);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            ref={panelRef}
            className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 80px)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <Bell size={18} className="text-orange-500 dark:text-orange-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Thông báo
                    </h3>
                    {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-orange-500 text-white">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-2 py-1 rounded-md transition-colors"
                    >
                        <CheckCheck size={14} />
                        Đọc tất cả
                    </button>
                )}
            </div>

            {/* Notification List */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"
                style={{ maxHeight: '400px' }}
            >
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="text-orange-500 animate-spin" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                        <Inbox size={40} strokeWidth={1.5} className="mb-2" />
                        <p className="text-sm font-medium">Không có thông báo</p>
                        <p className="text-xs mt-1">Bạn sẽ nhận thông báo khi có thay đổi</p>
                    </div>
                ) : (
                    <>
                        {notifications.map((notif) => (
                            <div key={notif.id} className="group">
                                <NotifItem
                                    notification={notif}
                                    onRead={markAsRead}
                                    onDelete={deleteNotification}
                                    onClick={handleNotificationClick}
                                />
                            </div>
                        ))}
                        {hasMore && (
                            <div className="flex items-center justify-center py-3">
                                <button
                                    onClick={loadMore}
                                    className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-3 py-1.5 rounded-md transition-colors"
                                >
                                    Xem thêm...
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default NotificationPanel;
