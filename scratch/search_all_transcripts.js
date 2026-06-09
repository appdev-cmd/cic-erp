import fs from 'fs';
import path from 'path';

const brainDir = 'C:/Users/hoang/.gemini/antigravity/brain/';

async function run() {
  if (!fs.existsSync(brainDir)) return;
  const dirs = fs.readdirSync(brainDir);
  
  for (const dir of dirs) {
    const logPath = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript.jsonl');
    if (fs.existsSync(logPath)) {
      try {
        const content = fs.readFileSync(logPath, 'utf-8');
        if (content.includes('20260605143000_seed_onboarding_templates.sql')) {
          console.log(`=== FOUND IN CONVERSATION: ${dir} ===`);
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('20260605143000_seed_onboarding_templates.sql')) {
              console.log(`[Line ${idx}] ${line.substring(0, 1000)}`);
            }
          });
        }
      } catch (err) {
        // ignore
      }
    }
  }
}

run();
