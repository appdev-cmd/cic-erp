import { config } from './config.js';
import { fetchContractsReport } from './supabaseClient.js';
async function test() {
  const adminId = "06ad1f83-d922-4a00-ab62-f703e7c8d9ab";
  const rows = await fetchContractsReport(adminId, '2026-04-01', '2026-04-30', 500);
  console.log("With dates:", rows.length);
  const rowsAll = await fetchContractsReport(adminId, null, null, 500);
  console.log("All:", rowsAll.length);
}
test().catch(console.error);
