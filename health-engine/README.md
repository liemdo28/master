# Health Engine

Company-wide health calculation and reporting system.

## Purpose

Calculates health scores across five dimensions (Project, QA, Release, Infrastructure, Worker) and produces a single composite company health score.

## Structure

- `reports/` — Generated health reports (weekly CEO reports)

## Health Dimensions

- Project Health (30%) — Code quality, test coverage, security, docs, bugs
- QA Health (30%) — Test automation, bug resolution, release quality
- Release Health (20%) — Deploy success, rollback rate, time to production
- Infrastructure Health (10%) — Worker availability, resources, uptime
- Worker Health (10%) — Task completion, error rate, queue depth

## Status Thresholds

- 90-100: 🟢 Healthy
- 70-89: 🟡 Warning
- 50-69: 🟠 Degraded
- 0-49: 🔴 Critical
