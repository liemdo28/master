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
cd ~
mkdir -p nodejs22 nodejs22-src

echo "--- resolving latest Node 22 LTS release ---"
curl -s https://nodejs.org/dist/index.json -o /tmp/node-index.json
VERSION=$(node -e "
const idx = JSON.parse(require('fs').readFileSync('/tmp/node-index.json','utf8'));
const rel = idx.find(r => r.lts && r.version.startsWith('v22'));
console.log(rel ? rel.version : '');
")
if [ -z "$VERSION" ]; then echo "FAIL could not resolve version"; exit 1; fi
echo "Resolved version: $VERSION"

TARBALL="node-${VERSION}-linux-x64.tar.xz"
URL="https://nodejs.org/dist/${VERSION}/${TARBALL}"
echo "Downloading $URL"
curl -sL "$URL" -o "nodejs22-src/${TARBALL}"
tar -xJf "nodejs22-src/${TARBALL}" -C nodejs22-src --strip-components=1
rm -rf nodejs22/*
mv nodejs22-src/* nodejs22/
rmdir nodejs22-src 2>/dev/null || true

echo "--- verify ---"
./nodejs22/bin/node -v
./nodejs22/bin/npm -v
'''

stdin, stdout, stderr = client.exec_command(script)
out = stdout.read().decode(errors="replace")
err = stderr.read().decode(errors="replace")
print(out)
if err.strip():
    print("[stderr]", err)
client.close()
