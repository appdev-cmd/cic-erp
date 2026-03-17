
/**
 * Gemini AI Service - Secure Proxy qua Supabase Edge Functions
 * 
 * QUAN TRỌNG: API Key được giữ an toàn ở server-side (Edge Function).
 * Client chỉ gửi request qua supabase.functions.invoke().
 * 
 * Fallback: Nếu Edge Function chưa được deploy, sử dụng VITE_GOOGLE_API_KEY 
 * trực tiếp (chỉ dành cho môi trường dev local).
 */

import { supabase } from '../lib/supabase';

// ─── Helper: Gọi Edge Function an toàn ─────────────────────
async function callEdgeFunction(action: string, payload: Record<string, any>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('gemini-proxy', {
    body: { action, ...payload },
  });

  if (error) {
    console.warn(`[Gemini Proxy] Edge Function lỗi (${action}):`, error.message);
    throw new Error(error.message);
  }

  return data;
}

// ─── Helper: Lấy Custom API Key từ LocalStorage ──────────────
function getCustomGeminiKey(): string | null {
  try {
    return localStorage.getItem('cic_custom_gemini_key') || null;
  } catch {
    return null;
  }
}

// ─── Kiểm tra Edge Function có sẵn không ───────────────────
let edgeFunctionAvailable: boolean | null = null;

async function isEdgeFunctionAvailable(): Promise<boolean> {
  if (edgeFunctionAvailable !== null) return edgeFunctionAvailable;

  try {
    // Thử gọi với action không hợp lệ để kiểm tra kết nối
    await supabase.functions.invoke('gemini-proxy', {
      body: { action: 'ping' },
    });
    edgeFunctionAvailable = true;
  } catch {
    edgeFunctionAvailable = false;
  }
  return edgeFunctionAvailable;
}

