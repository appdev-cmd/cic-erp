import * as fs from 'fs';

try {
  const envConfig = fs.readFileSync('.env', 'utf-8');
  envConfig.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
      process.env[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
    }
  });
} catch (e) {
  console.log('No .env found');
}
