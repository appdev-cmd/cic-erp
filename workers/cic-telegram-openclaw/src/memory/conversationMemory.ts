/**
 * In-memory conversation history per chat — OpenClaw-style persistent context.
 * Keeps last N messages per user for multi-turn conversations.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

const MAX_HISTORY = 20;
const TTL_MS = 30 * 60 * 1000; // 30 phút

const store = new Map<number, ChatMessage[]>();

export function addMessage(chatId: number, role: 'user' | 'assistant', content: string): void {
  let history = store.get(chatId) ?? [];
  history.push({ role, content: content.slice(0, 2000), ts: Date.now() });
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  store.set(chatId, history);
}

export function getHistory(chatId: number): ChatMessage[] {
  const history = store.get(chatId) ?? [];
  const cutoff = Date.now() - TTL_MS;
  return history.filter(m => m.ts > cutoff);
}

export function clearHistory(chatId: number): void {
  store.delete(chatId);
}

export function getContextSummary(chatId: number): string {
  const msgs = getHistory(chatId);
  if (msgs.length === 0) return '';
  return msgs.map(m => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.content.slice(0, 300)}`).join('\n');
}
