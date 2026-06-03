#!/bin/bash
# Cài proxy tự khởi động khi mở máy (macOS LaunchAgent)

PROXY_PATH="$(cd "$(dirname "$0")" && pwd)/proxy.js"
NODE_PATH="$(which node)"
PLIST="$HOME/Library/LaunchAgents/com.agent-coding.ai-proxy.plist"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.agent-coding.ai-proxy</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$PROXY_PATH</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/.ai-proxy.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/.ai-proxy.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null
launchctl load "$PLIST"

echo ""
echo "✅ AI Proxy sẽ tự khởi động mỗi khi mở máy"
echo "   Log: $HOME/.ai-proxy.log"
echo ""
echo "Quản lý:"
echo "  Tắt auto-start : launchctl unload $PLIST"
echo "  Bật lại        : launchctl load $PLIST"
echo "  Xem log        : tail -f $HOME/.ai-proxy.log"
