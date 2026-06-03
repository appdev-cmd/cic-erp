import { test, expect } from 'vitest';
import { runReActLoop } from '../services/ai/openclaw/react-loop';
import { agentDefinitions } from '../services/ai/openclaw/agents/definitions';
import { getComprehensiveReportTool } from '../services/ai/openclaw/tools/dashboard.tools';

test("test react loop with new openai-compatible litellm mapping", async () => {
  console.log("=== BẮT ĐẦU CHẠY THỬ REACT LOOP VỚI CONFIG MỚI ===");
  
  // Tránh DNS cache hoặc port startup delay
  await new Promise(resolve => setTimeout(resolve, 5000));

  process.env.LOCAL_AI_BASE_URL = 'http://127.0.0.1:4000/v1';

  const userContext = {
    userId: 'test-user-id',
    fullName: 'Lê Văn Test',
    role: 'ChiefAccountant', // Có quyền
    unitId: 'BGD',
    unitName: 'Ban Giám Đốc'
  };

  const agentConfig = agentDefinitions.BGD;
  const availableTools = [getComprehensiveReportTool];

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
        console.log(`\n[CALLBACK] Đang gọi tool: ${toolName} với args:`, args);
      },
      'qwen3.5-35b', // modelId
      (chunk) => {
        process.stdout.write(chunk);
      }
    );

    console.log("\n\n=== KẾT QUẢ CUỐI CÙNG ===");
    console.log("Reply length:", result.reply?.length);
    console.log("Steps:", result.steps);
    console.log("Used Tools:", result.usedTools);
    console.log("Active Model:", result.activeModel);

    expect(result.reply).toBeDefined();
    expect(result.reply).not.toContain("hệ thống bị gián đoạn");
    expect(result.usedTools).toContain("get_comprehensive_report");
  } catch (err: any) {
    console.error("LỖI TRONG TEST CASE:", err);
    throw err;
  }
}, 90000); // 90s timeout
