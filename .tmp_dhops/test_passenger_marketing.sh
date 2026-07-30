#!/bin/bash
set -e
cd ~/marketing.bakudanramen.com

echo "=== current .htaccess (backing up) ==="
if [ -f .htaccess ]; then
  cp .htaccess ".htaccess.backup-$(date +%Y%m%d_%H%M%S)"
  cat .htaccess
else
  echo "(no existing .htaccess)"
fi

mkdir -p ptest
cd ptest

cat > package.json << 'PKGJSON'
{
  "name": "passenger-test",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": { "express": "^4.18.2" }
}
PKGJSON

cat > server.js << 'SERVERJS'
const express = require('express');
const app = express();
app.get('*', (req, res) => res.send('PASSENGER TEST OK: ' + new Date().toISOString()));
app.listen(process.env.PORT || 3000, () => console.log('test app listening'));
SERVERJS

~/nodejs22-jitless ~/nodejs22/lib/node_modules/npm/bin/npm-cli.js install --no-audit --no-fund

cd ~/marketing.bakudanramen.com
cat >> .htaccess << 'HTACCESS'

# Passenger isolation test
PassengerAppRoot /home/liemdo0208/marketing.bakudanramen.com
PassengerAppType node
PassengerStartupFile ptest/server.js
PassengerNodejs /home/liemdo0208/nodejs22-jitless
PassengerBaseURI /ptest
HTACCESS

mkdir -p tmp
touch tmp/restart.txt
sleep 6

echo "=== test results ==="
echo "-- /ptest/ (should hit the test app) --"
curl -s -o /dev/null -w "status: %{http_code}\n" https://marketing.bakudanramen.com/ptest/
curl -s https://marketing.bakudanramen.com/ptest/
echo ""
echo "-- / (existing site, must still work) --"
curl -s -o /dev/null -w "status: %{http_code}\n" https://marketing.bakudanramen.com/

BACKUP=$(ls -t .htaccess.backup-* 2>/dev/null | head -1)
HOME_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://marketing.bakudanramen.com/)
if [ "$HOME_STATUS" != "200" ] && [ -n "$BACKUP" ]; then
  echo "!!! marketing site broken, rolling back to $BACKUP !!!"
  cp "$BACKUP" .htaccess
  touch tmp/restart.txt
  sleep 5
  curl -s -o /dev/null -w "after rollback: %{http_code}\n" https://marketing.bakudanramen.com/
fi
