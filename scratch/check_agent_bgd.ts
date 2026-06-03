import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Đọc file .env.local thủ công
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const matched = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (matched) {
    const key = matched[1];
    let val = matched[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL!, env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  console.log("=== KIỂM TRA AGENT CONFIGS TRONG DB ===");
  const { data: agents, error: agentError } = await supabase
    .from('agent_configs')
    .select('*');

  if (agentError) {
    console.error("Lỗi truy vấn agent_configs:", agentError);
  } else {
    console.log(`Tìm thấy ${agents?.length} agents:`);
    agents?.forEach(agent => {
      console.log(`- ID: ${agent.id}, Name: ${agent.name}, Active: ${agent.is_active}`);
      console.log(`  Allowed Tools:`, agent.allowed_tools);
      console.log(`  Allowed Roles:`, agent.allowed_roles);
    });
  }

  console.log("\n=== KIỂM TRA AGENT TOOL CONFIGS TRONG DB ===");
  const { data: tools, error: toolError } = await supabase
    .from('agent_tool_configs')
    .select('*');

  if (toolError) {
    console.error("Lỗi truy vấn agent_tool_configs:", toolError);
  } else {
    console.log(`Tìm thấy ${tools?.length} tool configs:`);
    tools?.forEach(tool => {
      console.log(`- Name: ${tool.tool_name}, Active: ${tool.is_active}, Description: ${tool.custom_description}`);
    });
  }
}

run();
