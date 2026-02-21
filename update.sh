#!/bin/bash

# DeepCut AI - Update Script
# Usage: sudo ./update.sh

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "\n${BLUE}[*]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }

# Check for root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./update.sh"
    exit 1
fi

APP_DIR="/var/www/deepcut-ai"

# Navigate to application directory
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    print_status "Navigated to $APP_DIR"
fi

# 1. Pull latest changes
print_status "Pulling latest changes..."
git pull origin main

# 2. Install dependencies
print_status "Installing dependencies..."
npm install --silent

# 3. Build application
print_status "Building application..."
npm run build

# 4. Push database schema
print_status "Updating database schema..."
npm run db:push

# 5. Restart application
print_status "Restarting application..."
pm2 restart deepcut-ai

print_success "Update complete! Application is running."
