-- Thêm cột management_rank và managed_unit_ids vào bảng employees
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS management_rank int DEFAULT 0,
ADD COLUMN IF NOT EXISTS managed_unit_ids text[] DEFAULT '{}';

-- Cập nhật Dev Admin / Admin -> Rank 100 (Chủ tịch / TGĐ)
UPDATE employees e
SET management_rank = 100
FROM profiles p
WHERE e.id = p.id AND (p.email ILIKE '%admin%' OR p.full_name ILIKE '%admin%');

-- (Optional) Các tài khoản Trưởng đơn vị có thể được set management_rank = 50 sau qua giao diện Admin
