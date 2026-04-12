// ============================================
// CHAT NỘI BỘ (Internal Messaging)
// ============================================

export type ChatRoomType = 'direct' | 'group' | 'contract';
export type ChatMessageType = 'text' | 'file' | 'image' | 'system';

export interface ChatRoom {
  id: string;
  name: string | null;
  type: ChatRoomType;
  avatar_url?: string | null;
  contract_id?: string | null;
  unit_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMember {
  room_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  type: ChatMessageType;
  metadata: Record<string, any>;
  reply_to?: string | null;
  is_edited: boolean;
  is_pinned?: boolean;
  pinned_by?: string | null;
  pinned_at?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  created_at: string;
  updated_at: string;
}

/** Extended room with last message + unread count for sidebar display */
export interface ChatRoomWithDetails extends ChatRoom {
  lastMessage?: ChatMessage | null;
  unreadCount: number;
  members: ChatMemberWithProfile[];
}

/** Member with joined user profile info */
export interface ChatMemberWithProfile extends ChatMember {
  profile?: {
    fullName: string;
    avatarUrl?: string;
    email?: string;
  };
}

/** Message with sender info attached */
export interface ChatMessageWithSender extends ChatMessage {
  sender?: {
    fullName: string;
    avatarUrl?: string;
  };
}

// ============================================
// NOTIFICATIONS (In-App)
// ============================================

export type NotificationType =
  | 'contract_created' | 'contract_updated' | 'contract_status_changed' | 'contract_deleted'
  | 'payment_created' | 'payment_updated' | 'payment_deleted'
  | 'workflow_submitted' | 'workflow_approved' | 'workflow_rejected'
  | 'mention';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}
