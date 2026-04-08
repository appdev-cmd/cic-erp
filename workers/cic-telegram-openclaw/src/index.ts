import Fastify from 'fastify';
import { config } from './config.js';
import { openclawHandleMessage } from './agent/openclawAgent.js';

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

app.post<{ Params: { secret: string }; Body: TgUpdate }>(
  '/webhook/:secret',
  async (request, reply) => {
    if (request.params.secret !== config.webhookPathSecret) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const u = request.body;
    const chatId = u.message?.chat?.id;
    const text = u.message?.text?.trim();

    if (chatId == null) {
      return reply.code(200).send({ ok: true, note: 'no chat' });
    }

    if (!text) {
      return reply.code(200).send({ ok: true });
    }

    try {
      await openclawHandleMessage(chatId, text);
    } catch (err) {
      request.log.error(err);
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

    return reply.code(200).send({ ok: true });
  }
);

const start = async () => {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Listening on :${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

void start();
