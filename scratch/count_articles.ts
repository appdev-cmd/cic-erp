import { dataClient as supabase } from '../lib/dataClient';

async function countArticles() {
  // Đăng nhập trước
  const devEmail = 'appdev@cic.com.vn';
  const devPassword = 'Abc123456';
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: devEmail,
    password: devPassword,
  });
  if (authError) {
    console.error('Auth failed:', authError.message);
    return;
  }
  
  const { count, error } = await supabase
    .from('tech_articles')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Count failed:', error);
  } else {
    console.log('Total articles in database (authenticated):', count);
  }
}

countArticles();
