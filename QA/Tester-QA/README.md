# Tester-QA

Tester-QA is an **Internal AI QA & Audit Authority** for an engineering ecosystem.

It does one thing: inspect, validate, stress, audit, collect evidence, and report risk across projects such as Agent-Coding, AOS, dashboards, and services.

Tester-QA is not a coding agent, autonomous OS, orchestration platform, task manager, or general assistant.

## Mission

```txt
Agent-Coding / AOS / Dashboard / Services
                ↓
           Tester-QA
                ↓
    Validation / Stress / Audit
                ↓
          Reports / Evidence
                ↓
              Founder
```

## Capabilities

- Browser QA: Playwright/fallback inspection, screenshots, console errors, network failures, loading deadlock, blank screen, broken layout signals.
- Stress testing: HTTP concurrency, websocket reconnect storm simulation, provider failure simulation, queue overflow and memory pressure modeling.
- Audit: project structure, dependency, config, security, runtime, process, observability readiness.
- Runtime inspection: process list, occupied ports, queue depth, provider latency, retry storm, stuck worker, failed execution signals.
- Incident intelligence: severity, evidence, root cause, blast radius, reproduction, fix suggestion, validation plan, prevention.
- Reports: enterprise QA, SRE-style audit, stress reports, browser inspection reports, project risk reports.
- Evidence: screenshots, logs, traces, metrics, network captures, console captures, incident records.

## Source Map

- [src/tester_qa/audit](/Users/liemdo/Projects/Tester-QA/src/tester_qa/audit): project, dependency, security, runtime audits.
- [src/tester_qa/stress](/Users/liemdo/Projects/Tester-QA/src/tester_qa/stress): HTTP, websocket, provider, runtime stress engines.
- [src/tester_qa/browser](/Users/liemdo/Projects/Tester-QA/src/tester_qa/browser): browser inspection, screenshot, DOM, network, console, visual report.
- [src/tester_qa/runtime](/Users/liemdo/Projects/Tester-QA/src/tester_qa/runtime): process/runtime audit helpers.
- [src/tester_qa/evidence.py](/Users/liemdo/Projects/Tester-QA/src/tester_qa/evidence.py): evidence capture engine.
- [src/tester_qa/incidents.py](/Users/liemdo/Projects/Tester-QA/src/tester_qa/incidents.py): incident lifecycle registry.
- [src/tester_qa/projects](/Users/liemdo/Projects/Tester-QA/src/tester_qa/projects): cross-project analysis and healthcheck.
- [src/tester_qa/reporting](/Users/liemdo/Projects/Tester-QA/src/tester_qa/reporting): audit, stress, incident, browser, project, weekly, JSON reports.
- [src/tester_qa/metrics](/Users/liemdo/Projects/Tester-QA/src/tester_qa/metrics): stability scoring.
- [src/tester_qa/validators](/Users/liemdo/Projects/Tester-QA/src/tester_qa/validators): state consistency checks.
- [src/tester_qa/scanners](/Users/liemdo/Projects/Tester-QA/src/tester_qa/scanners): project scanning.
- [src/tester_qa/memory](/Users/liemdo/Projects/Tester-QA/src/tester_qa/memory): QA memory for incidents, weaknesses, known commands, ports, setup steps.
- [src/tester_qa/cli.py](/Users/liemdo/Projects/Tester-QA/src/tester_qa/cli.py): QA/stress/audit CLI.

## Primary Commands

```bash
PYTHONPATH=src python3 -m tester_qa.cli audit-project /Users/liemdo/Projects/agent-coding --format markdown
PYTHONPATH=src python3 -m tester_qa.cli stress-http http://localhost:3000 --requests 100 --concurrency 10
PYTHONPATH=src python3 -m tester_qa.cli stress-websocket ws://localhost:3000/ws --clients 50 --reconnects 5
PYTHONPATH=src python3 -m tester_qa.cli simulate-provider openai --mode rate_limit --attempts 20
PYTHONPATH=src python3 -m tester_qa.cli runtime-audit --queue-depth 150 --retry-storms 2
PYTHONPATH=src python3 -m tester_qa.cli browser inspect http://localhost:3000
PYTHONPATH=src python3 -m tester_qa.cli browser-inspect http://localhost:3000
PYTHONPATH=src python3 -m tester_qa.cli inspect-project /Users/liemdo/Projects/agent-coding
PYTHONPATH=src python3 -m tester_qa.cli run-healthcheck /Users/liemdo/Projects/agent-coding
PYTHONPATH=src python3 -m tester_qa.cli incident create --title "Dashboard websocket desync" --severity high
PYTHONPATH=src python3 -m tester_qa.cli incident list
PYTHONPATH=src python3 -m tester_qa.cli report project /Users/liemdo/Projects/agent-coding
```

## Evidence Layout

```txt
evidence/
 ├── screenshots/
 ├── logs/
 ├── traces/
 ├── metrics/
 ├── network/
 ├── console/
 └── incidents/
```

## Safety

Tester-QA may execute safe validation commands, but destructive commands are blocked by default and require explicit approval flow. This safety layer exists only to support QA/audit work, not general automation.

Blocked examples: `rm -rf`, `sudo`, `chmod -R`, `chown -R`, `kill -9`, `git reset --hard`, `git clean -fd`, `docker system prune`, `npm publish`, `pip upload`, `delete database`, `drop table`.

## Validation

```bash
PYTHONPATH=src python3 -m unittest discover -s tests
```
