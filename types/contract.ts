export type ContractStatus =
  | 'Processing'      // Đang thực hiện (sau khi ký)
  | 'Suspended'       // Tạm dừng/Huỷ
  | 'Handover'        // Bàn giao
  | 'Acceptance'      // Nghiệm thu/Thanh lý
  | 'Completed';      // Hoàn thành (tự động khi VAT ≥ value + tiền về ≥ value)

/**
 * Contract warning flags (not statuses — displayed as badges/banners)
 */
export interface ContractWarnings {
  isOverdueAdvance: boolean;    // QH tạm ứng: kế hoạch tạm ứng quá hạn + chưa nhận tiền
  isOverduePayment: boolean;    // QH thanh toán: đã xuất HĐ VAT + quá hạn + tiền chưa về đủ
  isAcceptedNoInvoice: boolean; // Nghiệm thu chưa xuất HĐ VAT
}
export type ImplementationStage = 'Signed' | 'Advanced' | 'Guaranteed' | 'InputOrdered' | 'Implementation' | 'Completed' | 'Invoiced';
export type ContractType = 'HĐ' | 'VV';
export type ContractClassification = 'Thông thường' | 'Bán qua đại lý' | 'Khách bị LC' | 'Hỗ trợ đối tác' | 'Khác';

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
  formula?: string; // Công thức gốc (VD: "1000*70%") — lưu để hiện lại khi mở form
}

export interface ForeignCurrencyInfo {
  amount: number;   // Đơn giá ngoại tệ (VD: 3136.5) — kết quả tính từ formula
  rate: number;     // Tỷ giá (VD: 26500)
  currency: string; // "USD" | "EUR"
  formula?: string; // Công thức gốc nếu có (VD: "22*(33+44)")
  isCustomRate?: boolean; // Đánh dấu tỷ giá đã được chốt cố định (không bị ghi đè bởi VCB)
}

export interface LineItem {
  id: string;
  name: string;
  productId?: string;        // Link đến sản phẩm gốc (để thống kê phân tích)
  productName?: string;      // Tên SP gốc (cache, không cần JOIN)
  quantity: number;
  supplier: string;
  supplierId?: string; // ID for reliable SearchableSelect matching
  manufacturer?: string; // Hãng sản xuất
  manufacturerId?: string; // ID of manufacturer in customers table
  inputPrice: number;
  outputPrice: number;
  directCosts: number;
  directCostDetails?: DirectCostDetail[];
  foreignCurrency?: ForeignCurrencyInfo; // Thông tin ngoại tệ (nếu có)
  vatRate: number;            // Thuế suất VAT (0, 8, 10) - mỗi SP có thể khác
  inputPriceFormula?: string;  // Công thức gốc giá đầu vào (VD: "2000*(222+333)")
  outputPriceFormula?: string; // Công thức gốc giá đầu ra
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
  formula?: string;       // Công thức gốc (VD: "1000*70%") — lưu để hiện lại khi mở form
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

/**
 * Workflow steps configuration for automatic task generation
 * Each boolean flag represents a business step in the contract lifecycle
 */
export interface ContractWorkflowSteps {
  // Giai đoạn Ký kết
  guarantee_performance: boolean; // Làm BL thực hiện HĐ (Kế toán)
  advance_procedure: boolean;     // Thủ tục tạm ứng
  advance_has_guarantee: boolean; // BL tạm ứng (sub của advance, Kế toán)
  advance_deadline_days: number;  // Số ngày hạn tạm ứng (default 20)

  // Giai đoạn Triển khai
  import_goods: boolean;          // Nhập hàng (checklist = SP/DV)
  subcontract: boolean;           // Ký HĐ thầu phụ
  implementation: boolean;        // Triển khai thực hiện (HĐ dịch vụ)
  training: boolean;              // Đào tạo chuyển giao

