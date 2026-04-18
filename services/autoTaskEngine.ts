// Auto-Task Engine — CIC ERP
// Generates tasks automatically from business events (contract creation, status changes, deadlines, etc.)
// Call these methods from relevant service layers or via UI triggers.

import { TaskService } from './taskService';
import { TaskCommentService } from './taskCommentService';
import { dataClient as supabase } from '../lib/dataClient';
import type { CreateTaskInput, CreateTaskLinkInput } from '../types/taskTypes';

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════
interface ContractContext {
  id: string;
  contractNumber: string;
  name: string;
  signedDate?: string;
  endDate?: string;
  partyA?: string;
  partyB?: string;
  createdBy?: string;
  unitCode?: string;
  assigneeIds?: string[];
}

interface AutoTaskResult {
  taskId: string;
  title: string;
}

// ═══════════════════════════════════════
// CONTRACT EVENT HANDLERS
// ═══════════════════════════════════════
export const AutoTaskEngine = {
  /**
   * Called when a new contract is created.
   * Generates tasks: review contract, prepare PAKD, etc.
   */
  async onContractCreated(contract: ContractContext): Promise<AutoTaskResult[]> {
    const results: AutoTaskResult[] = [];
    const assignees = contract.assigneeIds || [];
    const creator = contract.createdBy || '';

    // ── Kiểm tra xem đã có task nào từ contract này chưa (tránh tạo trùng)
    // ContractForm Step 4 (WorkflowSteps) có thể đã tạo task definitions trước
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id, source_event')
      .eq('source_entity_id', contract.id)
      .eq('source_module', 'contract');

    const existingEvents = new Set((existingTasks || []).map((t: any) => t.source_event));
    const hasWorkflowTasks = (existingTasks || []).length > 0;

    // Task 1: Review hợp đồng — luôn tạo nếu chưa có
    if (!existingEvents.has('contract_created_review')) {
      const reviewTask = await createAutoTask({
        title: `Review hợp đồng ${contract.contractNumber}`,
        description: `Kiểm tra nội dung hợp đồng "${contract.name}" với ${contract.partyA || 'đối tác'}.\n\nHạng mục cần review:\n- Điều khoản thanh toán\n- Thời gian thực hiện\n- Phạm vi công việc\n- Rủi ro pháp lý`,
        priority: 'high',
        assignees,
        due_date: addDays(new Date(), 3),
        source_module: 'contract',
        source_event: 'contract_created_review',
        source_entity_id: contract.id,
        created_by: creator,
        tags: ['hợp-đồng', 'review'],
        action_type: 'navigate',
        action_label: 'Mở hợp đồng',
        action_config: { url: `/contracts/${contract.id}` },
      }, {
        entity_type: 'contract',
        entity_id: contract.id,
        entity_label: `${contract.contractNumber} - ${contract.name}`,
        url: `/contracts/${contract.id}`,
      });
      results.push(reviewTask);
    }

    // Task 2: Lập PAKD — chỉ tạo nếu chưa có và workflow chưa bao gồm PAKD step
    if (!existingEvents.has('contract_created_pakd') && !hasWorkflowTasks) {
      const pakdTask = await createAutoTask({
        title: `Lập PAKD cho ${contract.contractNumber}`,
        description: `Lập phương án kinh doanh cho hợp đồng "${contract.name}".\n\nBao gồm: doanh thu, chi phí, lợi nhuận dự kiến.`,
        priority: 'medium',
        assignees,
        due_date: addDays(new Date(), 7),
        source_module: 'contract',
        source_event: 'contract_created_pakd',
        source_entity_id: contract.id,
        created_by: creator,
        tags: ['hợp-đồng', 'pakd'],
        action_type: 'navigate',
        action_label: 'Mở PAKD',
        action_config: { url: `/contracts/${contract.id}#pakd` },
      }, {
        entity_type: 'contract',
        entity_id: contract.id,
        entity_label: `${contract.contractNumber} - ${contract.name}`,
        url: `/contracts/${contract.id}`,
      });
      results.push(pakdTask);
    }

    return results;
  },

  /**
   * Called when contract is signed.
   * Generates: prepare kickoff, notify team.
   */
  async onContractSigned(contract: ContractContext): Promise<AutoTaskResult[]> {
    const results: AutoTaskResult[] = [];
    const assignees = contract.assigneeIds || [];
    const creator = contract.createdBy || '';

    const kickoffTask = await createAutoTask({
      title: `Khởi động thực hiện ${contract.contractNumber}`,
      description: `Hợp đồng "${contract.name}" đã ký.\n\nViệc cần làm:\n- Thông báo đội dự án\n- Phân công nhân sự\n- Lập kế hoạch triển khai\n- Chuẩn bị tài liệu kỹ thuật`,
      priority: 'high',
      assignees,
      start_date: contract.signedDate || today(),
      due_date: addDays(new Date(contract.signedDate || Date.now()), 5),
      source_module: 'contract',
      source_event: 'contract_signed',
      source_entity_id: contract.id,
      created_by: creator,
      tags: ['hợp-đồng', 'khởi-động'],
      action_type: 'navigate',
      action_label: 'Mở hợp đồng',
      action_config: { url: `/contracts/${contract.id}` },
    }, {
      entity_type: 'contract',
      entity_id: contract.id,
      entity_label: `${contract.contractNumber} - ${contract.name}`,
      url: `/contracts/${contract.id}`,
    });
    results.push(kickoffTask);

    return results;
  },

  /**
   * Called when contract is nearing deadline.
   * Generates: deadline warning task.
   */
  async onContractNearDeadline(contract: ContractContext, daysLeft: number): Promise<AutoTaskResult[]> {
    const results: AutoTaskResult[] = [];
    const assignees = contract.assigneeIds || [];

    const warningTask = await createAutoTask({
      title: `⚠️ HĐ ${contract.contractNumber} còn ${daysLeft} ngày`,
      description: `Hợp đồng "${contract.name}" sắp hết hạn (${contract.endDate}).\n\nKiểm tra:\n- Tiến độ nghiệm thu\n- Hồ sơ thanh toán\n- Gia hạn/thanh lý nếu cần`,
      priority: daysLeft <= 7 ? 'urgent' : 'high',
      assignees,
      due_date: contract.endDate || addDays(new Date(), daysLeft),
      source_module: 'contract',
      source_event: 'contract_near_deadline',
      source_entity_id: contract.id,
      created_by: 'system',
      tags: ['hợp-đồng', 'deadline'],
      action_type: 'navigate',
      action_label: 'Mở hợp đồng',
      action_config: { url: `/contracts/${contract.id}` },
    }, {
      entity_type: 'contract',
      entity_id: contract.id,
      entity_label: `${contract.contractNumber} - ${contract.name}`,
      url: `/contracts/${contract.id}`,
    });
    results.push(warningTask);

    return results;
  },

  /**
   * Generic: create a custom task linked to any entity.
   */
  async createLinkedTask(
    input: CreateTaskInput,
    entityType: string,
    entityId: string,
    entityLabel?: string,
    entityUrl?: string,
  ): Promise<AutoTaskResult> {
    return createAutoTask(input, {
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel,
      url: entityUrl,
    });
  },
};

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
async function createAutoTask(
  input: CreateTaskInput,
  link?: Omit<CreateTaskLinkInput, 'task_id'>
): Promise<AutoTaskResult> {
  // Mark as auto-generated
  const taskInput: CreateTaskInput = {
    ...input,
    auto_generated: true,
  };

  const task = await TaskService.create(taskInput);

  // Create entity link
  if (link) {
    try {
      await TaskService.addLink({
        task_id: task.id,
        ...link,
      });
    } catch (err) {
      console.warn('[AutoTaskEngine] Failed to create link:', err);
    }
  }

  // Add system comment
  try {
    const sourceLabel = input.source_module ? ` từ ${input.source_module}` : '';
    await TaskCommentService.addSystemComment(
      task.id,
      `Công việc tự động tạo${sourceLabel}: "${task.title}"`
    );
  } catch (err) {
    console.warn('[AutoTaskEngine] Failed to add system comment:', err);
  }

  return { taskId: task.id, title: task.title };
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
