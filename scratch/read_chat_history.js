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

  console.log("=== TRÍCH XUẤT LỊCH SỬ CHAT CỦA USER VỚI AI VÀ CÁC LỆNH LIÊN QUAN ===");
  
  let stepIndex = 0;
  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      stepIndex++;
      
      // Nếu là USER_INPUT từ user thật sự trong chat (chứa từ khóa tài chính hoặc số liệu)
      if (step.type === 'USER_INPUT') {
        const text = step.content || "";
        if (text.includes("số liệu") || text.includes("tại sao") || text.includes("triệt để") || text.includes("lệch") || text.includes("139") || text.includes("12.5") || text.includes("chụp") || text.includes("bịa")) {
          console.log(`\n[Bước ${stepIndex}] USER HỎI: ${text}`);
        }
      }
      
      // Hoặc nếu là PLANNER_RESPONSE chứa số liệu
      if (step.type === 'PLANNER_RESPONSE' && step.content) {
        const text = step.content;
        if (text.includes("12.5") || text.includes("12,500,000") || text.includes("139") || text.includes("tỷ")) {
          console.log(`[Bước ${stepIndex}] AI TRẢ LỜI (TRUNCATED): ${text.slice(0, 1000)}...`);
        }
      }
    } catch (e) {
    }
  }
}

parseLogs();
