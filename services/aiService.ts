import { streamGeminiChat } from './geminiService';
import { streamOpenAIChat } from './openaiService';

export type AIModelId =
    | 'gemini-1.5-flash'
    | 'gemini-1.5-pro'
    | 'gemini-2.0-flash'
    | 'gemini-pro'
    | 'gpt-4o'
    | 'deepseek-chat'
    | 'deepseek-r1';

export async function* streamEnterpriseAI(
    history: { role: 'user' | 'model', content: string }[],
    newMessage: string,
    modelId: string,
    systemInstruction?: string,
    signal?: AbortSignal
) {
    // Routing Logic
    if (modelId.startsWith('gemini')) {
        yield* streamGeminiChat(history, newMessage, modelId, systemInstruction, signal);
    } else if (modelId.startsWith('gpt') || modelId.startsWith('deepseek')) {
        // DeepSeek R1 → deepseek-reasoner, DeepSeek V3 → deepseek-chat
        let apiModelId = modelId;
        if (modelId === 'deepseek-r1') apiModelId = 'deepseek-reasoner';

        yield* streamOpenAIChat(history, newMessage, apiModelId, systemInstruction, signal);
    } else {
        yield "⚠️ Model không được hỗ trợ.";
    }
}

