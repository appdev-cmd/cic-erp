-- Migration: Tạo bảng role_permission_defaults
-- Mục đích: Lưu persistent quyền mặc định theo role (thay thế in-memory DEFAULT_ROLE_PERMISSIONS)
-- Khi Admin chỉnh trong Settings → Quyền theo Role, data được lưu vào đây
-- App load lên sẽ đọc từ bảng này; fallback về hardcode nếu bảng trống

CREATE TABLE IF NOT EXISTS role_permission_defaults (
    role        TEXT        NOT NULL,   -- 'NVKD', 'Accountant', 'Marketing', ...
    resource    TEXT        NOT NULL,   -- 'contracts', 'payments', 'news', ...
    actions     TEXT[]      NOT NULL DEFAULT '{}',  -- ['view', 'create']
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,

    PRIMARY KEY (role, resource)
);

COMMENT ON TABLE role_permission_defaults IS
    'Quyền mặc định theo role — Admin có thể chỉnh qua Settings → Quyền theo Role. '
    'Nếu bảng trống, app fallback về DEFAULT_ROLE_PERMISSIONS hardcode trong types/workflow.ts.';

-- Index cho lookup theo role
CREATE INDEX IF NOT EXISTS idx_role_perm_defaults_role ON role_permission_defaults(role);

-- RLS: Cho phép đọc (authenticated), chỉ Admin mới ghi
ALTER TABLE role_permission_defaults ENABLE ROW LEVEL SECURITY;

-- Ai cũng đọc được (app cần load defaults khi khởi động)
CREATE POLICY "Anyone can read role defaults"
    ON role_permission_defaults FOR SELECT
    TO authenticated
    USING (true);

-- Chỉ Admin mới ghi
CREATE POLICY "Only admin can write role defaults"
    ON role_permission_defaults FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'Admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'Admin'
        )
    );

-- Seed dữ liệu ban đầu từ DEFAULT_ROLE_PERMISSIONS
-- (sync với types/workflow.ts tại thời điểm viết migration này)

INSERT INTO role_permission_defaults (role, resource, actions) VALUES
-- Admin: toàn quyền (không seed — Admin luôn bypass permission check)

-- Leadership
('Leadership', 'contracts',   ARRAY['view','create','update','delete']),
('Leadership', 'employees',   ARRAY['view','create','update','delete']),
('Leadership', 'units',       ARRAY['view','create','update','delete']),
('Leadership', 'customers',   ARRAY['view','create','update','delete']),
('Leadership', 'products',    ARRAY['view','create','update','delete']),
('Leadership', 'payments',    ARRAY['view']),
('Leadership', 'tasks',       ARRAY['view','create','update','delete']),
('Leadership', 'projects',    ARRAY['view','create','update','delete']),
('Leadership', 'requests',    ARRAY['view','create','update','delete']),
('Leadership', 'leaves',      ARRAY['view','create','update','delete']),
('Leadership', 'recruitment', ARRAY['view','create','update','delete']),

-- UnitLeader
('UnitLeader', 'contracts',   ARRAY['view','create','update']),
('UnitLeader', 'customers',   ARRAY['view','create','update']),
('UnitLeader', 'products',    ARRAY['view','create','update']),
('UnitLeader', 'payments',    ARRAY['view']),
('UnitLeader', 'tasks',       ARRAY['view','create','update']),
('UnitLeader', 'units',       ARRAY['view','update']),

-- AdminUnit
('AdminUnit', 'contracts',    ARRAY['view','create','update']),
('AdminUnit', 'customers',    ARRAY['view','create','update']),
('AdminUnit', 'products',     ARRAY['view','create','update']),
('AdminUnit', 'payments',     ARRAY['view']),
('AdminUnit', 'tasks',        ARRAY['view','create','update']),
('AdminUnit', 'units',        ARRAY['view','update']),

-- NVKD
('NVKD', 'contracts',         ARRAY['view','create','update']),
('NVKD', 'customers',         ARRAY['view','create','update']),
('NVKD', 'products',          ARRAY['view','create','update']),
('NVKD', 'payments',          ARRAY['view']),
('NVKD', 'tasks',             ARRAY['view','create','update']),

-- NVKT
('NVKT', 'contracts',         ARRAY['view']),
('NVKT', 'customers',         ARRAY['view']),
('NVKT', 'products',          ARRAY['view','create','update']),
('NVKT', 'payments',          ARRAY['view']),
('NVKT', 'tasks',             ARRAY['view','create','update']),

-- ChiefAccountant
('ChiefAccountant', 'contracts',  ARRAY['view','update']),
('ChiefAccountant', 'customers',  ARRAY['view','create','update']),
('ChiefAccountant', 'products',   ARRAY['view','create','update']),
('ChiefAccountant', 'payments',   ARRAY['view','create','update','delete']),
('ChiefAccountant', 'tasks',      ARRAY['view','create','update']),
('ChiefAccountant', 'employees',  ARRAY['view']),

-- Accountant
('Accountant', 'contracts',       ARRAY['view','update']),
('Accountant', 'customers',       ARRAY['view','create','update']),
('Accountant', 'products',        ARRAY['view','create','update']),
('Accountant', 'payments',        ARRAY['view','create','update']),
('Accountant', 'tasks',           ARRAY['view','create','update']),

-- Legal
('Legal', 'contracts',            ARRAY['view']),
('Legal', 'customers',            ARRAY['view','create','update']),
('Legal', 'products',             ARRAY['view','create','update']),
('Legal', 'payments',             ARRAY['view']),
('Legal', 'tasks',                ARRAY['view','create','update']),

-- Marketing (đã mở rộng theo business rules mới)
('Marketing', 'projects',         ARRAY['view']),
('Marketing', 'products',         ARRAY['view','create','update']),
('Marketing', 'customers',        ARRAY['view']),
('Marketing', 'news',             ARRAY['view','create','update','delete']),
('Marketing', 'tasks',            ARRAY['view','create','update']),
('Marketing', 'contracts',        ARRAY['view'])

ON CONFLICT (role, resource) DO NOTHING;  -- Không ghi đè nếu đã có custom config
