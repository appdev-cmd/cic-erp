/**
 * Execute shell commands on local machine — OpenClaw-style.
 * Restricted to safe commands; dangerous ops blocked.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const BLOCKED_PATTERNS = [
  /rm\s+(-rf?|--recursive)\s+\//i,
  /mkfs/i, /dd\s+if=/i, /shutdown/i, /reboot/i,
  /:(){ :\|:& };:/,  // fork bomb
  />\s*\/dev\/sd/i,
  /curl.*\|\s*(bash|sh)/i,
];

const MAX_OUTPUT = 4000;
const TIMEOUT_MS = 30_000;

export function executeShell(command: string): { ok: boolean; output: string } {
  for (const pat of BLOCKED_PATTERNS) {
    if (pat.test(command)) {
      return { ok: false, output: 'Lệnh bị chặn vì lý do bảo mật.' };
    }
  }

  try {
    const result = execSync(command, {
      timeout: TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      encoding: 'utf-8',
      cwd: process.env.HOME ?? '/tmp',
      env: { ...process.env, LANG: 'en_US.UTF-8' },
    });
    const out = (result ?? '').trim();
    return { ok: true, output: out.slice(0, MAX_OUTPUT) || '(no output)' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, output: msg.slice(0, MAX_OUTPUT) };
  }
}

export function listFiles(dir: string): { ok: boolean; output: string } {
  try {
    const resolved = path.resolve(dir);
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const lines = entries.slice(0, 100).map(e => {
      const icon = e.isDirectory() ? '📁' : '📄';
      return `${icon} ${e.name}`;
    });
    return { ok: true, output: lines.join('\n') || '(thư mục trống)' };
  } catch (err: unknown) {
    return { ok: false, output: err instanceof Error ? err.message : String(err) };
  }
}

export function readFile(filePath: string): { ok: boolean; output: string } {
  try {
    const resolved = path.resolve(filePath);
    const stat = fs.statSync(resolved);
    if (stat.size > 500_000) {
      return { ok: false, output: 'File quá lớn (>500KB). Dùng lệnh head/tail.' };
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    return { ok: true, output: content.slice(0, MAX_OUTPUT) };
  } catch (err: unknown) {
    return { ok: false, output: err instanceof Error ? err.message : String(err) };
  }
}

export function writeFile(filePath: string, content: string): { ok: boolean; output: string } {
  try {
    const resolved = path.resolve(filePath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, content, 'utf-8');
    return { ok: true, output: `Đã ghi ${content.length} ký tự vào ${resolved}` };
  } catch (err: unknown) {
    return { ok: false, output: err instanceof Error ? err.message : String(err) };
  }
}

export function saveReport(filename: string, buffer: Buffer): string {
  const reportsDir = path.join(process.env.HOME ?? '/tmp', 'cic-reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const fullPath = path.join(reportsDir, filename);
  fs.writeFileSync(fullPath, buffer);
  return fullPath;
}
