# DUPLICATE_DETECTION_OPERATIONAL.md
**Status:** OPERATIONAL | **Phase:** 0E | **Engine:** `src/executive-coordination/duplicate-detector.ts`

## Matching Algorithm
Composite confidence score from: title-similarity (Levenshtein), token-similarity (Jaccard), description-similarity, same-objective bonus, same-division bonus, same-owner bonus.

## Thresholds
- >85%: Do not create, link to existing, return warning
- 60-85%: Create review item, require coordinator approval
- <60%: Allow creation

## API Proof
POST /api/coordination/duplicates/check | GET /api/coordination/duplicates | POST /api/coordination/duplicates/:id/merge | POST /api/coordination/duplicates/:id/ignore

## Certification Test
Create "Run SEO audit for Bakudan" then "Check Bakudan SEO audit" → duplicate detected (confidence >60%). No second uncontrolled task.
