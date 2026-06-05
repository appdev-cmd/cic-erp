/**
 * CIC ERP Contract — Type Definitions
 * 
 * Barrel file re-exporting all domain types.
 * Import from here: import { Contract, Customer, Employee } from '@/types';
 */

// Common shared types
export type { Report, ReportType, KPIPlan, HistoricalProduction } from './common';

// Contract domain
export type {
  ContractStatus, ContractWarnings, ImplementationStage, ContractType,
  ContractClassification, Milestone, PaymentPhase, ContractContact,
  DirectCostDetail, ForeignCurrencyInfo, LineItem, RevenueSchedule,
  PaymentSchedule, AdministrativeCosts, ExecutionCostItem, UnitAllocation,
  EmployeeAllocation, ContractWorkflowSteps, Contract, ContractDocument,
} from './contract';
export { DEFAULT_WORKFLOW_STEPS } from './contract';

// Customer domain
export type { Customer, CustomerContact, CustomerBank } from './customer';

// Employee & Unit domain
export type { Employee, Unit, EmployeeTimeline, EmployeeTimelineType } from './employee';

// Product domain
export type { ProductCategory, LicenseType, Brand, ProductSupplier, Product } from './product';

// Payment domain
export type {
  VoucherType, ExpenseCategory, VATInvoiceLineItem,
  PaymentStatus, PaymentMethod, Payment,
} from './payment';

// Workflow & Permissions
export type {
  UserRole, UserProfile, PlanStatus, BusinessPlan,
  ReviewAction, ReviewRole, ContractReview,
  PermissionAction, PermissionResource, UserPermission,
  PAKDLineItem, PAKDDynamicCost, PAKDRecord,
} from './workflow';
export { DEFAULT_ROLE_PERMISSIONS } from './workflow';

// Chat & Notifications
export type {
  ChatRoomType, ChatMessageType, ChatRoom, ChatMember, ChatMessage,
  ChatRoomWithDetails, ChatMemberWithProfile, ChatMessageWithSender,
  NotificationType, NotificationItem,
} from './chat';

// BIM Project domain
export type { BIMProjectStatus, BIMProject } from './project';
export { BIM_PROJECT_STATUS_LABELS } from './project';

// News & Web Content domain
export type { PostStatus, PostCategory, NewsPost } from './news';

// CRM domain
export type {
  CrmStageTemplate, CrmStage, CrmLead, CrmDeal,
  CrmActivity, CrmDealProduct
} from './crm';
