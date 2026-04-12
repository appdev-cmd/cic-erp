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
