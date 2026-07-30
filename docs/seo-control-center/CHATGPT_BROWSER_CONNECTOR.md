# ChatGPT Browser Connector

Per the CEO's requirement, this system does **not** use the OpenAI API. Content generation goes through a Playwright-automated session on the CEO's own logged-in `chatgpt.com` browser account, with a manual copy/paste fallback and a local-model option for low-risk tasks.

## How it works

- `mi-core/server/src/seo/ai-providers/chatgpt-browser-provider.ts` launches a **persistent** Chromium profile at `.local-agent-global/seo/chatgpt-browser-profile/`. This is exactly like a normal Chrome profile directory — it holds session cookies, nothing else. No password is ever read, typed, or stored by this code.
- The provider reuses one "SEO workspace" conversation thread across jobs (tracked in `.local-agent-global/seo/chatgpt-conversation-state.json`).
- Idempotency: a prompt submitted with a previously-used `idempotency_key` returns the cached response instead of re-submitting.
- Secrets: every prompt is passed through `redact.ts` before it's typed into the browser — API keys, tokens, passwords, and JWT-shaped strings are stripped to `[REDACTED]`.

## First-time setup (the CEO must do this once)

```bash
cd mi-core/server
npx tsx src/seo/ai-providers/chatgpt-manual-login.ts
```

This opens a **headed** (visible) Chromium window using the same persistent profile the automated provider will later reuse headlessly. Log into chatgpt.com by hand, including any 2FA challenge. Once the message composer is visible, close the window — the session is saved to disk and the headless provider will pick it up on the next job.

## What happens on session expiry, CAPTCHA, or MFA

The provider **never** attempts to solve a CAPTCHA or bypass MFA — both are treated identically to "not logged in":
1. The job is marked `waiting_for_login` in `seo_ai_jobs`.
2. Evidence is recorded.
3. A WhatsApp message is sent to the CEO with the exact re-login command.
4. The job stays queued — no retry loop, no silent failure.

Run the manual-login command again whenever this happens.

## Fallbacks

- **Manual paste** (`manual-paste-provider.ts`): writes the (redacted) prompt to a job row with status `waiting_for_manual_paste`. The dashboard's Evidence/Reports flow (or a direct `submitManualResponse(jobId, text)` call) lets the CEO paste the ChatGPT answer back in by hand — useful if browser automation is temporarily broken by a ChatGPT UI change.
- **Local model** (`local-model-provider.ts`): routes to the existing local Ollama models via `provider-router.ts`, for low-risk classification/QA tasks only — not primary article generation, per the CEO's requirement that ChatGPT stay the primary content-writing provider.

## Current status

**CONFIGURED, not CONNECTED or LIVE_VERIFIED.** The code is real and compiles cleanly, but no one has run the manual-login script or submitted a real job in this build. Before relying on it: run the login script above, then trigger one real job through `submitAiJob()` and confirm a genuine ChatGPT response comes back.

## Known fragility

ChatGPT's DOM changes periodically. The provider uses redundant fallback selectors for the composer/send/stop/regenerate buttons, but if OpenAI changes the UI enough, the failure mode is a clean timeout/error (job marked `failed`, evidence recorded) — never a silent wrong action. If jobs start failing after a ChatGPT UI update, the selectors in `chatgpt-browser-provider.ts`'s `SEL` object are the first place to check.
