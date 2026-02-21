# DeepCut AI - Deployment Guide

## One-Click Deploy (Ubuntu/Debian VPS)

SSH into your server and run:

```bash
curl -fsSL https://raw.githubusercontent.com/leksautomate/deepcutai/main/install.sh | sudo bash
```

**Custom port:**

```bash
curl -fsSL https://raw.githubusercontent.com/leksautomate/deepcutai/main/install.sh | sudo bash -s -- --port 3000
```

Default port is `5000` if not specified.

### What gets installed automatically

| Component | Details |
|-----------|---------|
| **Node.js 20** | JavaScript runtime |
| **PostgreSQL** | Database (user: `deepcut`, auto-generated password) |
| **FFmpeg** | Video processing engine |
| **PM2** | Process manager with auto-restart |
| **UFW Firewall** | Opens SSH, HTTP (80), HTTPS (443), and your chosen port |

The script also:
- Clones the repository to `/var/www/deepcut-ai`
- Installs all npm dependencies
- Builds the production bundle
- Pushes the database schema
- Generates a secure session secret
- Creates the `.env` file
- Starts the app with PM2 and enables boot persistence

### After installation

1. Open `http://YOUR_SERVER_IP:PORT` in your browser
2. Create your admin account on the setup page
3. Go to Settings and add your API keys

---

## Choose Your Port

| Method | Command |
|--------|---------|
| Default (5000) | `curl -fsSL .../install.sh \| sudo bash` |
| Port 3000 | `curl -fsSL .../install.sh \| sudo bash -s -- --port 3000` |
| Port 8080 | `curl -fsSL .../install.sh \| sudo bash -s -- --port 8080` |
| Port 80 (HTTP) | `curl -fsSL .../install.sh \| sudo bash -s -- --port 80` |

To change the port after installation, edit `/var/www/deepcut-ai/.env`:

```bash
nano /var/www/deepcut-ai/.env
# Change PORT=5000 to your desired port
pm2 restart deepcut-ai
```

---

## Deploy to Render.com

Click the button below to deploy on Render with a free PostgreSQL database:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/leksautomate/deepcutai)

The `render.yaml` blueprint handles everything:
- Spins up a web service + PostgreSQL database
- Sets `DATABASE_URL` and `SESSION_SECRET` automatically
- Health check at `/api/setup/status`

After deploy, add your API keys in the Render dashboard environment variables:
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `SPEECHIFY_API_KEY`
- `INWORLD_API_KEY`
- `FREEPIK_API_KEY`
- `WAVESPEED_API_KEY`
- `RUNPOD_API_KEY`
- `POLLINATIONS_API_KEY` (optional, works without key)

---

## Manual Installation

For manual setup or non-Debian systems.

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- FFmpeg 5+
- Git

### Step 1: Clone and install

```bash
git clone https://github.com/leksautomate/deepcutai.git /var/www/deepcut-ai
cd /var/www/deepcut-ai
npm install
```

### Step 2: Set up PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE USER deepcut WITH PASSWORD 'your_secure_password';
CREATE DATABASE deepcut OWNER deepcut;
\q
```

### Step 3: Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://deepcut:your_secure_password@localhost:5432/deepcut
SESSION_SECRET=your_64_char_random_string
COOKIE_SECURE=false
```

Generate a session secret:

```bash
openssl rand -hex 32
```

### Step 4: Build and start

```bash
npm run build
npm run db:push
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## Updating

SSH into your server and run:

```bash
cd /var/www/deepcut-ai
sudo ./update.sh
```

This pulls the latest code, reinstalls dependencies, rebuilds, migrates the database, and restarts PM2.

---

## Reverse Proxy (Nginx + SSL)

To serve on port 80/443 with SSL:

```bash
apt install nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/deepcut`:

```nginx
server {
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 500M;
    }
}
```

Enable and get SSL:

```bash
ln -s /etc/nginx/sites-available/deepcut /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d your-domain.com
```

After SSL is active, update `.env`:

```bash
COOKIE_SECURE=true
```

Then restart: `pm2 restart deepcut-ai`

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 2 vCPUs | 4+ vCPUs |
| **RAM** | 2 GB | 4+ GB |
| **Disk** | 5 GB | 20+ GB |
| **OS** | Ubuntu 20.04 / Debian 11 | Ubuntu 22.04 / Debian 12 |

---

## Useful Commands

```bash
# Application
pm2 status                    # Check app status
pm2 logs deepcut-ai           # View live logs
pm2 restart deepcut-ai        # Restart app
pm2 stop deepcut-ai           # Stop app

# Database
sudo -u postgres psql -d deepcut   # Connect to database
npm run db:push                     # Push schema changes

# Firewall
ufw status                    # Check firewall rules
ufw allow 3000/tcp            # Open a custom port

# Update
cd /var/www/deepcut-ai && sudo ./update.sh
```

---

## Troubleshooting

**App won't start:**
```bash
pm2 logs deepcut-ai --lines 50
```

**Database connection failed:**
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "\l"   # List databases
```

**Port already in use:**
```bash
lsof -i :5000                  # Find what's using the port
# Either kill the process or use a different port in .env
```

**FFmpeg not found:**
```bash
ffmpeg -version                # Check installation
apt install ffmpeg             # Install if missing
```

**Permission denied:**
```bash
chown -R root:root /var/www/deepcut-ai
```
