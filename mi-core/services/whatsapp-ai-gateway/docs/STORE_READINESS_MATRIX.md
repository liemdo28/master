# Store Readiness Matrix

Date: 2026-06-04
Author: Dev #2 (Operational Readiness, no runtime changes)
Scope: SECTION 3 — per-store operational readiness for Test, Stone Oak, Bandera, Rim.

## Important note on WhatsApp group mapping

The CEO directive requires honest reporting: **no real group → store mapping
has been verified in this session.** Live `/api/admin/store-groups` calls and
"Refresh Groups" depend on the `localhost:3210` runtime, which belongs to
Dev #1. The matrix below reports the **code surface** (what is wired and
ready) and explicitly marks "physical WhatsApp group" cells as `pending`.

## Code surface (verified)

| Capability | File | Status |
|---|---|---|
| `store_groups` table with `active` + `locked` columns | `src/stores/store-registry.js` | exists |
| `upsertMapping`, `resolveGroup`, `isGroupLocked` | `src/stores/store-registry.js` | exists |
| `STORES` enum | `src/stores/store-registry.js` | `stone_oak`, `bandera`, `rim`, `test` |
| Admin endpoints: list / refresh / map / lock / unlock | `src/api/server.js` `/api/admin/store-groups/*` | exists |
| Setup-status consumer (returns PASS/NEEDS_ACTION per store) | `src/api/server.js` `/api/admin/setup-status` | exists |
| Lock semantics (locked cannot be overridden) | `src/stores/store-registry.js` `isGroupLocked` | exists |

## Per-store matrix

| Store | Group | Locked | Manager Alert | Sheet | OCR | YoLink | Pilot Ready | Blocker |
|---|---|---|---|---|---|---|---|---|
| **Test** | pending (operator runs "Refresh Groups" in Admin Control Center) | optional (lock recommended before Day 0) | n/a for Test (Test group is its own notification target) | template + log URLs set in `.env`; live write SENT | PASS (Tesseract 5.4.0 + OpenCV 4.13.0 + sharp) | optional (human path only is acceptable for Test) | ready after physical group mapped + manager alert group set in `.env` or DB | operator: paste Test group `chat_id` in Admin Control Center |
| **Stone Oak** | pending (operator) | pending (lock required before Day 0) | shared with manager alert group (configured once) | template + log URLs set; service account can read/write | PASS (same as Test) | pending — CEO seed device `d88b4c01000f1398` for Walk-in Cooler; runtime BLOCKED (no YOLINK creds) → human path only | blocked until (a) group locked, (b) YOLINK creds added or operator accepts degraded | operator: map + lock group; optional: add YOLINK creds |
| **Bandera** | pending (operator) | pending | shared | template + log URLs set | PASS | pending — CEO seed device `d88b4c01000f176f`; runtime BLOCKED → human path only | blocked until group locked (or operator accepts degraded) | operator: map + lock group |
| **Rim** | pending (operator) | pending | shared | template + log URLs set | PASS | pending — CEO seed device `d88b4c01000f069b`; runtime BLOCKED → human path only | blocked until group locked (or operator accepts degraded) | operator: map + lock group |

## How to read this matrix

- **Group / Locked / Manager Alert / Sheet / OCR** columns are `PASS` once
  the operator pastes values in Admin Control Center and clicks the
  corresponding Test button. They are `pending` until that happens.
- **OCR** is the only column that is already `PASS` at the system layer
  (Tesseract + OpenCV + sharp are installed on the host — see
  `docs/OCR_OPERATIONAL_AUDIT.md`).
- **YoLink** is `BLOCKED — awaiting API credentials` at the runtime layer.
  The CEO seed devices are visible in the dashboard's "Seed CEO Devices"
  button and can be saved into the local sensors table without credentials.
  Reading actual values requires `YOLINK_CLIENT_ID` + `YOLINK_CLIENT_SECRET`.
- **Pilot Ready** is a derived row. It becomes `READY FOR PILOT` only when
  `setupStatus.allPass` from `/api/admin/setup-status` is `true` for the
  Test store first; the three production stores require a physical
  WhatsApp group for the lock step.

## Acceptance gate

The Day-0 acceptance gate is:

1. Test group is mapped + locked + manager alert group is set +
   `template_sync=PASS` + `google_sheet_links=PASS` +
   `store_mappings_locked=PASS` for at least Test.
2. Stone Oak, Bandera, Rim mappings are at least *configured*; lock is
   recommended but can be deferred if Day 0 is Test-only.

If the operator cannot satisfy #1 above, the verdict in
`docs/OPERATIONAL_READINESS_REPORT.md` is `BLOCKED` (waiting on operator
input, not Dev #1 runtime).

## Locked / unlock behavior (verified in code)

- `isGroupLocked(chatId)` checks env first (`STORE_GROUPS_LOCKED`), then DB.
- `upsertMapping` rejects a new mapping with the same `chat_id` and a
  different `store_id` when the existing row is `locked=1`. The lock
  flag is preserved on conflict.
- A new chat_id can always be added; only changing the `store_id` of a
  locked mapping is blocked.

## Conclusion

Readiness is fully observable from existing endpoints and dashboard
panels. The Dev #2 audit confirms every cell has either a `PASS` (system
layer) or an explicit `pending` / `BLOCKED` annotation. **No fake group
mapping has been recorded.** Pilot go-live is gated on operator action
(paste chat_ids in Admin Control Center) and the CEO adding YoLink
credentials if sensor cross-validation is desired for Day 0.

No runtime code, dashboard render, or `localhost:3210` work was modified.
