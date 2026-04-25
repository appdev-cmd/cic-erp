/**
 * Agent Memory Service
 * =====================
 * Lưu trữ long-term memory cho AI Agents trong Supabase.
 * Cho phép agents nhớ preferences, context giữa các sessions.
 */

import { dataClient as supabase } from '../../lib/dataClient';

// ─── Types ────────────────────────────────────────────

export interface AgentMemory {
  id?: string;
  user_id: string;
  agent_id: string;
  key: string;
  value: string;
  created_at?: string;
  updated_at?: string;
  expires_at?: string | null;
}

// ─── API ──────────────────────────────────────────────

/**
 * Lưu memory cho agent của user cụ thể.
 * Nếu key đã tồn tại → upsert (cập nhật).
 */
export async function saveMemory(
  userId: string,
  agentId: string,
  key: string,
  value: string,
  expiresAt?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('agent_memories')
    .upsert(
      {
        user_id: userId,
        agent_id: agentId,
        key,
        value,
        updated_at: new Date().toISOString(),
        expires_at: expiresAt ?? null,
      },
      { onConflict: 'user_id,agent_id,key' }
    );
  if (error) {
    console.error('[AgentMemory] saveMemory error:', error.message);
  }
}

/**
 * Lấy memory theo key.
 * Tự động bỏ qua nếu đã hết hạn.
 */
export async function getMemory(
  userId: string,
  agentId: string,
  key: string
): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('agent_memories')
    .select('value, expires_at')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .eq('key', key)
    .maybeSingle();

  if (error || !data) return null;
  // Kiểm tra hết hạn
  if (data.expires_at && data.expires_at < now) {
    // Xóa entry hết hạn
    await supabase
      .from('agent_memories')
      .delete()
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .eq('key', key);
    return null;
  }
  return data.value;
}

/**
 * Lấy tất cả memory của user + agent.
 */
export async function getAllMemory(
  userId: string,
  agentId: string
): Promise<Record<string, string>> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('agent_memories')
    .select('key, value, expires_at')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (error || !data) return {};
  return Object.fromEntries(data.map((row) => [row.key, row.value]));
}

/**
 * Xóa một key cụ thể.
 */
export async function deleteMemory(
  userId: string,
  agentId: string,
  key: string
): Promise<void> {
  await supabase
    .from('agent_memories')
    .delete()
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .eq('key', key);
}

/**
 * Xóa toàn bộ memory của user + agent.
 */
export async function clearMemory(
  userId: string,
  agentId: string
): Promise<void> {
  await supabase
    .from('agent_memories')
    .delete()
    .eq('user_id', userId)
    .eq('agent_id', agentId);
}

// ─── Well-known Keys ──────────────────────────────────

/** Keys tiêu chuẩn để tránh typo */
export const MEMORY_KEYS = {
  CONVERSATION_SUMMARY: 'conversation_summary',
  USER_LANGUAGE_PREF: 'user_language_pref',
  LAST_REPORT_CONTEXT: 'last_report_context',
  FAVORITE_AGENT: 'favorite_agent',
  DASHBOARD_FILTERS: 'dashboard_filters',
} as const;
