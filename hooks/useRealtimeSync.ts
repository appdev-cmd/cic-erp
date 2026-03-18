/**
 * useRealtimeSync — Global Realtime Subscription Hook
 * 
 * Subscribes to Supabase Realtime Postgres Changes on ALL business tables.
 * When changes are detected, dispatches window CustomEvents so existing
 * components auto-refresh without changing filters, scroll, or UI state.
 * 
 * Mount ONCE at top-level (MainLayout) — do NOT mount in individual components.
 */
import { useEffect, useRef } from 'react';
import { dataClient } from '../lib/dataClient';
import { useAuth } from '../contexts/AuthContext';

// Table → event name mapping
const TABLE_EVENT_MAP: Record<string, string> = {
  contracts: 'contract',
  payments: 'payment',
  customers: 'customer',
  employees: 'employee',
  products: 'product',
  units: 'unit',
  brands: 'brand',
  product_lines: 'product-line',
  product_editions: 'product-edition',
  tasks: 'task',
  employee_targets: 'employee-target',
  contract_documents: 'document',
  user_permissions: 'permission',
  cross_unit_visibility: 'visibility',
};

// Tables that use legacy contract-created/updated/deleted events
const CONTRACT_EVENTS: Record<string, string> = {
  INSERT: 'contract-created',
  UPDATE: 'contract-updated',
  DELETE: 'contract-deleted',
};

// All other tables use {name}-changed
const TABLES = Object.keys(TABLE_EVENT_MAP);

// Debounce map: table → timeout
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const DEBOUNCE_MS = 2000;

function dispatchDebounced(eventName: string, detail?: any) {
  if (debounceTimers[eventName]) {
    clearTimeout(debounceTimers[eventName]);
  }
  debounceTimers[eventName] = setTimeout(() => {
    console.log(`[RealtimeSync] Dispatching: ${eventName}`, detail?.id || '');
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }, DEBOUNCE_MS);
}

export function useRealtimeSync() {
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<typeof dataClient.channel> | null>(null);

  useEffect(() => {
    // Only subscribe when user is authenticated
    if (!user?.id) return;

    console.log('[RealtimeSync] Setting up global realtime subscriptions...');

    let channel = dataClient.channel('global-realtime-sync');

    // Subscribe to all tables
    for (const table of TABLES) {
      const eventPrefix = TABLE_EVENT_MAP[table];

      channel = channel
        .on('postgres_changes', {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table,
        }, (payload) => {
          const eventType = payload.eventType; // INSERT | UPDATE | DELETE
          const record = (payload.new || payload.old) as any;

          // For contracts table: use legacy event names for backward compatibility
          if (table === 'contracts') {
            const legacyEvent = CONTRACT_EVENTS[eventType];
            if (legacyEvent) {
              dispatchDebounced(legacyEvent, {
                contractId: record?.id,
                contract: record,
                source: 'realtime',
              });
            }
            return;
          }

          // All other tables: dispatch {prefix}-changed
          dispatchDebounced(`${eventPrefix}-changed`, {
            eventType,
            id: record?.id,
            record,
            table,
            source: 'realtime',
          });
        });
    }

    channel.subscribe((status) => {
      console.log(`[RealtimeSync] Subscription status: ${status}`);
    });

    channelRef.current = channel;

    return () => {
      console.log('[RealtimeSync] Cleaning up subscriptions');
      if (channelRef.current) {
        dataClient.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // Clear all debounce timers
      Object.values(debounceTimers).forEach(clearTimeout);
    };
  }, [user?.id]);
}

export default useRealtimeSync;
