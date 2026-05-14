-- Migration: Agent Tool Configs (Overrides)
-- Description: Tạo bảng lưu trữ cấu hình tuỳ chỉnh cho từng tool trên hệ thống AI
-- Date: 2026-05-13

CREATE TABLE IF NOT EXISTS public.agent_tool_configs (
    tool_name text PRIMARY KEY,
    custom_description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.agent_tool_configs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admin/Leadership full access, others read-only
CREATE POLICY "Cho phép tất cả user đọc cấu hình tool"
    ON public.agent_tool_configs
    FOR SELECT
    USING (true);

CREATE POLICY "Chỉ Admin/Leadership được cấu hình tool"
    ON public.agent_tool_configs
    FOR ALL
    USING (
        (auth.jwt() ->> 'role'::text) IN ('Admin', 'Leadership')
    );

-- Trigger auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_agent_tool_configs_updated_at ON public.agent_tool_configs;

CREATE TRIGGER update_agent_tool_configs_updated_at
    BEFORE UPDATE ON public.agent_tool_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
