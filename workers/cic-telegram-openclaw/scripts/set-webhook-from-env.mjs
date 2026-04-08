#!/usr/bin/env node
/**
 * Đọc .env trong thư mục worker, gọi Telegram setWebhook.
 * Cần: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET
 * Tuỳ chọn: SUPABASE_FUNCTIONS_URL (mặc định proxy CIC ERP)
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
if (!existsSync(envPath)) {
  console.error('Thiếu file .env trong', root);
  process.exit(1);
}

const raw = readFileSync(envPath, 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1);
  env[k] = v;
}

const token = env.TELEGRAM_BOT_TOKEN;
const secret = env.TELEGRAM_WEBHOOK_SECRET;
const url =
  env.SUPABASE_FUNCTIONS_URL ||
  'https://jyohocjsnsyfgfsmjfqx.supabase.co/functions/v1/telegram-openclaw-proxy';

if (!token || !secret) {
  console.error('Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_WEBHOOK_SECRET trong .env');
  process.exit(1);
}

const body = new URLSearchParams({ url, secret_token: secret });
const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
if (!data.ok) process.exit(1);
console.log('\nOK: Webhook đã đăng ký tới', url);
