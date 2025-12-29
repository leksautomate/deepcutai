# DeepCut AI - Faceless Video Generator

AI-powered faceless video generation tool that automates the creation of YouTube-style videos. Users provide a topic, and the system generates scripts, voiceovers, images, and assembles everything into a final video.

## Features

- **AI Script Generation** - Generate video scripts from any topic using Google Gemini
- **Text-to-Speech** - Professional voiceovers with Speechify TTS
- **AI Image Generation** - Create stunning visuals with Freepik AI (Seedream v4)
- **Video Rendering** - Automatic video assembly with FFmpeg
- **Background Processing** - Generate videos in the background while you work
- **Thumbnail Design** - AI-powered custom thumbnail generation
- **Multiple Styles** - Cinematic, Anime, Realistic, Illustration, and Abstract
- **Page Transitions** - Smooth animations between pages

## Tech Stack

- **Frontend**: React 18, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Video**: FFmpeg for rendering
- **AI Services**: Google Gemini, Speechify TTS, Freepik AI, Groq

## VPS System Requirements

### Minimum Specifications
| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 2 vCPUs | 4+ vCPUs |
| **RAM** | 4 GB | 8+ GB |
| **Storage** | 50 GB SSD | 100+ GB SSD |
| **OS** | Ubuntu 20.04+ | Ubuntu 22.04 LTS |
| **Bandwidth** | 1 TB/month | Unlimited |

### Why These Specs?
- **CPU**: Video rendering with FFmpeg is CPU-intensive. More cores = faster renders
- **RAM**: Image generation and video processing require memory. 4GB is minimum, 8GB recommended for concurrent renders
- **Storage**: Videos, images, and audio files accumulate. Plan for ~500MB per video project
- **SSD**: Essential for fast file I/O during video rendering

### Recommended VPS Providers
- **DigitalOcean**: $24/mo (4GB Droplet)
- **Vultr**: $24/mo (High Frequency 4GB)
- **Linode**: $24/mo (Linode 4GB)
- **Hetzner**: ~$10/mo (CPX21 - Best value in EU)

## Software Requirements

- Node.js 20+
- PostgreSQL 14+
- FFmpeg 5.0+ (with libx264, libfdk-aac)
- Nginx (for production reverse proxy)
- PM2 (process manager)
- Certbot (for SSL)

## API Keys Required

- **GEMINI_API_KEY** - Google AI Studio (free tier available)
- **SPEECHIFY_API_KEY** - Speechify TTS API
- **FREEPIK_API_KEY** - Freepik AI Image Generation
- **GROQ_API_KEY** - Groq LLM API (optional, for faster inference)

## Environment Variables

Create a `.env` file with:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/deepcut

# AI Services
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
SPEECHIFY_API_KEY=your_speechify_api_key
FREEPIK_API_KEY=your_freepik_api_key

# Session
SESSION_SECRET=your_random_secret_string
```

## Local Development

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app runs on `http://localhost:5000`

---

# VPS Deployment Guide

## Step 1: Server Setup

### Connect to your VPS
```bash
ssh root@your_server_ip
```

### Update system and install essentials
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install git curl build-essential -y
```

### Install Node.js (via NVM)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

### Install FFmpeg (required for video rendering)
```bash
sudo apt install ffmpeg -y
ffmpeg -version
```

### Install PostgreSQL
```bash
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create Database
```bash
sudo -u postgres psql
```

In PostgreSQL:
```sql
CREATE USER deepcut WITH PASSWORD 'your_secure_password';
CREATE DATABASE deepcut OWNER deepcut;
GRANT ALL PRIVILEGES ON DATABASE deepcut TO deepcut;
\q
```

## Step 2: Deploy Application

### Clone your repository
```bash
cd /var/www
git clone https://github.com/yourusername/deepcut-ai.git
cd deepcut-ai
```

### Install dependencies
```bash
npm install
```

### Create environment file
```bash
nano .env
```

Add your environment variables (see above).

### Build the application
```bash
npm run build
```

### Push database schema
```bash
npm run db:push
```

## Step 3: Install PM2

```bash
npm install pm2@latest -g
```

### Create PM2 ecosystem file
```bash
nano ecosystem.config.cjs
```

```javascript
module.exports = {
  apps: [{
    name: 'deepcut-ai',
    script: './dist/index.cjs',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/pm2/deepcut-error.log',
    out_file: '/var/log/pm2/deepcut-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false
  }]
};
```

### Create log directory
```bash
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2
```

### Start with PM2
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Copy and run the command PM2 outputs.

## Step 4: Setup Nginx

### Install Nginx
```bash
sudo apt install nginx -y
```

### Create Nginx config
```bash
sudo nano /etc/nginx/sites-available/deepcut
```

```nginx
server {
    listen 80;
    server_name your_domain.com;

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location /assets/ {
        alias /var/www/deepcut-ai/public/assets/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/deepcut /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Step 5: Setup Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Step 6: SSL Certificate (HTTPS)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your_domain.com
sudo certbot renew --dry-run
```

## Quick Update Script

Create `deploy.sh`:
```bash
#!/bin/bash
echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Pushing database changes..."
npm run db:push

echo "Restarting PM2..."
pm2 restart deepcut-ai

echo "Deployment complete!"
```

```bash
chmod +x deploy.sh
./deploy.sh
```

## PM2 Commands

```bash
pm2 list                    # Show all processes
pm2 logs deepcut-ai         # View logs
pm2 monit                   # Real-time monitoring
pm2 restart deepcut-ai      # Restart app
pm2 stop deepcut-ai         # Stop app
pm2 delete deepcut-ai       # Remove from PM2
```

## Troubleshooting

### Check logs
```bash
pm2 logs deepcut-ai --lines 100
sudo tail -f /var/log/nginx/error.log
```

### Check if app is running
```bash
pm2 list
curl http://localhost:5000
```

### Database connection issues
```bash
sudo systemctl status postgresql
psql -U deepcut -d deepcut -h localhost
```

### FFmpeg issues
```bash
ffmpeg -version
which ffmpeg
```

## License

MIT
# Deepcutai
# Deepcutai
