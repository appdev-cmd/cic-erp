import { describe, it, expect } from 'vitest';
import { callAgentTurn } from '../services/ai/gateway';
import { erpToolsRegistry } from '../services/ai/openclaw/tools/registry';
import * as fs from 'fs';
import * as path from 'path';

// Đọc file .env.local thủ công và gán vào process.env
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

// Mock localStorage cho environments
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  clear: () => {}
} as any;

describe('Test Direct Qwen Tool Call', () => {
  it('should invoke get_dashboard_kpi tool call when asked for KPI overview', async () => {
    console.log("=== THỰC HIỆN TEST GỌI DIRECT QWEN TOOL CALL ===");
    
    // Tìm tool get_dashboard_kpi trong registry
    const targetTool = erpToolsRegistry.find(t => t.name === 'get_dashboard_kpi');
    expect(targetTool).toBeDefined();

    const toolsSchema = [{
      type: 'function' as const,
      function: {
        name: targetTool!.name,
        description: targetTool!.description,
        parameters: {
          type: 'object',
          properties: targetTool!.schema,
        },
      },
    }];

    const request = {
      model: 'qwen3.5-35b',
      messages: [
        { role: 'system' as const, content: 'Bạn là Trợ lý AI của hệ thống CIC ERP. Nhiệm vụ: truy xuất dữ liệu ERP bằng tools khi cần, phân tích và trả lời người dùng. Hỏi về SỐ LIỆU (doanh thu, báo cáo, KPI) → BẮT BUỘC GỌI TOOL. Không tự sinh số.' },
        { role: 'user' as const, content: 'Cho tôi xem KPI tổng quan công ty' }
      ],
      tools: toolsSchema,
      temperature: 0.15,
    };

    console.log("Gửi request lên API...");
    const response = await callAgentTurn(request);
    console.log("Response nhận được:", JSON.stringify(response, null, 2));

    expect(response.tool_calls).toBeDefined();
    expect(response.tool_calls!.length).toBeGreaterThan(0);
    expect(response.tool_calls![0].function.name).toBe('get_dashboard_kpi');
  }, 25000);
});
