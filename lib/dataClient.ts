/**
 * Isolated Supabase Client for Data Operations
 * 
 * This client is separate from the Auth client to ensure:
 * 1. Data fetching is NOT blocked by auth state
 * 2. No race conditions between auth and data loading
 * 3. Reliable and predictable data access
 * 
 * Use this client for ALL data operations (select, insert, update, delete, rpc)
 * Use authClient (lib/supabase.ts) ONLY for auth operations (login, logout, session)
 * 
 * Auth session is synced from authClient so that DB triggers (e.g. audit_logs)
 * can identify the user via auth.uid().
 */

import { createClient, Session } from '@supabase/supabase-js';
import { DEFAULT_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_URL } from './supabaseDefaults';

function getEnv(key: string, backup: string = ''): string {
  try {
    if (typeof (import.meta as any).env !== 'undefined') {
      const val = (import.meta as any).env[key];
      if (val) return val;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env[key]) return process.env[key] as string;
    }
  } catch {}
  return backup;
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL', DEFAULT_SUPABASE_URL);

// Detect if running in production mode
const isProduction = 
    (typeof import.meta.env !== 'undefined' && import.meta.env.PROD) ||
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'production');

// Dev bypass mode — ONLY allowed on localhost during non-production to prevent production data leak
const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const isDevBypass = !isProduction && getEnv('VITE_DEV_BYPASS_AUTH') === 'true' && isLocalhost;

// SECURITY: Never use service_role key in client code on production
// In dev bypass mode, we use the regular anon key but AuthContext will silently
// log in as a Dev Admin user. This ensures data is fetched safely and securely via RLS.
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY', DEFAULT_SUPABASE_ANON_KEY);

export const dataClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,      // Don't save session to localStorage
        autoRefreshToken: false,    // Don't auto-refresh tokens
        detectSessionInUrl: false   // Don't look for auth tokens in URL
    }
});

/**
 * Sync the auth session from authClient into dataClient.
 * This ensures DB triggers (like process_audit_log) can resolve auth.uid()
 * to the actual logged-in user instead of returning null.
 * 
 * Called from AuthContext whenever auth state changes.
 */
export async function syncAuthSession(session: Session | null): Promise<void> {
    if (session?.access_token && session?.refresh_token) {
        await dataClient.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
        });
    }
}

// Export type for TypeScript
export type DataClient = typeof dataClient;
