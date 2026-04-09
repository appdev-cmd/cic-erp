import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cấu hình API cho Evaluator (Model test thử) và Meta-Agent (Model sửa lỗi)
// Dùng OpenAI Compatible API để dễ đổi sang vLLM/Local model
const EVAL_API_BASE = process.env.EVAL_API_BASE || 'http://127.0.0.1:8000/v1';
const EVAL_API_KEY = process.env.EVAL_API_KEY || 'empty';
const EVAL_MODEL = process.env.EVAL_MODEL || 'local-model'; // Thay bằng UID của model trên vLLM/Ollama

const META_API_BASE = process.env.META_API_BASE || 'http://127.0.0.1:8000/v1';
const META_API_KEY = process.env.META_API_KEY || 'empty';
const META_MODEL = process.env.META_MODEL || 'local-model'; // Khuyến khích dùng model lớn (Llama-3-70b, Qwen-32b) làm Meta Agent

// Định nghĩa Schema Tools (Lấy từ index_plugin.ts)
const TOOLS_SCHEMA = [
  {
    type: "function",
    function: {
      name: "cic_erp_my_tasks",
      description: "Lấy danh sách task được giao cho nhân viên hiện tại.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "cic_erp_generate_docx",
      description: "Sinh file Word (.docx) báo cáo.",
      parameters: { 
        type: "object", 
        properties: {
          filename: { type: "string" },
          title: { type: "string" },
          paragraphs: { type: "array", items: { type: "string" } }
        },
        required: ["filename", "title", "paragraphs"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cic_erp_search_contracts",
      description: "Tìm hợp đồng theo từ khóa.",
      parameters: {
        type: "object",
        properties: { keyword: { type: "string" } },
        required: ["keyword"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cic_erp_contracts_report",
      description: "Danh sách hợp đồng (RPC báo cáo).",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "cic_erp_expiring_contracts",
      description: "Hợp đồng sắp hết hạn trong N ngày.",
      parameters: { 
        type: "object", 
        properties: { days: { type: "number" } },
        required: []
      }
    }
  }
];

// Hàm gọi LLM để test xem Agent gọi Tool nào
async function callEvaluatorAgent(systemPrompt, userText) {
  if (!EVAL_API_KEY) throw new Error("Vui lòng thiết lập biến môi trường EVAL_API_KEY");

  const response = await fetch(`${EVAL_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EVAL_API_KEY}`
    },
    body: JSON.stringify({
      model: EVAL_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      tools: TOOLS_SCHEMA,
      tool_choice: 'auto',
      temperature: 0.0 // Set to 0 to ensure deterministic output for eval
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const message = data.choices[0].message;
  if (message.tool_calls && message.tool_calls.length > 0) {
    return {
      tool_name: message.tool_calls[0].function.name,
      tool_args: JSON.parse(message.tool_calls[0].function.arguments)
    };
  }
  return { tool_name: null, tool_args: {} };
}

// Hàm gọi LLM Meta Agent để phân tích lỗi và đẻ ra Prompt mới
async function callMetaAgent(instruction) {
  if (!META_API_KEY) throw new Error("Vui lòng thiết lập biến môi trường META_API_KEY");

  const response = await fetch(`${META_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${META_API_KEY}`
    },
    body: JSON.stringify({
      model: META_MODEL,
      messages: [
        { role: 'system', content: "Bạn là Master Prompter. Nhiệm vụ của bạn là tối ưu System Prompt để LLM bé hơn (hoặc bot) thực thi gọi đúng Tool. Chỉ trả về nội dung text của System Prompt mới (không được cho vào khối code ```). Mọi nội dung bạn viết ra sẽ được ghi đè thẳng vào file system_prompt.txt của bot thực tế để chạy." },
        { role: 'user', content: instruction }
      ],
      temperature: 0.7
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  let newPrompt = data.choices[0].message.content.trim();
  if (newPrompt.startsWith('```') && newPrompt.endsWith('```')) {
     const lines = newPrompt.split('\n');
     if (lines.length > 2) {
         newPrompt = lines.slice(1, -1).join('\n');
     }
  }
  return newPrompt;
}

// Vòng lặp tối ưu
async function runAutoOptimizer(iterations = 5) {
  const testCases = JSON.parse(fs.readFileSync(path.join(__dirname, 'test_cases.json'), 'utf8'));
  let currentPrompt = fs.readFileSync(path.join(__dirname, 'system_prompt.txt'), 'utf8');
  let bestScore = -1;

  for (let i = 0; i < iterations; i++) {
    console.log(`\n=== [Vòng lặp ${i + 1}/${iterations}] Đang chấm điểm... ===`);
    let score = 0;
    let failedLogs = [];

    // Trải thử từng test case
    for (let idx = 0; idx < testCases.length; idx++) {
      const tc = testCases[idx];
      let res;
      try {
        res = await callEvaluatorAgent(currentPrompt, tc.input);
      } catch (err) {
         console.error(`Lỗi API Evaluator: ${err.message}`);
         return; // Thoát nếu thiếu API key
      }

      const isToolCorrect = res.tool_name === tc.expected_tool;
      let areArgsCorrect = true;
      let missingArg = null;

      if (tc.expected_args_must_contain && res.tool_args) {
        for (const arg of tc.expected_args_must_contain) {
          if (res.tool_args[arg] === undefined) {
             areArgsCorrect = false;
             missingArg = arg;
             break;
          }
        }
      }

      if (isToolCorrect && areArgsCorrect) {
        score++;
        console.log(`✅ [Pass] "${tc.input}" -> Gọi chuẩn: ${res.tool_name}`);
      } else {
        console.log(`❌ [Fail] "${tc.input}"`);
        console.log(`   - Kì vọng: ${tc.expected_tool}`);
        console.log(`   - Model gọi: ${res.tool_name || 'Không gọi tool nào'}`);
        if (isToolCorrect && !areArgsCorrect) {
            console.log(`   - Thiếu tham số: ${missingArg}`);
        }
        
        failedLogs.push(`
        Câu hỏi User: "${tc.input}"
        Đã gọi sai Tool: ${res.tool_name || 'None'}
        Kì vọng cần gọi là Tool: ${tc.expected_tool}
        Lý do phụ: ${isToolCorrect && !areArgsCorrect ? `Thiếu tham số ${missingArg}` : 'Gọi nhầm tool hoặc không gọi tool.'}
        `);
      }
    }

    console.log(`\n=> KẾT QUẢ VÒNG ${i + 1}: Đạt ${score}/${testCases.length} điểm.`);

    if (score === testCases.length) {
      console.log("🎉 Hoàn hảo! System Prompt đã vượt qua toàn bộ Test Cases.");
      fs.writeFileSync(path.join(__dirname, 'system_prompt.txt'), currentPrompt); // Lưu lại
      break;
    }

    // Logic Rollback & Save Best
    if (score > bestScore) {
      bestScore = score;
      console.log(`⭐ Điểm cao kỷ lục mới (${bestScore}). Đang sao lưu file system_prompt_best.txt...`);
      fs.writeFileSync(path.join(__dirname, 'system_prompt_best.txt'), currentPrompt);
    } else {
      console.log(`🔄 Điểm (${score}) không tốt hơn kỷ lục (${bestScore}). Rollback về bản tốt nhất trước đó!`);
      currentPrompt = fs.readFileSync(path.join(__dirname, 'system_prompt_best.txt'), 'utf8');
    }

    // Nếu chưa phải vòng cuối, gọi Meta Agent để viết lại Prompt
    if (i < iterations - 1) {
      const optimizationInstruction = `
      System Prompt hiện tại của hệ thống:
      """
      ${currentPrompt}
      """
      
      Khi test, bot bị sai ở các trường hợp sau:
      ${failedLogs.join('\n')}
      
      Hãy viết lại nội dung System Prompt để khắc phục các lỗi trên.
      Tip: Hãy ra lệnh rõ ràng hơn, có thể thêm quy tắc "Khi gặp từ khóa X thì gọi Tool Y" hoặc giải thích các Tool.
      TUYỆT ĐỐI CHỈ OUTPUT NỘI DUNG PROMPT MỚI.
      `;

      console.log("🧠 Meta-Agent đang gãi đầu suy nghĩ Prompt mới...");
      try {
        currentPrompt = await callMetaAgent(optimizationInstruction);
        fs.writeFileSync(path.join(__dirname, 'system_prompt.txt'), currentPrompt); // Thay đổi file cho vòng lặp sau test
        console.log("✨ Đã tạo xong Prompt mới. Sẵn sàng cho vòng tiếp theo.");
      } catch (err) {
         console.error(`Lỗi API Meta Agent: ${err.message}`);
         break;
      }
    }
  }
}

// Bắt đầu
console.log("Khởi động Meta-AutoResearch Tool...");
runAutoOptimizer().catch(err => console.error(err));
