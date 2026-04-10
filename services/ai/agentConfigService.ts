import { dataClient as supabase } from '../../lib/dataClient';
import type { DepartmentAgent } from './openclaw/types';

export interface AgentConfigRow {
  id: string;
  name: string;
  department_id: string;
  description: string;
  system_prompt: string;
  allowed_tools: string[];
  preferred_model: string;
  fallback_model: string | null;
  icon: string;
  color: string;
  data_scope: 'company' | 'unit';
  is_active: boolean;
  can_write: boolean;
  can_approve: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Map DB row → DepartmentAgent (for use in OpenClaw runtime) */
const mapToAgent = (row: AgentConfigRow): DepartmentAgent => ({
  id: row.id,
  name: row.name,
  departmentId: row.department_id,
  description: row.description,
  systemPrompt: row.system_prompt,
  allowedTools: row.allowed_tools || [],
  preferredModel: row.preferred_model,
  fallbackModel: row.fallback_model || undefined,
  icon: row.icon,
  color: row.color,
  dataScope: row.data_scope,
  isActive: row.is_active,
  canWrite: row.can_write,
  canApprove: row.can_approve,
});

export const AgentConfigService = {
  /** Lấy tất cả agent configs */
  getAll: async (): Promise<AgentConfigRow[]> => {
    const { data, error } = await supabase
      .from('agent_configs')
      .select('*')
      .order('name');
    if (error) throw error;
    return data || [];
  },

  /** Lấy chỉ các agent đang active */
  getActive: async (): Promise<DepartmentAgent[]> => {
    const { data, error } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return (data || []).map(mapToAgent);
  },

  /** Lấy 1 agent config theo ID */
  getById: async (id: string): Promise<AgentConfigRow | null> => {
    const { data, error } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  /** Cập nhật agent config */
  update: async (id: string, updates: Partial<Omit<AgentConfigRow, 'id' | 'created_at'>>): Promise<AgentConfigRow> => {
    const payload: any = { ...updates, updated_at: new Date().toISOString() };
    // Map frontend field names to DB column names
    if ('departmentId' in payload) { payload.department_id = payload.departmentId; delete payload.departmentId; }
    if ('systemPrompt' in payload) { payload.system_prompt = payload.systemPrompt; delete payload.systemPrompt; }
    if ('allowedTools' in payload) { payload.allowed_tools = payload.allowedTools; delete payload.allowedTools; }
    if ('preferredModel' in payload) { payload.preferred_model = payload.preferredModel; delete payload.preferredModel; }
    if ('dataScope' in payload) { payload.data_scope = payload.dataScope; delete payload.dataScope; }
    if ('isActive' in payload) { payload.is_active = payload.isActive; delete payload.isActive; }

    const { data, error } = await supabase
      .from('agent_configs')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Tăng usage count + cập nhật last_used_at (fire-and-forget) */
  trackUsage: async (id: string): Promise<void> => {
    try {
      await supabase.rpc('increment_agent_usage', { agent_id: id }).single();
    } catch {
      // Fallback: manual increment
      const existing = await supabase.from('agent_configs').select('usage_count').eq('id', id).single();
      if (existing.data) {
        await supabase.from('agent_configs').update({
          usage_count: (existing.data.usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        }).eq('id', id);
      }
    }
  },

  /** Convert DB rows to runtime agent definitions map */
  toDefinitionsMap: (rows: AgentConfigRow[]): Record<string, DepartmentAgent> => {
    const map: Record<string, DepartmentAgent> = {};
    rows.forEach(row => {
      // Use department_id as key (BGD, BIM, etc.)
      const key = row.department_id === '*' 
        ? (row.id === 'agent-bgd' ? 'BGD' : row.id === 'agent-system' ? 'SYSTEM' : row.id)
        : row.department_id;
      map[key] = mapToAgent(row);
    });
    return map;
  },
};
