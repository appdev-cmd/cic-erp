-- Add new financial metrics to the contracts table
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS receivables numeric,
ADD COLUMN IF NOT EXISTS payables numeric,
ADD COLUMN IF NOT EXISTS admin_profit numeric,
ADD COLUMN IF NOT EXISTS rev_profit numeric;

-- Update data type if needed (assuming numeric for currency is fine, value, estimated_cost etc use numeric too)
COMMENT ON COLUMN contracts.receivables IS 'Công nợ phải thu (Receivables) = Tổng giá trị xuất hoá đơn sau VAT - Tổng tiền về thực tế';
COMMENT ON COLUMN contracts.payables IS 'Công nợ phải trả (Payables) = Tổng giá đầu vào từ nhà cung cấp - Tổng chi cho nhà cung cấp';
COMMENT ON COLUMN contracts.admin_profit IS 'Lợi nhuận gộp quản trị = Doanh thu dự kiến - Chi phí dự kiến';
COMMENT ON COLUMN contracts.rev_profit IS 'Lợi nhuận gộp theo doanh thu';
