# Review Board

Multi-reviewer approval system for release gating.

## Purpose

Ensures every change passes through Architecture, QA, Security, and Operations review before reaching production.

## Structure

- `reviewers/` — Reviewer configurations
- `approvals/` — Approval records

## Flow

```
Engineering → QA Platform → Review Board → Approval Engine → Release
```

## Reviewers

- Architecture Reviewer
- QA Reviewer
- Security Reviewer
- Operations Reviewer

## Approval Matrix

| Criticality | Required Reviewers | Threshold |
|-------------|-------------------|-----------|
| P0 | All 4 + CTO | Unanimous |
| P1 | Architecture + QA | Both approve |
| P2 | QA only | QA approves |
| P3 | Auto-approve | Automated checks pass |
