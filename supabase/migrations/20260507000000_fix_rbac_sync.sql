-- Migration: 20260507000000_fix_rbac_sync.sql
-- Mục đích:
--   1. Thêm các role còn thiếu vào user_role enum (Admin, NVKT, Marketing)
--   2. Đồng bộ 1 lần profiles.role và profiles.unit_id từ employees
--   3. Tạo trigger tự động sync mỗi khi employees.role_code / unit_id thay đổi
--   4. Thêm auth_employee_id() helper function
--   5. Gom tất cả RLS policies contracts thành bộ sạch, nhất quán
-- ============================================================

-- ============================================================
-- 1. THÊM ENUM VALUES CÒN THIẾU
-- ============================================================
-- ALTER TYPE ADD VALUE không thể chạy trong transaction trên PG < 12;
-- Supabase dùng PG 15+ nên OK. IF NOT EXISTS tránh lỗi nếu đã có.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'NVKT';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Marketing';

-- ============================================================
-- 2. HELPER FUNCTIONS
-- ============================================================

-- Trả về employee_id của user đang đăng nhập (từ profiles)
CREATE OR REPLACE FUNCTION auth_employee_id()
RETURNS TEXT AS $$
    SELECT employee_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Đảm bảo auth_user_role() và auth_user_unit_id() xử lý đúng NULL
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION auth_user_unit_id()
RETURNS uuid AS $$
    SELECT unit_id::uuid FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 3. ĐỒNG BỘ 1 LẦN: profiles từ employees (fix stale roles)
-- ============================================================
UPDATE profiles p
SET
    role        = CASE
                    WHEN e.role_code IN (
                        'NVKD', 'NVKT', 'AdminUnit', 'UnitLeader',
                        'Accountant', 'ChiefAccountant', 'Legal',
                        'Leadership', 'Admin', 'Marketing'
                    ) THEN e.role_code::user_role
                    ELSE p.role  -- giữ nguyên nếu role_code không hợp lệ
                  END,
    unit_id     = COALESCE(e.unit_id, p.unit_id),
    updated_at  = NOW()
FROM employees e
WHERE p.employee_id = e.id
  AND (
      p.role::text IS DISTINCT FROM e.role_code
      OR p.unit_id IS DISTINCT FROM e.unit_id
  );

-- ============================================================
-- 4. TRIGGER: Tự động sync profiles khi employee thay đổi role/unit
-- ============================================================
CREATE OR REPLACE FUNCTION sync_profile_from_employee()
RETURNS TRIGGER AS $$
BEGIN
    -- Chỉ chạy khi role_code hoặc unit_id thực sự thay đổi
    IF NEW.role_code IS DISTINCT FROM OLD.role_code
       OR NEW.unit_id IS DISTINCT FROM OLD.unit_id THEN

        UPDATE profiles
        SET
            role       = CASE
                            WHEN NEW.role_code IN (
                                'NVKD', 'NVKT', 'AdminUnit', 'UnitLeader',
                                'Accountant', 'ChiefAccountant', 'Legal',
                                'Leadership', 'Admin', 'Marketing'
                            ) THEN NEW.role_code::user_role
                            ELSE role  -- giữ nguyên nếu role_code không hợp lệ
                         END,
            unit_id    = COALESCE(NEW.unit_id, unit_id),
            updated_at = NOW()
        WHERE employee_id = NEW.id;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_profile_from_employee ON employees;
CREATE TRIGGER trg_sync_profile_from_employee
    AFTER UPDATE OF role_code, unit_id ON employees
    FOR EACH ROW
    EXECUTE FUNCTION sync_profile_from_employee();

-- ============================================================
-- 5. CẬP NHẬT handle_new_user: xử lý cả trường hợp profile đã tồn tại
--    (user đổi email rồi đăng nhập lại, hoặc profile bị lỗi trước đó)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    matched_emp   RECORD;
    google_avatar TEXT;
    valid_role    user_role;
BEGIN
    google_avatar := new.raw_user_meta_data->>'avatar_url';

    SELECT id, name, unit_id, role_code
    INTO matched_emp
    FROM public.employees
    WHERE LOWER(email) = LOWER(new.email)
    LIMIT 1;

    IF matched_emp.id IS NULL THEN
        -- Không tìm thấy employee → không tạo profile
        RETURN new;
    END IF;

    -- Ép kiểu role an toàn
    BEGIN
        valid_role := matched_emp.role_code::user_role;
    EXCEPTION WHEN OTHERS THEN
        valid_role := 'NVKD';
    END;

    INSERT INTO public.profiles (id, email, full_name, role, unit_id, employee_id, avatar_url)
    VALUES (
        new.id,
        new.email,
        matched_emp.name,
        valid_role,
        matched_emp.unit_id,
        matched_emp.id,
        google_avatar
    )
    ON CONFLICT (id) DO UPDATE
        SET role        = EXCLUDED.role,
            unit_id     = EXCLUDED.unit_id,
            full_name   = EXCLUDED.full_name,
            employee_id = EXCLUDED.employee_id,
            avatar_url  = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
            updated_at  = NOW();

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 6. DỌN DẸP VÀ GOM LẠI TẤT CẢ RLS POLICIES TRÊN contracts
-- ============================================================

