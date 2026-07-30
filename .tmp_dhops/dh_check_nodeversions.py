import os, paramiko

host = "pdx1-shared-a3-05.dreamhost.com"
user = "liemdo0208"
password = os.environ["DH_PASS"]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=22, username=user, password=password, timeout=20)

script = r'''
echo "--- system node ---"
node -v; which node
echo "--- alternate node installs ---"
ls -la /usr/local/dh/node* 2>&1
ls -la /usr/local/RubyGems 2>&1 | head -1
find / -maxdepth 4 -iname "node" -type f 2>/dev/null | grep -v proc
echo "--- nvm ---"
ls -la ~/.nvm 2>&1
command -v nvm 2>&1
echo "--- passenger hints ---"
find ~ -maxdepth 3 -iname "passenger_wsgi*" -o -iname "tmp" 2>&1 | grep -v node_modules
cat ~/bakudanramen.com/.htaccess 2>&1
echo "--- dreamhost node app config (panel-created apps usually live under a specific dir) ---"
find / -maxdepth 3 -iname "*passenger*" 2>/dev/null
'''

stdin, stdout, stderr = client.exec_command(script)
out = stdout.read().decode(errors="replace")
err = stderr.read().decode(errors="replace")
print(out)
if err.strip():
    print("[stderr]", err)
client.close()
