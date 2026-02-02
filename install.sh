#!/bin/bash

# DeepCut AI - One-Click Installation Script
# GitHub: https://github.com/leksautomate/deepcutai
# Usage: curl -fsSL https://raw.githubusercontent.com/leksautomate/deepcutai/main/install.sh | sudo bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "\n${BLUE}[*]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

cleanup_on_error() {
    echo -e "\n${RED}Installation failed!${NC}"
    pm2 delete deepcut-ai 2>/dev/null || true
    exit 1
}

trap cleanup_on_error ERR

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       DeepCut AI - One-Click Installer       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root: sudo bash install.sh"
    exit 1
fi

if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
        print_error "Only Ubuntu/Debian supported. Detected: $ID"
        exit 1
    fi
    print_success "OS: $ID $VERSION_ID"
fi

TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM" -lt 1800 ]; then
    print_warning "Low memory: ${TOTAL_MEM}MB (2GB+ recommended)"
else
    print_success "Memory: ${TOTAL_MEM}MB"
fi

FREE_DISK=$(df -m / | awk 'NR==2 {print $4}')
if [ "$FREE_DISK" -lt 5000 ]; then
    print_error "Need 5GB+ free disk space. Available: ${FREE_DISK}MB"
    exit 1
fi
print_success "Disk: ${FREE_DISK}MB free"

print_status "Updating system..."
apt update -qq && apt upgrade -y -qq

print_status "Installing dependencies..."
apt install -y -qq git curl build-essential nano wget ca-certificates gnupg ffmpeg postgresql postgresql-contrib

if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 20 ]; then
    print_status "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt install -y -qq nodejs
fi
print_success "Node.js $(node -v) installed"

print_status "Configuring PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

DB_PASSWORD=$(openssl rand -hex 16)
sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'deepcut') THEN CREATE ROLE deepcut WITH LOGIN PASSWORD '$DB_PASSWORD'; END IF; END \$\$;" > /dev/null 2>&1
sudo -u postgres psql -c "ALTER USER deepcut WITH PASSWORD '$DB_PASSWORD';" > /dev/null 2>&1
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'deepcut'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE deepcut OWNER deepcut;" > /dev/null 2>&1
print_success "Database configured"

APP_DIR="/var/www/deepcut-ai"
if [ -d "$APP_DIR" ]; then
    print_status "Updating existing installation..."
    cd "$APP_DIR"
    git pull origin main > /dev/null 2>&1 || true
else
    print_status "Cloning repository..."
    git clone https://github.com/leksautomate/deepcutai.git "$APP_DIR" > /dev/null 2>&1
fi

cd "$APP_DIR"

print_status "Installing Node modules..."
npm install --silent > /dev/null 2>&1
print_success "Dependencies installed"

SESSION_SECRET=$(openssl rand -hex 32)
APP_PORT=5000

cat > .env << EOF
NODE_ENV=production
PORT=${APP_PORT}
HOST=0.0.0.0
DATABASE_URL=postgresql://deepcut:${DB_PASSWORD}@localhost:5432/deepcut
SESSION_SECRET=${SESSION_SECRET}
COOKIE_SECURE=false
EOF
print_success "Environment configured"

print_status "Building application..."
npm run build > /dev/null 2>&1
print_success "Build complete"

print_status "Syncing database..."
npm run db:push > /dev/null 2>&1
print_success "Database synced"

if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 > /dev/null 2>&1
fi

cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: 'deepcut-ai',
    script: './dist/index.cjs',
    cwd: '${APP_DIR}',
    env: {
      NODE_ENV: 'production',
      PORT: ${APP_PORT}
    }
  }]
};
EOF

print_status "Starting application..."
pm2 delete deepcut-ai > /dev/null 2>&1 || true
pm2 start ecosystem.config.cjs > /dev/null 2>&1
pm2 save > /dev/null 2>&1
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true
print_success "Application started"

print_status "Configuring firewall..."
ufw allow ssh > /dev/null 2>&1
ufw allow ${APP_PORT}/tcp > /dev/null 2>&1
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 443/tcp > /dev/null 2>&1
echo "y" | ufw enable > /dev/null 2>&1
print_success "Firewall configured"

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}       INSTALLATION COMPLETE!                   ${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo -e "  URL: ${YELLOW}http://${SERVER_IP}:${APP_PORT}${NC}"
echo ""
echo -e "  Next steps:"
echo -e "  1. Open the URL above in your browser"
echo -e "  2. Create your admin account"
echo -e "  3. Add API keys in Settings"
echo ""
echo -e "  Commands:"
echo -e "  ${BLUE}pm2 logs deepcut-ai${NC}     - View logs"
echo -e "  ${BLUE}pm2 restart deepcut-ai${NC}  - Restart app"
echo -e "  ${BLUE}pm2 status${NC}              - Check status"
echo ""
