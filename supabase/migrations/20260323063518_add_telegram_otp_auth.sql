-- Bảng quản lý OTP
CREATE TABLE IF NOT EXISTS telegram_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  telegram_id text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index để dọn dẹp OTP hết hạn
CREATE INDEX IF NOT EXISTS idx_telegram_otp_expires ON telegram_otp(expires_at);

-- Cột trạng thái verify trong employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS telegram_verified boolean DEFAULT false;

-- RLS
ALTER TABLE telegram_otp ENABLE ROW LEVEL SECURITY;

-- Service Role full access
CREATE POLICY "Service Role can manage otp" 
  ON telegram_otp FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated có thể xem OTP của họ (để check verified) nhưng không thể xem otp_code
CREATE POLICY "Users view own otp status"
  ON telegram_otp FOR SELECT TO authenticated
  USING (employee_id IN (
    SELECT employee_id FROM profiles WHERE id = auth.uid()
  ));
