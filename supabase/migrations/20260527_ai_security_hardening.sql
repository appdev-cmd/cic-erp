-- ============================================================
-- AI Security Hardening Migration
-- Date: 2026-05-27
-- Purpose: Enable RLS on AI tables, add quota reset, add lock/ban
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 1. Enable RLS on AI tables
-- ═══════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_memories ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════
-- 2. RLS Policies for ai_conversations
-- ═══════════════════════════════════════════════════════════

-- Users can only see their own conversations
DROP POLICY IF EXISTS "ai_conversations_select_own" ON ai_conversations;
CREATE POLICY "ai_conversations_select_own" ON ai_conversations
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own conversations
DROP POLICY IF EXISTS "ai_conversations_insert_own" ON ai_conversations;
CREATE POLICY "ai_conversations_insert_own" ON ai_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own conversations
DROP POLICY IF EXISTS "ai_conversations_update_own" ON ai_conversations;
CREATE POLICY "ai_conversations_update_own" ON ai_conversations
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own conversations
DROP POLICY IF EXISTS "ai_conversations_delete_own" ON ai_conversations;
CREATE POLICY "ai_conversations_delete_own" ON ai_conversations
    FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- 3. RLS Policies for ai_messages
-- ═══════════════════════════════════════════════════════════

-- Users can only see messages in their own conversations
DROP POLICY IF EXISTS "ai_messages_select_own" ON ai_messages;
CREATE POLICY "ai_messages_select_own" ON ai_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ai_conversations
            WHERE ai_conversations.id = ai_messages.conversation_id
            AND ai_conversations.user_id = auth.uid()
        )
    );

-- Users can only insert messages into their own conversations
DROP POLICY IF EXISTS "ai_messages_insert_own" ON ai_messages;
CREATE POLICY "ai_messages_insert_own" ON ai_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM ai_conversations
            WHERE ai_conversations.id = ai_messages.conversation_id
            AND ai_conversations.user_id = auth.uid()
        )
    );

-- Users can only delete messages from their own conversations
DROP POLICY IF EXISTS "ai_messages_delete_own" ON ai_messages;
CREATE POLICY "ai_messages_delete_own" ON ai_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM ai_conversations
            WHERE ai_conversations.id = ai_messages.conversation_id
            AND ai_conversations.user_id = auth.uid()
        )
    );

-- ═══════════════════════════════════════════════════════════
-- 4. RLS Policies for ai_logs
-- ═══════════════════════════════════════════════════════════

-- Users can only see their own AI logs
DROP POLICY IF EXISTS "ai_logs_select_own" ON ai_logs;
CREATE POLICY "ai_logs_select_own" ON ai_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Any authenticated user can INSERT logs (fire-and-forget logging)
DROP POLICY IF EXISTS "ai_logs_insert_any" ON ai_logs;
CREATE POLICY "ai_logs_insert_any" ON ai_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admin-only: allow admins to see all logs (for monitoring dashboard)
DROP POLICY IF EXISTS "ai_logs_select_admin" ON ai_logs;
CREATE POLICY "ai_logs_select_admin" ON ai_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Admin'
        )
    );

-- ═══════════════════════════════════════════════════════════
-- 5. RLS Policies for ai_permissions
-- ═══════════════════════════════════════════════════════════

-- Users can read their own permission record
DROP POLICY IF EXISTS "ai_permissions_select_own" ON ai_permissions;
CREATE POLICY "ai_permissions_select_own" ON ai_permissions
    FOR SELECT USING (auth.uid() = user_id);

-- Admin can read all permissions
DROP POLICY IF EXISTS "ai_permissions_select_admin" ON ai_permissions;
CREATE POLICY "ai_permissions_select_admin" ON ai_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Admin'
        )
    );

-- Only Admin can modify permissions
DROP POLICY IF EXISTS "ai_permissions_modify_admin" ON ai_permissions;
CREATE POLICY "ai_permissions_modify_admin" ON ai_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'Admin'
        )
    );

-- ═══════════════════════════════════════════════════════════
-- 6. RLS Policies for agent_memories
-- ═══════════════════════════════════════════════════════════

-- Users can only access their own agent memories
DROP POLICY IF EXISTS "agent_memories_select_own" ON agent_memories;
CREATE POLICY "agent_memories_select_own" ON agent_memories
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_memories_insert_own" ON agent_memories;
CREATE POLICY "agent_memories_insert_own" ON agent_memories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_memories_update_own" ON agent_memories;
CREATE POLICY "agent_memories_update_own" ON agent_memories
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "agent_memories_delete_own" ON agent_memories;
CREATE POLICY "agent_memories_delete_own" ON agent_memories
    FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════
-- 7. Add lock/ban columns to ai_permissions
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ai_permissions' AND column_name = 'is_locked') THEN
        ALTER TABLE ai_permissions ADD COLUMN is_locked boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ai_permissions' AND column_name = 'locked_reason') THEN
        ALTER TABLE ai_permissions ADD COLUMN locked_reason text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ai_permissions' AND column_name = 'locked_at') THEN
        ALTER TABLE ai_permissions ADD COLUMN locked_at timestamptz;
    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 8. Create/Replace quota reset function
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION reset_ai_monthly_quotas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE ai_permissions
    SET usage_count = 0,
        quota_reset_at = (date_trunc('month', now()) + interval '1 month')::timestamptz,
        updated_at = now()
    WHERE quota_reset_at <= now()
      AND monthly_quota > 0;
END;
$$;

-- Grant execute to authenticated users (called from app layer)
GRANT EXECUTE ON FUNCTION reset_ai_monthly_quotas() TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 9. Comment for manual setup: pg_cron (requires Supabase Dashboard)
-- ═══════════════════════════════════════════════════════════
-- Run this in SQL Editor after enabling pg_cron extension:
--
-- SELECT cron.schedule(
--   'reset-ai-quotas',
--   '0 0 1 * *',  -- 1st of every month at midnight UTC
--   'SELECT reset_ai_monthly_quotas()'
-- );
