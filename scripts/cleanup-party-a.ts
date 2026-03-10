/**
 * Cleanup dirty party_a values in contracts table.
 * 
 * Some contracts have party_a stored with the customer short_name appended,
 * e.g. "Viện khoa học công nghệ xây dựng (IBST)" instead of just
 * "Viện khoa học công nghệ xây dựng".
 * 
 * This script:
 * 1. Fetches all customers with a short_name
 * 2. Fetches all contracts with a customer_id
 * 3. For each contract, checks if party_a contains the short_name in parentheses
 * 4. If so, removes it and updates the record
 * 
 * Run: npx tsx scripts/cleanup-party-a.ts
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

async function main() {
    console.log('🧹 Cleaning up dirty party_a values...\n');

    // Step 1: Fetch all customers with short_name
    console.log('📋 Fetching customers with short names...');
    const shortNameMap = new Map<string, string>(); // customerId → shortName
    const customerNameMap = new Map<string, string>(); // customerId → clean name
    let from = 0;
    const batchSize = 1000;
    while (true) {
        const { data: customers, error } = await supabase
            .from('customers')
            .select('id, name, short_name')
            .not('short_name', 'is', null)
            .neq('short_name', '')
            .range(from, from + batchSize - 1);
        if (error) {
            console.error('❌ Failed to fetch customers:', error.message);
            process.exit(1);
        }
        if (!customers || customers.length === 0) break;
        customers.forEach((c: any) => {
            if (c.short_name) {
                shortNameMap.set(c.id, c.short_name);
                customerNameMap.set(c.id, c.name);
            }
        });
        if (customers.length < batchSize) break;
        from += batchSize;
    }
    console.log(`   Found ${shortNameMap.size} customers with short names.\n`);

    // Step 2: Fetch all contracts with customer_id
    console.log('📋 Fetching contracts...');
    const { data: contracts, error: cError } = await supabase
        .from('contracts')
        .select('id, party_a, customer_id');

    if (cError) {
        console.error('❌ Failed to fetch contracts:', cError.message);
        process.exit(1);
    }
    console.log(`   Found ${contracts!.length} contracts.\n`);

    // Step 3: Find and fix dirty party_a
    let fixed = 0;
    let errors = 0;

    for (const contract of contracts!) {
        if (!contract.customer_id || !contract.party_a) continue;

        const shortName = shortNameMap.get(contract.customer_id);
        if (!shortName) continue;

        const partyA: string = contract.party_a;

        // Check various patterns where short_name might be embedded
        // Pattern 1: "Name (SHORT)" — with parentheses
        // Pattern 2: "Name (SHORT) " — with trailing space
        const patterns = [
            ` (${shortName})`,    // space + (SHORT)
            `(${shortName})`,     // (SHORT) without leading space
            ` - ${shortName}`,    // space-dash-space + SHORT
        ];

        let cleanedName = partyA;
        let wasChanged = false;

        for (const pattern of patterns) {
            if (cleanedName.includes(pattern)) {
                cleanedName = cleanedName.replace(pattern, '').trim();
                wasChanged = true;
            }
        }

        if (!wasChanged) continue;

        // Also verify the clean name matches the customer record
        const customerCleanName = customerNameMap.get(contract.customer_id);
        if (customerCleanName && cleanedName !== customerCleanName) {
            // If after removing short name the result doesn't match customer name,
            // use the customer's actual name instead
            console.log(`  ⚠️  ${contract.id}: "${partyA}" → using customer name "${customerCleanName}"`);
            cleanedName = customerCleanName;
        }

        // Update
        const { error: updateError } = await supabase
            .from('contracts')
            .update({ party_a: cleanedName })
            .eq('id', contract.id);

        if (updateError) {
            console.error(`  ❌ ${contract.id}: ${updateError.message}`);
            errors++;
        } else {
            console.log(`  ✅ ${contract.id}: "${partyA}" → "${cleanedName}"`);
            fixed++;
        }
    }

    console.log(`\n🧹 Done! Fixed: ${fixed}, Errors: ${errors}`);
    if (fixed === 0) {
        console.log('   No dirty party_a values found — database is clean! 🎉');
    }
}

main().catch(console.error);
