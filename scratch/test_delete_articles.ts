import { TechIntelService } from '../services/techIntelService';
import { dataClient as supabase } from '../lib/dataClient';

async function testDelete() {
  console.log('Testing delete via TechIntelService...');
  
  // Giả lập đăng nhập bằng dev user
  const devEmail = 'appdev@cic.com.vn';
  const devPassword = 'Abc123456'; // Lấy mật khẩu từ env / env.local hoặc mặc định

  console.log('Logging in as:', devEmail);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: devEmail,
    password: devPassword,
  });
  if (authError) {
    console.error('Auth failed:', authError.message);
    return;
  }
  console.log('Auth successful. User ID:', authData.user?.id);

  // Thử delete
  console.log('Attempting to delete all tech_articles...');
  try {
    await TechIntelService.deleteAllArticles();
    console.log('Delete successful!');
  } catch (error) {
    console.error('Delete failed with error:', error);
  }
}

testDelete();
