/**
 * AI Gateway — Cổng vào duy nhất cho tất cả AI calls
 * ====================================================
 * 
 * Hợp nhất logic từ: geminiService.ts + openaiService.ts + aiService.ts
 * 
 * Chức năng:
 * - Unified LLM caller (local vLLM + Gemini + OpenAI + DeepSeek)
 * - Streaming chat
 * - Embedding generation
 * - Automatic fallback khi model down
 * - Request logging → Supabase ai_logs
 * - Rate limiting per user
 * - Cost tracking
 * 
 * KHÔNG có logic agent — chỉ là "ống dẫn" đến LLM.
 */

import { supabase } from '../../lib/supabase';
import { detectProvider, getFallbackModel, estimateCost } from './models';
import type { AIProvider, ChatRequest, AILogEntry, GatewayConfig } from './types';

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

function getConfig(): GatewayConfig {
  return {
    localBaseURL: getLocalAIBaseURL(),
    localApiKey: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LITELLM_KEY) || 'sk-cic-2026',
    defaultModel: 'gemma-4-26b',   // LiteLLM model alias — Gemma 4 26B
    maxRetries: 2,
    timeoutMs: 120000,
    enableLogging: true,
  };
}

// ─── LocalStorage helpers ────────────────────
function getLocalAIBaseURL(model?: string): string {
  const isGemma = model ? model.toLowerCase().includes('gemma') : false;

  try {
    if (typeof window !== 'undefined') {
      // Ưu tiên localStorage override (user có thể set từ Personal Settings)
      const stored = localStorage.getItem('cic_local_ai_base_url');
      if (stored && (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|ai-api\.cic\.com\.vn|118\.70\.182\.173)/.test(stored) || stored.startsWith('/api/'))) {
        if (stored.startsWith('/api/')) {
          return isGemma ? '/api/vllm_gemma' : '/api/vllm';
        }
        // URL tường minh → vẫn dùng proxy path tương ứng để tránh CORS
        return isGemma ? '/api/vllm_gemma' : '/api/vllm';
      }
      // Mặc định: luôn dùng Vite proxy path (tránh CORS/SSL khi gọi trực tiếp từ browser)
      return isGemma ? '/api/vllm_gemma' : '/api/vllm';
    }
    // Server-side / Node: gọi trực tiếp
    return process.env.LOCAL_AI_BASE_URL || 'http://localhost:4000/v1';
  } catch {
    return '/api/vllm';
  }
}

function getCustomKey(provider: AIProvider): string | null {
  try {
    const keyMap: Record<string, string> = {
      gemini: 'cic_custom_gemini_key',
      openai: 'cic_custom_openai_key',
      deepseek: 'cic_custom_deepseek_key',
    };
    const storageKey = keyMap[provider];
    return (storageKey && typeof window !== 'undefined') ? localStorage.getItem(storageKey) || null : null;
  } catch { return null; }
}

function getEnvKey(provider: AIProvider): string {
  const envMap: Record<string, string> = {
    gemini: 'GOOGLE_API_KEY',
    openai: 'OPENAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
  };
  const keyName = envMap[provider] || '';
  const vitePrefix = 'VITE_' + keyName;

  // Try Vite config first
  try {
    if (typeof (import.meta as any).env !== 'undefined') {
      const val = (import.meta as any).env[vitePrefix] || (import.meta as any).env[keyName];
      if (val) return val;
    }
  } catch { }

  // Try Node process process.env second
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[vitePrefix] || process.env[keyName] || '';
    }
  } catch { }

  return '';
}

// ─── Edge Function availability ──────────────
const edgeFnStatus: Record<string, boolean | null> = {};

async function isEdgeFunctionAvailable(fnName: string): Promise<boolean> {
  if (edgeFnStatus[fnName] !== undefined && edgeFnStatus[fnName] !== null) {
    return edgeFnStatus[fnName]!;
  }
  try {
    await supabase.functions.invoke(fnName, { body: { action: 'ping' } });
    edgeFnStatus[fnName] = true;
  } catch {
    edgeFnStatus[fnName] = false;
  }
  return edgeFnStatus[fnName]!;
}

