
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

// ─── Fallback: Gọi trực tiếp (chỉ dùng dev local) ─────────
async function directGeminiCall(action: string, payload: Record<string, any>): Promise<string> {
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  if (!apiKey) {
    return '⚠️ Chưa cấu hình AI. Deploy Edge Function hoặc thêm VITE_GOOGLE_API_KEY vào .env (chỉ dev).';
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

  return '⚠️ Action không được hỗ trợ ở chế độ fallback.';
}


// ════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════

export async function analyzeContract(text: string): Promise<string> {
  try {
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
    if (await isEdgeFunctionAvailable()) {
      const data = await callEdgeFunction('insights', { contracts });
      return data.result;
    }

    // Fallback: Trả về insights mặc định
    return [{ title: 'AI Insights chưa khả dụng', content: 'Vui lòng deploy Edge Function gemini-proxy để kích hoạt.', type: 'warning' }];
  } catch (error) {
    console.error('Insight Error:', error);
    return [];
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
    if (await isEdgeFunctionAvailable()) {
      // Gọi Edge Function với streaming
      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: {
          action: 'chat',
          history,
          newMessage,
          modelId,
          systemInstruction,
        },
      });

      if (error) throw error;

      // Nếu response là SSE text, parse nó
      if (typeof data === 'string') {
        const lines = data.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.text) yield parsed.text;
            } catch {
              // skip invalid lines
            }
          }
        }
      } else if (data?.result) {
        yield data.result;
      }
      return;
    }

    // ─── Fallback: Gọi trực tiếp (chỉ dev local) ───────────
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error('Missing API Key');

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);

    const validModelId = modelId === 'gemini-2.0-flash' ? 'gemini-2.0-flash'
      : modelId === 'gemini-1.5-pro' ? 'gemini-1.5-pro-latest'
        : modelId === 'gemini-pro' ? 'gemini-pro'
          : 'gemini-1.5-flash-latest';

    const model = genAI.getGenerativeModel({
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

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: { temperature: 0.3 },
    });

    const result = await chat.sendMessageStream(newMessage);
    for await (const chunk of result.stream) {
      if (signal?.aborted) return;
      const chunkText = chunk.text();
      if (chunkText) yield chunkText;
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
