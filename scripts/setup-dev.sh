#!/bin/bash

# DeepCut AI - Development Setup Script
# Usage: ./scripts/setup-dev.sh

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_step() { echo -e "\n${BLUE}➤ $1${NC}"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error() { echo -e "${RED}✖ $1${NC}"; }

echo -e "${GREEN}DeepCut AI - Development Setup Loop${NC}"
echo "======================================="

# 1. Check Prerequisites
print_step "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed."
    exit 1
fi
print_success "Node.js found: $(node -v)"

if ! command -v docker &> /dev/null; then
    print_warn "Docker not found. You will need a database running separately."
else
    print_success "Docker found: $(docker --version)"
fi

# 2. Environment Setup
print_step "Setting up environment..."
if [ ! -f .env ]; then
    if [ -f .env.template ]; then
        cp .env.template .env
        print_success "Created .env from .env.template"
    elif [ -f .env.example ]; then
        cp .env.example .env
        print_success "Created .env from .env.example"
    else
        print_error "No template file found (.env.template or .env.example)"
        exit 1
    fi
else
    print_success ".env file already exists"
fi

# 3. Install Dependencies
print_step "Installing dependencies..."
npm install
print_success "Dependencies installed"

# 4. Database Setup
print_step "Setting up database..."

read -p "Do you want to start a local Postgres container? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v docker &> /dev/null; then
        # Check if container exists
        if [ "$(docker ps -aq -f name=deepcut-db-dev)" ]; then
            docker start deepcut-db-dev
            print_success "Started existing 'deepcut-db-dev' container"
        else
            docker run -d \
                --name deepcut-db-dev \
                -e POSTGRES_USER=deepcut \
                -e POSTGRES_PASSWORD=local_password \
                -e POSTGRES_DB=deepcut \
                -p 5432:5432 \
                postgres:15-alpine
            print_success "Created and started 'deepcut-db-dev' container"
        fi
        
        # Wait for DB
        echo "Waiting 5s for DB to initialize..."
        sleep 5
    else
        print_error "Docker is required to auto-start Postgres."
    fi
fi

# 5. Schema Push
print_step "Pushing database schema..."
npm run db:push
print_success "Database schema synced"

echo -e "\n${GREEN}Setup Complete! 🚀${NC}"
echo "Start the dev server with:"
echo "  npm run dev"