// ═══════════════════════════════════════
// AI LOG — Observability
// ═══════════════════════════════════════

async function logAICall(entry: AILogEntry): Promise<void> {
  if (!getConfig().enableLogging) return;
  try {
    await supabase.from('ai_logs').insert({
      user_id: entry.user_id || null,
      session_id: entry.session_id || null,
      agent_id: entry.agent_id || null,
      model_id: entry.model_id,
      provider: entry.provider,
      action_type: entry.action_type,
      source: entry.source,
      prompt_tokens: entry.prompt_tokens || 0,
      completion_tokens: entry.completion_tokens || 0,
      total_cost_usd: entry.total_cost_usd || 0,
      latency_ms: entry.latency_ms || 0,
      success: entry.success,
      error_message: entry.error_message || null,
      input_preview: entry.input_preview?.substring(0, 300) || null,
      output_preview: entry.output_preview?.substring(0, 300) || null,
      metadata: entry.metadata || {},
    }).throwOnError();
  } catch (err) {
    // Fire-and-forget: NEVER let logging break the app
    console.warn('[AI Gateway] Log failed:', err);
  }
}

// ═══════════════════════════════════════
// STREAMING CHAT — Core
// ═══════════════════════════════════════

/**
 * Unified streaming chat — thay thế streamEnterpriseAI, streamGeminiChat, streamOpenAIChat
 */
export async function* streamChat(request: ChatRequest): AsyncGenerator<string> {
  const startTime = Date.now();
  const provider = detectProvider(request.model);
  let outputBuffer = '';
  let success = true;
  let errorMsg = '';

  // Helper: wrap a sub-generator while collecting output
  async function* collectAndYield(gen: AsyncGenerator<string>): AsyncGenerator<string> {
    for await (const chunk of gen) {
      outputBuffer += chunk;
      yield chunk;
    }
  }

  try {
    if (request.signal?.aborted) return;

    // Route to correct provider — use collectAndYield to intercept chunks for logging
    switch (provider) {
      case 'gemini':
        yield* collectAndYield(streamGemini(request));
        break;
      case 'local':
        yield* collectAndYield(streamOpenAICompatible(request, 'local'));
        break;
      case 'openai':
        yield* collectAndYield(streamOpenAICompatible(request, 'openai'));
        break;
      case 'deepseek': {
        let apiModelId = request.model;
        if (apiModelId === 'deepseek-r1') apiModelId = 'deepseek-reasoner';
        yield* collectAndYield(streamOpenAICompatible({ ...request, model: apiModelId }, 'deepseek'));
        break;
      }
      default:
        yield* collectAndYield(streamOpenAICompatible(request, 'local'));
    }
  } catch (error: any) {
    if (error?.name === 'AbortError' || request.signal?.aborted) return;

    success = false;
    errorMsg = error?.message || String(error);

    // Try fallback model
    const fallback = getFallbackModel(provider);
    if (fallback && !request.meta?.isFallback) {
      const fallbackMsg = `\n\n*(Chuyển sang ${fallback.name} do lỗi kết nối ${request.model})*\n\n`;
      outputBuffer += fallbackMsg;
      yield fallbackMsg;
      try {
        const fallbackMeta = { ...(request.meta || {}), isFallback: true };
        yield* collectAndYield(streamChat({ ...request, model: fallback.id, meta: fallbackMeta }) as any);
        return;
      } catch {
        // Fallback also failed
      }
    }

    const errMsg = formatError(request.model, error);
    outputBuffer += errMsg;
    yield errMsg;
  } finally {
    const latencyMs = Date.now() - startTime;
    // Vietnamese text averages ~2.5 chars per token (more accurate than the generic 4)
    const inputText = request.messages.map(m => m.content).join(' ');
    const estimatedPromptTokens = Math.ceil(inputText.length / 2.5);
    const estimatedCompletionTokens = Math.ceil(outputBuffer.length / 2.5);

    // Async log (fire-and-forget)
    logAICall({
      user_id: request.meta?.userId,
      session_id: request.meta?.sessionId,
      agent_id: request.meta?.agentId,
      model_id: request.model,
      provider,
      action_type: 'chat',
      source: request.meta?.source || 'web-chat',
      prompt_tokens: estimatedPromptTokens,
      completion_tokens: estimatedCompletionTokens,
      total_cost_usd: estimateCost(request.model, estimatedPromptTokens, estimatedCompletionTokens),
      latency_ms: latencyMs,
      success,
      error_message: errorMsg || undefined,
      input_preview: request.messages[request.messages.length - 1]?.content,
      output_preview: outputBuffer.substring(0, 500),
    });
  }
}


