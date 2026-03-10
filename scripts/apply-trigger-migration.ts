/**
 * Apply the payment trigger migration via Supabase REST API
 * Run: npx tsx scripts/apply-trigger-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env loading
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    process.env[key] = val;
});

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('📦 Applying payment trigger migration...\n');

    // Read the SQL file
    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260310060000_fix_payment_trigger.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Execute via rpc or raw SQL
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
        console.log('⚠️  RPC exec_sql not available, trying statement-by-statement...\n');

        // Split into individual statements and execute one by one
        // Only send the CREATE FUNCTION and trigger statements
        const statements = [
            // Drop trigger first
            `DROP TRIGGER IF EXISTS trigger_update_contract_financials ON payments;`,
            // Create function
            `CREATE OR REPLACE FUNCTION update_contract_financials()
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
    IF (TG_OP = 'DELETE') THEN
        target_contract_id := OLD.contract_id;
    ELSE
        target_contract_id := NEW.contract_id;
    END IF;

    IF target_contract_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(vat_rate, 10), COALESCE(has_vat, true)
    INTO v_contract_vat_rate, v_contract_has_vat
    FROM contracts WHERE id = target_contract_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_invoiced_amount
    FROM payments WHERE contract_id = target_contract_id AND voucher_type = 'VAT_INVOICE';

    SELECT COALESCE(SUM(amount), 0) INTO v_cash_received
    FROM payments WHERE contract_id = target_contract_id AND voucher_type = 'RECEIPT'
    AND status IN ('Tạm ứng', 'Tiền về', 'Paid');

    SELECT COALESCE(SUM(amount), 0) INTO v_actual_cost
    FROM payments WHERE contract_id = target_contract_id AND voucher_type = 'EXPENSE'
    AND status = 'Đã chi';

    SELECT COALESCE(SUM(
        CASE
            WHEN vat_invoice_items IS NOT NULL AND jsonb_array_length(vat_invoice_items) > 0 THEN
                (SELECT COALESCE(SUM((item->>'amountBeforeVAT')::numeric), 0)
                 FROM jsonb_array_elements(vat_invoice_items) AS item)
            WHEN v_contract_has_vat AND v_contract_vat_rate > 0 THEN
                amount / (1 + v_contract_vat_rate / 100)
            ELSE amount
        END
    ), 0) INTO v_actual_revenue
    FROM payments WHERE contract_id = target_contract_id AND voucher_type = 'VAT_INVOICE';

    v_receivables := v_invoiced_amount - v_cash_received;

    UPDATE contracts SET
        invoiced_amount = v_invoiced_amount,
        cash_received = v_cash_received,
        actual_cost = v_actual_cost,
        actual_revenue = v_actual_revenue,
        receivables = v_receivables
    WHERE id = target_contract_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;`,
            // Create trigger
            `CREATE TRIGGER trigger_update_contract_financials
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_contract_financials();`
        ];

        for (let i = 0; i < statements.length; i++) {
            console.log(`  Executing statement ${i + 1}/${statements.length}...`);
            // Use fetch to call the Supabase SQL API directly
            const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                },
                body: JSON.stringify({ query: statements[i] })
            });

            if (!res.ok) {
                const text = await res.text();
                console.log(`  ⚠️  Statement ${i + 1} response: ${res.status} - ${text}`);
            } else {
                console.log(`  ✅ Statement ${i + 1} executed`);
            }
        }

        console.log('\n💡 If exec_sql RPC is not available, apply the migration manually:');
        console.log('   Go to Supabase Dashboard > SQL Editor');
        console.log('   Copy & paste: supabase/migrations/20260310060000_fix_payment_trigger.sql');
        console.log('   Then run: npx tsx scripts/recalculate-financials.ts');
    } else {
        console.log('✅ Migration applied successfully!');
    }
}

main().catch(console.error);
