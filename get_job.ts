import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('job_openings').select('id, title, status').limit(1).eq('status', 'open');
  console.log(JSON.stringify(data));
}
run();
