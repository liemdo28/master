# OVERALL_STORE_LANGUAGE_QA.md — Language Support Audit

## Supported Languages
| Locale | File | Status |
|--------|------|--------|
| en-US | `lang/en-US.php` | ✅ 24 keys added |
| es-US | `lang/es-US.php` | ✅ 24 keys added |
| vi-VN | `lang/vi-VN.php` | ✅ 24 keys added |

## Translation Keys (24 total)

| Key | en-US | es-US | vi-VN |
|-----|-------|-------|-------|
| overall_store.title | Overall Store | Tienda General | Tổng Quan Cửa Hàng |
| overall_store.total_stores | Total Stores | Total de Tiendas | Tổng Cửa Hàng |
| overall_store.store_health | Store Health | Salud de la Tienda | Tình Trạng Cửa Hàng |
| overall_store.open_tasks | Open Tasks | Tareas Abiertas | Nhiệm Vụ Đang Mở |
| overall_store.completed_tasks | Completed Tasks | Tareas Completadas | Nhiệm Vụ Hoàn Thành |
| overall_store.overdue_tasks | Overdue Tasks | Tareas Atrasadas | Nhiệm Vụ Quá Hạn |
| overall_store.due_today | Due Today | Vence Hoy | Hết Hạn Hôm Nay |
| overall_store.upcoming | Upcoming | Proximas | Sắp Tới |
| overall_store.open_bills | Open Bills | Facturas Abiertas | Hóa Đơn Đang Mở |
| overall_store.overdue_bills | Overdue Bills | Facturas Atrasadas | Hóa Đơn Quá Hạn |
| overall_store.unpaid_bills | Unpaid Bills | Facturas No Pagadas | Hóa Đơn Chưa Thanh Toán |
| overall_store.needs_owner | Needs Owner | Necesita Responsable | Cần Người Phụ Trách |
| overall_store.healthy | Healthy | Saludable | Tốt |
| overall_store.needs_attention | Needs Attention | Necesita Atencion | Cần Quan Tâm |
| overall_store.critical | Critical | Critico | Nghiêm Trọng |
| overall_store.setup_incomplete | Setup Incomplete | Configuracion Incompleta | Chưa Hoàn Thành Cài Đặt |
| overall_store.no_stores | No stores found. | No se encontraron tiendas. | Không tìm thấy cửa hàng. |
| overall_store.last_activity | Last activity | Ultima actividad | Hoạt động gần đây |
| overall_store.tab_overview | Overview | Resumen | Tổng Quan |
| overall_store.tab_tasks | Current Tasks | Tareas Actuales | Nhiệm Vụ Hiện Tại |
| overall_store.tab_bills | Bills | Facturas | Hóa Đơn |
| overall_store.tab_completed | Completed | Completadas | Đã Hoàn Thành |
| overall_store.tab_people | People | Personas | Nhân Sự |

## Verification
- All 24 keys present in all 3 language files: ✅
- No missing keys detected: ✅
- PHP syntax valid (lint blocked by missing PHP CLI): ⚠️ Requires manual verification

## Usage in View
The view uses `$t('key')` calls for all translatable strings, matching the i18n system:
```php
<?= $t('overall_store.title') ?>
<?= $t('overall_store.open_tasks') ?>
// etc.
```
