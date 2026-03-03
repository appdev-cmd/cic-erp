import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// ─── Local Dev Proxy for /api/gemini-extract ────────────────
// Khi chạy `npm run dev`, Vite không có serverless functions.
// Plugin này xử lý /api/gemini-extract locally bằng GEMINI_API_KEY từ env.
function geminiExtractProxy(env: Record<string, string>): Plugin {
  return {
    name: 'gemini-extract-proxy',
    configureServer(server) {
      server.middlewares.use('/api/gemini-extract', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' });
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        // Read request body
        let body = '';
        for await (const chunk of req) body += chunk;
        let parsed: any;
        try { parsed = JSON.parse(body); } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }

        const apiKey = env.GEMINI_API_KEY || env.VITE_GOOGLE_API_KEY;
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'GEMINI_API_KEY chưa được cấu hình. Thêm vào file .env.local' }));
          return;
        }

        const { parts, maxTokens = 8192, temperature = 0.1, model = 'gemini-2.0-flash' } = parsed;

        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { temperature, maxOutputTokens: maxTokens },
              }),
            }
          );

          if (!geminiRes.ok) {
            const errText = await geminiRes.text();
            res.writeHead(geminiRes.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Gemini API: ${geminiRes.status} - ${errText.substring(0, 200)}` }));
            return;
          }

          const json = await geminiRes.json();
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ text }));
        } catch (e: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message || 'Internal Server Error' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      geminiExtractProxy(env),
    ],
    // SECURITY: API Key Gemini chạy qua Vercel Serverless Function (/api/gemini-extract).
    // Local dev dùng Vite plugin proxy ở trên → key không bao giờ lộ ra client bundle.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Heavy libs — lazy-loaded only when needed
            'xlsx': ['xlsx'],
            'recharts': ['recharts'],
            // Supabase SDK
            'supabase': ['@supabase/supabase-js'],
            // React core
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          }
        }
      }
    }
  };
});
