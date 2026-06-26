# Phase 3 Mi Mapping Report

Date: 2026-06-26

## Open Agent Builder -> Mi Workflow Studio

Mi Modules Affected:
- Mi-Core
- WhatsApp Gateway
- Dashboard
- Food Safety Bot
- Review Automation
- DoorDash Agent
- QB Activity Log
- SEO Agents

Integration Type:
- Adapter layer only
- No direct production dependency yet

Input:
- workflow JSON
- trigger event
- approval policy

Output:
- execution result
- audit log
- notification payload

Risk:
- workflow misfire
- unsafe action execution
- permission bypass

Required Guardrails:
- approval gate
- dry-run mode
- role permission
- audit log
- rollback

## OpenMontage -> Mi Video Agent

Mi Modules Affected:
- Mi-Core artifact system
- Dashboard documentation/training
- Brand/creative workflows

Integration Type:
- External VideoGenerationAdapter service
- No direct Mi-Core import

Input:
- title
- target role
- language
- duration
- screenshots folder
- voice option
- subtitle required

Output:
- script
- shot list
- subtitle file
- video plan
- optional final video artifact

Risk:
- model/license uncertainty
- generated media rights
- large file writes

Required Guardrails:
- artifact traceability
- approval before publishing
- external runtime boundary

## TTS Audio Suite -> Mi Voice Engine

Mi Modules Affected:
- Mi reports
- training video generation
- alert/briefing flows

Integration Type:
- External VoiceGenerationAdapter service

Input:
- text
- language
- voice profile
- subtitle timing request

Output:
- audio file
- optional SRT
- model/license metadata

Risk:
- voice cloning misuse
- model license limits
- unsafe audio generation

Required Guardrails:
- approved voice list
- no impersonation without approval
- artifact log

## WebLLM -> Mi Browser Local Assistant

Mi Modules Affected:
- Dashboard optional helper
- local explanation/summarization UI

Integration Type:
- BrowserLocalLLMAdapter
- No server action execution

Input:
- local question
- local dashboard text

Output:
- local explanation
- fallback if unsupported

Risk:
- browser compatibility
- local model download
- prompt confusion around actions

Required Guardrails:
- deny action commands
- no WhatsApp/QuickBooks/payroll actions
- no server calls

## Obscura -> Mi Browser Automation Lab

Mi Modules Affected:
- DoorDash automation lab
- Toast automation lab
- review scraping lab

Integration Type:
- BrowserAutomationAdapter lab only

Input:
- view-only test URL
- test action matrix

Output:
- screenshot
- DOM query result
- compatibility decision

Risk:
- credential handling
- anti-bot behavior
- browser profile leakage

Required Guardrails:
- no credential entry
- test accounts only if approved
- isolated browser profile

## Map3D -> Mi Digital Twin Lab

Mi Modules Affected:
- Food safety equipment map
- store layout planning
- future digital twin dashboard

Integration Type:
- DigitalTwinAdapter future module

Input:
- store zones
- equipment coordinates
- status values

Output:
- static/concept visualization
- feasibility report

Risk:
- low immediate production risk
- accuracy and maintenance burden

Required Guardrails:
- concept-only until real store survey
- no production dependency