  // Giai đoạn Nghiệm thu & Thanh toán
  warranty_procedure: boolean;    // Thủ tục bảo hành
  warranty_has_guarantee: boolean;// BL bảo hành (sub, Kế toán)
  payment_other_docs: boolean;    // Giấy tờ khác trong thủ tục TT
}

export const DEFAULT_WORKFLOW_STEPS: ContractWorkflowSteps = {
  guarantee_performance: false,
  advance_procedure: false,
  advance_has_guarantee: false,
  advance_deadline_days: 20,
  import_goods: false,
  subcontract: false,
  implementation: false,
  training: false,
  warranty_procedure: false,
  warranty_has_guarantee: false,
  payment_other_docs: false,
};


export interface Contract {
  id: string;
  contractCode: string; // Mã hợp đồng (editable, hiển thị trên UI)
  title: string;
  contractType: ContractType;
  customerId: string; // FK to Customer
  isDealerSale?: boolean; // Bán qua đại lý
  hasVat?: boolean; // Hợp đồng có VAT (default true)
  vatRate?: number; // Thuế suất VAT (0, 8, 10) - default 10
  endUserId?: string; // FK to Customer (End user khi bán qua đại lý)
  endUserName?: string; // Tên người dùng cuối
  endUser2Id?: string; // FK to Customer (End user 2 khi bán qua đại lý)
  endUser2Name?: string; // Tên người dùng cuối 2
  customerContractNumber?: string; // Số hợp đồng khách hàng
  paymentTermDays?: number; // Hạn thanh toán (số ngày)
  partyA: string;
  partyB: string;
  clientInitials: string;
  contacts: ContractContact[];
  content: string;
  signedDate: string;
  startDate: string;
  endDate: string;
  value: number; // Sum(outputPrice * quantity * (1 + vatRate/100))
  estimatedCost: number; // Sum(inputPrice * quantity) + directCosts + executionCosts
  actualRevenue: number;
  expectedRevenue?: number; // Doanh thu dự kiến trước thuế (DB expected_revenue hoặc computed)
  margin?: number;          // Tỷ suất lợi nhuận gộp quản trị (%)
  invoicedAmount?: number; // Đã xuất hóa đơn
  cashReceived?: number; // Tiền về thực tế (tổng paid_amount từ payments)
  advanceAmount?: number; // Tạm ứng — tiền đã nhận chưa xuất HĐ
  receivables?: number; // Công nợ phải thu (Receivables) = Tổng giá trị xuất hoá đơn sau VAT - Tổng tiền về thực tế
  payables?: number; // Công nợ phải trả (Payables) = Tổng giá đầu vào từ nhà cung cấp - Tổng chi cho nhà cung cấp
  adminProfit?: number; // Lợi nhuận gộp quản trị = Doanh thu dự kiến - Chi phí dự kiến
  revProfit?: number; // Lợi nhuận gộp theo doanh thu
  actualCost: number;
  status: ContractStatus;
  stage: ImplementationStage;
  category: string;
  classification?: ContractClassification; // Phân loại HĐ: Thông thường, Bán qua đại lý, Khách bị LC...
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
  notes?: string; // Ghi chú hợp đồng (điều khoản thanh toán, giao hàng theo đợt...)
  // Status transition dates (mốc ngày chuyển trạng thái)
  suspendedDate?: string;   // Ngày tạm dừng/huỷ
  handoverDate?: string;    // Ngày bàn giao
  acceptanceDate?: string;  // Ngày nghiệm thu/thanh lý
  acceptanceValue?: number; // Giá trị nghiệm thu (mặc định = giá trị ký kết)
  completedDate?: string;   // Ngày hoàn thành (auto = max ngày HĐ VAT cuối, ngày phiếu thu cuối)
  // Warning flags (computed, not stored in DB)
  warnings?: ContractWarnings;
  // Legacy parallel approval workflow fields (kept for backward compat)
  legal_approved?: boolean;
  finance_approved?: boolean;
  
  // Workflow-driven task system
  workflowSteps?: ContractWorkflowSteps;
  
  // Tasks (Form payload only — legacy manual tasks)
  selectedTaskTemplateId?: string | null;
  customTasks?: any[];
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
