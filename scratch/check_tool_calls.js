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

  console.log("=== KIỂM TRA CÁC TOOL CALLS VÀ OUTPUT THỰC TẾ ===");
  
  let stepIndex = 0;
  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      stepIndex++;
      
      // Tìm xem có tool call get_dashboard_kpi nào không
      if (step.tool_calls) {
        const hasKpiTool = step.tool_calls.some(tc => {
          const name = tc.name || tc.TypeName || tc.function?.name || "";
          return name.includes("get_dashboard_kpi");
        });
        
        if (hasKpiTool) {
          console.log(`\n[Bước ${stepIndex}] Phát hiện gọi tool get_dashboard_kpi:`);
          console.log(`Args: ${JSON.stringify(step.tool_calls)}`);
        }
      }
      
      // Nếu là TOOL_RESPONSE hoặc kết quả tool
      if (step.type === 'TOOL_RESPONSE' || (step.status === 'DONE' && step.tool_calls)) {
        // In ra output
        // Tuy nhiên trong transcript.jsonl, output của tool thường nằm ở bước tiếp theo của model dưới vai trò 'tool'
      }
      
      if (step.content && (step.content.includes("139.48") || step.content.includes("139,479") || step.content.includes("12,500,000") || step.content.includes("12.5"))) {
        console.log(`\n[Bước ${stepIndex}] Chứa số liệu nhạy cảm:`);
        console.log(`Content: ${step.content.slice(0, 1000)}...`);
      }
    } catch (e) {
    }
  }
}

parseLogs();
