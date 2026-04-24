import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log("Checking ai_logs table...");
    const { data, error } = await supabase.from('ai_logs').select('*').limit(1);
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Success! Data:", data);
        if (data.length > 0) {
           console.log("Keys:", Object.keys(data[0]));
        }
    }
}

checkTable();
