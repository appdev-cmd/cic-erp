import { Customer } from '../types';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// ─── Model Definitions ──────────────────────────────────
export type ExtractModel = 'deepseek' | 'gemini' | 'gpt4o';

export const EXTRACT_MODELS: Record<ExtractModel, { label: string; emoji: string; supportsVision: boolean }> = {
    deepseek: { label: 'DeepSeek R1', emoji: '🤔', supportsVision: false },
    gemini: { label: 'Gemini 2.0 Flash', emoji: '✨', supportsVision: true },
    gpt4o: { label: 'GPT-4o', emoji: '🤖', supportsVision: true },
};

// ─── Extraction Prompt ───────────────────────────────────
const EXTRACT_PROMPT = `Bạn là AI chuyên trích xuất thông tin doanh nghiệp Việt Nam.
Trích xuất TẤT CẢ thông tin có thể tìm thấy và trả về JSON thuần (KHÔNG markdown, KHÔNG \`\`\`).

Các trường cần trích xuất:
- name: Tên công ty đầy đủ
- shortName: Tên viết tắt
- internationalName: Tên quốc tế (tiếng Anh)
- taxCode: Mã số thuế
- address: Địa chỉ
- phone: Số điện thoại
- email: Email
- website: Website
- contactPerson: Người liên hệ chính
- representative: Người đại diện pháp luật
- industry: Ngành nghề (mảng JSON, ví dụ: ["Xây dựng", "BĐS"])
- foundedDate: Ngày hoạt động (YYYY-MM-DD)
- businessType: Loại hình DN (Công ty cổ phần, TNHH...)
- businessStatus: Tình trạng (Đang hoạt động...)
- bankName: Tên ngân hàng
- bankBranch: Chi nhánh NH
- bankAccount: Số TK ngân hàng

Quy tắc: CHỈ trích xuất thông tin CÓ THẬT, KHÔNG bịa. Trường không có → null. industry PHẢI là mảng JSON. Trả về CHỈ JSON thuần {}.`;

// ─── API Callers ─────────────────────────────────────────

