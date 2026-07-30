# CEO Directive — Final Operational Pilot Gate

## Status

| Phase | Status |
|-------|--------|
| Phase 1 | COMPLETE |
| Phase 1.1 | COMPLETE |
| Phase 2A | READY TO START (blocked by pilot) |

---

## Directive

No additional core features should be built until operational pilot validation is complete.

The only thing missing is:

```
Real people using it in real life.
```

---

## Pilot Configuration

**Duration:** 7 consecutive days

**Stores:**
- Stone Oak
- Bandera
- Rim

**Staff:** 3 store groups, real employees

---

## Pre-Pilot Requirements

1. Map and lock all 3 store groups
2. Configure manager alert group
3. Configure daily health report
4. Verify Google Sheet write queue
5. Verify audit trail logging

---

## During Pilot — Track

| Metric | Description |
|--------|-------------|
| Daily Entry Started | Employee initiated `/ldagent` Daily Entry |
| Daily Entry Completed | Entry confirmed and written to sheet |
| Completion Time | Time from start to confirm |
| Warnings | Out-of-range values flagged |
| Manager Alerts | Alerts sent to manager group |
| Missing Logs | Stores that did not submit |
| Language Used | en / es / vi |
| Sheet Queue Events | Queue successes and failures |

---

## Dashboard

Add **Pilot Metrics** panel to admin dashboard showing:
- Pilot status (active/inactive, day X of 7)
- Per-store completion rate
- Average completion time
- Warning count
- Missed logs
- Queue failures
- Daily report delivery status

---

## Success Criteria

| Store | Target |
|-------|--------|
| Stone Oak | ≥95% completion |
| Bandera | ≥95% completion |
| Rim | ≥95% completion |

Additional:
- No data loss
- Audit trail complete
- Manager alerts functioning
- Daily health report functioning

---

## Post-Pilot Decision

### If PASS

Close:
- Phase 1
- Phase 1.1

Authorize:
- Phase 2A — Vision Incident Assistant + Auto Incident Report

### If FAIL

Identify root causes, remediate, and re-run pilot.

---

## Phase Roadmap (Post-Pilot)

### Phase 2A — Vision Incident Assistant
- Auto Incident Report from photos
- No hardware dependency
- No API dependency
- Testable immediately with images
- Highest operational value next

### Phase 2B — YoLink Discovery Audit
- Verify: Hub, API, MQTT, Cloud, Auth
- Hardware dependency assessment
- Integration feasibility report

### Phase 2C — YoLink Integration
- Only after Phase 2B audit is complete
- Do NOT begin Phase 2C until YoLink Discovery Audit passes

---

## CEO Recommendation

No missing modules for Phase 1. The system is code-complete.

The only remaining validation is operational:

```
3 stores. 3 groups. 1 week. Real usage.
```

If pilot passes, Phase 2A (Vision Incident Assistant) delivers the highest value next for Bakudan operations.
