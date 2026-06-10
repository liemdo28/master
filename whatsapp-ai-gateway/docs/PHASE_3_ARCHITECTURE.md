# Phase 3 Architecture

## Goal

Transform the WhatsApp AI Gateway into the Bakudan AI Operations Platform while preserving the Phase 2.5 stable core.

## Stable Core

The existing text-message path remains unchanged:

```text
Blocklist
-> Rate Limit
-> AI Pause
-> Human Takeover
-> Business Hours
-> Escalation
-> AI Reply
```

## New Layers

```text
src/vision
  OCR, image validation, normalization, metadata inspection

src/ai-agents
  Specialized agent adapters for food safety, management, operations, and audit

src/workflows
  Multi-step workflow orchestration for food safety, escalation, and human review

src/integrations
  Connector boundary for WhatsApp, Telegram, and future systems

src/knowledge
  Safe loader for structured knowledge files

src/audit
  Audit event logging boundary
```

## Structured Knowledge

```text
knowledge/food-safety
knowledge/operations
knowledge/stores
knowledge/faq
knowledge/rewards
```

Food safety fallback rules now live in `knowledge/food-safety/default-rules.json`. Google Sheet rules remain the preferred source of truth when the sheet is reachable and parses into a complete rule set.

## Food Safety Workflow

```text
WhatsApp Image
-> food-safety-workflow
-> food-safety-pipeline
-> image-analyzer / threshold-engine / warning-generator
-> SQLite audit + incidents
-> dashboard/API
```

In `FOOD_SAFETY_TEST_MODE=true`, images are processed only from explicit `FOOD_SAFETY_ALLOWED_CHAT_IDS`. An empty allow-list blocks all image processing.

## Database Expansion

Phase 3 adds:

```text
food_safety_incidents
image_audit
workflow_runs
```

Existing Phase 3 tables remain:

```text
food_safety_checks
food_safety_readings
food_safety_warnings
```

## Validation Gate

Every change must pass:

```bash
npm test
node tests/live/live-validator.js --no-telegram
.\pack.ps1
```
