/**
 * DB-Backed conversation history for OpenClaw-style persistent context.
 * Syncs with Supabase `ai_conversations` and `ai_messages`.
 */
import { supabaseAdmin } from '../supabaseClient.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

const MAX_HISTORY = 20;

export async function addMessage(chatId: number, role: 'user' | 'assistant', content: string): Promise<void> {
  const telegramIdStr = String(chatId);
  try {
    let convId = null;
    const { data: conv } = await supabaseAdmin
      .from('ai_conversations')
      .select('id')
      .eq('telegram_chat_id', telegramIdStr)
      .single();
    
    if (conv) {
      convId = conv.id;
    } else {
      const { data: newConv } = await supabaseAdmin
        .from('ai_conversations')
        .insert({
          telegram_chat_id: telegramIdStr,
          agent_id: '8b4feea1-5d83-42e4-892c-f4d9a559a942', // ID mặc định của Trợ lý CIC
          status: 'active'
        })
        .select('id')
        .single();
      if (newConv) convId = newConv.id;
    }

    if (convId) {
      await supabaseAdmin.from('ai_messages').insert({
        conversation_id: convId,
        role: role,
        content: content.slice(0, 4000)
      });
    }
  } catch (err) {
    console.error('Lỗi khi add message to Supabase:', err);
  }
}

export async function getHistory(chatId: number): Promise<ChatMessage[]> {
  const telegramIdStr = String(chatId);
  try {
    const { data: conv } = await supabaseAdmin
      .from('ai_conversations')
      .select('id')
      .eq('telegram_chat_id', telegramIdStr)
      .single();
      
    if (!conv) return [];

    const { data: msgs } = await supabaseAdmin
      .from('ai_messages')
      .select('role, content, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY);

    if (!msgs) return [];
    
    return msgs.reverse().map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content || '',
      ts: new Date(m.created_at).getTime()
    }));
  } catch (err) {
    console.error('Lỗi khi getHistory Supabase:', err);
    return [];
  }
}

export async function clearHistory(chatId: number): Promise<void> {
  const telegramIdStr = String(chatId);
  try {
    const { data: conv } = await supabaseAdmin
      .from('ai_conversations')
      .select('id')
      .eq('telegram_chat_id', telegramIdStr)
      .single();
      
    if (conv) {
      await supabaseAdmin.from('ai_messages').delete().eq('conversation_id', conv.id);
    }
  } catch (err) {
    console.error('Lỗi clearHistory Supabase:', err);
  }
}

export async function getContextSummary(chatId: number): Promise<string> {
  const msgs = await getHistory(chatId);
  if (msgs.length === 0) return '';
  return msgs.map((m: any) => `${m.role === 'user' ? 'Người dùng' : 'Bot'}: ${m.content.slice(0, 300)}`).join('\n');
}
