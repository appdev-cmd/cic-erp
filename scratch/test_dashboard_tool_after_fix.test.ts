import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getDashboardKpiTool } from '../services/ai/openclaw/tools/dashboard.tools';
import { dataClient, syncAuthSession } from '../lib/dataClient';

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

describe('Test Dashboard Tool after fix', () => {
  it('run execute with auth and sync session', async () => {
    const email = env['VITE_DEV_EMAIL'] || 'appdev@cic.com.vn';
    const password = env['VITE_DEV_PASSWORD'] || 'Abc123456';
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      console.error(authError);
      return;
    }

    if (authData.session) {
      console.log("Syncing auth session to dataClient...");
      await syncAuthSession(authData.session);
    }
    
    // Gọi tool execute
    const context = {
      userId: '4fda6e7a-a8f7-4efd-a8cd-021a3e7e67c5',
      employeeId: null,
      fullName: 'Dev Admin',
      role: 'Admin',
    };

    const res = await getDashboardKpiTool.execute({ year: '2026' }, context);
    console.log("=========================================");
    console.log("KẾT QUẢ get_dashboard_kpi SAU KHI FIX & SYNC:");
    console.log(JSON.stringify(res, null, 2));
    console.log("=========================================");
    
    expect(res).toBeDefined();
  }, 35000);
});
