
export type ContractStatus =
  | 'Draft'           // Mới tạo, chưa gửi duyệt
  | 'Pending_Review'  // Đang chờ Pháp lý + Tài chính duyệt song song
  | 'Both_Approved'   // Cả hai bên đã duyệt
  | 'Pending_Sign'    // Chờ lãnh đạo ký
  | 'Processing'      // Đang thực hiện (sau khi ký)
  | 'Suspended'       // Tạm dừng/Huỷ
  | 'Overdue_Advance' // Quá hạn tạm ứng (tự động)
  | 'Handover'        // Bàn giao
  | 'Acceptance'      // Nghiệm thu/Thanh lý
  | 'Overdue_Payment' // Quá hạn thanh toán (tự động)
  | 'Liquidated'      // Legacy: gộp vào Acceptance
  | 'Completed';      // Hoàn thành (tự động khi tiền về = giá trị ký)
export type ImplementationStage = 'Signed' | 'Advanced' | 'Guaranteed' | 'InputOrdered' | 'Implementation' | 'Completed' | 'Invoiced';
export type ContractType = 'HĐ' | 'VV';

export interface KPIPlan {
  signing: number;
  revenue: number;
  adminProfit: number; // LNG Quản trị (Dựa trên giá trị ký)
  revProfit: number;   // LNG theo DT (Dựa trên doanh thu thực tế)
  cash: number;        // Tiền về thực tế
}

export interface HistoricalProduction {
  id?: string;
  unitId: string;
  year: number;
  month?: number | null; // null = yearly aggregate, 1-12 = monthly
  signing: number;     // Ký kết (triệu đồng)
  revenue: number;     // Doanh thu thực hiện (triệu đồng)
  adminProfit: number; // LNG Quản trị (triệu đồng)
  revProfit: number;   // LNG theo Doanh thu (triệu đồng)
  notes?: string;
  updatedBy?: string;
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
  targetMembers?: string[]; // Employee IDs assigned to KPI/signing tab
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
  status: 'Paid' | 'Overdue' | 'Pending' | 'Advance';
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
  customerContractNumber?: string; // Số hợp đồng khách hàng
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
  advanceAmount?: number; // Tạm ứng — tiền đã nhận chưa xuất HĐ
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
  industry: string[];
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
  // Extended info (from masothue/GPKD)
  internationalName?: string;  // Tên quốc tế
  representative?: string;     // Người đại diện pháp luật
  businessType?: string;       // Loại hình DN (Cty CP, TNHH, DNTN...)
  businessStatus?: string;     // Tình trạng (Đang hoạt động, Ngừng...)
  // CRM fields
  rating?: 'VIP' | 'Gold' | 'Standard' | 'Lead';
  source?: string; // Website, Referral, Cold call, Event, Partner
  paymentTerms?: string; // NET30, NET60, COD, Prepaid
  creditLimit?: number;
  stats?: {
    contractCount: number;
    totalValue: number;
    totalRevenue: number;
    activeContracts: number;
  };
}

/**
 * Product/Service category type — kept as string for extensibility
 */
export type ProductCategory = string;

/**
 * Represents a brand/manufacturer
 */
export interface Brand {
  id: string;
  name: string;
  code?: string;
  logoUrl?: string;
  website?: string;
  country?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Represents a contact person at a customer/supplier organization
 */
export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  position?: string;
  department?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
  notes?: string;
  createdAt?: string;
}

/**
 * Represents a product-supplier relationship (N:N)
 */
export interface ProductSupplier {
  id: string;
  productId: string;
  supplierId: string;
  isPrimary: boolean;
  supplierPrice: number;
  discountPercent: number;
  leadTimeDays?: number;
  notes?: string;
  createdAt?: string;
  // Joined fields for display
  supplierName?: string;
}

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
  // CRM fields — Brand & Supplier linkage
  brandId?: string;
  supplierId?: string; // NCC chính
  sku?: string;
  model?: string;
  warrantyMonths?: number;
  // Joined fields for display
  brandName?: string;
  supplierName?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Loại phiếu tài chính (Voucher Type)
 */
