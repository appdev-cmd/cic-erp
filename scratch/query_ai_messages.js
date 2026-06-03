import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = {};

const parseEnvFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }
};

parseEnvFile('.env');
parseEnvFile('.env.local');

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
const email = env['VITE_DEV_EMAIL'] || 'appdev@cic.com.vn';
const password = env['VITE_DEV_PASSWORD'] || 'Abc123456';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  await supabase.auth.signInWithPassword({ email, password });

  console.log("=== TRUY VẤN LỊCH SỬ CHAT CỦA TRỢ LÝ ẢO TRÊN APP ===");
  
  // 1. Lấy danh sách conversations gần nhất
  const { data: conversations, error: convError } = await supabase
    .from('ai_conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (convError) {
    console.error("Lỗi lấy conversations:", convError);
    return;
  }

  console.log(`Lấy được ${conversations.length} cuộc hội thoại gần nhất.`);
  
  for (const conv of conversations) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Hội thoại ID: ${conv.id}`);
    console.log(`Tiêu đề: ${conv.title}`);
    console.log(`Agent: ${conv.agent_id} | Model: ${conv.model_id}`);
    console.log(`Cập nhật lúc: ${conv.updated_at}`);
    
    // Lấy tin nhắn của hội thoại này
    const { data: messages, error: msgError } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error(`Lỗi lấy tin nhắn cho ${conv.id}:`, msgError);
      continue;
    }

    console.log(`Số tin nhắn: ${messages.length}`);
    messages.forEach(msg => {
      console.log(`[${msg.role.toUpperCase()}] ${msg.content.slice(0, 1000)}${msg.content.length > 1000 ? '...' : ''}`);
    });
  }
}

run();
