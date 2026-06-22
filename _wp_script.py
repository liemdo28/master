import os
path = r"e:\Project\Master\mi-core\WHATSAPP_ERROR_POLICY.md"
with open(path, "wb") as f:
    f.write(open(r"e:\Project\Master\mi-core\_wp_content.txt", "rb").read())
print("Written:", os.path.getsize(path))
