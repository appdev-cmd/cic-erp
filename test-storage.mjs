import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testUpload() {
  console.log("Testing upload to 'documents' bucket...");
  const fileName = `test_${Date.now()}.txt`;
  
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(`resumes/${fileName}`, 'test content', { upsert: true });

  if (error) {
    console.error("Storage error:", error.message);
  } else {
    console.log("Upload success!", data);
  }
}

testUpload();
