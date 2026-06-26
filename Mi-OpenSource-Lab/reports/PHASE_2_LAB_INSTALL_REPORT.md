# Phase 2 Lab Install Report

Date: 2026-06-26
Policy: no production modification, no automatic model downloads, no secrets.

## Install Summary

The lab directory structure exists for all six projects. Full runtime installs were not executed automatically because several candidates can download large models, browser binaries, media assets, or execute shell/plugin code. Install scripts are provided as guarded dry-run harnesses.

| Project | Runtime Folder | Install Status | Dev Server | Build | Health Check | Errors | Fixes Applied | Next Step |
|---|---|---|---|---|---|---|---|---|
| Open Agent Builder | `01-open-agent-builder/runtime` | Pending guarded clone/install | Not started | Not run | Folder exists | License metadata unknown | Adapter docs created | Verify license, then clone in lab |
| OpenMontage | `02-openmontage/runtime` | Blocked pending approval | Not started | Not run | Folder exists | Media/model pipeline risk | POC plan created | Approve external-service install |
| TTS Audio Suite | `03-tts-audio-suite/runtime` | Blocked pending approval | Not started | Not run | Folder exists | Model/voice cloning risk | Voice POC text/SRT created | Approve model list/license |
| WebLLM | `04-webllm/runtime` | Pending browser demo | Static demo only | Not required | Demo exists | WebGPU may be unavailable | Fallback UX created | Test in Chrome with WebGPU |
| Obscura Browser | `05-obscura-browser/runtime` | Lab only, not installed | Not started | Not run | Folder exists | Credential/browser automation risk | Test matrix created | Verify repo and run view-only tests |
| Map3D | `06-map3d/runtime` | Future concept only | Static demo only | Not required | Demo exists | None for mock | Mock store data created | Pick real map engine later |

## Guarded Install Rule

Before any install:

1. Confirm repo URL and license file.
2. Run in the matching `runtime` folder only.
3. Do not commit `node_modules`, `venv`, models, videos, generated audio, browser profiles, or credentials.
4. Log install output to `reports/PHASE_2_LAB_INSTALL_REPORT.md`.

Status: PARTIAL PASS.
