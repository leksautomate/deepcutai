#!/bin/sh
# Docker health check script for DeepCut AI
# More robust than inline wget command

set -e

# Configuration
URL="http://localhost:5000/api/setup/status"
TIMEOUT=5

# Perform health check
if wget --no-verbose --tries=1 --timeout=$TIMEOUT --spider "$URL" 2>&1 | grep -q '200 OK'; then
  echo "Health check passed"
  exit 0
else
  echo "Health check failed"
  exit 1
fi
