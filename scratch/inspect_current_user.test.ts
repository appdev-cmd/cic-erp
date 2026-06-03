import { test } from 'vitest';
import { supabase } from '../lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

// Đọc file .env.local thủ công và gán vào process.env
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
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
    process.env[key] = val.trim();
  }
});

test('inspect current user', async () => {
  const email = process.env.VITE_DEV_EMAIL || 'appdev@cic.com.vn';
  const password = process.env.VITE_DEV_PASSWORD || 'Abc123456';
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error("Sign in failed:", authError);
    return;
  }
  
  console.log("Logged in user:", authData.user?.email);
  console.log("User ID:", authData.user?.id);
  
  // Query profile
  const { data: profile, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user?.id)
    .single();
    
  if (pError) {
    console.error("Error fetching profile:", pError);
  } else {
    console.log("Profile data:", profile);
  }
});
