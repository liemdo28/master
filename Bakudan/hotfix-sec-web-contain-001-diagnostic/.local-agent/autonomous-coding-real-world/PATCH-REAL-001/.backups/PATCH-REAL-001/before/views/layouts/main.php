<?php
$user = currentUser();
$notifModel = new Notification();
$unreadCount = $unreadCount ?? $notifModel->getUnreadCount($_SESSION['user_id']);

// ── Sidebar badge counts — single consolidated query ─────────────────
$sbBadges = ['priority' => 0, 'overdue' => 0, 'today' => 0, 'payments' => 0, 'filings' => 0];
try {
    $_sbDb    = Database::getInstance();
    $_sbToday = function_exists('app_today') ? app_today() : date('Y-m-d');
    $_sbUid   = $_SESSION['user_id'] ?? 0;
    $_sbAdmin = canAdmin() || canManage();

    // One query: task overdue + task today + bill payments + bill filings
    $_sbRow = $_sbAdmin
        ? $_sbDb->fetch(
            "SELECT
                SUM(t.is_completed=0 AND t.status!='completed' AND t.due_date<?  AND t.assignee_id=?) AS overdue,
                SUM(t.is_completed=0 AND t.status!='completed' AND t.due_date=?  AND t.assignee_id=?) AS today
             FROM tasks t",
            [$_sbToday, $_sbUid, $_sbToday, $_sbUid])
        : $_sbDb->fetch(
            "SELECT
                SUM(t.is_completed=0 AND t.status!='completed' AND t.due_date<? AND t.assignee_id=?) AS overdue,
                SUM(t.is_completed=0 AND t.status!='completed' AND t.due_date=?  AND t.assignee_id=?) AS today
             FROM tasks t",
            [$_sbToday, $_sbUid, $_sbToday, $_sbUid]);

    $_sbBills = $_sbDb->fetch(
        "SELECT
            SUM(status='overdue' OR (due_date<? AND status='pending')) AS payments,
            SUM((category IN ('tax','payroll')
                 OR vendor IN ('CDTFA','FTB','IRS','EDD','BOE')
                 OR vendor LIKE '%CDTFA%' OR vendor LIKE '%Franchise Tax%'
                 OR vendor LIKE '%IRS%'   OR vendor LIKE '%EDD%')
                AND (status='overdue' OR (due_date<? AND status='pending'))) AS filings
         FROM bills",
        [$_sbToday, $_sbToday]);

    $sbBadges['overdue']  = (int)($_sbRow['overdue']   ?? 0);
    $sbBadges['today']    = (int)($_sbRow['today']     ?? 0);
    $sbBadges['payments'] = (int)($_sbBills['payments'] ?? 0);
    $sbBadges['filings']  = (int)($_sbBills['filings']  ?? 0);
    $sbBadges['priority'] = min(99, $sbBadges['overdue'] + $sbBadges['payments'] + $sbBadges['filings']);
} catch (\Throwable $_sbE) { /* silently keep zeroes */ }

