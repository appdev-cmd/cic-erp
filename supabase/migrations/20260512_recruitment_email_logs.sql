-- ============================================================
-- HRM Module — Recruitment Email Logs
-- Lưu lịch sử email gửi cho ứng viên khi chuyển stage
-- ============================================================

CREATE TABLE IF NOT EXISTS recruitment_email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL,
    email_to TEXT NOT NULL,
    email_subject TEXT NOT NULL,
    email_html TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    sent_by TEXT,  -- employee_id của HR đã bấm gửi
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_remail_app ON recruitment_email_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_remail_candidate ON recruitment_email_logs(candidate_id);

-- RLS
ALTER TABLE recruitment_email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON recruitment_email_logs FOR ALL USING (true);
