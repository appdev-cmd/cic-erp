import { dataClient as supabase } from '../../lib/dataClient';
import type { DepartmentAgent } from './openclaw/types';
import { agentDefinitions } from './openclaw/agents/definitions';

export interface AgentConfigRow {
  id: string;
  name: string;
  department_id: string;
  description: string;
  system_prompt: string;
  allowed_tools: string[];
  allowed_roles: string[];
  allowed_users: string[];
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
  allowedRoles: row.allowed_roles || [],
  allowedUsers: row.allowed_users || [],
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

  /** Lấy TẤT CẢ agents (kể cả inactive) dưới dạng DepartmentAgent — dùng cho Admin */
  getAllAgents: async (): Promise<DepartmentAgent[]> => {
    const { data, error } = await supabase
      .from('agent_configs')
      .select('*')
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
    if ('allowedRoles' in payload) { payload.allowed_roles = payload.allowedRoles; delete payload.allowedRoles; }
    if ('allowedUsers' in payload) { payload.allowed_users = payload.allowedUsers; delete payload.allowedUsers; }
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

  /** Đồng bộ từ agentDefinitions trong code lên DB */
  syncFromDefinitions: async (): Promise<{ success: number, errors: any[] }> => {
    let successCount = 0;
    const errors: any[] = [];
    
    for (const [key, agent] of Object.entries(agentDefinitions)) {
      try {
        // Preserve existing DB fields that shouldn't be overwritten blindly by code configs
        const { data: existing } = await supabase.from('agent_configs').select('id, system_prompt, is_active, allowed_roles, allowed_users').eq('id', agent.id).single();
        
        // Preserve fields that admin may have customized via UI
        const payload: any = {
          name: agent.name,
          department_id: agent.departmentId,
          description: agent.description,
          preferred_model: agent.preferredModel || 'gemma-4-26b',
          fallback_model: agent.fallbackModel || null,
          icon: agent.icon || 'Bot',
          color: agent.color || 'bg-slate-600',
          data_scope: agent.dataScope,
          updated_at: new Date().toISOString()
        };

        // Only overwrite allowed_tools if not customized in DB
        if (!existing) {
          payload.allowed_tools = agent.allowedTools;
        }
        // If existing, preserve DB allowed_tools (admin may have customized)

        if (!existing) {
          payload.system_prompt = agent.systemPrompt;
          payload.is_active = agent.isActive;
          payload.allowed_roles = [];
          payload.allowed_users = [];
        } else {
          // Preserve all admin-customizable fields from DB
          payload.system_prompt = existing.system_prompt;
          payload.is_active = existing.is_active;
          payload.allowed_roles = existing.allowed_roles || [];
          payload.allowed_users = existing.allowed_users || [];
        }

        const { error } = await supabase
          .from('agent_configs')
          .upsert({ id: agent.id, ...payload }, { onConflict: 'id' });

        if (error) throw error;
        successCount++;
      } catch (err) {
        errors.push({ id: agent.id, error: err });
      }
    }
    return { success: successCount, errors };
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
