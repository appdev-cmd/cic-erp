export * from './contractService';
export * from './productService';
export * from './unitService';
export * from './customerService';
export * from './employeeService';
export * from './employeeDocumentService';
export * from './employeeTimelineService';
export * from './paymentService';
export * from './documentService';
export * from './workflowService';
export * from './auditLogService';
export * from './permissionService';
export { TaxLookupService } from './taxLookupService';
export { UnitVisibilityService } from './unitVisibilityService';
export { CrmLeadService, CrmDealService, CrmStageTemplateService, CrmActivityService, CrmDealProductService, CrmCompletionService, CrmAssignmentService } from './crmService';
export type { CrmUnitAssignmentConfig, CrmAssignmentBalanceStat } from './crmService';
export { CrmIntelligenceService } from './crmIntelligenceService';
export { CrmSeedService } from './crmSeedService';
export * from './ExecutionCostService';
export * from './googleDriveService';
export * from './driveInitService';
export * from './brandService';
export * from './employeeTargetService';
export * from './historicalProductionService';
export * from './companyTargetService';

export * from './productLineService';
export * from './productEditionService';

// Task Management
export * from './taskService';
export * from './taskCommentService';
export * from './entityRegistryService';
export * from './autoTaskEngine';
export * from './discussionService';

// BIM Projects
export * from './projectService';

// News & Web Posts
export * from './newsService';

// Personal Tags
export * from './contractTagService';

// Re-export specific APIs as legacy aliases if needed, or prefer using *Service naming.
// To maintain compatibility with existing 'api.ts' consumers, we might want to update 'api.ts' to re-export these,
// or update consumers.
