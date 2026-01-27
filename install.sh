#!/bin/bash

# DeepCut AI - Enhanced Installation Script
# GitHub: https://github.com/leksautomate/deepcutai

set -e

# ==========================================
# Helpers for Spinners and Colors
# ==========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Spinner logic
spin() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

print_status() { echo -e "\n${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==========================================
# System Checks
# ==========================================
check_requirements() {
    print_status "Checking system requirements..."
    
    # 1. Check OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
            print_error "Unsupported OS: $ID. Only Ubuntu/Debian are supported."
            exit 1
        fi
        print_success "OS Check: $ID $VERSION_ID"
    fi

    # 2. Check RAM (Min 2GB)
    TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_MEM" -lt 1800 ]; then
        print_warning "Low Memory: ${TOTAL_MEM}MB. 2GB+ recommended."
    else
        print_success "Memory Check: ${TOTAL_MEM}MB"
    fi

    # 3. Check Disk Space (Min 5GB free)
    FREE_DISK=$(df -m / | awk 'NR==2 {print $4}')
    if [ "$FREE_DISK" -lt 5000 ]; then
        print_error "Insufficient Disk Space: ${FREE_DISK}MB. 5GB required."
        exit 1
    else
        print_success "Disk Check: ${FREE_DISK}MB Free"
    fi
}

# ==========================================
# Error Handling & Rollback
# ==========================================
trap 'on_error' ERR

on_error() {
    local line_no=$1
    echo -e "\n${RED}[FAIL] Error occurred at line $line_no${NC}"
    echo "Attempting cleanup..."
    # perform any necessary cleanup here, e.g. stopping partial services
    pm2 delete deepcut-ai 2>/dev/null || true
    echo "Installation failed. Please review error messages above."
    exit 1
}

# ==========================================
# Main Installation
# ==========================================

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     DeepCut AI - Setup Assistant             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Check Root
if [ "$EUID" -eq 0 ]; then
     IS_ROOT=true
else
     print_error "This script must be run as root (use sudo)."
     exit 1
fi

check_requirements

# --- Step 1: System Updates ---
print_status "Updating system packages..."
{ sudo apt update && sudo apt upgrade -y; } &> /dev/null &
spin $!
print_success "System updated"

# --- Step 2: Dependencies ---
print_status "Installing core dependencies (git, curl, nodejs, ffmpeg, postgres)..."
DEPS="git curl build-essential nano wget ca-certificates gnupg ffmpeg postgresql postgresql-contrib"
{ sudo apt install -y $DEPS; } &> /dev/null &
spin $!

# Node.js 20 Setup
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 20 ]; then
    print_status "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - &> /dev/null
    sudo apt install -y nodejs &> /dev/null
fi
print_success "Dependencies installed"

# --- Step 3: Database Setup ---
print_status "Configuring PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

DB_PASSWORD=$(openssl rand -hex 16)
# Create DB user/db if needed (idempotent)
sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'deepcut') THEN CREATE ROLE deepcut WITH LOGIN PASSWORD '$DB_PASSWORD'; END IF; END \$\$;" &> /dev/null
sudo -u postgres psql -c "ALTER USER deepcut WITH PASSWORD '$DB_PASSWORD';" &> /dev/null
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'deepcut'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE deepcut OWNER deepcut;" &> /dev/null
print_success "Database configured"

# --- Step 4: Application Setup ---
APP_DIR="/var/www/deepcut-ai"
if [ -d "$APP_DIR" ]; then
    print_status "Updating existing installation at $APP_DIR..."
    cd "$APP_DIR"
    git pull origin main &> /dev/null || true
else
    print_status "Cloning repository..."
    sudo git clone https://github.com/leksautomate/deepcutai.git "$APP_DIR" &> /dev/null
fi

cd "$APP_DIR"
sudo chown -R $USER:$USER "$APP_DIR"

# npm install
print_status "Installing Node modules..."
npm install &> /dev/null &
spin $!
print_success "Node modules installed"

# --- Step 5: Configuration ---
SESSION_SECRET=$(openssl rand -hex 32)
# Prompt for port
echo -e "\n${YELLOW}Configuring Port...${NC}"
read -p "Enter port (default 5000): " APP_PORT
APP_PORT=${APP_PORT:-5000}

# Generate .env
cat > .env << EOF
NODE_ENV=production
PORT=${APP_PORT}
HOST=0.0.0.0
DATABASE_URL=postgresql://deepcut:${DB_PASSWORD}@localhost:5432/deepcut
SESSION_SECRET=${SESSION_SECRET}
COOKIE_SECURE=false
EOF
print_success "Environment configured"

# --- Step 6: Build & Deploy ---
print_status "Building application..."
npm run build &> /dev/null &
spin $!
print_success "Built successfully"

print_status "Syncing database schema..."
npm run db:push &> /dev/null
print_success "Database synced"

# PM2
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2 &> /dev/null
fi

# Create simple ecosystem file that reads .env
cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'deepcut-ai',
    script: './dist/index.cjs',
    env: {
       NODE_ENV: 'production',
       PORT: ${APP_PORT}
    }
  }]
};
EOF

# Start PM2
print_status "Starting application with PM2..."
# Load env vars for PM2 from .env file directly just in case or use dotent logic (simpler here to just rely on dotenv in app)
pm2 start ecosystem.config.cjs &> /dev/null
pm2 save &> /dev/null
pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true &> /dev/null
print_success "Application started"

# --- Step 7: Firewall & Nginx ---
print_status "Configuring Firewall..."
ufw allow ssh &> /dev/null
ufw allow ${APP_PORT}/tcp &> /dev/null
ufw allow 80/tcp &> /dev/null
ufw allow 443/tcp &> /dev/null
echo "y" | ufw enable &> /dev/null
print_success "Firewall active"

# --- Summary ---
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo -e "\n${GREEN}INSTALLATION COMPLETE! 🚀${NC}"
echo -e "URL: http://${SERVER_IP}:${APP_PORT}"
echo -e "Admin account will be created on first login."
echo -e "Logs: pm2 logs deepcut-ai"
