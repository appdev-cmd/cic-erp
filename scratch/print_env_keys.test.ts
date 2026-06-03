import { test } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

test('print env keys', () => {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log("No .env.local file found at", envPath);
    return;
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  console.log("Keys in .env.local:");
  content.split('\n').forEach(line => {
    const matched = line.match(/^\s*([\w.-]+)\s*=/);
    if (matched) {
      console.log("-", matched[1]);
    }
  });
});
