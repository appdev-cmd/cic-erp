import { dataClient as supabase } from '../../lib/dataClient';
import type { OpenClawTool } from './openclaw/types';

export interface AgentToolConfigRow {
  tool_name: string;
  custom_description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const AgentToolConfigService = {
  /** Lấy toàn bộ cấu hình tuỳ chỉnh của các tools */
  getAll: async (): Promise<AgentToolConfigRow[]> => {
    const { data, error } = await supabase
      .from('agent_tool_configs')
      .select('*');
    
    // Nếu bảng chưa có (do lỗi migration) thì trả về mảng rỗng để không crash
    if (error && error.code !== '42P01') {
      console.error('Lỗi lấy agent_tool_configs:', error);
    }
    return data || [];
  },

  /** Cập nhật cấu hình tuỳ chỉnh cho 1 tool */
  update: async (toolName: string, overrides: Partial<Omit<AgentToolConfigRow, 'tool_name' | 'created_at' | 'updated_at'>>): Promise<void> => {
    const payload = { 
      tool_name: toolName, 
      ...overrides, 
      updated_at: new Date().toISOString() 
    };

    const { error } = await supabase
      .from('agent_tool_configs')
      .upsert(payload, { onConflict: 'tool_name' });

    if (error) throw error;
  },

  /**
   * Trộn (Merge) danh sách tools gốc với cấu hình từ Database.
   * Nếu có custom_description, ghi đè lên description gốc.
   * Nếu is_active = false, loại bỏ tool đó khỏi danh sách.
   */
  getMergedTools: async (baseTools: OpenClawTool[]): Promise<OpenClawTool[]> => {
    try {
      const overrides = await AgentToolConfigService.getAll();
      const overrideMap = new Map(overrides.map(o => [o.tool_name, o]));

      const merged: OpenClawTool[] = [];
      
      for (const tool of baseTools) {
        const config = overrideMap.get(tool.name);
        
        // Bỏ qua tool bị tắt
        if (config && config.is_active === false) {
          continue;
        }

        // Tạo bản copy để không làm biến đổi mảng gốc trong bộ nhớ
        const mergedTool = { ...tool };
        
        if (config && config.custom_description && config.custom_description.trim() !== '') {
          mergedTool.description = config.custom_description;
        }

        merged.push(mergedTool);
      }

      return merged;
    } catch (e) {
      console.error('[AgentToolConfigService] Error merging tools, fallback to base.', e);
      return baseTools;
    }
  }
};
