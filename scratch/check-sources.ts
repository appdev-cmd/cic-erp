import '../setup-env.ts';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceKey) {
  console.error('Missing configuration.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  const { data: sources, error } = await supabase
    .from('tech_sources')
    .select('id, name, url, is_active, article_count');
    
  if (error) {
    console.error('Error fetching sources:', error);
    process.exit(1);
  }
  
  console.log('Total sources in DB:', sources?.length);
  sources?.forEach(s => {
    console.log(`- [${s.is_active ? 'ACTIVE' : 'INACTIVE'}] ${s.name}: Count=${s.article_count}`);
    console.log(`  URL: ${s.url}`);
  });
  process.exit(0);
}

main();
