// Run migration script for company_targets table
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jyohocjsnsyfgfsmjfqx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b2hvY2pzbnN5Zmdmc21qZnF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQxMTE4MywiZXhwIjoyMDg0OTg3MTgzfQ.7r3xY99EiPXiIFh6K7ctR8Xw05NJT0pwJVn0cQrPxyU'
);

async function runMigration() {
  // Test if table already exists by trying to select from it
  const { data, error } = await supabase.from('company_targets').select('id').limit(1);
  
  if (!error) {
    console.log('Table company_targets already exists. Migration not needed.');
    return;
  }

  // If table doesn't exist, we need to create it via SQL
  // Since we can't run raw SQL via REST API, we'll use the dashboard
  console.log('Table company_targets does NOT exist yet.');
  console.log('Please run the migration SQL in Supabase Dashboard SQL Editor:');
  console.log('URL: https://supabase.com/dashboard/project/jyohocjsnsyfgfsmjfqx/sql/new');
  console.log('SQL file: supabase/migrations/20260510_company_targets.sql');
}

runMigration();
