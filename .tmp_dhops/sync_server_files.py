# -*- coding: utf-8 -*-
import os, paramiko

host = "pdx1-shared-a3-05.dreamhost.com"
user = "liemdo0208"
password = os.environ["DH_PASS"]

LOCAL = r"D:\Project\Master\Bakudan\bakudanramen.com-current\server"
REMOTE = "/home/liemdo0208/bakudanramen.com/server"

FILES = [
    "db.js", "server.js", "test.js",
    "middleware/auth.js",
    "routes/admin.js", "routes/auth.js", "routes/blog.js", "routes/links.js", "routes/public.js",
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=22, username=user, password=password, timeout=30)
sftp = client.open_sftp()

import time
stamp = time.strftime("%Y%m%d_%H%M%S")
backup_dir = f"{REMOTE}/.backup-{stamp}"
_, stdout, _ = client.exec_command(f"mkdir -p {backup_dir}/middleware {backup_dir}/routes")
stdout.channel.recv_exit_status()

for rel in FILES:
    remote_path = f"{REMOTE}/{rel}"
    try:
        sftp.stat(remote_path)
        client.exec_command(f"cp {remote_path} {backup_dir}/{rel}")
        print(f"backed up {rel} -> .backup-{stamp}/{rel}")
    except FileNotFoundError:
        print(f"(no existing {rel} to back up)")

for rel in FILES:
    local_path = os.path.join(LOCAL, rel.replace("/", os.sep))
    remote_path = f"{REMOTE}/{rel}"
    sftp.put(local_path, remote_path)
    st = sftp.stat(remote_path)
    print(f"OK {rel} ({st.st_size} bytes)")

sftp.close()
client.close()
print(f"\nBackup of previous files: {backup_dir}")