if (!function_exists('tf_icon')) {
function tf_icon($name, $size = 18) {
    $icons = [
        // Navigation
        'home' => '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
        'dashboard' => '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
        'overview' => '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
        'inbox' => '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
        'menu' => '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',

        // Tasks & Projects
        'pin' => '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1z"/><line x1="10" y1="1" x2="14" y2="1"/>',
        'check-square' => '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
        'clipboard-list' => '<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
        'folder' => '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
        'folder-open' => '<path d="M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>',
        'layers' => '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
        'target' => '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',

        // Calendar & Time
        'calendar' => '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        'clock' => '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',

        // Finance & Bills
        'bill' => '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
        'credit-card' => '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 15h2"/><path d="M11 15h6"/>',
        'dollar-sign' => '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
        'wallet' => '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
        'receipt' => '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 10h8"/><path d="M8 14h4"/>',

        // Users & Team
        'users' => '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        'user' => '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        'user-plus' => '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',

        // Status & Alerts
        'check-circle' => '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
        'alert-triangle' => '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        'alert-circle' => '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        'info' => '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
        'shield' => '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        'shield-check' => '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',

        // Analytics & Charts
        'trending-up' => '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
        'bar-chart-3' => '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
        'pie-chart' => '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
        'activity' => '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',

        // Actions
        'plus' => '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
        'plus-circle' => '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
        'edit' => '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
        'trash-2' => '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
        'search' => '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
        'filter' => '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
        'refresh-cw' => '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
        'download' => '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
        'upload' => '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
        'external-link' => '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
        'x' => '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        'check' => '<polyline points="20 6 9 17 4 12"/>',

        // UI Elements
        'chevron-down' => '<polyline points="6 9 12 15 18 9"/>',
        'chevron-right' => '<polyline points="9 18 15 12 9 6"/>',
        'chevron-up' => '<polyline points="18 15 12 9 6 15"/>',
        'more-horizontal' => '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
        'settings' => '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        'eye' => '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
        'star' => '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',

        // Objects
        'bell' => '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
        'store' => '<path d="M3 9l1-4h16l1 4"/><path d="M3 9v1a3 3 0 0 0 6 0V9m0 1a3 3 0 0 0 6 0V9m0 1a3 3 0 0 0 6 0V9"/><path d="M5 20h14a1 1 0 0 0 1-1v-6H4v6a1 1 0 0 0 1 1z"/>',
        'building' => '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
        'vendor' => '<path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4M5 21V10.9M19 21V10.9"/>',
        'truck' => '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
        'package' => '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
        'file-text' => '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
        'robot' => '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>',
        'zap' => '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
        'lightning' => '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',

        // Auth & Security
        'admin' => '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
        'logout' => '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
        'key' => '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',

        // Misc
        'globe' => '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
        'link' => '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
        'copy' => '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        'image' => '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
        'hash' => '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
        'arrow-left-right' => '<polyline points="17 2 21 6 17 10"/><path d="M3 6h18"/><polyline points="7 22 3 18 7 14"/><path d="M21 18H3"/>',
        'calendar-clock' => '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><circle cx="16" cy="16" r="3"/><path d="M16 14.5v1.7l1 1"/>',
        'repeat-2' => '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
        'file' => '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>',
        'map-pin' => '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
        'command' => '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>',
        'book-open' => '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
        'sun' => '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
        'moon' => '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
        'history' => '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
        // Missing icons added for sidebar correctness
        'layout-dashboard' => '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
        'alert-octagon'    => '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    ];
    $path = $icons[$name] ?? '';
    if (!$path) return '';
    return '<svg viewBox="0 0 24 24" width="' . $size . '" height="' . $size . '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' . $path . '</svg>';
}
} // end function_exists
?>
<!DOCTYPE html>
<html lang="<?= e(current_locale()) ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php
        $_metaTitle = e(($pageTitle ?? t('page.dashboard')) . ' - ' . APP_NAME);
        $_metaDesc  = e($pageMetaDesc ?? 'TaskFlow — Bakudan Ramen operations dashboard. Manage tasks, projects, bills, and team decisions in one place.');
        $_canonicalUrl = e(APP_URL . strtok($_SERVER['REQUEST_URI'] ?? '/', '?'));
    ?>
    <title><?= $_metaTitle ?></title>
    <meta name="description" content="<?= $_metaDesc ?>">

    <!-- Open Graph -->
    <meta property="og:type"        content="website">
    <meta property="og:site_name"   content="<?= e(APP_NAME) ?>">
    <meta property="og:title"       content="<?= $_metaTitle ?>">
    <meta property="og:description" content="<?= $_metaDesc ?>">
    <meta property="og:url"         content="<?= $_canonicalUrl ?>">
    <meta property="og:image"       content="<?= e(APP_URL) ?>/assets/icons/icon-512.png">

    <!-- Canonical -->
    <link rel="canonical" href="<?= $_canonicalUrl ?>">

    <!-- Robots: private dashboard — no indexing -->
    <meta name="robots" content="noindex, nofollow">

    <link rel="stylesheet" href="<?= APP_URL ?>/assets/css/tokens.css">
    <link rel="stylesheet" href="<?= APP_URL ?>/assets/css/style.css">
    <link rel="stylesheet" href="<?= APP_URL ?>/assets/css/global-search.css">
    <link rel="stylesheet" href="<?= APP_URL ?>/assets/css/ux-extras.css">
    <link rel="stylesheet" href="<?= APP_URL ?>/assets/css/components/error-boundary.css">
    <?php foreach (($extraCss ?? []) as $css): ?>
        <link rel="stylesheet" href="<?= APP_URL ?>/assets/css/<?= e($css) ?>">
    <?php endforeach; ?>
    <!-- CEO Readability override — 2K/large monitor -->
    <link rel="stylesheet" href="<?= APP_URL ?>/assets/css/ceo-readability.css">
    <meta name="csrf-token" content="<?= e(csrf_token()) ?>">
    <link rel="manifest" href="<?= APP_URL ?>/manifest.json">
    <meta name="theme-color" content="#09090b">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="TaskFlow">
    <link rel="apple-touch-icon" href="<?= APP_URL ?>/assets/icons/icon-192.png">
    <link rel="apple-touch-icon" sizes="512x512" href="<?= APP_URL ?>/assets/icons/icon-512.png">
    <link rel="icon" type="image/png" sizes="192x192" href="<?= APP_URL ?>/assets/icons/icon-192.png">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="format-detection" content="telephone=no">
    <meta name="msapplication-TileColor" content="#09090b">
    <meta name="msapplication-tap-highlight" content="no">
</head>
<body>
<div class="app-layout">
    <?php $newTaskCount = (new Task())->countNewTasks($_SESSION['user_id']); ?>
    <!-- Sidebar v2 — Decision Accelerator (CEO UI Fix) -->
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <h1>Task<span>Flow</span></h1>
        </div>

        <nav class="sb-nav" id="sbNav">

            <?php
            // Helper: active class for sidebar items
            $cp = $currentPage ?? '';
            function sbCls(string $cp, array $pages): string {
                return in_array($cp, $pages, true) ? 'sb-item sb-item--active' : 'sb-item';
            }
            // Red urgency badge — use ONLY for critical/overdue counts
            function sbBadge(int $n, string $key = ''): string {
                if ($n <= 0) return '';
                $label = $n > 99 ? '99+' : $n;
                $attr  = $key ? ' data-sb-key="' . $key . '"' : '';
                return '<span class="sb-badge"' . $attr . '>' . $label . '</span>';
            }
            // Neutral count pill — informational, not urgent
            function sbCount(int $n, string $key = ''): string {
                if ($n <= 0) return '';
                $label = $n > 99 ? '99+' : $n;
                $attr  = $key ? ' data-sb-key="' . $key . '"' : '';
                return '<span class="sb-count"' . $attr . '>' . $label . '</span>';
            }
            $projectModel = new Project();
            $sidebarProjects = $projectModel->getByUser($_SESSION['user_id'], canAdmin());
            // Navigation always renders regardless of project count
            ?>

            <!-- ──────────────────────────────────────────────────────
                 PHASE 11.7 — OPERATIONAL READINESS
                 CEO Navigation Architecture
                 All major modules reachable in < 2 clicks
            ────────────────────────────────────────────────────── -->

            <?php if (canAdmin() || canManage()): ?>

            <!-- ─── OPERATIONS ─── -->
            <div class="sb-group">
                <div class="sb-section">OPERATIONS</div>

                <a href="<?= APP_URL ?>/overview" class="<?= sbCls($cp,['overview','dashboard','ceo']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('layout-dashboard',16) ?></span>
                    <span class="sb-item__label">Overview</span>
                    <?= sbBadge($sbBadges['priority'], 'priority') ?>
                </a>

                <a href="<?= APP_URL ?>/operations/today" class="<?= sbCls($cp,['operations-today']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('sun',16) ?></span>
                    <span class="sb-item__label">Operations Today</span>
                </a>

                <a href="<?= APP_URL ?>/control-tower" class="<?= sbCls($cp,['control-tower']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('activity',16) ?></span>
                    <span class="sb-item__label">Control Tower</span>
                </a>

                <a href="<?= APP_URL ?>/manager/command" class="<?= sbCls($cp,['manager-command']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('command',16) ?></span>
                    <span class="sb-item__label">Manager Command</span>
                </a>

                <a href="<?= APP_URL ?>/action-center" class="<?= sbCls($cp,['action-center']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('alert-circle',16) ?></span>
                    <span class="sb-item__label">Action Center</span>
                </a>

                <a href="<?= APP_URL ?>/company/calendar" class="<?= sbCls($cp,['company-calendar']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('calendar',16) ?></span>
                    <span class="sb-item__label">Company Calendar</span>
                </a>
            </div>

            <!-- ─── PEOPLE ─── -->
            <div class="sb-group">
                <div class="sb-section">PEOPLE</div>

                <a href="<?= APP_URL ?>/team" class="<?= sbCls($cp,['team']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('users',16) ?></span>
                    <span class="sb-item__label">Team Members</span>
                </a>

                <a href="<?= APP_URL ?>/team#rebalance" class="<?= sbCls($cp,['team-load']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('bar-chart-3',16) ?></span>
                    <span class="sb-item__label">Team Load</span>
                </a>
            </div>

            <!-- ─── STORES ─── -->
            <div class="sb-group">
                <div class="sb-section">STORES</div>

                <?php if (canAdmin()): /* Store Command + All Stores + Health require isAdmin() in router */ ?>
                <a href="<?= APP_URL ?>/admin/store-command" class="<?= sbCls($cp,['store-command','admin-store-command']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('store',16) ?></span>
                    <span class="sb-item__label">Store Command Center</span>
                </a>

                <a href="<?= APP_URL ?>/admin/stores" class="<?= sbCls($cp,['admin-stores']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('map-pin',16) ?></span>
                    <span class="sb-item__label">All Stores</span>
                </a>
                <?php endif; ?>

                <a href="<?= APP_URL ?>/store/checklist/open" class="<?= sbCls($cp,['store-checklist']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('sun',16) ?></span>
                    <span class="sb-item__label">Open Store</span>
                </a>

                <a href="<?= APP_URL ?>/store/checklist/close" class="<?= sbCls($cp,['store-checklist']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('moon',16) ?></span>
                    <span class="sb-item__label">Close Store</span>
                </a>

                <a href="<?= APP_URL ?>/store/checklist/history" class="<?= sbCls($cp,['store-checklist']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('history',16) ?></span>
                    <span class="sb-item__label">Checklist History</span>
                </a>

                <?php if (canAdmin()): /* Store Health requires isAdmin() in router */ ?>
                <a href="<?= APP_URL ?>/admin/store-command#health" class="<?= sbCls($cp,['store-health']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('shield-check',16) ?></span>
                    <span class="sb-item__label">Store Health</span>
                </a>
                <?php endif; ?>
            </div>

            <!-- ─── GOVERNANCE ─── -->
            <div class="sb-group">
                <div class="sb-section">GOVERNANCE</div>

                <a href="<?= APP_URL ?>/admin/releases" class="<?= sbCls($cp,['admin-releases']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('layers',16) ?></span>
                    <span class="sb-item__label">Release Center</span>
                </a>

                <a href="<?= APP_URL ?>/admin/releases#calendar" class="<?= sbCls($cp,['release-calendar']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('calendar-clock',16) ?></span>
                    <span class="sb-item__label">Release Calendar</span>
                </a>

                <a href="<?= APP_URL ?>/admin/walkthrough-library" class="<?= sbCls($cp,['walkthrough-library']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('clipboard-list',16) ?></span>
                    <span class="sb-item__label">Walkthrough Library</span>
                </a>

                <a href="<?= APP_URL ?>/admin/adoption-metrics" class="<?= sbCls($cp,['admin-adoption-metrics']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('trending-up',16) ?></span>
                    <span class="sb-item__label">Adoption Metrics</span>
                </a>

                <a href="<?= APP_URL ?>/health" class="<?= sbCls($cp,['health']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('activity',16) ?></span>
                    <span class="sb-item__label">Health Monitor</span>
                </a>
            </div>

            <!-- ─── FINANCE ─── -->
            <div class="sb-group">
                <div class="sb-section">FINANCE</div>

                <a href="<?= APP_URL ?>/bills?filter=overdue" class="<?= ($cp==='bills' && ($_GET['filter']??'')==='overdue') ? 'sb-item sb-item--active' : 'sb-item' ?>">
                    <span class="sb-item__icon"><?= tf_icon('wallet',16) ?></span>
                    <span class="sb-item__label">Payments</span>
                    <?= sbBadge($sbBadges['payments'], 'payments') ?>
                </a>

                <a href="<?= APP_URL ?>/bills" class="<?= sbCls($cp,['bills','bills-templates']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('credit-card',16) ?></span>
                    <span class="sb-item__label">Bills</span>
                </a>

                <?php if (canAdmin()): /* Vendors + Budget require isAdmin() in router */ ?>
                <a href="<?= APP_URL ?>/admin/vendors" class="<?= sbCls($cp,['admin-vendors']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('building',16) ?></span>
                    <span class="sb-item__label">Vendors</span>
                </a>

                <a href="<?= APP_URL ?>/admin/budget" class="<?= sbCls($cp,['admin-budget']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('dollar-sign',16) ?></span>
                    <span class="sb-item__label">Budget</span>
                </a>
                <?php endif; ?>
            </div>

            <!-- ─── PLAYBOOKS ─── -->
            <div class="sb-group">
                <div class="sb-section">PLAYBOOKS</div>
                <a href="<?= APP_URL ?>/playbooks" class="<?= sbCls($cp,['playbooks']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('book-open',16) ?></span>
                    <span class="sb-item__label">Franchise Playbooks</span>
                </a>
            </div>

            <!-- ─── SECURITY ─── -->
            <?php if (canAdmin()): ?>
            <div class="sb-group">
                <div class="sb-section">SECURITY</div>

                <a href="<?= APP_URL ?>/security/credentials" class="<?= sbCls($cp,['credentials','credentials-list']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('key',16) ?></span>
                    <span class="sb-item__label">Credential Vault</span>
                </a>

                <a href="<?= APP_URL ?>/security/rotation" class="<?= sbCls($cp,['credentials-rotation']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('refresh-cw',16) ?></span>
                    <span class="sb-item__label">Password Rotation</span>
                </a>

                <a href="<?= APP_URL ?>/security/audit-logs" class="<?= sbCls($cp,['credentials-audit']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('file-text',16) ?></span>
                    <span class="sb-item__label">Audit Logs</span>
                </a>
            </div>
            <?php endif; ?>

            <?php endif; /* end canAdmin || canManage */ ?>

            <!-- ─── TASKS — visible to ALL authenticated users ─── -->
            <div class="sb-group">
                <div class="sb-section">TASKS</div>

                <a href="<?= APP_URL ?>/my-tasks" class="<?= sbCls($cp,['my-tasks']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('check-square',16) ?></span>
                    <span class="sb-item__label">Tasks</span>
                    <?= sbCount($newTaskCount) ?>
                </a>

                <a href="<?= APP_URL ?>/projects" class="<?= sbCls($cp,['projects']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('folder',16) ?></span>
                    <span class="sb-item__label">Projects</span>
                </a>

                <a href="<?= APP_URL ?>/my-workspace" class="<?= sbCls($cp,['my-workspace']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('home',16) ?></span>
                    <span class="sb-item__label">My Workspace</span>
                </a>

                <a href="<?= APP_URL ?>/notifications" class="<?= sbCls($cp,['notifications']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('bell',16) ?></span>
                    <span class="sb-item__label">Notifications</span>
                </a>

                <a href="<?= APP_URL ?>/activity" class="<?= sbCls($cp,['activity']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('activity',16) ?></span>
                    <span class="sb-item__label">Activity Feed</span>
                </a>

                <a href="<?= APP_URL ?>/search" class="<?= sbCls($cp,['search']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('target',16) ?></span>
                    <span class="sb-item__label">Search</span>
                </a>
            </div>

            <!-- ─── MY DAY — visible to ALL authenticated users ─── -->
            <div class="sb-group">
                <div class="sb-section">MY DAY</div>
                <a href="<?= APP_URL ?>/my-day" class="<?= sbCls($cp,['my-day']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('user',16) ?></span>
                    <span class="sb-item__label">My Day</span>
                </a>

                <a href="<?= APP_URL ?>/calendar" class="<?= sbCls($cp,['calendar']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('calendar',16) ?></span>
                    <span class="sb-item__label">Calendar</span>
                    <?= sbCount($sbBadges['today'], 'today') ?>
                </a>

                <?php if ((canAdmin() || canManage()) && $sbBadges['overdue'] > 0): ?>
                <a href="<?= APP_URL ?>/my-tasks?filter=overdue" class="<?= ($cp==='my-tasks' && ($_GET['filter']??'')==='overdue') ? 'sb-item sb-item--active' : 'sb-item' ?>">
                    <span class="sb-item__icon"><?= tf_icon('clock',16) ?></span>
                    <span class="sb-item__label">Overdue</span>
                    <?= sbBadge($sbBadges['overdue'], 'overdue') ?>
                </a>
                <?php endif; ?>
            </div>

            <?php if (canAdmin()): ?>
            <!-- ─── EXECUTIVE ─── -->
            <div class="sb-group">
                <div class="sb-section">EXECUTIVE</div>
                <a href="<?= APP_URL ?>/ceo/scorecard" class="<?= sbCls($cp,['ceo-scorecard']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('pie-chart',16) ?></span>
                    <span class="sb-item__label">Scorecard</span>
                </a>
                <a href="<?= APP_URL ?>/ceo/boardroom" class="<?= sbCls($cp,['ceo-boardroom']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('target',16) ?></span>
                    <span class="sb-item__label">Boardroom</span>
                </a>
            </div>
            <?php endif; ?>

            <!-- ─── ADMIN (collapsed, admin only) ─── -->
            <?php if (canAdmin()): ?>
            <div class="sb-group sb-group--system" id="sbSystemGroup">
                <div class="sb-section collapsible" id="sbSystemToggle" data-action="toggle-sb-system">
                    <span>ADMIN</span>
                    <span class="sb-section-arrow"><?= tf_icon('chevron-down',12) ?></span>
                </div>
                <div class="sb-group-items hidden" id="sbSystemItems">
                    <a href="<?= APP_URL ?>/admin/users" class="<?= sbCls($cp,['admin-users']) ?>">
                        <span class="sb-item__icon"><?= tf_icon('user-plus',16) ?></span>
                        <span class="sb-item__label">Users</span>
                    </a>
                    <a href="<?= APP_URL ?>/admin/data-hygiene" class="<?= sbCls($cp,['admin-data-hygiene']) ?>">
                        <span class="sb-item__icon"><?= tf_icon('filter',16) ?></span>
                        <span class="sb-item__label">Data Hygiene</span>
                    </a>
                    <a href="<?= APP_URL ?>/asana" class="<?= sbCls($cp,['asana-import']) ?>">
                        <span class="sb-item__icon"><?= tf_icon('zap',16) ?></span>
                        <span class="sb-item__label">Integrations</span>
                    </a>
                    <a href="<?= APP_URL ?>/admin/penalty" class="<?= sbCls($cp,['penalty-config']) ?>">
                        <span class="sb-item__icon"><?= tf_icon('alert-octagon',16) ?></span>
                        <span class="sb-item__label">Phạt Deadline</span>
                    </a>
                    <?php
                    try {
                        $_extPending = (new DeadlineExtension())->getPendingCount();
                    } catch (\Throwable $_extE) { $_extPending = 0; }
                    ?>
                    <a href="<?= APP_URL ?>/admin/extensions" class="<?= sbCls($cp,['extensions']) ?>">
                        <span class="sb-item__icon"><?= tf_icon('calendar-clock',16) ?></span>
                        <span class="sb-item__label">Extensions</span>
                        <?= sbBadge($_extPending, 'extensions') ?>
                    </a>
                    <a href="<?= APP_URL ?>/admin/releases" class="<?= sbCls($cp,['admin-releases']) ?>">
                        <span class="sb-item__icon"><?= tf_icon('layers',16) ?></span>
                        <span class="sb-item__label">Releases</span>
                    </a>
                </div>
            </div>
            <?php endif; ?>

            <!-- Telegram shortcut — visible to ALL users -->
            <div class="sb-group" style="margin-top:4px;border-top:1px solid #1F2937;padding-top:6px">
                <a href="<?= APP_URL ?>/settings/telegram" class="<?= sbCls($cp,['settings-telegram']) ?>" title="Connect Telegram bot">
                    <span class="sb-item__icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.64 6.8-1.68 7.68c-.12.54-.44.68-.88.42l-2.5-1.84-1.21 1.17c-.13.13-.24.24-.48.24l.17-2.55 4.61-4.16c.19-.17-.04-.27-.29-.1L8.67 13.22l-2.47-.76c-.53-.16-.54-.52.12-.78l9.61-3.66c.44-.16.83.1.71.8z" fill="currentColor"/></svg>
                    </span>
                    <span class="sb-item__label">Telegram</span>
                </a>
            </div>

            <!-- Inbox shortcut -->
            <div class="sb-group" style="border-top:1px solid #1F2937;padding-top:6px">
                <a href="<?= APP_URL ?>/inbox" class="<?= sbCls($cp,['inbox']) ?>">
                    <span class="sb-item__icon"><?= tf_icon('inbox',16) ?></span>
                    <span class="sb-item__label">Inbox</span>
                    <?php if ((int)($unreadCount ?? 0) > 0): ?><span class="sb-badge" data-sb-key="inbox"><?= (int)$unreadCount > 99 ? '99+' : (int)$unreadCount ?></span><?php endif; ?>
                </a>
            </div>

        </nav>

        <?php if (canAdmin()): try { $_vModel=new Release(); $_vLive=$_vModel->getCurrentLiveVersion(); $_vConf=$_vModel->computeConfidenceLetter($_vLive["confidence_score"]??null); } catch(Throwable $_vE){$_vLive=null;$_vConf=null;} ?>
<div class="sidebar-version-info" style="padding:8px 12px 4px;border-top:1px solid #1f1f23;cursor:pointer" onclick="openVersionDetailsModal()" title="Click for version details">
    <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
            <div style="font-size:10px;color:#52525b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Dashboard Version</div>
            <?php if($_vLive): ?>
            <div style="font-family:monospace;font-size:13px;font-weight:600;color:#4ade80"><?=e($_vLive["version"])?></div>
            <div style="font-size:10px;color:#71717a;margin-top:1px">Updated <?=date("M j, g:i A",strtotime($_vLive["published_at"]))?></div>
            <?php else: ?>
            <div style="font-size:12px;color:#52525b">No release</div>
            <?php endif; ?>
        </div>
        <?php if($_vConf): $confColors=["S"=>"#f59e0b","A"=>"#34d399","B"=>"#60a5fa","C"=>"#fbbf24"]; ?>
        <div style="font-size:16px;font-weight:700;color:<?=$confColors[$_vConf]??"#71717a"?>"><?=e($_vConf)?></div>
        <?php endif; ?>
    </div>
</div>
<?php include __DIR__.'/../releases/version_details_modal.php'; ?>
<?php endif; ?>

<div class="sidebar-footer">
            <div class="user-info">
                <a href="<?= APP_URL ?>/settings" style="text-decoration:none;color:inherit;display:flex;align-items:center;gap:10px;flex:1;min-width:0">
                    <div class="user-avatar"><?= strtoupper(mb_substr($user['name'], 0, 1)) ?></div>
                    <div class="user-details">
                        <div class="name"><?= e($user['name']) ?></div>
                        <div class="role"><?php $rMap=['staff'=>t('admin.role_member'),'member'=>t('admin.role_member'),'admin'=>t('admin.role_admin'),'ceo'=>'CEO','manager'=>t('admin.role_manager'),'owner'=>t('admin.role_owner')]; echo e($rMap[$user['role']] ?? ucfirst($user['role'])); ?></div>
                    </div>
                </a>
                <a href="<?= APP_URL ?>/logout" class="btn-ghost" title="<?= e(t('action.logout')) ?>" aria-label="<?= e(t('action.logout')) ?>">
                    <?= tf_icon('logout') ?>
                </a>
            </div>
        </div>
    </aside>

    <!-- Main -->
    <main class="main-content">
        <header class="page-header">
            <div class="flex-center gap-2">
                <div class="mobile-toggle" data-action="toggle-sidebar" role="button" aria-label="<?= e(t('header.menu')) ?>">
                    <?= tf_icon('menu') ?>
                </div>
                <h2><?= e($pageTitle ?? t('page.dashboard')) ?></h2>
            </div>

            <div class="header-actions">
                <!-- Global search trigger — opens spotlight on click or Ctrl/⌘+K -->
                <button type="button" class="gs-trigger" data-gs-trigger aria-label="Search">
                    <span>🔍</span>
                    <span>Search...</span>
                    <span class="gs-trigger-kbd">Ctrl K</span>
                </button>
                <div class="lang-switcher" aria-label="<?= e(t('header.language')) ?>">
                    <a href="<?= e(language_switch_url('vi')) ?>" class="lang-chip <?= current_locale() === 'vi' ? 'active' : '' ?>">VI</a>
                    <a href="<?= e(language_switch_url('en')) ?>" class="lang-chip <?= current_locale() === 'en' ? 'active' : '' ?>">EN</a>
                </div>
                <!-- Create New Dropdown -->
                <div class="create-new-wrap">
                    <button class="create-new-btn" data-action="toggle-create-dropdown">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        <?= e(t('create.new')) ?>
                    </button>
                    <div class="create-new-dropdown" id="createNewDropdown">
                        <a href="#" data-action="open-create-task">
                            <span class="dd-icon" style="background:var(--blue-bg);color:var(--blue)"><?= tf_icon('check-square', 16) ?></span>
                            <?= e(t('create.task')) ?>
                        </a>
                        <a href="<?= APP_URL ?>/projects/create" data-action="close-create-dropdown">
                            <span class="dd-icon" style="background:var(--green-bg);color:var(--green)"><?= tf_icon('folder', 16) ?></span>
                            <?= e(t('create.project')) ?>
                        </a>
                        <div class="dd-sep"></div>
                        <a href="<?= APP_URL ?>/bills" data-action="close-create-dropdown">
                            <span class="dd-icon" style="background:var(--amber-bg);color:var(--amber)"><?= tf_icon('receipt', 16) ?></span>
                            <?= e(t('create.bill')) ?>
                        </a>
                        <?php if (canAdmin()): ?>
                        <a href="<?= APP_URL ?>/admin/stores" onclick="closeCreateDropdown()">
                            <span class="dd-icon" style="background:var(--purple-bg);color:var(--purple)"><?= tf_icon('store', 16) ?></span>
                            <?= e(t('create.store')) ?>
                        </a>
                        <a href="<?= APP_URL ?>/admin/vendors" data-action="close-create-dropdown">
                            <span class="dd-icon" style="background:var(--accent-bg);color:var(--accent)"><?= tf_icon('truck', 16) ?></span>
                            <?= e(t('create.vendor')) ?>
                        </a>
                        <?php endif; ?>
                    </div>
                </div>
                <a href="<?= APP_URL ?>/ai-import" class="btn btn-outline btn-sm"><?= tf_icon('robot', 16) ?> <?= e(t('ai_import.nav_btn')) ?></a>
                <?= $headerActions ?? '' ?>

                <!-- Notification Bell -->
                <div style="position:relative" id="notifWrap">
                    <button class="notif-btn" data-action="toggle-notif" aria-label="<?= e(t('header.notifications')) ?>" aria-haspopup="true">
                        <?= tf_icon('bell') ?>
                        <?php if (($unreadCount ?? 0) > 0): ?>
                            <span class="notif-badge"><?= $unreadCount > 9 ? '9+' : (int)$unreadCount ?></span>
                        <?php endif; ?>
                    </button>
                    <div class="notif-dropdown" id="notifDropdown">
                        <div class="notif-dropdown-header">
                            <span><?= e(t('header.notifications')) ?></span>
                            <button class="btn btn-sm btn-secondary" data-action="mark-notif-read"><?= e(t('header.read_all')) ?></button>
                        </div>
                        <div id="notifList">
                            <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:12px"><?= e(t('header.loading')) ?></div>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <div class="content-area">
            <?php if ($msg = flash('success')): ?>
                <div class="alert alert-success"><?= tf_icon('check-circle', 16) ?> <?= e($msg) ?></div>
            <?php endif; ?>
            <?php if ($msg = flash('error')): ?>
                <div class="alert alert-error"><?= tf_icon('alert-circle', 16) ?> <?= e($msg) ?></div>
            <?php endif; ?>
            <?php
            // ErrorBoundary: catch any rendering crash in page content
            // so the entire layout doesn't white-screen
            try {
                echo $content ?? '';
            } catch (Throwable $__renderError) {
                error_log('[ErrorBoundary] Page render crash: ' . $__renderError->getMessage() . ' in ' . $__renderError->getFile() . ':' . $__renderError->getLine());
                echo '<div class="alert alert-error" style="margin:20px 0">';
                echo '<strong>Something went wrong rendering this page.</strong><br>';
                if (canAdmin()) {
                    echo '<small style="opacity:.7">' . e($__renderError->getMessage()) . ' — ' . e(basename($__renderError->getFile())) . ':' . $__renderError->getLine() . '</small>';
                } else {
                    echo '<small style="opacity:.7">Please try refreshing. If the problem persists, contact admin.</small>';
                }
                echo '</div>';
            }
            ?>
        </div>
    </main>
</div>

<!-- Mobile Bottom Navigation -->
<nav class="mobile-bottom-nav" id="mobileBottomNav">
    <div class="mobile-bottom-nav-inner">
        <?php if (canAdmin() || canManage()): ?>
        <a href="<?= APP_URL ?>/overview" class="mobile-nav-item <?= in_array($currentPage ?? '', ['overview','dashboard']) ? 'active' : '' ?>">
            <?= tf_icon('overview', 20) ?>
            <span><?= e(t('nav.overview')) ?></span>
        </a>
        <?php else: ?>
        <a href="<?= APP_URL ?>/dashboard" class="mobile-nav-item <?= ($currentPage ?? '') === 'dashboard' ? 'active' : '' ?>">
            <?= tf_icon('home', 20) ?>
            <span>My Tasks</span>
        </a>
        <?php endif; ?>
        <a href="<?= APP_URL ?>/my-tasks" class="mobile-nav-item <?= ($currentPage ?? '') === 'my-tasks' ? 'active' : '' ?>">
            <?= tf_icon('check-square', 20) ?>
            <span><?= e(t('nav.my_tasks')) ?></span>
        </a>
        <a href="#" data-action="open-create-task" class="mobile-nav-item mobile-nav-create">
            <?= tf_icon('plus-circle', 24) ?>
        </a>
        <a href="<?= APP_URL ?>/calendar" class="mobile-nav-item <?= ($currentPage ?? '') === 'calendar' ? 'active' : '' ?>">
            <?= tf_icon('calendar', 20) ?>
            <span><?= e(t('nav.calendar')) ?></span>
        </a>
        <a href="<?= APP_URL ?>/inbox" class="mobile-nav-item <?= ($currentPage ?? '') === 'inbox' ? 'active' : '' ?>">
            <?= tf_icon('inbox', 20) ?>
            <span><?= e(t('nav.inbox')) ?></span>
        </a>
    </div>
</nav>

<!-- Sidebar Backdrop -->
<div class="sidebar-backdrop" id="sidebarBackdrop" data-action="close-sidebar"></div>

<!-- Create Task Modal — Full Form -->
<?php
$qtProjects = isset($qtProjects) ? $qtProjects : (new Project())->getByUser($_SESSION['user_id'], canManage());
$qtStoreGroups = (new Store())->allGroupedByBusiness();
$qtStores   = isset($qtStores)   ? $qtStores   : (new Store())->allActive();
$qtUsers    = isset($qtUsers)    ? $qtUsers    : (new User())->getActive();
// Pre-load sections for each project (for dynamic board-column dropdown)
$qtSections = [];
foreach ($qtProjects as $_qp) {
    $sects = (new Project())->getSections($_qp['id']);
    $qtSections[$_qp['id']] = is_array($sects) ? $sects : [];
}
?>
<style>
.ct-modal .modal-box{max-width:740px;width:96vw;max-height:90vh;display:flex;flex-direction:column}
.ct-modal .modal-body{overflow-y:auto;flex:1;padding:20px 22px}
.ct-form-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.ct-form-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:600px){.ct-form-grid,.ct-form-grid-2{grid-template-columns:1fr}}
.ct-full{grid-column:1/-1}
.ct-section-label{font-size:11px;font-weight:700;color:#52525b;text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px;padding-top:12px;border-top:1px solid #27272a}
.ct-section-label:first-child{margin-top:0;border-top:none;padding-top:0}

/* Date picker wrap */
.date-wrap{position:relative;display:flex;align-items:center}
.date-wrap input[type=date]{padding-right:34px}
.date-wrap .date-icon{position:absolute;right:10px;cursor:pointer;font-size:15px;line-height:1;color:#71717a;pointer-events:auto}
.date-wrap input[type=date]::-webkit-calendar-picker-indicator{opacity:0;position:absolute;right:0;width:34px;height:100%;cursor:pointer}

/* Store panel */
.ct-store-panel{background:#111113;border:1px solid #27272a;border-radius:10px;padding:14px 16px;margin-top:4px}
.ct-store-panel-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.ct-store-panel-title{font-size:13px;font-weight:700;color:#d4d4d8;display:flex;align-items:center;gap:8px}
.ct-store-panel-actions{display:flex;gap:6px;align-items:center}

/* Store chips */
.ct-store-group{margin-bottom:10px}
.ct-store-group:last-child{margin-bottom:0}
.ct-store-group-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#52525b;margin-bottom:6px;display:flex;align-items:center;gap:6px}
.ct-store-group-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.ct-store-chips{display:flex;flex-wrap:wrap;gap:6px}
.ct-store-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;cursor:pointer;border:1px solid #3f3f46;font-size:12px;color:#a1a1aa;transition:border-color .12s,background .12s,color .12s;user-select:none}
.ct-store-chip.selected{border-color:#60a5fa;background:rgba(96,165,250,.1);color:#e4e4e7;font-weight:600}
.ct-store-chip input{position:absolute;opacity:0;pointer-events:none;width:0;height:0}
.chip-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.ct-chip-actions{display:flex;gap:6px}
.ct-chip-action{background:transparent;border:1px solid #27272a;color:#71717a;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer}
.ct-chip-action:hover{background:#27272a;color:#e4e4e7}
.ct-store-helper{font-size:11px;color:#52525b;margin-top:8px;padding-top:8px;border-top:1px solid #1f1f23}

/* Store search */
.ct-store-search{width:100%;padding:7px 12px;border:1px solid #3f3f46;border-radius:8px;background:#18181b;color:#e4e4e7;font-size:12px;margin-bottom:10px;outline:none;transition:border-color .15s}
.ct-store-search:focus{border-color:#60a5fa}
.ct-store-search::placeholder{color:#52525b}
.ct-store-count{font-size:11px;color:#6366f1;font-weight:600}

/* Approval card */
.ct-approval-wrap{background:#111113;border:1px solid rgba(96,165,250,.22);border-radius:10px;padding:16px 18px;margin-top:4px}
.ct-approval-toggle{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#d4d4d8}
.ct-approval-toggle input{accent-color:#3b82f6;width:15px;height:15px}
.ct-approval-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
@media(max-width:500px){.ct-approval-fields{grid-template-columns:1fr}}
.ct-approval-extra{margin-top:14px;padding-top:12px;border-top:1px solid rgba(96,165,250,.12)}
.ct-approval-extra .form-group{margin-bottom:12px}
.ct-approval-extra label{font-size:11px;color:#71717a;font-weight:600;display:block;margin-bottom:5px}
.ct-approval-extra textarea{width:100%;min-height:60px;padding:8px 12px;border:1px solid #3f3f46;border-radius:8px;background:#18181b;color:#e4e4e7;font-size:12px;resize:vertical;font-family:inherit}
.ct-approval-extra textarea:focus{border-color:#60a5fa;outline:none}
.ct-approval-extra textarea::placeholder{color:#52525b}
.ct-evidence-grid{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.ct-evidence-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:8px;cursor:pointer;border:1px solid #3f3f46;font-size:11px;color:#a1a1aa;transition:all .12s;user-select:none}
.ct-evidence-chip:hover{border-color:#60a5fa;color:#e4e4e7}
.ct-evidence-chip.selected{border-color:#10b981;background:rgba(16,185,129,.1);color:#6ee7b7;font-weight:600}
.ct-evidence-chip input{position:absolute;opacity:0;pointer-events:none;width:0;height:0}

/* Repeat card */
.ct-repeat-card{background:#111113;border:1px solid #27272a;border-radius:10px;padding:0;margin-top:4px;overflow:hidden}
.ct-repeat-header{display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;color:#d4d4d8;padding:12px 16px;user-select:none;border:none;background:none;width:100%;text-align:left}
.ct-repeat-header:hover{background:rgba(255,255,255,.02)}
.ct-repeat-header .ct-repeat-icon{color:#6366f1;flex-shrink:0}
.ct-repeat-header-label{font-weight:600}
.ct-repeat-summary{margin-left:auto;font-size:11px;color:#6366f1;font-style:normal;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;background:rgba(99,102,241,.1);padding:2px 10px;border-radius:12px}
.ct-repeat-summary:empty{display:none}
.ct-repeat-collapsed-hint{margin-left:auto;font-size:11px;color:#52525b}
.ct-repeat-body{padding:0 16px 14px;border-top:1px solid #1f1f23}

/* Weekly day selector */
.ct-day-selector{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.ct-day-btn{width:34px;height:34px;border-radius:50%;border:1px solid #3f3f46;background:#18181b;color:#a1a1aa;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .12s}
.ct-day-btn:hover{border-color:#60a5fa;color:#e4e4e7}
.ct-day-btn.selected{background:#6366f1;border-color:#6366f1;color:#fff}

/* Repeat options */
.ct-repeat-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
.ct-repeat-label{font-size:11px;color:#71717a;font-weight:600;min-width:60px}

/* End rule */
.ct-end-options{display:flex;gap:6px;margin-top:8px}
.ct-end-pill{padding:4px 12px;border-radius:6px;border:1px solid #3f3f46;background:transparent;color:#a1a1aa;font-size:11px;cursor:pointer;transition:all .12s}
.ct-end-pill:hover{border-color:#60a5fa;color:#e4e4e7}
.ct-end-pill.active{background:rgba(99,102,241,.15);border-color:#6366f1;color:#a78bfa;font-weight:600}
.ct-end-pill input{position:absolute;opacity:0;pointer-events:none}


/* Visibility toggle pills */
.visibility-pills{display:flex;gap:6px;margin-top:4px}
.vis-pill{padding:5px 14px;border-radius:20px;font-size:12px;cursor:pointer;border:1px solid #3f3f46;color:#a1a1aa;transition:all .12s}
.vis-pill.active{border-color:#a78bfa;background:rgba(167,139,250,.1);color:#a78bfa;font-weight:600}
.vis-pill input{position:absolute;opacity:0;pointer-events:none}
</style>

<div class="modal-overlay ct-modal" id="createTaskModal" data-testid="create-task-modal">
    <div class="modal-box">
        <div class="modal-header">
            <h3>✏️ <?= e(t('quick_task.title')) ?></h3>
            <button class="modal-close" data-action="close-create-task" data-testid="create-task-close">&times;</button>
        </div>
        <form action="<?= APP_URL ?>/tasks" method="POST" id="quickTaskForm">
        <div class="modal-body">

            <!-- Title & Description -->
            <div class="ct-section-label">Task Info</div>
            <div class="form-group" style="margin-bottom:10px">
                <label style="font-size:12px;font-weight:600;color:#a1a1aa"><?= e(t('quick_task.name')) ?> <span style="color:#f87171">*</span></label>
                <input type="text" name="title" class="form-control" placeholder="What needs to be done?" required autofocus data-testid="create-task-title">
            </div>
            <div class="form-group" style="margin-bottom:0">
                <label style="font-size:12px;font-weight:600;color:#a1a1aa"><?= e(t('quick_task.description')) ?></label>
                <textarea name="description" class="form-control" rows="2" placeholder="Add details, context, or instructions…" style="resize:vertical"></textarea>
            </div>

            <!-- Project + Board Column + Status -->
            <div class="ct-section-label">Project & Board</div>
            <div class="ct-form-grid">
                <div class="form-group" style="margin:0">
                    <label style="font-size:11px;color:#71717a;font-weight:600">Project <span style="color:#f87171">*</span></label>
                    <select name="project_id" id="ctProjectId" class="form-control" required onchange="ctLoadSections(this.value)">
                        <option value="">— Select project —</option>
                        <?php foreach ($qtProjects as $qp): ?>
                        <option value="<?= $qp['id'] ?>"><?= e($qp['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group" style="margin:0">
                    <label style="font-size:11px;color:#71717a;font-weight:600">Board Column</label>
                    <select name="section_id" id="ctSectionId" class="form-control">
                        <option value="">— No column —</option>
                    </select>
                </div>
                <div class="form-group" style="margin:0">
                    <label style="font-size:11px;color:#71717a;font-weight:600">Status</label>
                    <select name="status" class="form-control">
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="pending_review">Waiting Review</option>
                        <option value="pending_acceptance">Waiting Approval</option>
                    </select>
                </div>
            </div>

            <!-- Assignee + Priority + Deadline -->
            <div class="ct-section-label">Assignment</div>
            <div class="ct-form-grid">
                <div class="form-group" style="margin:0">
                    <label style="font-size:11px;color:#71717a;font-weight:600"><?= e(t('quick_task.assignee')) ?></label>
                    <select name="assignee_id" class="form-control">
                        <option value="">— Unassigned —</option>
                        <?php foreach ($qtUsers as $qu): ?>
                        <option value="<?= $qu['id'] ?>" <?= $qu['id'] == $_SESSION['user_id'] ? 'selected' : '' ?>><?= e($qu['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="form-group" style="margin:0">
                    <label style="font-size:11px;color:#71717a;font-weight:600"><?= e(t('quick_task.priority')) ?></label>
                    <select name="priority" class="form-control">
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="high">High</option>
                        <option value="urgent">🔴 Urgent</option>
                    </select>
                </div>
                <div class="form-group" style="margin:0">
                    <label style="font-size:11px;color:#71717a;font-weight:600">Deadline 📅</label>
                    <div class="date-wrap">
                        <input type="date" name="due_date" id="ctDueDate" class="form-control">
                        <span class="date-icon" onclick="document.getElementById('ctDueDate').showPicker ? document.getElementById('ctDueDate').showPicker() : document.getElementById('ctDueDate').focus()">📅</span>
                    </div>
                </div>
            </div>

            <!-- Visibility -->
            <div class="ct-section-label">Visibility</div>
            <div class="visibility-pills" id="ctVisPills">
                <label class="vis-pill active" onclick="ctSetVis('private',this)">
                    <input type="radio" name="visibility" value="private" checked> 🔒 Private
                </label>
                <label class="vis-pill" onclick="ctSetVis('public',this)">
                    <input type="radio" name="visibility" value="public"> 🌐 Public
                </label>
            </div>
            <div style="font-size:11px;color:#52525b;margin-top:5px" id="ctVisHint">Private: visible to assignee, creator, admin/manager only.</div>

            <!-- Stores — Grouped by Business -->
            <?php if (!empty($qtStoreGroups)): ?>
            <div class="ct-section-label">Stores</div>
            <div class="ct-store-panel">
                <div class="ct-store-panel-header">
                    <div class="ct-store-panel-title">
                        <?= tf_icon('store', 14) ?>
                        <span>Store Selector</span>
                        <span class="ct-store-count" id="ctStoreCount"></span>
                    </div>
                    <div class="ct-store-panel-actions">
                        <button type="button" class="ct-chip-action" onclick="ctSelectAllStores()">Select All</button>
                        <button type="button" class="ct-chip-action" onclick="ctClearStores()">Clear</button>
                    </div>
                </div>
                <input type="text" class="ct-store-search" id="ctStoreSearch" placeholder="🔍 Search stores..." oninput="ctFilterStores(this.value)">
                <input type="hidden" name="store_ids[]" value="">
                <div id="ctStoreChips">
                    <?php foreach ($qtStoreGroups as $group): ?>
                    <div class="ct-store-group" data-group-name="<?= e(strtolower($group['business_name'])) ?>">
                        <div class="ct-store-group-label">
                            <span class="ct-store-group-dot" style="background:<?= e($group['business_color'] ?? '#6B7280') ?>"></span>
                            <?= e($group['business_name']) ?>
                        </div>
                        <div class="ct-store-chips">
                            <?php foreach ($group['stores'] as $qs): ?>
                            <div class="ct-store-chip" data-store-name="<?= e(strtolower($qs['name'])) ?>" onclick="ctToggleChip(this)">
                                <input type="checkbox" name="store_ids[]" value="<?= (int)$qs['id'] ?>">
                                <?php if (!empty($qs['color'])): ?>
                                <span class="chip-dot" style="background:<?= e($qs['color']) ?>"></span>
                                <?php endif; ?>
                                <?= e($qs['name']) ?>
                            </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <div class="ct-store-helper" id="ctStoreHelper">No store selected = general task (applies to all)</div>
            </div>
            <?php endif; ?>

            <!-- Repeat Schedule (collapsed by default) -->
            <div class="ct-section-label">Repeat</div>
            <div class="ct-repeat-card" id="ctRepeatCard">
                <button type="button" class="ct-repeat-header" id="ctRepeatToggle" onclick="ctToggleRepeat()">
                    <span class="ct-repeat-icon"><?= tf_icon('calendar-clock', 14) ?></span>
                    <span class="ct-repeat-header-label">Repeat Schedule</span>
                    <span class="ct-repeat-summary" id="ctRepeatSummary"></span>
                    <span class="ct-repeat-collapsed-hint" id="ctRepeatCollapsedHint">No repeat</span>
                    <span id="ctRepeatArrow" style="margin-left:6px;font-size:11px;color:#52525b">▾</span>
                </button>
                <div class="ct-repeat-body" id="ctRepeatBody" style="display:none">
                <!-- Repeat Type -->
                <div class="form-group" style="margin-bottom:10px">
                    <label style="font-size:11px;color:#71717a;font-weight:600">Frequency</label>
                    <select name="repeat_type" id="ctRepeatType" class="form-control" onchange="ctRepeatTypeChanged()">
                        <option value="none">No repeat</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </div>

                <!-- Weekly options -->
                <div id="ctWeeklyOptions" style="display:none">
                    <div class="ct-repeat-row">
                        <span class="ct-repeat-label">Every</span>
                        <input type="number" name="repeat_interval" id="ctRepeatInterval" value="1" min="1" max="99" style="width:60px;padding:5px 8px;border:1px solid #3f3f46;border-radius:6px;background:#18181b;color:#e4e4e7;font-size:12px">
                        <span style="font-size:11px;color:#71717a">week(s)</span>
                    </div>
                    <div class="ct-day-selector" id="ctDaySelector">
                        <button type="button" class="ct-day-btn" data-day="1" onclick="ctToggleDay(this)">M</button>
                        <button type="button" class="ct-day-btn" data-day="2" onclick="ctToggleDay(this)">T</button>
                        <button type="button" class="ct-day-btn" data-day="3" onclick="ctToggleDay(this)">W</button>
                        <button type="button" class="ct-day-btn" data-day="4" onclick="ctToggleDay(this)">T</button>
                        <button type="button" class="ct-day-btn" data-day="5" onclick="ctToggleDay(this)">F</button>
                        <button type="button" class="ct-day-btn" data-day="6" onclick="ctToggleDay(this)">S</button>
                        <button type="button" class="ct-day-btn" data-day="0" onclick="ctToggleDay(this)">S</button>
                    </div>
                    <input type="hidden" name="repeat_days" id="ctRepeatDays" value="">
                </div>

                <!-- Monthly options -->
                <div id="ctMonthlyOptions" style="display:none">
                    <div class="ct-repeat-row">
                        <span class="ct-repeat-label">Every</span>
                        <input type="number" name="repeat_months" id="ctRepeatMonths" value="1" min="1" max="99" style="width:60px;padding:5px 8px;border:1px solid #3f3f46;border-radius:6px;background:#18181b;color:#e4e4e7;font-size:12px">
                        <span style="font-size:11px;color:#71717a">month(s)</span>
                    </div>
                    <div style="margin-top:8px">
                        <label style="font-size:11px;color:#71717a;font-weight:600;display:block;margin-bottom:6px">Repeat by</label>
                        <div class="visibility-pills">
                            <label class="vis-pill active" id="ctByDayLabel" onclick="ctSetRepeatBy('day_of_month', this)">
                                <input type="radio" name="repeat_by" value="day_of_month" checked> 📅 Same day of month
                            </label>
                            <label class="vis-pill" id="ctByWeekdayLabel" onclick="ctSetRepeatBy('weekday', this)">
                                <input type="radio" name="repeat_by" value="weekday"> 📆 Same weekday
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Repeat From -->
                <div style="margin-top:10px">
                    <label style="font-size:11px;color:#71717a;font-weight:600;display:block;margin-bottom:6px">Repeat from</label>
                    <div class="visibility-pills">
                        <label class="vis-pill active" id="ctFromDueDateLabel" onclick="ctSetRepeatFrom('due_date', this)">
                            <input type="radio" name="repeat_from_mode" value="due_date" checked> Due date
                        </label>
                        <label class="vis-pill" id="ctFromCompletionLabel" onclick="ctSetRepeatFrom('completion_date', this)">
                            <input type="radio" name="repeat_from_mode" value="completion_date"> Completion date
                        </label>
                    </div>
                </div>

                <!-- End -->
                <div style="margin-top:10px">
                    <label style="font-size:11px;color:#71717a;font-weight:600;display:block;margin-bottom:6px">End</label>
                    <div class="ct-end-options" id="ctEndOptions">
                        <label class="ct-end-pill active" onclick="ctSetEndType('never', this)">
                            <input type="radio" name="repeat_end_type" value="never" checked> Never
                        </label>
                        <label class="ct-end-pill" onclick="ctSetEndType('date', this)">
                            <input type="radio" name="repeat_end_type" value="date"> On date
                        </label>
                        <label class="ct-end-pill" onclick="ctSetEndType('count', this)">
                            <input type="radio" name="repeat_end_type" value="count"> After X
                        </label>
                    </div>
                    <div id="ctEndDateWrap" style="display:none;margin-top:8px">
                        <input type="date" name="repeat_end_date" id="ctRepeatEndDate" class="form-control" style="max-width:180px">
                    </div>
                    <div id="ctEndCountWrap" style="display:none;margin-top:8px">
                        <input type="number" name="repeat_end_count" id="ctRepeatEndCount" value="10" min="1" max="999" style="width:80px;padding:5px 8px;border:1px solid #3f3f46;border-radius:6px;background:#18181b;color:#e4e4e7;font-size:12px">
                        <span style="font-size:11px;color:#71717a">occurrences</span>
                    </div>
                </div>
            </div><!-- /.ct-repeat-body -->
            </div><!-- /.ct-repeat-card -->

            <!-- Approval Workflow (visible to all task creators) -->
            <div class="ct-section-label">🔐 Approval Workflow</div>
            <div class="ct-approval-wrap">
                <div class="form-group" style="margin:0 0 10px 0">
                    <label style="font-size:11px;color:#71717a;font-weight:600">Approval Mode</label>
                    <select name="approval_mode" id="ctApprovalMode" class="form-control" onchange="ctToggleApprovalMode()">
                        <option value="none" selected>None</option>
                        <option value="review_only">Review Only</option>
                        <option value="review_acceptance">Review + Acceptance</option>
                    </select>
                </div>
                <small style="display:block;color:#8b949e;font-size:11px;margin-bottom:10px">
                    Creator decides the chain. None = assignee can complete directly.
                </small>
                <div class="ct-approval-fields" id="ctApprovalFields" style="display:none">
                    <div class="form-group" id="ctReviewerWrap" style="margin:0">
                        <label style="font-size:11px;color:#71717a;font-weight:600">Reviewer / Checker</label>
                        <select name="reviewer_id" class="form-control" style="font-size:12px">
                            <option value="">— None —</option>
                            <?php foreach ($qtUsers as $qu): ?>
                            <option value="<?= $qu['id'] ?>"><?= e($qu['name']) ?> (<?= ucfirst($qu['role']) ?>)</option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group" id="ctApproverWrap" style="margin:0">
                        <label style="font-size:11px;color:#71717a;font-weight:600">Final Approver</label>
                        <select name="approver_id" class="form-control" style="font-size:12px">
                            <option value="">— None —</option>
                            <?php foreach ($qtUsers as $qu): ?>
                            <option value="<?= $qu['id'] ?>"><?= e($qu['name']) ?> (<?= ucfirst($qu['role']) ?>)</option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>

                <!-- Reviewer/Approver Instructions & Evidence -->
                <div class="ct-approval-extra" id="ctApprovalExtra" style="display:none">
                    <div class="form-group">
                        <label>📋 Reviewer Instructions</label>
                        <textarea name="review_instructions" placeholder="What should the reviewer check? e.g. Check payroll totals against Toast report and bank deposit." rows="3"></textarea>
                    </div>

                    <div class="form-group">
                        <label>✅ Reviewer Checklist</label>
                        <textarea name="review_checklist" placeholder="One item per line:&#10;Verify sales total&#10;Verify deposit amount&#10;Verify screenshot attached&#10;Verify payroll report uploaded" rows="4"></textarea>
                        <small style="color:#52525b;font-size:10px">One item per line. Reviewer will mark pass/fail for each.</small>
                    </div>

                    <div class="form-group">
                        <label>📎 Required Evidence Types</label>
                        <div class="ct-evidence-grid" id="ctEvidenceGrid">
                            <label class="ct-evidence-chip" onclick="ctToggleEvidence(this)">
                                <input type="checkbox" name="required_evidence[]" value="screenshot"> 📸 Screenshot
                            </label>
                            <label class="ct-evidence-chip" onclick="ctToggleEvidence(this)">
                                <input type="checkbox" name="required_evidence[]" value="pdf"> 📄 PDF
                            </label>
                            <label class="ct-evidence-chip" onclick="ctToggleEvidence(this)">
                                <input type="checkbox" name="required_evidence[]" value="excel"> 📊 Excel
                            </label>
                            <label class="ct-evidence-chip" onclick="ctToggleEvidence(this)">
                                <input type="checkbox" name="required_evidence[]" value="image"> 🖼️ Image
                            </label>
                            <label class="ct-evidence-chip" onclick="ctToggleEvidence(this)">
                                <input type="checkbox" name="required_evidence[]" value="link"> 🔗 Link
                            </label>
                            <label class="ct-evidence-chip" onclick="ctToggleEvidence(this)">
                                <input type="checkbox" name="required_evidence[]" value="other"> 📦 Other
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>📁 Required Files Description</label>
                        <textarea name="required_files" placeholder="Describe required files, one per line:&#10;Payroll report PDF&#10;Toast sales export&#10;Bank deposit screenshot" rows="3"></textarea>
                    </div>

                    <div class="form-group" style="margin-bottom:0">
                        <label>🔏 Approver Instructions</label>
                        <textarea name="approver_instructions" placeholder="Instructions for the final approver. e.g. Approve only after reviewer confirms all evidence." rows="2"></textarea>
                    </div>
                </div>
            </div>

            <input type="hidden" name="csrf" value="<?= csrf_token() ?>">
        </div><!-- /modal-body -->
        <div class="modal-footer" style="border-top:1px solid #27272a;padding:14px 22px;display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="btn btn-secondary btn-sm" data-action="close-create-task"><?= e(t('quick_task.cancel')) ?></button>
            <button type="submit" class="btn btn-primary btn-sm" data-testid="create-task-submit">✓ <?= e(t('quick_task.create_btn')) ?></button>
        </div>
        </form>
    </div>
</div>

<script>
// Pre-loaded sections per project
var CT_SECTIONS = <?= json_encode($qtSections) ?>;

function ctLoadSections(projectId) {
    var sel = document.getElementById('ctSectionId');
    sel.innerHTML = '<option value="">— No column —</option>';
    var sects = CT_SECTIONS[projectId] || [];
    sects.forEach(function(s) {
        var opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        sel.appendChild(opt);
    });
}

function ctToggleChip(chip) {
    var input = chip.querySelector('input');
    input.checked = !input.checked;
    chip.classList.toggle('selected', input.checked);
    ctUpdateStoreHelper();
}

function ctSelectAllStores() {
    document.querySelectorAll('#ctStoreChips .ct-store-chip').forEach(function(c) {
        c.querySelector('input').checked = true;
        c.classList.add('selected');
    });
    ctUpdateStoreHelper();
}

function ctClearStores() {
    document.querySelectorAll('#ctStoreChips .ct-store-chip').forEach(function(c) {
        c.querySelector('input').checked = false;
        c.classList.remove('selected');
    });
    ctUpdateStoreHelper();
}

function ctUpdateStoreHelper() {
    var checked = document.querySelectorAll('#ctStoreChips input:checked').length;
    var h = document.getElementById('ctStoreHelper');
    if (h) h.textContent = checked === 0
        ? 'No store selected = general task (applies to all)'
        : checked + ' store' + (checked > 1 ? 's' : '') + ' selected';
}

function ctSetVis(val, clickedPill) {
    document.querySelectorAll('.vis-pill').forEach(function(p) { p.classList.remove('active'); });
    clickedPill.classList.add('active');
    var hint = document.getElementById('ctVisHint');
    if (hint) hint.textContent = val === 'private'
        ? 'Private: visible to assignee, creator, admin/manager only.'
        : 'Public: visible to all project members.';
}

function ctToggleRepeat() {
    var body = document.getElementById('ctRepeatBody');
    var arrow = document.getElementById('ctRepeatArrow');
    var hint = document.getElementById('ctRepeatCollapsedHint');
    var summary = document.getElementById('ctRepeatSummary');
    var open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    arrow.textContent = open ? '▾' : '▴';
    // Show hint only when collapsed and no repeat selected
    if (hint) {
        var hasRepeat = summary && summary.textContent.trim().length > 0;
        hint.style.display = (open || hasRepeat) ? 'none' : '';
    }
}

// =============================================
// Repeat Schedule Functions
// =============================================

var _ctSelectedDays = [];

function ctRepeatTypeChanged() {
    var type = document.getElementById('ctRepeatType');
    if (!type) return;
    var weekly = document.getElementById('ctWeeklyOptions');
    var monthly = document.getElementById('ctMonthlyOptions');
    var val = type.value;
    
    weekly.style.display = val === 'weekly' ? 'block' : 'none';
    monthly.style.display = val === 'monthly' ? 'block' : 'none';
    
    // Auto-select today if weekly and no days selected
    if (val === 'weekly' && _ctSelectedDays.length === 0) {
        var todayDow = new Date().getDay(); // 0=Sun
        var dayMap = {0:'0',1:'1',2:'2',3:'3',4:'4',5:'5',6:'6'};
        var btn = document.querySelector('[data-day="' + dayMap[todayDow] + '"]');
        if (btn) ctToggleDay(btn);
    }
    
    ctUpdateRepeatSummary();
}

function ctToggleDay(btn) {
    var day = btn.getAttribute('data-day');
    btn.classList.toggle('selected');
    if (btn.classList.contains('selected')) {
        if (!_ctSelectedDays.includes(day)) _ctSelectedDays.push(day);
    } else {
        _ctSelectedDays = _ctSelectedDays.filter(function(d) { return d !== day; });
    }
    document.getElementById('ctRepeatDays').value = _ctSelectedDays.join(',');
    ctUpdateRepeatSummary();
}

function ctSetRepeatBy(val, label) {
    document.querySelectorAll('[name="repeat_by"]').forEach(function(r) { r.checked = false; });
    var input = label.querySelector('input');
    if (input) input.checked = true;
    document.querySelectorAll('#ctMonthlyOptions .vis-pill').forEach(function(p) { p.classList.remove('active'); });
    label.classList.add('active');
    ctUpdateRepeatSummary();
}

function ctSetRepeatFrom(val, label) {
    document.querySelectorAll('[name="repeat_from_mode"]').forEach(function(r) { r.checked = false; });
    var input = label.querySelector('input');
    if (input) input.checked = true;
    document.querySelectorAll('#ctRepeatBody .visibility-pills .vis-pill').forEach(function(p) { p.classList.remove('active'); });
    label.classList.add('active');
}

function ctSetEndType(val, label) {
    document.querySelectorAll('[name="repeat_end_type"]').forEach(function(r) { r.checked = false; });
    var input = label.querySelector('input');
    if (input) input.checked = true;
    document.querySelectorAll('.ct-end-pill').forEach(function(p) { p.classList.remove('active'); });
    label.classList.add('active');
    
    var endDateWrap = document.getElementById('ctEndDateWrap');
    var endCountWrap = document.getElementById('ctEndCountWrap');
    if (endDateWrap) endDateWrap.style.display = val === 'date' ? 'block' : 'none';
    if (endCountWrap) endCountWrap.style.display = val === 'count' ? 'block' : 'none';
}

function ctUpdateRepeatSummary() {
    var type = document.getElementById('ctRepeatType');
    var summary = document.getElementById('ctRepeatSummary');
    if (!type || !summary) return;
    
    var val = type.value;
    if (val === 'none' || val === '') {
        summary.textContent = '';
        return;
    }
    
    var parts = [];
    var labels = {none:'',daily:'Daily',weekly:'Weekly',monthly:'Monthly',yearly:'Yearly'};
    parts.push(labels[val] || val);
    
    if (val === 'weekly' && _ctSelectedDays.length > 0) {
        var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        var dayMap = {'0':'Sun','1':'Mon','2':'Tue','3':'Wed','4':'Thu','5':'Fri','6':'Sat'};
        var selected = _ctSelectedDays.map(function(d) { return dayMap[d] || d; }).join(', ');
        parts.push('on ' + selected);
    }
    
    if (val === 'monthly') {
        var byEl = document.querySelector('[name="repeat_by"]:checked');
        if (byEl && byEl.value === 'weekday') parts.push('same weekday');
    }
    
    var endType = document.querySelector('[name="repeat_end_type"]:checked');
    if (endType && endType.value === 'date') {
        var dateInput = document.getElementById('ctRepeatEndDate');
        if (dateInput && dateInput.value) {
            parts.push('until ' + dateInput.value);
        }
    } else if (endType && endType.value === 'count') {
        var countInput = document.getElementById('ctRepeatEndCount');
        if (countInput && countInput.value) {
            parts.push(countInput.value + 'x');
        }
    }
    
    summary.textContent = parts.join(' ');
}

function ctResetRepeatForm() {
    _ctSelectedDays = [];
    document.querySelectorAll('.ct-day-btn').forEach(function(b) { b.classList.remove('selected'); });
    document.getElementById('ctRepeatDays').value = '';
    
    // Reset repeat type
    var typeSel = document.getElementById('ctRepeatType');
    if (typeSel) typeSel.value = 'none';
    
    // Reset weekly/monthly options visibility
    var weekly = document.getElementById('ctWeeklyOptions');
    var monthly = document.getElementById('ctMonthlyOptions');
    if (weekly) weekly.style.display = 'none';
    if (monthly) monthly.style.display = 'none';
    
    // Reset repeat from
    var fromDue = document.getElementById('ctFromDueDateLabel');
    if (fromDue) { fromDue.classList.add('active'); var inp = fromDue.querySelector('input'); if (inp) inp.checked = true; }
    var fromComp = document.getElementById('ctFromCompletionLabel');
    if (fromComp) fromComp.classList.remove('active');
    
    // Reset end options
    var endNever = document.querySelector('.ct-end-pill:first-child');
    document.querySelectorAll('.ct-end-pill').forEach(function(p) { p.classList.remove('active'); });
    if (endNever) endNever.classList.add('active');
    document.querySelectorAll('[name="repeat_end_type"]').forEach(function(r) { r.checked = false; });
    var neverInput = endNever ? endNever.querySelector('input') : null;
    if (neverInput) neverInput.checked = true;
    
    var endDateWrap = document.getElementById('ctEndDateWrap');
    var endCountWrap = document.getElementById('ctEndCountWrap');
    if (endDateWrap) endDateWrap.style.display = 'none';
    if (endCountWrap) endCountWrap.style.display = 'none';
    
    // Reset summary
    var summary = document.getElementById('ctRepeatSummary');
    if (summary) summary.textContent = '';
}

// Bind end date/count inputs to update summary
document.addEventListener('DOMContentLoaded', function() {
    var endDateInput = document.getElementById('ctRepeatEndDate');
    var endCountInput = document.getElementById('ctRepeatEndCount');
    if (endDateInput) endDateInput.addEventListener('change', ctUpdateRepeatSummary);
    if (endCountInput) endCountInput.addEventListener('input', ctUpdateRepeatSummary);
});

function ctToggleApprovalMode() {
    var mode = document.getElementById('ctApprovalMode');
    var fields = document.getElementById('ctApprovalFields');
    var extra = document.getElementById('ctApprovalExtra');
    var reviewer = document.getElementById('ctReviewerWrap');
    var approver = document.getElementById('ctApproverWrap');
    if (!mode || !fields || !reviewer || !approver) return;
    var val = mode.value || 'none';
    fields.style.display = val === 'none' ? 'none' : 'grid';
    if (extra) extra.style.display = val === 'none' ? 'none' : 'block';
    reviewer.style.display = (val === 'review_only' || val === 'review_acceptance') ? 'block' : 'none';
    approver.style.display = val === 'review_acceptance' ? 'block' : 'none';
}

// Store search filter
function ctFilterStores(query) {
    var q = (query || '').toLowerCase().trim();
    var chips = document.querySelectorAll('#ctStoreChips .ct-store-chip');
    var visible = 0;
    chips.forEach(function(chip) {
        var name = chip.getAttribute('data-store-name') || '';
        var match = !q || name.indexOf(q) !== -1;
        chip.style.display = match ? '' : 'none';
        if (match) visible++;
    });
    var countEl = document.getElementById('ctStoreCount');
    if (countEl) {
        countEl.textContent = q ? visible + '/' + chips.length : '';
    }
}

// Evidence chip toggle
function ctToggleEvidence(chip) {
    var input = chip.querySelector('input');
    // Let checkbox toggle naturally since label wraps it
    setTimeout(function() {
        chip.classList.toggle('selected', input.checked);
    }, 0);
}

</script>

<script>
    // Globals needed by shared widgets (task-drawer, etc.)
    // Note: do NOT declare `var APP_URL` here — some views already `const APP_URL = ...`
    window.APP_URL = <?= json_encode(rtrim(APP_URL, '/')) ?>;
    window.CSRF_TOKEN = <?= json_encode(csrf_token()) ?>;
    // TZ-safe "today" in workspace timezone (avoid client toISOString drift)
    window.APP_TODAY = <?= json_encode(function_exists('app_today') ? app_today() : date('Y-m-d')) ?>;
// Create New dropdown
function closeCreateDropdown() {
    document.getElementById('createNewDropdown').classList.remove('open');
}
document.addEventListener('click', function(e) {
    const wrap = document.querySelector('.create-new-wrap');
    if (wrap && !wrap.contains(e.target)) closeCreateDropdown();
});

// Create Task Modal
function openCreateTaskModal() {
    var modal = document.getElementById('createTaskModal');
    // Reset form state
    var form = document.getElementById('quickTaskForm');
    if (form) form.reset();
    document.querySelectorAll('#ctStoreChips .ct-store-chip').forEach(function(c){ c.classList.remove('selected'); });
    if (typeof ctUpdateStoreHelper === 'function') ctUpdateStoreHelper();
    var approvalFields = document.getElementById('ctApprovalFields');
    var approvalExtra = document.getElementById('ctApprovalExtra');
    if (approvalFields) approvalFields.style.display = 'none';
    if (approvalExtra) approvalExtra.style.display = 'none';
    var repeatBody = document.getElementById('ctRepeatBody');
    if (repeatBody) repeatBody.style.display = 'none';
    var repeatHint = document.getElementById('ctRepeatCollapsedHint');
    if (repeatHint) repeatHint.style.display = '';
    document.querySelectorAll('#ctVisPills .vis-pill').forEach(function(p,i){ p.classList.toggle('active', i===0); });
    document.querySelectorAll('.ct-evidence-chip').forEach(function(c){ c.classList.remove('selected'); });
    if (typeof ctResetRepeatForm === 'function') ctResetRepeatForm();
    if (typeof ctLoadSections === 'function') ctLoadSections('');
    modal.classList.add('open');
    setTimeout(() => {
        const inp = document.querySelector('#quickTaskForm input[name="title"]');
        if (inp) inp.focus();
    }, 250);
}
function closeCreateTaskModal() {
    document.getElementById('createTaskModal').classList.remove('open');
}
document.getElementById('createTaskModal').addEventListener('click', function(e) {
    if (e.target === this) closeCreateTaskModal();
});

</script>
<script src="<?= APP_URL ?>/assets/js/safe-date.js"></script>
<script src="<?= APP_URL ?>/assets/js/error-boundary.js"></script>
<script src="<?= APP_URL ?>/assets/js/calendar-transform.js"></script>
<script src="<?= APP_URL ?>/assets/js/layout.js"></script>

<script>window.APP_URL = '<?= rtrim(APP_URL, '/') ?>';</script>
<script src="<?= APP_URL ?>/assets/js/app.js"></script>
<script src="<?= APP_URL ?>/assets/js/global-search.js"></script>

<?php if (!empty($extraJs ?? [])): ?>
    <?php foreach (($extraJs ?? []) as $js): ?>
        <script src="<?= APP_URL ?>/assets/js/<?= e($js) ?>"></script>
    <?php endforeach; ?>
<?php endif; ?>

<?php include __DIR__ . '/../partials/quick_actions.php'; ?>

<script>
// Register PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('<?= APP_URL ?>/sw.js').catch(()=>{});
}

</script>
</body>
</html>
