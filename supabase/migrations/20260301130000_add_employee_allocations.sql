-- Thêm cột employee_allocations vào bảng contracts
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS employee_allocations JSONB DEFAULT '[]'::jsonb;

-- Comment mô tả cột
COMMENT ON COLUMN public.contracts.employee_allocations IS 'Phân bổ nhân viên thực hiện hợp đồng (mảng JSONB)';
