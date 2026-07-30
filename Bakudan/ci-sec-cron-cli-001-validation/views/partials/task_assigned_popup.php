<!-- Task Assigned Popup — auto-shows for task_assigned notifications created within last 5 min -->
<div id="task-assigned-popup" style="display:none;position:fixed;top:20px;right:20px;z-index:9999;width:320px;background:#1e2a3b;border:1px solid #334155;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:system-ui,sans-serif;">
    <div style="padding:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="color:#f1f5f9;font-weight:700;font-size:15px;">New Task Assigned</div>
            <button id="task-popup-close" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;line-height:1;padding:0;">&times;</button>
        </div>
        <div id="task-popup-body" style="color:#94a3b8;font-size:14px;"></div>
        <div style="margin-top:14px;display:flex;gap:8px;">
            <a id="task-popup-view" href="#" style="flex:1;background:#1e3a5f;color:#60a5fa;border:none;padding:8px;border-radius:6px;text-align:center;text-decoration:none;font-size:13px;font-weight:600;cursor:pointer;">View Task</a>
            <button id="task-popup-dismiss" style="flex:1;background:#374151;color:#d1d5db;border:none;padding:8px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Dismiss</button>
        </div>
    </div>
    <div id="task-popup-progress" style="height:3px;background:#3b82f6;border-radius:0 0 12px 12px;transition:width 10s linear;width:100%;"></div>
</div>

<script>
(function() {
    if (!window.__taskAssignedPopupChecked) {
        window.__taskAssignedPopupChecked = true;
    } else { return; }

    var popup     = document.getElementById('task-assigned-popup');
    var body      = document.getElementById('task-popup-body');
    var viewBtn   = document.getElementById('task-popup-view');
    var closeBtn  = document.getElementById('task-popup-close');
    var dismissBtn = document.getElementById('task-popup-dismiss');
    var progress  = document.getElementById('task-popup-progress');
    var hideTimer;

    function hidePopup() {
        popup.style.display = 'none';
        clearTimeout(hideTimer);
    }

    closeBtn.addEventListener('click', hidePopup);
    dismissBtn.addEventListener('click', function() {
        hidePopup();
        if (window.__taskPopupNotifId) {
            fetch('<?= APP_URL ?>/api/notifications/' + window.__taskPopupNotifId + '/read', {
                method: 'POST',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
        }
    });

    function showPopup(notif) {
        var meta = {};
        try { meta = JSON.parse(notif.metadata || '{}'); } catch(e) {}

        var rows = '';
        if (notif.title)         rows += '<div style="margin-bottom:6px;"><span style="color:#64748b;">Task:</span> <strong style="color:#f1f5f9;">' + escHtml(notif.title || '') + '</strong></div>';
        if (meta.store)          rows += '<div style="margin-bottom:4px;"><span style="color:#64748b;">Store:</span> ' + escHtml(meta.store) + '</div>';
        if (meta.due_date)       rows += '<div style="margin-bottom:4px;"><span style="color:#64748b;">Due:</span> ' + escHtml(meta.due_date) + '</div>';
        if (meta.priority)       rows += '<div style="margin-bottom:4px;"><span style="color:#64748b;">Priority:</span> <span style="text-transform:capitalize;">' + escHtml(meta.priority) + '</span></div>';
        if (meta.assigned_by)    rows += '<div style="margin-bottom:4px;"><span style="color:#64748b;">Assigned by:</span> ' + escHtml(meta.assigned_by) + '</div>';

        body.innerHTML = rows;
        var taskId = notif.task_id;
        viewBtn.href = taskId ? '<?= APP_URL ?>/tasks/' + taskId : '#';
        window.__taskPopupNotifId = notif.id;
        popup.style.display = 'block';

        // Auto-hide after 10s
        progress.style.width = '100%';
        setTimeout(function() { progress.style.width = '0%'; }, 50);
        hideTimer = setTimeout(hidePopup, 10000);
    }

    function escHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // Poll for recent unread task_assigned notifications (created in last 5 min)
    function checkNotifications() {
        fetch('<?= APP_URL ?>/api/notifications?type=task_assigned&unread=1', {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            var notifs = data.notifications || [];
            var fiveMinAgo = Date.now() - 5 * 60 * 1000;
            for (var i = 0; i < notifs.length; i++) {
                var n = notifs[i];
                if ((n.type === 'task_assigned' || n.notification_type === 'task_assigned') && n.is_read == 0) {
                    var created = new Date(n.created_at).getTime();
                    if (created >= fiveMinAgo) {
                        showPopup(n);
                        break; // show first matching only
                    }
                }
            }
        })
        .catch(function() {});
    }

    // Run on page load
    checkNotifications();
})();
</script>
