import fs from 'fs';
import path from 'path';

const logPath = 'C:/Users/hoang/.gemini/antigravity/brain/4a1b22f1-997a-4fb2-b7a3-b237a6be6746/.system_generated/logs/transcript.jsonl';

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.tool_calls) {
        for (const tc of parsed.tool_calls) {
          if (tc.name === 'run_command' || tc.name === 'run_command_v2') {
            console.log('--- COMMAND RUN ---');
            console.log(JSON.stringify(tc));
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
} else {
  console.log('Log not found.');
}
