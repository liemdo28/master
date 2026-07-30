# Next Phase Plan

**Baseline:** `mi-master-phase-ready-v1`  
**Rule:** No new product feature starts until the checkpoint tag and zip backup exist.

## Mission

Transform Mi-Core into a WhatsApp-first CEO Operating System. The dashboard remains a secondary drill-down surface; the primary command, reporting, approval, and alert channel is WhatsApp.

## Operating Principle

The CEO should be able to run the company from the phone:

- Ask Mi questions in text or voice.
- Receive daily briefings and urgent alerts proactively.
- Review projects, risks, stores, reviews, disputes, payroll, QuickBooks, dev status, and approvals.
- Approve or reject governed actions from WhatsApp.
- Keep Postgres, MinIO, Qdrant, PM-Skill, ECC, and Superpowers as the execution backbone.

## Phase 21 — CEO Communication Layer

- Make `/api/whatsapp/mi` the primary command ingress.
- Support `/mi status`, `/mi today`, `/mi approvals`, `/mi health`, `/mi tasks`, `/mi alerts`, `/mi dashboard`.
- Preserve API key auth, replay protection, rate limiting, message log, and approval routing.
- Add attachment intake contracts for text, voice, images, and documents.
- Add output contracts for WhatsApp text, PDF, CSV, image, and voice responses.

## Phase 22 — PM-Skill

- Add PM command surface: `/mi roadmap`, `/mi sprint`, `/mi blockers`, `/mi risks`, `/mi projects`, `/mi assign`, `/mi progress`.
- Track roadmap, sprint, resources, dependencies, blockers, risks, and project status.
- Route assignment and write actions through approval plus queue governance.

## Phase 23 — Local AI Stack

- Use local AI as primary path for 95% of routine work.
- Target models:
  - Qwen3 8B/14B for reasoning.
  - BGE-M3 for embeddings.
  - BGE-Reranker for reranking.
  - Qwen-VL for vision.
  - PaddleOCR for OCR.
  - Whisper for speech-to-text.
  - Kokoro for text-to-speech.
- Keep cloud providers as explicit fallback for the remaining 5%.

## Phase 24 — Memory + Knowledge

- Route Qdrant to Supermemory to RAGFlow as the knowledge path.
- Support `/mi remember`, `/mi search`, `/mi history`, `/mi learn`.
- Classify memory writes as business, project, technical, personal, or sensitive.
- Require approval for sensitive or personal memory persistence.

## Phase 25 — Notification Engine

- Add proactive WhatsApp alerts.
- Support `/mi alerts`, `/mi mute`, `/mi watch`.
- Alert on connector failures, negative reviews, disputes, payroll exceptions, QA failures, release blockers, and critical runtime health.
- Add quiet hours and escalation rules.

## Phase 26 — Dev Command Center

- Support `/mi dev`, `/mi release`, `/mi qa`, `/mi security`, `/mi build`.
- Expose PM-Skill, ECC, Superpowers, QA, security, release readiness, and build status through WhatsApp.
- Keep deploys, destructive changes, financial changes, and permission changes approval-gated.

## Phase 27 — Business Operations

- Support `/mi stores`, `/mi reviews`, `/mi qb`, `/mi payroll`, `/mi disputes`.
- Integrate dashboard, QuickBooks, DoorDash, UberEats, Yelp, Google Reviews, payroll, and store operations.
- Keep public replies and financial-impact actions draft-first until approved.

## Phase 28 — CEO Daily Briefing

- Send a morning WhatsApp briefing designed for a 60-second read.
- Include top risks, today’s schedule, approvals, store issues, financial exceptions, dev blockers, and recommended decisions.
- Keep `/mi today` as the on-demand version.

## Phase 29 — Voice CEO Mode

- Add WhatsApp voice path: voice input to Whisper, Mi-Core processing, Kokoro voice response.
- Preserve text transcript and action audit.
- Require explicit approval before executing any write action inferred from voice.

## Phase 30 — Autonomous Assistant

- Execute approved actions through queue workers and connector adapters.
- Keep autonomy bounded by risk level, permissions, rollback plans, and audit logs.
- Add dry-run and post-action verification for every business-critical operation.

## Required Validation

- `npm run build`
- `npm run harness:test`
- `npm run bigdata:health`
- `npm run bigdata:sample`
- `npm run bigdata:search -- "Stone Oak issue"`
- `npm run bigdata:quality`
- `node scripts\mi-master-validate.js`

## Exit Criteria

- CEO can operate core company workflows from WhatsApp.
- `/mi` command set has deterministic routing before freeform AI fallback.
- WhatsApp approvals work for governed actions.
- Local AI, memory, alerts, dev, and business operation paths are documented and incrementally validated.
- A new checkpoint report, commit, tag, and zip backup are created before the next phase is declared ready.
