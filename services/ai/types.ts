/**
 * AI Platform — Shared Types
 * ===========================
 * Tất cả type definitions cho hệ thống AI doanh nghiệp CIC.
 */

// ═══════════════════════════════════════
// MODEL & PROVIDER
// ═══════════════════════════════════════

export type AIProvider = 'local' | 'gemini' | 'openai' | 'deepseek';

export interface AIModel {
  id: string;                  // e.g. "qwen2.5:32b", "gemini-2.0-flash"
  name: string;                // Display name
  provider: AIProvider;
  contextWindow: number;       // Max tokens
  supportsVision: boolean;     // Can process images
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  costPer1kInput?: number;     // USD per 1K input tokens
  costPer1kOutput?: number;    // USD per 1K output tokens
  isDefault?: boolean;
  isEnabled: boolean;
}

// ═══════════════════════════════════════
// CHAT / STREAMING
// ═══════════════════════════════════════

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  baseUrl?: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  signal?: AbortSignal;
  /** Metadata for logging */
  meta?: {
    userId?: string;
    sessionId?: string;
    source?: 'web-chat' | 'telegram' | 'api' | 'cron' | 'extract';
    agentId?: string;
    isFallback?: boolean;
  };
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: AIProvider;
  usage?: TokenUsage;
  latencyMs?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// ═══════════════════════════════════════
// EMBEDDING
// ═══════════════════════════════════════

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;  // Default: nomic-embed-text (local)
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage?: { totalTokens: number };
}

// ═══════════════════════════════════════
// AI LOG (Observability)
// ═══════════════════════════════════════

export interface AILogEntry {
  id?: string;
  user_id?: string;
  session_id?: string;
  agent_id?: string;
  model_id: string;
  provider: AIProvider;
  action_type: 'chat' | 'extract' | 'embed' | 'tool_call' | 'insight' | 'summarize';
  source: 'web-chat' | 'telegram' | 'api' | 'cron' | 'extract';
  prompt_tokens?: number;
  completion_tokens?: number;
  total_cost_usd?: number;
  latency_ms?: number;
  success: boolean;
  error_message?: string;
  input_preview?: string;   // First 200 chars of input
  output_preview?: string;  // First 200 chars of output
  metadata?: Record<string, any>;
  created_at?: string;
}

// ═══════════════════════════════════════
// DEPARTMENT AGENT
// ═══════════════════════════════════════

export interface DepartmentAgentConfig {
  id: string;                  // "agent-bim", "agent-tckt"
  name: string;                // "Trợ lý P.BIM"
  departmentId: string;        // Khớp unit code trong DB
  systemPrompt: string;        // Persona + expertise
  greeting: string;            // Câu chào
  tools: string[];             // Subset tools được phép
  canWrite: boolean;           // Quyền tạo/sửa/xoá
  canApprove: boolean;         // Quyền phê duyệt
  preferredModel: string;      // Model ưu tiên
  fallbackModel: string;       // Dự phòng
  knowledgeTags: string[];     // Filter RAG
  telegramEnabled: boolean;
  icon: string;                // Emoji
}

// ═══════════════════════════════════════
// GATEWAY CONFIG
// ═══════════════════════════════════════

export interface GatewayConfig {
  localBaseURL: string;
  localApiKey: string;
  defaultModel: string;
  maxRetries: number;
  timeoutMs: number;
  enableLogging: boolean;
}
