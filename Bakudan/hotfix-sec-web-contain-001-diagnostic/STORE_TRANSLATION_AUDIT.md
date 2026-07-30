# STORE TRANSLATION AUDIT

**Date:** 2026-06-22  
**Status:** ✅ PASS (Store Module)

## Scope
Audit of translation keys used in Store module pages only. Full-app audit deferred to separate task.

## Translation Keys Added

### VI (Vietnamese) — 30 new keys
| Key | VI Translation |
|-----|----------------|
| store.command_center | Trung tâm Điều khiển Cửa hàng |
| store.command_center_desc | Tất cả cửa hàng với điểm sức khỏe thời gian thực |
| store.manage_stores | Quản lý Cửa hàng |
| store.no_stores | Chưa có cửa hàng nào |
| store.no_stores_desc | Tạo cửa hàng đầu tiên để bắt đầu theo dõi |
| store.health_grades | Xếp hạng Sức khỏe |
| store.overdue_tasks | Quá hạn |
| store.critical_tasks | Nghiêm trọng |
| store.unpaid_bills | Chưa trả |
| store.employees | Nhân viên |
| store.total_tasks | Tổng task |
| store.bills | Hóa đơn |
| store.refresh_score | Làm mới điểm |
| store.completed_week | Hoàn thành tuần này |
| store.due | đến hạn |
| store.due_today | hôm nay |
| store.open_incidents | Sự cố đang mở |
| store.critical | nghiêm trọng |
| store.remaining | còn lại |
| store.today_tasks | Task hôm nay |
| store.no_tasks_today | Không có task nào hôm nay! |
| store.recent_activity | Hoạt động gần đây |
| store.no_recent_activity | Chưa có hoạt động |
| store.store_manager | Quản lý cửa hàng |
| store.team | Đội ngũ |
| store.no_team_members | Chưa có thành viên |
| store.health_metrics | Chỉ số Sức khỏe |
| store.quick_actions | Thao tác nhanh |
| store.edit_store | Chỉnh sửa cửa hàng |
| store.view_incidents | Xem Sự cố |
| store.manage_bills | Quản lý Hóa đơn |

### EN (English) — 30 new keys
All 30 keys have matching English translations in `config/i18n.php`.

## Pages Audited

| Page | Uses `t()` | Mixed Language |
|------|-----------|----------------|
| Store Command Center (index) | ✅ All text | No |
| Store Command Center (show) | ✅ All text | No |
| Store List (stores.php) | ✅ All text | No |
| Health Drawer | JS dynamic — English labels | Acceptable for dashboard |

## No Mixed Language Pages
All store module views use `e(t('key'))` pattern for user-facing text. No hardcoded Vietnamese or English strings in view templates (except health drawer metric labels which use English technical terms — acceptable for internal dashboards).
