/**
 * Task Engine — Auto-Task Creation Service
 * 
 * Listens to module events and creates tasks based on automation rules.
 * Data-driven: rules stored in `task_automation_rules` table.
 * 
 * Usage:
 *   await TaskEngine.emit('contract', 'status_changed_to_Processing', { contract });
 */

import { dataClient as supabase } from '../lib/dataClient';
import { TaskService } from './taskService';
import type { CreateTaskInput } from '../types/taskTypes';

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════
interface AutomationRule {
  id: string;
  name: string;
  source_module: string;
  trigger_event: string;
  is_active: boolean;
  task_title_template: string;
  task_description_template?: string;
  task_priority: string;
  deadline_offset_days?: number;
  deadline_field?: string;
  assignee_rules: any[];
  watcher_rules: any[];
  supporter_rules: any[];
  link_entity_type?: string;
  action_type?: string;
  action_label?: string;
  completion_trigger?: string;
}

// Cache rules for 5 minutes
let rulesCache: AutomationRule[] | null = null;
let rulesCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

// ═══════════════════════════════════════
// TEMPLATE ENGINE
// ═══════════════════════════════════════
function renderTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return data[key] ?? '';
  });
}

// ═══════════════════════════════════════
// RESOLVE PEOPLE (assignees, watchers, etc)
// ═══════════════════════════════════════
async function resolvePeople(
  rules: any[],
  entityData: Record<string, any>
): Promise<string[]> {
  const ids: string[] = [];

  for (const rule of rules) {
    if (!rule.from) continue;

    // Parse "contract.employee_id" → entityData.employee_id
    const field = rule.from.split('.').pop();
    const value = entityData[field];

    if (rule.resolve === 'unit_leader') {
      // Resolve unit leader from unit_id
      if (value) {
        try {
          const { data: employees } = await supabase
            .from('employees')
            .select('profile_id')
            .eq('unit_id', value)
            .eq('is_leader', true)
            .limit(1);
          if (employees?.[0]?.profile_id) {
            ids.push(employees[0].profile_id);
          }
        } catch { /* ignore */ }
      }
    } else if (value) {
      // Direct field value (employee_id → profile_id lookup)
      if (field === 'employee_id') {
        try {
          const { data: emp } = await supabase
            .from('employees')
            .select('profile_id')
            .eq('id', value)
            .single();
          if (emp?.profile_id) ids.push(emp.profile_id);
        } catch { /* ignore */ }
      } else {
        // Assume it's already a profile_id or array of IDs
        if (Array.isArray(value)) {
          ids.push(...value);
        } else {
          ids.push(value);
        }
      }
    }
  }

  return [...new Set(ids)]; // Dedupe
}

// ═══════════════════════════════════════
// CALCULATE DEADLINE
// ═══════════════════════════════════════
function calculateDeadline(
  rule: AutomationRule,
  entityData: Record<string, any>
): string | undefined {
  // If rule has a specific deadline field (e.g. 'contract.end_date')
  if (rule.deadline_field) {
    const field = rule.deadline_field.split('.').pop();
    if (field && entityData[field]) {
      return entityData[field];
    }
  }

  // If rule has offset days, calculate from now
  if (rule.deadline_offset_days) {
    const d = new Date();
    d.setDate(d.getDate() + rule.deadline_offset_days);
    return d.toISOString().split('T')[0];
  }

  return undefined;
}

