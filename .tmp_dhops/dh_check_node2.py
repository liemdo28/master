# -*- coding: utf-8 -*-
import os, paramiko

host = "pdx1-shared-a3-05.dreamhost.com"
user = "liemdo0208"
password = os.environ["DH_PASS"]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=22, username=user, password=password, timeout=20)

script = r'''
echo "--- search broadly for node binaries/versions ---"
find /usr /opt /dh 2>/dev/null -maxdepth 6 -iname "node" -o -iname "node1*" -o -iname "node2*" | grep -v "/proc" | head -40
echo "--- dreamhost docs hint: passenger app type dirs ---"
find /home/liemdo0208 -maxdepth 2 -iname "tmp" 2>&1
ls -la /home/liemdo0208/bakudanramen.com/tmp 2>&1
echo "--- passenger --version ---"
passenger --version 2>&1 | head -5
echo "--- check for a nodenv/asdf ---"
command -v nodenv 2>&1
command -v asdf 2>&1
echo "--- dreamhost specific: dh_* env or /usr/local/dh ---"
ls -la /usr/local/dh 2>&1
env | grep -i node 2>&1
'''

stdin, stdout, stderr = client.exec_command(script)
out = stdout.read().decode(errors="replace")
err = stderr.read().decode(errors="replace")
print(out)
if err.strip():
    print("[stderr]", err)
client.close()
