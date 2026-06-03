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

// 2. Mock browser globals cần thiết cho gateway.ts
global.window = {
  location: {
    hostname: 'localhost',
    origin: 'http://localhost:3000'
  }
} as any;

// 3. Import các module
import { runReActLoop } from '../services/ai/openclaw/react-loop';
import { agentDefinitions } from '../services/ai/openclaw/agents/definitions';
import { getComprehensiveReportTool } from '../services/ai/openclaw/tools/dashboard.tools';

async function test() {
  console.log("=== BẮT ĐẦU CHẠY THỬ REACT LOOP TRÊN SERVER ===");
  console.log("VITE_LITELLM_KEY:", process.env.VITE_LITELLM_KEY);
  console.log("VITE_VLLM_URL:", process.env.VITE_VLLM_URL);

  const userContext = {
    userId: 'test-user-id',
    fullName: 'Lê Văn Test',
    role: 'ChiefAccountant', // Có quyền chạy report tài chính
    unitId: 'BGD',
    unitName: 'Ban Giám Đốc'
  };

  const agentConfig = agentDefinitions.BGD;
  const availableTools = [getComprehensiveReportTool]; // Chỉ cần tool này cho test case này

  try {
    const result = await runReActLoop(
      "Xuất báo cáo tổng hợp tình hình kinh doanh năm 2026",
      userContext,
      agentConfig,
      availableTools,
      [], // history
      8,  // maxSteps
      undefined, // signal
      (toolName, args) => {
        console.log(`[CALLBACK] Đang gọi tool: ${toolName} với args:`, args);
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
