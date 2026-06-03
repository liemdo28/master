#!/bin/bash
# Double-click this file on Mac to open API Key Manager
cd "$(dirname "$0")"

# Check node
if ! command -v node &>/dev/null; then
  osascript -e 'display alert "Node.js not found" message "Install Node.js from https://nodejs.org first." as critical'
  exit 1
fi

echo "🔑 Starting API Key Manager..."
node api-key-manager.js
