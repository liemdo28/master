# Knowledge Base

Offline RAG knowledge base for the local-agent system.
**100% offline at query time** — no cloud, no API keys, no telemetry.

---

## Two distinct flows — DO NOT mix them up

```
┌─────────────────────────────────────────────────────────────────┐
│  BUILD FLOW  (dev / CI machine — needs internet)                │
│                                                                 │
│  npm run kb:ingest   → fetch ~1,300 Wikipedia articles          │
│  npm run kb:package  → dist/kb/knowledge.db.gz  (31 MB)         │
│  Upload .gz to GitHub Release  (tag: kb-vX.Y)                  │
│                                                                 │
│  Automated via .github/workflows/kb-release.yml on kb-v* tags  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ artifact transfer (file/USB/LAN)
┌─────────────────────────────────────────────────────────────────┐
│  DEPLOY / RUNTIME FLOW  (target machine — NO internet needed)   │
│                                                                 │
│  npm run kb:install <knowledge.db.gz>  → installs DB locally    │
│  npm run kb:stats                      → verify                 │
│  npm run kb:query "your question"      → offline search         │
│                                                                 │
│  Target machines NEVER run kb:ingest. No outbound calls.        │
└─────────────────────────────────────────────────────────────────┘
```

> **Policy:** target machines are firewall-blocked with no outbound internet.
> The OfflineGuard in local-agent blocks all `fetch()` calls at runtime.
> `kb:ingest` (which calls the Wikipedia API) MUST NOT run on target machines.

---

## BUILD FLOW — step by step

Run on a **dev or CI machine** with outbound internet.

```bash
# 1. Clone and install
git clone https://github.com/liemdo28/agent-coding
npm install

# 2. Fetch articles from Wikipedia (CC BY-SA 4.0) and build SQLite DB
#    ~8-12 min first run, seconds on re-runs (idempotent)
npm run kb:ingest

# 3. Package the DB into a distributable artifact
npm run kb:package
#    → dist/kb/knowledge.db.gz   (~31 MB compressed from ~88 MB)
#    → dist/kb/manifest.json     (stats + install instructions)

# 4. Attach dist/kb/knowledge.db.gz to a GitHub Release (tag: kb-v1.0, etc.)
#    Or transfer via any out-of-band method (USB, internal artifact store, etc.)
```

The CI workflow `.github/workflows/kb-release.yml` automates steps 2-4:
push a `kb-v*` tag and the release artifact is built and published automatically.

---

## DEPLOY / RUNTIME FLOW — step by step

Run on an **offline target machine** (no internet required).

```bash
# 1. Obtain knowledge.db.gz from a GitHub Release (on a machine with internet)
#    or transfer from the build machine via USB / internal network / artifact store.

# 2. Install the pre-built database
npm run kb:install /path/to/knowledge.db.gz
#    Extracts to: .local-agent/kb/knowledge.db
#    Backs up any existing DB to knowledge.db.bak

# 3. Verify
npm run kb:stats

# 4. Query — fully offline, instant
npm run kb:query "how does async/await work in JavaScript"
npm run kb:query "double-entry bookkeeping journal entries"
```

---

## How It Works (query path — 100% offline)

```
Query (offline, instant)
──────────────────────────
SQLite FTS5 (porter stemming)
      ↓ candidates (up to 50)
TF-IDF cosine re-rank (in-memory)
      ↓
Ranked results with attribution + license
```

None of the query-path modules (`KBQuery.js`, `KBDatabase.js`, `EmbeddingEngine.js`,
`KnowledgeBase.js`, `ChunkEngine.js`) make any network calls.
Verified: `grep -r "fetch\|http\|axios\|got" kb/KBQuery.js kb/KBDatabase.js` → no matches.

---

## CLI Commands

```bash
node bin/kb.js query "your question"          # search all domains
node bin/kb.js query "question" -d coding     # filter by domain
node bin/kb.js query "question" -k 10         # top-10 results
node bin/kb.js list [domain]                  # browse documents
node bin/kb.js stats                          # database statistics
node bin/kb.js sources [domain]               # show source audit
node bin/kb.js rebuild-index                  # rebuild TF-IDF index
```

npm shortcuts:
```bash
npm run kb:query "question"   # → node bin/kb.js query
npm run kb:stats              # → node bin/kb.js stats
```

---

## Database Location

After install, the database lives at:

```
.local-agent/kb/knowledge.db    ← SQLite database (WAL mode)
.local-agent/kb/idf.json        ← TF-IDF term weights (rebuilt automatically)
```

Both paths are in `.gitignore`. The `kb/` source directory (article lists, pipeline code) IS committed.

---

## Statistics (last ingest: 2026-05-18)

| Domain | Documents | Chunks | Words |
|---|---|---|---|
| coding | 219 | 2,305 | 694,174 |
| machine-learning | 131 | 1,940 | 547,343 |
| marketing | 129 | 1,471 | 455,127 |
| hr | 105 | 1,498 | 466,319 |
| website | 114 | 774 | 235,417 |
| design | 110 | 1,045 | 318,608 |
| accounting | 139 | 1,199 | 365,795 |
| data-analyst | 108 | 1,195 | 347,200 |
| business-analyst | 110 | 933 | 285,482 |
| logistics | 100 | 1,101 | 340,674 |
| **TOTAL** | **1,265** | **13,461** | **4,056,139** |

See `kb/stats.json` for the full breakdown including per-topic counts and sample documents.

---

## Source Policy

All ingested content is **CC BY-SA 4.0** (Wikipedia contributors).
Every document includes attribution in its footer.

Proprietary sources (Investopedia, HubSpot, Apple HIG, SHRM, BABOK, Incoterms) are marked
`"recommend": "reference"` in `kb/sources/*.json` and were **not** ingested.

---

## Extending the KB

Add more topics by editing `kb/domains/<domain>-articles.js` and re-running the BUILD FLOW:

```bash
# On an internet-connected build machine:
npm run kb:ingest               # adds new articles, skips existing ones
npm run kb:package              # repackage
# → attach new dist/kb/knowledge.db.gz to a new GitHub Release tag
```

To add a new domain, create `kb/domains/<slug>-articles.js` and `kb/sources/<slug>.json`,
then add the slug to the `DOMAINS` array in `scripts/kb-ingest.js`.

---

## Technical Notes

- **WikipediaFetcher User-Agent:** `local-offline-kb/1.0 (https://github.com/liemdo28/agent-coding; contact: kb-build)` — follows Wikimedia policy
- **Rate limiting:** 220ms between requests (~4.5 req/s), well under the 200 req/s API limit
- **Retry logic:** exponential backoff (0.5s → 1s → 2s) on 429 / 5xx / network errors
- **FTS5 tokenizer:** `porter unicode61` — Porter stemming, Unicode-aware
- **Chunking:** 400-word windows with 80-word overlap, prefers paragraph boundaries
- **TF-IDF:** smoothed IDF, light Porter stemmer, English stop-word list
- **WAL checkpoint:** `PRAGMA wal_checkpoint(TRUNCATE)` run before packaging to ensure DB is self-contained
- **Compression:** gzip level 9 (~88 MB → ~31 MB, 34.9% of original)
