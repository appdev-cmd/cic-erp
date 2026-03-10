-- Rewrite update_contract_financials trigger to match current business logic
-- This trigger fires AFTER INSERT/UPDATE/DELETE on payments
-- It recalculates ALL payment-derived financial columns on the parent contract

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
    SELECT COALESCE(SUM(amount), 0)
    INTO v_invoiced_amount
    FROM payments
    WHERE contract_id = target_contract_id
    AND voucher_type = 'VAT_INVOICE';

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
    -- Try to use vat_invoice_items JSONB first, fallback to simple calculation
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
    AND voucher_type = 'VAT_INVOICE';

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

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_update_contract_financials ON payments;
CREATE TRIGGER trigger_update_contract_financials
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_contract_financials();
