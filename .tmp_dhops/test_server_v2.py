# -*- coding: utf-8 -*-
import os, paramiko

host = "pdx1-shared-a3-05.dreamhost.com"
user = "liemdo0208"
password = os.environ["DH_PASS"]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=22, username=user, password=password, timeout=30)

script = r'''
cd ~/bakudanramen.com
pkill -f "node.*server.js" 2>/dev/null || true
sleep 1
rm -f /tmp/bkdn-server.log
nohup ~/nodejs22-jitless server/server.js > /tmp/bkdn-server.log 2>&1 &
sleep 4
echo "--- process check ---"
ps aux | grep "node.*server.js" | grep -v grep
echo "--- local API test ---"
curl -s http://127.0.0.1:3000/api/public/links/bakudan
echo ""
echo "--- log tail ---"
tail -30 /tmp/bkdn-server.log
'''

stdin, stdout, stderr = client.exec_command(script)
out = stdout.read().decode(errors="replace")
err = stderr.read().decode(errors="replace")
print(out)
if err.strip():
    print("[stderr]", err)
client.close()
