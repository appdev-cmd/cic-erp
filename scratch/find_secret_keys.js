import fs from 'fs';
import path from 'path';

const brainDir = 'C:/Users/hoang/.gemini/antigravity/brain/';

async function run() {
  if (!fs.existsSync(brainDir)) {
    console.log('Brain directory does not exist:', brainDir);
    return;
  }

  const dirs = fs.readdirSync(brainDir);
  console.log(`Found ${dirs.length} conversation directories.`);

  const regex = /sb_secret_[a-zA-Z0-9_-]+/g;
  const foundKeys = new Set();

  for (const dir of dirs) {
    const logPath = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript.jsonl');
    if (fs.existsSync(logPath)) {
      console.log(`Searching logs in ${dir}...`);
      try {
        const content = fs.readFileSync(logPath, 'utf-8');
        const matches = content.match(regex);
        if (matches) {
          matches.forEach(k => foundKeys.add(k));
        }
      } catch (err) {
        console.error(`Failed to read logs for ${dir}:`, err.message);
      }
    }
  }

  console.log('\n--- SEARCH RESULTS ---');
  if (foundKeys.size > 0) {
    console.log('Found secret keys:', [...foundKeys]);
  } else {
    console.log('No keys starting with sb_secret_ found.');
  }
}

run();
