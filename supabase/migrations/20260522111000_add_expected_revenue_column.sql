-- 1. Thêm cột expected_revenue (Doanh thu dự kiến trước thuế) vào bảng contracts nếu chưa tồn tại
ALTER TABLE public.contracts 
  ADD COLUMN IF NOT EXISTS expected_revenue NUMERIC DEFAULT 0;

-- 2. Cập nhật trigger calculate_contract_profits để sử dụng expected_revenue chuẩn xác
CREATE OR REPLACE FUNCTION calculate_contract_profits()
RETURNS TRIGGER AS $$
DECLARE
    v_expected_revenue NUMERIC;
BEGIN
    -- Xác định doanh thu dự kiến (pre-VAT expected revenue)
    IF NEW.expected_revenue IS NOT NULL AND NEW.expected_revenue > 0 THEN
        v_expected_revenue := NEW.expected_revenue;
    ELSIF NEW.has_vat IS NOT FALSE AND COALESCE(NEW.vat_rate, 10) > 0 THEN
        v_expected_revenue := COALESCE(NEW.value, 0) / (1 + COALESCE(NEW.vat_rate, 10)::NUMERIC / 100);
    ELSE
        v_expected_revenue := COALESCE(NEW.value, 0);
    END IF;

    -- Lưu lại expected_revenue đã được chuẩn hoá
    NEW.expected_revenue := Math_Round_To_Int(v_expected_revenue);

    -- admin_profit = Doanh thu dự kiến - Chi phí dự kiến
    NEW.admin_profit := Math_Round_To_Int(v_expected_revenue - COALESCE(NEW.estimated_cost, 0));

    -- rev_profit = (Doanh thu thực tế / Doanh thu dự kiến) * admin_profit
    IF v_expected_revenue > 0 THEN
        NEW.rev_profit := Math_Round_To_Int((COALESCE(NEW.actual_revenue, 0) / v_expected_revenue) * NEW.admin_profit);
    ELSE
        NEW.rev_profit := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Hàm làm tròn số nguyên bổ trợ cho trigger (nếu chưa có, tự định nghĩa hoặc dùng round)
CREATE OR REPLACE FUNCTION Math_Round_To_Int(val NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
    RETURN ROUND(val);
END;
$$ LANGUAGE plpgsql;

-- 3. Tạo lại Trigger theo dõi cả sự thay đổi của cột expected_revenue
DROP TRIGGER IF EXISTS trigger_calculate_contract_profits ON contracts;
CREATE TRIGGER trigger_calculate_contract_profits
BEFORE INSERT OR UPDATE OF value, expected_revenue, estimated_cost, actual_revenue ON contracts
FOR EACH ROW
EXECUTE FUNCTION calculate_contract_profits();

-- 4. Backfill dữ liệu: Tính toán lại expected_revenue, admin_profit, rev_profit cho toàn bộ hợp đồng hiện tại
UPDATE contracts
SET expected_revenue = ROUND(
    CASE 
        WHEN has_vat IS NOT FALSE AND COALESCE(vat_rate, 10) > 0 THEN 
            COALESCE(value, 0) / (1 + COALESCE(vat_rate, 10)::NUMERIC / 100)
        ELSE 
            COALESCE(value, 0)
    END
);

UPDATE contracts
SET 
    admin_profit = ROUND(COALESCE(expected_revenue, 0) - COALESCE(estimated_cost, 0)),
    rev_profit = ROUND(
        CASE 
            WHEN COALESCE(expected_revenue, 0) > 0 THEN 
                (COALESCE(actual_revenue, 0) / expected_revenue) * (COALESCE(expected_revenue, 0) - COALESCE(estimated_cost, 0))
            ELSE 
                0 
        END
    );