// ─── Fallback/Custom: Gọi trực tiếp ─────────
async function directGeminiCall(action: string, payload: Record<string, any>, customKey?: string | null): Promise<any> {
  const apiKey = customKey || import.meta.env.VITE_GOOGLE_API_KEY;
  if (!apiKey) {
    return '⚠️ Chưa cấu hình AI. Deploy Edge Function hoặc cung cấp API Key cá nhân trong cài đặt.';
  }

  // Dynamic import để không tăng bundle khi dùng Edge Function
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  if (action === 'analyze') {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Hãy phân tích nội dung hợp đồng sau đây và tóm tắt các điểm quan trọng (Bên A, Bên B, Giá trị, Thời hạn, Rủi ro tiềm ẩn). Định dạng bằng tiếng Việt, súc tích, chuyên nghiệp:\n\n${payload.text}` }] }],
      generationConfig: { temperature: 0.2 },
    });
    return result.response.text();
  }

  if (action === 'query') {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Bạn là trợ lý quản trị cấp cao của ContractPro. Dựa trên dữ liệu hệ thống dưới đây, hãy trả lời câu hỏi chính xác, ngắn gọn.\n\nDữ liệu hệ thống: ${JSON.stringify(payload.data)}\nCâu hỏi: ${payload.query}` }] }],
      generationConfig: { temperature: 0.1 },
    });
    return result.response.text();
  }

  if (action === 'insights') {
    // Implement direct fallback for insights
    const sample = payload.contracts.sort(() => 0.5 - Math.random()).slice(0, 40);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Bạn là chuyên gia phân tích dữ liệu. Vui lòng nhận xét về tình hình kinh doanh ngắn gọn dựa trên danh sách hợp đồng sau:\n\n${JSON.stringify(sample)}\n\nOutput JSON format STRICTLY: [{"title": "Title", "content": "Content", "type": "warning|info|success"}]` }] }],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
    });
    const content = result.response.text();
    try {
      return JSON.parse(content);
    } catch {
      return [{ title: "Lỗi parsing", content: "Không thể phân tích phản hồi từ Gemini", type: "warning" }];
    }
  }

  return '⚠️ Action không được hỗ trợ ở chế độ này.';
}


// ════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════

export async function analyzeContract(text: string): Promise<string> {
  try {
    const customKey = getCustomGeminiKey();
    if (customKey) {
      return await directGeminiCall('analyze', { text }, customKey);
    }

    if (await isEdgeFunctionAvailable()) {
      const data = await callEdgeFunction('analyze', { text });
      return data.result;
    }
    return await directGeminiCall('analyze', { text });
  } catch (error) {
    console.error('Gemini Analysis Error:', error);
    return 'Không thể phân tích hợp đồng vào lúc này. Vui lòng thử lại sau.';
  }
}

export async function querySystemData(query: string, data: any): Promise<string> {
  try {
    const customKey = getCustomGeminiKey();
    if (customKey) {
      return await directGeminiCall('query', { query, data }, customKey);
    }

    if (await isEdgeFunctionAvailable()) {
      const result = await callEdgeFunction('query', { query, data });
      return result.result;
    }
    return await directGeminiCall('query', { query, data });
  } catch (error) {
    return 'Tôi đang gặp khó khăn khi kết nối với dữ liệu. Hãy thử hỏi lại nhé.';
  }
}

export async function getSmartInsights(contracts: any[]) {
  try {
    const customKey = getCustomGeminiKey();
    if (customKey) {
      return await directGeminiCall('insights', { contracts }, customKey);
    }

    if (await isEdgeFunctionAvailable()) {
      const data = await callEdgeFunction('insights', { contracts });
      return data.result;
    }

    // Fallback: Nếu không có edge function và ko có key custom
    return [{ title: 'AI Insights chưa khả dụng', content: 'Vui lòng cung cấp API Key cá nhân trong Cài đặt hoặc deploy Edge Function gemini-proxy.', type: 'warning' }];
  } catch (error) {
    console.error('Insight Error:', error);
    return [];
  }
}

/**
 * AI tự động tóm tắt nội dung hợp đồng từ danh sách sản phẩm/dịch vụ.
 * Output: 1 câu tiếng Việt ngắn gọn, VD: "Cung cấp phần mềm SACS, MOSES và STAAD.PRO của hãng BENTLEY"
 */
export async function summarizeContractContent(
  lineItems: { name: string; productName?: string; manufacturer?: string }[]
): Promise<string> {
  const descriptions = lineItems
    .filter(item => (item.name || item.productName))
    .map((item, i) => {
      const desc = item.name || item.productName || '';
      const mfr = item.manufacturer ? ` - Hãng: ${item.manufacturer}` : '';
      return `${i + 1}. ${desc}${mfr}`;
    })
    .join('\n');

  if (!descriptions) return '';

  const prompt = `Bạn là trợ lý hợp đồng của CIC (công ty phần mềm kỹ thuật).
Dưới đây là danh sách các sản phẩm/dịch vụ trong hợp đồng:
${descriptions}

Hãy tóm tắt nội dung hợp đồng trong MỘT câu ngắn gọn, chuyên nghiệp (tiếng Việt).
Chỉ nêu tên sản phẩm chính và hãng cung cấp. Không giải thích thêm. Không thêm dấu ngoặc kép.
Ví dụ: "Cung cấp phần mềm SACS, MOSES và STAAD.PRO của hãng BENTLEY"`;

  try {
    const customKey = getCustomGeminiKey();
    if (customKey) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(customKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
      });
      return result.response.text().trim().replace(/^["']|["']$/g, '');
    }

    if (await isEdgeFunctionAvailable()) {
      const data = await callEdgeFunction('summarize-contract', { text: prompt });
      return (data.result || '').trim().replace(/^["']|["']$/g, '');
    }

    // Direct fallback
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) return '';
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
    });
    return result.response.text().trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('[AI Summary] Error:', error);
    return '';
  }
}

// Enterprise AI: Chat Streaming qua Edge Function SSE
export async function* streamGeminiChat(
  history: { role: 'user' | 'model'; content: string }[],
  newMessage: string,
  modelId: string = 'gemini-1.5-flash',
  systemInstruction?: string,
  signal?: AbortSignal
) {
  try {
    // Check abort before starting
    if (signal?.aborted) return;

    const customKey = getCustomGeminiKey();
    const shouldUseEdge = !customKey && await isEdgeFunctionAvailable();

    if (shouldUseEdge) {
      // Dùng raw fetch để đọc SSE stream từ Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const edgeUrl = `${supabaseUrl}/functions/v1/gemini-proxy`;

      const response = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          action: 'chat',
          history,
          newMessage,
          modelId,
          systemInstruction,
        }),
        signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Edge Function error ${response.status}: ${errText}`);
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') && response.body) {
        // SSE streaming — đọc từng chunk
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          if (signal?.aborted) { reader.cancel(); return; }
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // giữ lại dòng chưa hoàn chỉnh

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                if (parsed.text) yield parsed.text;
              } catch { /* skip invalid JSON */ }
            }
          }
        }
      } else {
        // JSON response (non-streaming fallback)
        const data = await response.json();
        if (data?.result) yield data.result;
        else if (data?.error) throw new Error(data.error);
      }
      return;
    }

    // ─── Fallback/Custom: Gọi trực tiếp ───────────
    const apiKey = customKey || import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error('Missing API Key');

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    let validModelId = modelId;
    // Fallback security on missing
    if (!validModelId || validModelId === 'gemini-pro') validModelId = 'gemini-1.5-flash';

    let model = genAI.getGenerativeModel({
      model: validModelId,
      systemInstruction: systemInstruction || 'Bạn là Trợ lý AI Enterprise của hệ thống ContractPro. Trả lời chuyên nghiệp, ngắn gọn, Format dạng Markdown đẹp mắt.',
    });

    let validHistory = history.filter(msg => msg.content.trim() !== '');
    while (validHistory.length > 0 && validHistory[0].role !== 'user') {
      validHistory.shift();
    }

    const chatHistory = validHistory.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    let chat = model.startChat({
      history: chatHistory,
      generationConfig: { temperature: 0.3 },
    });

    try {
      const result = await chat.sendMessageStream(newMessage);
      for await (const chunk of result.stream) {
        if (signal?.aborted) return;
        const chunkText = chunk.text();
        if (chunkText) yield chunkText;
      }
    } catch (err: any) {
      if (validModelId.includes('2.0') && (String(err).includes('404') || String(err).includes('not found') || String(err).includes('not support'))) {
        // Fallback to 1.5 flash
        model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: systemInstruction || 'Bạn là Trợ lý AI Enterprise của hệ thống ContractPro.',
        });
        chat = model.startChat({
          history: chatHistory,
          generationConfig: { temperature: 0.3 },
        });
        yield "*(Hệ thống đã tự động chuyển sang Gemini 1.5 Flash do bản 2.0 chưa được cấp quyền truy cập với API Key này)*\n\n";
        const result = await chat.sendMessageStream(newMessage);
        for await (const chunk of result.stream) {
          if (signal?.aborted) return;
          const chunkText = chunk.text();
          if (chunkText) yield chunkText;
        }
      } else {
        throw err;
      }
    }

  } catch (error: any) {
    if (error?.name === 'AbortError' || signal?.aborted) return;
    console.error('Stream Error:', error);
    let errorMsg = `⚠️ Lỗi kết nối AI (${modelId}).`;
    if (String(error).includes('404')) {
      errorMsg = `⚠️ Model '${modelId}' không tìm thấy (404).`;
    } else if (String(error).includes('403')) {
      errorMsg = '⚠️ Sai API Key hoặc chưa bật quyền truy cập (403).';
    } else if (String(error).includes('429')) {
      errorMsg = '⚠️ Đã vượt quá giới hạn request. Vui lòng thử lại sau.';
    } else {
      errorMsg += `\nChi tiết: ${error.message || String(error)}`;
    }
    yield errorMsg;
  }
}
