import { streamGeminiChat } from './geminiService';
import { streamOpenAIChat } from './openaiService';

export type AIModelId =
    // Cloud Models
    | 'gemini-1.5-flash'
    | 'gemini-1.5-pro'
    | 'gemini-2.0-flash'
    | 'gemini-pro'
    | 'gpt-4o'
    | 'deepseek-chat'
    | 'deepseek-r1'
    // Local Models (Ollama)
    | 'qwen2.5:7b'
    | 'qwen2.5:14b'
    | 'gemma3:4b'
    | 'gemma3:12b'
    | 'gemma3:27b'
    | 'gemma2:9b'
    | 'llama3.1:8b'
    | 'mistral:7b'
    | 'deepseek-r1:7b';

// Local model name prefixes — routed to Ollama via OpenAI-compatible API
const LOCAL_MODEL_PREFIXES = ['qwen', 'gemma', 'llama', 'mistral', 'phi', 'codellama', 'vicuna', 'yi'];

function isLocalModel(modelId: string): boolean {
    // Models with : (e.g. qwen2.5:7b) are always local
    if (modelId.includes(':')) return true;
    // Check prefixes
    return LOCAL_MODEL_PREFIXES.some(prefix => modelId.toLowerCase().startsWith(prefix));
}

export async function* streamEnterpriseAI(
    history: { role: 'user' | 'model', content: string }[],
    newMessage: string,
    modelId: string,
    systemInstruction?: string,
    signal?: AbortSignal
) {
    // Routing Logic
    if (modelId.startsWith('gemini')) {
        // Google Gemini → geminiService
        yield* streamGeminiChat(history, newMessage, modelId, systemInstruction, signal);
    } else if (isLocalModel(modelId)) {
        // Local Ollama models → openaiService (provider='local')
        yield* streamOpenAIChat(history, newMessage, modelId, systemInstruction, signal);
    } else if (modelId.startsWith('gpt') || modelId.startsWith('deepseek')) {
        // Cloud: OpenAI / DeepSeek
        let apiModelId = modelId;
        if (modelId === 'deepseek-r1') apiModelId = 'deepseek-reasoner';
        yield* streamOpenAIChat(history, newMessage, apiModelId, systemInstruction, signal);
    } else {
        // Fallback: try as local model name
        yield* streamOpenAIChat(history, newMessage, modelId, systemInstruction, signal);
    }
}

