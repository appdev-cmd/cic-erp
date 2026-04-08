import { config } from './config.js';

const BASE = `https://api.telegram.org/bot${config.telegramBotToken}`;

export async function tgSendMessage(chatId: string | number, text: string): Promise<void> {
  const body = {
    chat_id: chatId,
    text: text.slice(0, 4090),
    parse_mode: 'HTML' as const,
    disable_web_page_preview: true,
  };
  const res = await fetch(`${BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as { ok?: boolean; description?: string };
  if (!j.ok) {
    throw new Error(j.description ?? 'sendMessage failed');
  }
}

export async function tgSendDocument(
  chatId: string | number,
  filename: string,
  buffer: Buffer,
  caption?: string
): Promise<void> {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption.slice(0, 1024));
  const blob = new Blob([new Uint8Array(buffer)]);
  form.append('document', blob, filename);

  const res = await fetch(`${BASE}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  const j = (await res.json()) as { ok?: boolean; description?: string };
  if (!j.ok) {
    throw new Error(j.description ?? 'sendDocument failed');
  }
}
