import { ContractService } from '../services/contractService';
import { supabase } from '../lib/supabase';
import { syncAuthSession } from '../lib/dataClient';

async function run() {
  console.log("--- Login first to simulate user session ---");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'appdev@cic.com.vn',
    password: 'Abc123456'
  });

  if (authError) {
    console.error("Auth failed:", authError.message);
    return;
  }
  console.log("Auth success, user ID:", authData.user?.id);
  
  // Sync the session to dataClient
  await syncAuthSession(authData.session);

  console.log("\n--- Testing getStatsRPC for 'bim' unit and year '2025' ---");
  try {
    const stats = await ContractService.getStatsRPC('bim', '2025');
    console.log("Stats result:", JSON.stringify(stats, null, 2));
  } catch (e: any) {
    console.error("Exception in getStatsRPC:", e.message, e.stack);
  }

  console.log("\n--- Testing direct query to contracts to see what is returned ---");
  try {
    const { data, error } = await ContractService.getByUnitId('bim');
    console.log(`getByUnitId retrieved ${data?.length || 0} contracts.`);
  } catch (e: any) {
    console.error("Exception in getByUnitId:", e.message);
  }
}

run();
