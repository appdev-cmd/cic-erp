/**
 * CIC AI Platform — Public API
 * ==============================
 * Import tất cả AI functions từ đây.
 * 
 * @example
 * import { streamChat, chat, generateEmbedding } from '../services/ai';
 * import { AI_MODELS, getModel } from '../services/ai';
 * import type { ChatRequest, AIModel } from '../services/ai';
 */

// ─── Gateway (Core) ─────────────────────
export {
  streamChat,
  chat,
  generateEmbedding,
  generateEmbeddings,
  // Legacy compat exports
  streamEnterpriseAI,
  analyzeContract,
  querySystemData,
  getSmartInsights,
  summarizeContractContent,
  getLocalAIBaseURL,
  isLocalAIPriority,
} from './gateway';

// ─── Models ─────────────────────────────
export {
  AI_MODELS,
  getModel,
  getEnabledModels,
  getModelsByProvider,
  getDefaultModel,
  detectProvider,
  getFallbackModel,
  estimateCost,
} from './models';

// ─── Types ──────────────────────────────
export type {
  AIProvider,
  AIModel,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  TokenUsage,
  EmbeddingRequest,
  EmbeddingResponse,
  AILogEntry,
  DepartmentAgentConfig,
  GatewayConfig,
} from './types';
