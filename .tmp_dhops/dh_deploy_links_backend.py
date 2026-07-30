# -*- coding: utf-8 -*-
import os, paramiko

host = "pdx1-shared-a3-05.dreamhost.com"
user = "liemdo0208"
password = os.environ["DH_PASS"]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=22, username=user, password=password, timeout=30)

script = r'''
set -e
cd ~/bakudanramen.com

cat > package.json << 'PKGJSON'
{
  "name": "bakudan-website",
  "version": "1.0.0",
  "description": "Bakudan Ramen - website + Links Hub + Blog CMS",
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

cd ~
mkdir -p nodejs22 nodejs22-src
curl -s https://nodejs.org/dist/index.json -o /tmp/node-index.json
VERSION=$(node -e "
const idx = JSON.parse(require('fs').readFileSync('/tmp/node-index.json','utf8'));
const rel = idx.find(r => r.lts && r.version.startsWith('v22'));
console.log(rel ? rel.version : '');
")
echo "Resolved Node version: $VERSION"
TARBALL="node-${VERSION}-linux-x64.tar.xz"
curl -sL "https://nodejs.org/dist/${VERSION}/${TARBALL}" -o "nodejs22-src/${TARBALL}"
tar -xJf "nodejs22-src/${TARBALL}" -C nodejs22-src --strip-components=1
rm -rf nodejs22/*
mv nodejs22-src/* nodejs22/
./nodejs22/bin/node -v
./nodejs22/bin/npm -v

cd ~/bakudanramen.com
~/nodejs22/bin/npm install --production

cat > server/.env << 'ENVFILE'
SITE_URL=https://bakudanramen.com
JWT_SECRET=62ab9b93b5af960c4faeb5dadbcf76a34bfb6ed42caad8f4199ab83d6802b120
ENVFILE

cp .htaccess ".htaccess.backup-$(date +%Y%m%d_%H%M%S)"
cat >> .htaccess << 'HTACCESS'

# --- Links Hub Node backend (added 2026-07-03) ---
PassengerAppRoot /home/liemdo0208/bakudanramen.com
PassengerAppType node
PassengerStartupFile server/server.js
PassengerNodejs /home/liemdo0208/nodejs22/bin/node
PassengerBaseURI /api
HTACCESS

mkdir -p tmp && touch tmp/restart.txt
sleep 5

echo "--- API check ---"
curl -s https://www.bakudanramen.com/api/public/links/bakudan
echo ""
echo "--- homepage still OK? ---"
curl -s -o /dev/null -w "%{http_code}\n" https://www.bakudanramen.com/
echo "--- menu.html still OK? ---"
curl -s -o /dev/null -w "%{http_code}\n" https://www.bakudanramen.com/menu.html
echo "--- locations.html still OK? ---"
curl -s -o /dev/null -w "%{http_code}\n" https://www.bakudanramen.com/locations.html
'''

stdin, stdout, stderr = client.exec_command(script)
out = stdout.read().decode(errors="replace")
err = stderr.read().decode(errors="replace")
print(out)
if err.strip():
    print("[stderr]", err)
client.close()
