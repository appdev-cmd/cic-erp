import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Serverless Function: /api/ai-proxy
 *
 * Proxy AI LLM calls từ browser:
 * - Nếu model bắt đầu bằng 'gemini-': Gọi Google Gemini API (qua OpenAI compatibility endpoint)
 *   hỗ trợ xoay vòng nhiều API keys (Key Rotation) từ DB hoặc env, tự động thử lại (Auto-Retry)
 *   khi bị Rate Limit hoặc lỗi Key, và cập nhật Telemetry.
 * - Các model khác: Forward → VLLM server nội bộ của công ty.
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

// Khởi tạo Supabase client với service_role key ở backend để truy xuất bảng gemini_keys bypass RLS
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

function estimateGeminiCost(model: string, promptTokens: number, completionTokens: number): number {
    const isPro = model.toLowerCase().includes('pro');
    if (isPro) {
        return (promptTokens * 1.25 + completionTokens * 5.00) / 1000000;
    }
    // Default: Gemini Flash pricing
    return (promptTokens * 0.075 + completionTokens * 0.30) / 1000000;
}

// Hàm cập nhật trạng thái key bất đồng bộ (fire-and-forget)
async function updateKeyTelemetry(
    keyId: string,
    isSuccess: boolean,
    errorMessage?: string,
    promptTokens = 0,
    completionTokens = 0,
    modelName = ''
) {
    if (!supabaseAdmin || !keyId) {
        console.warn('[ai-proxy] Cannot update telemetry: supabaseAdmin is null or keyId missing');
        return;
    }
    try {
        if (isSuccess) {
            const cost = estimateGeminiCost(modelName, promptTokens, completionTokens);
            const totalTokens = promptTokens + completionTokens;

            // Thử gọi RPC mới để cập nhật cộng dồn
            const { error: rpcErr } = await supabaseAdmin.rpc('increment_key_telemetry', {
                key_id: keyId,
                p_tokens: totalTokens,
                p_cost: cost
            });

            if (rpcErr) {
                console.warn('[ai-proxy] increment_key_telemetry RPC failed, falling back to legacy update:', rpcErr.message);
                
                // Fallback 1: Cập nhật status + last_used_at thông thường
                await supabaseAdmin
                    .from('gemini_keys')
                    .update({
                        status: 'active',
                        last_used_at: new Date().toISOString(),
                    })
                    .eq('id', keyId);
                
                // Fallback 2: Gọi RPC cũ nếu có
                await supabaseAdmin.rpc('increment_key_usage', { key_id: keyId });
            }
        } else {
            const statusType = (errorMessage?.includes('429') || errorMessage?.toLowerCase().includes('limit')) ? 'rate_limited' : 'error';
            const { error } = await supabaseAdmin
                .from('gemini_keys')
                .update({
                    status: statusType,
                    last_error_at: new Date().toISOString(),
                    error_message: (errorMessage || 'Unknown error').substring(0, 500),
                })
                .eq('id', keyId);
            
            if (error) {
                console.error('[ai-proxy] Failed to update key error telemetry:', error.message);
            } else {
                console.log(`[ai-proxy] Key ${keyId} marked as "${statusType}"`);
            }
        }
    } catch (err: any) {
        console.error('[ai-proxy] Telemetry exception:', err.message || err);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    const origin = req.headers.origin || '';
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-user-id, x-use-key-id');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const pathMatch = req.url?.match(/\/api\/ai-proxy\/(.+)/);
        const endpoint = pathMatch?.[1] || (req.query.endpoint as string) || 'chat/completions';
        
        const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const modelName = parsedBody?.model || '';
        const isStream = parsedBody?.stream === true;

        // ════════════════════════════════════════════════════════════════════════
        // PHẦN XỬ LÝ CHO GEMINI API (MÔ HÌNH DỮ LIỆU GEMINI)
        // ════════════════════════════════════════════════════════════════════════
        if (modelName.startsWith('gemini-') && req.method === 'POST') {
            // 1. Thu thập danh sách các API Keys khả dụng
            let keysSource: Array<{ id?: string; key: string; name: string }> = [];

            // Ưu tiên đọc từ database
            if (supabaseAdmin) {
                try {
                    const useKeyId = req.headers['x-use-key-id'] as string;
                    let query = supabaseAdmin.from('gemini_keys').select('id, api_key, key_name');
                    
                    if (useKeyId) {
                        query = query.eq('id', useKeyId);
                    } else {
                        query = query.eq('is_active', true).neq('status', 'error');
                    }

                    const { data, error } = await query;
                    
                    if (!error && data && data.length > 0) {
                        keysSource = data.map(item => ({
                            id: item.id,
                            key: item.api_key,
                            name: item.key_name
                        }));
                    }
                } catch (dbErr) {
                    console.error('[ai-proxy] Query gemini_keys error, fallback to env:', dbErr);
                }
            }

            // Fallback đọc từ biến môi trường nếu DB trống hoặc lỗi
            if (keysSource.length === 0) {
                const envKeysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_API_KEY || '';
                const envKeys = envKeysStr.split(',').map(k => k.trim()).filter(Boolean);
                keysSource = envKeys.map((key, index) => ({
                    key,
                    name: `Env_Key_${index + 1}`
                }));
            }

            if (keysSource.length === 0) {
                return res.status(500).json({ error: 'Không tìm thấy Gemini API Key nào trong Database hoặc Biến môi trường.' });
            }

            // Xáo trộn danh sách key ngẫu nhiên để phân phối tải (Load Balancing)
            const shuffledKeys = [...keysSource].sort(() => Math.random() - 0.5);

            let lastError: any = null;
            let successResponse: Response | null = null;
            let usedKeyInfo: { id?: string; name: string; key: string } | null = null;

            // Vòng lặp xoay vòng và thử lại (Auto-Retry)
            for (let attempt = 0; attempt < Math.min(shuffledKeys.length, 3); attempt++) {
                usedKeyInfo = shuffledKeys[attempt];
                console.log(`[ai-proxy] Attempt ${attempt + 1}: Using key "${usedKeyInfo.name}"`);

                try {
                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/openai/${endpoint}`;
                    
                    // Chuẩn bị headers cho Gemini API
                    const geminiHeaders: Record<string, string> = {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${usedKeyInfo.key}`,
                    };

                    // Google OpenAI-compatible API yêu cầu tên model phải có tiền tố 'models/' (ví dụ: models/gemini-1.5-flash)
                    const geminiBody = { ...parsedBody };
                    if (modelName && !modelName.startsWith('models/')) {
                        geminiBody.model = `models/${modelName}`;
                    }

                    const response = await fetch(geminiUrl, {
                        method: 'POST',
                        headers: geminiHeaders,
                        body: JSON.stringify(geminiBody),
                        signal: AbortSignal.timeout(50000), // 50s timeout
                    });

                    // Nếu gặp lỗi rate limit (429) hoặc lỗi auth (403, 400), ghi nhận telemetry và thử key tiếp theo
                    if (!response.ok) {
                        const errText = await response.text();
                        console.warn(`[ai-proxy] Key "${usedKeyInfo.name}" failed with status ${response.status}:`, errText.substring(0, 200));
                        
                        lastError = { status: response.status, text: errText };
                        
                        // Ghi nhận lỗi cho key này
                        if (usedKeyInfo.id) {
                            updateKeyTelemetry(usedKeyInfo.id, false, `Status ${response.status}: ${errText.substring(0, 150)}`);
                        }

                        if (response.status === 429 || response.status === 403 || response.status === 401) {
                            continue; // Thử key tiếp theo
                        } else {
                            // Lỗi logic nghiệp vụ khác thì không retry
                            successResponse = response;
                            break;
                        }
                    }

                    // Gọi thành công
                    successResponse = response;
                    lastError = null;
                    break;
                } catch (fetchErr: any) {
                    console.error(`[ai-proxy] Network error with key "${usedKeyInfo.name}":`, fetchErr);
                    lastError = fetchErr;
                    if (usedKeyInfo.id) {
                        updateKeyTelemetry(usedKeyInfo.id, false, `Network error: ${fetchErr.message || String(fetchErr)}`);
                    }
                    continue; // Thử key tiếp theo
                }
            }

            // Xử lý kết quả trả về từ Gemini
            if (successResponse && successResponse.ok) {
                // Tính toán tokens ước lượng của input từ tin nhắn gửi đi
                const inputText = parsedBody?.messages 
                    ? parsedBody.messages.map((m: any) => m.content || '').join(' ') 
                    : '';
                const estPromptTokens = Math.ceil(inputText.length / 2.5);

                if (isStream && successResponse.body) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');

                    const reader = successResponse.body.getReader();
                    const decoder = new TextDecoder();
                    let outputLength = 0;

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            const chunkText = decoder.decode(value, { stream: true });
                            outputLength += chunkText.length;
                            res.write(chunkText);
                        }
                    } catch (streamErr) {
                        console.error('[ai-proxy] Gemini stream piping error:', streamErr);
                    } finally {
                        res.end();
                        
                        // Cập nhật telemetry sau khi stream hoàn tất
                        if (usedKeyInfo && usedKeyInfo.id) {
                            const estCompletionTokens = Math.ceil(outputLength / 2.5);
                            updateKeyTelemetry(usedKeyInfo.id, true, undefined, estPromptTokens, estCompletionTokens, modelName);
                        }
                    }
                } else {
                    const data = await successResponse.json();
                    
                    // Lấy token thật từ response JSON nếu có, hoặc dùng ước lượng
                    const promptTokens = data.usage?.prompt_tokens || estPromptTokens;
                    const completionTokens = data.usage?.completion_tokens || Math.ceil((data.choices?.[0]?.message?.content || '').length / 2.5);
                    
                    if (usedKeyInfo && usedKeyInfo.id) {
                        updateKeyTelemetry(usedKeyInfo.id, true, undefined, promptTokens, completionTokens, modelName);
                    }

                    return res.status(200).json(data);
                }
                return;
            }

            // Trả về lỗi cuối cùng nếu tất cả các key đều thất bại
            const status = lastError?.status || 500;
            const message = lastError?.text || lastError?.message || 'Tất cả các Gemini API Keys trong hàng đợi đều gọi thất bại.';
            return res.status(status).json({ error: `Gemini API Error: ${message}` });
        }

        // ════════════════════════════════════════════════════════════════════════
        // PHẦN XỬ LÝ CHO VLLM LOCAL (MẶC ĐỊNH PHÁT TRIỂN CŨ)
        // ════════════════════════════════════════════════════════════════════════
        if (!VLLM_API_KEY) {
            return res.status(500).json({ error: 'VLLM_API_KEY chưa được cấu hình trên server.' });
        }

        const targetUrl = `${VLLM_BASE_URL}/${endpoint}`;
        console.log(`[ai-proxy] VLLM request: model=${parsedBody?.model || 'unknown'} → ${targetUrl}`);
        const requestBody = req.method === 'POST'
            ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
            : undefined;

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
            signal: AbortSignal.timeout(120000), // 120s — model 35B cần nhiều thời gian hơn
        });

        if (!upstreamRes.ok) {
            const errText = await upstreamRes.text();
            console.error('[ai-proxy] VLLM error:', upstreamRes.status, errText.substring(0, 300));
            return res.status(upstreamRes.status).json({
                error: `VLLM API: ${upstreamRes.status} - ${errText.substring(0, 200)}`,
            });
        }

        if (isStream && upstreamRes.body) {
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
            const data = await upstreamRes.json();
            return res.status(200).json(data);
        }
    } catch (error: any) {
        console.error('[ai-proxy] Server error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
