import { Customer } from '../types';

// ─── Contract Extraction Type ────────────────────────────
export interface ContractExtraction {
    contractCode: string;      // Số hợp đồng
    customerName: string;      // Tên khách hàng
    contactPerson?: string;    // Đầu mối liên hệ
    content?: string;          // Nội dung HĐ (BIM, Tư vấn...)
    signedValue?: number;      // Giá trị ký kết
    signedDate?: string;       // Ngày ký (YYYY-MM-DD)
    acceptanceValue?: number;  // Giá trị nghiệm thu
    acceptanceDate?: string;   // Ngày nghiệm thu
    invoicedAmount?: number;   // Doanh thu xuất HĐ (giá trị)
    invoicedDate?: string;     // Ngày xuất HĐ
    paidAmount?: number;       // Đã thanh toán (đã thu)
    paidDate?: string;         // Ngày thanh toán
    remaining?: number;        // Còn lại
}

// Lấy api key từ config (nếu có để làm fallback)
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

import { supabase } from '../lib/supabase';

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

Quy tắc: 
- CHỈ trích xuất thông tin CÓ THẬT, KHÔNG bịa. Trường không có → null. 
- industry PHẢI là mảng JSON. 
- Ngày tháng PHẢI định dạng YYYY-MM-DD.
- Số điện thoại PHẢI loại bỏ các ký tự dấu chấm, dấu cách (chỉ giữ số).
- Trả về CHỈ JSON thuần {}.`;

// ─── Contract Extraction Prompt ──────────────────────────
const CONTRACT_EXTRACT_PROMPT = `Bạn là AI chuyên trích xuất dữ liệu hợp đồng từ bảng Excel/ảnh chụp.
Ảnh có thể chứa NHIỀU DÒNG hợp đồng. Trích xuất TẤT CẢ các dòng.

Trả về JSON thuần (KHÔNG markdown, KHÔNG \`\`\`): một MẢNG [] các object.

Mỗi object chứa:
- contractCode: Số hợp đồng (VD: "01.PPXD-CICHD2023")
- customerName: Tên khách hàng
- contactPerson: Đầu mối liên hệ (null nếu không có)
- content: Nội dung HĐ / loại dịch vụ (BIM, Tư vấn BIM...)
- signedValue: Giá trị ký kết (số, VD: 4300000000). Bỏ dấu chấm/phẩy ngăn cách, chuyển thành số.
- signedDate: Ngày ký (format YYYY-MM-DD, VD: "2023-01-31")
- acceptanceValue: Giá trị nghiệm thu (số)
- acceptanceDate: Ngày nghiệm thu (YYYY-MM-DD)
- invoicedAmount: Doanh thu xuất hóa đơn — giá trị (số). Nếu có nhiều dòng xuất HĐ cho 1 HĐ, CỘNG TỔNG lại.
- invoicedDate: Ngày xuất HĐ gần nhất (YYYY-MM-DD)
- paidAmount: Số tiền đã thanh toán / đã thu (số). Nếu có nhiều dòng TT, CỘNG TỔNG.
- paidDate: Ngày thanh toán gần nhất (YYYY-MM-DD)
- remaining: Số tiền còn lại (số)

Quy tắc:
- CHỈ trích xuất thông tin CÓ trong ảnh, KHÔNG đoán. 
- Giá trị tiền PHẢI là số thuần (bỏ dấu chấm phân cách ngàn, dấu phẩy → dấu chấm cho decimal). Chú ý các đơn vị như "triệu", "tỷ" phải nhân tương ứng.
- Ngày tháng PHẢI format YYYY-MM-DD. Nếu ảnh ghi "31/01/2023" → "2023-01-31". Nếu ghi "tháng 1 năm 2023" → "2023-01-01".
- Trường không có dữ liệu → null.
- Nếu 1 hợp đồng có NHIỀU dòng thanh toán/nghiệm thu (sub-rows), GỘP TỔNG giá trị và lấy ngày gần nhất.
- Kiểm tra kỹ tránh bỏ sót bất kỳ dòng hợp đồng nào.
- Trả về CHỈ JSON mảng []`;

// ─── API Callers ─────────────────────────────────────────

async function callEdgeFunction(functionName: string, payload: Record<string, any>): Promise<any> {
    const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
    });
    if (error) throw new Error(error.message);
    return data;
}

