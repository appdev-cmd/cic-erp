import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    console.log("Fetching latest AI logs from Supabase...");
    const { data, error } = await supabase
        .from('ai_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error("Error fetching logs:", error);
    } else {
        console.log(`Success! Found ${data.length} logs.`);
        data.forEach((log, index) => {
            console.log(`\n--- [LOG ${index + 1}] ---`);
            console.log(`Time: ${log.created_at}`);
            console.log(`Model: ${log.model_id}`);
            console.log(`Action: ${log.action_type}`);
            console.log(`Success: ${log.success}`);
            console.log(`Latency: ${log.latency_ms}ms`);
            console.log(`Input Preview: ${log.input_preview}`);
            console.log(`Output Preview: ${log.output_preview}`);
            console.log(`Error Message: ${log.error_message}`);
        });
    }
}

checkLogs();
