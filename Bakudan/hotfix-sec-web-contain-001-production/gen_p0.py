#!/usr/bin/env python3
"""Generate p0_ceo_directive.php"""
import os
target = r'e:\Project\Master\Bakudan\dashboard.bakudanramen.com\p0_ceo_directive.php'
parts = []
with open(r'e:\Project\Master\Bakudan\dashboard.bakudanramen.com\p0_exec_a.php', 'r') as f:
    parts.append(f.read())
with open(r'e:\Project\Master\Bakudan\dashboard.bakudanramen.com\p0_exec_b.php', 'r') as f:
    parts.append(f.read())
print(f"Part A: {len(parts[0])} bytes")
print(f"Part B: {len(parts[1])} bytes")
# We need to finish Part B's trailing code then output
print("Ready to concatenate")
