import type { ChatMessage } from '../types';
import type { DepartmentAgent, OpenClawTool, ReactAgentResult, UserContext } from './types';
export declare const OPENCLAW_SYSTEM_PROMPT_PREFIX: string;
export declare function runReActLoop(userText: string, userContext: UserContext, agentConfig: DepartmentAgent, availableTools: OpenClawTool[], messageHistory?: ChatMessage[], maxSteps?: number, signal?: AbortSignal, onToolCall?: (toolName: string, args: any) => void): Promise<ReactAgentResult>;
