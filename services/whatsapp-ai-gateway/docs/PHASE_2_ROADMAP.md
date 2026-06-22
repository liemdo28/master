# Phase 2 Roadmap — Bakudan AI Operations

## Prerequisites

Phase 1 and Phase 1.1 must be closed via successful 7-day operational pilot.

---

## Phase 2A — Vision Incident Assistant

**Status:** Blocked by pilot gate
**Dependencies:** None (no hardware, no external API)

### Scope
- Vision Incident Assistant
- Auto Incident Report from employee-submitted photos

### Why First
- No hardware dependency
- No external API dependency
- Testable immediately with real photos
- Highest operational value after daily entry logging
- Reduces manual incident documentation burden

### Deliverables
- Photo submission via WhatsApp
- AI-powered incident detection and classification
- Auto-generated incident report
- Incident log with audit trail
- Manager notification for critical incidents

---

## Phase 2B — YoLink Discovery Audit

**Status:** Blocked by Phase 2A completion
**Dependencies:** YoLink hardware access

### Scope
Verify integration feasibility before writing any integration code.

### Audit Checklist
- [ ] YoLink Hub — physical device accessible and powered
- [ ] YoLink API — documentation reviewed, endpoints verified
- [ ] MQTT — broker connectivity tested
- [ ] Cloud — YoLink cloud account configured
- [ ] Auth — API keys/tokens obtained and validated

### Deliverables
- `docs/YOLINK_DISCOVERY_AUDIT.md` — full audit report
- GO / NO-GO recommendation for Phase 2C

---

## Phase 2C — YoLink Integration

**Status:** Blocked by Phase 2B audit
**Dependencies:** Phase 2B audit must PASS

### Scope
- Real-time sensor data ingestion
- Temperature/humidity monitoring
- Automated alerts for out-of-range readings
- Sensor data logging to Google Sheets
- Dashboard sensor panel

### Gate
Do NOT begin Phase 2C until YoLink Discovery Audit is complete and passes.

---

## Timeline

```
Phase 2A → Immediately after pilot PASS
Phase 2B → After Phase 2A core features ship
Phase 2C → After Phase 2B audit PASS only
```

## Decision Authority

All phase transitions require CEO approval.
