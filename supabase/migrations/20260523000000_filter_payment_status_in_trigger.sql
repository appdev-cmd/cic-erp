-- FIX Bug #3: Trigger update_contract_financials không filter status khi tính
-- invoiced_amount và actual_revenue → không khớp với mapContract (filter status).
--
-- Trước fix:
--   invoiced_amount, actual_revenue tính từ ALL VAT_INVOICE (kể cả status draft/null)
--
-- Sau fix:
--   Chỉ tính VAT_INVOICE có status IN ('Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid')
--   → Đồng nhất với services/contract/contractFinancials.ts:calculateInvoicedFromPayments()

CREATE OR REPLACE FUNCTION update_contract_financials()
RETURNS TRIGGER AS $$
DECLARE
    target_contract_id TEXT;
    v_invoiced_amount NUMERIC(15, 2);
    v_cash_received NUMERIC(15, 2);
    v_actual_cost NUMERIC(15, 2);
    v_actual_revenue NUMERIC(15, 2);
    v_receivables NUMERIC(15, 2);
    v_contract_vat_rate NUMERIC;
    v_contract_has_vat BOOLEAN;
BEGIN
    -- Determine which contract to recalculate
    IF (TG_OP = 'DELETE') THEN
        target_contract_id := OLD.contract_id;
    ELSE
        target_contract_id := NEW.contract_id;
    END IF;

    -- Skip if no contract_id
    IF target_contract_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Get contract VAT info for revenue calculation
    SELECT COALESCE(vat_rate, 10), COALESCE(has_vat, true)
    INTO v_contract_vat_rate, v_contract_has_vat
    FROM contracts WHERE id = target_contract_id;

    -- 1. Invoiced Amount = SUM(amount) from VAT_INVOICE payments
    -- ★ FIX: Filter status như mapContract làm
    SELECT COALESCE(SUM(amount), 0)
    INTO v_invoiced_amount
    FROM payments
    WHERE contract_id = target_contract_id
    AND voucher_type = 'VAT_INVOICE'
    AND status IN ('Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid');

    -- 2. Cash Received = SUM(amount) from RECEIPT with status 'Tạm ứng', 'Tiền về', 'Paid'
    SELECT COALESCE(SUM(amount), 0)
    INTO v_cash_received
    FROM payments
    WHERE contract_id = target_contract_id
    AND voucher_type = 'RECEIPT'
    AND status IN ('Tạm ứng', 'Tiền về', 'Paid');

    -- 3. Actual Cost = SUM(amount) from EXPENSE with status 'Đã chi'
    SELECT COALESCE(SUM(amount), 0)
    INTO v_actual_cost
    FROM payments
    WHERE contract_id = target_contract_id
    AND voucher_type = 'EXPENSE'
    AND status = 'Đã chi';

    -- 4. Actual Revenue (pre-VAT from VAT invoices)
    -- ★ FIX: Filter status như mapContract làm
    SELECT COALESCE(SUM(
        CASE
            -- If vat_invoice_items has data, sum amountBeforeVAT from items
            WHEN vat_invoice_items IS NOT NULL AND jsonb_array_length(vat_invoice_items) > 0 THEN
                (SELECT COALESCE(SUM((item->>'amountBeforeVAT')::numeric), 0)
                 FROM jsonb_array_elements(vat_invoice_items) AS item)
            -- Otherwise calculate pre-VAT from gross amount
            WHEN v_contract_has_vat AND v_contract_vat_rate > 0 THEN
                amount / (1 + v_contract_vat_rate / 100)
            ELSE
                amount
        END
    ), 0)
    INTO v_actual_revenue
    FROM payments
    WHERE contract_id = target_contract_id
    AND voucher_type = 'VAT_INVOICE'
    AND status IN ('Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid');

    -- 5. Receivables = invoiced - cash received
    v_receivables := v_invoiced_amount - v_cash_received;

    -- Update all payment-derived columns on the contract
    UPDATE contracts
    SET
        invoiced_amount = v_invoiced_amount,
        cash_received = v_cash_received,
        actual_cost = v_actual_cost,
        actual_revenue = v_actual_revenue,
        receivables = v_receivables
    WHERE id = target_contract_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Recreate trigger (in case it was dropped)
DROP TRIGGER IF EXISTS trigger_update_contract_financials ON payments;
CREATE TRIGGER trigger_update_contract_financials
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_contract_financials();

-- ★ BACKFILL: Force re-trigger để recalculate cho tất cả contracts có payments
-- Cách đơn giản nhất: UPDATE 1 trường no-op trên payments để fire trigger.
-- Nhưng để an toàn hơn, ta tính trực tiếp bằng SQL.

-- Recalculate invoiced_amount cho tất cả HĐ
UPDATE contracts c
SET invoiced_amount = COALESCE((
    SELECT SUM(amount)
    FROM payments p
    WHERE p.contract_id = c.id
    AND p.voucher_type = 'VAT_INVOICE'
    AND p.status IN ('Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid')
), 0);

-- Recalculate actual_revenue cho tất cả HĐ
UPDATE contracts c
SET actual_revenue = COALESCE((
    SELECT SUM(
        CASE
            WHEN p.vat_invoice_items IS NOT NULL AND jsonb_array_length(p.vat_invoice_items) > 0 THEN
                (SELECT COALESCE(SUM((item->>'amountBeforeVAT')::numeric), 0)
                 FROM jsonb_array_elements(p.vat_invoice_items) AS item)
            WHEN COALESCE(c.has_vat, true) AND COALESCE(c.vat_rate, 10) > 0 THEN
                p.amount / (1 + COALESCE(c.vat_rate, 10) / 100)
            ELSE
                p.amount
        END
    )
    FROM payments p
    WHERE p.contract_id = c.id
    AND p.voucher_type = 'VAT_INVOICE'
    AND p.status IN ('Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid')
), 0);

-- Recalculate receivables = invoiced - cash received
UPDATE contracts
SET receivables = COALESCE(invoiced_amount, 0) - COALESCE(cash_received, 0);
