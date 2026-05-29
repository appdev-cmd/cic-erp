import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  try {
    const envPath = path.resolve('.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            const val = trimmed.substring(eqIdx + 1).trim();
            process.env[key] = val;
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to load .env.local', err);
  }
}

async function run() {
  loadEnvLocal();
  const apiKey = process.env.VITE_LITELLM_KEY || 'sk-cic-2026';
  const baseURL = 'https://ai-api.cic.com.vn:9443/v1';
  
  console.log('Using LiteLLM Key:', apiKey);
  console.log('Base URL:', baseURL);
  
  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen2.5-32b',
        messages: [{ role: 'user', content: 'chào' }],
        temperature: 0.15,
        stream: false
      })
    });
    
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error occurred:', error);
  }
}

run();
