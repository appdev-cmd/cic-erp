-- Cập nhật trigger calculate_contract_profits để tính toán chuẩn xác theo nghiệp vụ:
-- LNG theo DT = Doanh thu thực tế - Chi phí dự kiến * (Doanh thu thực tế / Doanh thu dự kiến)
-- Trong đó, Doanh thu dự kiến = value / (1 + vat_rate / 100) (nếu có VAT)

CREATE OR REPLACE FUNCTION calculate_contract_profits()
RETURNS TRIGGER AS $$
DECLARE
    v_expected_revenue NUMERIC;
BEGIN
    -- 1. Quy đổi giá trị hợp đồng ký kết về pre-VAT (Doanh thu dự kiến trước thuế)
    IF NEW.has_vat IS NOT FALSE AND COALESCE(NEW.vat_rate, 0) > 0 THEN
        v_expected_revenue := COALESCE(NEW.value, 0) / (1 + COALESCE(NEW.vat_rate, 10)::NUMERIC / 100);
    ELSE
        v_expected_revenue := COALESCE(NEW.value, 0);
    END IF;

    -- 2. admin_profit = Doanh thu dự kiến - Chi phí dự kiến
    NEW.admin_profit := v_expected_revenue - COALESCE(NEW.estimated_cost, 0);

    -- 3. rev_profit = Doanh thu thực tế - Chi phí dự kiến * (Doanh thu thực tế / Doanh thu dự kiến)
    -- Tương đương: rev_profit = (Doanh thu thực tế / Doanh thu dự kiến) * admin_profit
    IF v_expected_revenue > 0 THEN
        NEW.rev_profit := (COALESCE(NEW.actual_revenue, 0) / v_expected_revenue) * NEW.admin_profit;
    ELSE
        NEW.rev_profit := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cập nhật lại toàn bộ dữ liệu hiện tại trong DB theo logic chuẩn
UPDATE contracts 
SET 
    admin_profit = CASE 
        WHEN has_vat IS NOT FALSE AND COALESCE(vat_rate, 0) > 0 THEN 
            COALESCE(value, 0) / (1 + COALESCE(vat_rate, 10)::NUMERIC / 100) - COALESCE(estimated_cost, 0)
        ELSE 
            COALESCE(value, 0) - COALESCE(estimated_cost, 0)
    END,
    rev_profit = CASE 
        WHEN COALESCE(value, 0) > 0 THEN 
            CASE 
                WHEN has_vat IS NOT FALSE AND COALESCE(vat_rate, 0) > 0 THEN 
                    (COALESCE(actual_revenue, 0) / (COALESCE(value, 0) / (1 + COALESCE(vat_rate, 10)::NUMERIC / 100))) * 
                    (COALESCE(value, 0) / (1 + COALESCE(vat_rate, 10)::NUMERIC / 100) - COALESCE(estimated_cost, 0))
                ELSE 
                    (COALESCE(actual_revenue, 0) / COALESCE(value, 1)) * (COALESCE(value, 0) - COALESCE(estimated_cost, 0))
            END
        ELSE 
            0 
    END;
