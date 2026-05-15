import { dataClient as supabase } from '../../../lib/dataClient';

export interface AIToolAuditEntry {
  userId: string;
  toolName: string;
  args: Record<string, any>;
  unitScope: string[];
  result: 'success' | 'denied' | 'error';
  dataAccessed: string;
  timestamp: string;
}

export const AuditLogger = {
  log: async (entry: AIToolAuditEntry) => {
    try {
      await supabase.from('ai_tool_audit_logs').insert({
        user_id: entry.userId,
        tool_name: entry.toolName,
        args: entry.args,
        unit_scope: entry.unitScope,
        result: entry.result,
        data_accessed: entry.dataAccessed,
        created_at: entry.timestamp
      });
    } catch (error) {
      console.error('[AuditLogger] Failed to log AI tool call:', error);
    }
  }
};
