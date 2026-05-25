import type { ContractContact, PaymentPhase, Milestone, LineItem, ContractDocument, RevenueSchedule, AdministrativeCosts, ExecutionCostItem, UnitAllocation, EmployeeAllocation, ContractWorkflowSteps } from './contract';

// ============================================
// WORKFLOW & PERMISSIONS
// ============================================

export type UserRole = 'Admin' | 'NVKD' | 'NVKT' | 'AdminUnit' | 'UnitLeader' | 'Accountant' | 'ChiefAccountant' | 'Legal' | 'Leadership' | 'Marketing';

export interface UserProfile {
  id: string; // Links to auth.users
  email: string;
  fullName: string;
  role: UserRole;
  unitId?: string; // Links to Unit
  unitCode?: string; // Unit code (e.g. 'HCNS', 'DCS') for permission checks
  avatarUrl?: string;
  employeeId?: string; // Links to employees table (auto-matched by email)
}

export type PlanStatus = 'Draft' | 'Pending_Unit' | 'Pending_Finance' | 'Pending_Board' | 'Approved' | 'Rejected';

export interface BusinessPlan {
  id: string;
  contractId: string;
  version: number;
  status: PlanStatus;
  financials: {
    revenue: number;
    costs: number;
    grossProfit: number;
    margin: number;
    cashflow: PaymentPhase[]; // Using existing PaymentPhase structure
  };
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

export type ReviewAction = 'Approve' | 'Reject' | 'RequestChange' | 'Submit';
export type ReviewRole = 'Unit' | 'Finance' | 'Legal' | 'Board';

export interface ContractReview {
  id: string;
  contractId: string;
  planId?: string;
  reviewerId: string;
  role: ReviewRole;
  action: ReviewAction;
  comment?: string;
  createdAt: string;
}

// ============================================
// PERMISSIONS (RBAC)
// ============================================

export type PermissionAction = 'view' | 'create' | 'update' | 'delete';
export type PermissionResource =
  | 'contracts'
  | 'employees'
  | 'units'
  | 'customers'
  | 'products'
  | 'payments'
  | 'tasks'
  | 'settings'
  | 'permissions'
  | 'reports'
  | 'news'
  | 'projects'
  | 'requests'
  | 'leaves'
  | 'recruitment'
  | 'analytics'
  | 'crm';

export interface UserPermission {
  id?: string;
  userId: string;
  resource: PermissionResource;
  actions: PermissionAction[];
  createdAt?: string;
  updatedAt?: string;
}

// Default permissions by role — aligned with PHANQUYENHETHONG.md v1.0
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Partial<Record<PermissionResource, PermissionAction[]>>> = {
  // Quản trị hệ thống — Toàn quyền
  Admin: {
    contracts: ['view', 'create', 'update', 'delete'],
    employees: ['view', 'create', 'update', 'delete'],
    units: ['view', 'create', 'update', 'delete'],
    customers: ['view', 'create', 'update', 'delete'],
    products: ['view', 'create', 'update', 'delete'],
    payments: ['view', 'create', 'update', 'delete'],
    tasks: ['view', 'create', 'update', 'delete'],
    settings: ['view', 'create', 'update', 'delete'],
    permissions: ['view', 'create', 'update', 'delete'],
    reports: ['view', 'create', 'update', 'delete'],
    news: ['view', 'create', 'update', 'delete'],
    projects: ['view', 'create', 'update', 'delete'],
    requests: ['view', 'create', 'update', 'delete'],
    leaves: ['view', 'create', 'update', 'delete'],
    recruitment: ['view', 'create', 'update', 'delete'],
    analytics: ['view', 'create', 'update', 'delete'],
    crm: ['view', 'create', 'update', 'delete'],
  },
  // Ban lãnh đạo — Toàn quyền dữ liệu, KHÔNG settings/permissions, payments chỉ xem
  Leadership: {
    contracts: ['view', 'create', 'update', 'delete'],
    employees: ['view', 'create', 'update', 'delete'],
    units: ['view', 'create', 'update', 'delete'],
    customers: ['view', 'create', 'update', 'delete'],
    products: ['view', 'create', 'update', 'delete'],
    payments: ['view'],
    tasks: ['view', 'create', 'update', 'delete'],
    projects: ['view', 'create', 'update', 'delete'],
    requests: ['view', 'create', 'update', 'delete'],
    leaves: ['view', 'create', 'update', 'delete'],
    recruitment: ['view', 'create', 'update', 'delete'],
    analytics: ['view'],
    crm: ['view', 'create', 'update', 'delete'],
  },
  // Lãnh đạo đơn vị — HĐ/KH/SP: VCU, payments: chỉ xem (tạo phiếu cần cấp quyền qua Settings)
  UnitLeader: {
    contracts: ['view', 'create', 'update'],
    customers: ['view', 'create', 'update'],
    products: ['view', 'create', 'update'],
    payments: ['view'],
    tasks: ['view', 'create', 'update'],
    units: ['view', 'update'],
    requests: ['view', 'create', 'update'],
  },
  // Admin đơn vị — HĐ/KH/SP: VCU, payments: chỉ xem
  AdminUnit: {
    contracts: ['view', 'create', 'update'],
    customers: ['view', 'create', 'update'],
    products: ['view', 'create', 'update'],
    payments: ['view'],
    tasks: ['view', 'create', 'update'],
    units: ['view', 'update'],
    requests: ['view', 'create', 'update'],
  },
  // Nhân viên kinh doanh — HĐ/KH/SP: VCU, payments: chỉ xem
  NVKD: {
    contracts: ['view', 'create', 'update'],
    customers: ['view', 'create', 'update'],
    products: ['view', 'create', 'update'],
    payments: ['view'],
    tasks: ['view', 'create', 'update'],
    requests: ['view', 'create', 'update'],
  },
  // Kế toán trưởng — Tài chính toàn quyền, xem NV, không units
  ChiefAccountant: {
    contracts: ['view', 'update'],
    customers: ['view', 'create', 'update'],
    products: ['view', 'create', 'update'],
    payments: ['view', 'create', 'update', 'delete'],
    tasks: ['view', 'create', 'update'],
    employees: ['view'],
    requests: ['view', 'create', 'update'],
  },
  // Kế toán — Ghi nhận tài chính, xem toàn công ty, KHÔNG employees
  Accountant: {
    contracts: ['view', 'update'],
    customers: ['view', 'create', 'update'],
    products: ['view', 'create', 'update'],
    payments: ['view', 'create', 'update'],
    tasks: ['view', 'create', 'update'],
    requests: ['view', 'create', 'update'],
  },
  // Nhân viên kỹ thuật — Triển khai KT, hỗ trợ thực hiện HĐ, quản lý SP
  NVKT: {
    contracts: ['view'],
    customers: ['view'],
    products: ['view', 'create', 'update'],
    payments: ['view'],
    tasks: ['view', 'create', 'update'],
    requests: ['view', 'create', 'update'],
  },
  // Pháp chế — Rà soát, KHÔNG employees/units
  Legal: {
    contracts: ['view'],
    customers: ['view', 'create', 'update'],
    products: ['view', 'create', 'update'],
    payments: ['view'],
    tasks: ['view', 'create', 'update'],
    requests: ['view', 'create', 'update'],
  },
  // Marketing — Quảng bá, truyền thông, nội dung website
  // Xem: dự án, sản phẩm/DV, đối tác/khách hàng
  // Quản lý toàn quyền: tin tức, website
  Marketing: {
    projects: ['view'],                              // Xem dự án BIM để khai thác nội dung
    products: ['view', 'create', 'update'],          // Xem & cập nhật thông tin sản phẩm/DV
    customers: ['view'],                              // Xem đối tác/khách hàng (tham chiếu)
    news: ['view', 'create', 'update', 'delete'],// Toàn quyền nội dung website
    tasks: ['view', 'create', 'update'],          // Quản lý công việc của mình
    contracts: ['view'],                              // Xem hợp đồng (reference, không sửa)
    requests: ['view', 'create', 'update'],
  },
};

// ============================================
// LẬP PHƯƠNG ÁN KINH DOANH (PAKD)
// ============================================

export interface PAKDLineItem {
  id: string;
  productId?: string | null;
  name: string;
  quantity: number;
  sellPrice: number;
  costPrice: number;
}

export interface PAKDDynamicCost {
  id: string;
  name: string;
  amount: number;
}

export interface PAKDRecord {
  id: string;
  code: string; // Mã PAKD
  projectName: string;
  customerId: string | null;
  customerName: string;
  allocationType: 'branch' | 'unit';
  items: PAKDLineItem[];
  dynamicCosts: PAKDDynamicCost[];
  expertCost: number;
  group185: number;
  group25: number;
  groupOther: number;

  // Calculated fields
  totalRevenue: number;
  totalCosts: number;
  grossProfit: number;
  profitMargin: number;
  companyProfit: number;
  branchProfit: number;

  // Metadata
  department: string; // Đơn vị lập
  creator: string;    // Người lập
  createdAt: string;
  updatedAt: string;
}
