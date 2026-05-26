-- ============================================================
-- Migration: 20260526083000_fix_security_issues.sql
-- Mô tả: Thắt chặt Row Level Security (RLS) cho các bảng profiles, tasks, 
--        và phân hệ HRM (leave_requests, leave_balances, internal_requests).
-- ============================================================

-- ============================================================
-- 1. BẢNG profiles: Loại bỏ permissive dev policy, thắt chặt quyền ghi
-- ============================================================

-- Dọn dẹp tất cả các chính sách cũ của profiles để tránh trùng lặp
DROP POLICY IF EXISTS "Dev_Allow_All_Profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admin can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "SuperAdmin Override" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles_Select_Policy" ON profiles;
DROP POLICY IF EXISTS "Profiles_Insert_Policy" ON profiles;
DROP POLICY IF EXISTS "Profiles_Update_Policy" ON profiles;
DROP POLICY IF EXISTS "Profiles_Delete_Policy" ON profiles;

-- SELECT: Cho phép tất cả user đã xác thực xem danh sách profiles để phục vụ hiển thị trên UI
CREATE POLICY "profiles_select" ON profiles
    FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT: Chỉ cho phép người dùng tự khởi tạo profile trùng với auth uid của mình
CREATE POLICY "profiles_insert" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- UPDATE: Cho phép chính chủ hoặc Admin/Leadership cập nhật thông tin profile
CREATE POLICY "profiles_update" ON profiles
    FOR UPDATE USING (
        auth.uid() = id
        OR auth_user_role() IN ('Admin', 'Leadership')
    );

-- DELETE: Chỉ Admin hoặc Leadership mới có quyền xóa profile nhân viên
CREATE POLICY "profiles_delete" ON profiles
    FOR DELETE USING (auth_user_role() IN ('Admin', 'Leadership'));


-- ============================================================
-- 2. BẢNG tasks: Kích hoạt RLS hoàn chỉnh và tạo các chính sách phân quyền
-- ============================================================

-- Kích hoạt RLS trên bảng tasks (nếu chưa kích hoạt)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Dọn dẹp chính sách cũ (nếu có)
DROP POLICY IF EXISTS "tasks_select" ON tasks;
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
DROP POLICY IF EXISTS "tasks_update" ON tasks;
DROP POLICY IF EXISTS "tasks_delete" ON tasks;

-- SELECT: Ai được quyền xem công việc
CREATE POLICY "tasks_select" ON tasks
    FOR SELECT USING (
        -- Admin & Leadership có toàn quyền xem toàn bộ công việc
        auth_user_role() IN ('Admin', 'Leadership')
        -- Nếu công việc không riêng tư (is_private = false)
        OR (
            NOT is_private
            AND (
                created_by = auth_employee_id()
                OR auth_employee_id() = ANY(assignees)
                OR auth_employee_id() = ANY(watchers)
                OR auth_employee_id() = ANY(supporters)
                OR auth_employee_id() = ANY(approvers)
                -- Trưởng bộ phận xem các công việc được tạo bởi nhân viên thuộc bộ phận mình
                OR (
                    auth_user_role() IN ('UnitLeader', 'AdminUnit')
                    AND created_by IN (
                        SELECT id FROM employees WHERE unit_id = auth_user_unit_id()::text
                    )
                )
            )
        )
        -- Nếu công việc riêng tư (is_private = true)
        OR (
            is_private
            AND (
                created_by = auth_employee_id()
                OR auth_employee_id() = ANY(assignees)
            )
        )
    );

-- INSERT: Ai được quyền tạo công việc mới
CREATE POLICY "tasks_insert" ON tasks
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND created_by = auth_employee_id()
    );

-- UPDATE: Ai được quyền chỉnh sửa thông tin công việc
CREATE POLICY "tasks_update" ON tasks
    FOR UPDATE USING (
        auth_user_role() IN ('Admin', 'Leadership')
        OR created_by = auth_employee_id()
        OR auth_employee_id() = ANY(assignees)
    );

-- DELETE: Ai được quyền xóa công việc
CREATE POLICY "tasks_delete" ON tasks
    FOR DELETE USING (
        auth_user_role() IN ('Admin', 'Leadership')
        OR created_by = auth_employee_id()
    );


-- ============================================================
-- 3. PHÂN HỆ HRM (Leave Requests & Leave Balances)
-- ============================================================

-- Bảng 3.1: leave_policies
DROP POLICY IF EXISTS "Allow authenticated access" ON leave_policies;
DROP POLICY IF EXISTS "leave_policies_select" ON leave_policies;
DROP POLICY IF EXISTS "leave_policies_write" ON leave_policies;

CREATE POLICY "leave_policies_select" ON leave_policies
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "leave_policies_write" ON leave_policies
    FOR ALL USING (auth_user_role() IN ('Admin', 'Leadership'));

-- Bảng 3.2: leave_balances
DROP POLICY IF EXISTS "Allow authenticated access" ON leave_balances;
DROP POLICY IF EXISTS "leave_balances_select" ON leave_balances;
DROP POLICY IF EXISTS "leave_balances_write" ON leave_balances;

