import type { OpenClawTool, UserContext } from './types';
import { canViewAll } from './tools/_helpers';
import { AuditLogger } from './auditLogger';
import { isToolAllowedForRole, TOOL_ACL } from './toolAcl';

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
 * 1. AI chỉ gọi tool nếu user có quyền (Role-based ACL).
 * 2. Tự động ép unitId filter nếu user là unit-scoped.
 * 3. Ghi log truy cập (Audit Trail).
 */
export function createGuardedTool(tool: OpenClawTool): OpenClawTool {
  return {
    ...tool,
    execute: async (args, context: UserContext) => {
      // ═══ 1. ROLE-BASED TOOL ACCESS CONTROL ═══════════════════════
      // Check if user's role is allowed to use this specific tool
      if (!isToolAllowedForRole(tool.name, context.role)) {
        // Log denied access attempt
        await AuditLogger.log({
          userId: context.userId,
          toolName: tool.name,
          args: args,
          unitScope: [context.unitId || 'UNKNOWN'],
          result: 'denied',
          dataAccessed: `DENIED: Role "${context.role}" not allowed for tool "${tool.name}"`,
          timestamp: new Date().toISOString()
        });
        return `Truy cập bị từ chối: Bạn (${context.role}) không có quyền sử dụng chức năng "${tool.name}". Vui lòng liên hệ Admin để được cấp quyền.`;
      }

      // ═══ 2. DATA SCOPING & SANITIZATION ══════════════════════════
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

      // ═══ 3. AUDIT LOG ════════════════════════════════════════════
      await AuditLogger.log({
        userId: context.userId,
        toolName: tool.name,
        args: sanitizedArgs,
        unitScope: isGlobalRole(context.role) ? ['*'] : [context.unitId || 'UNKNOWN'],
        result: 'success',
        dataAccessed: `AI Agent calling ${tool.name}`,
        timestamp: new Date().toISOString()
      });

      // ═══ 4. EXECUTE ══════════════════════════════════════════════
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
