import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: people } = await supabase.from('employees').select('*');
  const qa = people.find(p => p.name.includes('Quốc Anh'));
  console.log("Quoc Anh ID:", qa?.id);
  
  const { data: contracts } = await supabase.from('contracts').select('id, name, value, actual_revenue, has_vat, vat_rate, payments(amount, voucher_type, status)').eq('employee_id', qa?.id);
  
  let totalRev = 0;
  for (let c of contracts) {
       console.log(c.name, c.value, c.actual_revenue);
       if (c.actual_revenue) totalRev += c.actual_revenue;
  }
  console.log("Total Actual Revenue from DB:", totalRev);
}
main();
