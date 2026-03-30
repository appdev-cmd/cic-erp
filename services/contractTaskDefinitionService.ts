import { dataClient as supabase } from '../lib/dataClient';
import { TaskService } from './taskService';
import type { CreateTaskInput, TaskPriority } from '../types/taskTypes';
import type { ContractWorkflowSteps, LineItem } from '../types';

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export type TaskDefinitionStatus = 'dormant' | 'activated' | 'skipped';
export type TaskDefinitionOrigin = 'manual' | 'template' | 'global_trigger';
export type MilestoneBaseDateType =
  | 'signed_date'
  | 'advance_completed'
  | 'handover_date'
  | 'acceptance_date'
  | 'invoice_date'
  | 'current_date'
  | 'completed_date';

export interface ContractTaskDefinition {
  id: string;
  contract_id: string;
  title: string;
  description: string;
  assignees: string[];
  priority: string;
  base_date_type: MilestoneBaseDateType;
  duration_days: number;
  status: TaskDefinitionStatus;
  task_id: string | null;
  activated_at: string | null;
  milestone_date: string | null;
  origin: TaskDefinitionOrigin;
  template_id: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskDefinitionInput {
  contract_id: string;
  title: string;
  description?: string;
  assignees?: string[];
  priority?: string;
  base_date_type: MilestoneBaseDateType;
  duration_days: number;
  origin?: TaskDefinitionOrigin;
  template_id?: string;
  sort_order?: number;
  created_by?: string;
}

export interface MilestoneTrigger {
  id: string;
  contract_id: string | null;
  trigger_event: string;
  task_config: {
    title: string;
    description?: string;
    base_date_type: MilestoneBaseDateType;
    duration_days: number;
    assignee_role?: 'creator' | 'salesperson' | 'unit_leader' | 'unit_admin' | 'accountant' | 'specific';
    assignee_id?: string;
    priority?: string;
    only_first?: boolean; // For VAT invoice: only trigger on first invoice
  };
  is_active: boolean;
  sort_order: number;
}

// ═══════════════════════════════════════
// MILESTONE → EVENT MAPPING
// ═══════════════════════════════════════

/**
 * Map contract status to base_date_type for dormant task lookup
 */
const STATUS_TO_MILESTONE: Record<string, MilestoneBaseDateType> = {
  'Handover': 'handover_date',
  'Acceptance': 'acceptance_date',
  'Completed': 'completed_date',
};

/**
 * Map contract status to trigger event string
 */
const STATUS_TO_TRIGGER_EVENT: Record<string, string> = {
  'Handover': 'status_change:Handover',
  'Acceptance': 'status_change:Acceptance',
  'Completed': 'status_change:Completed',
};

/**
 * Map payment voucher type to trigger event string
 */
const VOUCHER_TO_TRIGGER_EVENT: Record<string, string> = {
  'VAT_INVOICE': 'payment:VAT_INVOICE',
  'RECEIPT': 'payment:RECEIPT',
};

/**
 * Map payment voucher type to base_date_type
 */
const VOUCHER_TO_MILESTONE: Record<string, MilestoneBaseDateType> = {
  'VAT_INVOICE': 'invoice_date',
  'RECEIPT': 'advance_completed',
};

// ═══════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════

export const ContractTaskDefinitionService = {

  // ─── CRUD ──────────────────────────────

  /**
   * Create a single task definition
   */
  async create(input: CreateTaskDefinitionInput): Promise<ContractTaskDefinition> {
    const { data, error } = await supabase
      .from('contract_task_definitions')
      .insert({
        contract_id: input.contract_id,
        title: input.title,
        description: input.description || '',
        assignees: input.assignees || [],
        priority: input.priority || 'medium',
        base_date_type: input.base_date_type,
        duration_days: input.duration_days,
        origin: input.origin || 'manual',
        template_id: input.template_id || null,
        sort_order: input.sort_order || 0,
        created_by: input.created_by || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Bulk create task definitions (for template apply or Step 4 save)
   */
  async bulkCreate(inputs: CreateTaskDefinitionInput[]): Promise<ContractTaskDefinition[]> {
    if (inputs.length === 0) return [];

    const rows = inputs.map((input, idx) => ({
      contract_id: input.contract_id,
      title: input.title,
      description: input.description || '',
      assignees: input.assignees || [],
      priority: input.priority || 'medium',
      base_date_type: input.base_date_type,
      duration_days: input.duration_days,
      origin: input.origin || 'manual',
      template_id: input.template_id || null,
      sort_order: input.sort_order ?? idx,
      created_by: input.created_by || null,
    }));

    const { data, error } = await supabase
      .from('contract_task_definitions')
      .insert(rows)
      .select();

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all task definitions for a contract
   */
  async getByContract(contractId: string): Promise<ContractTaskDefinition[]> {
    const { data, error } = await supabase
      .from('contract_task_definitions')
      .select('*')
      .eq('contract_id', contractId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Update a task definition (only allowed when status = 'dormant')
   */
  async update(id: string, updates: Partial<Pick<ContractTaskDefinition, 
    'title' | 'description' | 'assignees' | 'priority' | 'base_date_type' | 'duration_days' | 'sort_order'
  >>): Promise<ContractTaskDefinition> {
    const { data, error } = await supabase
      .from('contract_task_definitions')
      .update(updates)
      .eq('id', id)
      .eq('status', 'dormant') // Only update dormant definitions
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Skip a dormant task definition (mark as skipped)
   */
  async skip(id: string): Promise<void> {
    const { error } = await supabase
      .from('contract_task_definitions')
      .update({ status: 'skipped' })
      .eq('id', id)
      .eq('status', 'dormant');

    if (error) throw error;
  },

  /**
   * Delete a task definition (only dormant allowed)
   */
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('contract_task_definitions')
      .delete()
      .eq('id', id)
      .eq('status', 'dormant');

    if (error) throw error;
  },

  // ─── ACTIVATION LOGIC ─────────────────

  /**
   * Activate dormant task definitions that match a specific milestone.
   * Called when a contract event occurs (status change, payment created, etc.)
   * 
   * @param contractId - The contract ID
   * @param baseDateType - The milestone that just occurred
   * @param milestoneDate - The actual date of the milestone
   * @param spaceId - Optional space_id for the created tasks
   */
  async activateByMilestone(
    contractId: string,
    baseDateType: MilestoneBaseDateType,
    milestoneDate: Date,
    spaceId?: string
  ): Promise<number> {
    // 1. Find dormant definitions matching this milestone
    const { data: dormant, error } = await supabase
      .from('contract_task_definitions')
      .select('*')
      .eq('contract_id', contractId)
      .eq('base_date_type', baseDateType)
      .eq('status', 'dormant');

    if (error) {
      console.error('[CTD] Failed to fetch dormant definitions:', error);
      return 0;
    }

    if (!dormant || dormant.length === 0) return 0;

    let activatedCount = 0;

    for (const def of dormant) {
      try {
        // 2. Calculate due date = milestone_date + duration_days
        const dueDate = new Date(milestoneDate);
        dueDate.setDate(dueDate.getDate() + (def.duration_days || 0));
        dueDate.setHours(23, 59, 59, 999);

        // 3. Create the actual task
        const taskInput: CreateTaskInput = {
          title: def.title,
          description: def.description || '',
          assignees: def.assignees || [],
          priority: (def.priority || 'medium') as TaskPriority,
          due_date: dueDate.toISOString(),
          start_date: milestoneDate.toISOString(),
          space_id: spaceId || undefined,
          source_module: 'contract',
          source_entity_id: contractId,
          auto_generated: true,
          tags: ['contract-task'],
        };

        const newTask = await TaskService.create(taskInput);

        // 4. Update definition: status = 'activated', link to task
        await supabase
          .from('contract_task_definitions')
          .update({
            status: 'activated',
            task_id: newTask.id,
            activated_at: new Date().toISOString(),
            milestone_date: milestoneDate.toISOString().split('T')[0],
          })
          .eq('id', def.id);

        activatedCount++;
        console.log(`[CTD] Activated "${def.title}" → task ${newTask.id} (due: ${dueDate.toISOString().split('T')[0]})`);

      } catch (err) {
        console.warn(`[CTD] Failed to activate "${def.title}":`, err);
      }
    }

    return activatedCount;
  },

  /**
   * Check all milestones for a contract and activate any dormant tasks
   * whose milestones have already occurred.
   * Called after contract create/update to catch immediate activations.
   */
  async checkAndActivateAll(
    contractId: string,
    contractData: {
      signed_date?: string;
      handover_date?: string;
      acceptance_date?: string;
      completed_date?: string;
      status?: string;
    },
    spaceId?: string
  ): Promise<number> {
    let totalActivated = 0;

    // signed_date: always available
    if (contractData.signed_date) {
      totalActivated += await this.activateByMilestone(
        contractId, 'signed_date', new Date(contractData.signed_date), spaceId
      );
    }

    // current_date: activate immediately
    totalActivated += await this.activateByMilestone(
      contractId, 'current_date', new Date(), spaceId
    );

    // handover_date
    if (contractData.handover_date) {
      totalActivated += await this.activateByMilestone(
        contractId, 'handover_date', new Date(contractData.handover_date), spaceId
      );
    }

    // acceptance_date
    if (contractData.acceptance_date) {
      totalActivated += await this.activateByMilestone(
        contractId, 'acceptance_date', new Date(contractData.acceptance_date), spaceId
      );
    }

    // completed_date
    if (contractData.completed_date) {
      totalActivated += await this.activateByMilestone(
        contractId, 'completed_date', new Date(contractData.completed_date), spaceId
      );
    }

    return totalActivated;
  },

  /**
   * Auto-skip all remaining dormant definitions when contract is Completed.
   * Called when contract status changes to 'Completed'.
   */
  async autoSkipOnCompleted(contractId: string): Promise<number> {
    const { data, error } = await supabase
      .from('contract_task_definitions')
      .update({ status: 'skipped' })
      .eq('contract_id', contractId)
      .eq('status', 'dormant')
      .select('id');

    if (error) {
      console.warn('[CTD] Failed to auto-skip dormant tasks:', error);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`[CTD] Auto-skipped ${count} dormant tasks for completed contract ${contractId}`);
    }
    return count;
  },

  // ─── GLOBAL TRIGGERS ──────────────────

  /**
   * Process global triggers for a contract event.
   * Finds matching triggers, creates definitions, and activates them immediately.
   * 
   * @param contractId - The contract affected
   * @param triggerEvent - The event string (e.g. 'status_change:Handover', 'payment:VAT_INVOICE')
   * @param milestoneDate - The date of the milestone
   * @param context - Additional context for resolving assignees
   */
  async processGlobalTriggers(
    contractId: string,
    triggerEvent: string,
    milestoneDate: Date,
    context: {
      creatorUserId?: string;
      salespersonId?: string;
      unitId?: string;
      spaceId?: string;
    }
  ): Promise<number> {
    // 1. Find matching active triggers (global or contract-specific)
    const { data: triggers, error } = await supabase
      .from('contract_milestone_triggers')
      .select('*')
      .eq('trigger_event', triggerEvent)
      .eq('is_active', true)
      .or(`contract_id.is.null,contract_id.eq.${contractId}`)
      .order('sort_order', { ascending: true });

    if (error || !triggers || triggers.length === 0) return 0;

    let created = 0;

    for (const trigger of triggers as MilestoneTrigger[]) {
      const config = trigger.task_config;
      if (!config?.title) continue;

      // For VAT_INVOICE with only_first: check if a definition already exists
      if (config.only_first) {
        const { data: existing } = await supabase
          .from('contract_task_definitions')
          .select('id')
          .eq('contract_id', contractId)
          .eq('origin', 'global_trigger')
          .ilike('title', config.title)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`[CTD] Skipping duplicate trigger "${config.title}" (only_first=true)`);
          continue;
        }
      }

      // 2. Resolve assignee
      const assignees = await resolveAssigneeFromRole(
        config.assignee_role,
        config.assignee_id,
        context
      );

      // 3. Create task definition
      const def = await this.create({
        contract_id: contractId,
        title: config.title,
        description: config.description || '',
        assignees,
        priority: config.priority || 'medium',
        base_date_type: config.base_date_type || 'current_date',
        duration_days: config.duration_days || 0,
        origin: 'global_trigger',
        created_by: context.creatorUserId,
      });

      // 4. Activate immediately (the milestone just occurred)
      try {
        const dueDate = new Date(milestoneDate);
        dueDate.setDate(dueDate.getDate() + (config.duration_days || 0));
        dueDate.setHours(23, 59, 59, 999);

        const newTask = await TaskService.create({
          title: config.title,
          description: config.description || '',
          assignees,
          priority: (config.priority || 'medium') as TaskPriority,
          due_date: dueDate.toISOString(),
          start_date: milestoneDate.toISOString(),
          space_id: context.spaceId,
          source_module: 'contract',
          source_entity_id: contractId,
          auto_generated: true,
          tags: ['contract-task', 'auto-trigger'],
        });

        await supabase
          .from('contract_task_definitions')
          .update({
            status: 'activated',
            task_id: newTask.id,
            activated_at: new Date().toISOString(),
            milestone_date: milestoneDate.toISOString().split('T')[0],
          })
          .eq('id', def.id);

        created++;
        console.log(`[CTD] Global trigger fired: "${config.title}" → task ${newTask.id}`);
      } catch (err) {
        console.warn(`[CTD] Failed to activate trigger task "${config.title}":`, err);
      }
    }

    return created;
  },

  // ─── CONTRACT LIFECYCLE HOOKS ──────────

  /**
   * Hook: Called when contract status changes.
   * Activates dormant tasks for the new status + fires global triggers.
   */
  async onContractStatusChange(
    contractId: string,
    newStatus: string,
    milestoneDate: Date,
    context: {
      creatorUserId?: string;
      salespersonId?: string;
      unitId?: string;
      spaceId?: string;
    }
  ): Promise<void> {
    // 1. If Completed → auto-skip all remaining dormant + fire completed trigger
    if (newStatus === 'Completed') {
      await this.autoSkipOnCompleted(contractId);
    }

    // 2. Activate dormant definitions matching this milestone
    const milestone = STATUS_TO_MILESTONE[newStatus];
    if (milestone) {
      await this.activateByMilestone(contractId, milestone, milestoneDate, context.spaceId);
    }

    // 3. Fire global triggers for this event
    const triggerEvent = STATUS_TO_TRIGGER_EVENT[newStatus];
    if (triggerEvent) {
      await this.processGlobalTriggers(contractId, triggerEvent, milestoneDate, context);
    }
  },

  /**
   * Hook: Called when a payment is created.
   * Activates dormant tasks and fires global triggers based on voucher type.
   */
  async onPaymentCreated(
    contractId: string,
    voucherType: string,
    paymentDate: Date,
    context: {
      creatorUserId?: string;
      salespersonId?: string;
      unitId?: string;
      spaceId?: string;
    }
  ): Promise<void> {
    // 1. Activate dormant definitions matching this payment type
    const milestone = VOUCHER_TO_MILESTONE[voucherType];
    if (milestone) {
      await this.activateByMilestone(contractId, milestone, paymentDate, context.spaceId);
    }

    // 2. Fire global triggers
    const triggerEvent = VOUCHER_TO_TRIGGER_EVENT[voucherType];
    if (triggerEvent) {
      await this.processGlobalTriggers(contractId, triggerEvent, paymentDate, context);
    }
  },

  // ─── TRIGGER MANAGEMENT ────────────────

  /**
   * Get all global triggers (for admin Settings UI)
   */
  async getGlobalTriggers(): Promise<MilestoneTrigger[]> {
    const { data, error } = await supabase
      .from('contract_milestone_triggers')
      .select('*')
      .is('contract_id', null)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Toggle a trigger's active status
   */
  async toggleTrigger(triggerId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('contract_milestone_triggers')
      .update({ is_active: isActive })
      .eq('id', triggerId);

    if (error) throw error;
  },

  // ─── WORKFLOW-DRIVEN TASK GENERATION ───────

  /**
   * Find accountant for a unit.
   * - CN HCM: tìm KT cùng unit_id
   * - Các đơn vị khác: tìm KT phòng TCKT (BackOffice unit)
   */
  async findAccountant(unitId: string): Promise<string | null> {
    // 1. Tìm KT cùng unit (cho CN HCM hoặc unit có KT riêng)
    try {
      const { data } = await supabase
        .from('employees')
        .select('id, profile_id')
        .eq('unit_id', unitId)
        .in('role_code', ['Accountant', 'ChiefAccountant'])
        .limit(1);
      if (data?.[0]) return data[0].profile_id || data[0].id;
    } catch { /* ignore */ }

    // 2. Fallback: KT phòng TCKT (BackOffice unit)
    try {
      const { data: boUnits } = await supabase
        .from('units')
        .select('id')
        .eq('type', 'BackOffice')
        .limit(5);
      
      if (boUnits && boUnits.length > 0) {
        const boUnitIds = boUnits.map(u => u.id);
        const { data } = await supabase
          .from('employees')
          .select('id, profile_id')
          .in('unit_id', boUnitIds)
          .in('role_code', ['Accountant', 'ChiefAccountant'])
          .limit(1);
        if (data?.[0]) return data[0].profile_id || data[0].id;
      }
    } catch { /* ignore */ }

    return null;
  },

  /**
   * Generate task definitions from workflow steps (checkbox-driven).
   * Called when creating/updating a contract with workflowSteps.
   */
  async generateFromWorkflow(
    contractId: string,
    steps: ContractWorkflowSteps,
    context: {
      lineItems: LineItem[];
      salespersonId: string;
      unitId: string;
      createdBy?: string;
    }
  ): Promise<ContractTaskDefinition[]> {
    const sale = context.salespersonId;
    const kt = await this.findAccountant(context.unitId);
    const createdBy = context.createdBy || undefined;

    // Build checklist markdown from line items
    const buildChecklist = (items: LineItem[], prefix = '') => {
      const named = items.filter(li => li.name);
      if (named.length === 0) return '';
      return named.map(li => `${prefix}- [ ] ${li.name}${li.quantity > 1 ? ` (x${li.quantity})` : ''}`).join('\n');
    };

    // Fetch existing tasks to prevent duplicates
    const { data: existingTasks } = await supabase
      .from('contract_task_definitions')
      .select('title')
      .eq('contract_id', contractId);
    
    const existingTitles = new Set(existingTasks?.map(t => t.title) || []);

    const defs: CreateTaskDefinitionInput[] = [];
    let order = 0;

    // Helper to add task only if it doesn't exist
    const addTask = (taskDef: CreateTaskDefinitionInput) => {
      if (!existingTitles.has(taskDef.title)) {
        defs.push(taskDef);
      }
    };

    // ═══ GIAI ĐOẠN KÝ KẾT ═══

    if (steps.guarantee_performance) {
      addTask({
        contract_id: contractId,
        title: 'Làm BL thực hiện hợp đồng',
        description: 'Kế toán làm thủ tục bảo lãnh thực hiện hợp đồng',
        assignees: kt ? [kt] : [],
        base_date_type: 'signed_date',
        duration_days: 7,
        origin: 'manual',
        sort_order: order++,
        created_by: createdBy,
      });
    }

    if (steps.advance_procedure) {
      // Task cha: Thủ tục tạm ứng (description = checklist)
      const advanceChecklist: string[] = [];
      if (steps.advance_has_guarantee) advanceChecklist.push('- [ ] Làm BL tạm ứng (Kế toán)');
      advanceChecklist.push('- [ ] Giấy đề nghị tạm ứng (Sale)');

      addTask({
        contract_id: contractId,
        title: 'Thủ tục tạm ứng',
        description: advanceChecklist.join('\n'),
        assignees: sale ? [sale] : [],
        base_date_type: 'signed_date',
        duration_days: 7,
        origin: 'manual',
        sort_order: order++,
        created_by: createdBy,
      });

      // Task: Đòi tiền tạm ứng (kích hoạt khi advance_completed)
      addTask({
        contract_id: contractId,
        title: 'Đòi tiền tạm ứng',
        description: `Hạn thu tạm ứng: ${steps.advance_deadline_days} ngày kể từ khi hoàn thành thủ tục tạm ứng`,
        assignees: sale ? [sale] : [],
        base_date_type: 'advance_completed',
        duration_days: steps.advance_deadline_days,
        origin: 'manual',
        sort_order: order++,
        created_by: createdBy,
      });
    }

    // ═══ GIAI ĐOẠN TRIỂN KHAI ═══

    if (steps.import_goods) {
      addTask({
        contract_id: contractId,
        title: 'Nhập hàng',
        description: buildChecklist(context.lineItems) || 'Nhập hàng theo hợp đồng',
        assignees: sale ? [sale] : [],
        base_date_type: 'signed_date',
        duration_days: 14,
        origin: 'manual',
        sort_order: order++,
        created_by: createdBy,
      });
    }

    if (steps.subcontract) {
      addTask({
        contract_id: contractId,
        title: 'Ký hợp đồng thầu phụ',
        assignees: sale ? [sale] : [],
        base_date_type: 'signed_date',
        duration_days: 14,
        origin: 'manual',
        sort_order: order++,
        created_by: createdBy,
      });
    }

    if (steps.implementation) {
      const namedItems = context.lineItems.filter(li => li.name);
      const implDesc = namedItems.length > 1
        ? `Triển khai thực hiện các đầu mục:\n${namedItems.map(li => `- ${li.name}`).join('\n')}`
        : 'Triển khai thực hiện hợp đồng';

      addTask({
        contract_id: contractId,
        title: 'Triển khai thực hiện HĐ',
        description: implDesc,
        assignees: sale ? [sale] : [],
        base_date_type: 'signed_date',
        duration_days: 30,
        origin: 'manual',
        sort_order: order++,
        created_by: createdBy,
      });
    }

    // Bàn giao (luôn có)
    addTask({
      contract_id: contractId,
      title: 'Bàn giao',
      description: buildChecklist(context.lineItems, 'Bàn giao ') || 'Bàn giao sản phẩm/dịch vụ cho khách hàng',
      assignees: sale ? [sale] : [],
      base_date_type: 'signed_date',
      duration_days: 7,
      origin: 'manual',
      sort_order: order++,
      created_by: createdBy,
    });

    if (steps.training) {
      addTask({
        contract_id: contractId,
        title: 'Đào tạo chuyển giao',
        assignees: sale ? [sale] : [],
        base_date_type: 'handover_date',
        duration_days: 7,
        origin: 'manual',
        sort_order: order++,
        created_by: createdBy,
      });
    }

    // ═══ GIAI ĐOẠN NGHIỆM THU & THANH TOÁN ═══

    // Nghiệm thu (luôn có)
    addTask({
      contract_id: contractId,
      title: 'Nghiệm thu thanh lý',
      assignees: sale ? [sale] : [],
      base_date_type: 'handover_date',
      duration_days: 14,
      origin: 'manual',
      sort_order: order++,
      created_by: createdBy,
    });

    if (steps.warranty_procedure) {
      const warrantyChecklist: string[] = [];
      if (steps.warranty_has_guarantee) warrantyChecklist.push('- [ ] Làm BL bảo hành (Kế toán)');
      warrantyChecklist.push('- [ ] Làm hồ sơ bảo hành (Sale/Admin)');

      addTask({
        contract_id: contractId,
        title: 'Thủ tục bảo hành',
        description: warrantyChecklist.join('\n'),
        assignees: sale ? [sale] : [],
        base_date_type: 'acceptance_date',
        duration_days: 14,
        origin: 'manual',
        sort_order: order++,
        created_by: createdBy,
      });
    }

    // Thủ tục thanh toán (luôn có)
    const paymentChecklist: string[] = [
      '- [ ] Xuất hoá đơn (Kế toán)',
      '- [ ] Giấy đề nghị thanh toán (Sale)',
    ];
    if (steps.warranty_procedure) paymentChecklist.push('- [ ] BL bảo hành (nếu có)');
    if (steps.payment_other_docs) paymentChecklist.push('- [ ] Các giấy tờ khác');

    addTask({
      contract_id: contractId,
      title: 'Thủ tục thanh toán',
      description: paymentChecklist.join('\n'),
      assignees: sale ? [sale] : [],
      base_date_type: 'acceptance_date',
      duration_days: 14,
      origin: 'manual',
      sort_order: order++,
      created_by: createdBy,
    });

    // Thu hồi công nợ (template — mỗi đợt VAT sẽ clone)
    addTask({
      contract_id: contractId,
      title: 'Thu hồi công nợ',
      description: 'Theo dõi và thu hồi công nợ theo đợt xuất hoá đơn',
      assignees: sale ? [sale] : [],
      base_date_type: 'invoice_date',
      duration_days: 20,
      origin: 'manual',
      sort_order: order++,
      created_by: createdBy,
    });

    // Bulk insert all
    if (defs.length > 0) {
      return this.bulkCreate(defs);
    }
    return [];
  },
};

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

/**
 * Resolve assignee ID(s) from a role string
 */
async function resolveAssigneeFromRole(
  role?: string,
  specificId?: string,
  context?: {
    creatorUserId?: string;
    salespersonId?: string;
    unitId?: string;
  }
): Promise<string[]> {
  if (!role) return [];

  switch (role) {
    case 'creator':
      return context?.creatorUserId ? [context.creatorUserId] : [];

    case 'salesperson':
      return context?.salespersonId ? [context.salespersonId] : [];

    case 'unit_leader':
      if (!context?.unitId) return [];
      try {
        const { data } = await supabase
          .from('employees')
          .select('profile_id')
          .eq('unit_id', context.unitId)
          .eq('is_leader', true)
          .limit(1);
        if (data?.[0]?.profile_id) return [data[0].profile_id];
      } catch { /* ignore */ }
      return [];

    case 'unit_admin':
      // Fallback to unit leader for now
      if (!context?.unitId) return [];
      try {
        const { data } = await supabase
          .from('employees')
          .select('profile_id')
          .eq('unit_id', context.unitId)
          .eq('is_leader', true)
          .limit(1);
        if (data?.[0]?.profile_id) return [data[0].profile_id];
      } catch { /* ignore */ }
      return [];

    case 'accountant':
      // Find chief accountant or first accountant
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .in('role', ['ChiefAccountant', 'Accountant'])
          .limit(1);
        if (data?.[0]?.id) return [data[0].id];
      } catch { /* ignore */ }
      return [];

    case 'specific':
      return specificId ? [specificId] : [];

    default:
      return [];
  }
}
