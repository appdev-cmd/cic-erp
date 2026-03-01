/**
 * Chat Service — CRUD operations for internal chat
 * Uses dataClient for all Supabase operations
 */
import { dataClient } from '../lib/dataClient';
import type { ChatRoom, ChatMessage, ChatMember, ChatRoomWithDetails, ChatMessageWithSender } from '../types';

// ============================================
// ROOMS
// ============================================

/** Get all chat rooms the current user is a member of, with last message + unread */
export async function getRooms(userId: string): Promise<ChatRoomWithDetails[]> {
    // Get rooms user is member of
    const { data: memberships, error: memErr } = await dataClient
        .from('chat_members')
        .select('room_id, last_read_at')
        .eq('user_id', userId);

    if (memErr || !memberships?.length) return [];

    const roomIds = memberships.map(m => m.room_id);

    // Get room details
    const { data: rooms, error: roomErr } = await dataClient
        .from('chat_rooms')
        .select('*')
        .in('id', roomIds)
        .order('updated_at', { ascending: false });

    if (roomErr || !rooms) return [];

    // Get all members for these rooms with profile info
    const { data: allMembers } = await dataClient
        .from('chat_members')
        .select(`
      room_id, user_id, role, joined_at, last_read_at,
      profiles!chat_members_user_profile_fkey (full_name, avatar_url, email)
    `)
        .in('room_id', roomIds);

    // Get last message per room
    const roomsWithDetails: ChatRoomWithDetails[] = [];

    for (const room of rooms) {
        const membership = memberships.find(m => m.room_id === room.id);
        const members = (allMembers || [])
            .filter(m => m.room_id === room.id)
            .map(m => {
                // Supabase join can return object or array - handle both
                const profileData = m.profiles
                    ? (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles)
                    : null;
                return {
                    room_id: m.room_id,
                    user_id: m.user_id,
                    role: m.role,
                    joined_at: m.joined_at,
                    last_read_at: m.last_read_at,
                    profile: profileData ? {
                        fullName: (profileData as any).full_name || '',
                        avatarUrl: (profileData as any).avatar_url,
                        email: (profileData as any).email,
                    } : undefined,
                };
            });

        // Get last message
        const { data: lastMsgs } = await dataClient
            .from('chat_messages')
            .select('*')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false })
            .limit(1);

        // Count unread
        const lastReadAt = membership?.last_read_at || '1970-01-01';
        const { count: unreadCount } = await dataClient
            .from('chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', room.id)
            .gt('created_at', lastReadAt)
            .neq('sender_id', userId);

        roomsWithDetails.push({
            ...room,
            lastMessage: lastMsgs?.[0] || null,
            unreadCount: unreadCount || 0,
            members,
        });
    }

    return roomsWithDetails;
}

/** Get or create a direct (1-1) chat room */
export async function getOrCreateDirectChat(currentUserId: string, otherUserId: string): Promise<ChatRoom> {
    // Find existing direct room between these 2 users
    const { data: myRooms } = await dataClient
        .from('chat_members')
        .select('room_id')
        .eq('user_id', currentUserId);

    const { data: theirRooms } = await dataClient
        .from('chat_members')
        .select('room_id')
        .eq('user_id', otherUserId);

    if (myRooms && theirRooms) {
        const myRoomIds = new Set(myRooms.map(r => r.room_id));
        const commonRoomIds = theirRooms.filter(r => myRoomIds.has(r.room_id)).map(r => r.room_id);

        if (commonRoomIds.length > 0) {
            const { data: existingRoom } = await dataClient
                .from('chat_rooms')
                .select('*')
                .in('id', commonRoomIds)
                .eq('type', 'direct')
                .limit(1)
                .single();

            if (existingRoom) return existingRoom;
        }
    }

    // Create new direct room
    const { data: room, error } = await dataClient
        .from('chat_rooms')
        .insert({ type: 'direct', created_by: currentUserId })
        .select()
        .single();

    if (error || !room) throw new Error('Failed to create chat room');

    // Add both users as members
    await dataClient.from('chat_members').insert([
        { room_id: room.id, user_id: currentUserId, role: 'admin' },
        { room_id: room.id, user_id: otherUserId, role: 'member' },
    ]);

    return room;
}

