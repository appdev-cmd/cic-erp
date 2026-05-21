-- Migration: Fix ai_logs RLS policy (remove anon insert) and add ai_tool_audit_logs RLS policy
-- Phục vụ cho Workstream 1 (H10) và Workstream 3 (M9) trong kế hoạch nâng cấp bảo mật hệ thống AI Agent

-- 1. FIX ai_logs ROW LEVEL SECURITY POLICY (H10)
-- Bảng public.ai_logs đã được kích hoạt RLS trong migration 20260424000000_create_ai_logs.sql
-- Nhưng chính sách cũ cho phép 'anon' insert làm tăng nguy cơ bị spam và phá hoại log.

-- Drop chính sách chèn cũ nếu tồn tại
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.ai_logs;

-- Tạo chính sách chèn mới: Chỉ cho phép người dùng authenticated chèn log, và tự động gán user_id bằng auth.uid() của họ nếu có
CREATE POLICY "Enable insert for authenticated users only" ON public.ai_logs
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated' AND (user_id IS NULL OR user_id = auth.uid()));

-- Đảm bảo chính sách xem (SELECT) an toàn: 
-- Hiện tại chính sách SELECT cũ là: "Enable read access for all authenticated users" TO authenticated USING (true);
-- Cho phép mọi user đã đăng nhập xem log của toàn bộ hệ thống -> Lộ thông tin nhạy cảm của user khác!
-- Chúng ta cần giới hạn: Chỉ cho phép người dùng xem log của chính họ, và Admin/Leadership/Legal được xem toàn bộ logs.

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.ai_logs;

CREATE POLICY "Enable read for owners and management" ON public.ai_logs
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Leadership', 'Legal')
        )
    );


-- 2. ADD RLS POLICIES FOR ai_tool_audit_logs (M9)
-- Bảng public.ai_tool_audit_logs được tạo trong 20260514104500_enable_ai_rls.sql nhưng chưa được bật RLS.
-- Chúng ta cần kích hoạt RLS và thiết lập các chính sách bảo mật nghiêm ngặt.

-- Kích hoạt RLS
ALTER TABLE public.ai_tool_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop các chính sách cũ nếu tồn tại đề phòng trùng lặp
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.ai_tool_audit_logs;
DROP POLICY IF EXISTS "Enable read for owners and management" ON public.ai_tool_audit_logs;

-- Chính sách chèn: Chỉ cho phép authenticated users chèn log của chính họ
CREATE POLICY "Enable insert for authenticated users" ON public.ai_tool_audit_logs
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND (user_id IS NULL OR user_id = auth.uid())
    );

-- Chính sách xem (SELECT): Chỉ cho phép chủ sở hữu log xem, hoặc các vai trò quản lý (Admin, Leadership, Legal) xem toàn bộ
CREATE POLICY "Enable read for owners and management" ON public.ai_tool_audit_logs
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('Admin', 'Leadership', 'Legal')
        )
    );
