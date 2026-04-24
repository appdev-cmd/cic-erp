-- Create ai_logs table to track AI Gateway usage and observability
CREATE TABLE IF NOT EXISTS public.ai_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID,
    session_id TEXT,
    agent_id TEXT,
    model_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    action_type TEXT NOT NULL,
    source TEXT NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_cost_usd NUMERIC(15, 6) DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    input_preview TEXT,
    output_preview TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS ai_logs_created_at_idx ON public.ai_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_logs_user_id_idx ON public.ai_logs (user_id);
CREATE INDEX IF NOT EXISTS ai_logs_model_id_idx ON public.ai_logs (model_id);
CREATE INDEX IF NOT EXISTS ai_logs_source_idx ON public.ai_logs (source);

-- Enable RLS
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

-- Default policies
-- AI Gateway runs on the client or edge, so we need to allow anonymous or authenticated to insert.
-- Usually we allow authenticated users to insert, and service role to ignore RLS.
CREATE POLICY "Enable insert for authenticated users only" ON public.ai_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');

CREATE POLICY "Enable read access for all authenticated users" ON public.ai_logs
    FOR SELECT TO authenticated USING (true);
