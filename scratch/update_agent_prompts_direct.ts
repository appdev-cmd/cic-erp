import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { agentDefinitions } from '../services/ai/openclaw/agents/definitions';

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
const email = process.env.VITE_DEV_EMAIL || 'appdev@cic.com.vn';
const password = process.env.VITE_DEV_PASSWORD || 'Abc123456';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("=== ĐĂNG NHẬP ADMIN ĐỂ CẬP NHẬT SYSTEM PROMPTS ===");
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
        console.error("❌ Đăng nhập thất bại:", authError.message);
        process.exit(1);
    }
    
    console.log(`✅ Đăng nhập thành công với tài khoản: ${email}`);
    
    // Update agent-bgd
    const bgdPrompt = agentDefinitions.BGD.systemPrompt;
    console.log("Updating agent-bgd...");
    const { data: bgdData, error: bgdError } = await supabase
        .from('agent_configs')
        .update({ system_prompt: bgdPrompt, updated_at: new Date().toISOString() })
        .eq('id', 'agent-bgd')
        .select();
        
    if (bgdError) {
        console.error("❌ Lỗi update agent-bgd:", bgdError);
    } else {
        console.log("✅ Update agent-bgd thành công!");
    }

    // Update agent-unit-leader
    const ulPrompt = agentDefinitions.UNIT_LEADER.systemPrompt;
    console.log("Updating agent-unit-leader...");
    const { data: ulData, error: ulError } = await supabase
        .from('agent_configs')
        .update({ system_prompt: ulPrompt, updated_at: new Date().toISOString() })
        .eq('id', 'agent-unit-leader')
        .select();
        
    if (ulError) {
        console.error("❌ Lỗi update agent-unit-leader:", ulError);
    } else {
        console.log("✅ Update agent-unit-leader thành công!");
    }
}

main().catch(console.error);
