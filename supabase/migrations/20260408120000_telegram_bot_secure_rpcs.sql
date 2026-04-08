-- Telegram bot (CIC trợ lý): RPC an toàn — chỉ service_role, kiểm tra nhân viên + quyền theo profile.
-- Không SQL tự do từ LLM; worker truyền employee_id đã resolve từ telegram đã verify.

-- ─── Audit (tùy chọn ghi từ worker) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telegram_bot_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    telegram_chat_id TEXT,
    employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    meta JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE telegram_bot_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_bot_audit_service" ON telegram_bot_audit;
CREATE POLICY "telegram_bot_audit_service"
    ON telegram_bot_audit FOR ALL TO service_role
    USING (true) WITH CHECK (true);

COMMENT ON TABLE telegram_bot_audit IS 'Nhật ký hành động bot Telegram (worker ghi qua service role).';

-- ─── Helper: role xem toàn cục (khớp RLS contracts chính) ─────────────────
CREATE OR REPLACE FUNCTION public.telegram_bot_is_contract_global_role(p_role user_role)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT p_role IN (
        'Admin'::user_role,
        'Leadership'::user_role,
        'Legal'::user_role,
        'Accountant'::user_role,
        'ChiefAccountant'::user_role,
        'AdminUnit'::user_role
    );
$$;

-- ─── 1) Resolve telegram chat_id → ngữ cảnh ERP ───────────────────────────
CREATE OR REPLACE FUNCTION public.telegram_bot_resolve_context(p_telegram_chat_id TEXT)
RETURNS TABLE (
    employee_id TEXT,
    profile_id UUID,
    full_name TEXT,
    role user_role,
    unit_id TEXT,
    telegram_verified BOOLEAN,
    ok BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_chat TEXT;
    r_employee_id TEXT;
    r_profile_id UUID;
    r_full_name TEXT;
    r_role user_role;
    r_unit TEXT;
    r_verified BOOLEAN;
BEGIN
    v_chat := trim(both from p_telegram_chat_id);
    IF v_chat IS NULL OR v_chat = '' THEN
        RETURN QUERY SELECT NULL::text, NULL::uuid, NULL::text, NULL::user_role, NULL::text,
            false, false, 'Thiếu Telegram chat_id'::text;
        RETURN;
    END IF;

    SELECT
        e.id,
        p.id,
        coalesce(p.full_name, e.name)::text,
        p.role,
        p.unit_id::text,
        coalesce(e.telegram_verified, false)
    INTO r_employee_id, r_profile_id, r_full_name, r_role, r_unit, r_verified
    FROM employees e
    INNER JOIN profiles p ON p.employee_id = e.id
    WHERE trim(both from e.telegram) = v_chat
      AND coalesce(e.telegram_verified, false) = true
    LIMIT 1;

    IF r_employee_id IS NULL THEN
        RETURN QUERY SELECT NULL::text, NULL::uuid, NULL::text, NULL::user_role, NULL::text,
            false, false,
            'Telegram chưa liên kết hoặc chưa xác thực trên CIC ERP. Vào Cài đặt cá nhân để xác thực.'::text;
        RETURN;
    END IF;

    RETURN QUERY SELECT r_employee_id, r_profile_id, r_full_name, r_role, r_unit, r_verified, true, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.telegram_bot_resolve_context(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.telegram_bot_resolve_context(TEXT) TO service_role;

COMMENT ON FUNCTION public.telegram_bot_resolve_context IS 'Map Telegram chat_id → employee + profile (bắt buộc telegram_verified).';

-- ─── 2) Báo cáo danh sách hợp đồng (theo quyền đơn vị / global) ────────────
CREATE OR REPLACE FUNCTION public.telegram_bot_contracts_report(
    p_employee_id TEXT,
    p_from DATE DEFAULT NULL,
    p_to DATE DEFAULT NULL,
    p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
    contract_id TEXT,
    contract_code TEXT,
    title TEXT,
    unit_id TEXT,
    status TEXT,
    signed_date DATE,
    value_numeric NUMERIC,
    customer_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role user_role;
    v_unit TEXT;
    v_lim INTEGER;
BEGIN
    IF p_employee_id IS NULL OR trim(p_employee_id) = '' THEN
        RAISE EXCEPTION 'employee_id bắt buộc';
    END IF;

    v_lim := least(coalesce(nullif(p_limit, 0), 500), 2000);

    SELECT p.role, p.unit_id::text
    INTO v_role, v_unit
    FROM profiles p
    WHERE p.employee_id = p_employee_id
    LIMIT 1;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy profile gắn employee_id';
    END IF;

    IF telegram_bot_is_contract_global_role(v_role) THEN
        RETURN QUERY
        SELECT
            c.id,
            c.contract_code,
            c.title,
            c.unit_id::text,
            c.status::text,
            coalesce((c.signed_date)::date, (c.created_at)::date),
            c.value,
            c.customer_id::text
        FROM contracts c
        WHERE (p_from IS NULL OR coalesce((c.signed_date)::date, (c.created_at)::date) >= p_from)
          AND (p_to IS NULL OR coalesce((c.signed_date)::date, (c.created_at)::date) <= p_to)
        ORDER BY coalesce(c.signed_date, c.created_at) DESC NULLS LAST
        LIMIT v_lim;
    ELSE
        RETURN QUERY
        SELECT
            c.id,
            c.contract_code,
            c.title,
            c.unit_id::text,
            c.status::text,
            coalesce((c.signed_date)::date, (c.created_at)::date),
            c.value,
            c.customer_id::text
        FROM contracts c
        WHERE c.unit_id::text IS NOT DISTINCT FROM v_unit
          AND (p_from IS NULL OR coalesce((c.signed_date)::date, (c.created_at)::date) >= p_from)
          AND (p_to IS NULL OR coalesce((c.signed_date)::date, (c.created_at)::date) <= p_to)
        ORDER BY coalesce(c.signed_date, c.created_at) DESC NULLS LAST
        LIMIT v_lim;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.telegram_bot_contracts_report(TEXT, DATE, DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.telegram_bot_contracts_report(TEXT, DATE, DATE, INTEGER) TO service_role;

COMMENT ON FUNCTION public.telegram_bot_contracts_report IS 'DS hợp đồng cho bot Telegram: global role xem all, còn lại chỉ đơn vị profile.';

-- ─── 3) Ghi audit (gọi từ worker) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.telegram_bot_audit_log(
    p_telegram_chat_id TEXT,
    p_employee_id TEXT,
    p_action TEXT,
    p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO telegram_bot_audit (telegram_chat_id, employee_id, action, meta)
    VALUES (p_telegram_chat_id, p_employee_id, p_action, coalesce(p_meta, '{}'::jsonb))
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.telegram_bot_audit_log(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.telegram_bot_audit_log(TEXT, TEXT, TEXT, JSONB) TO service_role;
