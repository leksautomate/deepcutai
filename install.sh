#!/bin/bash

# DeepCut AI - One-Time Installation Script for Ubuntu/Debian
# GitHub: https://github.com/leksautomate/deepcutai
# 
# Usage: curl -fsSL https://raw.githubusercontent.com/leksautomate/deepcutai/main/install.sh | bash
# Or: chmod +x install.sh && ./install.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     DeepCut AI - Installation Script         ║${NC}"
echo -e "${GREEN}║     AI-Powered Video Generation              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Will create app user later."
    IS_ROOT=true
else
    IS_ROOT=false
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    print_status "Detected OS: $OS $VERSION_ID"
else
    print_error "Cannot detect OS. This script requires Ubuntu or Debian."
    exit 1
fi

if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
    print_error "This script only supports Ubuntu and Debian."
    exit 1
fi

# ==========================================
# Step 1: Update system
# ==========================================
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y
print_success "System updated"

# ==========================================
# Step 2: Install essential packages
# ==========================================
print_status "Installing essential packages..."
sudo apt install -y git curl build-essential nano wget ca-certificates gnupg
print_success "Essential packages installed"

# ==========================================
# Step 3: Install Node.js 20 via NodeSource
# ==========================================
print_status "Installing Node.js 20..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        print_success "Node.js $(node -v) already installed"
    else
        print_warning "Node.js version too old, upgrading..."
        sudo apt remove -y nodejs
    fi
fi

if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    print_success "Node.js $(node -v) installed"
fi

# ==========================================
# Step 4: Install FFmpeg
# ==========================================
print_status "Installing FFmpeg..."
if command -v ffmpeg &> /dev/null; then
    print_success "FFmpeg already installed: $(ffmpeg -version | head -n1)"
else
    sudo apt install -y ffmpeg
    print_success "FFmpeg installed"
fi

# ==========================================
# Step 5: Install PostgreSQL
# ==========================================
print_status "Installing PostgreSQL..."
if command -v psql &> /dev/null; then
    print_success "PostgreSQL already installed"
else
    sudo apt install -y postgresql postgresql-contrib
fi
sudo systemctl start postgresql
sudo systemctl enable postgresql
print_success "PostgreSQL is running"

# ==========================================
# Step 6: Create database
# ==========================================
print_status "Setting up database..."

# Generate random password for database
DB_PASSWORD=$(openssl rand -hex 16)

# Check if user exists
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='deepcut'" | grep -q 1; then
    print_warning "Database user 'deepcut' already exists"
else
    sudo -u postgres psql -c "CREATE USER deepcut WITH PASSWORD '$DB_PASSWORD';"
    print_success "Database user created"
fi

# Check if database exists
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw deepcut; then
    print_warning "Database 'deepcut' already exists"
else
    sudo -u postgres psql -c "CREATE DATABASE deepcut OWNER deepcut;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE deepcut TO deepcut;"
    print_success "Database created"
fi

# ==========================================
# Step 7: Clone repository
# ==========================================
APP_DIR="/var/www/deepcut-ai"
print_status "Setting up application directory..."

if [ ! -d "/var/www" ]; then
    sudo mkdir -p /var/www
fi

if [ -d "$APP_DIR" ]; then
    print_warning "Directory $APP_DIR already exists"
    read -p "Do you want to remove it and reinstall? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo rm -rf "$APP_DIR"
    else
        print_status "Keeping existing installation. Updating instead..."
        cd "$APP_DIR"
        git pull origin main || true
    fi
fi

if [ ! -d "$APP_DIR" ]; then
    print_status "Cloning repository..."
    sudo git clone https://github.com/leksautomate/deepcutai.git "$APP_DIR"
fi

cd "$APP_DIR"
sudo chown -R $USER:$USER "$APP_DIR"
print_success "Repository cloned to $APP_DIR"

# ==========================================
# Step 8: Install npm dependencies
# ==========================================
print_status "Installing npm dependencies (this may take a few minutes)..."
npm install
print_success "Dependencies installed"

# ==========================================
# Step 9: Create environment file
# ==========================================
print_status "Creating environment configuration..."

SESSION_SECRET=$(openssl rand -hex 32)

# Get admin credentials
echo ""
echo -e "${YELLOW}=== Admin Account Setup ===${NC}"
echo "These credentials will be used to log into the web interface."
echo ""

read -p "Enter admin username [admin]: " ADMIN_USERNAME
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}

