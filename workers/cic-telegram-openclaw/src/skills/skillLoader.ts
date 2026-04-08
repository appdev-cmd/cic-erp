/**
 * OpenClaw-compatible Skill Loader.
 * Scans SKILL.md files, parses YAML frontmatter, filters by OS/bins,
 * and injects eligible skill instructions into the LLM system prompt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export interface SkillMeta {
  name: string;
  description: string;
  homepage?: string;
  userInvocable?: boolean;
  metadata?: {
    openclaw?: {
      emoji?: string;
      os?: string[];
      requires?: {
        bins?: string[];
        anyBins?: string[];
        env?: string[];
        config?: string[];
      };
      install?: Array<Record<string, unknown>>;
      always?: boolean;
    };
  };
}

export interface LoadedSkill {
  name: string;
  description: string;
  emoji: string;
  instructions: string;
  dir: string;
  meta: SkillMeta;
}

function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const yamlBlock = match[1];
  const body = match[2];
  const meta: Record<string, unknown> = {};

  for (const line of yamlBlock.split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)/);
    if (!kv) continue;
    const [, key, val] = kv;
    let parsed: unknown = val.trim();
    if (parsed === 'true') parsed = true;
    else if (parsed === 'false') parsed = false;
    else {
      try { parsed = JSON.parse(val.trim()); } catch { /* keep as string */ }
    }
    meta[key.replace(/-/g, '_')] = parsed;
  }

  // Handle multiline metadata JSON
  const metaJsonMatch = yamlBlock.match(/metadata:\s*(\{[\s\S]*?\})\s*(?:\n\w|$)/);
  if (metaJsonMatch) {
    try { meta.metadata = JSON.parse(metaJsonMatch[1]); } catch { /* ignore */ }
  }

  return { meta, body };
}

function binExists(bin: string): boolean {
  try {
    execSync(`which ${bin} 2>/dev/null`, { encoding: 'utf-8' });
    return true;
  } catch { return false; }
}

function isEligible(meta: SkillMeta): boolean {
  const oc = meta.metadata?.openclaw;
  if (!oc) return true;
  if (oc.always) return true;

  if (oc.os && oc.os.length > 0) {
    if (!oc.os.includes(process.platform)) return false;
  }

  if (oc.requires?.bins) {
    for (const b of oc.requires.bins) {
      if (!binExists(b)) return false;
    }
  }

  if (oc.requires?.anyBins && oc.requires.anyBins.length > 0) {
    if (!oc.requires.anyBins.some(binExists)) return false;
  }

  if (oc.requires?.env) {
    for (const e of oc.requires.env) {
      if (!process.env[e]) return false;
    }
  }

  return true;
}

function loadSkillDir(dir: string): LoadedSkill | null {
  const mdPath = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(mdPath)) return null;

  const content = fs.readFileSync(mdPath, 'utf-8');
  const { meta, body } = parseFrontmatter(content);

  const name = String(meta.name ?? path.basename(dir));
  const description = String(meta.description ?? '');
  if (!name) return null;

  const skillMeta: SkillMeta = {
    name,
    description,
    homepage: meta.homepage as string | undefined,
    userInvocable: meta.user_invocable !== false,
    metadata: meta.metadata as SkillMeta['metadata'],
  };

  if (!isEligible(skillMeta)) return null;

  const emoji = skillMeta.metadata?.openclaw?.emoji ?? '🔧';

  return {
    name,
    description,
    emoji,
    instructions: body.trim(),
    dir,
    meta: skillMeta,
  };
}

/**
 * Scan directories (OpenClaw precedence order, reversed — highest wins)
 */
export function loadAllSkills(extraDirs: string[] = []): LoadedSkill[] {
  const home = process.env.HOME ?? '/tmp';
  const workspaceRoot = process.cwd();

  const searchPaths = [
    ...extraDirs,
    path.join(home, '.openclaw', 'skills'),
    path.join(home, '.agents', 'skills'),
    path.join(workspaceRoot, '.agents', 'skills'),
    path.join(workspaceRoot, 'skills'),
  ];

  const skillMap = new Map<string, LoadedSkill>();

  for (const base of searchPaths) {
    if (!fs.existsSync(base)) continue;

    // Check if base itself contains SKILL.md
    const direct = loadSkillDir(base);
    if (direct) { skillMap.set(direct.name, direct); continue; }

    // Scan subdirectories
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { continue; }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skill = loadSkillDir(path.join(base, entry.name));
      if (skill) skillMap.set(skill.name, skill);
    }
  }

  return Array.from(skillMap.values());
}

/**
 * Format skills into compact XML for system prompt injection (OpenClaw style)
 */
export function formatSkillsForPrompt(skills: LoadedSkill[]): string {
  if (skills.length === 0) return '';

  const lines = ['<available_skills>'];
  for (const s of skills) {
    lines.push(`<skill name="${s.name}" emoji="${s.emoji}">`);
    lines.push(`<description>${s.description}</description>`);
    lines.push(`<instructions>\n${s.instructions}\n</instructions>`);
    lines.push('</skill>');
  }
  lines.push('</available_skills>');
  return lines.join('\n');
}

/**
 * Short list for /skills command
 */
export function formatSkillsList(skills: LoadedSkill[]): string {
  if (skills.length === 0) return 'Chưa có skill nào. Dùng /install <tên> để cài từ ClawHub.';
  return skills.map(s => `${s.emoji} <b>${s.name}</b> — ${s.description}`).join('\n');
}
