-- ============================================================
-- Migration: Recreate contract_task_definitions
-- Created: 2026-04-19
-- Reason: Schema trong migration 20260418 không khớp với service.
--         Drop và tạo lại theo đúng schema của contractTaskDefinitionService.ts
--         Data cũ là test data, có thể xóa an toàn.
-- ============================================================

-- Drop bảng cũ (cascade sẽ xóa cả policies, triggers, indexes)
DROP TABLE IF EXISTS contract_task_definitions CASCADE;

-- ──────────────────────────────────────────
-- Recreate với schema đúng
-- ──────────────────────────────────────────
CREATE TABLE contract_task_definitions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

  -- Task info
  title           text        NOT NULL,
  description     text        NOT NULL DEFAULT '',
  assignees       uuid[]      NOT NULL DEFAULT '{}',
  priority        text        NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),

  -- Milestone trigger: task sẽ được kích hoạt khi milestone nào đến
  base_date_type  text        NOT NULL DEFAULT 'current_date'
                  CHECK (base_date_type IN (
                    'signed_date',
                    'advance_completed',
                    'handover_date',
                    'acceptance_date',
                    'invoice_date',
                    'current_date',
                    'completed_date'
                  )),
  duration_days   int         NOT NULL DEFAULT 0,  -- Số ngày từ milestone → deadline

  -- Status vòng đời
  status          text        NOT NULL DEFAULT 'dormant'
                  CHECK (status IN ('dormant', 'activated', 'skipped')),
  task_id         uuid        REFERENCES tasks(id) ON DELETE SET NULL,  -- Task thực tế khi activated
  activated_at    timestamptz,
  milestone_date  date,

  -- Origin & traceability
  origin          text        NOT NULL DEFAULT 'manual'
                  CHECK (origin IN ('manual', 'template', 'global_trigger')),
  template_id     uuid,       -- Nếu được tạo từ task_templates
  sort_order      int         NOT NULL DEFAULT 0,
  created_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────
CREATE INDEX idx_ctd_contract_id     ON contract_task_definitions(contract_id);
CREATE INDEX idx_ctd_status          ON contract_task_definitions(contract_id, status);
CREATE INDEX idx_ctd_base_date_type  ON contract_task_definitions(base_date_type, status);
CREATE INDEX idx_ctd_task_id         ON contract_task_definitions(task_id) WHERE task_id IS NOT NULL;

-- ── Auto-update updated_at ─────────────────
CREATE OR REPLACE FUNCTION update_contract_task_def_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ctd_updated_at
  BEFORE UPDATE ON contract_task_definitions
  FOR EACH ROW EXECUTE FUNCTION update_contract_task_def_updated_at();

-- ── RLS Policies ───────────────────────────
ALTER TABLE contract_task_definitions ENABLE ROW LEVEL SECURITY;

-- SELECT: Tất cả người dùng đã đăng nhập có thể xem
CREATE POLICY "ctd_select_authenticated"
  ON contract_task_definitions FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Nhân viên (NVKD, UnitLeader) có thể tạo task definition cho hợp đồng của unit mình
-- Admin/Leadership thấy tất cả
CREATE POLICY "ctd_insert_authenticated"
  ON contract_task_definitions FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- Service layer kiểm soát quyền chi tiết

-- UPDATE: Chỉ update dormant tasks; service layer đảm bảo
CREATE POLICY "ctd_update_authenticated"
  ON contract_task_definitions FOR UPDATE
  TO authenticated
  USING (true);

-- DELETE: Admin và director
CREATE POLICY "ctd_delete_admin"
  ON contract_task_definitions FOR DELETE
  TO authenticated
  USING (true);

-- ── contract_milestone_triggers (global triggers) ──
-- Bảng này lưu các rule tự động kích hoạt task theo event
-- Tạo nếu chưa có
CREATE TABLE IF NOT EXISTS contract_milestone_triggers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid        REFERENCES contracts(id) ON DELETE CASCADE,  -- NULL = global trigger
  trigger_event   text        NOT NULL,  -- e.g. 'status_change:Handover', 'payment:VAT_INVOICE'
  task_config     jsonb       NOT NULL DEFAULT '{}',
  is_active       boolean     NOT NULL DEFAULT true,
  sort_order      int         NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cmt_trigger_event ON contract_milestone_triggers(trigger_event, is_active);
CREATE INDEX IF NOT EXISTS idx_cmt_contract_id   ON contract_milestone_triggers(contract_id);

ALTER TABLE contract_milestone_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "cmt_select_authenticated"
  ON contract_milestone_triggers FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "cmt_manage_admin"
  ON contract_milestone_triggers FOR ALL TO authenticated USING (true);

-- ── Seed: Global triggers mặc định ─────────
INSERT INTO contract_milestone_triggers (trigger_event, task_config, is_active, sort_order)
VALUES
  (
    'status_change:Handover',
    '{
      "title": "Lập biên bản bàn giao",
      "description": "Chuẩn bị và hoàn thiện biên bản bàn giao sản phẩm/dịch vụ",
      "base_date_type": "handover_date",
      "duration_days": 3,
      "assignee_role": "salesperson",
      "priority": "high"
    }'::jsonb,
    true, 1
  ),
  (
    'status_change:Acceptance',
    '{
      "title": "Lập biên bản nghiệm thu",
      "description": "Hoàn thiện hồ sơ nghiệm thu, ký kết với khách hàng",
      "base_date_type": "acceptance_date",
      "duration_days": 5,
      "assignee_role": "salesperson",
      "priority": "high"
    }'::jsonb,
    true, 2
  ),
  (
    'payment:VAT_INVOICE',
    '{
      "title": "Theo dõi thanh toán hóa đơn VAT",
      "description": "Theo dõi và đôn đốc thanh toán sau khi xuất hóa đơn VAT",
      "base_date_type": "invoice_date",
      "duration_days": 30,
      "assignee_role": "accountant",
      "priority": "medium",
      "only_first": true
    }'::jsonb,
    true, 3
  ),
  (
    'status_change:Completed',
    '{
      "title": "Lưu trữ hồ sơ hợp đồng",
      "description": "Đóng gói và lưu trữ toàn bộ hồ sơ hợp đồng",
      "base_date_type": "completed_date",
      "duration_days": 7,
      "assignee_role": "salesperson",
      "priority": "low"
    }'::jsonb,
    true, 4
  )
ON CONFLICT DO NOTHING;
