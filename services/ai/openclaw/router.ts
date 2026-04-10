import type { DepartmentAgent, UserContext } from './types';
import { agentDefinitions } from './agents/definitions';

/**
 * Điều hướng user đến agent phù hợp dựa trên role và unitCode.
 * 
 * Ưu tiên:
 * 1. Admin → SYSTEM agent
 * 2. Leadership → BGD agent  
 * 3. Accountant/ChiefAccountant → TCKT agent (nếu active)
 * 4. Legal → BGD agent (xem toàn công ty)
 * 5. unitCode khớp với agent → agent đó
 * 6. Fallback → BGD agent (toàn công ty)
 */
export function routeUserToAgent(context: UserContext): DepartmentAgent {
  // Admin → System agent
  if (context.role === 'Admin') {
    return agentDefinitions['SYSTEM'];
  }

  // Leadership → BGD agent
  if (context.role === 'Leadership') {
    return agentDefinitions['BGD'];
  }

  // Kế toán → TCKT agent (nếu active, else BGD)
  if (context.role === 'Accountant' || context.role === 'ChiefAccountant') {
    const tckt = agentDefinitions['TCKT'];
    return tckt?.isActive ? tckt : agentDefinitions['BGD'];
  }

  // Pháp chế → BGD (xem toàn công ty)
  if (context.role === 'Legal') {
    return agentDefinitions['BGD'];
  }

  // Match unitCode → agent tương ứng (chỉ nếu agent active)
  const unitCode = (context.unitCode || '').toUpperCase();
  if (unitCode && agentDefinitions[unitCode]) {
    const agent = agentDefinitions[unitCode];
    if (agent.isActive) {
      return agent;
    }
  }

  // Fallback: dùng BGD agent (C-Level, xem toàn công ty)
  return agentDefinitions['BGD'];
}

/**
 * Lấy danh sách agents mà user được phép xem/chuyển đổi.
 * 
 * - GLOBAL_VIEW_ROLES (Admin, Leadership, Accountant...) → tất cả agents
 * - UNIT_SCOPED_ROLES (NVKD, NVKT...) → chỉ agent đơn vị mình + SYSTEM + BGD
 */
export function getVisibleAgents(context: UserContext): DepartmentAgent[] {
  const globalRoles = ['Admin', 'Leadership', 'Legal', 'Accountant', 'ChiefAccountant'];
  const allAgents = Object.values(agentDefinitions);

  if (globalRoles.includes(context.role)) {
    return allAgents;
  }

  // Unit-scoped: chỉ thấy agent đơn vị mình + BGD + SYSTEM  
  const unitCode = (context.unitCode || '').toUpperCase();
  return allAgents.filter(a => 
    a.departmentId === '*' || // BGD, SYSTEM
    a.departmentId === unitCode
  );
}
