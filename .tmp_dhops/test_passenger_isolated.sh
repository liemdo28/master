#!/bin/bash
set -e
cd ~/api.bakudanramen.com

echo "=== current contents ==="
ls -la

mkdir -p testapp
cd testapp

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

cd ~/api.bakudanramen.com
cat > .htaccess << 'HTACCESS'
PassengerAppRoot /home/liemdo0208/api.bakudanramen.com/testapp
PassengerAppType node
PassengerStartupFile server.js
PassengerNodejs /home/liemdo0208/nodejs22-jitless
HTACCESS

mkdir -p testapp/tmp
touch testapp/tmp/restart.txt
sleep 6

echo "=== test result ==="
curl -s -o /dev/null -w "status: %{http_code}\n" https://api.bakudanramen.com/
curl -s https://api.bakudanramen.com/
echo ""