CREATE POLICY "leave_balances_select" ON leave_balances
    FOR SELECT USING (
        auth_user_role() IN ('Admin', 'Leadership')
        OR employee_id = auth_employee_id()
        OR (
            auth_user_role() IN ('UnitLeader', 'AdminUnit')
            AND employee_id IN (
                SELECT id FROM employees WHERE unit_id = auth_user_unit_id()::text
            )
        )
    );

CREATE POLICY "leave_balances_write" ON leave_balances
    FOR ALL USING (auth_user_role() IN ('Admin', 'Leadership'));

-- Bảng 3.3: leave_requests
DROP POLICY IF EXISTS "Allow authenticated access" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_select" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_update" ON leave_requests;
DROP POLICY IF EXISTS "leave_requests_delete" ON leave_requests;

-- SELECT: Xem đơn xin nghỉ phép
CREATE POLICY "leave_requests_select" ON leave_requests
    FOR SELECT USING (
        auth_user_role() IN ('Admin', 'Leadership')
        OR employee_id = auth_employee_id()
        OR approver_id = auth_employee_id()
        OR (
            auth_user_role() IN ('UnitLeader', 'AdminUnit')
            AND unit_id = auth_user_unit_id()::text
        )
    );

-- INSERT: Nhân viên tự gửi đơn nghỉ cho chính mình
CREATE POLICY "leave_requests_insert" ON leave_requests
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND employee_id = auth_employee_id()
    );

-- UPDATE: Cập nhật đơn xin nghỉ phép
CREATE POLICY "leave_requests_update" ON leave_requests
    FOR UPDATE USING (
        -- Quyền của Admin / Leadership
        auth_user_role() IN ('Admin', 'Leadership')
        -- Nhân viên tự cập nhật đơn của mình khi ở trạng thái nháp hoặc chờ duyệt
        OR (
            employee_id = auth_employee_id()
            AND status IN ('draft', 'pending')
        )
        -- Người phê duyệt được gán cập nhật trạng thái duyệt đơn
        OR approver_id = auth_employee_id()
        -- Trưởng bộ phận cập nhật trạng thái duyệt đơn của đơn vị mình quản lý
        OR (
            auth_user_role() IN ('UnitLeader', 'AdminUnit')
            AND unit_id = auth_user_unit_id()::text
        )
    );

-- DELETE: Xóa đơn xin nghỉ phép
CREATE POLICY "leave_requests_delete" ON leave_requests
    FOR DELETE USING (
        auth_user_role() IN ('Admin', 'Leadership')
        OR (
            employee_id = auth_employee_id()
            AND status = 'draft'
        )
    );


-- ============================================================
-- 4. PHÂN HỆ HRM (Internal Requests)
-- ============================================================

DROP POLICY IF EXISTS "Users can read requests" ON internal_requests;
DROP POLICY IF EXISTS "Users can insert their own requests" ON internal_requests;
DROP POLICY IF EXISTS "Users can update their own drafts/pending" ON internal_requests;
DROP POLICY IF EXISTS "Approvers can update" ON internal_requests;
DROP POLICY IF EXISTS "internal_requests_select" ON internal_requests;
DROP POLICY IF EXISTS "internal_requests_insert" ON internal_requests;
DROP POLICY IF EXISTS "internal_requests_update" ON internal_requests;
DROP POLICY IF EXISTS "internal_requests_delete" ON internal_requests;

-- SELECT: Xem yêu cầu nội bộ
CREATE POLICY "internal_requests_select" ON internal_requests
    FOR SELECT USING (
        auth_user_role() IN ('Admin', 'Leadership')
        OR employee_id = auth_employee_id()
        OR approver_unit_id = auth_employee_id()
        OR approver_admin_id = auth_employee_id()
        OR (
            auth_user_role() IN ('UnitLeader', 'AdminUnit')
            AND unit_id = auth_user_unit_id()::text
        )
    );

-- INSERT: Nhân viên tự tạo đơn yêu cầu nội bộ cho chính mình
CREATE POLICY "internal_requests_insert" ON internal_requests
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        AND employee_id = auth_employee_id()
    );

-- UPDATE: Phê duyệt hoặc chỉnh sửa đơn yêu cầu nội bộ
CREATE POLICY "internal_requests_update" ON internal_requests
    FOR UPDATE USING (
        -- Admin & Leadership có toàn quyền
        auth_user_role() IN ('Admin', 'Leadership')
        -- Chính chủ tự sửa đơn chưa phê duyệt
        OR (
            employee_id = auth_employee_id()
            AND status IN ('pending_unit', 'pending_admin')
        )
        -- Người phê duyệt bộ phận (hoặc Trưởng bộ phận) phê duyệt
        OR approver_unit_id = auth_employee_id()
        OR (
            auth_user_role() IN ('UnitLeader', 'AdminUnit')
            AND unit_id = auth_user_unit_id()::text
        )
        -- Người phê duyệt hành chính phê duyệt
        OR approver_admin_id = auth_employee_id()
    );

-- DELETE: Xóa đơn yêu cầu nội bộ
CREATE POLICY "internal_requests_delete" ON internal_requests
    FOR DELETE USING (
        auth_user_role() IN ('Admin', 'Leadership')
        OR (
            employee_id = auth_employee_id()
            AND status = 'pending_unit'
        )
    );
