import { describe, it, expect } from 'vitest';
import { getDashboardKpiTool } from '../services/ai/openclaw/tools/dashboard.tools';
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

describe('Test Database get_dashboard_kpi tool data', () => {
  it('should print actual KPI statistics from database', async () => {
    console.log("=== THỰC HIỆN TEST LẤY DỮ LIỆU THẬT TỪ DATABASE ===");
    
    const context = {
      userId: 'test-admin-id',
      employeeId: 'test-emp-id',
      fullName: 'Test Admin',
      role: 'Admin',
    };

    const res = await getDashboardKpiTool.execute({ year: '2026' }, context);
    console.log("Kết quả get_dashboard_kpi từ DB:\n", JSON.stringify(res, null, 2));
    
    expect(res).toBeDefined();
  }, 25000);
});