async function callGemini(parts: any[]): Promise<any> {
    if (!GOOGLE_API_KEY) throw new Error('Chưa cấu hình VITE_GOOGLE_API_KEY');

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
            }),
        }
    );
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini: ${res.status} - ${err.substring(0, 150)}`);
    }
    const json = await res.json();
    return parseJsonFromText(json?.candidates?.[0]?.content?.parts?.[0]?.text || '');
}

async function callDeepSeek(prompt: string): Promise<any> {
    if (!DEEPSEEK_API_KEY) throw new Error('Chưa cấu hình VITE_DEEPSEEK_API_KEY');

    const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: 'Bạn là AI trích xuất thông tin doanh nghiệp. Chỉ trả về JSON thuần.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 2048,
        }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`DeepSeek: ${res.status} - ${err.substring(0, 150)}`);
    }
    const json = await res.json();
    return parseJsonFromText(json?.choices?.[0]?.message?.content || '');
}

async function callGPT4o(messages: any[]): Promise<any> {
    if (!OPENAI_API_KEY) throw new Error('Chưa cấu hình VITE_OPENAI_API_KEY');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages,
            temperature: 0.1,
            max_tokens: 2048,
        }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`GPT-4o: ${res.status} - ${err.substring(0, 150)}`);
    }
    const json = await res.json();
    return parseJsonFromText(json?.choices?.[0]?.message?.content || '');
}

// ─── Helpers ─────────────────────────────────────────────

function parseJsonFromText(text: string): any {
    if (!text) throw new Error('AI không trả về kết quả');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI không trả về JSON hợp lệ');
    try {
        return JSON.parse(match[0]);
    } catch {
        throw new Error('Lỗi parse JSON từ AI');
    }
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function normalizeCustomerData(data: any): Partial<Customer> {
    let industry = data.industry;
    if (typeof industry === 'string') {
        try { industry = JSON.parse(industry); } catch { industry = [industry]; }
    }
    if (!Array.isArray(industry)) industry = industry ? [industry] : [];

    return {
        name: data.name || '',
        shortName: data.shortName || '',
        internationalName: data.internationalName || null,
        taxCode: data.taxCode || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || null,
        contactPerson: data.contactPerson || '',
        representative: data.representative || null,
        industry,
        foundedDate: data.foundedDate || null,
        businessType: data.businessType || null,
        businessStatus: data.businessStatus || null,
        bankName: data.bankName || null,
        bankBranch: data.bankBranch || null,
        bankAccount: data.bankAccount || null,
    };
}

// ═══ Exported Service ════════════════════════════════════

export const AIExtractService = {
    /**
     * Extract from image file
     * Note: DeepSeek không hỗ trợ ảnh → auto fallback Gemini hoặc GPT-4o
     */
    extractFromImage: async (file: File, model: ExtractModel = 'gemini'): Promise<Partial<Customer>> => {
        const base64 = await fileToBase64(file);
        const mimeType = file.type || 'image/jpeg';

        // DeepSeek can't do vision → fallback to Gemini
        const actualModel = model === 'deepseek' ? 'gemini' : model;

        let data: any;

        if (actualModel === 'gemini') {
            data = await callGemini([
                { text: EXTRACT_PROMPT },
                { inline_data: { mime_type: mimeType, data: base64 } },
            ]);
        } else {
            // GPT-4o with vision
            data = await callGPT4o([
                { role: 'system', content: 'Bạn là AI trích xuất thông tin doanh nghiệp. Chỉ trả về JSON thuần.' },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: EXTRACT_PROMPT },
                        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
                    ],
                },
            ]);
        }

        return normalizeCustomerData(data);
    },

    /**
     * Extract from URL — Bước 1: fetch nội dung thật từ trang web, Bước 2: gửi cho AI phân tích
     */
    extractFromURL: async (url: string, model: ExtractModel = 'deepseek'): Promise<Partial<Customer>> => {
        // STEP 1: Fetch real page content via Edge Function proxy (bypass CORS)
        let pageText = '';
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

        try {
            const proxyRes = await fetch(`${SUPABASE_URL}/functions/v1/fetch-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            const proxyJson = await proxyRes.json();
            console.log('[AIExtract] Proxy response:', {
                ok: proxyRes.ok,
                status: proxyRes.status,
                source: proxyJson.source,
                textLength: proxyJson.text?.length,
                warning: proxyJson.warning,
            });
            if (proxyJson.success && proxyJson.text) {
                pageText = proxyJson.text;
                if (proxyJson.warning) {
                    console.warn('[AIExtract] Warning:', proxyJson.warning);
                }
            }
        } catch (fetchErr) {
            console.warn('[AIExtract] Proxy fetch failed:', fetchErr);
        }

        // If fetch failed, include URL in prompt so AI can infer from URL pattern
        const dataSection = pageText
            ? `\n\nDữ liệu THẬT từ trang web (${url}):\n${pageText}`
            : `\n\nURL: ${url}\nKhông fetch được nội dung. Hãy phân tích URL pattern để suy ra thông tin.`;

        const prompt = EXTRACT_PROMPT +
            `\n\nQUAN TRỌNG: CHỈ trích xuất thông tin từ dữ liệu bên dưới. KHÔNG dùng kiến thức cũ hay đoán.` +
            dataSection;

        // STEP 2: Send fetched text to selected AI model
        let data: any;

        if (model === 'deepseek') {
            data = await callDeepSeek(prompt);
        } else if (model === 'gemini') {
            data = await callGemini([{ text: prompt }]);
        } else {
            data = await callGPT4o([
                { role: 'system', content: 'Bạn là AI trích xuất thông tin doanh nghiệp. CHỈ dùng dữ liệu được cung cấp. KHÔNG đoán.' },
                { role: 'user', content: prompt },
            ]);
        }

        return normalizeCustomerData(data);
    },

    /**
     * Extract from pasted text
     */
    extractFromText: async (textContent: string, model: ExtractModel = 'deepseek'): Promise<Partial<Customer>> => {
        const prompt = EXTRACT_PROMPT + `\n\nDữ liệu cần trích xuất:\n${textContent}`;

        let data: any;

        if (model === 'deepseek') {
            data = await callDeepSeek(prompt);
        } else if (model === 'gemini') {
            data = await callGemini([{ text: prompt }]);
        } else {
            data = await callGPT4o([
                { role: 'system', content: 'Bạn là AI trích xuất thông tin doanh nghiệp. Chỉ trả về JSON thuần.' },
                { role: 'user', content: prompt },
            ]);
        }

        return normalizeCustomerData(data);
    },
};
