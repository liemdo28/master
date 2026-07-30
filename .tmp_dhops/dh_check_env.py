# -*- coding: utf-8 -*-
import os, paramiko

host = "pdx1-shared-a3-05.dreamhost.com"
user = "liemdo0208"
password = os.environ["DH_PASS"]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=22, username=user, password=password, timeout=20)

script = r'''
echo "--- arch ---"
uname -m
uname -a
echo "--- outbound internet check ---"
curl -s -o /dev/null -w "nodejs.org -> %{http_code}\n" --max-time 10 https://nodejs.org/dist/index.json
echo "--- existing api/ dir at domain root (found earlier) ---"
ls -la ~/bakudanramen.com/api 2>&1
echo "--- .env at domain root ---"
ls -la ~/bakudanramen.com/.env* 2>&1
grep "^PORT" ~/bakudanramen.com/.env 2>&1
echo "--- disk quota / free space ---"
df -h ~ 2>&1 | tail -3
echo "--- links-temp dir ---"
ls -la ~/bakudanramen.com/links-temp 2>&1 | head -10
echo "--- deploy/links dirs ---"
ls -la ~/bakudanramen.com/deploy 2>&1
'''

stdin, stdout, stderr = client.exec_command(script)
out = stdout.read().decode(errors="replace")
err = stderr.read().decode(errors="replace")
print(out)
if err.strip():
    print("[stderr]", err)
client.close()
