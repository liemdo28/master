<?php
/**
 * Phase 11.5 — Module 7: Quick Actions
 * Floating action button available on every page
 */
?>
<!-- Quick Actions FAB -->
<div class="quick-actions-fab" id="quickActionsFab" style="position:fixed;bottom:80px;right:24px;z-index:1000">
    <!-- Action buttons (hidden by default) -->
    <div class="qa-menu" id="qaMenu" style="display:none;position:absolute;bottom:56px;right:0;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:8px;box-shadow:0 8px 32px rgba(0,0,0,.3);min-width:200px">
        <a href="#" data-action="open-create-task" class="qa-item" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;text-decoration:none;color:inherit;font-size:13px">
            <span style="width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:var(--blue-bg);color:var(--blue)"><?= tf_icon('check-square', 14) ?></span>
            Create Task
        </a>
        <?php if (canAdmin() || canManage()): ?>
        <a href="<?= APP_URL ?>/incidents/create" class="qa-item" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;text-decoration:none;color:inherit;font-size:13px">
            <span style="width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#f8717120;color:#f87171"><?= tf_icon('alert-triangle', 14) ?></span>
            Create Incident
        </a>
        <a href="<?= APP_URL ?>/admin/releases/create" class="qa-item" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;text-decoration:none;color:inherit;font-size:13px">
            <span style="width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#a78bfa20;color:#a78bfa"><?= tf_icon('layers', 14) ?></span>
            Create Release Draft
        </a>
        <?php endif; ?>
        <a href="<?= APP_URL ?>/projects/create" class="qa-item" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;text-decoration:none;color:inherit;font-size:13px">
            <span style="width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#34d39920;color:#34d399"><?= tf_icon('folder', 14) ?></span>
            Create Project
        </a>
    </div>

    <!-- FAB Button -->
    <button id="qaToggle" onclick="toggleQuickActions()" style="width:48px;height:48px;border-radius:50%;background:var(--blue);color:white;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(59,130,246,.4);transition:transform .2s" aria-label="Quick Actions">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    </button>
</div>

<style>
.qa-item:hover { background: var(--bg-secondary); }
#qaToggle:hover { transform: scale(1.1); }
@media (max-width: 768px) {
    .quick-actions-fab { bottom: 100px; right: 16px; }
}
</style>

<script>
function toggleQuickActions() {
    const menu = document.getElementById('qaMenu');
    const btn = document.getElementById('qaToggle');
    const isOpen = menu.style.display !== 'none';
    menu.style.display = isOpen ? 'none' : 'block';
    btn.style.transform = isOpen ? '' : 'rotate(45deg)';
}
document.addEventListener('click', function(e) {
    if (!e.target.closest('#quickActionsFab')) {
        document.getElementById('qaMenu').style.display = 'none';
        document.getElementById('qaToggle').style.transform = '';
    }
});
</script>
