export interface UserContext {
  userId: string;
  employeeId?: string;
  fullName: string;
  role: string;
  unitId?: string;
  unitCode?: string;
  unitName?: string;
  email?: string;
}

export interface OpenClawTool {
  name: string;
  description: string;
  schema: Record<string, any>; // JSON schema
  execute: (args: any, context: UserContext) => Promise<string | object>;
}

export type AgentToolCallback = (toolName: string, args: any) => Promise<any>;

export interface DepartmentAgent {
  id: string;
  name: string;
  departmentId: string | '*'; // '*' for BGD/System cross-department
  description: string;
  systemPrompt: string;
  allowedTools: string[]; // List of tool names
  allowedRoles?: string[]; // RBAC roles
  allowedUsers?: string[]; // Specific employee UUIDs
  canWrite?: boolean;
  canApprove?: boolean;
  preferredModel?: string;
  fallbackModel?: string;
  /** Lucide icon name for UI display */
  icon?: string;
  /** Tailwind bg-color class (e.g. 'bg-indigo-600') */
  color?: string;
  /** Data scope: 'company' = toàn công ty, 'unit' = chỉ đơn vị mình */
  dataScope: 'company' | 'unit';
  /** Bật/tắt agent */
  isActive: boolean;
}

export interface ReActState {
  chatId: string | number;
  steps: number;
  usedTools: string[];
  maxSteps: number;
}

export type ReactAgentResult = {
  reply?: string;
  steps: number;
  usedTools: string[];
  activeModel?: string; // Tên mô hình thực tế đã xử lý câu trả lời (sau fallback nếu có)
};