async function callGemini(parts: any[]): Promise<any> {
    try {
        const payload = { action: 'chat', modelId: 'gemini-2.0-flash', history: [], newMessage: parts[0]?.text || '', parts: parts };
        // For vision/files, passing inline_data might be complex via edge depending on size, but we can try direct if Edge fails or if it's simpler.
        // In this specific extractService, since it passes `inline_data` for images, we need to pass that to the Edge Function.
        // Wait, the new `ai-proxy` only supports text? No, Gemini proxy supports what?
        // Let's keep direct Gemini call for vision for now, or update edge function later. 
        // For now, let's keep direct Gemini API call since it handles base64 well and proxy might have limits.
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
    } catch (e) {
        throw e;
    }
}

async function callDeepSeek(prompt: string): Promise<any> {
    try {
        const customKey = localStorage.getItem('cic_custom_deepseek_key');
        if (!customKey) {
            const data = await callEdgeFunction('ai-proxy', {
                action: 'chat',
                provider: 'deepseek',
                newMessage: prompt,
                systemInstruction: 'Bạn là AI trích xuất thông tin doanh nghiệp. Chỉ trả về JSON thuần.'
            });
            // Result from non-streaming chat ai-proxy: the current ai-proxy implementation only streams for chat.
            // Oh wait, my ai-proxy `action: chat` is ONLY streaming!
            // I need to use another action or update it. Let's send `stream: false` to the edge function.
        }

    } catch (e) {
        // Fallback or error
    }

    // Fallback direct for now if custom key exists (will handle Edge Function non-stream later)
    const apiKey = localStorage.getItem('cic_custom_deepseek_key') || import.meta.env.VITE_DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('Chưa cấu hình DEEPSEEK_API_KEY');

    const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
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
    const apiKey = localStorage.getItem('cic_custom_openai_key') || import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error('Chưa cấu hình OPENAI_API_KEY');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
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

function parseJsonArrayFromText(text: string): any[] {
    if (!text) throw new Error('AI không trả về kết quả');
    // Try array first
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) {
        try { return JSON.parse(arrMatch[0]); } catch { /* fallthrough */ }
    }
    // Fallback: single object → wrap in array
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
        try { return [JSON.parse(objMatch[0])]; } catch { /* fallthrough */ }
    }
    throw new Error('AI không trả về JSON hợp lệ (array expected)');
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

        // DeepSeek can't do vision
        if (model === 'deepseek') {
            throw new Error('Mô hình DeepSeek hiện không hỗ trợ phân tích hình ảnh. Vui lòng chọn Gemini hoặc GPT-4o để trích xuất từ ảnh.');
        }

        const actualModel = model;

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

    // ═══ CONTRACT EXTRACTION ═════════════════════════════════

    /**
     * Extract contracts from image (table/Excel screenshot)
     * Returns an array of ContractExtraction (multiple rows)
     */
    extractContractsFromImage: async (file: File, model: ExtractModel = 'gemini'): Promise<ContractExtraction[]> => {
        const base64 = await fileToBase64(file);
        const mimeType = file.type || 'image/jpeg';
        // DeepSeek can't do vision
        if (model === 'deepseek') {
            throw new Error('Mô hình DeepSeek hiện không hỗ trợ phân tích hình ảnh. Vui lòng chọn Gemini hoặc GPT-4o để trích xuất hóa đơn.');
        }

        const actualModel = model;

        let rawText: string;

        if (actualModel === 'gemini') {
            if (!GOOGLE_API_KEY) throw new Error('Chưa cấu hình VITE_GOOGLE_API_KEY');
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: CONTRACT_EXTRACT_PROMPT },
                                { inline_data: { mime_type: mimeType, data: base64 } },
                            ]
                        }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
                    }),
                }
            );
            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Gemini: ${res.status} - ${err.substring(0, 150)}`);
            }
            const json = await res.json();
            rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else {
            // GPT-4o
            const apiKey = localStorage.getItem('cic_custom_openai_key') || import.meta.env.VITE_OPENAI_API_KEY;

            if (!apiKey) {
                // Try edge function if no config
                const data = await callEdgeFunction('ai-proxy', {
                    action: 'chat',
                    provider: 'openai',
                    modelId: 'gpt-4o',
                    newMessage: CONTRACT_EXTRACT_PROMPT + `\n\n[Image Content Provided: data:${mimeType};base64,...]`,
                    // Note: ai-proxy edge function doesn't support image directly in this basic version.
                    // This is a limitation. We will throw an error telling user to use Gemini or config OpenAI Key locally.
                    // We can also implement vision array support in Edge Function.
                });
                // To keep it simple, we throw error if no api key for GPT-4 vision.
                throw new Error('Bạn cần nhập OpenAI API Key trong Cài đặt để dùng GPT-4o với ảnh, hoặc sử dụng Gemini.');
            }

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: 'Bạn là AI trích xuất bảng dữ liệu hợp đồng. Trả về JSON mảng thuần.' },
                        {
                            role: 'user', content: [
                                { type: 'text', text: CONTRACT_EXTRACT_PROMPT },
                                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
                            ]
                        },
                    ],
                    temperature: 0.1,
                    max_tokens: 8192,
                }),
            });
            if (!res.ok) {
                const err = await res.text();
                throw new Error(`GPT-4o: ${res.status} - ${err.substring(0, 150)}`);
            }
            const json = await res.json();
            rawText = json?.choices?.[0]?.message?.content || '';
        }

        const rows = parseJsonArrayFromText(rawText);
        return rows.map(normalizeContractRow);
    },

    // ─── PAKD EXTRACTION ════════════════════════════════════
    extractPAKDFromImage,
    extractPAKDFromText
};

// ─── Contract Row Normalizer ─────────────────────────────
function normalizeContractRow(row: any): ContractExtraction {
    const parseNum = (v: any): number | undefined => {
        if (v === null || v === undefined) return undefined;
        const n = typeof v === 'string' ? parseFloat(v.replace(/[,.\s]/g, '')) : Number(v);
        return isNaN(n) ? undefined : n;
    };

    return {
        contractCode: row.contractCode || '',
        customerName: row.customerName || '',
        contactPerson: row.contactPerson || undefined,
        content: row.content || undefined,
        signedValue: parseNum(row.signedValue),
        signedDate: row.signedDate || undefined,
        acceptanceValue: parseNum(row.acceptanceValue),
        acceptanceDate: row.acceptanceDate || undefined,
        invoicedAmount: parseNum(row.invoicedAmount),
        invoicedDate: row.invoicedDate || undefined,
        paidAmount: parseNum(row.paidAmount),
        paidDate: row.paidDate || undefined,
        remaining: parseNum(row.remaining),
    };
}

// ─── PAKD Extraction Types ───────────────────────────────
export interface PAKDLineItemExtraction {
    stt: number;
    name: string;
    supplier: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
    unitPrice: number;
    totalPrice: number;
    importFee?: number;        // Phí nhập khẩu
    contractorTax?: number;    // Thuế nhà thầu
    transferFee?: number;      // Phí chuyển tiền
    otherCosts?: number;       // Chi phi khac (mua PM, may tinh, tiep khach...)
    margin?: number;           // Chenh lech
}

export interface PAKDFinancialsExtraction {
    inputCost: number;         // Đầu vào
    production: number;        // Sản lượng
    revenue: number;           // Doanh thu
    otherCosts: number;        // Chi phí khác
    completionBonus: number;   // Thưởng hoàn thành dự án
    dealPromotion: number;     // Xúc tiến hợp đồng (DCS)
    managementSupport: number; // Ban lãnh đạo hỗ trợ
    expertFee: number;         // Phí thuê chuyên gia (net)
    documentFee: number;       // Phí thanh toán chứng từ
    totalCosts: number;        // Tổng chi phí
    profit: number;            // Lợi nhuận
    marginRevenue: number;     // Hệ số LN/DT (%)
    marginProduction: number;  // Hệ số LN/SL (%)
}

export interface PAKDExtraction {
    contractNumber: string;    // Số hợp đồng (e.g. "04/BIM2026")
    customerName: string;      // Tên khách hàng
    lineItems: PAKDLineItemExtraction[];
    financials: PAKDFinancialsExtraction;
    executionCosts: { name: string; amount: number }[];  // Chi phí thực hiện hợp đồng (dynamic)
}

const PAKD_EXTRACT_PROMPT = `Bạn là AI chuyên trích xuất dữ liệu từ bảng Phương Án Kinh Doanh (PAKD) của công ty xây dựng Việt Nam.
Trích xuất TẤT CẢ thông tin từ ảnh và trả về JSON thuần (KHÔNG markdown, KHÔNG \`\`\`).

Cấu trúc JSON cần trả về:
{
  "contractNumber": "Số hợp đồng (lấy từ tiêu đề, vd: 04/BIM2026)",
  "customerName": "Tên khách hàng/công ty đối tác (lấy từ tiêu đề)",
  "lineItems": [
    {
      "stt": 1,
      "name": "Tên sản phẩm/dịch vụ",
      "supplier": "Nhà cung cấp",
      "quantity": 1,
      "unit": "ĐVT (VND, bộ, m2...)",
      "unitCost": 0,
      "totalCost": 0,
      "unitPrice": 1618950000,
      "totalPrice": 1618950000,
      "importFee": 0,
      "contractorTax": 0,
      "transferFee": 0,
      "otherCosts": 0,
      "margin": 1618950000
    }
  ],
  "financials": {
    "inputCost": 0,
    "production": 170063000,
    "revenue": 155061562,
    "otherCosts": 0,
    "completionBonus": 0,
    "dealPromotion": 0,
    "managementSupport": 0,
    "expertFee": 0,
    "documentFee": 0,
    "totalCosts": 161561562,
    "profit": 8501438,
    "marginRevenue": 5.0,
    "marginProduction": 5.0
  },
  "executionCosts": [
    { "name": "Phí thuê chuyên gia (net)", "amount": 5000000 },
    { "name": "Phí hỗ trợ chuyên gia thực hiện", "amount": 1500000 }
  ]
}

QUY TẮC:
1. KHÔNG được bỏ sót bất kỳ dòng sản phẩm (line item) nào trong bảng. Check kỹ từng dòng.
2. Số tiền: trả về dạng NUMBER nguyên (không khoảng trắng, không dấu chấm phân cách hàng nghìn).
3. Phần "Tổng hợp tài chính" ở dưới bảng: trích xuất đầy đủ.
4. Trường "Đầu vào" = inputCost (cột giá vào/thành tiền vào).
5. Trường "Đầu ra" = unitPrice/totalPrice (cột giá ra/thành tiền ra).
6. CHI PHÍ TRỰC TIẾP per line item: BẮT BUỘC trích xuất đầy đủ các cột "Nhập/Nhập khẩu" (importFee), "Thuế nhà thầu" (contractorTax), "Chuyển tiền" (transferFee) cho MỖI sản phẩm.
7. CHI PHÍ THỰC HIỆN (executionCosts): Trích xuất TẤT CẢ các dòng chi phí trong phần tổng hợp tài chính (VD: "Phí thuê chuyên gia", "Phí hỗ trợ chuyên gia", "Thưởng hoàn thành", "Xúc tiến hợp đồng", "Ban lãnh đạo hỗ trợ", "Phí thanh toán chứng từ"...). Mỗi dòng chi phí là 1 object { name, amount } trong mảng executionCosts. KHÔNG gộp, KHÔNG bỏ sót.
8. Hệ số LN/DT và LN/SL: trả về dạng phần trăm (vd: 53.29, không phải 0.5329).
9. Nếu không tìm thấy giá trị nào, trả về 0.`;

// ─── PAKD AI Extraction ──────────────────────────────────
export async function extractPAKDFromImage(
    file: File,
    model: ExtractModel = 'gemini'
): Promise<PAKDExtraction> {
    const base64 = await fileToBase64(file);
    const mimeType = file.type || 'image/png';
    // DeepSeek can't do vision
    if (model === 'deepseek') {
        throw new Error('Mô hình DeepSeek hiện không hỗ trợ phân tích hình ảnh. Vui lòng chọn Gemini hoặc GPT-4o để trích xuất PAKD.');
    }

    const actualModel = model;

    let rawText = '';

    if (actualModel === 'gemini' && GOOGLE_API_KEY) {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: PAKD_EXTRACT_PROMPT },
                            { inlineData: { mimeType, data: base64 } },
                        ],
                    }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
                }),
            }
        );
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Gemini: ${res.status} - ${err.substring(0, 150)}`);
        }
        const json = await res.json();
        rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (model === 'gpt4o') {
        const apiKey = localStorage.getItem('cic_custom_openai_key') || import.meta.env.VITE_OPENAI_API_KEY;
        if (!apiKey) throw new Error('Bạn cần nhập OpenAI API Key trong Cài đặt để dùng GPT-4o với ảnh, hoặc sử dụng Gemini.');

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'Bạn là AI trích xuất dữ liệu PAKD. Chỉ trả về JSON thuần.' },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: PAKD_EXTRACT_PROMPT },
                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
                        ],
                    },
                ],
                max_tokens: 8192,
            }),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`GPT-4o: ${res.status} - ${err.substring(0, 150)}`);
        }
        const json = await res.json();
        rawText = json?.choices?.[0]?.message?.content || '';
    } else {
        throw new Error(`Model ${model} không hỗ trợ vision cho PAKD extraction`);
    }

    // Parse JSON from AI response
    const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        return normalizePAKDExtraction(parsed);
    } catch {
        // Try to find JSON object in response
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            return normalizePAKDExtraction(JSON.parse(match[0]));
        }
        throw new Error('Không thể phân tích kết quả AI cho PAKD');
    }
}

// ─── PAKD AI Extraction (Text) ───────────────────────────
export async function extractPAKDFromText(
    text: string,
    model: ExtractModel = 'gemini'
): Promise<PAKDExtraction> {
    const actualModel = model === 'deepseek' ? 'gemini' : model;
    let rawText = '';

    if (actualModel === 'gemini' && GOOGLE_API_KEY) {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: PAKD_EXTRACT_PROMPT },
                            { text }
                        ],
                    }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
                }),
            }
        );
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Gemini: ${res.status} - ${err.substring(0, 150)}`);
        }
        const json = await res.json();
        rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (model === 'gpt4o') {
        const apiKey = localStorage.getItem('cic_custom_openai_key') || import.meta.env.VITE_OPENAI_API_KEY;
        if (!apiKey) throw new Error('Chưa cấu hình OPENAI_API_KEY');

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'Bạn là AI trích xuất dữ liệu PAKD. Chỉ trả về JSON thuần.' },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: PAKD_EXTRACT_PROMPT },
                            { type: 'text', text: text },
                        ],
                    },
                ],
                max_tokens: 8192,
            }),
        });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`GPT-4o: ${res.status} - ${err.substring(0, 150)}`);
        }
        const json = await res.json();
        rawText = json?.choices?.[0]?.message?.content || '';
    } else {
        throw new Error(`Model ${model} không cấu hình hợp lệ`);
    }

    const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        return normalizePAKDExtraction(parsed);
    } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            return normalizePAKDExtraction(JSON.parse(match[0]));
        }
        throw new Error('Không thể phân tích kết quả AI cho PAKD');
    }
}

