/**
 * Install skills from ClawHub — OpenClaw compatible.
 * `npx clawhub@latest install <name>` or manual download.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SKILLS_DIR = path.join(process.cwd(), 'skills');

export interface InstallResult {
  ok: boolean;
  message: string;
  skillName?: string;
}

export function installSkill(name: string): InstallResult {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleaned || cleaned.length < 2) {
    return { ok: false, message: 'Tên skill không hợp lệ.' };
  }

  if (!fs.existsSync(SKILLS_DIR)) {
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }

  const skillDir = path.join(SKILLS_DIR, cleaned);
  if (fs.existsSync(skillDir)) {
    return { ok: false, message: `Skill "${cleaned}" đã tồn tại. Dùng /uninstall ${cleaned} trước.` };
  }

  try {
    execSync(`npx clawhub@latest install ${cleaned}`, {
      cwd: SKILLS_DIR,
      timeout: 60_000,
      encoding: 'utf-8',
      env: { ...process.env, npm_config_yes: 'true' },
    });

    if (fs.existsSync(path.join(skillDir, 'SKILL.md'))) {
      return { ok: true, message: `Đã cài skill "${cleaned}" từ ClawHub.`, skillName: cleaned };
    }

    // clawhub might install into current dir
    const altPath = path.join(SKILLS_DIR, cleaned);
    if (fs.existsSync(altPath)) {
      return { ok: true, message: `Đã cài skill "${cleaned}".`, skillName: cleaned };
    }

    return { ok: false, message: `Không tìm thấy SKILL.md sau khi cài. Kiểm tra tên skill.` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Lỗi cài skill: ${msg.slice(0, 500)}` };
  }
}

export function uninstallSkill(name: string): InstallResult {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const skillDir = path.join(SKILLS_DIR, cleaned);

  if (!fs.existsSync(skillDir)) {
    return { ok: false, message: `Skill "${cleaned}" không tồn tại.` };
  }

  try {
    fs.rmSync(skillDir, { recursive: true, force: true });
    return { ok: true, message: `Đã gỡ skill "${cleaned}".` };
  } catch (err: unknown) {
    return { ok: false, message: `Lỗi gỡ: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function listInstalledSkillDirs(): string[] {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, d.name, 'SKILL.md')))
    .map(d => d.name);
}
