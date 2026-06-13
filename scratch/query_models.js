import fs from 'fs';
import path from 'path';

function getApiKey() {
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
            const val = trimmed.substring(eqIdx + 1).replace(/['"]/g, '').trim();
            if (key === 'VITE_GOOGLE_API_KEY' || key === 'GEMINI_API_KEY') {
              return val;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to read env key:', err);
  }
  return null;
}

async function run() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('No API key found in .env.local');
    return;
  }
  console.log('Querying models using key starting with:', apiKey.substring(0, 10));
  
  try {
    // 1. Query standard models list
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    console.log('\n--- Generative Language API Models: ---');
    if (data.models) {
      console.log(data.models.map(m => m.name.replace('models/', '')));
    } else {
      console.log('Error listing models:', data);
    }
    
    // 2. Query OpenAI-compatible models list
    const openAiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    const openAiData = await openAiRes.json();
    console.log('\n--- OpenAI-compatible API Models: ---');
    if (openAiData.data) {
      console.log(openAiData.data.map(m => m.id));
    } else {
      console.log('Error listing OpenAI-compatible models:', openAiData);
    }
  } catch (error) {
    console.error('Error occurred:', error);
  }
}

run();