// ═══════════════════════════════════════
// CHECK FOR DUPLICATE TASKS
// ═══════════════════════════════════════
async function isDuplicateTask(
  ruleId: string,
  entityId: string,
  triggerEvent: string
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('tasks')
      .select('id')
      .eq('source_event', `${triggerEvent}:${ruleId}`)
      .eq('source_entity_id', entityId)
      .limit(1);
    return (data?.length || 0) > 0;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════
// TASK ENGINE
// ═══════════════════════════════════════
export const TaskEngine = {
  /**
   * Load automation rules (with caching)
   */
  async getRules(): Promise<AutomationRule[]> {
    if (rulesCache && Date.now() - rulesCacheTime < CACHE_TTL) {
      return rulesCache;
    }

    const { data, error } = await supabase
      .from('task_automation_rules')
      .select('*')
      .eq('is_active', true)
      .order('created_at');

    if (error) {
      console.error('[TaskEngine] Failed to load rules:', error);
      return [];
    }

    rulesCache = data || [];
    rulesCacheTime = Date.now();
    return rulesCache;
  },

  /**
   * Clear rules cache (after rule changes)
   */
  clearCache() {
    rulesCache = null;
  },

  /**
   * Main entry point: emit an event and auto-create tasks
   * 
   * @param sourceModule - 'contract', 'payment', etc.
   * @param triggerEvent - 'status_changed_to_Processing', 'created', etc.
   * @param entityData - The entity record (contract object, payment object, etc.)
   * @param userId - The user who triggered the event (for created_by)
   */
  async emit(
    sourceModule: string,
    triggerEvent: string,
    entityData: Record<string, any>,
    userId?: string
  ): Promise<{ created: number; tasks: string[] }> {
    const result = { created: 0, tasks: [] as string[] };

    try {
      const rules = await this.getRules();
      const matchingRules = rules.filter(
        r => r.source_module === sourceModule && r.trigger_event === triggerEvent
      );

      if (matchingRules.length === 0) return result;

      console.log(`[TaskEngine] ${matchingRules.length} rule(s) matched for ${sourceModule}:${triggerEvent}`);

      // Template data: flatten entity fields for {{field}} replacement
      const templateData: Record<string, any> = {
        ...entityData,
        // Common aliases
        code: entityData.id?.substring(0, 8) || '',
        title: entityData.title || entityData.contract_name || entityData.name || entityData.id || '',
      };

      for (const rule of matchingRules) {
        try {
          // Check for duplicates
          const entityId = entityData.id;
          if (entityId && await isDuplicateTask(rule.id, entityId, triggerEvent)) {
            console.log(`[TaskEngine] Skipping duplicate task for rule "${rule.name}" entity ${entityId}`);
            continue;
          }

          // Resolve people
          const assignees = await resolvePeople(rule.assignee_rules || [], entityData);
          const watchers = await resolvePeople(rule.watcher_rules || [], entityData);
          const supporters = await resolvePeople(rule.supporter_rules || [], entityData);

          // Build task input
          const taskInput: CreateTaskInput = {
            title: renderTemplate(rule.task_title_template, templateData),
            description: rule.task_description_template
              ? renderTemplate(rule.task_description_template, templateData)
              : undefined,
            priority: rule.task_priority as any || 'medium',
            assignees: assignees.length > 0 ? assignees : undefined,
            watchers: watchers.length > 0 ? watchers : undefined,
            supporters: supporters.length > 0 ? supporters : undefined,
            due_date: calculateDeadline(rule, entityData),
            source_module: sourceModule,
            source_event: `${triggerEvent}:${rule.id}`,
            source_entity_id: entityId,
            auto_generated: true,
            action_type: rule.action_type || undefined,
            action_label: rule.action_label || undefined,
            completion_trigger: rule.completion_trigger || undefined,
            created_by: userId || undefined,
          };

          // Create the task
          const task = await TaskService.create(taskInput);

          // Auto-create link to source entity
          if (rule.link_entity_type && entityId) {
            try {
              await TaskService.addLink({
                task_id: task.id,
                entity_type: rule.link_entity_type,
                entity_id: entityId,
                entity_label: templateData.title,
                link_type: 'caused_by',
              });
            } catch (linkErr) {
              console.warn('[TaskEngine] Failed to create task link:', linkErr);
            }
          }

          result.created++;
          result.tasks.push(task.id);
          console.log(`[TaskEngine] Created task "${task.title}" (${task.id})`);
        } catch (ruleErr) {
          console.error(`[TaskEngine] Error processing rule "${rule.name}":`, ruleErr);
        }
      }
    } catch (err) {
      console.error('[TaskEngine] Fatal error:', err);
    }

    return result;
  },

  /**
   * Check if any active tasks should be auto-completed
   * Called when an entity action is completed (e.g., payment created, approval done)
   */
  async checkCompletionTrigger(
    trigger: string,
    entityType: string,
    entityId: string
  ): Promise<number> {
    try {
      // Find tasks with matching completion_trigger linked to the entity
      const { data: links } = await supabase
        .from('task_links')
        .select('task_id')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);

      if (!links?.length) return 0;

      const taskIds = links.map(l => l.task_id);

      // Find matching tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, completion_trigger')
        .in('id', taskIds)
        .eq('completion_trigger', trigger)
        .is('completed_at', null);

      if (!tasks?.length) return 0;

      // Complete them
      let completed = 0;
      for (const task of tasks) {
        try {
          const statuses = await TaskService.getStatuses();
          const doneStatus = statuses.find(s => s.is_done && s.name !== 'Hủy');
          if (doneStatus) {
            await TaskService.update(task.id, {
              status_id: doneStatus.id,
              completed_at: new Date().toISOString(),
            });
            completed++;
            console.log(`[TaskEngine] Auto-completed task ${task.id} (trigger: ${trigger})`);
          }
        } catch { /* ignore */ }
      }

      return completed;
    } catch (err) {
      console.error('[TaskEngine] checkCompletionTrigger error:', err);
      return 0;
    }
  },
};

export default TaskEngine;
