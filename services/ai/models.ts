/**
 * AI Model Registry
 * ==================
 * Tất cả AI models available (local + cloud), health check, auto-select.
 */

import type { AIModel, AIProvider } from './types';

// ═══════════════════════════════════════
// MODEL DEFINITIONS
// ═══════════════════════════════════════

export const AI_MODELS: AIModel[] = [
  // ─── Local Models (vLLM) ──────────────────
  {
    id: 'Qwen3.5-27B-Instruct-AWQ',
    name: 'Qwen 3.5 27B (vLLM)',
    provider: 'local',
    contextWindow: 8192,
    supportsVision: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    isDefault: false,
    isEnabled: true,
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1 (Ollama)',
    provider: 'local',
    contextWindow: 8192,
    supportsVision: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    isDefault: false,
    isEnabled: true,
  },
  {
    id: 'qwen2.5-7b',
    name: 'Qwen 2.5 7B (vLLM)',
    provider: 'local',
    contextWindow: 4096,
    supportsVision: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    isDefault: false,
    isEnabled: true,
  },
  {
    id: 'cluster-1-legal',
    name: 'Cụm 1 — Pháp chế AI (14B)',
    provider: 'local',
    contextWindow: 4096,
    supportsVision: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    isDefault: true,
    isEnabled: true,
  },
  {
    id: 'cic-legal-14b',
    name: 'CIC Legal 14B (Direct)',
    provider: 'local',
    contextWindow: 4096,
    supportsVision: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    isDefault: false,
    isEnabled: true,
  },

  // ─── Google Gemini ─────────────────────────
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    contextWindow: 1048576,
    supportsVision: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0004,
    isEnabled: true,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    contextWindow: 1048576,
    supportsVision: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    costPer1kInput: 0.000075,
    costPer1kOutput: 0.0003,
    isEnabled: true,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    contextWindow: 2097152,
    supportsVision: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    costPer1kInput: 0.00125,
    costPer1kOutput: 0.005,
    isEnabled: true,
  },

  // ─── OpenAI ───────────────────────────────
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    supportsVision: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    isEnabled: true,
  },

  // ─── DeepSeek ─────────────────────────────
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat V3',
    provider: 'deepseek',
    contextWindow: 65536,
    supportsVision: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    costPer1kInput: 0.00014,
    costPer1kOutput: 0.00028,
    isEnabled: true,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    contextWindow: 65536,
    supportsVision: false,
    supportsStreaming: true,
    supportsToolCalling: false,
    costPer1kInput: 0.00055,
    costPer1kOutput: 0.0022,
    isEnabled: true,
  },
];

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

/** Get model by ID */
export function getModel(modelId: string): AIModel | undefined {
  return AI_MODELS.find(m => m.id === modelId);
}

/** Get all enabled models */
export function getEnabledModels(): AIModel[] {
  return AI_MODELS.filter(m => m.isEnabled);
}

/** Get models by provider */
export function getModelsByProvider(provider: AIProvider): AIModel[] {
  return AI_MODELS.filter(m => m.provider === provider && m.isEnabled);
}

/** Get default model */
export function getDefaultModel(): AIModel {
  return AI_MODELS.find(m => m.isDefault && m.isEnabled) || AI_MODELS[0];
}

/** Detect provider from model ID */
export function detectProvider(modelId: string): AIProvider {
  if (modelId.startsWith('gemini')) return 'gemini';
  if (modelId.startsWith('gpt')) return 'openai';
  if (modelId.startsWith('deepseek')) return 'deepseek';
  // Local models: contain ':', start with known prefixes, or contain '/'
  if (modelId.includes(':') || modelId.includes('/')) return 'local';
  const localPrefixes = ['qwen', 'gemma', 'llama', 'mistral', 'phi', 'codellama', 'yi'];
  if (localPrefixes.some(p => modelId.toLowerCase().startsWith(p))) return 'local';
  return 'local'; // Default fallback to local
}

/** Get fallback model for a provider */
export function getFallbackModel(provider: AIProvider): AIModel | undefined {
  // Local fails → try Gemini Flash
  // Cloud fails → try local  
  const fallbackMap: Record<AIProvider, AIProvider> = {
    local: 'gemini',
    gemini: 'local',
    openai: 'gemini',
    deepseek: 'gemini',
  };
  const fallbackProvider = fallbackMap[provider];
  return AI_MODELS.find(m => m.provider === fallbackProvider && m.isEnabled);
}

/** Estimate cost for a request */
export function estimateCost(modelId: string, promptTokens: number, completionTokens: number): number {
  const model = getModel(modelId);
  if (!model || !model.costPer1kInput || !model.costPer1kOutput) return 0;
  return (promptTokens / 1000) * model.costPer1kInput + (completionTokens / 1000) * model.costPer1kOutput;
}
