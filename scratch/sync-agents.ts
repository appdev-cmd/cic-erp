import '../setup-env';
import { AgentConfigService } from '../services/ai/agentConfigService';

async function main() {
  console.log('Bắt đầu đồng bộ agents từ definitions vào database...');
  try {
    const res = await AgentConfigService.syncFromDefinitions();
    console.log('Đồng bộ kết quả:', JSON.stringify(res, null, 2));
  } catch (error: any) {
    console.error('Đồng bộ thất bại:', error.message || error);
  }
}

main();
