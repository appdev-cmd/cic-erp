/**
 * Batch Recalculate Legacy Transfer Fees for All Contracts
 * 
 * This script scans all contracts in Supabase, parses the directCostDetails within lineItems,
 * and updates any auto domestic/international transfer fees using the new proportional calculation logic:
 * - Domestic: Max(SupplierTotalValue * 0.07%, 22000) * (ItemValue / SupplierTotalValue)
 * - International: (ItemValue * 0.5%) + (10 * USD_Rate * (ItemValue / SupplierTotalValue))
 * 
 * It also recalculates financial summary fields (estimated_cost, admin_profit, rev_profit)
 * to ensure that all financial aggregate metrics remain perfectly consistent.
 * 
 * Run: npx tsx scripts/recalculate-legacy-transfer-fees.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual env loading
const loadEnv = (filePath: string) => {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return;
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = val;
    });
};

loadEnv(path.resolve(process.cwd(), '.env'));
loadEnv(path.resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or Supabase keys in env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Calculation helpers mirroring recalculate-financials.ts
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

async function main() {
    console.log('🔄 Starting batch recalculation of legacy transfer fees for all contracts...\n');

    // Fetch all contracts with details and payments to recalculate summaries
    const { data: contracts, error } = await supabase
        .from('contracts')
        .select('id, contract_code, value, expected_revenue, estimated_cost, actual_revenue, actual_cost, invoiced_amount, status, vat_rate, has_vat, details, payments(amount, paid_amount, status, payment_type, voucher_type, vat_invoice_items)');

    if (error) {
        console.error('❌ Failed to fetch contracts:', error.message);
        process.exit(1);
    }

    console.log(`📋 Found ${contracts.length} contracts to inspect.\n`);

    let updatedContractsCount = 0;
    let errorsCount = 0;

    for (const c of contracts) {
        try {
            const payments: any[] = c.payments || [];
            const details = c.details || {};
            const lineItems: any[] = details.lineItems || [];
            const executionCosts: any[] = details.executionCosts || [];

            if (!lineItems || lineItems.length === 0) {
                continue;
            }

            // Group line items by supplier to calculate supplierTotalValue
            const supplierTotals: Record<string, number> = {};
            lineItems.forEach((li: any) => {
                const s = li.supplier || '';
                const qty = Number(li.quantity) || 1;
                const price = Number(li.inputPrice) || 0;
                supplierTotals[s] = (supplierTotals[s] || 0) + (qty * price);
            });

            let isContractDetailsUpdated = false;

            const updatedLineItems = lineItems.map((li: any) => {
                const s = li.supplier || '';
                const itemValue = (Number(li.quantity) || 1) * (Number(li.inputPrice) || 0);
                const supplierTotalValue = supplierTotals[s] || itemValue || 1;

                const costDetails: any[] = li.directCostDetails || [];
                if (!costDetails || costDetails.length === 0) return li;

                let isItemCostsUpdated = false;

                const updatedCostDetails = costDetails.map((d: any) => {
                    const nameLower = (d.name || '').toLowerCase();
                    // Detect if this is an auto domestic transfer fee
                    const isDomestic = d.id === '__auto_transfer_fee__' && nameLower.includes('trong nước') ||
                        (nameLower.includes('phí chuyển tiền') && nameLower.includes('trong nước'));
                    
                    // Detect if this is an auto international transfer fee
                    const isInternational = d.id === '__auto_transfer_fee__' && nameLower.includes('nước ngoài') ||
                        (nameLower.includes('phí chuyển tiền') && nameLower.includes('nước ngoài'));

                    if (isDomestic) {
                        // Proportional domestic formula: Max(supplierTotalValue * 0.07%, 22000) * (itemValue / supplierTotalValue)
                        const totalSupplierFee = Math.max(Math.round(supplierTotalValue * 0.0007), 22000);
                        const fee = Math.round(totalSupplierFee * (itemValue / supplierTotalValue));
                        const formula = supplierTotalValue > itemValue
                            ? `Max(${supplierTotalValue}*0.07%,22k)*(${itemValue}/${supplierTotalValue})`
                            : `Max(${itemValue}*0.07%,22k)`;

                        if (d.amount !== fee || d.formula !== formula) {
                            isItemCostsUpdated = true;
                            return { ...d, amount: fee, formula };
                        }
                    } else if (isInternational) {
                        // Extract USD rate from the old formula if possible, otherwise fallback to 25,400
                        let rate = 25400;
                        if (d.formula) {
                            // Extract e.g. "10*25400" or similar
                            const match = d.formula.match(/10\*(\d+)/);
                            if (match && match[1]) {
                                rate = Number(match[1]);
                            }
                        }

                        // Proportional international formula: (itemValue * 0.5%) + (10 * USD_Rate * (itemValue / supplierTotalValue))
                        const fee = Math.round(itemValue * 0.005 + 10 * rate * (itemValue / supplierTotalValue));
                        const formula = supplierTotalValue > itemValue
                            ? `${itemValue}*0.5%+10*${rate}*(${itemValue}/${supplierTotalValue})`
                            : `${itemValue}*0.5%+10*${rate}`;

                        if (d.amount !== fee || d.formula !== formula) {
                            isItemCostsUpdated = true;
                            return { ...d, amount: fee, formula };
                        }
                    }

                    return d;
                });

                if (isItemCostsUpdated) {
                    isContractDetailsUpdated = true;
                    const totalDirectCosts = updatedCostDetails.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
                    return {
                        ...li,
                        directCostDetails: updatedCostDetails,
                        directCosts: totalDirectCosts
                    };
                }

                return li;
            });

            if (isContractDetailsUpdated) {
                // Update details object
                const updatedDetails = {
                    ...details,
                    lineItems: updatedLineItems
                };

                // Recalculate contract financial fields to keep summaries in sync
                const contractVatRate = c.vat_rate ?? 10;
                const hasVat = c.has_vat !== false;
                
                // === 1. Contract value ===
                const newValue = updatedLineItems.reduce((sum: number, li: any) => {
                    const price = Number(li.outputPrice) || 0;
                    const qty = Number(li.quantity) || 1;
                    const vat = hasVat ? (Number(li.vatRate ?? contractVatRate) || 0) : 0;
                    return sum + price * qty * (1 + vat / 100);
                }, 0);

                // === 2. Expected revenue ===
                const expectedRevenue = updatedLineItems.reduce((sum: number, li: any) => {
                    return sum + (Number(li.outputPrice) || 0) * (Number(li.quantity) || 1);
                }, 0);

                // === 3. Estimated cost ===
                const totalInputCost = updatedLineItems.reduce((sum: number, li: any) => {
                    const directVal = (li.directCosts as number) || 0;
                    const effectiveDirectCosts = directVal > 0
                        ? directVal
                        : ((li.directCostDetails as any[]) || []).reduce((s: number, d: any) => s + (d.amount || 0), 0);
                    return sum + (Number(li.inputPrice) || 0) * (Number(li.quantity) || 1) + effectiveDirectCosts;
                }, 0);
                const totalExecutionCosts = executionCosts.reduce((sum: number, ec: any) => sum + (Number(ec.amount) || 0), 0);
                const newEstimatedCost = totalInputCost + totalExecutionCosts;

                // === 4. Admin Profit ===
                const adminProfit = expectedRevenue - newEstimatedCost;

                // === 5. Actual Revenue ===
                const actualRevenue = calculateRevenueFromPayments(payments, contractVatRate, hasVat, Number(c.actual_revenue) || 0);

                // === 6. Rev Profit ===
                const revenueRatio = expectedRevenue > 0 ? (actualRevenue / expectedRevenue) : 0;
                const revProfit = actualRevenue - (newEstimatedCost * revenueRatio);

                // === 7. Invoiced, Actual Cost, Receivables, Payables (mirror recalculate-financials.ts) ===
                const invoicedAmount = Number(c.invoiced_amount) || 0;
                const actualCost = Number(c.actual_cost) || 0;
                const cashReceived = payments
                    .filter((p: any) => p.voucher_type === 'RECEIPT' && ['Tạm ứng', 'Tiền về', 'Paid'].includes(p.status))
                    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
                const receivables = invoicedAmount - cashReceived;
                const payables = totalInputCost - actualCost;

                const updateData: any = {
                    details: updatedDetails,
                    value: Math.round(newValue),
                    expected_revenue: Math.round(expectedRevenue),
                    estimated_cost: Math.round(newEstimatedCost),
                    admin_profit: Math.round(adminProfit),
                    rev_profit: Math.round(revProfit),
                    receivables: Math.round(receivables),
                    payables: Math.round(payables),
                };

                const { error: updateError } = await supabase
                    .from('contracts')
                    .update(updateData)
                    .eq('id', c.id);

                if (updateError) {
                    console.error(`  ❌ Failed to update contract ${c.contract_code || c.id}: ${updateError.message}`);
                    errorsCount++;
                } else {
                    console.log(`  ✅ Recalculated & updated contract: ${c.contract_code || c.id}`);
                    updatedContractsCount++;
                }
            } else {
                console.log(`  ✓ Contract ${c.contract_code || c.id} already uses correct transfer fee calculations.`);
            }
        } catch (e: any) {
            console.error(`  ❌ Error processing contract ${c.id}: ${e.message}`);
            errorsCount++;
        }
    }

    console.log(`\n🎉 Recalculation Batch Job Done!`);
    console.log(`   - Total contracts updated: ${updatedContractsCount}`);
    console.log(`   - Total errors encountered: ${errorsCount}`);
}

main().catch(console.error);
