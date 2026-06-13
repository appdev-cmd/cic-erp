import * as fs from 'fs';

function loadEnvFile(path: string) {
  try {
    const envConfig = fs.readFileSync(path, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...values] = trimmed.split('=');
      if (key && values.length > 0) {
        process.env[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
      }
    });
  } catch (e) {
    // Silent ignore if file not found
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');