while true; do
    read -s -p "Enter admin password (min 8 characters): " ADMIN_PASSWORD
    echo
    if [ ${#ADMIN_PASSWORD} -ge 8 ]; then
        break
    else
        print_error "Password must be at least 8 characters"
    fi
done

# Create .env file
cat > "$APP_DIR/.env" << EOF
# DeepCut AI Environment Configuration
# Generated by install.sh on $(date)

# ===========================================
# DATABASE (auto-generated)
# ===========================================
DATABASE_URL=postgresql://deepcut:${DB_PASSWORD}@localhost:5432/deepcut

# ===========================================
# AUTHENTICATION (required)
# ===========================================
SESSION_SECRET=${SESSION_SECRET}
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# ===========================================
# COOKIE SETTINGS
# ===========================================
# Set to 'false' if not using HTTPS (not recommended for production)
# COOKIE_SECURE=true  # Uncomment to enable secure cookies (requires HTTPS)

# ===========================================
# API KEYS (optional - configure via Settings page after login)
# ===========================================
GEMINI_API_KEY=
GROQ_API_KEY=
SPEECHIFY_API_KEY=
INWORLD_API_KEY=
FREEPIK_API_KEY=
WAVESPEED_API_KEY=
RUNPOD_API_KEY=
EOF

chmod 600 "$APP_DIR/.env"
print_success "Environment file created"

# ==========================================
# Step 10: Build application
# ==========================================
print_status "Building application..."
npm run build

# Copy table.sql for connect-pg-simple session store
if [ -f "$APP_DIR/node_modules/connect-pg-simple/table.sql" ]; then
    cp "$APP_DIR/node_modules/connect-pg-simple/table.sql" "$APP_DIR/dist/table.sql"
    print_success "Session table SQL copied"
fi

print_success "Build complete"

# ==========================================
# Step 11: Push database schema
# ==========================================
print_status "Setting up database schema..."
npm run db:push
print_success "Database schema created"

# ==========================================
# Step 12: Install PM2
# ==========================================
print_status "Installing PM2 process manager..."
sudo npm install -g pm2
print_success "PM2 installed"

# Ask about auto-loading environment variables
echo ""
echo -e "${YELLOW}=== PM2 Environment Configuration ===${NC}"
echo ""
echo "PM2 needs environment variables (DATABASE_URL, admin credentials, API keys, etc.)"
echo ""
echo "Options:"
echo "  [Y] AUTO-LOAD from .env file (recommended - keeps secrets in one place)"
echo "  [N] MANUAL mode (you must export variables before starting PM2)"
echo ""
read -p "Enable auto-load environment variables from .env? [Y/n]: " AUTO_LOAD_ENV

AUTO_LOAD_ENV=${AUTO_LOAD_ENV:-Y}

if [[ "$AUTO_LOAD_ENV" =~ ^[Yy]$ ]]; then
    print_status "Creating PM2 config with auto-load from .env..."
    
    # Create PM2 ecosystem file that loads .env
    cat > "$APP_DIR/ecosystem.config.cjs" << 'PMEOF'
const fs = require('fs');
const path = require('path');

// Load .env file and parse into object
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {
    NODE_ENV: 'production',
    PORT: 5000
  };
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
  return env;
}

module.exports = {
  apps: [{
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
  }]
};
PMEOF
    print_success "Auto-load enabled - PM2 will read from .env file"
else
    print_status "Creating PM2 config without auto-load..."
    
    # Create basic PM2 ecosystem file (manual mode)
    cat > "$APP_DIR/ecosystem.config.cjs" << 'PMEOF'
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
PMEOF
    print_warning "Manual mode - You must source .env before starting PM2:"
    echo ""
    echo "  cd $APP_DIR"
    echo "  export \$(cat .env | grep -v '^#' | xargs)"
    echo "  pm2 start ecosystem.config.cjs"
    echo ""
fi

# Create log directory
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
print_success "PM2 configured and started"

# ==========================================
# Step 13: Install and configure Nginx
# ==========================================
print_status "Installing Nginx..."
sudo apt install -y nginx
sudo systemctl enable nginx

# Get domain/IP
echo ""
echo -e "${YELLOW}=== Domain Configuration ===${NC}"
read -p "Enter your domain name (or leave blank to use server IP): " DOMAIN_NAME

if [ -z "$DOMAIN_NAME" ]; then
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
    DOMAIN_NAME=$SERVER_IP
    print_status "Using IP address: $SERVER_IP"
fi

# Create Nginx config
sudo tee /etc/nginx/sites-available/deepcut > /dev/null << EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};

    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/deepcut /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
print_success "Nginx configured"

# ==========================================
# Step 14: Configure firewall
# ==========================================
print_status "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable || true
print_success "Firewall configured"

# ==========================================
# Step 15: Setup PM2 startup
# ==========================================
print_status "Configuring PM2 startup..."
pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true
pm2 save
print_success "PM2 startup configured"

# ==========================================
# Installation Complete!
# ==========================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            INSTALLATION COMPLETE!                            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Application URL:${NC} http://${DOMAIN_NAME}"
echo -e "${BLUE}Admin Username:${NC} ${ADMIN_USERNAME}"
echo -e "${BLUE}Admin Password:${NC} (the password you entered)"
echo ""
echo -e "${YELLOW}IMPORTANT: For login to work properly, you need HTTPS!${NC}"
echo ""
echo -e "${BLUE}To setup SSL (recommended):${NC}"
echo "  sudo apt install certbot python3-certbot-nginx -y"
echo "  sudo certbot --nginx -d ${DOMAIN_NAME}"
echo ""
echo -e "${BLUE}If you set up HTTPS/SSL, add this to .env:${NC}"
echo "  COOKIE_SECURE=true"
echo "  Then restart: pm2 restart deepcut-ai"
echo ""
echo -e "${BLUE}Configure API keys:${NC}"
echo "  1. Open https://${DOMAIN_NAME} in your browser"
echo "  2. Log in with your admin credentials"
echo "  3. Click Settings (gear icon) -> Configure Keys"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  pm2 logs deepcut-ai     # View logs"
echo "  pm2 restart deepcut-ai  # Restart app"
echo "  pm2 status              # Check status"
echo ""
echo -e "${BLUE}Application directory:${NC} $APP_DIR"
echo -e "${BLUE}Environment file:${NC} $APP_DIR/.env"
echo ""
print_success "DeepCut AI is now running!"
