/**
 * NotificationItem — Single notification row
 */

import React from 'react';
import { NotificationItem as NotificationItemType } from '../../types';
import {
    FileText, CreditCard, CheckCircle, XCircle, Send,
    AtSign, Trash2, Edit, AlertCircle
} from 'lucide-react';

interface Props {
    notification: NotificationItemType;
    onRead: (id: string) => void;
    onDelete: (id: string) => void;
    onClick: (notification: NotificationItemType) => void;
}

/**
 * Map notification type → icon + color
 */
function getNotifIcon(type: string) {
    switch (type) {
        case 'contract_created':
            return { icon: <FileText size={18} />, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' };
        case 'contract_updated':
            return { icon: <Edit size={18} />, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' };
        case 'contract_status_changed':
            return { icon: <AlertCircle size={18} />, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' };
        case 'contract_deleted':
            return { icon: <Trash2 size={18} />, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
        case 'payment_created':
        case 'payment_updated':
            return { icon: <CreditCard size={18} />, color: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' };
        case 'payment_deleted':
            return { icon: <Trash2 size={18} />, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
        case 'workflow_submitted':
            return { icon: <Send size={18} />, color: 'text-orange-500 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' };
        case 'workflow_approved':
            return { icon: <CheckCircle size={18} />, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' };
        case 'workflow_rejected':
            return { icon: <XCircle size={18} />, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
        case 'mention':
            return { icon: <AtSign size={18} />, color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' };
        default:
            return { icon: <FileText size={18} />, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' };
    }
}

/**
 * Format time relative to now (Vietnamese)
 */
function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    if (diffDay < 7) return `${diffDay} ngày trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
}

const NotifItem: React.FC<Props> = ({ notification, onRead, onDelete, onClick }) => {
    const { icon, color, bg } = getNotifIcon(notification.type);
    const isUnread = !notification.is_read;

    return (
        <div
            onClick={() => {
                if (isUnread) onRead(notification.id);
                onClick(notification);
            }}
            className={`
                flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors duration-150
                ${isUnread
                    ? 'bg-orange-50/50 dark:bg-orange-900/10 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }
            `}
        >
            {/* Icon */}
            <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${bg}`}>
                <span className={color}>{icon}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className={`text-sm leading-5 line-clamp-1 ${isUnread ? 'font-semibold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                        {notification.title}
                    </p>
                    {isUnread && (
                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-orange-500 dark:bg-orange-400 animate-pulse" />
                    )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-4">
                    {notification.message}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    {timeAgo(notification.created_at)}
                </p>
            </div>

            {/* Delete button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(notification.id);
                }}
                className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                title="Xóa thông báo"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
};

export default NotifItem;
