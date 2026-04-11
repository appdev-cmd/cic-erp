/**
 * AI Chat History Service — Lưu trữ & truy vấn lịch sử hội thoại AI
 * Sử dụng bảng ai_conversations + ai_messages trên Supabase
 */
import { dataClient } from '../lib/dataClient';

export interface AiConversation {
  id: string;
  user_id: string;
  agent_id: string | null;
  channel: string;
  title: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'model';
  content: string;
  created_at: string;
}

// ─── Conversations ──────────────────────────────

/** Lấy danh sách cuộc hội thoại gần nhất của user */
export async function getConversations(userId: string, limit = 30): Promise<AiConversation[]> {
  const { data, error } = await dataClient
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('channel', 'web')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[aiChatHistory] getConversations error:', error); return []; }
  return data || [];
}

/** Tạo cuộc hội thoại mới */
export async function createConversation(
  userId: string,
  agentId: string,
  model: string,
  title?: string
): Promise<AiConversation | null> {
  const { data, error } = await dataClient
    .from('ai_conversations')
    .insert({
      user_id: userId,
      agent_id: agentId || null,
      channel: 'web',
      model,
      title: title || null,
    })
    .select()
    .single();
  if (error) { console.error('[aiChatHistory] createConversation error:', error); return null; }
  return data;
}

/** Cập nhật tiêu đề và thời gian cuộc hội thoại */
export async function updateConversation(convId: string, title: string): Promise<void> {
  await dataClient
    .from('ai_conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', convId);
}

/** Xóa cuộc hội thoại + tin nhắn */
export async function deleteConversation(convId: string): Promise<void> {
  // Xóa messages trước (FK constraint)
  await dataClient.from('ai_messages').delete().eq('conversation_id', convId);
  await dataClient.from('ai_conversations').delete().eq('id', convId);
}

// ─── Messages ──────────────────────────────────

/** Lấy tin nhắn của cuộc hội thoại */
export async function getMessages(convId: string): Promise<AiMessage[]> {
  const { data, error } = await dataClient
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true });
  if (error) { console.error('[aiChatHistory] getMessages error:', error); return []; }
  return data || [];
}

/** Lưu 1 tin nhắn */
export async function saveMessage(
  convId: string,
  role: 'user' | 'model',
  content: string
): Promise<AiMessage | null> {
  const { data, error } = await dataClient
    .from('ai_messages')
    .insert({ conversation_id: convId, role, content })
    .select()
    .single();

  // Cập nhật updated_at cho conversation
  if (!error) {
    await dataClient
      .from('ai_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId);
  }
  if (error) { console.error('[aiChatHistory] saveMessage error:', error); return null; }
  return data;
}

/** Lưu hàng loạt tin nhắn (khi migrate từ localStorage) */
export async function saveMessagesBatch(
  convId: string,
  messages: { role: 'user' | 'model'; content: string }[]
): Promise<void> {
  if (!messages.length) return;
  const rows = messages.map(m => ({
    conversation_id: convId,
    role: m.role,
    content: m.content,
  }));
  await dataClient.from('ai_messages').insert(rows);
  await dataClient
    .from('ai_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', convId);
}

/** Auto-tạo tiêu đề từ tin nhắn đầu tiên */
export function generateTitle(firstMessage: string): string {
  const clean = firstMessage.replace(/\n/g, ' ').trim();
  return clean.length > 60 ? clean.substring(0, 57) + '...' : clean;
}
