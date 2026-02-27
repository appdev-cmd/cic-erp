
export type ContractStatus = 'Active' | 'Pending' | 'Expired' | 'Terminated' | 'Reviewing' | 'Completed';
export type ImplementationStage = 'Signed' | 'Advanced' | 'Guaranteed' | 'InputOrdered' | 'Implementation' | 'Completed' | 'Invoiced';
export type ContractType = 'HĐ' | 'VV';

export interface KPIPlan {
  signing: number;
  revenue: number;
  adminProfit: number; // LNG Quản trị (Dựa trên giá trị ký)
  revProfit: number;   // LNG theo DT (Dựa trên doanh thu thực tế)
  cash: number;        // Tiền về thực tế
}

export interface Employee {
  id: string;
  name: string;
  unitId: string;
  avatar?: string;
  target: KPIPlan;
  // General info
  email?: string;
  phone?: string;
  telegram?: string; // Tài khoản Telegram
  position?: string; // Chức vụ
  department?: string; // Phòng ban / Khối
  roleCode?: string; // Mã role hệ thống
  dateJoined?: string; // Ngày vào công ty
  employeeCode?: string; // Mã nhân viên
  // HR fields
  dateOfBirth?: string; // Ngày sinh
  gender?: 'male' | 'female' | 'other';
  address?: string; // Địa chỉ
  education?: string; // Trình độ học vấn
  specialization?: string; // Chuyên ngành
  certificates?: string; // Chứng chỉ
  idNumber?: string; // CCCD/CMND
  bankAccount?: string; // Số tài khoản (thuộc hợp đồng)
  bankName?: string; // Tên ngân hàng (thuộc hợp đồng)
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  emergencyContact?: string; // Người liên hệ khẩn cấp
  emergencyPhone?: string; // SĐT khẩn cấp
  contractType?: string; // Loại hợp đồng LĐ
  contractEndDate?: string; // Ngày hết hạn HĐ
}