// ═══════════════════════════════════════
// GEMINI STREAMING
// ═══════════════════════════════════════

async function* streamGemini(request: ChatRequest): AsyncGenerator<string> {
  const customKey = getCustomKey('gemini');
  const envKey = getEnvKey('gemini');
  const apiKey = customKey || envKey;

  // Ưu tiên: nếu có key (custom hoặc env) → dùng Direct API ngay
  // Edge Function chỉ dùng khi không có key nào trong local env
  if (!apiKey) {
    const shouldUseEdge = await isEdgeFunctionAvailable('gemini-proxy');
    if (shouldUseEdge) {
      yield* streamGeminiViaEdge(request);
      return;
    }
    throw new Error('Thiếu Gemini API Key. Vào ⚙️ Settings → nhập Gemini API Key hoặc tạo tại aistudio.google.com/app/apikey');
  }


  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);

  let validModelId = request.model;
  if (!validModelId || validModelId === 'gemini-pro') validModelId = 'gemini-1.5-flash';

  const model = genAI.getGenerativeModel({
    model: validModelId,
    systemInstruction: request.systemInstruction ||
      'Bạn là Trợ lý AI Enterprise của hệ thống CIC ERP. Trả lời chuyên nghiệp, ngắn gọn, Format dạng Markdown đẹp mắt.',
  });

  // Build history (exclude system messages, ensure starts with user)
  let validHistory = request.messages
    .filter(msg => msg.role !== 'system' && msg.content.trim() !== '')
    .slice(0, -1); // Remove last message (will be sent as newMessage)
  while (validHistory.length > 0 && validHistory[0].role !== 'user') {
    validHistory.shift();
  }

  const chatHistory = validHistory.map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const lastMessage = request.messages[request.messages.length - 1]?.content || '';

  const chat = model.startChat({
    history: chatHistory,
    generationConfig: { temperature: request.temperature ?? 0.3 },
  });

  try {
    const result = await chat.sendMessageStream(lastMessage);
    for await (const chunk of result.stream) {
      if (request.signal?.aborted) return;
      const text = chunk.text();
      if (text) yield text;
    }
  } catch (err: any) {
    // Auto-fallback gemini-2.0 → 1.5
    if (validModelId.includes('2.0') && (String(err).includes('404') || String(err).includes('not found'))) {
      const fallbackModel = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: request.systemInstruction || 'Bạn là Trợ lý AI Enterprise của CIC ERP.',
      });
      const fallbackChat = fallbackModel.startChat({
        history: chatHistory,
        generationConfig: { temperature: request.temperature ?? 0.3 },
      });
      yield '*(Chuyển sang Gemini 1.5 Flash)*\n\n';
      const result = await fallbackChat.sendMessageStream(lastMessage);
      for await (const chunk of result.stream) {
        if (request.signal?.aborted) return;
        const text = chunk.text();
        if (text) yield text;
      }
    } else {
      throw err;
    }
  }
}

async function* streamGeminiViaEdge(request: ChatRequest): AsyncGenerator<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const edgeUrl = `${supabaseUrl}/functions/v1/gemini-proxy`;

  const lastMessage = request.messages[request.messages.length - 1]?.content || '';
  const history = request.messages.slice(0, -1)
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

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
      newMessage: lastMessage,
      modelId: request.model,
      systemInstruction: request.systemInstruction,
    }),
    signal: request.signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Edge Function error ${response.status}: ${errText}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text/event-stream') && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      if (request.signal?.aborted) { reader.cancel(); return; }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.text) yield parsed.text;
          } catch { /* skip */ }
        }
      }
    }
  } else {
    const data = await response.json();
    if (data?.result) yield data.result;
    else if (data?.error) throw new Error(data.error);
  }
}

