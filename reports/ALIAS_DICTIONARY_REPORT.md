# Alias Dictionary Report
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V3 Closeout — D2

This is the canonical alias dictionary for Mi's CEO language understanding.
All aliases resolve to normalized form before pattern matching via `norm()`.

---

## Store Aliases

| Canonical | Aliases (normalized) | Intent trigger |
|-----------|---------------------|----------------|
| Raw Sushi | `raw`, `raw sushi`, `rawsushi` | store status → check_status |
| Raw Sushi (finance) | `raw sushi + [doanh thu/bao nhieu/lam an]` | → query_finance |
| Bakudan Ramen | `bakudan`, `ramen`, `bakudan ramen` | store status → check_status |
| Stockton | `stockton` | store status → check_status |
| Stone Oak | `stone oak`, `stone oaks`, `stoneoaks` | store status → check_status |
| Rim | `rim` | store status → check_status |
| Bandera | `bandera` | store status → check_status |

---

## Person Aliases

| Canonical | Aliases (normalized) | Role |
|-----------|---------------------|------|
| Maria | `maria` | Manager / recipient |
| Hoang | `hoang` | Self / CEO |
| Nguyen | `nguyen` | Staff / recipient |
| Anh | `anh`, `boss` | Self-reference |
| Team | `team`, `manager` | Group recipient |

---

## Action Aliases

| Canonical Action | Aliases (normalized) | Maps to intent |
|-----------------|---------------------|----------------|
| View/check | `coi`, `xem`, `kiem tra`, `check` | check_status or audit_project |
| View with courtesy | `coi gium`, `xem gium`, `kiem tra gium`, `kiem tra giup` | check_status |
| Audit/inspect | `audit`, `scan`, `phan tich`, `inspect`, `review` + [project] | audit_project |
| Send message | `gui`, `send`, `mail`, `nhan`, `nhan tin`, `email` + [person] | send_message |
| Notify | `thong bao`, `bao`, `notify`, `noti` | send_message |
| Create content | `tao`, `viet`, `lam`, `create`, `generate` + [content type] | build_feature |
| Write report | `tao bao cao`, `viet bao cao`, `create report` | create_report |
| Deploy | `deploy`, `len production`, `trien khai`, `phat hanh` | deploy_release |
| Fix bug | `fix`, `sua`, `debug`, `resolve` + `loi/bug` | fix_bug |
| Finance query | `doanh thu`, `revenue`, `bao nhieu tien`, `loi nhuan` | query_finance |
| Task query | `hom nay co viec gi`, `task`, `co gi can duyet` | query_personal_tasks |

---

## Time Window Aliases

| Canonical | Aliases (normalized) | Used in |
|-----------|---------------------|---------|
| Hôm nay | `hom nay`, `hnay`, `today` | finance, tasks |
| Tuần này | `tuan nay`, `this week` | finance |
| Tháng này | `thang nay`, `this month` | finance |
| Quý này | `quy nay`, `this quarter` | finance |
| Năm này | `nam nay`, `this year` | finance |

---

## Conjunction Aliases (multi-intent splitter)

| Vietnamese | Normalized | Type | Behavior |
|-----------|-----------|------|---------|
| và | `va` | parallel | A and B independent |
| rồi | `roi` | sequential | B depends on A |
| sau đó | `sau do` | sequential | B depends on A |
| cùng | `cung` | parallel | A and B independent |
| , (comma) | `,` | parallel | A and B independent |
| rồi báo anh | `roi bao anh` | report suffix | depends on ALL |
| rồi gửi Maria | `roi gui maria` | report suffix | depends on ALL |

---

## Filler Words (discarded by splitter)

These words when appearing as standalone fragments are discarded:
`roi`, `thi`, `va`, `cung`, `and`, `then`, `sau do`, `xong`, `ok`, `okay`, `oke`
