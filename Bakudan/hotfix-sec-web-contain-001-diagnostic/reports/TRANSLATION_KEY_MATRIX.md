# Translation Key Matrix

**Date:** 2026-06-22
**Total Keys:** 811 per locale
**Locales:** en-US, es-US, vi-VN

## Key Naming Convention

Keys use dot-notation structured format:
```
{module}.{submodule}.{element}
```

### Modules
| Module | Description | Key Count |
|--------|-------------|-----------|
| app | Application name | 1 |
| lang | Language labels | 3 |
| nav | Navigation items | 22 |
| header | Header elements | 5 |
| page | Page titles | 16 |
| settings | User settings | 15 |
| auth | Authentication | 26 |
| dashboard | Dashboard view | 20 |
| dashboard.kpi | KPI card labels | 3 |
| dashboard.finance | Finance panel | 4 |
| dashboard.operations | Operations panel | 1 |
| overview | Management overview | 45 |
| executive | Executive digest | 5 |
| ceo | CEO dashboard | 4 |
| task | Task CRUD & form | 55 |
| tasks | Task list view | 11 |
| new_tasks | New tasks | 7 |
| bill/bills | Bill tracking | 35 |
| store | Store module | 40 |
| vendor | Vendor management | 20 |
| project | Project module | 30 |
| calendar | Calendar view | 12 |
| inbox | Inbox module | 4 |
| admin | Admin panel | 20 |
| asana | Asana integration | 20 |
| ai_import | AI import | 40 |
| email | Email templates | 12 |
| notif/notification | Notifications | 10 |
| filter | List filters | 6 |
| create | Create new menu | 6 |
| quick_task | Quick task modal | 15 |
| common | Shared elements | 25 |
| upload | Upload errors | 3 |
| status | System statuses | 19 |
| button | Button labels | 12 |
| empty | Empty states | 5 |
| error | Error states | 4 |
| drawer | Drawer panels | 3 |
| mobile | Mobile nav | 5 |
| penalty | Penalty module | 3 |
| release | Release center | 3 |
| seed | Seed data | 2 |

## Example Key Mappings

| Key | en-US | es-US | vi-VN |
|-----|-------|-------|-------|
| dashboard.kpi.cash_risk | Total Cash Risk | Riesgo de Efectivo Total | Tổng rủi ro tiền mặt |
| status.overdue | Overdue | Vencida | Quá hạn |
| status.completed | Completed | Completada | Hoàn thành |
| button.save | Save | Guardar | Lưu |
| empty.no_results | No results found | No se encontraron resultados | Không tìm thấy kết quả |
| error.internal | An internal error occurred | Ocurrió un error interno | Đã xảy ra lỗi nội bộ |
| mobile.nav.home | Home | Inicio | Trang chủ |

## Adding New Keys

1. Add key to `scripts/gen_lang.py` in the `NK` dict with (en, es, vi) values
2. Run `python scripts/gen_lang.py` to regenerate language files
3. Run `scripts/verify-translations.php` to validate
4. Deploy will block if verification fails