export interface Unit {
  id: string;
  name: string;
  type: 'Company' | 'Branch' | 'Center' | 'BackOffice';
  code: string;
  target: KPIPlan;
  lastYearActual?: KPIPlan; // Dữ liệu năm trước để so sánh YoY
  functions?: string; // Chức năng nhiệm vụ
  // New fields from Phase 2 enhancement
  managerId?: string; // ID of unit manager (references employees)
  logoUrl?: string; // URL to unit logo/avatar
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  parentId?: string; // Parent unit for org chart hierarchy
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Represents a key milestone in contract implementation
 */
export interface Milestone {
  id: string;
  name: string;
  status: 'Completed' | 'Ongoing' | 'Planned';
  date: string;
  description?: string;
}

/**
 * Represents a payment phase/roadmap
 */
export interface PaymentPhase {
  id: string;
  name: string;
  dueDate: string;
  status: 'Paid' | 'Overdue' | 'Pending';
  percentage: number;
  amount: number;
  type?: 'Revenue' | 'Expense'; // Thu hoặc Chi
}

/**
 * Represents a contact person at the client organization
 */
export interface ContractContact {
  id: string;
  name: string;
  role: string;
}

/**
 * Represents an individual line item in the contract
 */
export interface DirectCostDetail {
  id: string;
  name: string;
  amount: number;
}

export interface ForeignCurrencyInfo {
  amount: number;   // Đơn giá ngoại tệ (VD: 3136.5)
  rate: number;     // Tỷ giá (VD: 26500)
  currency: string; // "USD" | "EUR"
}

export interface LineItem {
  id: string;
  name: string;
  quantity: number;
  supplier: string;
  inputPrice: number;
  outputPrice: number;
  directCosts: number;
  directCostDetails?: DirectCostDetail[];
  foreignCurrency?: ForeignCurrencyInfo; // Thông tin ngoại tệ (nếu có)
  vatRate: number;            // Thuế suất VAT (0, 8, 10) - mỗi SP có thể khác
  supplierDiscount: number;   // % chiết khấu từ NCC cho SP này
}

/**
 * Represents a scheduled revenue recognition event
 */
export interface RevenueSchedule {
  id: string;
  date: string;
  amount: number;
  description: string;
}

/**
 * Represents a scheduled payment event
 */
export interface PaymentSchedule {
  id: string;
  date: string;
  amount: number;
  description: string;
  status?: 'Paid' | 'Overdue' | 'Pending';
  percentage?: number;
  type?: 'Revenue' | 'Expense';
}

/**
 * Represents administrative and overhead costs
 */
export interface AdministrativeCosts {
  transferFee: number;
  contractorTax: number;
  importFee: number;
  expertHiring: number;
  documentProcessing: number;
}

/**
 * Represents a single execution cost item (dynamic list)
 * Replaces the fixed AdministrativeCosts fields for flexibility
 */
export interface ExecutionCostItem {
  id: string;
  name: string;           // Tên hạng mục (e.g., "Phí chuyển tiền", "Thuế nhà thầu")
  amount: number;         // Số tiền (VND)
  percentage?: number;    // % tính theo Giá trị ký kết (optional)
  note?: string;          // Ghi chú
}

/**
 * Represents a unit allocation for business coordination (QĐ 09.2024)
 * Allows multiple units to share contract KPIs with percentage distribution
 */
export interface UnitAllocation {
  unitId: string;         // ID của đơn vị
  employeeId: string;     // Nhân viên phụ trách của đơn vị này
  percent: number;        // % phân bổ (0-100)
  role: 'lead' | 'support'; // Vai trò: lead = đơn vị thực hiện, support = đơn vị phối hợp
}
/**
 * Represents an employee allocation for multi-person assignment
 * Allows multiple employees to share contract work with percentage distribution
 */
export interface EmployeeAllocation {
  employeeId: string;   // ID nhân viên
  percent: number;      // % phân bổ (0-100)
  role: 'lead' | 'member'; // lead = NV chính, member = NV phối hợp
}


export interface Contract {
  id: string;
  title: string;
  contractType: ContractType;
  customerId: string; // FK to Customer
  isDealerSale?: boolean; // Bán qua đại lý
  hasVat?: boolean; // Hợp đồng có VAT (default true)
  vatRate?: number; // Thuế suất VAT (0, 8, 10) - default 10
  endUserId?: string; // FK to Customer (End user khi bán qua đại lý)
  endUserName?: string; // Tên người dùng cuối
  partyA: string;
  partyB: string;
  clientInitials: string;
  contacts: ContractContact[];
  content: string;
  signedDate: string;
  startDate: string;
  endDate: string;
  value: number;
  estimatedCost: number;
  actualRevenue: number;
  invoicedAmount?: number; // Đã xuất hóa đơn
  cashReceived?: number; // Tiền về thực tế (tổng paid_amount từ payments)
  actualCost: number;
  status: ContractStatus;
  stage: ImplementationStage;
  category: string;
  unitId: string;
  coordinatingUnitId?: string; // Đơn vị phối hợp (Legacy - backward compatibility)
  unitAllocations?: UnitAllocation[]; // Phân bổ đơn vị phối hợp với % (QĐ 09.2024)
  salespersonId: string;              // Legacy: NV chính (backward compat)
  employeeAllocations?: EmployeeAllocation[]; // Phân bổ NV thực hiện với %
  lineItems?: LineItem[];
  adminCosts?: AdministrativeCosts;        // Legacy: fixed fields
  executionCosts?: ExecutionCostItem[];    // New: dynamic list of execution costs
  milestones?: Milestone[];
  revenueSchedules?: RevenueSchedule[]; // Lịch xuất hóa đơn doanh thu
  paymentPhases?: PaymentPhase[];
  documents?: ContractDocument[];
  draft_url?: string; // URL to draft contract document (Google Doc) for legal review
  // Parallel approval workflow fields
  legal_approved?: boolean; // Whether Legal has approved (for parallel review)
  finance_approved?: boolean; // Whether Finance has approved (for parallel review)
}

export interface ContractDocument {
  id: string;
  contractId: string;
  name: string;
  url: string;
  filePath: string;
  type?: string;
  size?: number;
  uploadedAt: string;
}

/**
 * Represents a customer/client organization
 */
export interface Customer {
  id: string;
  name: string;
  shortName: string;
  industry: 'Xây dựng' | 'Bất động sản' | 'Năng lượng' | 'Công nghệ' | 'Sản xuất' | 'Khác';
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxCode?: string;
  website?: string;
  notes?: string;
  // Bank info for payments
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
  foundedDate?: string;
  type?: 'Customer' | 'Supplier' | 'Both';
  stats?: {
    contractCount: number;
    totalValue: number;
    totalRevenue: number;
    activeContracts: number;
  };
}

/**
 * Product/Service category type
 */
export type ProductCategory = 'Phần mềm' | 'Tư vấn' | 'Thiết kế' | 'Thi công' | 'Bảo trì' | 'Đào tạo' | 'Khác';

/**
 * Represents a product or service offering
 */
export interface Product {
  id: string;
  code: string;
  name: string;
  category: ProductCategory;
  description: string;
  unit: string; // đơn vị tính: gói, m2, ngày công, etc.
  basePrice: number;
  costPrice?: number;
  isActive: boolean;
  unitId?: string; // đơn vị kinh doanh phụ trách
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Payment status type - Vietnamese
 * Đã xuất HĐ = Invoiced but not paid
 * Tiền về = Cash received
 */
export type PaymentStatus = 'Chờ xuất HĐ' | 'Đã xuất HĐ' | 'Tiền về' | 'Quá hạn' | 'Paid' | 'Pending' | 'Overdue';

/**
 * Payment method type
 */
export type PaymentMethod = 'Chuyển khoản' | 'Tiền mặt' | 'LC' | 'Khác';

/**
 * Represents a payment record
 */
export interface Payment {
  id: string;
  contractId: string;
  customerId: string;
  phaseId?: string; // Link to PaymentPhase if applicable
  paymentDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  bankAccount?: string;
  reference?: string; // Số chứng từ, UNC
  invoiceNumber?: string;
  notes?: string;
  paymentType: 'Revenue' | 'Expense'; // Thu hoặc Chi
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Customer bank information (for payments)
 */
export interface CustomerBank {
  bankName: string;
  bankBranch?: string;
  accountNumber: string;
  accountHolder: string;
}


// ============================================
// WORKFLOW & PERMISSIONS
// ============================================

export type UserRole = 'Admin' | 'NVKD' | 'AdminUnit' | 'UnitLeader' | 'Accountant' | 'ChiefAccountant' | 'Legal' | 'Leadership';

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
  | 'settings'
  | 'permissions';

export interface UserPermission {
  id?: string;
  userId: string;
  resource: PermissionResource;
  actions: PermissionAction[];
  createdAt?: string;
  updatedAt?: string;
}

// Default permissions by role
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Partial<Record<PermissionResource, PermissionAction[]>>> = {
  // Quản trị hệ thống — Toàn quyền
  Admin: {
    contracts: ['view', 'create', 'update', 'delete'],
    employees: ['view', 'create', 'update', 'delete'],
    units: ['view', 'create', 'update', 'delete'],
    customers: ['view', 'create', 'update', 'delete'],
    products: ['view', 'create', 'update', 'delete'],
    payments: ['view', 'create', 'update', 'delete'],
    settings: ['view', 'create', 'update', 'delete'],
    permissions: ['view', 'create', 'update', 'delete'],
  },
  // Ban lãnh đạo — Toàn quyền trên dữ liệu, KHÔNG truy cập settings/permissions
  Leadership: {
    contracts: ['view', 'create', 'update', 'delete'],
    employees: ['view', 'create', 'update', 'delete'],
    units: ['view', 'create', 'update', 'delete'],
    customers: ['view', 'create', 'update', 'delete'],
    products: ['view', 'create', 'update', 'delete'],
    payments: ['view', 'create', 'update', 'delete'],
  },
  // Admin đơn vị — Nhập liệu HĐ/KH, theo dõi thanh toán (phạm vi đơn vị)
  AdminUnit: {
    contracts: ['view', 'create', 'update'],       // Không xóa
    employees: ['view'],                             // Chỉ xem
    units: ['view'],
    customers: ['view', 'create', 'update'],        // Không xóa
    products: ['view'],
    payments: ['view', 'create'],                   // Chỉ nhập dự kiến, không sửa/xóa thực tế
  },
  // Lãnh đạo đơn vị — Quản lý đơn vị, xem báo cáo
  UnitLeader: {
    contracts: ['view', 'create', 'update'],        // Sửa toàn bộ HĐ đơn vị, không xóa
    employees: ['view', 'update'],                   // Sửa NV đơn vị mình, không tạo/xóa
    units: ['view'],
    customers: ['view', 'create', 'update'],        // Không xóa
    products: ['view'],
    payments: ['view', 'create'],                   // Chỉ nhập dự kiến
  },
  // Nhân viên kinh doanh — Nhập liệu HĐ/KH (phạm vi đơn vị, chỉ HĐ của mình)
  NVKD: {
    contracts: ['view', 'create', 'update'],        // Chỉ sửa HĐ mình tạo/phân công
    employees: ['view'],
    units: ['view'],
    customers: ['view', 'create', 'update'],        // Không xóa
    products: ['view'],
    payments: ['view', 'create'],                   // Chỉ nhập dự kiến
  },
  // Kế toán — Ghi nhận tài chính thực tế, xem toàn công ty
  Accountant: {
    contracts: ['view', 'update'],                  // Update = cập nhật thông tin tài chính
    employees: ['view'],
    units: ['view'],
    customers: ['view'],
    products: ['view'],
    payments: ['view', 'create', 'update'],         // Thêm/sửa thực tế, không xóa
  },
  // Kế toán trưởng — Phê duyệt tài chính, xem toàn công ty
  ChiefAccountant: {
    contracts: ['view', 'update'],                  // Update = cập nhật thông tin tài chính
    employees: ['view'],
    units: ['view'],
    customers: ['view'],
    products: ['view'],
    payments: ['view', 'create', 'update', 'delete'], // Toàn quyền thanh toán
  },
  // Pháp chế — Rà soát pháp lý, xem toàn công ty
  Legal: {
    contracts: ['view'],                            // Chỉ xem, rà soát pháp lý
    employees: ['view'],
    units: ['view'],
    customers: ['view'],
    products: ['view'],
    payments: ['view'],
  },
};
