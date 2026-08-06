# Phase 5D-1 — knowledge security

## Threat model

Documents are files the owner points Mi at. Two things can go wrong: Mi ingests a
credential and later quotes it back, or Mi is pointed — deliberately or by accident — at
a file outside what was approved. Both are handled before any content is persisted.

## Path boundary

Every ingestion resolves through one gate. Containment is checked on the **real** path
after symlink and junction resolution, so a link inside an approved root that targets
something outside is rejected (`LINK_ESCAPE`), not followed. Traversal is rejected on the
raw request string before the filesystem is touched, because `path.join` collapses `..`
before any check could see it.

Windows specifics handled explicitly: drive-letter case is normalised, the `\\?\` and
`\\?\UNC\` namespace prefixes are stripped, and UNC paths outside approved roots are
refused.

Tested rejections: traversal (absolute and relative), absolute outside root, missing
file, no roots configured, UNC, foreign drive, symlink escape, junction escape, and 16
excluded path classes including `.env`, `node_modules`, `.git`, `dist`, `build`,
`coverage`, `logs`, `secrets/`, `service-account*.json`, `*.pem`, `*.db`,
`whatsapp/session.json`, `.wwebjs_auth`, `google-tokens.json` and PM2 backups.

## Secret scanning

Detection targets **values, not vocabulary** — that distinction is the whole design.
Rejecting every file containing the word "password" would make the feature useless.

Detected: private keys, SSH material, service-account JSON (by shape), OAuth tokens,
bearer tokens, `sk-` API keys, `ghp_`-style VCS tokens, AWS `AKIA`/`ASIA` keys,
connection strings **carrying a real password**, password and API-key assignments,
`.env`-style assignments of `*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`, session
cookies and WhatsApp session values.

Passing as ordinary prose, all covered by tests:

- "token budget", "password policy", "API key rotation procedure"
- "Bearer authentication is documented in RFC 6750"
- "a private key concept is explained in the appendix"
- a documented connection-string format with placeholder user and password
- an environment example whose value is an angle-bracket placeholder
- `password = changeme`
- a shell export whose value is a variable reference rather than a literal

A placeholder guard rejects values that are too short, all one repeated character, or
match known placeholder shapes (angle brackets, double braces, shell interpolation,
`your-*`, `example*`, `changeme`, `todo`, and similar).

**A secret-bearing document is never persisted.** The scan runs on raw bytes before
parsing; on a hit, no document row and no chunk is created. Only the job record survives,
holding a category list and a redacted preview of the form
`line 42: …context [REDACTED 48 chars]…`. The original value appears nowhere — not in the
preview, not in the job, not in logs. Sections are scanned a second time before chunk
persistence, so a credential introduced by a parser transform still cannot slip through.

## API boundary

Strict API-key auth including localhost, 1 MB JSON limit, strict document-id pattern.
Errors are classified to 400/401/404/409/413 and run through a path redactor, so no
response contains an absolute path or a parser stack trace. There is no endpoint that
registers a new approved root, and no ingest-everything endpoint — `/ingest-all`,
`/full-rebuild` and `/watch` are asserted to 404.

## Known limitations

- PDF text extraction is unavailable (`pdf-parse` not installed), so PDFs are refused
  rather than scanned. When it is enabled, PDF text will need the same scan.
- The YAML subset refuses anchors, aliases, tags and merge keys rather than evaluating
  them. That is deliberate, but it means some valid YAML fails instead of ingesting.
- Sensitivity is currently derived from the root kind (project → `INTERNAL`, approved
  file → `PRIVATE`). Per-document classification arrives with retrieval in Phase 5D-2.
