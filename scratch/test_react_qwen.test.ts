import { describe, it, expect } from 'vitest';
import { runReActLoop } from '../services/ai/openclaw/react-loop';
import { erpToolsRegistry } from '../services/ai/openclaw/tools/registry';
import { AgentToolConfigService } from '../services/ai/agentToolConfigService';
import { agentDefinitions } from '../services/ai/openclaw/agents/definitions';
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

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  clear: () => {}
} as any;

describe('Test Full ReAct Loop with Qwen', () => {
  it('should run full loop and return real DB numbers in final answer', async () => {
    console.log("=== THỰC HIỆN TEST TÍCH HỢP FULL REACT LOOP VỚI QWEN LOCAL ===");
    
    const context = {
      userId: 'test-admin-id',
      employeeId: 'test-emp-id',
      fullName: 'Test Admin',
      role: 'Admin',
    };

    const agentConf = {
      id: 'agent-admin',
      name: 'Quản trị viên',
      allowedTools: ['*']
    };

    const mergedTools = await AgentToolConfigService.getMergedTools(erpToolsRegistry);
    
    // Lọc tools cho admin (cho phép tất cả)
    const filteredTools = agentConf.allowedTools?.includes('*')
      ? mergedTools
      : mergedTools.filter(t => agentConf.allowedTools?.includes(t.name));

    console.log("Khởi chạy ReAct loop với Qwen local...");
    const result = await runReActLoop(
      'Cho tôi xem KPI tổng quan công ty',
      context,
      agentConf as any,
      filteredTools,
      [], // No history
      8,  // Max steps
      undefined,
      (toolName, args) => {
        console.log(`[TEST REACT] Model requested tool call: ${toolName} with args:`, args);
      },
      'qwen3.5-35b'
    );

    console.log("Kết quả phản hồi cuối cùng của AI:\n", result.reply);
    console.log("Các tools đã sử dụng:", result.usedTools);

    expect(result.reply).toBeDefined();
    // Số liệu thật từ DB là 64.82 tỷ VND doanh thu, 142.79 tỷ VND ký kết.
    // Kiểm tra xem phản hồi có chứa số liệu thật thay vì số bịa đặt (125 tỷ, 89 tỷ) hay không.
    expect(result.usedTools).toContain('get_dashboard_kpi');
    expect(result.reply).toContain('64'); // Chứa số 64 trong "64.82 tỷ" hoặc "64,82"
  }, 35000);
});
