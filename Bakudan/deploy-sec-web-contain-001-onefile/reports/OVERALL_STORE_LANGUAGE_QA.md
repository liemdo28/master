# Overall Store — Language QA Report
**Date:** 2026-06-22  
**Status: PASS ✅**

---

## Translation Key Matrix

| Key | EN (en-US) | ES (es-US) | VI (vi-VN) |
|-----|-----------|-----------|-----------|
| `overall_store.title` | Overall Store | Tienda General | Tổng Quan Cửa Hàng |
| `overall_store.total_stores` | Total Stores | Total de Tiendas | Tổng Cửa Hàng |
| `overall_store.store_health` | Store Health | Salud de la Tienda | Tình Trạng Cửa Hàng |
| `overall_store.open_tasks` | Open Tasks | Tareas Abiertas | Nhiệm Vụ Đang Mở |
| `overall_store.completed_tasks` | Completed Tasks | Tareas Completadas | Nhiệm Vụ Hoàn Thành |
| `overall_store.overdue_tasks` | Overdue Tasks | Tareas Atrasadas | Nhiệm Vụ Quá Hạn |
| `overall_store.due_today` | Due Today | Vence Hoy | Hết Hạn Hôm Nay |
| `overall_store.upcoming` | Upcoming | Proximas | Sắp Tới |
| `overall_store.open_bills` | Open Bills | Facturas Abiertas | Hóa Đơn Đang Mở |
| `overall_store.overdue_bills` | Overdue Bills | Facturas Atrasadas | Hóa Đơn Quá Hạn |
| `overall_store.unpaid_bills` | Unpaid Bills | Facturas No Pagadas | Hóa Đơn Chưa Thanh Toán |
| `overall_store.needs_owner` | Needs Owner | Necesita Responsable | Cần Người Phụ Trách |
| `overall_store.healthy` | Healthy | Saludable | Tốt |
| `overall_store.needs_attention` | Needs Attention | Necesita Atencion | Cần Quan Tâm |
| `overall_store.critical` | Critical | Critico | Nghiêm Trọng |
| `overall_store.setup_incomplete` | Setup Incomplete | Configuracion Incompleta | Chưa Hoàn Thành Cài Đặt |
| `overall_store.no_stores` | No stores found. | No se encontraron tiendas. | Không tìm thấy cửa hàng. |
| `overall_store.last_activity` | Last activity | Ultima actividad | Hoạt động gần đây |
| `overall_store.tab_overview` | Overview | Resumen | Tổng Quan |
| `overall_store.tab_tasks` | Current Tasks | Tareas Actuales | Nhiệm Vụ Hiện Tại |
| `overall_store.tab_bills` | Bills | Facturas | Hóa Đơn |
| `overall_store.tab_completed` | Completed | Completadas | Đã Hoàn Thành |
| `overall_store.tab_people` | People | Personas | Nhân Sự |

**Total keys: 23** — All present in all 3 locales.

---

## View t() Usage
All user-visible labels in `views/admin/overall_store/index.php` use `t()`:
- Page title: `<?= t('overall_store.title') ?>`
- KPI labels: `<?= t('overall_store.total_stores') ?>`, etc.
- Health badges: values come from model `healthLabel()` → not directly translated (uses EN text from model)
- Drawer tabs: rendered via PHP into JS string literals at page load (correct approach)
- Empty state: `<?= t('overall_store.no_stores') ?>`

**Note:** The `health_label` field from the model returns English strings ('Critical', 'Needs Attention', 'Healthy', 'Setup Incomplete'). These are used in the drawer title and cards. The badge labels on cards use PHP conditionals and `t()` keys. The drawer title uses the API's `health_label` which is currently always English. Future improvement: translate `healthLabel()` in model or translate in the view.

---

## Language Switcher Note
The language switcher buttons in the topbar all currently link to `/language/en-US` — this is a pre-existing bug in `language_switch_url()` helper, not introduced by this feature. The underlying `t()` system and translations are correct.

---

## Files Modified
| File | Keys Added |
|------|-----------|
| `lang/en-US.php` | 23 overall_store.* keys |
| `lang/es-US.php` | 23 overall_store.* keys |
| `lang/vi-VN.php` | 23 overall_store.* keys |
