import type { OpenClawTool, UserContext } from '../types';
import { canViewAll } from './_helpers';

export const delegateTaskTool: OpenClawTool = {
  name: 'delegate_task_to_agent',
  description: 'Giao phó công việc hoặc câu hỏi cho một Agent chuyên môn khác. Bạn LÀ Master Router, hãy dùng tool này để lấy dữ liệu từ các Agent như: agent-bgd (Ban giám đốc - Số liệu tổng quan, doanh thu, lợi nhuận), agent-mkt (Marketing - viết bài, MXH, tìm kiếm web), agent-hr (Nhân sự - nghỉ phép, chấm công, nhân viên). Bạn có thể gọi tool này NỀU CẦN kết hợp nhiều domain.',
  schema: {
    agentId: { type: 'string', description: 'ID của agent đích (Ví dụ: "agent-bgd", "agent-mkt")' },
    instruction: { type: 'string', description: 'Chỉ thị công việc cực kỳ chi tiết, bao gồm cả từ khóa hoặc điều kiện để Agent đích biết phải làm gì.' }
  },
  execute: async (args, context: UserContext) => {
    try {
      // Dynamic imports to prevent circular dependencies
      const { runReActLoop } = await import('../react-loop');
      const { agentDefinitions } = await import('../agents/definitions');
      const { erpToolsRegistry } = await import('./registry');

      // 1. Validate agent
      const targetAgent = Object.values(agentDefinitions).find(a => a.id === args.agentId);
      if (!targetAgent) {
         return `Lỗi: Không tìm thấy Agent có ID "${args.agentId}". Vui lòng thử lại với ID hợp lệ.`;
      }
      if (!targetAgent.isActive) {
          return `Lỗi: Agent ${targetAgent.name} hiện đang bị vô hiệu hóa.`;
      }

      // SECURITY: Check if user's role is allowed to access target agent
      if (targetAgent.allowedRoles && targetAgent.allowedRoles.length > 0) {
        const userRole = context.role;
        const isAdmin = userRole === 'Admin';
        const isAllowed = isAdmin || targetAgent.allowedRoles.includes(userRole) || canViewAll(context);
        if (!isAllowed) {
          return `Truy cập bị từ chối: Bạn không có quyền sử dụng Agent "${targetAgent.name}".`;
        }
      }

      console.log(`[MasterRouter] Giao task cho ${targetAgent.name}: "${args.instruction}"`);

      // 2. Prepare tools for target agent
      const targetTools = targetAgent.allowedTools.includes('*')
        ? erpToolsRegistry
        : erpToolsRegistry.filter(t => targetAgent.allowedTools.includes(t.name));

      // 3. Fire internal ReAct loop for sub-agent
      const result = await runReActLoop(
        args.instruction,
        context,
        targetAgent,
        targetTools,
        [], // No history
        5 // Giới hạn số bước sub-agent để tránh kẹt
      );

      return `(Kết quả từ ${targetAgent.name}):\n\n${result.reply || 'Không có kết quả trả về.'}`;
      
    } catch (e: any) {
      console.error('[MasterRouter] Delegate error:', e);
      return `Lỗi khi giao task: ${e.message || 'Unknown error'}`;
    }
  }
};
