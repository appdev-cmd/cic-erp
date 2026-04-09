import Fastify from 'fastify';
import PQueue from 'p-queue';
import { config } from './config.js';
import { openclawHandleMessage } from './agent/openclawAgent.js';
import { runDailyAlerts } from './tools/cronAlerts.js';

const app = Fastify({ logger: true });

// Bảo vệ Local LLM khỏi quá sức, đồng thời tách riêng luồng chạy để Webhook trả về 200 HTTP OK ngay cho Telegram.
const messageQueue = new PQueue({ concurrency: 2 });

/** Telegram Update — trường tối thiểu bot cần */
interface TgUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    chat?: { id?: number };
    text?: string;
    caption?: string;
    document?: {
      file_id: string;
      file_name?: string;
      mime_type?: string;
    };
  };
}

app.get('/health', async () => ({ ok: true, service: 'cic-telegram-openclaw' }));

app.post('/cron/daily-alerts', async (request, reply) => {
  if (!verifyWebhookSecret(request.headers as Record<string, string | string[] | undefined>)) {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  const sent = await runDailyAlerts();
  return reply.send({ ok: true, sent });
});

const CRON_HOUR = Number(process.env.CRON_ALERT_HOUR ?? '8');
let cronTimer: ReturnType<typeof setInterval> | null = null;

function scheduleDailyAlerts(): void {
  const checkInterval = 60_000;
  let lastRunDate = '';
  cronTimer = setInterval(async () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (now.getHours() === CRON_HOUR && lastRunDate !== today) {
      lastRunDate = today;
      try {
        const sent = await runDailyAlerts();
        app.log.info(`Daily alerts sent to ${sent} users`);
      } catch (err) {
        app.log.error(err);
      }
    }
  }, checkInterval);
}

function getHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v;
}

/** Header secret (Telegram secret_token) hoặc legacy path param */
function verifyWebhookSecret(
  headers: Record<string, string | string[] | undefined>,
  pathSecret?: string
): boolean {
  const headerSecret = getHeader(headers, 'x-telegram-bot-api-secret-token')?.trim();
  if (headerSecret && headerSecret === config.webhookSecret) return true;
  if (pathSecret && pathSecret === config.webhookSecret) return true;
  return false;
}

async function processTgUpdate(
  u: TgUpdate,
  log: { error: (e: unknown) => void }
): Promise<{ chatId?: number; ok: boolean; note?: string }> {
  const chatId = u.message?.chat?.id;
  const doc = u.message?.document;
  let text = u.message?.text?.trim() || u.message?.caption?.trim() || '';

  if (chatId == null) {
    return { ok: true, note: 'no chat' };
  }

  if (doc) {
    text += `\n[Có file đính kèm: ${doc.file_name || 'document'}]`;
    try {
      const { parseDocumentFromTelegram } = await import('./tools/documentReader.js');
      const docText = await parseDocumentFromTelegram(doc.file_id, doc.file_name || '');
      text += `\n\nNội dung file đính kèm:\n"""\n${docText.slice(0, 5000)}\n"""`;
    } catch (err: unknown) {
      log.error(`File parsing error: ${err instanceof Error ? err.message : String(err)}`);
      text += `\n[Không thể đọc nội dung file: ${err instanceof Error ? err.message : 'Unknown error'}]`;
    }
  }

  if (!text.trim()) {
    return { ok: true, chatId };
  }

  // Đưa vào hàng đợi thay vì chạy trực tiếp, bắn lỗi riêng biệt
  void messageQueue.add(async () => {
    try {
      await openclawHandleMessage(chatId, text);
    } catch (err) {
      log.error(err);
      try {
        const { tgSendMessage } = await import('./telegramApi.js');
        await tgSendMessage(
          chatId,
          'Đã xảy ra lỗi hệ thống (Queue Error). Vui lòng thử lại sau.'
        );
      } catch {
        /* ignore */
      }
    }
  });

  return { ok: true as const, chatId };
}

app.post<{ Body: TgUpdate }>('/telegram-webhook', async (request, reply) => {
  if (!verifyWebhookSecret(request.headers as Record<string, string | string[] | undefined>)) {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  const result = await processTgUpdate(request.body, request.log);
  return reply.code(200).send(result);
});

app.post<{ Params: { secret: string }; Body: TgUpdate }>(
  '/webhook/:secret',
  async (request, reply) => {
    if (
      !verifyWebhookSecret(
        request.headers as Record<string, string | string[] | undefined>,
        request.params.secret
      )
    ) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const result = await processTgUpdate(request.body, request.log);
    return reply.code(200).send(result);
  }
);

const start = async () => {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Listening on :${config.port}`);
    scheduleDailyAlerts();
    app.log.info(`Daily alerts scheduled at ${CRON_HOUR}:00`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

void start();
