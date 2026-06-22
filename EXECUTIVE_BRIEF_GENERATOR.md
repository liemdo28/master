# EXECUTIVE BRIEF GENERATOR — Phase 21G

## Purpose
Compress complexity into CEO-ready briefs. Never dump raw logs. Never dump technical noise.

## Rule
Every brief MUST follow:
1. **What changed** — the signal or event
2. **Why it matters** — business impact
3. **Risks** — what could go wrong
4. **Recommended actions** — specific next steps
5. **Confidence** — how sure Mi is (0-100%)

## Brief Types

### Quick Status
- For general status checks
- Fast, lightweight, current snapshot
- Company health + department scores + priorities

### Full Analysis
- For operational/technology/compliance concerns
- Includes: Intent → Plan → Reflection → Brief
- Shows confidence and assumptions

### Emergency
- For urgent interventions
- Immediate findings + emergency actions
- No lengthy analysis — action-first

### Strategic
- For business decisions and strategy
- Includes: Full analysis + Business reasoning + Decision matrix
- Ranked hypotheses with probability scores

## Dual Format Output
Every brief generates two formats:
1. **WhatsApp** — concise, emoji-rich, mobile-friendly
2. **Markdown** — detailed, structured, searchable

## Files
- `server/src/executive-intelligence/executive-brief.ts`

## Status: IMPLEMENTED ✅