-- Xóa tất cả policies cũ (cả cũ lẫn mới, tránh trùng lặp)
DROP POLICY IF EXISTS "Unit Scope Read"            ON contracts;
DROP POLICY IF EXISTS "Unit Scope Insert"          ON contracts;
DROP POLICY IF EXISTS "Unit Scope Update"          ON contracts;
DROP POLICY IF EXISTS "Contracts_View_Policy"      ON contracts;
DROP POLICY IF EXISTS "Contracts_Manage_Policy"    ON contracts;
DROP POLICY IF EXISTS "contracts_select"           ON contracts;
DROP POLICY IF EXISTS "contracts_insert"           ON contracts;
DROP POLICY IF EXISTS "contracts_update"           ON contracts;
DROP POLICY IF EXISTS "contracts_delete"           ON contracts;

-- SELECT: Ai được xem hợp đồng
-- • Global roles (Admin, Leadership, Legal, Accountant, ChiefAccountant, Marketing): xem TẤT CẢ
-- • AdminUnit, UnitLeader: xem TẤT CẢ — cần thiết để allocation-aware mode
--   tìm được hợp đồng phối hợp mà đơn vị họ là support unit
-- • NVKD, NVKT: chỉ xem hợp đồng của đơn vị mình (unit_id match)
-- • Fallback: hợp đồng mà employee_id = employee_id của mình (legacy)
CREATE POLICY "contracts_select" ON contracts
    FOR SELECT USING (
        -- Global + AdminUnit/UnitLeader cần thấy toàn bộ để lọc phía JS
        auth_user_role() IN (
            'Admin', 'Leadership', 'Legal',
            'Accountant', 'ChiefAccountant', 'Marketing',
            'AdminUnit', 'UnitLeader'
        )
        -- NVKD/NVKT: chỉ thấy hợp đồng của đơn vị mình
        OR unit_id = auth_user_unit_id()
        -- Fallback: hợp đồng mà mình là người phụ trách
        OR employee_id = auth_employee_id()
    );

-- INSERT: Ai được tạo hợp đồng mới
CREATE POLICY "contracts_insert" ON contracts
    FOR INSERT WITH CHECK (
        auth_user_role() IN (
            'Admin', 'Leadership',
            'AdminUnit', 'UnitLeader', 'NVKD'
        )
    );

-- UPDATE: Ai được sửa hợp đồng
-- • Admin/Leadership: sửa tất cả
-- • Accountant/ChiefAccountant: sửa tất cả (giới hạn field do UI xử lý)
-- • AdminUnit/UnitLeader: chỉ sửa hợp đồng của đơn vị mình
-- • NVKD: chỉ sửa hợp đồng mà mình là người phụ trách
CREATE POLICY "contracts_update" ON contracts
    FOR UPDATE USING (
        auth_user_role() IN ('Admin', 'Leadership', 'Accountant', 'ChiefAccountant')
        OR (
            auth_user_role() IN ('AdminUnit', 'UnitLeader')
            AND unit_id = auth_user_unit_id()
        )
        OR (
            auth_user_role() = 'NVKD'
            AND employee_id = auth_employee_id()
        )
    );

-- DELETE: Chỉ Admin và Leadership
CREATE POLICY "contracts_delete" ON contracts
    FOR DELETE USING (
        auth_user_role() IN ('Admin', 'Leadership')
    );

-- ============================================================
-- 7. GOM LẠI RLS POLICIES TRÊN contract_business_plans (PAKD)
-- ============================================================
DROP POLICY IF EXISTS "Unit Scope Read PAKD"       ON contract_business_plans;
DROP POLICY IF EXISTS "Unit Scope Write PAKD"      ON contract_business_plans;
DROP POLICY IF EXISTS "PAKD_View_Policy"           ON contract_business_plans;
DROP POLICY IF EXISTS "pakd_select"                ON contract_business_plans;
DROP POLICY IF EXISTS "pakd_insert"                ON contract_business_plans;
DROP POLICY IF EXISTS "pakd_update"                ON contract_business_plans;

CREATE POLICY "pakd_select" ON contract_business_plans
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM contracts c
            WHERE c.id = contract_business_plans.contract_id
              AND (
                  auth_user_role() IN (
                      'Admin', 'Leadership', 'Legal',
                      'Accountant', 'ChiefAccountant', 'Marketing',
                      'AdminUnit', 'UnitLeader'
                  )
                  OR c.unit_id = auth_user_unit_id()
                  OR c.employee_id = auth_employee_id()
              )
        )
    );

CREATE POLICY "pakd_write" ON contract_business_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM contracts c
            WHERE c.id = contract_business_plans.contract_id
              AND (
                  auth_user_role() IN ('Admin', 'Leadership')
                  OR (
                      auth_user_role() IN ('AdminUnit', 'UnitLeader')
                      AND c.unit_id = auth_user_unit_id()
                  )
                  OR (
                      auth_user_role() = 'NVKD'
                      AND c.employee_id = auth_employee_id()
                  )
              )
        )
    );

-- ============================================================
-- 8. XÁC NHẬN kết quả đồng bộ (query kiểm tra, không thay đổi data)
-- ============================================================
-- Để xem kết quả sau khi apply: chạy query sau trong Supabase SQL editor:
-- SELECT p.email, p.role AS profile_role, e.role_code AS emp_role, p.unit_id AS profile_unit, e.unit_id AS emp_unit
-- FROM profiles p JOIN employees e ON p.employee_id = e.id
-- WHERE p.role::text != e.role_code OR p.unit_id IS DISTINCT FROM e.unit_id;
-- → Kết quả rỗng = tất cả đã đồng bộ.