export type VoucherType = 'VAT_INVOICE' | 'RECEIPT' | 'EXPENSE';

/**
 * Hạng mục chi phí
 */
export type ExpenseCategory =
  | 'Đặt hàng NCC'
  | 'Công tác phí'
  | 'Lắp đặt'
  | 'Cài đặt'
  | 'Đào tạo'
  | 'Chuyển giao'
  | 'Khác';

/**
 * Chi tiết sản phẩm/dịch vụ trong phiếu xuất HĐ VAT
 */
export interface VATInvoiceLineItem {
  lineItemId: string;       // ref to contract lineItem.id
  name: string;             // Tên SP/DV
  signingValue: number;     // Giá trị ký kết (outputPrice × quantity)
  revenuePercent: number;   // Tỷ lệ xuất doanh thu (default 100)
  amountBeforeVAT: number;  // = signingValue × revenuePercent / 100
  vatRate: number;           // % VAT (default 8)
  amountAfterVAT: number;   // = amountBeforeVAT × (1 + vatRate / 100)
}

/**
 * Payment status type
 * - Đã xuất HĐ, Đã giao KH: for VAT_INVOICE
 * - Tạm ứng, Tiền về: for RECEIPT
 * - Đề nghị chi, Đã chi: for EXPENSE
 */
export type PaymentStatus = 'Tạm ứng' | 'Đã xuất HĐ' | 'Tiền về' | 'Đề nghị chi' | 'Đã chi' | 'Đã giao KH';

/**
 * Payment method type
 */
export type PaymentMethod = 'Chuyển khoản' | 'Tiền mặt' | 'LC' | 'Khác';

/**
 * Represents a payment/financial record
 */