/** Delete a chat room (direct rooms can be deleted by any member, group ones by admin only) */
export async function deleteRoom(roomId: string, currentUserId: string): Promise<void> {
    const { error } = await dataClient.rpc('delete_chat_room', {
        p_room_id: roomId,
        p_user_id: currentUserId
    });
    if (error) throw new Error(error.message || 'Failed to delete room');
}

/** Create a group chat */
export async function createGroupChat(
    name: string,
    currentUserId: string,
    memberIds: string[]
): Promise<ChatRoom> {
    const { data: room, error } = await dataClient
        .from('chat_rooms')
        .insert({ name, type: 'group', created_by: currentUserId })
        .select()
        .single();

    if (error || !room) throw new Error('Failed to create group');

    const members = [currentUserId, ...memberIds].map(uid => ({
        room_id: room.id,
        user_id: uid,
        role: uid === currentUserId ? 'admin' : 'member',
    }));

    await dataClient.from('chat_members').insert(members);

    return room;
}

// ============================================
// MESSAGES
// ============================================

/** Get messages for a room (paginated, newest first) */
export async function getMessages(
    roomId: string,
    limit = 50,
    beforeDate?: string
): Promise<ChatMessageWithSender[]> {
    let query = dataClient
        .from('chat_messages')
        .select(`
      *,
      profiles!chat_messages_sender_profile_fkey (full_name, avatar_url)
    `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (beforeDate) {
        query = query.lt('created_at', beforeDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(msg => ({
        ...msg,
        profiles: undefined,
        sender: msg.profiles ? {
            fullName: (msg.profiles as any).full_name || '',
            avatarUrl: (msg.profiles as any).avatar_url,
        } : undefined,
    })).reverse(); // Return in chronological order
}

/** Send a message */
export async function sendMessage(
    roomId: string,
    senderId: string,
    content: string,
    type: 'text' | 'file' | 'image' | 'system' = 'text',
    metadata: Record<string, any> = {},
    replyTo?: string
): Promise<ChatMessage> {
    const { data, error } = await dataClient
        .from('chat_messages')
        .insert({
            room_id: roomId,
            sender_id: senderId,
            content,
            type,
            metadata,
            reply_to: replyTo || null,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/** Mark room as read for user */
export async function markAsRead(roomId: string, userId: string): Promise<void> {
    await dataClient
        .from('chat_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', userId);
}

// ============================================
// USERS (for creating new chats)
// ============================================

/** Search user profiles for starting new conversations */
export async function searchUsers(query: string, excludeUserId: string) {
    if (!excludeUserId) return [];
    // Build query — skip neq filter if ID is not a valid UUID (dev bypass)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(excludeUserId);
    let q = dataClient
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(20);
    if (isUUID) q = q.neq('id', excludeUserId);

    const { data, error } = await q;
    if (error) {
        console.error('[chatService.searchUsers] Error:', error);
        return [];
    }
    return (data || []).map(u => ({
        id: u.id,
        fullName: u.full_name,
        avatarUrl: u.avatar_url,
        email: u.email,
    }));
}

/** Get all user profiles (for creating group chats) */
export async function getAllUsers(excludeUserId: string) {
    if (!excludeUserId) return [];
    // Build query — skip neq filter if ID is not a valid UUID (dev bypass)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(excludeUserId);
    let q = dataClient
        .from('profiles')
        .select('id, full_name, avatar_url, email')
        .order('full_name');
    if (isUUID) q = q.neq('id', excludeUserId);

    const { data, error } = await q;
    if (error) {
        console.error('[chatService.getAllUsers] Error:', error);
        return [];
    }
    return (data || []).map(u => ({
        id: u.id,
        fullName: u.full_name,
        avatarUrl: u.avatar_url,
        email: u.email,
    }));
}

// ============================================
// PHASE 2: FILE UPLOAD, SEARCH, CONTRACT CHAT
// ============================================

/** Upload a file to Supabase Storage and send as message */
export async function uploadAndSendFile(
    roomId: string,
    senderId: string,
    file: File
): Promise<ChatMessage> {
    const ext = file.name.split('.').pop() || 'bin';
    const filePath = `chat/${roomId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await dataClient.storage
        .from('chat-files')
        .upload(filePath, file, { upsert: false });

    if (uploadError) throw new Error('Upload failed: ' + uploadError.message);

    // Get public URL
    const { data: urlData } = dataClient.storage
        .from('chat-files')
        .getPublicUrl(filePath);

    const isImage = file.type.startsWith('image/');
    const msgType = isImage ? 'image' : 'file';

    return sendMessage(roomId, senderId, isImage ? '📷 Hình ảnh' : `📎 ${file.name}`, msgType, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileUrl: urlData.publicUrl,
        filePath,
    });
}

/** Create or get a chat room linked to a contract */
export async function getOrCreateContractChat(
    contractId: string,
    contractTitle: string,
    currentUserId: string,
    memberIds: string[]
): Promise<ChatRoom> {
    // Check if contract chat already exists
    const { data: existing } = await dataClient
        .from('chat_rooms')
        .select('*')
        .eq('contract_id', contractId)
        .eq('type', 'contract')
        .limit(1)
        .maybeSingle();

    if (existing) return existing;

    // Create new contract chat room
    const { data: room, error } = await dataClient
        .from('chat_rooms')
        .insert({
            name: `📋 ${contractTitle}`,
            type: 'contract',
            contract_id: contractId,
            created_by: currentUserId,
        })
        .select()
        .single();

    if (error || !room) throw new Error('Failed to create contract chat');

    // Add all members
    const allMembers = [...new Set([currentUserId, ...memberIds])];
    await dataClient.from('chat_members').insert(
        allMembers.map(uid => ({
            room_id: room.id,
            user_id: uid,
            role: uid === currentUserId ? 'admin' : 'member',
        }))
    );

    // Send system message
    await sendMessage(room.id, currentUserId, `Đã tạo nhóm chat cho hợp đồng "${contractTitle}"`, 'system');

    return room;
}

/** Search messages across all rooms user has access to */
export async function searchMessages(
    userId: string,
    query: string,
    limit = 30
): Promise<ChatMessageWithSender[]> {
    // First, get rooms user is in
    const { data: memberships } = await dataClient
        .from('chat_members')
        .select('room_id')
        .eq('user_id', userId);

    if (!memberships?.length) return [];

    const roomIds = memberships.map(m => m.room_id);

    const { data, error } = await dataClient
        .from('chat_messages')
        .select(`
            *,
            profiles!chat_messages_sender_profile_fkey (full_name, avatar_url)
        `)
        .in('room_id', roomIds)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) return [];

    return (data || []).map(msg => ({
        ...msg,
        profiles: undefined,
        sender: msg.profiles ? {
            fullName: (msg.profiles as any).full_name || '',
            avatarUrl: (msg.profiles as any).avatar_url,
        } : undefined,
    }));
}

/** Get a single message by ID (for reply preview) */
export async function getMessageById(messageId: string): Promise<ChatMessageWithSender | null> {
    const { data, error } = await dataClient
        .from('chat_messages')
        .select(`
            *,
            profiles!chat_messages_sender_profile_fkey (full_name, avatar_url)
        `)
        .eq('id', messageId)
        .single();

    if (error || !data) return null;

    return {
        ...data,
        profiles: undefined,
        sender: data.profiles ? {
            fullName: (data.profiles as any).full_name || '',
            avatarUrl: (data.profiles as any).avatar_url,
        } : undefined,
    };
}

/** Delete a message (only sender can delete) */
export async function deleteMessage(messageId: string): Promise<void> {
    const { error } = await dataClient
        .from('chat_messages')
        .delete()
        .eq('id', messageId);

    if (error) throw error;
}

// ============================================
// PHASE 3: REACTIONS, PIN, READ RECEIPTS
// ============================================

/** Toggle a reaction on a message */
export async function toggleReaction(
    messageId: string,
    userId: string,
    emoji: string
): Promise<{ added: boolean }> {
    // Check if reaction exists
    const { data: existing } = await dataClient
        .from('chat_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .maybeSingle();

    if (existing) {
        // Remove reaction
        await dataClient.from('chat_reactions').delete().eq('id', existing.id);
        return { added: false };
    } else {
        // Add reaction
        await dataClient.from('chat_reactions').insert({
            message_id: messageId,
            user_id: userId,
            emoji,
        });
        return { added: true };
    }
}

/** Get reactions for messages in a room */
export async function getReactionsForMessages(messageIds: string[]): Promise<Record<string, { emoji: string; users: string[]; count: number }[]>> {
    if (!messageIds.length) return {};

    const { data, error } = await dataClient
        .from('chat_reactions')
        .select(`
            id, message_id, emoji, user_id,
            profiles!chat_reactions_user_id_fkey (full_name)
        `)
        .in('message_id', messageIds);

    if (error || !data) return {};

    // Group by message_id → emoji
    const grouped: Record<string, Record<string, { users: string[]; count: number }>> = {};
    data.forEach((r: any) => {
        if (!grouped[r.message_id]) grouped[r.message_id] = {};
        if (!grouped[r.message_id][r.emoji]) grouped[r.message_id][r.emoji] = { users: [], count: 0 };
        const userName = r.profiles?.full_name || 'Unknown';
        grouped[r.message_id][r.emoji].users.push(userName);
        grouped[r.message_id][r.emoji].count++;
    });

    // Convert to array format
    const result: Record<string, { emoji: string; users: string[]; count: number }[]> = {};
    Object.entries(grouped).forEach(([msgId, emojis]) => {
        result[msgId] = Object.entries(emojis).map(([emoji, data]) => ({
            emoji,
            ...data,
        }));
    });

    return result;
}

/** Pin/unpin a message */
export async function togglePinMessage(
    messageId: string,
    userId: string,
    pin: boolean
): Promise<void> {
    await dataClient
        .from('chat_messages')
        .update({
            is_pinned: pin,
            pinned_by: pin ? userId : null,
            pinned_at: pin ? new Date().toISOString() : null,
        })
        .eq('id', messageId);
}

/** Get pinned messages for a room */
export async function getPinnedMessages(roomId: string): Promise<ChatMessageWithSender[]> {
    const { data, error } = await dataClient
        .from('chat_messages')
        .select(`
            *,
            profiles!chat_messages_sender_profile_fkey (full_name, avatar_url)
        `)
        .eq('room_id', roomId)
        .eq('is_pinned', true)
        .order('pinned_at', { ascending: false });

    if (error || !data) return [];

    return data.map(msg => ({
        ...msg,
        profiles: undefined,
        sender: msg.profiles ? {
            fullName: (msg.profiles as any).full_name || '',
            avatarUrl: (msg.profiles as any).avatar_url,
        } : undefined,
    }));
}

/** Get read status for a room (who read up to when) */
export async function getReadStatus(roomId: string): Promise<{ userId: string; fullName: string; lastReadAt: string }[]> {
    const { data, error } = await dataClient
        .from('chat_members')
        .select(`
            user_id, last_read_at,
            profiles!chat_members_user_profile_fkey (full_name)
        `)
        .eq('room_id', roomId);

    if (error || !data) return [];

    return data.map((m: any) => ({
        userId: m.user_id,
        fullName: m.profiles?.full_name || '',
        lastReadAt: m.last_read_at,
    }));
}

// ============================================
// PHASE 4: AI SUMMARY, FORWARD, UNSEND, AUTO-LINK
// ============================================

/** AI Summary: Summarize conversation using DeepSeek */
export async function summarizeConversation(roomId: string, messageCount = 50): Promise<string> {
    // Get recent messages
    const { data: messages, error } = await dataClient
        .from('chat_messages')
        .select(`
            content, created_at, sender_id,
            profiles!chat_messages_sender_profile_fkey (full_name)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(messageCount);

    if (error || !messages || messages.length === 0) {
        return 'Không có tin nhắn để tóm tắt.';
    }

    // Build conversation text
    const conversationText = messages.reverse().map((m: any) => {
        const name = m.profiles?.full_name || 'Unknown';
        const time = new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return `[${time}] ${name}: ${m.content}`;
    }).join('\n');

    // Call DeepSeek API
    const apiKey = localStorage.getItem('cic_custom_deepseek_key') || import.meta.env.VITE_DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('Chưa cấu hình DeepSeek API Key');

    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey,
        dangerouslyAllowBrowser: true,
    });

    const response = await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
            {
                role: 'system',
                content: `Bạn là AI trợ lý nội bộ CIC ERP. Hãy tóm tắt cuộc hội thoại bên dưới bằng TIẾNG VIỆT. Tóm tắt ngắn gọn, nêu:
1. Chủ đề chính 
2. Các quyết định/kết luận quan trọng
3. Công việc cần follow-up (nếu có)
4. Người liên quan

Format: Markdown ngắn gọn, bullet points.`
            },
            {
                role: 'user',
                content: `Tóm tắt cuộc hội thoại sau:\n\n${conversationText}`
            }
        ],
        temperature: 0.3,
        max_tokens: 500,
    });

    return response.choices[0]?.message?.content || 'Không thể tóm tắt.';
}

/** Forward a message to another room */
export async function forwardMessage(
    messageId: string,
    targetRoomId: string,
    senderId: string
): Promise<ChatMessage> {
    // Get original message
    const { data: original } = await dataClient
        .from('chat_messages')
        .select('content, type, file_url, file_name, metadata')
        .eq('id', messageId)
        .single();

    if (!original) throw new Error('Tin nhắn không tồn tại');

    // Send to target room with forwarded flag
    const { data, error } = await dataClient
        .from('chat_messages')
        .insert({
            room_id: targetRoomId,
            sender_id: senderId,
            content: original.content,
            type: original.type,
            file_url: original.file_url,
            file_name: original.file_name,
            metadata: { ...original.metadata, forwarded: true, original_id: messageId },
        })
        .select()
        .single();

    if (error || !data) throw error || new Error('Forward thất bại');

    // Update target room timestamp
    await dataClient
        .from('chat_rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', targetRoomId);

    return data;
}

/** Unsend (delete) a message within 5 minutes */
export async function unsendMessage(messageId: string, senderId: string): Promise<void> {
    // Get message to verify sender and time
    const { data: msg } = await dataClient
        .from('chat_messages')
        .select('sender_id, created_at')
        .eq('id', messageId)
        .single();

    if (!msg) throw new Error('Tin nhắn không tồn tại');
    if (msg.sender_id !== senderId) throw new Error('Bạn không có quyền thu hồi tin nhắn này');

    // Check 5 minute limit
    const created = new Date(msg.created_at).getTime();
    const now = Date.now();
    if (now - created > 5 * 60 * 1000) {
        throw new Error('Chỉ có thể thu hồi tin nhắn trong vòng 5 phút');
    }

    // Replace content with "Tin nhắn đã thu hồi" instead of deleting
    await dataClient
        .from('chat_messages')
        .update({
            content: '🚫 Tin nhắn đã được thu hồi',
            type: 'system',
            metadata: { unsent: true },
            file_url: null,
            file_name: null,
        })
        .eq('id', messageId);
}

/** Detect contract codes in message text (e.g. HD-2026-001, CIC/HĐ/2026/001) */
export function detectContractLinks(text: string): { code: string; start: number; end: number }[] {
    // Match common contract code patterns
    const patterns = [
        /\b(H[ĐD]-?\d{4}-?\d{1,5})\b/gi,           // HD-2026-001
        /\b(CIC\/?H[ĐD]\/?[\d/]{4,12})\b/gi,         // CIC/HĐ/2026/001
        /\b((?:hợp đồng|HĐ)\s*(?:số\s*)?[\d/.-]{3,15})\b/gi, // Hợp đồng số 123/2026
    ];

    const results: { code: string; start: number; end: number }[] = [];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            results.push({
                code: match[1] || match[0],
                start: match.index,
                end: match.index + match[0].length,
            });
        }
    }
    return results;
}

