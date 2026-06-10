#!/usr/bin/env python3
"""Master generator runner — executes all generators in sequence."""
import subprocess, sys, time
from pathlib import Path

BASE = Path(__file__).parent
scripts = [
    "_gen1_federal.py",
    "_gen2_texas.py",
    "_gen3_california.py",
    "_gen4_payroll_tax_labor.py",
    "_gen5_restaurant_permits.py",
    "_gen6_san_antonio_stockton.py",
    "_gen7_accounting_templates.py",
]

start = time.time()
total_size = 0
total_files = 0

for script in scripts:
    path = BASE / script
    if not path.exists():
        print(f"Skipping {script} — not found")
        continue
    print(f"\\n{'='*60}")
    print(f"Running {script}...")
    print(f"{'='*60}")
    result = subprocess.run([sys.executable, str(path)], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(f"STDERR: {result.stderr[:2000]}")
    if result.returncode != 0:
        print(f"WARNING: {script} returned exit code {result.returncode}")

# Count results
for ext in ["*.md", "*.txt", "*.json", "*.csv"]:
    for p in BASE.rglob(ext):
        if "ingestion_pipeline.py" in str(p) or "_gen" in str(p) or "\\index\\" in str(p) or "\\source-catalog\\" in str(p) or "\\reports\\" in str(p):
            continue
        total_size += p.stat().st_size
        total_files += 1

elapsed = time.time() - start
print(f"\\n{'='*60}")
print(f"GENERATION COMPLETE")
print(f"{'='*60}")
print(f"Files created: {total_files}")
print(f"Total size: {total_size/1024/1024:.1f} MB")
print(f"Time: {elapsed:.1f}s")
