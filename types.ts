/**
 * CIC ERP Contract — Type Definitions (Barrel Re-export)
 * 
 * ⚠️ DEPRECATED: Import trực tiếp từ '@/types' thay vì './types'
 * File này chỉ re-export từ types/ directory để giữ backward compatibility.
 * 
 * Tất cả type definitions đã được tách thành modules:
 *   types/common.ts     — Report, KPIPlan, HistoricalProduction
 *   types/contract.ts   — Contract, LineItem, Milestone, PaymentPhase
 *   types/customer.ts   — Customer, CustomerContact, CustomerBank
 *   types/employee.ts   — Employee, Unit
 *   types/product.ts    — Product, Brand, ProductSupplier
 *   types/payment.ts    — Payment, VATInvoiceLineItem, VoucherType
 *   types/workflow.ts   — UserRole, UserProfile, RBAC, PAKD
 *   types/chat.ts       — ChatRoom, ChatMessage, NotificationItem
 *   types/project.ts    — BIMProject, BIMProjectStatus
 */

export * from './types/index';
