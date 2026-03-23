/**
 * useAutoTaskEngine — Listens to realtime contract events and triggers auto-task creation.
 * 
 * Mount ONCE in MainLayout.
 * When a contract's status changes, this hook detects the change and calls TaskEngine.emit().
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TaskEngine } from '../services/taskEngine';
import { dataClient as supabase } from '../lib/dataClient';

// Track recent status to detect changes
const statusCache: Record<string, string> = {};

export function useAutoTaskEngine() {
  const { user } = useAuth();
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!user?.id) return;

    const handleContractChanged = async (e: any) => {
      const detail = e.detail;
      if (!detail?.record?.id) return;

      const contractId = detail.record.id;
      const newStatus = detail.record.status;

      // Skip if no status
      if (!newStatus) return;

      // Check if status actually changed
      const oldStatus = statusCache[contractId];
      statusCache[contractId] = newStatus;

      // On first load (no old status cached), skip to avoid creating tasks for existing contracts
      if (!oldStatus) return;

      // Status didn't change
      if (oldStatus === newStatus) return;

      console.log(`[AutoTaskEngine] Contract ${contractId} status changed: ${oldStatus} → ${newStatus}`);

      // Fetch full contract data for template rendering
      try {
        const { data: contract, error } = await supabase
          .from('contracts')
          .select('id, title, party_a, value, status, signed_date, start_date, end_date, employee_id, unit_id')
          .eq('id', contractId)
          .single();

        if (error || !contract) {
          console.warn('[AutoTaskEngine] Failed to fetch contract:', error);
          return;
        }

        // Emit to TaskEngine
        const triggerEvent = `status_changed_to_${newStatus}`;
        const result = await TaskEngine.emit('contract', triggerEvent, contract, user.id);

        if (result.created > 0) {
          console.log(`[AutoTaskEngine] Created ${result.created} auto-task(s) for contract ${contractId}`);
        }
      } catch (err) {
        console.error('[AutoTaskEngine] Error:', err);
      }
    };

    // Listen to payment changes to auto-complete tasks
    const handlePaymentChanged = async (e: any) => {
      const detail = e.detail;
      const contractId = detail?.record?.contract_id;
      if (!contractId) return;

      try {
        // Fetch pending tasks with completion triggers for this contract
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('id, completion_trigger')
          .eq('source_module', 'contracts')
          .eq('source_entity_id', contractId)
          .not('completion_trigger', 'is', null);

        if (error || !tasks || tasks.length === 0) return;

        // Check recent payments for this contract
        const { data: payments } = await supabase
          .from('payments')
          .select('id, voucher_type, status')
          .eq('contract_id', contractId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (!payments) return;

        // Determine if triggers are met
        const hasVatInvoice = payments.some(p => p.voucher_type === 'VAT_INVOICE');
        const hasExpense = payments.some(p => p.voucher_type === 'EXPENSE');

        for (const task of tasks) {
          let shouldComplete = false;
          
          if (task.completion_trigger === 'vat_invoice_created' && hasVatInvoice) {
            shouldComplete = true;
          } else if (task.completion_trigger === 'payment_completed' && hasExpense) {
            shouldComplete = true;
          }

          if (shouldComplete) {
            // Find "Done" status
            const { data: statuses } = await supabase.from('task_statuses').select('id, is_done').eq('is_done', true).limit(1);
            if (statuses && statuses.length > 0) {
              await supabase.from('tasks').update({ status_id: statuses[0].id }).eq('id', task.id);
              console.log(`[AutoTaskEngine] Auto-completed task ${task.id} due to ${task.completion_trigger}`);
              // Trigger reload
              window.dispatchEvent(new CustomEvent('task-updated', { detail: { id: task.id } }));
            }
          }
        }
      } catch (err) {
        console.error('[AutoTaskEngine] Payment handler error:', err);
      }
    };

    // Global listeners
    window.addEventListener('contract-changed', handleContractChanged);
    window.addEventListener('contract-updated', handleContractChanged);
    window.addEventListener('payment-changed', handlePaymentChanged);

    // Pre-warm: load all contract statuses into cache on init to avoid false triggers
    if (!isInitialized.current) {
      isInitialized.current = true;
      (async () => {
        try {
          const { data } = await supabase
            .from('contracts')
            .select('id, status');
          if (data) {
            data.forEach((c: any) => {
              statusCache[c.id] = c.status;
            });
            console.log(`[AutoTaskEngine] Pre-warmed status cache with ${data.length} contracts`);
          }
        } catch { /* ignore */ }
      })();
    }

    return () => {
      window.removeEventListener('contract-changed', handleContractChanged);
      window.removeEventListener('contract-updated', handleContractChanged);
      window.removeEventListener('payment-changed', handlePaymentChanged);
    };
  }, [user?.id]);
}

export default useAutoTaskEngine;