export interface Payment {
  id: string;
  contractId: string;
  customerId: string;
  phaseId?: string; // Link to PaymentPhase if applicable
  paymentDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number; // Kept for backward compat, equals amount when Tiền về
  status: PaymentStatus;
  method: PaymentMethod;
  bankAccount?: string;
  reference?: string; // Số chứng từ, UNC
  invoiceNumber?: string;
  invoiceDate?: string; // Ngày xuất HĐ
  externalInvoiceId?: string; // ID from accounting software
  source?: 'manual' | 'accounting_sync'; // Origin of the payment record
  notes?: string;
  paymentType: 'Revenue' | 'Expense'; // Thu hoặc Chi (auto-set theo voucherType)
  voucherType: VoucherType;             // Loại phiếu: HĐ VAT, Thu, Chi
  expenseCategory?: ExpenseCategory;    // Hạng mục chi (chỉ cho EXPENSE)
  vatAmount?: number;                   // Tổng thuế VAT (cho VAT_INVOICE)
  vatInvoiceItems?: VATInvoiceLineItem[]; // Chi tiết SP/DV phiếu VAT
  createdBy?: string;                   // ID người tạo phiếu
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

export type UserRole = 'Admin' | 'NVKD' | 'NVKT' | 'AdminUnit' | 'UnitLeader' | 'Accountant' | 'ChiefAccountant' | 'Legal' | 'Leadership';

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
    settings: ['view', 'create', 'update', 'delete'],
    permissions: ['view', 'create', 'update', 'delete'],
  },
  // Ban lãnh đạo — Toàn quyền dữ liệu, KHÔNG settings/permissions, payments chỉ xem
  Leadership: {
    contracts: ['view', 'create', 'update', 'delete'],
    employees: ['view', 'create', 'update', 'delete'],
    units: ['view', 'create', 'update', 'delete'],
    customers: ['view', 'create', 'update', 'delete'],
    products: ['view', 'create', 'update', 'delete'],
    payments: ['view'],                                  // §6.4: chỉ xem, không nhập/sửa/xóa
  },
  // Lãnh đạo đơn vị — HĐ/KH/SP: VCU, payments: chỉ xem (tạo phiếu cần cấp quyền qua Settings)
  UnitLeader: {
    contracts: ['view', 'create', 'update'],
    customers: ['view', 'create', 'update'],
    products: ['view', 'create', 'update'],
    payments: ['view'],                                  // Chỉ xem, tạo phiếu do Kế toán
  },
  // Admin đơn vị — HĐ/KH/SP: VCU, payments: chỉ xem
  AdminUnit: {
    contracts: ['view', 'create', 'update'],
    customers: ['view', 'create', 'update'],
    products: ['view', 'create', 'update'],
    payments: ['view'],                                  // Chỉ xem, tạo phiếu do Kế toán
  },
  // Nhân viên kinh doanh — HĐ/KH/SP: VCU, payments: chỉ xem
  NVKD: {
    contracts: ['view', 'create', 'update'],             // §6.2: chỉ sửa HĐ mình tạo/phân công
    customers: ['view', 'create', 'update'],
    products: ['view', 'create', 'update'],
    payments: ['view'],                                  // Chỉ xem, tạo phiếu do Kế toán
  },
  // Kế toán trưởng — Tài chính toàn quyền, xem NV, không units
  ChiefAccountant: {
    contracts: ['view', 'update'],                       // §6.2: cập nhật thông tin tài chính
    customers: ['view', 'create', 'update'],
    products: ['view', 'create', 'update'],
    payments: ['view', 'create', 'update', 'delete'],   // §6.4: toàn quyền thanh toán
    employees: ['view'],                                 // Confirmed: ChiefAccountant xem NV
  },
  // Kế toán — Ghi nhận tài chính, xem toàn công ty, KHÔNG employees
  Accountant: {
    contracts: ['view', 'update'],                       // §6.2: cập nhật thông tin tài chính
    customers: ['view', 'create', 'update'],
    products: ['view', 'create', 'update'],
    payments: ['view', 'create', 'update'],              // §6.4: thêm/sửa thực tế, không xóa
  },
  // Nhân viên kỹ thuật — Triển khai KT, hỗ trợ thực hiện HĐ, quản lý SP
  NVKT: {
    contracts: ['view'],                                 // Chỉ xem HĐ
    customers: ['view'],                                 // Chỉ xem KH
    products: ['view', 'create', 'update'],              // Quản lý kỹ thuật SP/DV
    payments: ['view'],                                  // Chỉ xem thanh toán
  },
  // Pháp chế — Rà soát, KHÔNG employees/units
  Legal: {
    contracts: ['view'],                                 // §6.2: chỉ xem
    customers: ['view', 'create', 'update'],
    products: ['view', 'create', 'update'],
    payments: ['view'],
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

// ============================================
// CHAT NỘI BỘ (Internal Messaging)
// ============================================

export type ChatRoomType = 'direct' | 'group' | 'contract';
export type ChatMessageType = 'text' | 'file' | 'image' | 'system';

export interface ChatRoom {
  id: string;
  name: string | null;
  type: ChatRoomType;
  avatar_url?: string | null;
  contract_id?: string | null;
  unit_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMember {
  room_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  type: ChatMessageType;
  metadata: Record<string, any>;
  reply_to?: string | null;
  is_edited: boolean;
  is_pinned?: boolean;
  pinned_by?: string | null;
  pinned_at?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  created_at: string;
  updated_at: string;
}

/** Extended room with last message + unread count for sidebar display */
export interface ChatRoomWithDetails extends ChatRoom {
  lastMessage?: ChatMessage | null;
  unreadCount: number;
  members: ChatMemberWithProfile[];
}

/** Member with joined user profile info */
export interface ChatMemberWithProfile extends ChatMember {
  profile?: {
    fullName: string;
    avatarUrl?: string;
    email?: string;
  };
}

/** Message with sender info attached */
export interface ChatMessageWithSender extends ChatMessage {
  sender?: {
    fullName: string;
    avatarUrl?: string;
  };
}

// ============================================
// NOTIFICATIONS (In-App)
// ============================================

export type NotificationType =
  | 'contract_created' | 'contract_updated' | 'contract_status_changed' | 'contract_deleted'
  | 'payment_created' | 'payment_updated' | 'payment_deleted'
  | 'workflow_submitted' | 'workflow_approved' | 'workflow_rejected'
  | 'mention';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}