/** Export chat messages as printable HTML (opens in new window → Print to PDF) */
export async function exportChatAsHTML(roomId: string, roomName: string): Promise<void> {
    const { data: messages, error } = await dataClient
        .from('chat_messages')
        .select(`
            content, created_at, sender_id, type,
            profiles!chat_messages_sender_profile_fkey (full_name)
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(200);

    if (error || !messages || messages.length === 0) {
        throw new Error('Không có tin nhắn để xuất');
    }

    const rows = messages.map((m: any) => {
        const name = m.profiles?.full_name || 'Unknown';
        const time = new Date(m.created_at).toLocaleString('vi-VN', {
            dateStyle: 'short', timeStyle: 'short'
        });
        const content = m.type === 'system' ? `<em>${m.content}</em>` : m.content;
        return `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;white-space:nowrap;color:#666;font-size:12px">${time}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600;white-space:nowrap;color:#4338ca">${name}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${content}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chat: ${roomName}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:30px;color:#1e293b}h1{font-size:18px;color:#4338ca;border-bottom:2px solid #4338ca;padding-bottom:8px}table{width:100%;border-collapse:collapse;font-size:13px}.meta{color:#94a3b8;font-size:11px;margin-bottom:16px}@media print{body{padding:0}}</style></head><body><h1>📝 Lịch sử chat: ${roomName}</h1><p class="meta">Xuất lúc: ${new Date().toLocaleString('vi-VN')} | ${messages.length} tin nhắn</p><table>${rows}</table></body></html>`;

    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(() => win.print(), 500);
    }
}
