# Phase 11 Security and License Review

Date: 2026-06-26

## Decision Table

| Project | License Risk | Security Risk | Commercial Risk | Recommendation |
|---|---|---|---|---|
| Open Agent Builder | Medium until license file verified | Medium: workflow execution and web requests | Medium | Adapter only; no direct Mi-Core embedding |
| OpenMontage | High until dependency/model licenses verified | High: media pipeline, shell/file writes, model downloads | High | External service only after approval |
| TTS Audio Suite | High until model/voice licenses verified | High: voice cloning and model downloads | High | External Voice Engine with approval policy |
| WebLLM | Medium until package/model licenses verified | Medium: local model download/browser capability | Medium | Optional local helper; no actions |
| Obscura | High until repo and browser profile safety verified | High: browser automation and credentials | Medium-High | Lab research only |
| Map3D | Low-Medium until license verified | Low in mock form | Low | Future concept only |

## Required Controls

- If AGPL/GPL risk affects Mi-Core, do not embed directly.
- Use external service boundary for copyleft or uncertain licenses.
- If model license is unclear, block production.
- If browser tool stores credentials unsafely, block production.
- If TTS voice cloning is enabled, require explicit approval policy.
- All generated media must include source text, model, voice, and timestamp metadata.
- All browser automation must use isolated profiles and no real credentials during lab tests.

## Final Security Status

PARTIAL PASS. Lab artifacts are safe because they contain no upstream source, no keys, no models, no generated media binaries, and no production writes. Production integration remains blocked pending license and dependency verification.
