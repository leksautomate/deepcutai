#!/bin/bash

# DeepCut AI VPS Deployment Script
# Run: chmod +x deploy.sh && ./deploy.sh

set -e

echo "🚀 DeepCut AI VPS Deployment"
echo "============================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "⚠️  Please log out and back in, then run this script again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    
    # Generate random secrets
    SESSION_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -hex 16)
    
    cat > .env << EOF
# Database
DB_PASSWORD=${DB_PASSWORD}

# Session
SESSION_SECRET=${SESSION_SECRET}

# API Keys (fill these in or configure via Settings page after login)
GEMINI_API_KEY=
GROQ_API_KEY=
SPEECHIFY_API_KEY=
INWORLD_API_KEY=
FREEPIK_API_KEY=
WAVESPEED_API_KEY=
RUNPOD_API_KEY=
POLLINATIONS_API_KEY=
EOF
    
    echo "⚠️  Edit .env file and add your API keys, then run this script again."
    exit 0
fi

# Check if API keys are set
source .env
if [ -z "$GEMINI_API_KEY" ] && [ -z "$GROQ_API_KEY" ]; then
    echo "⚠️  Please add at least GEMINI_API_KEY or GROQ_API_KEY to .env file"
    exit 1
fi

# Create directories
mkdir -p assets data logs

# Build and start
echo "🔨 Building containers..."
docker compose build

echo "🚀 Starting services..."
docker compose up -d

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Status: docker compose ps"
echo "📜 Logs:   docker compose logs -f app"
echo "🔄 Update: git pull && docker compose up -d --build"
echo ""
echo "🌐 App running at: http://$(hostname -I | awk '{print $1}'):5000"
