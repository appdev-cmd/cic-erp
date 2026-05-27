import type { DepartmentAgent, UserContext } from './types';
import { agentDefinitions } from './agents/definitions';

/**
 * Lọc danh sách agents dựa trên RBAC rules mới
 * Thêm quyền truy nhập nếu user nằm trong allowed_users hoặc có role trong allowed_roles.
 */
function hasAccess(agent: DepartmentAgent, context: UserContext): boolean {
  if (!agent.isActive) return false;
  
  const hasUsers = agent.allowedUsers && agent.allowedUsers.length > 0;
  const hasRoles = agent.allowedRoles && agent.allowedRoles.length > 0;

  // Nếu agent có set allowed_users (match cả employeeId và userId)
  if (hasUsers && (
    (context.employeeId && agent.allowedUsers?.includes(context.employeeId)) ||
    (context.userId && agent.allowedUsers?.includes(context.userId))
  )) {
    return true;
  }
  // Nếu agent có set allowed_roles
  if (hasRoles && context.role && agent.allowedRoles?.includes(context.role)) {
    return true;
  }
  
  // NẾU AGENT CÓ SET CỤ THỂ USERS HAY ROLES NHƯNG NGƯỜI DÙNG KHÔNG KHỚP -> Dừng
  if (hasUsers || hasRoles) {
    return false;
  }

  // Nếu không có cả 2: quay về rule default (Admin/Leadership thấy hết, đơn vị nào thấy đơn vị đó)
  if (['Admin', 'Leadership'].includes(context.role)) {
    return true;
  }
  
  return agent.departmentId === '*' || agent.departmentId === (context.unitCode || '').toUpperCase();
}

/**
 * Lấy danh sách agents mà user được phép xem/chuyển đổi.
 */
export function getVisibleAgentsFilter(context: UserContext, activeAgents: DepartmentAgent[]): DepartmentAgent[] {
  // Admin see all active
  if (context.role === 'Admin') return activeAgents;

  return activeAgents.filter(a => hasAccess(a, context));
}

/**
 * Điều hướng user đến agent phù hợp nhất
 */
export function routeUserToAgentFilter(context: UserContext, activeAgents: DepartmentAgent[]): DepartmentAgent {
  const visible = getVisibleAgentsFilter(context, activeAgents);
  if (visible.length === 0) {
    // Fallback nếu sạch bóng agent
    return agentDefinitions['SYSTEM'] || Object.values(agentDefinitions)[0];
  }

  // Thử match đơn vị
  const unitMatch = visible.find(a => a.departmentId === (context.unitCode || '').toUpperCase());
  if (unitMatch) return unitMatch;

  // Thử BGD / SYSTEM
  const bgdMatch = visible.find(a => a.id === 'agent-bgd' || a.departmentId === 'BGD');
  if (bgdMatch && ['Leadership', 'Admin', 'Legal', 'Accountant', 'ChiefAccountant'].includes(context.role)) return bgdMatch;

  // Lấy agent đầu tiên
  return visible[0];
}

// ⚠️ DEPRECATED 
export function routeUserToAgent(context: UserContext): DepartmentAgent {
  return routeUserToAgentFilter(context, Object.values(agentDefinitions));
}
export function getVisibleAgents(context: UserContext): DepartmentAgent[] {
  return getVisibleAgentsFilter(context, Object.values(agentDefinitions));
}
