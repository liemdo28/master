#!/bin/bash
# WhatsApp AI Gateway - Mac/Linux Launcher
# Double-click to start the gateway

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo ""
echo "============================================"
echo "   WhatsApp AI Gateway Launcher v2.0"
echo "============================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Please install from https://nodejs.org"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "[OK] Node.js found: $(node -v)"

# Check node_modules
if [ ! -d "node_modules" ]; then
    echo ""
    echo "[INFO] node_modules not found. Running npm install..."
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "[ERROR] npm install failed."
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

echo ""
echo "[OK] Dependencies ready"
echo ""
echo "============================================"
echo "   Dashboard will open at:"
echo "   http://localhost:3210"
echo "============================================"
echo ""

# Open browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open http://localhost:3210
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open http://localhost:3210
fi

echo "Starting WhatsApp AI Gateway..."
echo ""

# Run the app
npm start
