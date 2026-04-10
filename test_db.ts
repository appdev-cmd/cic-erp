import { ContractService } from './services/contractService';

async function run() {
  try {
    const res = await ContractService.list({ page: 1, limit: 1 });
    console.log("Total contracts:", res.count);
    if(res.data.length > 0) {
      console.log("First contract date:", res.data[0].signedDate);
    }
  } catch(e) {
    console.error(e);
  }
}
run();
