import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { getDashboardKpiTool } from '../services/ai/openclaw/tools/dashboard.tools.js';

// Tự parse file .env.local
const env = {};
const parseEnvFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }
};
parseEnvFile('.env.local');

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = env['VITE_DEV_EMAIL'] || 'appdev@cic.com.vn';
  const password = env['VITE_DEV_PASSWORD'] || 'Abc123456';
  await supabase.auth.signInWithPassword({ email, password });
  
  // Gọi tool execute
  const context = {
    userId: '4fda6e7a-a8f7-4efd-a8cd-021a3e7e67c5',
    employeeId: null,
    fullName: 'Dev Admin',
    role: 'Admin',
  };

  const res = await getDashboardKpiTool.execute({ year: '2026' }, context);
  console.log("=========================================");
  console.log("KẾT QUẢ get_dashboard_kpi SAU KHI FIX:");
  console.log(JSON.stringify(res, null, 2));
  console.log("=========================================");
}

run();
