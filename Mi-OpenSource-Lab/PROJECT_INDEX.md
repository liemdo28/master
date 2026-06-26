# Mi Open-Source Extension — Project Index

**Version:** 1.0.0 | **Date:** 2026-06-26

---

## Target Projects

| # | Project | Purpose | Mi Fit | Priority | Decision |
|---|---------|---------|--------|----------|----------|
| P1 | Open Agent Builder | Visual workflow builder | High | P1 | Audit |
| P2 | OpenMontage | AI video generation | High | P2 | Audit |
| P3 | TTS Audio Suite | Voice / TTS engine | High | P3 | Audit |
| P4 | WebLLM | Browser-side local LLM | Medium-High | P4 | Audit |
| P5 | Obscura Browser | Browser automation lab | Medium | P5 | Lab Only |
| P6 | Map3D | Digital twin / store map | Low | P6 | Future |

---

## Mi Integration Targets

| Mi Module | Source Project | Adapter Required | Status |
|-----------|---------------|-----------------|--------|
| Mi Workflow Studio | Open Agent Builder | ✅ WorkflowBuilderAdapter | Phase 4 |
| Mi Video Agent | OpenMontage | ✅ VideoGenerationAdapter | Phase 4 |
| Mi Voice Engine | TTS Audio Suite | ✅ VoiceGenerationAdapter | Phase 4 |
| Mi Browser Local Assistant | WebLLM | ✅ BrowserLocalLLMAdapter | Phase 4 |
| Mi Browser Automation Lab | Obscura Browser | ✅ BrowserAutomationAdapter | Phase 4 |
| Mi Digital Twin Lab | Map3D | ✅ DigitalTwinAdapter | Phase 4 |

---

## Mi-Centric Contract

Every adapter MUST follow the Mi-Core API contract:

```
Adapter → POST /api/mi/intake/event
Adapter → POST /api/mi/approval/request  (if action requires approval)
Adapter → POST /api/mi/workflows/log     (after execution)
```

Adapter MUST NOT:
- Call production n8n workflows directly
- Modify Mi/n8n/workflow JSON files
- Access WhatsApp gateway without approval gate
- Store credentials in repo

---

## Audit Checklist

- [ ] Repo URL verified
- [ ] License identified
- [ ] Main language confirmed
- [ ] Runtime requirements documented
- [ ] Install method verified
- [ ] Port usage identified
- [ ] Docker support confirmed
- [ ] API/CLI/UI support mapped
- [ ] Auth support assessed
- [ ] Security risks enumerated
- [ ] Maintenance status verified
- [ ] Open issues count recorded
- [ ] Production readiness evaluated
- [ ] Mi use case fit scored
- [ ] License compatibility checked (AGPL/GPL risk)

---

## Reports Deliverables

| Report | Phase | Location |
|--------|-------|----------|
| PHASE_1_AUDIT_REPORT.md | Phase 1 | reports/ |
| PHASE_2_LAB_INSTALL_REPORT.md | Phase 2 | reports/ |
| PHASE_3_MI_MAPPING_REPORT.md | Phase 3 | reports/ |
| MI_OPEN_SOURCE_ADAPTER_ARCHITECTURE.md | Phase 4 | docs/ |
| PHASE_5_POC_WORKFLOW_STUDIO.md | Phase 5 | reports/ |
| PHASE_6_POC_VIDEO_AGENT.md | Phase 6 | reports/ |
| PHASE_7_POC_VOICE_ENGINE.md | Phase 7 | reports/ |
| PHASE_8_POC_WEBLLM.md | Phase 8 | reports/ |
| PHASE_9_OBSCURA_BROWSER_LAB.md | Phase 9 | reports/ |
| PHASE_10_MAP3D_DIGITAL_TWIN_LAB.md | Phase 10 | reports/ |
| PHASE_11_SECURITY_LICENSE_REVIEW.md | Phase 11 | reports/ |
| FINAL_RECOMMENDATION.md | Phase 12 | reports/ |

---

## Lab Branch

```
Branch: mi-open-source-extension-lab
Created: 2026-06-26
Base: master
Status: Isolated — no production merge without CEO approval