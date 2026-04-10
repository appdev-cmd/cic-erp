import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envPath)) {
  const rawEnv = fs.readFileSync(envPath, 'utf8');
  rawEnv.split('\n').forEach(line => {
    const match = line.match(/^([^#\s=]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  });
}

const DEST_NEMO_DIR = path.resolve(__dirname, '../../../cic-nemo/dataset');

// Setup Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn("⚠️ Không tìm thấy biến môi trường Supabase! Data sẽ chỉ lấy từ các file cục bộ.");
}

// Function to append to JSONL securely
function appendToJsonL(filePath, dataObj) {
  fs.appendFileSync(filePath, JSON.stringify(dataObj) + '\n');
}

async function extractSupabaseInternalRequests(outputFile) {
  if (!supabase) return;
  console.log("-> Đang kéo dữ liệu từ bảng `internal_requests` trên Supabase...");
  const { data, error } = await supabase.from('internal_requests').select('type, title, description, status').limit(200);
  
  if (error) {
    console.error("Lỗi khi fetch dataset internal_requests:", error.message);
    return;
  }
  
  if (data && data.length > 0) {
    data.forEach(req => {
      // Mock conversation format
      const entry = {
        messages: [
          { role: "system", content: "Bạn là chuyên gia nhân sự hỗ trợ hệ thống Internal Request ERP." },
          { role: "user", content: `Xin chào, giúp tôi xử lý yêu cầu loại '${req.type}'. Tiêu đề là: ${req.title}.` },
          { role: "assistant", content: `Chào bạn, yêu cầu "${req.title}" (loại ${req.type}) hiện đang ở trạng thái "${req.status}". ${req.description ? 'Ghi chú: ' + req.description : ''}` }
        ]
      };
      appendToJsonL(outputFile, entry);
    });
    console.log(`✅  Đã xuất ${data.length} records internal_requests.`);
  }
}

function processFailedLogsData(outputFile) {
  console.log("-> Đang tổng hợp dữ liệu Failed Logs từ hệ thống Auto-Prompt...");
  const promptLogPath = path.resolve(__dirname, '../auto-prompt/failed_logs.txt');
  
  if (fs.existsSync(promptLogPath)) {
    const rawContent = fs.readFileSync(promptLogPath, 'utf8');
    const sections = rawContent.split('----------------------------------------');
    let extractedCount = 0;

    sections.forEach(sec => {
      if (!sec.trim()) return;
      const lines = sec.trim().split('\n');
      let userInput = "";
      let expectedTool = "";
      lines.forEach(l => {
        if (l.includes('Câu hỏi User:')) userInput = l.split('Câu hỏi User:')[1].trim().replace(/^"|"$/g, '');
        if (l.includes('Kì vọng cần gọi là Tool:')) expectedTool = l.split('Kì vọng cần gọi là Tool:')[1].trim();
      });

      if (userInput && expectedTool) {
        const entry = {
          messages: [
            { role: "system", content: "Bạn là hệ thống Tool Calling thông minh nhất." },
            { role: "user", content: userInput },
            { role: "assistant", tool_calls: [{ type: "function", function: { name: expectedTool, arguments: "{}" } }] }
          ]
        };
        appendToJsonL(outputFile, entry);
        extractedCount++;
      }
    });
    console.log(`✅  Đã xuất ${extractedCount} records từ failed_logs.txt (Tool Calling correction data).`);
  } else {
    console.warn("⚠️ Không tìm thấy file failed_logs.txt (Có vẻ Vòng lặp Prompt đã hoàn hảo 100%)");
  }
}

async function startPipeline() {
  console.log("🚀 KHỞI ĐỘNG DATA PIPELINE AUTO-TRAINER...");
  
  // Create NeMo dir if needed
  if (!fs.existsSync(DEST_NEMO_DIR)) {
    fs.mkdirSync(DEST_NEMO_DIR, { recursive: true });
  }

  const trainFile = path.join(DEST_NEMO_DIR, 'train_dataset.jsonl');
  const evalFile = path.join(DEST_NEMO_DIR, 'eval_dataset.jsonl');
  
  // Wipe old dataset
  if (fs.existsSync(trainFile)) fs.unlinkSync(trainFile);
  if (fs.existsSync(evalFile)) fs.unlinkSync(evalFile);

  await extractSupabaseInternalRequests(trainFile);
  processFailedLogsData(trainFile);
  
  // Create dummy eval
  appendToJsonL(evalFile, {
    messages: [
       { role: "system", content: "Bạn là chuyên gia nhân sự." },
       { role: "user", content: "Công ty mình có đóng bảo hiểm Full lương không em?" },
       { role: "assistant", content: "Chào bạn, công ty hoàn toàn tuân thủ pháp luật và đóng BHXH trên 100% lương cơ bản theo hợp đồng lao động nhé!" }
    ]
  });

  console.log(`\n🎉 HOÀN TẤT TRÍCH XUẤT! Các tập tin đã được đẩy sang NeMo Server.`);
  console.log(`- Data file: ${trainFile}`);
  console.log(`- Eval file: ${evalFile}`);
}

startPipeline();
