/**
 * Batch Recalculate All Contract Financial Fields
 * 
 * This script recalculates:
 * - value (Giá trị HĐ): Sum(outputPrice * quantity * (1 + vatRate/100))
 * - estimated_cost (Chi phí dự kiến): Sum(inputPrice * quantity) + directCosts + executionCosts
 * - actual_revenue (Doanh thu thực tế): Sum pre-VAT from VAT_INVOICE
 * - invoiced_amount (Đã xuất hoá đơn): Sum after-VAT from VAT_INVOICE
 * - actual_cost (Chi phí thực tế): Sum from EXPENSE vouchers
 * - receivables (Công nợ phải thu): invoicedAmount - cashReceived
 * - payables (Công nợ phải trả): totalInputCost - totalExpensesPaid
 * - admin_profit (LNG Quản trị): expectedRevenue - estimatedCost
 * - rev_profit (LNG theo DT): depends on status
 * 
 * Run: npx tsx scripts/recalculate-financials.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env loading (no dotenv dependency)
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
    console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ===== Calculation Helpers =====

function calculateRevenueFromPayments(payments: any[], vatRate: number, hasVat: boolean, fallback: number): number {
    const vatInvoices = payments.filter((p: any) => p.voucher_type === 'VAT_INVOICE');
    if (vatInvoices.length === 0) return fallback;

    let totalPreVat = 0;
    for (const inv of vatInvoices) {
        const items = inv.vat_invoice_items || [];
        if (items.length > 0) {
            totalPreVat += items.reduce((sum: number, item: any) => sum + (Number(item.amountBeforeVAT) || 0), 0);
        } else {
            const grossAmount = Number(inv.amount) || 0;
            if (hasVat && vatRate > 0) {
                totalPreVat += grossAmount / (1 + vatRate / 100);
            } else {
                totalPreVat += grossAmount;
            }
        }
    }
    return totalPreVat;
}

function calculateInvoicedFromPayments(payments: any[]): number {
    return payments
        .filter((p: any) => p.voucher_type === 'VAT_INVOICE')
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
}

function calculateCashReceived(payments: any[]): number {
    return payments
        .filter((p: any) => p.voucher_type === 'RECEIPT' &&
            ['Tạm ứng', 'Tiền về', 'Paid'].includes(p.status))
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
}

function calculateActualCost(payments: any[]): number {
    return payments
        .filter((p: any) => p.voucher_type === 'EXPENSE' && p.status === 'Đã chi')
        .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
}

// ===== Main =====

async function main() {
    console.log('🔄 Starting batch recalculation of ALL contract financial fields...\n');

    // Fetch all contracts with payments and details
    const { data: contracts, error } = await supabase
        .from('contracts')
        .select('id, value, estimated_cost, actual_revenue, actual_cost, invoiced_amount, status, vat_rate, has_vat, details, payments(amount, paid_amount, status, payment_type, voucher_type, vat_invoice_items)');

    if (error) {
        console.error('❌ Failed to fetch contracts:', error.message);
        process.exit(1);
    }

    console.log(`📋 Found ${contracts.length} contracts to process.\n`);

    let updated = 0;
    let errors = 0;

    for (const c of contracts) {
        try {
            const payments: any[] = c.payments || [];
            const lineItems: any[] = c.details?.lineItems || [];
            const directCosts: any[] = c.details?.directCosts || [];
            const executionCosts: any[] = c.details?.executionCosts || [];

            // === 1. Giá trị hợp đồng (Ký kết) ===
            // Sum(outputPrice * quantity * (1 + vatRate/100))
            const contractVatRate = c.vat_rate ?? 10;
            const hasVat = c.has_vat !== false;
            const newValue = lineItems.reduce((sum: number, li: any) => {
                const price = Number(li.outputPrice) || 0;
                const qty = Number(li.quantity) || 1;
                const vat = hasVat ? (Number(li.vatRate ?? contractVatRate) || 0) : 0;
                return sum + price * qty * (1 + vat / 100);
            }, 0);

            // === 2. Doanh thu dự kiến ===
            // Sum(outputPrice * quantity) — pre-VAT
            const expectedRevenue = lineItems.reduce((sum: number, li: any) => {
                return sum + (Number(li.outputPrice) || 0) * (Number(li.quantity) || 1);
            }, 0);

            // === 3. Chi phí dự kiến ===
            // Sum(inputPrice * quantity) + directCosts + executionCosts
            const totalInputCost = lineItems.reduce((sum: number, li: any) => {
                return sum + (Number(li.inputPrice) || 0) * (Number(li.quantity) || 1);
            }, 0);
            const totalDirectCosts = directCosts.reduce((sum: number, dc: any) => sum + (Number(dc.amount) || 0), 0);
            const totalExecutionCosts = executionCosts.reduce((sum: number, ec: any) => sum + (Number(ec.amount) || 0), 0);
            const newEstimatedCost = totalInputCost + totalDirectCosts + totalExecutionCosts;

            // === 4. LNG Quản trị ===
            const adminProfit = expectedRevenue - newEstimatedCost;

            // === 5. Doanh thu thực tế (pre-VAT from VAT_INVOICE) ===
            const actualRevenue = calculateRevenueFromPayments(payments, contractVatRate, hasVat, 0);

            // === 6. Đã xuất hoá đơn (after-VAT from VAT_INVOICE) ===
            const invoicedAmount = calculateInvoicedFromPayments(payments);

            // === 7. Tiền về (from RECEIPT) ===
            const cashReceived = calculateCashReceived(payments);

            // === 8. Chi phí thực tế (from EXPENSE) ===
            const actualCost = calculateActualCost(payments);

            // === 9. Công nợ phải thu ===
            const receivables = invoicedAmount - cashReceived;

            // === 10. Công nợ phải trả ===
            const totalExpensesPaid = actualCost; // total EXPENSE 'Đã chi'
            const payables = totalInputCost - totalExpensesPaid;

            // === 11. LNG theo DT ===
            let revProfit = 0;
            if (c.status === 'Completed') {
                revProfit = actualRevenue - actualCost;
            } else {
                const revenueRatio = expectedRevenue > 0 ? (actualRevenue / expectedRevenue) : 0;
                revProfit = actualRevenue - (newEstimatedCost * revenueRatio);
            }

            // Update DB
            const updateData: any = {
                value: Math.round(newValue),
                estimated_cost: Math.round(newEstimatedCost),
                actual_revenue: Math.round(actualRevenue),
                invoiced_amount: Math.round(invoicedAmount),
                actual_cost: Math.round(actualCost),
                receivables: Math.round(receivables),
                payables: Math.round(payables),
                admin_profit: Math.round(adminProfit),
                rev_profit: Math.round(revProfit),
            };

            const { error: updateError } = await supabase
                .from('contracts')
                .update(updateData)
                .eq('id', c.id);

            if (updateError) {
                console.error(`  ❌ ${c.id}: ${updateError.message}`);
                errors++;
            } else {
                const changed = (
                    Math.round(newValue) !== Math.round(c.value || 0) ||
                    Math.round(newEstimatedCost) !== Math.round(c.estimated_cost || 0) ||
                    Math.round(actualRevenue) !== Math.round(c.actual_revenue || 0)
                );
                if (changed) {
                    console.log(`  ✅ ${c.id}: value=${Math.round(newValue).toLocaleString()}, estCost=${Math.round(newEstimatedCost).toLocaleString()}, actRev=${Math.round(actualRevenue).toLocaleString()}, adminP=${Math.round(adminProfit).toLocaleString()}, revP=${Math.round(revProfit).toLocaleString()}`);
                } else {
                    console.log(`  ✓  ${c.id}: no change`);
                }
                updated++;
            }
        } catch (e: any) {
            console.error(`  ❌ ${c.id}: ${e.message}`);
            errors++;
        }
    }

    console.log(`\n✅ Done! Updated: ${updated}, Errors: ${errors}`);
}

main().catch(console.error);
