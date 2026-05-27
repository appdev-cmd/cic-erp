import fs from 'fs';

const logPath = 'C:\\Users\\hoang\\.gemini\\antigravity\\brain\\f39dee5b-478b-41da-a20d-11542ab1923e\\.system_generated\\logs\\transcript.jsonl';
const content = fs.readFileSync(logPath, 'utf-8');
const lines = content.split('\n');

console.log("--- SEARCHING ALL STRINGS STARTING WITH 'sb_' ---");
const regex = /sb_[a-zA-Z0-9_]+/g;
const matches = content.match(regex);
if (matches) {
  console.log("Found matches:", [...new Set(matches)]);
} else {
  console.log("No matches found starting with sb_");
}

console.log("\n--- SEARCHING FOR 'SUPABASE_SERVICE_ROLE_KEY' ---");
lines.forEach((line, idx) => {
  if (line.includes('SUPABASE_SERVICE_ROLE_KEY') && !line.includes('VITE_SUPABASE_SERVICE_ROLE_KEY')) {
    const pos = line.indexOf('SUPABASE_SERVICE_ROLE_KEY');
    console.log(`[Line ${idx}] ... ${line.substring(Math.max(0, pos - 50), Math.min(line.length, pos + 150))} ...`);
  }
});