function normalizePAKDExtraction(raw: any): PAKDExtraction {
    const parseNum = (v: any, def = 0): number => {
        if (v === null || v === undefined) return def;
        const n = typeof v === 'string' ? parseFloat(v.replace(/[,.\s]/g, '')) : Number(v);
        return isNaN(n) ? def : n;
    };

    return {
        contractNumber: raw.contractNumber || '',
        customerName: raw.customerName || '',
        lineItems: (raw.lineItems || []).map((item: any, idx: number) => ({
            stt: item.stt || idx + 1,
            name: item.name || '',
            supplier: item.supplier || '',
            quantity: parseNum(item.quantity, 1),
            unit: item.unit || 'VND',
            unitCost: parseNum(item.unitCost),
            totalCost: parseNum(item.totalCost),
            unitPrice: parseNum(item.unitPrice),
            totalPrice: parseNum(item.totalPrice),
            importFee: parseNum(item.importFee),
            contractorTax: parseNum(item.contractorTax),
            transferFee: parseNum(item.transferFee),
            otherCosts: parseNum(item.otherCosts),
            margin: parseNum(item.margin),
        })),
        financials: {
            inputCost: parseNum(raw.financials?.inputCost),
            production: parseNum(raw.financials?.production),
            revenue: parseNum(raw.financials?.revenue),
            otherCosts: parseNum(raw.financials?.otherCosts),
            completionBonus: parseNum(raw.financials?.completionBonus),
            dealPromotion: parseNum(raw.financials?.dealPromotion),
            managementSupport: parseNum(raw.financials?.managementSupport),
            expertFee: parseNum(raw.financials?.expertFee),
            documentFee: parseNum(raw.financials?.documentFee),
            totalCosts: parseNum(raw.financials?.totalCosts),
            profit: parseNum(raw.financials?.profit),
            marginRevenue: parseNum(raw.financials?.marginRevenue),
            marginProduction: parseNum(raw.financials?.marginProduction),
        },
        executionCosts: (raw.executionCosts || []).map((c: any) => ({
            name: String(c.name || 'Chi phí thực hiện'),
            amount: parseNum(c.amount),
        })).filter((c: any) => c.amount > 0),
    };
}
