import { startImapListener } from './imapListener.js';
import { startRealtimeAutomator } from './realtimeAutomator.js';

console.log("🚀 Starting CIC Recruitment Automation Mailer...");

async function main() {
  try {
    startRealtimeAutomator();
    console.log("✅ Supabase Realtime Listener started.");

    await startImapListener();
    console.log("✅ IMAP Listener started.");
  } catch (error) {
    console.error("❌ Fatal Error:", error);
    process.exit(1);
  }
}

main();
