import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    // SECURITY: API Key Gemini đã được chuyển sang Supabase Edge Function (gemini-proxy).
    // VITE_GOOGLE_API_KEY chỉ dùng cho dev local fallback (không nên dùng trong production).
    // Không còn expose process.env.API_KEY hay process.env.GEMINI_API_KEY ra client.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
