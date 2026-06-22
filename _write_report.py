import os
path = r"E:\\Project\\Master\\mi-core\\EVIDENCE_GATE_RUNTIME_REPORT.md"
exists = os.path.exists(path)
print(f"File exists: {exists}")
if exists:
    print(f"Size: {os.path.getsize(path)}")