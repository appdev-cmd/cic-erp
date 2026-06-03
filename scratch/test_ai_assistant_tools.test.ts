import { describe, it, expect, vi } from 'vitest';
import { erpToolsRegistry } from '../services/ai/openclaw/tools/registry';
import { AgentToolConfigService } from '../services/ai/agentToolConfigService';
import { AgentConfigService } from '../services/ai/agentConfigService';
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

// Mock cho localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; }
  };
})();
global.localStorage = localStorageMock as any;

describe('Test AIAssistant Tool Filtering Logic', () => {
  it('should retrieve tools correctly and filter for agent-bgd', async () => {
    console.log("=== THỰC HIỆN TEST FILTER TOOLS GIẢ LẬP CLIENT ===");
    
    // 1. Kiểm tra merged tools
    const mergedTools = await AgentToolConfigService.getMergedTools(erpToolsRegistry);
    console.log(`[TEST] Số lượng mergedTools: ${mergedTools.length}`);
    expect(mergedTools.length).toBeGreaterThan(0);

    // 2. Lấy dbAgents giống như useEffect trong AIAssistant
    const dbRows = await AgentConfigService.getAllAgents();
    const dbIds = new Set(dbRows.map(a => a.id));
    const codeOnly = Object.values(agentDefinitions).filter(a => !dbIds.has(a.id));
    const dbAgents = [...dbRows, ...codeOnly];
    console.log(`[TEST] Số lượng dbAgents: ${dbAgents.length}`);

    // 3. Giả lập currentAgent và tìm selected agent
    const currentAgent = 'agent-bgd';
    const selected = dbAgents.find(a => a.id === currentAgent);
    expect(selected).toBeDefined();

    const agentConf = selected!;
    console.log(`[TEST] Agent hiện tại: ${agentConf.name} (id: ${agentConf.id})`);
    console.log(`[TEST] Allowed tools của agent:`, agentConf.allowedTools);

    // 4. Lọc tools
    const filteredTools = mergedTools.filter(t => agentConf.allowedTools?.includes(t.name));
    console.log(`[TEST] Số lượng filteredTools: ${filteredTools.length}`);
    console.log(`[TEST] Danh sách filteredTools:`, filteredTools.map(t => t.name));

    expect(filteredTools.length).toBeGreaterThan(0);
    expect(filteredTools.map(t => t.name)).toContain('get_dashboard_kpi');
  });

  it('should allow all tools for agent-admin with wildcard *', async () => {
    console.log("=== THỰC HIỆN TEST FILTER TOOLS VỚI WILDCARD * ===");
    const mergedTools = await AgentToolConfigService.getMergedTools(erpToolsRegistry);
    
    const agentConf = {
      id: 'agent-admin',
      name: 'Quản trị viên',
      allowedTools: ['*']
    };

    const filteredTools = agentConf.allowedTools?.includes('*')
      ? mergedTools
      : mergedTools.filter(t => agentConf.allowedTools?.includes(t.name));

    console.log(`[TEST WILDCARD] Số lượng filteredTools cho admin: ${filteredTools.length} / ${mergedTools.length}`);
    expect(filteredTools.length).toBe(mergedTools.length);
  });
});
