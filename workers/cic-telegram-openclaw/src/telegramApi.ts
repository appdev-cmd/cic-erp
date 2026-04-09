import { config } from './config.js';

const BASE = `https://api.telegram.org/bot${config.telegramBotToken}`;

export async function tgSendChatAction(
  chatId: string | number,
  action: 'typing' | 'upload_document' = 'typing'
): Promise<void> {
  try {
    await fetch(`${BASE}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    // Không crash process nếu Telegram API tạm thời không phản hồi
  }
}

/** Tin nhắn thường (không HTML) — dùng cho câu trả lời tự nhiên từ LLM */
export async function tgSendMessagePlain(chatId: string | number, text: string): Promise<void> {
  const body = {
    chat_id: chatId,
    text: text.slice(0, 4090),
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

export async function tgGetFileUrl(fileId: string): Promise<string> {
  const res = await fetch(`${BASE}/getFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  });
  const j = (await res.json()) as { ok: boolean; result?: { file_path: string } };
  if (!j.ok || !j.result?.file_path) {
    throw new Error('Không lấy được file_path từ Telegram API');
  }
  return `https://api.telegram.org/file/bot${config.telegramBotToken}/${j.result.file_path}`;
}
