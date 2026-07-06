# BILINGUAL VOICEOVER SYSTEM — ADMIN GUIDE

## Overview

The Admin module is a no-code interface integrated into the existing admin dashboard. It allows non-technical operators to generate English and Vietnamese voiceovers, manage voice profiles, edit the pronunciation dictionary, review QA reports, and approve jobs.

## Quick Start

1. Open the Admin Dashboard (http://localhost:5173)
2. Navigate to "Voiceover Jobs"
3. Click "+ New Job"
4. Fill in fields below
5. Click Save Draft
6. Click Translate to generate VI script
7. Review/approve scripts
8. Click Generate Preview to hear a 10-second sample
9. Click Generate Both to start full generation

## Required Form Fields

- Project name
- Source language (EN or VI)
- Output languages (EN, VI, or both)
- Original script
- Voice profile (optional)
- Speaking speed (0.5–2.0)
- Emotion (professional, friendly, etc.)
- Pronunciation dictionary
- Output format (WAV, MP3, both)
- Video upload (optional, for dubbing)
- Background volume
- Voice volume
- Subtitle toggle

## Available Actions

- Save Draft
- Translate
- Normalize
- Generate 10-second Preview
- Generate English
- Generate Vietnamese
- Generate Both
- Regenerate Selected Segment
- Approve
- Reject
- Export
- Archive
- Delete

## Voice Library

Section for managing reusable voice profiles. Each profile stores language support, gender, style, source engine, reference audio, and consent metadata.

Actions: Create, Edit, Test Pronunciation, Delete.

## Pronunciation Dictionary

Shared term-by-language dictionary applied before TTS synthesis. Admin can add, edit, disable, or override rules per project.

## QA Reports

Each completed job produces a QA report showing similarity scores per segment, engine used, retries, and recommendations.

## Mi Workflow

The Admin module is the human-facing side of the Mi loop. Mi emits requests through ChatMi, the Admin processes them, results are reported back to Mi and the CEO.


