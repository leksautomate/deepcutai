# DeepCut AI - Faceless Video Generator

[![GitHub](https://img.shields.io/badge/GitHub-leksautomate%2Fdeepcut--ai-blue)](https://github.com/leksautomate/deepcutai)

AI-powered faceless video generation tool that automates the creation of YouTube-style videos. Users provide a topic, and the system generates scripts, voiceovers, images, and assembles everything into a final video.

**GitHub Repository:** https://github.com/leksautomate/deepcutai

---

## 🚀 One-Click Install (Ubuntu/Debian)

Copy and paste this single command:

```bash
curl -fsSL https://raw.githubusercontent.com/leksautomate/deepcutai/main/install.sh | sudo bash
```

That's it! The script automatically:
- Installs Node.js 20, PostgreSQL, FFmpeg, PM2
- Creates the database
- Builds and starts the app on port 5000

After installation:
1. Open `http://YOUR_SERVER_IP:5000`
2. Create your admin account
3. Add API keys in Settings

---

## 📚 Documentation
- [**Development Guide**](docs/development.md) - Setup, structure, and workflow
- [**API Documentation**](docs/api.md) - Endpoints and integration
- [**Architecture**](docs/architecture.md) - System design and diagrams

---

## 🏗️ Architecture

```mermaid
graph TB
    Client["Frontend (React)"] --> API["Backend API (Express)"]
    API --> Controllers["Controllers"]
    Controllers --> Services["Services"]
    Services --> DB[(PostgreSQL)]
    Services --> AI["AI Providers (Gemini/Groq/TTS/Image)"]
    Services --> Queue["Job Queue"]
    Queue --> Engine["FFmpeg Engine"]
    Engine --> Storage["File Storage"]
```

---

## Features

- **AI Script Generation** - Generate video scripts from any topic using Google Gemini or Groq
- **Multi-Provider TTS** - Choose between Speechify (6 voices) or Inworld TTS (12 voices)
- **Long Text-to-Speech** - Dedicated tool for generating audio from long-form text
- **Multi-Provider Image Generation** - Seedream/Freepik, WaveSpeed, RunPod, Pollinations, or Whisk (Google IMAGEN 3.5)
- **Standalone Image Generator** - Generate images without creating a video project
- **One-Time Registration** - Secure first-time setup without hardcoded credentials
- **Video Rendering** - Automatic video assembly with FFmpeg
- **Background Processing** - Generate videos in the background while you work
- **Cascading Settings** - Global defaults with per-project overrides
- **Premium UI/UX** - Glassmorphism design, mesh gradients, and smooth page transitions
- **Sidebar Navigation** - Collapsible sidebar with premium aesthetics
- **Danger Zone** - One-click cleanup to wipe all generated assets
- **Thumbnail Design** - AI-powered custom thumbnail generation
- **Multiple Styles** - Cinematic, Anime, Realistic, Illustration, Custom, and Abstract
- **Custom Voices** - Add your own voice IDs for any TTS provider
- **Form Validation** - Smart inputs with script length guidance and numeric safeguards

## Tech Stack

- **Frontend**: React 18, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Video**: FFmpeg for rendering
- **AI Services**: Google Gemini, Groq, Speechify TTS, Inworld TTS, Freepik/Seedream, WaveSpeed, RunPod, Pollinations, Whisk (Google IMAGEN 3.5)

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

## API Keys (Optional During Installation)

All API keys can be configured AFTER installation through the Settings page. You don't need them to install!

| Provider | Required For | Get Key From |
|----------|--------------|--------------|
| **Gemini** | Script generation | [Google AI Studio](https://makersuite.google.com/app/apikey) (free) |
| **Groq** | Script/Image prompts | [Groq](https://console.groq.com) (free) |
| **Speechify** | TTS (Option 1) | [Speechify API](https://speechify.com/api) |
| **Inworld** | TTS (Option 2) | [Inworld AI](https://inworld.ai) |
| **Freepik** | Images (Seedream) | [Freepik API](https://www.freepik.com/api) |
| **WaveSpeed** | Images | [WaveSpeed](https://wavespeed.ai) |
| **RunPod** | Images | [RunPod](https://runpod.io) |
| **Pollinations** | Images | [Pollinations](https://pollinations.ai) (free, optional key) |
| **Whisk** | Images (IMAGEN 3.5) | Uses Google cookie (JSON format from browser) |

## Environment Variables

Create a `.env` file with ALL of these variables:

```env
# ===========================================
# REQUIRED - App won't work without these
# ===========================================

# Database Connection
DATABASE_URL=postgresql://deepcut:your_password@localhost:5432/deepcut

# Authentication
SESSION_SECRET=generate_a_random_64_character_string_here
# Note: Admin credentials are no longer needed here!
# Create your admin account through the web interface on first visit.

# ===========================================
# AI SERVICES - Set via UI or Environment
# ===========================================
# You can set these here OR through the Settings page after logging in
# If set here, they work immediately without UI configuration

GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# TTS Providers (choose one or both)
SPEECHIFY_API_KEY=your_speechify_api_key
INWORLD_API_KEY=your_inworld_api_key

# Image Generators (choose one or more)
FREEPIK_API_KEY=your_freepik_api_key
WAVESPEED_API_KEY=your_wavespeed_api_key
RUNPOD_API_KEY=your_runpod_api_key
POLLINATIONS_API_KEY=your_pollinations_api_key  # Optional - works without key
```

### Generate a Session Secret
```bash
# Run this command to generate a secure session secret:
openssl rand -hex 32
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

# VPS Deployment Guide (Ubuntu/Debian)

> **Note**: HTTPS is recommended for production. If using HTTPS, set `COOKIE_SECURE=true` in your .env file.
> The app works with HTTP by default for easier testing.

## Quick Start Checklist
1. [ ] Install Node.js 20+, PostgreSQL, FFmpeg
2. [ ] Create PostgreSQL database
3. [ ] Clone repository and install dependencies
4. [ ] Create `.env` file with ALL required variables
5. [ ] Build and push database schema
6. [ ] Setup PM2 process manager
7. [ ] Configure Nginx reverse proxy
8. [ ] **Install SSL certificate (REQUIRED for login!)**
9. [ ] Test login and API key configuration

---

## Step 1: Server Setup

### Connect to your VPS
```bash
ssh root@your_server_ip
```

### Update system and install essentials
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install git curl build-essential nano -y
```

### Install Node.js 20 (via NVM)
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node --version  # Should show v20.x.x
```

### Install FFmpeg (REQUIRED for video rendering)
```bash
sudo apt install ffmpeg -y
ffmpeg -version  # Verify installation
```

### Install PostgreSQL
```bash
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl status postgresql  # Should show "active (running)"
```

---

## Step 2: Create Database

```bash
sudo -u postgres psql
```

Run these SQL commands (replace `your_secure_password` with a strong password):
```sql
CREATE USER deepcut WITH PASSWORD 'your_secure_password';
CREATE DATABASE deepcut OWNER deepcut;
GRANT ALL PRIVILEGES ON DATABASE deepcut TO deepcut;
\q
```

Test the connection:
```bash
psql -U deepcut -d deepcut -h localhost
# Enter your password when prompted
# Type \q to exit
```

---

## Step 3: Deploy Application

### Create app directory and clone
```bash
sudo mkdir -p /var/www
cd /var/www
git clone https://github.com/leksautomate/deepcutai.git deepcut-ai
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

**PASTE THIS AND REPLACE ALL VALUES:**
```env
# Database - use the password you created above
DATABASE_URL=postgresql://deepcut:your_secure_password@localhost:5432/deepcut

# Authentication
SESSION_SECRET=REPLACE_WITH_OUTPUT_OF_openssl_rand_hex_32
# Note: No admin credentials needed! Create your account on first visit.

# AI Services - add your keys here OR configure in Settings after login
GEMINI_API_KEY=
GROQ_API_KEY=
SPEECHIFY_API_KEY=
INWORLD_API_KEY=
FREEPIK_API_KEY=
WAVESPEED_API_KEY=
RUNPOD_API_KEY=
POLLINATIONS_API_KEY=
```

Generate a session secret:
```bash
openssl rand -hex 32
# Copy the output and paste it as SESSION_SECRET value
```

Save and exit: `Ctrl+X`, then `Y`, then `Enter`

### Build the application
```bash
npm run build
```

### Push database schema
```bash
npm run db:push
```

### Test if it runs
```bash
npm start
# Should see: "serving on port 5000"
# Press Ctrl+C to stop
```

---

## Step 4: Setup PM2 (Process Manager)

PM2 keeps your app running 24/7 and restarts it if it crashes.

```bash
npm install pm2@latest -g
```

### Create PM2 ecosystem file
```bash
nano ecosystem.config.cjs
```

Paste this content:
```javascript
module.exports = {
  apps: [{
    name: 'deepcut-ai',
    script: './dist/index.cjs',
    cwd: '/var/www/deepcut-ai',
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

Save and exit: `Ctrl+X`, `Y`, `Enter`

### Create log directory and start PM2
```bash
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

**IMPORTANT**: PM2 will output a command starting with `sudo env PATH=...`. Copy and run that exact command!

### Verify PM2 is running
```bash
pm2 list
# Should show deepcut-ai with status "online"

pm2 logs deepcut-ai --lines 20
# Should show server started messages
```

---

## Step 5: Setup Nginx (Reverse Proxy)

Nginx handles HTTPS and forwards requests to your Node.js app.

### Install Nginx
```bash
sudo apt install nginx -y
```

### Create Nginx config
```bash
sudo nano /etc/nginx/sites-available/deepcut
```

**Replace `your_domain.com` with your actual domain:**
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

Save and exit: `Ctrl+X`, `Y`, `Enter`

### Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/deepcut /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
sudo nginx -t  # Test config - should say "syntax is ok"
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Step 6: Setup Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status  # Should show rules active
```

---

## Step 7: SSL Certificate (HTTPS) - REQUIRED FOR LOGIN!

> **This step is CRITICAL!** Without SSL, login won't work because session cookies require HTTPS.

### Point your domain to your server first
Before this step, make sure your domain's DNS A record points to your server's IP address.

### Install Certbot and get certificate
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your_domain.com
```

Follow the prompts:
- Enter your email
- Agree to terms
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

### Verify SSL works
```bash
sudo certbot renew --dry-run
```

### Test in browser
Open `https://your_domain.com` - you should see the login page with a padlock icon.

---

## Step 8: First-Time Setup and Login

### Create Your Admin Account (First Visit Only)
1. Open `https://your_domain.com` in your browser
2. You'll see the **Setup** page (only appears on first visit)
3. Create your admin account:
   - Choose a username (min 3 characters)
   - Enter your email
   - Create a password (min 8 characters)
4. Click "Create Admin Account"
5. You'll be redirected to the login page

### Login
1. Enter your username and password
2. Click Login

### Configure API Keys (after logging in)
1. Click the Settings icon (gear) in the sidebar
2. Click "Configure Keys" button
3. Enter your API keys:
   - **Gemini** - Required for script generation
   - **Inworld** - For Inworld TTS (if using)
   - **WaveSpeed** - For WaveSpeed image generation (if using)
   - **Speechify** - For Speechify TTS (if using)
   - **Freepik** - For Seedream image generation (if using)
4. Click "Save API Keys"

---

## Quick Update Script

Create this script to easily update your deployment:

```bash
nano deploy.sh
```

```bash
#!/bin/bash
echo "=== DeepCut AI Deployment ==="
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

echo "=== Deployment complete! ==="
pm2 logs deepcut-ai --lines 5
```

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## PM2 Commands Reference

```bash
pm2 list                    # Show all processes
pm2 logs deepcut-ai         # View live logs
pm2 logs deepcut-ai --lines 100  # View last 100 log lines
pm2 monit                   # Real-time monitoring dashboard
pm2 restart deepcut-ai      # Restart app
pm2 stop deepcut-ai         # Stop app
pm2 delete deepcut-ai       # Remove from PM2
```

---

## 🔧 Troubleshooting

```mermaid
graph TD
    Start[Issue Encountered] --> Login{Can't Login?}
    Login -->|Yes| SSL{SSL Configured?}
    SSL -->|No| FixSSL[Install Certbot/SSL]
    SSL -->|Yes| Env{Env Vars Set?}
    Env -->|No| FixEnv[Check SESSION_SECRET & DB_URL]
    
    Login -->|No| Gen{Generation Failed?}
    Gen -->|Yes| Keys{API Keys Set?}
    Keys -->|No| SetKeys[Configure Keys in Settings]
    Keys -->|Yes| Logs[Check PM2 Logs]
    
    Gen -->|No| StartErr{App Won't Start?}
    StartErr -->|Yes| DB{DB Running?}
    DB -->|No| StartDB[Start PostgreSQL]
    DB -->|Yes| CheckLogs[Check 'pm2 logs']
```

### Common Resolutions

### 401 Unauthorized when saving API keys

**Cause**: You're not logged in, OR SSL is not configured.

**Fix**:
1. Make sure you're accessing via `https://` (not `http://`)
2. Make sure SSL certificate is installed (Step 7)
3. Log in first, then try saving API keys
4. Check if cookies are enabled in your browser
5. Try in incognito/private mode

### Can't log in

**Check these in order:**

1. **SSL is working?**
   ```bash
   curl -I https://your_domain.com
   # Should return 200 OK
   ```

2. **Environment variables are set?**
   ```bash
   cat /var/www/deepcut-ai/.env | grep -E "(SESSION_SECRET|ADMIN)"
   # Should show your variables
   ```

3. **App is running?**
   ```bash
   pm2 list
   # Should show deepcut-ai as "online"
   ```

4. **Database is running?**
   ```bash
   sudo systemctl status postgresql
   ```

5. **Check app logs for errors:**
   ```bash
   pm2 logs deepcut-ai --lines 50
   ```

### Login page loads but login fails

1. Make sure you've created an admin account first (visit the setup page on first run)

2. Check if setup was completed:
   ```bash
   pm2 logs deepcut-ai --lines 100 | grep -E "(SETUP|AUTH)"
   # Should show "Admin account created" message
   ```

3. Restart PM2 after changing .env:
   ```bash
   pm2 restart deepcut-ai
   ```

### Database password authentication failed

If you see `password authentication failed for user "deepcut"`:

```bash
# Get the password from your .env file and update PostgreSQL
cd /var/www/deepcut-ai
DB_PASSWORD=$(grep DATABASE_URL .env | sed 's/.*:\/\/deepcut:\([^@]*\)@.*/\1/')
sudo -u postgres psql -c "ALTER USER deepcut WITH PASSWORD '$DB_PASSWORD';"
pm2 restart deepcut-ai
```

### Check all logs
```bash
pm2 logs deepcut-ai --lines 100
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Check if app is running locally
```bash
pm2 list
curl http://localhost:5000
# Should return HTML
```

### Database connection issues
```bash
sudo systemctl status postgresql
psql -U deepcut -d deepcut -h localhost
# Should connect (enter password when prompted)
```

### FFmpeg issues
```bash
ffmpeg -version
which ffmpeg
# Should show version and path
```

### Nginx issues
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Random string for session encryption |
| `GEMINI_API_KEY` | No* | For script generation |
| `GROQ_API_KEY` | No* | For script generation fallback |
| `SPEECHIFY_API_KEY` | No* | For Speechify TTS |
| `INWORLD_API_KEY` | No* | For Inworld TTS |
| `FREEPIK_API_KEY` | No* | For Seedream/Freepik images |
| `WAVESPEED_API_KEY` | No* | For WaveSpeed images |
| `RUNPOD_API_KEY` | No* | For RunPod images |
| `POLLINATIONS_API_KEY` | No | For Pollinations images (works without key) |
| `COOKIE_SECURE` | No | Set to `true` to enable secure cookies (requires HTTPS) |

*Can be set via Settings page after login instead of environment variables.

**Note:** Admin credentials are no longer set via environment variables. Create your admin account through the web interface on first visit.

### Enabling HTTPS/SSL

If you set up HTTPS (recommended for production), add this to your .env file:
```
COOKIE_SECURE=true
```
Then restart: `pm2 restart deepcut-ai`

---

## Pollinations Image Models

When using Pollinations as your image generator, you can choose from 10 AI models:

| Model | Description |
|-------|-------------|
| `flux` | Default high-quality model |
| `zimage` | Fast image generation |
| `turbo` | Quick results |
| `gptimage` | GPT-powered images |
| `gptimage-large` | Higher resolution GPT images |
| `kontext` | Context-aware generation |
| `seedream` | Dreamlike imagery |
| `seedream-pro` | Enhanced dreamlike imagery |
| `nanobanana` | Artistic style |
| `nanobanana-pro` | Enhanced artistic style |

**Note:** Pollinations works without an API key, but adding one provides higher rate limits.

---

## License

MIT
