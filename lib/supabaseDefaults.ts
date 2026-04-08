/**
 * Giá trị mặc định công khai (anon) của dự án dev — trùng URL/key đã dùng trong scripts/components.
 * Cho phép chạy `npm run dev` không cần .env.local; production nên set VITE_SUPABASE_* rõ ràng.
 */
export const DEFAULT_SUPABASE_URL = 'https://jyohocjsnsyfgfsmjfqx.supabase.co';

export const DEFAULT_SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b2hvY2pzbnN5Zmdmc21qZnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1MzQ3MzgsImV4cCI6MjA1MzExMDczOH0.geU7wqhNwO3eBmf_QLnLxoS5bGBxJRqotXw6qz5l6dA';
