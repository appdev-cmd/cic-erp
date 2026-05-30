import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function: /api/ai-proxy
 *
 * Proxy AI LLM calls từ browser → VLLM server nội bộ.
 * - Thêm Authorization header server-side (key không lộ ra client)
 * - Hỗ trợ cả streaming và non-streaming
 * - Forward đầy đủ request body (model, messages, tools, etc.)
 */

const VLLM_BASE_URL = (process.env.VLLM_URL && process.env.VLLM_URL !== 'undefined' && process.env.VLLM_URL.trim() !== '')
    ? process.env.VLLM_URL
    : 'https://ai-api.cic.com.vn:9443/v1';

const VLLM_API_KEY = (process.env.VLLM_API_KEY && process.env.VLLM_API_KEY !== 'undefined' && process.env.VLLM_API_KEY.trim() !== '')
    ? process.env.VLLM_API_KEY
    : (process.env.VITE_LITELLM_KEY && process.env.VITE_LITELLM_KEY !== 'undefined' && process.env.VITE_LITELLM_KEY.trim() !== '')
        ? process.env.VITE_LITELLM_KEY
        : 'sk-cic-2026';

const ALLOWED_ORIGINS = [
    'https://cic-erp.vercel.app',
    'https://erp.cic.com.vn',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    const origin = req.headers.origin || '';
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    if (!VLLM_API_KEY) {
        return res.status(500).json({ error: 'VLLM_API_KEY chưa được cấu hình trên server.' });
    }

    try {
        // Lấy endpoint từ URL path hoặc query hoặc mặc định chat/completions
        // URL có thể là /api/ai-proxy/chat/completions hoặc /api/ai-proxy?endpoint=chat/completions
        const pathMatch = req.url?.match(/\/api\/ai-proxy\/(.+)/);
        const endpoint = pathMatch?.[1] || (req.query.endpoint as string) || 'chat/completions';
        const targetUrl = `${VLLM_BASE_URL}/${endpoint}`;

        // Lấy stream flag an toàn bất kể req.body là Object hay String
        const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const isStream = parsedBody?.stream === true;

        // Tránh double-encoding JSON
        const requestBody = req.method === 'POST'
            ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
            : undefined;

        // Định nghĩa headers phong phú, hỗ trợ skip tunnel warning và track user
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${VLLM_API_KEY}`,
            'ngrok-skip-browser-warning': 'true',
        };
        if (req.headers['x-request-user-id']) {
            headers['X-Request-User-Id'] = req.headers['x-request-user-id'] as string;
        }

        const upstreamRes = await fetch(targetUrl, {
            method: req.method,
            headers,
            body: requestBody,
            signal: AbortSignal.timeout(55000), // 55s — dưới maxDuration (60s) để Vercel không giết function
        });

        if (!upstreamRes.ok) {
            const errText = await upstreamRes.text();
            console.error('[ai-proxy] VLLM error:', upstreamRes.status, errText.substring(0, 300));
            return res.status(upstreamRes.status).json({
                error: `VLLM API: ${upstreamRes.status} - ${errText.substring(0, 200)}`,
            });
        }

        if (isStream && upstreamRes.body) {
            // Streaming: pipe response trực tiếp
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const reader = upstreamRes.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(decoder.decode(value, { stream: true }));
                }
            } catch (streamErr) {
                console.error('[ai-proxy] Stream error:', streamErr);
            } finally {
                res.end();
            }
        } else {
            // Non-streaming: trả JSON bình thường
            const data = await upstreamRes.json();
            return res.status(200).json(data);
        }
    } catch (error: any) {
        console.error('[ai-proxy] Server error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
