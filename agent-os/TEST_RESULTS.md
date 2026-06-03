# Test Results

Last updated: 2026-06-01

## Build verification

```text
agent-control: npm run build -> PASS
agent-worker:  npm run build -> PASS
```

## Safety checks

Live API verification on `http://localhost:3700` after restart:

```text
hi before task count: 35
hi after task count:  35
hi unsupported:       true
hi task property:     false

Git Status task:      ccd5cc56-5404-419c-a126-6db27593517c
Git Status status:    completed
registryIntent:       git_status_all
executor:             git_executor
payload.command:      absent
task error:           null

Raw script API task:  eb57afe8-545f-467c-b556-ce13997db0ac
Raw script status:    failed
Raw script error:     Raw shell blocked: script tasks must come from COMMAND_REGISTRY.json.
```

Parser verification:

```text
hi -> unsupported, no command payload
Audit Master -> audit_master, audit_executor, no command payload
Git Status -> git_status_all, git_executor, no command payload
Run QA -> run_qa, qa_executor, no command payload
Open Antigravity -> open_antigravity, app_executor, no command payload
Start API Proxy -> start_api_proxy, script_executor, approved scriptPath only
```

`git-status-all.ps1` was also repaired and verified:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File E:\Project\Master\git-status-all.ps1 -> PASS
```

## Acceptance target

Acceptance is complete only when these checks pass on the CEO machine, not when a developer says the code is done.
