<?php
$pageTitle = 'Release: ' . e($release['name']);
$currentPage = 'admin-releases';

// Get timeline data
$timeline = $releaseModel->getTimeline($release['id']);

ob_start();
?>
<style>
.rd-header{display:flex;align-items:center;gap:16px;margin-bottom:24px;flex-wrap:wrap}
.rd-header h2{font-size:22px;color:#f4f4f5;margin:0}
.rd-back{color:#71717a;text-decoration:none;font-size:14px}
.rd-back:hover{color:#f4f4f5}
.rd-grid{display:grid;grid-template-columns:1fr 340px;gap:24px}
@media(max-width:900px){.rd-grid{grid-template-columns:1fr}}
.rd-card{background:#18181b;border:1px solid #27272a;border-radius:10px;padding:20px;margin-bottom:16px}
.rd-card h3{font-size:14px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.5px;margin:0 0 14px}
.rd-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.rd-meta dt{font-size:12px;color:#71717a}
.rd-meta dd{font-size:14px;color:#f4f4f5;margin:0 0 10px}
.rd-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase}
.rd-badge--draft{background:#2d2250;color:#a78bfa}
.rd-badge--ready_for_review{background:#422006;color:#fbbf24}
.rd-badge--qa_running{background:#1e3a5f;color:#60a5fa}
.rd-badge--qa_passed{background:#064e3b;color:#34d399}
.rd-badge--approved{background:#064e3b;color:#10b981}
.rd-badge--scheduled{background:#1e3a5f;color:#93c5fd}
.rd-badge--published{background:#052e16;color:#4ade80}
.rd-badge--archived{background:#27272a;color:#71717a}
.rd-badge--rolled_back{background:#450a0a;color:#fca5a5}
.rd-badge--changes_requested{background:#451a03;color:#fb923c}
.rd-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.rd-btn{padding:8px 16px;border-radius:6px;font-size:13px;font-weight:500;border:none;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.rd-btn--blue{background:#3b82f6;color:#fff}.rd-btn--blue:hover{background:#2563eb}
.rd-btn--green{background:#059669;color:#fff}.rd-btn--green:hover{background:#047857}
.rd-btn--red{background:#dc2626;color:#fff}.rd-btn--red:hover{background:#b91c1c}
.rd-btn--ghost{background:transparent;color:#a1a1aa;border:1px solid #27272a}.rd-btn--ghost:hover{background:#27272a;color:#f4f4f5}
.rd-btn--yellow{background:#d97706;color:#fff}.rd-btn--yellow:hover{background:#b45309}
.rd-wt{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rd-wt-item{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#09090b;border-radius:6px;font-size:13px}
.rd-wt-status{padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase}
.rd-wt-status--pass{background:#052e16;color:#4ade80}
.rd-wt-status--fail{background:#450a0a;color:#fca5a5}
.rd-wt-status--pending{background:#27272a;color:#71717a}
.rd-protect{margin-top:12px}
.rd-protect-item{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px}
.rd-protect-icon{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px}
.rd-protect-icon--pass{background:#052e16;color:#4ade80}
.rd-protect-icon--fail{background:#450a0a;color:#fca5a5}
.rd-review{padding:12px;background:#09090b;border-radius:8px;margin-bottom:10px;border-left:3px solid #27272a}
.rd-review--approval{border-left-color:#10b981}
.rd-review--changes_requested{border-left-color:#f59e0b}
.rd-review--rejection{border-left-color:#ef4444}
.rd-review__header{display:flex;justify-content:space-between;font-size:12px;color:#71717a;margin-bottom:6px}
.rd-review__body{font-size:14px;color:#d4d4d8}
.rd-link-item{display:flex;align-items:center;justify-content:space-between;padding:10px;background:#09090b;border-radius:6px;margin-bottom:8px}
.rd-link-url{font-size:12px;color:#60a5fa;word-break:break-all}
.rd-audit-item{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #1f1f23;font-size:13px}
.rd-audit-item:last-child{border-bottom:none}
.rd-audit-action{color:#a78bfa;font-weight:500;min-width:120px}
.rd-audit-user{color:#a1a1aa}
.rd-audit-time{color:#71717a;font-size:12px;margin-left:auto}
.rd-notes{white-space:pre-wrap;font-size:14px;color:#d4d4d8;line-height:1.6}
.rd-form-row{margin-bottom:12px}
.rd-form-row label{display:block;font-size:12px;color:#71717a;margin-bottom:4px}
.rd-form-row input,.rd-form-row select,.rd-form-row textarea{width:100%;background:#09090b;border:1px solid #27272a;color:#f4f4f5;padding:8px 12px;border-radius:6px;font-size:14px}
.rd-form-row textarea{min-height:80px;resize:vertical}

/* Timeline styles */
.rt-timeline{padding:4px 0}
.rt-event{display:flex;gap:12px;position:relative;padding-bottom:16px}
.rt-event:last-child{padding-bottom:0}
.rt-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#09090b;flex-shrink:0;position:relative;z-index:1}
.rt-line{position:absolute;left:13px;top:28px;bottom:0;width:2px;z-index:0}
.rt-content{flex:1;padding-top:4px}
.rt-label{font-size:13px;font-weight:600;margin-bottom:2px}
.rt-meta{display:flex;gap:8px;font-size:12px;color:#71717a}
.rt-reason{font-size:12px;color:#a1a1aa;font-style:italic;margin-top:4px}

/* Version notes section */
.rd-notes-section{display:flex;flex-direction:column;gap:12px}
.rd-note-item{background:#09090b;border-radius:8px;padding:12px 14px}
.rd-note-item__label{font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.rd-note-item__body{font-size:13px;color:#d4d4d8;line-height:1.6}
.rd-note-item__body--empty{color:#52525b;font-style:italic}
</style>

<!-- HEADER -->
<div class="rd-header">
    <a href="<?= APP_URL ?>/admin/releases" class="rd-back">&#8592; All Releases</a>
    <h2><?= e($release['name']) ?></h2>
    <span class="rd-badge rd-badge--<?= $release['status'] ?>"><?= ucwords(str_replace('_',' ',$release['status'])) ?></span>
    <?php if ($release['version']): ?>
    <span style="font-family:monospace;font-size:13px;color:#a78bfa;background:#2d2250;padding:3px 10px;border-radius:4px"><?= e($release['version']) ?></span>
    <?php endif; ?>
</div>

<div class="rd-grid">
<!-- LEFT COLUMN -->
<div>
    <?php require __DIR__ . '/partials/_show_main.php'; ?>
</div>
<!-- RIGHT COLUMN -->
<div>
    <?php require __DIR__ . '/partials/_show_sidebar.php'; ?>
</div>
</div>

<!-- Include modals at page level -->
<?php require __DIR__ . '/partials/_publish_safety_modal.php'; ?>
<?php require __DIR__ . '/partials/_share_link_dialog.php'; ?>

<?php
$content = ob_get_clean();
require __DIR__ . '/../layouts/main.php';
?>
