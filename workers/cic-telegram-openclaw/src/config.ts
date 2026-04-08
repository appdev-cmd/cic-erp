import 'dotenv/config';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu biến môi trường bắt buộc: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? '8787'),
  webhookPathSecret: req('TELEGRAM_WEBHOOK_PATH_SECRET'),
  telegramBotToken: req('TELEGRAM_BOT_TOKEN'),
  supabaseUrl: req('SUPABASE_URL'),
  supabaseServiceRoleKey: req('SUPABASE_SERVICE_ROLE_KEY'),
  /** Ollama / tương thích OpenAI local — tắt nếu không set */
  ollamaHost: process.env.OLLAMA_HOST?.replace(/\/$/, '') ?? '',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'gemma2:2b',
  /** Giới hạn hàng RPC khi xuất báo cáo */
  reportRowCap: Math.min(Number(process.env.REPORT_ROW_CAP ?? '500'), 2000),
};

export const ollamaEnabled = Boolean(config.ollamaHost);
