# QA Platform

Canonical QA service for the Master ecosystem.

## Purpose

`qa-platform` owns quality gates outside individual products so projects do not need to carry separate audit, stress, security, architecture, and release-gate logic.

## Engines

- `engines/audit`: source and structure audit.
- `engines/test`: unit, integration, browser, and workflow tests.
- `engines/stress`: load and stability tests.
- `engines/security`: secrets, dependency, and risky-operation checks.
- `engines/architecture`: dependency and boundary validation.
- `engines/release-gate`: final pass/fail decision before deploy or release candidate.

## Consumers

- Agent OS QA Executor.
- Bakudan products.
- RawSushi products.
- Dashboard, review automation, payroll, Toast/QB, and future projects.

## Contract

Every QA run must produce artifacts under `artifacts/` and a journal event in `master-journal`.
