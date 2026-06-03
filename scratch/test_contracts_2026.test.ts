import { test, expect } from 'vitest';
import { runReActLoop } from '../services/ai/openclaw/react-loop';
import { agentDefinitions } from '../services/ai/openclaw/agents/definitions';
import { searchContractsTool, getContractStatsTool } from '../services/ai/openclaw/tools/contract.tools';

test("test contract hallucination 2026", async () => {
  console.log("=== BẮT ĐẦU CHẠY THỬ REACT LOOP VỚI CÂU HỎI ENJICAD 2026 ===");
  
  const userContext = {
    userId: 'test-user-id',
    fullName: 'Lê Văn Test',
    role: 'Leadership',
    unitId: 'BGD',
    unitName: 'Ban Giám Đốc'
  };

  const agentConfig = agentDefinitions.BGD;
  // Load các tool liên quan đến contracts
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
      'gemini-2.0-flash', // modelId - dùng gemini cho dễ chạy qua API cloud không cần vLLM local bận
      (chunk) => {
        process.stdout.write(chunk);
      }
    );

    console.log("\n\n=== KẾT QUẢ CUỐI CÙNG ===");
    console.log("Reply:", result.reply);
    console.log("Steps:", result.steps);
    console.log("Used Tools:", result.usedTools);
    console.log("Active Model:", result.activeModel);

    expect(result.reply).toBeDefined();
  } catch (err: any) {
    console.error("LỖI TRONG TEST CASE:", err);
    throw err;
  }
}, 90000);
