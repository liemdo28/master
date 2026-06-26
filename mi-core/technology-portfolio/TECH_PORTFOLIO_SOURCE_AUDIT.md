# Technology Portfolio Source Audit

Status: PARTIAL
Canonical source: `mi-core/server/src/technology-portfolio-office/`

The expected directive path `mi-core/server/src/technology-portfolio/` is not present. To avoid duplicate architecture, the current canonical source remains `technology-portfolio-office` and is documented in `SOURCE_STRUCTURE_ALIGNMENT.md`.

Source modules:
- `portfolio-registry.ts`
- `portfolio-scorecard.ts`
- `portfolio-dashboard.ts`
- `seed-portfolio.ts`
- `types.ts`

Runtime test:
- `node tests\phase06-technology-portfolio-runtime-test.mjs`

Certification gap closed in this pass:
- Seed registry now contains at least 20 assets.
