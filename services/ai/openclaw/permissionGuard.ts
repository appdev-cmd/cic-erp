import type { OpenClawTool, UserContext } from './types';
import { getUnitFilter, canViewAll } from './tools/_helpers';
import { AuditLogger } from './auditLogger';

/**
 * Danh sách role được phép xem toàn công ty (Global roles)
 * Map from lib/permissions.ts
 */
const GLOBAL_ROLES = ['Admin', 'Leadership', 'Legal', 'Accountant', 'ChiefAccountant', 'Marketing'];

/**
 * Helper kiểm tra role
 */
function isGlobalRole(role: string): boolean {
  return GLOBAL_ROLES.includes(role);
}

/**
 * Middleware bảo mật cho OpenClaw Tools
 * Đảm bảo:
 * 1. AI chỉ gọi tool nếu user có quyền.
 * 2. Tự động ép unitId filter nếu user là unit-scoped.
 * 3. Ghi log truy cập.
 */
export function createGuardedTool(tool: OpenClawTool): OpenClawTool {
  return {
    ...tool,
    execute: async (args, context: UserContext) => {
      // 1. Kiểm tra quyền cơ bản (optional, có thể mở rộng bằng toolPermissionMap)
      // Hiện tại ta dựa vào allowedTools ở agent config để giới hạn.
      // PermissionGuard này tập trung vào DATA SCOPING.

      // 2. Data Scoping & Sanitization
      const sanitizedArgs = { ...args };

      // Nếu user không có quyền xem toàn công ty, và tool nhận tham số unitId
      // BẮT BUỘC ép unitId của user, bỏ qua bất kỳ giá trị unitId nào AI tự đoán.
      if (!isGlobalRole(context.role)) {
        if (context.unitId) {
            sanitizedArgs.unitId = context.unitId; // Ép filter
        } else {
            // Nếu không có unitId mà lại không phải global role -> rủi ro bảo mật
            console.warn(`[PermissionGuard] Security Warning: User ${context.userId} (${context.role}) has no unitId but is restricted. Tool: ${tool.name}`);
            return "Truy cập bị từ chối: Lỗi xác thực đơn vị của bạn.";
        }
      }

      // 3. Ghi Audit Log trước khi chạy
      await AuditLogger.log({
        userId: context.userId,
        toolName: tool.name,
        args: sanitizedArgs,
        unitScope: isGlobalRole(context.role) ? ['*'] : [context.unitId || 'UNKNOWN'],
        result: 'success', // Assuming success for now, will catch error if fails
        dataAccessed: `AI Agent calling ${tool.name}`,
        timestamp: new Date().toISOString()
      });

      // 4. Thực thi tool với context đã được bảo mật
      try {
          const result = await tool.execute(sanitizedArgs, context);
          return result;
      } catch (error: any) {
          // Log failed attempt
          await AuditLogger.log({
            userId: context.userId,
            toolName: tool.name,
            args: sanitizedArgs,
            unitScope: isGlobalRole(context.role) ? ['*'] : [context.unitId || 'UNKNOWN'],
            result: 'error',
            dataAccessed: `Error: ${error.message}`,
            timestamp: new Date().toISOString()
          });
          throw error;
      }
    }
  };
}
