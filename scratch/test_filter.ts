import * as fs from 'fs';
import * as path from 'path';

// Đọc file .env.local thủ công và gán vào process.env ngay lập tức
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const matched = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (matched) {
    const key = matched[1];
    let val = matched[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    process.env[key] = val.trim();
  }
});

async function run() {
  console.log("=== KIỂM TRA MẢNG TOOLS VÀ FILTER (DÙNG DYNAMIC IMPORT) ===");
  
  // Dynamic import để đảm bảo process.env đã được gán trước khi dataClient khởi tạo
  const { erpToolsRegistry } = await import('../services/ai/openclaw/tools/registry');
  const { AgentToolConfigService } = await import('../services/ai/agentToolConfigService');
  const { AgentConfigService } = await import('../services/ai/agentConfigService');

  console.log(`Số lượng tool trong erpToolsRegistry gốc: ${erpToolsRegistry.length}`);
  
  try {
    const mergedTools = await AgentToolConfigService.getMergedTools(erpToolsRegistry);
    console.log(`Số lượng tool trong mergedTools: ${mergedTools.length}`);
    
    const bgdConfig = await AgentConfigService.getById('agent-bgd');
    if (!bgdConfig) {
      console.error("Không tìm thấy config cho agent-bgd trong DB!");
      return;
    }
    
    console.log("BGD config allowed_tools in DB:", bgdConfig.allowed_tools);
    
    const filteredTools = mergedTools.filter(t => bgdConfig.allowed_tools?.includes(t.name));
    console.log(`Số lượng tool sau khi filter cho agent-bgd: ${filteredTools.length}`);
    console.log("Danh sách tool sau filter:", filteredTools.map(t => t.name));
  } catch (error) {
    console.error("Lỗi khi test filter:", error);
  }
}

run();
