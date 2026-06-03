import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read local env
const envPath = path.resolve(process.cwd(), '.env.local');
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
    console.log("=== XÁC MINH CẤU HÌNH PROMPT TRÊN DB ===");
    
    // Check agent-bgd
    const { data: bgdAgent, error: bgdError } = await supabase
        .from('agent_configs')
        .select('id, name, system_prompt')
        .eq('id', 'agent-bgd')
        .single();
        
    if (bgdError || !bgdAgent) {
        console.error("❌ Lỗi load agent-bgd:", bgdError);
    } else {
        console.log(`\n🤖 Agent: ${bgdAgent.name} (${bgdAgent.id})`);
        const dictionaryIndex = bgdAgent.system_prompt.indexOf("📚 TỪ ĐIỂN THUẬT NGỮ KINH DOANH");
        if (dictionaryIndex !== -1) {
            const dictionaryBlock = bgdAgent.system_prompt.substring(dictionaryIndex, dictionaryIndex + 600);
            console.log("Đoạn từ điển thuật ngữ trên DB:");
            console.log("-----------------------------------------");
            console.log(dictionaryBlock);
            console.log("-----------------------------------------");
        } else {
            console.log("❌ Không tìm thấy Từ điển thuật ngữ trong system_prompt!");
        }
    }

    // Check agent-unit-leader
    const { data: ulAgent, error: ulError } = await supabase
        .from('agent_configs')
        .select('id, name, system_prompt')
        .eq('id', 'agent-unit-leader')
        .single();
        
    if (ulError || !ulAgent) {
        console.error("❌ Lỗi load agent-unit-leader:", ulError);
    } else {
        console.log(`\n🤖 Agent: ${ulAgent.name} (${ulAgent.id})`);
        const dictionaryIndex = ulAgent.system_prompt.indexOf("📚 TỪ ĐIỂN THUẬT NGỮ KINH DOANH");
        if (dictionaryIndex !== -1) {
            const dictionaryBlock = ulAgent.system_prompt.substring(dictionaryIndex, dictionaryIndex + 600);
            console.log("Đoạn từ điển thuật ngữ trên DB:");
            console.log("-----------------------------------------");
            console.log(dictionaryBlock);
            console.log("-----------------------------------------");
        } else {
            console.log("❌ Không tìm thấy Từ điển thuật ngữ trong system_prompt!");
        }
    }
}

main().catch(console.error);
