import { dataClient } from './d:/CIC ERP/lib/dataClient.js';

async function check() {
  const { data, error } = await dataClient
    .from('contracts')
    .select('id, title, value, has_vat, vat_rate, estimated_cost, admin_profit, rev_profit, details')
    .ilike('title', '%HĐ_001/CSS_CIC_2026%')
    .limit(1);
    
  console.log(JSON.stringify(data, null, 2));
}

check();
