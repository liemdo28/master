# NLP Intent Layer Report

Date: 2026-06-05

## Added

Files:

- `src/nlp/intent-detector.js`
- `src/nlp/language-aware-normalizer.js`
- `src/nlp/entity-extractor.js`
- `src/nlp/command-resolver.js`

## Supported Languages

- English
- Spanish
- Vietnamese
- French

## Intents

START_AGENT, HELP, STATUS, CANCEL, CONFIRM, REENTER, SKIP, DAILY_ENTRY, BROTH_COUNT, TEMPERATURE_VALUE, LANGUAGE_QUESTION, GREETING.

## Routing

Priority remains:

1. Active session expected input
2. Exact slash command
3. NLP intent
4. Customer fallback

NLP handles natural starts like `bắt đầu`, `start`, `hola agent`, and multilingual greetings without falling into generic fallback.

## Runtime Wiring

- Natural `DAILY_ENTRY` and `START_AGENT` route to `/ldagent`.
- Direct greetings like `chào`, `hola`, `bonjour`, `hello` reply before fallback.
- `/ldagent` menu accepts natural daily-entry/broth/status phrases.
- Active workflows accept multilingual controls: cancel, confirm, re-enter, skip, status.

## Verification

- `node tests/nlp/nlp-intent-tests.js` PASS 10/10.
- `node tests/pilot/run-pilot-scenarios.js` PASS 136/136.
- Runtime after restart: Build ID `202606050136-e06e26c`, language engine `v2`, WhatsApp `ready`.
