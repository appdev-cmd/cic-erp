import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase.from('employees').select('id, name, department, unit_id, units!inner(name)').limit(5);
  console.log("Joined items:", data?.length);
  if(error) console.error(error);
}
run();
