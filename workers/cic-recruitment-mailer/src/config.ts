import dotenv from 'dotenv';
dotenv.config();

export const config = {
  imap: {
    user: process.env.EMAIL_USER!,
    password: process.env.EMAIL_PASS!,
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT),
    tls: process.env.IMAP_TLS === 'true',
    authTimeout: 10000,
    tlsOptions: { rejectUnauthorized: false }
  },
  smtp: {
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASS!,
    }
  },
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ollama: {
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'qwen2.5:14b'
  }
};
