-- =========================================================================
-- Supabase Migration: Update CRM Leads with customer_id and products
-- Created At: 2026-06-01
-- Description: Add customer_id (UUID ref) and products (JSONB) to crm_leads table
-- =========================================================================

-- Thêm 2 cột mới vào bảng crm_leads
ALTER TABLE public.crm_leads 
  ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS products JSONB DEFAULT '[]'::jsonb;

-- Comment mô tả
COMMENT ON COLUMN public.crm_leads.customer_id IS 'Liên kết trực tiếp tới một Khách hàng thực tế trong DB nếu đã xác định';
COMMENT ON COLUMN public.crm_leads.products IS 'Lưu trữ danh sách sản phẩm tiềm năng mà Lead quan tâm (dạng JSONB: mảng các đối tượng)';
