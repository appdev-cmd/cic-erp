import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

// ─── SECURITY: Block direct browser access to source files ──
// Prevents users from navigating to /components/Header.tsx etc.
// Vite's HMR still works because internal requests use /@fs/, /@vite/, /@id/ prefixes.
function sourceFileGuard(): Plugin {
  // File extensions that should NEVER be served directly to browsers
  const BLOCKED_EXTENSIONS = /\.(tsx?|jsx?|vue|svelte|env|md|sql|json|lock|log|local)$/i;
  // Paths that are always blocked
  const BLOCKED_PATHS = /^\/(\.env|\.git|\.agent|\.brain|GEMINI|RULES|plans|scripts|supabase|api|docs)\b/i;
  // Vite internal requests that must be allowed through
  const VITE_INTERNAL = /^\/(@vite|@fs|@id|__vite|node_modules\/\.vite|src\/)/;
  // Static assets that should always be served
  const STATIC_ASSETS = /\.(css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|webp|mp4|webm|pdf)$/i;

  return {
    name: 'source-file-guard',
    configureServer(server) {
      // This middleware runs BEFORE Vite's transform pipeline
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        const pathname = url.split('?')[0]; // Strip query params

        // ✅ Always allow: root, Vite internals, API routes, static assets, HMR websocket
        if (
          pathname === '/' ||
          pathname === '/index.html' ||
          VITE_INTERNAL.test(pathname) ||
          pathname.startsWith('/api/') ||
          STATIC_ASSETS.test(pathname) ||
          pathname.startsWith('/@') ||
          pathname === '/__vite_ping'
        ) {
          return next();
        }

        // ✅ Allow: Vite's module requests (have ?import, ?v=, ?t= query params for HMR)
        if (url.includes('?import') || url.includes('?v=') || url.includes('?t=')) {
          return next();
        }

        // 🛡️ Block: Direct access to sensitive paths
        if (BLOCKED_PATHS.test(pathname)) {
          console.warn(`[SECURITY] Blocked access to sensitive path: ${pathname}`);
          res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>403 — Forbidden</h1><p>Truy cập bị từ chối.</p>');
          return;
        }

        // 🛡️ Block: Direct browser navigation to source files
        // Check Sec-Fetch-Dest header: 'document' = browser navigation, 'script' = module import
        const fetchDest = req.headers['sec-fetch-dest'];
        if (BLOCKED_EXTENSIONS.test(pathname) && fetchDest === 'document') {
          console.warn(`[SECURITY] Blocked direct navigation to source file: ${pathname}`);
          // Redirect to app root instead of showing source
          res.writeHead(302, { Location: '/' });
          res.end();
          return;
        }

        next();
      });
    },
  };
}

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

// ─── Local Dev Proxy for /api/recruitment-email ────────────────
// Xử lý route gửi email locally vì Vite không có Vercel Serverless
function recruitmentEmailProxy(env: Record<string, string>): Plugin {
  return {
    name: 'recruitment-email-proxy',
    configureServer(server) {
      server.middlewares.use('/api/recruitment-email', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' });
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

        const { application_id, candidate_id, to, subject, html, attachments } = parsed;
        if (!to || !subject || !html) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Thiếu thông tin bắt buộc' }));
          return;
        }

        const resendKey = env.RESEND_API_KEY;
        const fromEmail = env.RECRUITMENT_FROM_EMAIL || 'thuongnth@cic.com.vn';

        if (!resendKey) {
          // Mock mode
          console.warn('[Vite Proxy] RESEND_API_KEY chưa cấu hình. Chạy mock mode.');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, mock: true, message: 'Mock mode: Email chưa thực sự gửi' }));
          return;
        }

        try {
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendKey}`
            },
            body: JSON.stringify({
              from: `"Phòng Tuyển Dụng - CIC" <${fromEmail}>`,
              to: Array.isArray(to) ? to : [to],
              subject: subject,
              html: html,
              ...(attachments && attachments.length > 0 ? { attachments } : {})
            })
          });

          if (!resendRes.ok) {
            const errText = await resendRes.text();
            res.writeHead(resendRes.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Resend API: ${resendRes.status} - ${errText.substring(0, 200)}` }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, mock: false, message: 'Đã gửi email' }));
        } catch (e: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message || 'Unknown error' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: Number(process.env.PORT) || 3000,
      host: '0.0.0.0', // Mở cho LAN nội bộ (văn phòng) — thay đổi từ 'localhost'
      proxy: {
        // Gemma vLLM — target từ env (máy chủ công ty) hoặc fallback localhost dev
        '/api/vllm_gemma': {
          target: env.VITE_VLLM_GEMMA_URL || 'http://localhost:8002',
          changeOrigin: true,
          secure: false,  // Cho phép self-signed cert trên máy chủ nội bộ
          headers: {
            'Authorization': `Bearer ${env.VITE_LITELLM_KEY || 'sk-cic-2026'}`
          },
          rewrite: (path) => path.replace(/^\/api\/vllm_gemma/, '/v1')
        },
        // LiteLLM / vLLM chung — target từ env hoặc fallback localhost dev
        '/api/vllm': {
          target: (env.VITE_VLLM_URL || 'http://localhost:4000') + '/v1',
          changeOrigin: true,
          secure: false,
          headers: {
            'Authorization': `Bearer ${env.VITE_LITELLM_KEY || 'sk-cic-2026'}`
          },
          rewrite: (path) => path.replace(/^\/api\/vllm/, '')
        },
        // Gemini API proxy — tránh CORS khi gọi từ browser
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com/v1beta/openai',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/gemini/, '')
        },
      },
      watch: {
        ignored: ['**/scripts/auto-train/venv/**'],
      },
      fs: {
        // SECURITY: Block access to sensitive files even via Vite's file server
        deny: [
          '.env',
          '.env.local',
          '.env.*',
          '.git/**',
          '.agent/**',
          '.brain/**',
          'GEMINI.md',
          'RULES.md',
          'PhanQuyenHeThong.md',
          'plans/**',
          'supabase/**',
          'scripts/**',
          'docs/**',
        ],
      },
    },
    plugins: [
      sourceFileGuard(), // MUST be first — blocks requests before Vite processes them
      react(),
      geminiExtractProxy(env),
      recruitmentEmailProxy(env),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'cic-logo.png'],
        manifest: {
          name: 'CIC ERP System',
          short_name: 'CIC ERP',
          description: 'Hệ thống quản lý hợp đồng thông minh CIC',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'favicon.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'cic-logo.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      }),
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
            'pdf': ['jspdf', 'jspdf-autotable', 'pdfjs-dist'],
            'ui-vendor': ['lucide-react', 'framer-motion', '@dnd-kit/core', '@dnd-kit/utilities'],
            'ai-vendor': ['@google/generative-ai', 'openai'],
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
