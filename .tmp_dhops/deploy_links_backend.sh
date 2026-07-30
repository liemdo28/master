#!/bin/bash
set -e
cd ~/bakudanramen.com

echo "=== 1. package.json ==="
cat > package.json << 'PKGJSON'
{
  "name": "bakudan-website",
  "version": "1.0.0",
  "description": "Bakudan Ramen website plus Links Hub and Blog CMS",
  "main": "server/server.js",
  "scripts": {
    "start":  "node server/server.js",
    "dev":    "node --watch server/server.js",
    "test":   "node server/test.js"
  },
  "dependencies": {
    "bcryptjs":     "^2.4.3",
    "dotenv":       "^16.4.5",
    "express":      "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "multer":       "^1.4.5-lts.1",
    "node-cron":    "^3.0.3"
  },
  "engines": { "node": ">=18" }
}
PKGJSON

echo "=== 2. fresh Node 22 install ==="
cd ~
rm -rf nodejs22 nodejs22-src
mkdir -p nodejs22 nodejs22-src
curl -s https://nodejs.org/dist/index.json -o /tmp/node-index.json
VERSION=$(node -e "const idx=JSON.parse(require('fs').readFileSync('/tmp/node-index.json','utf8'));const rel=idx.find(r=>r.lts&&r.version.startsWith('v22'));console.log(rel?rel.version:'')")
echo "Resolved Node version: $VERSION"
TARBALL="node-${VERSION}-linux-x64.tar.xz"
curl -sL "https://nodejs.org/dist/${VERSION}/${TARBALL}" -o "nodejs22-src/${TARBALL}"
tar -xJf "nodejs22-src/${TARBALL}" -C nodejs22-src --strip-components=1
cp -r nodejs22-src/* nodejs22/
rm -rf nodejs22-src
NODE_BIN="$HOME/nodejs22/bin/node"
NPM_CLI="$HOME/nodejs22/lib/node_modules/npm/bin/npm-cli.js"
"$NODE_BIN" -v

echo "=== 3. npm install (using explicit node22 interpreter, bypassing PATH) ==="
cd ~/bakudanramen.com
"$NODE_BIN" "$NPM_CLI" install --production --no-audit --no-fund

if [ ! -d node_modules/express ]; then
  echo "FAIL: node_modules/express missing after install. Aborting before touching .htaccess."
  exit 1
fi
echo "OK: dependencies installed."

echo "=== 4. server/.env ==="
cat > server/.env << 'ENVFILE'
SITE_URL=https://bakudanramen.com
JWT_SECRET=62ab9b93b5af960c4faeb5dadbcf76a34bfb6ed42caad8f4199ab83d6802b120
ENVFILE

echo "=== 5. backup + update .htaccess ==="
BACKUP=".htaccess.backup-$(date +%Y%m%d_%H%M%S)"
cp .htaccess "$BACKUP"
echo "Backup created: $BACKUP"

cat >> .htaccess << 'HTACCESS'

# Links Hub Node backend
PassengerAppRoot /home/liemdo0208/bakudanramen.com
PassengerAppType node
PassengerStartupFile server/server.js
PassengerNodejs /home/liemdo0208/nodejs22/bin/node
PassengerBaseURI /api
HTACCESS

echo "=== 6. restart Passenger ==="
mkdir -p tmp && touch tmp/restart.txt
sleep 6

echo "=== 7. verify ==="
HOME_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.bakudanramen.com/)
MENU_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.bakudanramen.com/menu.html)
API_RESP=$(curl -s https://www.bakudanramen.com/api/public/links/bakudan)
echo "homepage: $HOME_CODE"
echo "menu.html: $MENU_CODE"
echo "api response: $API_RESP"

if [ "$HOME_CODE" != "200" ] || [ "$MENU_CODE" != "200" ]; then
  echo "!!! SITE BROKEN — AUTO ROLLING BACK !!!"
  cp "$BACKUP" .htaccess
  touch tmp/restart.txt
  sleep 5
  HOME_CODE2=$(curl -s -o /dev/null -w "%{http_code}" https://www.bakudanramen.com/)
  echo "After rollback, homepage: $HOME_CODE2"
  echo "RESULT: ROLLED BACK — Links Hub NOT deployed, site restored to safe state."
  exit 1
fi

echo "RESULT: site is healthy. Links Hub API status printed above — check if it returned real JSON or an error."
