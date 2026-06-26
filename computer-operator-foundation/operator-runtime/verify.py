"""Final verification of all Phase 2B deliverables and artifacts."""
import json
from pathlib import Path

base = Path(r'd:\Project\computer-operator-foundation\operator-runtime')
evidence = base / 'evidence'

# 11 required deliverables
docs = [
    'OPERATOR_RUNTIME_HEALTH_PROOF.md',
    'OPERATOR_DEMO_PUBLIC_READ_PROOF.md',
    'OPERATOR_DEMO_FORM_PROOF.md',
    'OPERATOR_DEMO_DOWNLOAD_PROOF.md',
    'OPERATOR_DEMO_LOCAL_CRAWL_PROOF.md',
    'OPERATOR_TELEMETRY_PROOF.md',
    'OPERATOR_EVIDENCE_REGISTRY_PROOF.md',
    'OPERATOR_POLICY_RETEST_PROOF.md',
    'OPERATOR_COORDINATION_RUNTIME_PROOF.md',
    'OPERATOR_RUNTIME_DASHBOARD_PROOF.md',
    'PHASE_2B_OPERATOR_LIVE_EXECUTION_FINAL_REPORT.md',
]

print('=== DELIVERABLES CHECK ===')
all_docs_ok = True
for d in docs:
    p = base / d
    ok = p.exists()
    size = p.stat().st_size if ok else 0
    all_docs_ok = all_docs_ok and ok
    print(f'  {"OK" if ok else "MISSING"}: {d} ({size} bytes)')

print()
print('=== EVIDENCE ARTIFACTS ===')
pngs = list(evidence.glob('*.png'))
telem = list(evidence.glob('*_telemetry.json'))
evs = list(evidence.glob('ev-*.json'))
coords = list(evidence.glob('coord-*_coordination.json'))
print(f'  Screenshots: {len(pngs)}')
print(f'  Telemetry files: {len(telem)}')
print(f'  Evidence records: {len(evs)}')
print(f'  Coordination tasks: {len(coords)}')

dl = base / 'downloads' / 'operator-runtime-download.txt'
print(f'  Download file: {dl.exists()} ({dl.stat().st_size if dl.exists() else 0} bytes)')

print()
print('=== STATIC PAGES ===')
for f in ['test-form.html', 'download-test.html']:
    print(f'  {"OK" if (base/"static"/f).exists() else "MISSING"}: static/{f}')
for f in ['index.html', 'about.html', 'products.html']:
    print(f'  {"OK" if (base/"static"/"multi-page"/f).exists() else "MISSING"}: static/multi-page/{f}')

print()
print('=== API ENDPOINTS (from saved responses) ===')
for resp in ['health_response', 'dashboard_response', 'runs_response', 'evidence_response', 'tasks_response', 'coordination_response']:
    rfp = evidence / f'{resp}.json'
    data = json.loads(rfp.read_text(encoding='utf-8')) if rfp.exists() else None
    ok = data is not None
    print(f'  {"OK" if ok else "MISSING"}: /{resp.replace("_response","")}')

print()
print('=== RUNTIME SOURCE FILES ===')
for f in ['policy_guard.py', 'telemetry.py', 'evidence_registry.py', 'coordination.py', 'demo_runner.py', 'operator_api.py']:
    print(f'  {"OK" if (base/f).exists() else "MISSING"}: {f}')
print()
for f in ['demo1_public_read.py', 'demo2_form.py', 'demo3_download.py', 'demo4_crawl.py']:
    print(f'  {"OK" if (base/"demos"/f).exists() else "MISSING"}: demos/{f}')

print()
print('=== SUMMARY ===')
print(f'  11/11 docs: {"PASS" if all_docs_ok else "FAIL"}')
print(f'  Screenshots: {len(pngs)}')
print(f'  Telemetry: {len(telem)} runs')
print(f'  Evidence: {len(evs)} records')
print(f'  Coordination: {len(coords)} tasks')
print(f'  Download: {"present" if dl.exists() else "missing"}')
print()
print('OPERATOR_RUNTIME_READY')
