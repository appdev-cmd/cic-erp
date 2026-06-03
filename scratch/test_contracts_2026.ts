import fs from 'fs';
import path from 'path';

// 1. Load env từ .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim().replace(/['"]/g, '');
        process.env[key] = val;
      }
    }
  });
}

// 2. Mock browser globals
global.window = {
  location: {
    hostname: 'localhost',
    origin: 'http://localhost:3000'
  }
} as any;

// Mock import.meta.env
// @ts-ignore
if (typeof import.meta === 'undefined') {
  // @ts-ignore
  global.import = { meta: { env: process.env } };
} else {
  // @ts-ignore
  import.meta.env = process.env;
}

// 3. Import các module
import { runReActLoop } from '../services/ai/openclaw/react-loop';
import { agentDefinitions } from '../services/ai/openclaw/agents/definitions';
import { searchContractsTool, getContractStatsTool } from '../services/ai/openclaw/tools/contract.tools';

async function test() {
  console.log("=== BẮT ĐẦU CHẠY THỬ REACT LOOP VỚI CÂU HỎI ENJICAD 2026 ===");
  
  const userContext = {
    userId: 'test-user-id',
    fullName: 'Lê Văn Test',
    role: 'Leadership',
    unitId: 'BGD',
    unitName: 'Ban Giám Đốc'
  };

  const agentConfig = agentDefinitions.BGD;
  // Load cả tool search và stats để AI tùy chọn
  const availableTools = [searchContractsTool, getContractStatsTool];

  try {
    const result = await runReActLoop(
      "liệt kê các hợp đồng bán enjiCAD năm 2026, có phân rõ đơn vị bán nhé",
      userContext,
      agentConfig,
      availableTools,
      [], // history
      8,  // maxSteps
      undefined, // signal
      (toolName, args) => {
        console.log(`\n[CALLBACK] Đang gọi tool: ${toolName} với args:`, JSON.stringify(args));
      },
      'qwen3.5-35b', // modelId
      (chunk) => {
        process.stdout.write(chunk);
      }
    );

    console.log("\n\n=== KẾT QUẢ CUỐI CÙNG ===");
    console.log("Reply:", result.reply);
    console.log("Steps:", result.steps);
    console.log("Used Tools:", result.usedTools);
    console.log("Active Model:", result.activeModel);

  } catch (err: any) {
    console.error("LỖI KHI CHẠY REACT LOOP:", err);
  }
}

test();
