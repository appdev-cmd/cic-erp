import Fastify from 'fastify';
import { config } from './config.js';
import { openclawHandleMessage } from './agent/openclawAgent.js';
import { runDailyAlerts } from './tools/cronAlerts.js';

const app = Fastify({ logger: true });

/** Telegram Update — trường tối thiểu bot cần */
interface TgUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    chat?: { id?: number };
    text?: string;
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
  const text = u.message?.text?.trim();

  if (chatId == null) {
    return { ok: true, note: 'no chat' };
  }

  if (!text) {
    return { ok: true, chatId };
  }

  try {
    await openclawHandleMessage(chatId, text);
  } catch (err) {
    log.error(err);
    try {
      const { tgSendMessage } = await import('./telegramApi.js');
      await tgSendMessage(
        chatId,
        'Đã xảy ra lỗi xử lý. Vui lòng thử lại sau hoặc liên hệ IT.'
      );
    } catch {
      /* ignore */
    }
  }

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
