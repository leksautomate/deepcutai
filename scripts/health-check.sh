#!/bin/bash

# DeepCut AI - Health Check Script
# Usage: ./scripts/health-check.sh

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "      DeepCut AI Health Check         "
echo "======================================"

check_service() {
    name=$1
    url=$2
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url")
    
    if [[ "$code" == "200" || "$code" == "304" ]]; then
        echo -e "[${GREEN}OK${NC}] $name ($url) - $code"
        return 0
    else
        echo -e "[${RED}FAIL${NC}] $name ($url) - Code: $code"
        return 1
    fi
}

# 1. Check Server
echo ""
echo "Checking Application..."
check_service "Backend API" "http://localhost:5000/api/settings/public"
check_service "Frontend" "http://localhost:5000"

# 2. Check Database Connection (via Log check or API if exposed)
# Using grep on logs if PM2 is running
echo ""
echo "Checking Logs (if PM2 running)..."
if command -v pm2 &> /dev/null; then
    pm2 jlist | grep -q "deepcut-ai"
    if [ $? -eq 0 ]; then
        STATUS=$(pm2 jlist | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        if [ "$STATUS" == "online" ]; then
             echo -e "[${GREEN}OK${NC}] PM2 Service Status: $STATUS"
        else
             echo -e "[${RED}FAIL${NC}] PM2 Service Status: $STATUS"
        fi
    else
        echo -e "[${YELLOW}SKIP${NC}] PM2 service not found"
    fi
else
    echo -e "[${YELLOW}SKIP${NC}] PM2 not installed"
fi

# 3. Disk Space Check
echo ""
echo "Checking Disk Space..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | cut -d'%' -f1)
if [ "$DISK_USAGE" -gt 90 ]; then
     echo -e "[${RED}WARN${NC}] Disk usage is high: ${DISK_USAGE}%"
else
     echo -e "[${GREEN}OK${NC}] Disk usage: ${DISK_USAGE}%"
fi

echo ""
echo "Health check complete."