// ═══════════════════════════════════════
// OPENAI-COMPATIBLE STREAMING (OpenAI, DeepSeek, Local vLLM/Ollama)
// ═══════════════════════════════════════

async function* streamOpenAICompatible(
  request: ChatRequest,
  provider: 'openai' | 'deepseek' | 'local'
): AsyncGenerator<string> {
  const { default: OpenAI } = await import('openai');
  const config = getConfig();

  let client: InstanceType<typeof OpenAI>;

  if (provider === 'local') {
    client = new OpenAI({
      // Truyền model để Gemma được route đúng sang /api/vllm_gemma
      baseURL: getLocalAIBaseURL(request.model),
      apiKey: config.localApiKey,
      dangerouslyAllowBrowser: true,
      defaultHeaders: request.meta?.userId ? { 'X-Request-User-Id': request.meta.userId } : undefined,
    });
  } else if (provider === 'openai') {
    const apiKey = getCustomKey('openai') || getEnvKey('openai');
    if (!apiKey) throw new Error('Missing OpenAI API Key. Cấu hình trong Cài đặt.');
    client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  } else {
    const apiKey = getCustomKey('deepseek') || getEnvKey('deepseek');
    if (!apiKey) throw new Error('Missing DeepSeek API Key. Cấu hình trong Cài đặt.');
    client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  // Build messages array
  const messages: any[] = [];
  // Only Gemma needs system→user workaround; Qwen supports system role natively
  const needsSysWorkaround = request.model?.toLowerCase().includes('gemma');
  if (request.systemInstruction) {
    const sysRole = needsSysWorkaround ? 'user' : 'system';
    const sysContent = needsSysWorkaround
      ? `[HỆ THỐNG - CHỈ DẪN]\n${request.systemInstruction}\n\n(Hãy tuân thủ chỉ dẫn trên khi trả lời)`
      : request.systemInstruction;
    messages.push({ role: sysRole, content: sysContent });
  }
  for (const msg of request.messages) {
    let role = msg.role === 'model' ? 'assistant' : msg.role;
    let content = msg.content;
    // Convert system → user only for Gemma
    if (role === 'system' && needsSysWorkaround) {
      role = 'user';
      content = `[HỆ THỐNG - CHỈ DẪN]\n${content}`;
    }
    messages.push({ role, content });
  }

  const isReasoner = request.model.includes('reasoner');

  const stream = await client.chat.completions.create({
    model: request.model,
    messages,
    stream: true,
    temperature: isReasoner ? undefined : (request.temperature ?? 0.7),
    max_tokens: provider === 'local' ? Math.min(request.maxTokens || 4096, 8000) : request.maxTokens,
  });

  let buffer = '';
  for await (const chunk of stream) {
    if (request.signal?.aborted) {
      stream.controller.abort();
      return;
    }
    const content = chunk.choices[0]?.delta?.content || '';
    if (!content) continue;

    buffer += content;

    while (buffer.length > 0) {
      const startIdx = buffer.indexOf('<|tool');
      if (startIdx === -1) {
        // No start tag found. Check for partial tags at the end.
        let matchPartial = false;
        const openTag = '<|tool_call|>';
        for (let i = 1; i <= openTag.length; i++) {
          if (buffer.endsWith(openTag.slice(0, i))) {
            matchPartial = true;
            const safePart = buffer.slice(0, buffer.length - i);
            if (safePart) yield safePart;
            buffer = buffer.slice(buffer.length - i);
            break;
          }
        }
        if (!matchPartial) {
          yield buffer;
          buffer = '';
        }
        break;
      } else {
        // Found <|tool...
        if (startIdx > 0) {
          yield buffer.slice(0, startIdx);
          buffer = buffer.slice(startIdx);
          continue; // Re-evaluate
        }
        // Buffer starts with <|tool...
        // Wait for the full block
        const closeBracket = buffer.indexOf('}>');
        const closeTag = buffer.indexOf('<|/tool_call|>');

        let endIdx = -1;
        if (closeTag !== -1) endIdx = closeTag + 14; // length of <|/tool_call|>
        else if (closeBracket !== -1) endIdx = closeBracket + 2;

        if (endIdx === -1) {
          // If buffer is getting too large and we still haven't found closing, just clear it
          if (buffer.length > 500) {
            buffer = '';
          }
          break; // Wait for more chunks to close the tag
        }

        // Discard the entire block
        buffer = buffer.slice(endIdx);
      }
    }
  }
  if (buffer) yield buffer;
}

// ═══════════════════════════════════════
// NON-STREAMING CHAT (For extraction, insights, etc.)
// ═══════════════════════════════════════

/**
 * Non-streaming chat — trả về full response. Dùng cho extract, insight, summarize.
 */
export async function chat(request: ChatRequest): Promise<string> {
  let result = '';
  for await (const chunk of streamChat(request)) {
    result += chunk;
  }
  return result;
}

// ═══════════════════════════════════════
// EMBEDDING
// ═══════════════════════════════════════

/**
 * Generate embeddings via local model (nomic-embed-text on vLLM/Ollama)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const config = getConfig();
  let baseURL = config.localBaseURL;
  if (!baseURL.endsWith('/v1') && !baseURL.startsWith('/api/')) {
    baseURL = baseURL.replace(/\/$/, '') + '/v1';
  }

  const response = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.localApiKey}`,
    },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.data?.[0]?.embedding) {
    throw new Error('Invalid embedding response. Ensure nomic-embed-text is available.');
  }

  return data.data[0].embedding;
}

/**
 * Batch embeddings
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(t => generateEmbedding(t)));
}

// ═══════════════════════════════════════
// LEGACY COMPAT — Giữ backward compatibility
// ═══════════════════════════════════════

/**
 * @deprecated Sử dụng streamChat() thay thế.
 * Backward-compat wrapper cho streamEnterpriseAI
 */
export async function* streamEnterpriseAI(
  history: { role: 'user' | 'model'; content: string }[],
  newMessage: string,
  modelId: string,
  systemInstruction?: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const messages = [
    ...history.map(h => ({ role: h.role as 'user' | 'model', content: h.content })),
    { role: 'user' as const, content: newMessage },
  ];

  yield* streamChat({
    messages,
    model: modelId,
    systemInstruction,
    signal,
    meta: { source: 'web-chat' },
  });
}

// ═══════════════════════════════════════
// AGENT TURN (Tool Calling)
// ═══════════════════════════════════════

function extractGemmaToolCalls(content: string): { tool_calls: any[], cleaned_content: string } | null {
  let tool_calls: any[] = [];
  if (!content.includes('<|tool_call|>') && !content.includes('call:')) return null;

  // Dọn dẹp sơ bộ lỗi sinh ký tự của vLLM Gemma
  content = content.replace(/<<\|tool_call\|>/g, '<|tool_call|>');

  // Use balanced brace matching for nested JSON (e.g. export_document with chart JSON)
  const callPattern = /(?:<\|tool_call\|>)?\s*call:([a-zA-Z0-9_]+)\{/g;
  let match;
  let hasMatch = false;
  let cleaned_content = content;
  const toRemove: string[] = [];

  while ((match = callPattern.exec(content)) !== null) {
    hasMatch = true;
    const fnName = match[1];
    const braceStart = match.index + match[0].length - 1;

    // Balanced brace matching
    let depth = 0;
    let end = braceStart;
    for (let i = braceStart; i < content.length; i++) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }

    const fullMatchStr = content.substring(match.index, end + 1);
    toRemove.push(fullMatchStr);

    let rawJson = content.substring(braceStart, end + 1);
    // Clean up any tool_call tags inside
    rawJson = rawJson.replace(/<\|\/?tool_call\|?>/g, '');
    rawJson = rawJson.replace(/<\/?tool_call\|?>/g, '');

    // Fix multiline strings and unescaped quotes wrapped in `<|"|>` tokens
    rawJson = rawJson.replace(/<\|(?:\"|\')\|?>([\s\S]*?)<\|(?:\"|\')\|?>/g, (match, innerString) => {
      // Escape literal newlines and actual quotes inside the string part
      const escaped = innerString
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/"/g, '\\"')
        .replace(/\t/g, '\\t');
      return '"' + escaped + '"';
    });

    // Clean up weird Gemma quote tokens just in case format was unclosed
    rawJson = rawJson.replace(/<\|"\|?>/g, '"');
    rawJson = rawJson.replace(/<\|'\|?>/g, "'");

    // Fix unquoted keys
    let jsonStr = rawJson.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/gs, '$1"$2":');
    // Fix single quotes for values just in case
    jsonStr = jsonStr.replace(/:\s*'([^']*)'/g, ':"$1"');
    // Fix unquoted string values (any sequence not starting with quote/brace/bracket, up to comma or closing brace)
    jsonStr = jsonStr.replace(/:\s*([^"'{[\s][^,}]*?)\s*([,}])/g, (match, p1, p2) => {
      // Keep numbers, booleans, and null as unquoted
      if (/^-?\d+(\.\d+)?$/.test(p1) || ['true', 'false', 'null'].includes(p1)) {
        return `:${p1}${p2}`;
      }
      // Otherwise, wrap in double quotes (and escape internal double quotes just in case)
      const safeString = p1.replace(/"/g, '\\"');
      return `:"${safeString}"${p2}`;
    });

    try {
      const argsObj = JSON.parse(jsonStr);
      tool_calls.push({
        id: 'call_' + Math.random().toString(36).substr(2, 9),
        type: 'function',
        function: {
          name: fnName,
          arguments: JSON.stringify(argsObj)
        }
      });
    } catch (e) {
      console.error('[Gemma Parser] Failed to parse JSON args:', jsonStr.substring(0, 200));
    }
  }

  if (!hasMatch) return null;

  for (const rm of toRemove) {
    cleaned_content = cleaned_content.replace(rm, '');
  }
  // Dọn dẹp nốt thẻ đóng nếu có sót lại
  cleaned_content = cleaned_content.replace(/<\|\/?tool_call\|?>/g, '').trim();
  cleaned_content = cleaned_content.replace(/<\/?tool_call\|?>/g, '').trim();

  return { tool_calls, cleaned_content };
}


/**
 * Gọi 1 turn của Agent. Trả về cả message và tool_calls (không stream).
 */
export async function callAgentTurn(request: ChatRequest): Promise<{ message?: string; tool_calls?: any[] }> {
  const customKey = getCustomKey('openai');
  const apiKey = customKey || getEnvKey('openai');
  const provider = detectProvider(request.model);

  const isVllm = provider === 'local';
  let baseURL: string;
  let authKey: string;

  if (isVllm) {
    baseURL = request.baseUrl || getLocalAIBaseURL(request.model);
    authKey = getConfig().localApiKey;  // From getConfig() — reads env var
  } else if (provider === 'gemini') {
    // Dùng Vite proxy để tránh CORS khi gọi từ browser
    baseURL = typeof window !== 'undefined' ? '/api/gemini/' : 'https://generativelanguage.googleapis.com/v1beta/openai/';
    authKey = getEnvKey('gemini');
  } else if (provider === 'openai') {
    baseURL = 'https://api.openai.com/v1';
    authKey = apiKey;
  } else {
    baseURL = 'https://api.deepseek.com/v1';
    authKey = getEnvKey('deepseek');
  }

  const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getConfig().timeoutMs);

  try {
    const isVllmOrLocal = /localhost|127\.0\.0\.1/.test(url) || url.includes('/api/vllm');

    let formattedMessages = request.messages.map((m: any) => {
      const out = { ...m };
      if (out.role === 'model') {
        out.role = 'assistant';
      }
      return out;
    });

    // Bypassing vLLM issues with Gemma models (Qwen supports system role + tool calls)
    const isGemmaModel = request.model?.toLowerCase().includes('gemma');
    if (isVllmOrLocal && isGemmaModel) {
      formattedMessages = formattedMessages.map((m: any) => {
        // Gemma doesn't support 'system' role → convert to 'user'
        if (m.role === 'system') {
          return {
            role: 'user',
            content: `[HỆ THỐNG - CHỈ DẪN]\n${m.content}\n\n(Hãy tuân thủ chỉ dẫn trên khi trả lời các câu hỏi tiếp theo)`
          };
        }
        if (m.role === 'assistant' && m.tool_calls) {
          return {
            role: 'assistant',
            content: m.content || "Đang xử lý dữ liệu với công cụ...",
            tool_calls: m.tool_calls
          };
        }
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: `[HỆ THỐNG - KẾT QUẢ TỪ CÔNG CỤ ${m.name || 'search'}]:\n${m.content || '{}'}\n(Hãy dựa vào kết quả trên để trả lời)`
          };
        }
        return m;
      });
    }

    const payload: any = {
      model: request.model,
      messages: formattedMessages,
      temperature: request.temperature ?? 0.15,
      stream: false,
      max_tokens: isVllmOrLocal ? 8000 : undefined,
    };
    // Always pass tools
    if (request.tools && request.tools.length > 0) {
      if (isVllmOrLocal && isGemmaModel) {
        // Manually inject tools schema for Gemma models because vLLM chat templates for Gemma 
        // might ignore the tools array payload.
        const toolsDesc = request.tools.map(t =>
          `- Tên công cụ: ${t.function.name}\n  Mô tả: ${t.function.description}\n  Tham số: ${JSON.stringify(t.function.parameters)}`
        ).join('\n\n');

        formattedMessages.unshift({
          role: 'user',
          content: `[HỆ THỐNG BẮT BUỘC]
Bạn BẮT BUỘC PHẢI DÙNG CÔNG CỤ khi cần truy xuất thông tin doanh nghiệp, KPI, công nợ, báo cáo. Danh sách công cụ hiện có:\n\n${toolsDesc}\n\nĐể gọi công cụ, BẠN PHẢI TRẢ VỀ CHÍNH XÁC CÚ PHÁP NÀY TRONG CÂU TRẢ LỜI NGAY LẬP TỨC VÀ KHÔNG VIẾT THÊM GÌ KHÁC:\ncall:ten_cong_cu{"tham_so": "gia tri"}\n\nVí dụ: call:get_debt_report{"sortBy":"amount"}`
        });
      } else {
        payload.tools = request.tools;
      }
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authKey) headers['Authorization'] = `Bearer ${authKey}`;
    if (isVllm) headers['ngrok-skip-browser-warning'] = 'true';
    if (request.meta?.userId) headers['X-Request-User-Id'] = request.meta.userId;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: request.signal || controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[API Error ${res.status}] ${errText}`);
    }

    const data = await res.json() as any;
    if (data.choices && data.choices[0]) {
      let content = data.choices[0].message?.content || undefined;
      let tool_calls = data.choices[0].message?.tool_calls;

      // Fallback for Gemma-like models that output <|tool_call|> text
      if (!tool_calls || tool_calls.length === 0) {
        if (content && (content.includes('<|tool_call|>') || content.includes('call:'))) {
          const extracted = extractGemmaToolCalls(content);
          if (extracted && extracted.tool_calls.length > 0) {
            tool_calls = extracted.tool_calls;
            content = extracted.cleaned_content || undefined;
          }
        }
      }

      return {
        message: content,
        tool_calls
      };
    }

    return {};
  } catch (err: any) {
    console.error('[callAgentTurn] Error:', err);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}


// ═══════════════════════════════════════
// BACKWARD COMPATIBILITY
// ═══════════════════════════════════════

/**
 * @deprecated Sử dụng chat() thay thế.
 * Backward-compat: analyze contract
 */
export async function analyzeContract(text: string): Promise<string> {
  return chat({
    messages: [{ role: 'user', content: `Hãy phân tích nội dung hợp đồng sau đây và tóm tắt các điểm quan trọng (Bên A, Bên B, Giá trị, Thời hạn, Rủi ro tiềm ẩn). Định dạng bằng tiếng Việt, súc tích, chuyên nghiệp:\n\n${text}` }],
    model: getConfig().defaultModel,
    temperature: 0.2,
    meta: { source: 'web-chat' },
  });
}

/**
 * @deprecated Sử dụng chat() thay thế.
 * Backward-compat: query system data
 */
export async function querySystemData(query: string, data: any): Promise<string> {
  return chat({
    messages: [{ role: 'user', content: `Dữ liệu hệ thống: ${JSON.stringify(data)}\n\nCâu hỏi: ${query}` }],
    model: 'deepseek-chat',
    systemInstruction: 'Bạn là trợ lý quản trị cấp cao của CIC ERP. Trả lời chính xác, ngắn gọn, Markdown.',
    temperature: 0.1,
    meta: { source: 'web-chat' },
  });
}

/**
 * @deprecated Sử dụng chat() thay thế.
 * Backward-compat: smart insights
 */
export async function getSmartInsights(contracts: any[]): Promise<any[]> {
  const sample = contracts.sort(() => 0.5 - Math.random()).slice(0, 40);
  const result = await chat({
    messages: [{ role: 'user', content: `Dựa trên ${contracts.length} hợp đồng (mẫu), đưa ra 3 nhận xét quan trọng.\nDữ liệu: ${JSON.stringify(sample)}` }],
    model: 'deepseek-chat',
    systemInstruction: 'Bạn là chuyên gia phân tích dữ liệu. Output JSON: [{"title":"...","content":"...","type":"warning|info|success"}]',
    temperature: 0.3,
    meta: { source: 'web-chat' },
  });
  try {
    const cleaned = result.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return [{ title: 'Lỗi parsing', content: 'Không thể phân tích kết quả AI', type: 'warning' }];
  }
}

/**
 * @deprecated Sử dụng chat() thay thế.
 * Backward-compat: summarize contract content
 */
export async function summarizeContractContent(
  lineItems: { name: string; productName?: string; manufacturer?: string }[]
): Promise<string> {
  const descriptions = lineItems
    .filter(item => item.name || item.productName)
    .map((item, i) => {
      const desc = item.name || item.productName || '';
      const mfr = item.manufacturer ? ` - Hãng: ${item.manufacturer}` : '';
      return `${i + 1}. ${desc}${mfr}`;
    })
    .join('\n');

  if (!descriptions) return '';

  try {
    const result = await chat({
      messages: [{ role: 'user', content: `Tóm tắt nội dung hợp đồng trong MỘT câu ngắn gọn. Chỉ nêu tên sản phẩm chính và hãng.\nSản phẩm:\n${descriptions}` }],
      model: getConfig().defaultModel,
      systemInstruction: 'Bạn là trợ lý hợp đồng của CIC. Trả lời 1 câu tiếng Việt ngắn gọn.',
      temperature: 0.1,
      maxTokens: 200,
      meta: { source: 'extract' },
    });
    return result.trim().replace(/^["']|["']$/g, '');
  } catch {
    return '';
  }
}

// ═══════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════

function formatError(modelId: string, error: any): string {
  const errStr = String(error);
  if (errStr.includes('404')) return `⚠️ Model '${modelId}' không tìm thấy (404).`;
  if (errStr.includes('403')) return '⚠️ Sai API Key hoặc chưa bật quyền (403).';
  if (errStr.includes('429')) return '⚠️ Vượt quá giới hạn request. Thử lại sau.';
  if (errStr.includes('ECONNREFUSED')) return `⚠️ Không kết nối được server AI (${modelId}). Kiểm tra vLLM/Ollama.`;
  return `⚠️ Lỗi kết nối AI (${modelId}).\nChi tiết: ${error?.message || errStr}`;
}

/** Re-export getLocalAIBaseURL for backward compat */
export { getLocalAIBaseURL };

/** Re-export from old openaiService */
export function isLocalAIPriority(): boolean {
  try { return typeof window !== 'undefined' && localStorage.getItem('cic_local_ai_priority') === 'true'; }
  catch { return true; } // Mặc định true cho backend local
}
