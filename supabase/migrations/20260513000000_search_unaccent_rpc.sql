-- Tạo hàm wrapper cho unaccent để có thể đánh index (nếu cần)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Xóa hàm cũ nếu có khác biệt về kiểu trả về
DROP FUNCTION IF EXISTS public.search_contracts_ids_unaccent(text);

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text AS $$
    SELECT unaccent($1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- Tạo RPC tìm kiếm hợp đồng không dấu
CREATE OR REPLACE FUNCTION public.search_contracts_ids_unaccent(search_term text)
RETURNS TABLE(id uuid) 
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id
  FROM contracts c
  WHERE 
    public.f_unaccent(lower(COALESCE(c.title, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%' OR
    public.f_unaccent(lower(COALESCE(c.contract_code, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%' OR
    public.f_unaccent(lower(COALESCE(c.party_a, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%' OR
    public.f_unaccent(lower(COALESCE(c.customer_contract_number, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%' OR
    public.f_unaccent(lower(COALESCE(c.end_user_name, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%' OR
    public.f_unaccent(lower(COALESCE(c.category, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%' OR
    public.f_unaccent(lower(COALESCE(c.content, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%';
END;
$$;
