import fs from 'fs';
import readline from 'readline';

const logPath = 'C:\\Users\\hoang\\.gemini\\antigravity\\brain\\f7b2c9a4-3769-4fa6-8700-01168c7a3051\\.system_generated\\logs\\transcript.jsonl';

async function parseLogs() {
  if (!fs.existsSync(logPath)) {
    console.error("Không tìm thấy file log.");
    return;
  }

  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("=== ĐỌC CÁC TIN NHẮN TỪ TRANSCRIPT ===");
  
  let stepIndex = 0;
  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      stepIndex++;
      
      // Nếu là USER_INPUT
      if (step.type === 'USER_INPUT') {
        console.log(`\n[Bước ${stepIndex}] USER: ${step.content}`);
      }
      
      // Nếu là tool call hoặc response
      if (step.tool_calls && step.tool_calls.length > 0) {
        console.log(`[Bước ${stepIndex}] TOOL CALLS:`);
        step.tool_calls.forEach(tc => {
          console.log(`  - Tool: ${tc.name || tc.TypeName || tc.function?.name}`);
          console.log(`    Args: ${JSON.stringify(tc.arguments || tc.function?.arguments || {})}`);
        });
      }
      
      if (step.type === 'PLANNER_RESPONSE' && step.content) {
        console.log(`[Bước ${stepIndex}] AI RESPONSE: ${step.content.slice(0, 500)}...`);
      }
      
      if (step.type === 'RUN_COMMAND') {
        console.log(`[Bước ${stepIndex}] COMMAND: ${step.content}`);
      }
    } catch (e) {
      // Bỏ qua dòng lỗi parse
    }
  }
}

parseLogs();
