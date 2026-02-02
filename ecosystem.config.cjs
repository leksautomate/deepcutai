const fs = require('fs');
const path = require('path');

const APP_DIR = '/var/www/deepcut-ai';

function loadEnv() {
  const envPaths = [
    path.join(APP_DIR, '.env'),
    path.join(__dirname, '.env'),
  ];
  
  const env = {
    NODE_ENV: 'production',
    PORT: '5000',
    HOST: '0.0.0.0',
    COOKIE_SECURE: 'false',
  };

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      console.log(`[PM2] Loading environment from: ${envPath}`);
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex > 0) {
            const key = trimmed.substring(0, eqIndex).trim();
            const value = trimmed.substring(eqIndex + 1).trim();
            env[key] = value;
          }
        }
      });
      break;
    }
  }
  
  return env;
}

module.exports = {
  apps: [
    {
      name: 'deepcut-ai',
      script: './dist/index.cjs',
      cwd: '/var/www/deepcut-ai',
      instances: 1,
      exec_mode: 'fork',
      env: loadEnv(),
      error_file: '/var/log/pm2/deepcut-error.log',
      out_file: '/var/log/pm2/deepcut-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '1G',
      autorestart: true,
      watch: false
    }
  ]
};
